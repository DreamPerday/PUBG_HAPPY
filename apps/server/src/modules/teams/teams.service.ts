import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 自动检测车队：查找同一 match 中出现 >=2 个已注册用户的记录，
   * 自动创建或更新车队以及队员关系。
   */
  async detectTeams() {
    // 1. 按 matchId 分组，找出包含 >=2 个不同 pubgId 的比赛
    const rawResults: Array<{ match_id: string; player_count: number }> =
      await this.prisma.$queryRaw`
        SELECT match_id, COUNT(DISTINCT pubg_id) AS player_count
        FROM matches
        GROUP BY match_id
        HAVING COUNT(DISTINCT pubg_id) >= 2
      `;

    const results: Array<{ team: any; members: any[]; matchId: string }> = [];

    for (const row of rawResults) {
      const matchId = row.match_id;

      // 2. 获取该 match 中的所有 pubgId
      const matchRecords = await this.prisma.match.findMany({
        where: { matchId },
        select: { pubgId: true },
      });
      const pubgIds = [...new Set(matchRecords.map((r) => r.pubgId))];

      // 3. 找已注册的用户
      const users = await this.prisma.user.findMany({
        where: { pubgId: { in: pubgIds } },
      });
      if (users.length < 2) continue;

      const userIds = users.map((u) => u.id);

      // 4. 找已存在的车队成员关系
      const existingMembers = await this.prisma.teamMember.findMany({
        where: { userId: { in: userIds } },
        include: { team: true },
      });

      // 统计每个车队的重叠成员数
      const overlapMap = new Map<string, number>();
      for (const member of existingMembers) {
        overlapMap.set(
          member.teamId,
          (overlapMap.get(member.teamId) || 0) + 1,
        );
      }

      // 选重叠最多的车队
      let bestTeamId: string | null = null;
      let bestOverlap = 0;
      for (const [teamId, overlap] of overlapMap) {
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestTeamId = teamId;
        }
      }

      let team;
      if (bestTeamId) {
        team = await this.prisma.team.findUnique({
          where: { id: bestTeamId },
        });
      }

      // 5. 没有合适的车队则新建
      if (!team) {
        const teamName = users.map((u) => u.nickname).join('、') + '的车队';
        team = await this.prisma.team.create({
          data: { name: teamName },
        });
      }

      // 6. 更新/创建队员关系
      for (const userId of userIds) {
        await this.prisma.teamMember.upsert({
          where: {
            teamId_userId: { teamId: team.id, userId },
          },
          update: { matchCount: { increment: 1 } },
          create: { teamId: team.id, userId, matchCount: 1 },
        });
      }

      results.push({ team, members: users, matchId });
    }

    return results;
  }

  /** 获取用户所属的所有车队 */
  async getUserTeams(userId: string) {
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          include: {
            members: {
              include: { user: true },
              orderBy: { matchCount: 'desc' },
            },
            _count: { select: { members: true } },
          },
        },
      },
    });
    return teamMembers.map((tm) => tm.team);
  }

  /** 获取所有车队及成员数量 */
  async findAll() {
    return this.prisma.team.findMany({
      include: {
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 获取车队详情（含成员信息） */
  async findOne(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: { user: true },
          orderBy: { matchCount: 'desc' },
        },
      },
    });
    if (!team) throw new NotFoundException('车队不存在');
    return team;
  }

  /** 获取车队统计（可按周过滤） */
  async getTeamStats(teamId: string, week?: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });
    if (!team) throw new NotFoundException('车队不存在');

    const memberIds = team.members.map((m) => m.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: memberIds } },
    });
    const pubgIds = users.map((u) => u.pubgId);

    // 构建 match 查询条件
    const matchWhere: any = { pubgId: { in: pubgIds } };
    if (week) {
      const parsed = parseWeek(week);
      if (parsed) {
        matchWhere.playedAt = {
          gte: parsed.start,
          lt: parsed.end,
        };
      }
    }

    // 获取所有成员的所有比赛
    const allMatches = await this.prisma.match.findMany({
      where: matchWhere,
    });

    // 按 matchId 分组，只保留至少有2名车队成员共同参与的场次
    const matchGroups = new Map<string, typeof allMatches>();
    for (const m of allMatches) {
      const arr = matchGroups.get(m.matchId) || [];
      arr.push(m);
      matchGroups.set(m.matchId, arr);
    }

    const teamPubgIdSet = new Set(pubgIds);
    const commonMatchIds = new Set<string>();
    for (const [matchId, records] of matchGroups) {
      const uniquePubgIds = new Set(records.map((r) => r.pubgId));
      // 只保留至少2名车队成员共同参与的场次
      const commonCount = [...uniquePubgIds].filter((id) => teamPubgIdSet.has(id)).length;
      if (commonCount >= 2) {
        commonMatchIds.add(matchId);
      }
    }

    // 只保留车队成员共同参与的场次
    const matches = allMatches.filter((m) => commonMatchIds.has(m.matchId));

    // 总场次 = 去重后的共同比赛场次数（不重复计算每人）
    const totalMatches = commonMatchIds.size;

    // 总击杀/总伤害 = 所有成员在这些场次中的总和（正确）
    const totalKills = matches.reduce((s, m) => s + m.kills, 0);
    const totalDamage = matches.reduce((s, m) => s + m.damage, 0);

    // 吃鸡次数 = 共同场次中吃鸡的场次数（去重）
    const winMatchIds = new Set(
      matches.filter((m) => m.won).map((m) => m.matchId),
    );
    const totalWins = winMatchIds.size;

    const memberStats = users.map((user) => {
      const userMatches = matches.filter((m) => m.pubgId === user.pubgId);
      return {
        user,
        matches: userMatches.length,
        kills: userMatches.reduce((s, m) => s + m.kills, 0),
        damage: userMatches.reduce((s, m) => s + m.damage, 0),
        wins: userMatches.filter((m) => m.won).length,
        avgKills:
          userMatches.length > 0
            ? userMatches.reduce((s, m) => s + m.kills, 0) / userMatches.length
            : 0,
        avgDamage:
          userMatches.length > 0
            ? userMatches.reduce((s, m) => s + m.damage, 0) /
              userMatches.length
            : 0,
        bestRank: userMatches.length
          ? Math.min(...userMatches.map((m) => m.rank))
          : null,
      };
    });

    return {
      team,
      totalMatches,
      totalKills,
      totalDamage,
      totalWins,
      avgKills: totalMatches > 0 ? totalKills / totalMatches : 0,
      avgDamage: totalMatches > 0 ? totalDamage / totalMatches : 0,
      winRate: totalMatches > 0 ? totalWins / totalMatches : 0,
      bestRank: matches.length
        ? Math.min(...matches.map((m) => m.rank))
        : null,
      memberStats,
    };
  }
  /** 获取所有车队统计对比 */
  async getAllTeamStats() {
    const teams = await this.prisma.team.findMany({
      include: { members: { include: { user: true } } },
    });

    const results = [];
    for (const team of teams) {
      const pubgIds = team.members.map((m) => m.user.pubgId);
      if (pubgIds.length < 2) continue;

      const allMatches = await this.prisma.match.findMany({
        where: { pubgId: { in: pubgIds } },
      });

      // 只保留共同组排场次
      const matchGroups = new Map<string, any[]>();
      for (const m of allMatches) {
        const arr = matchGroups.get(m.matchId) || [];
        arr.push(m);
        matchGroups.set(m.matchId, arr);
      }
      const teamPubgIdSet = new Set(pubgIds);
      let totalMatches = 0;
      let totalKills = 0;
      let totalDamage = 0;
      let totalWins = 0;

      for (const [matchId, records] of matchGroups) {
        const uniqueIds = new Set(records.map((r) => r.pubgId));
        const common = [...uniqueIds].filter((id) => teamPubgIdSet.has(id)).length;
        if (common < 2) continue;
        totalMatches++;
        totalKills += records.reduce((s, r) => s + r.kills, 0);
        totalDamage += records.reduce((s, r) => s + r.damage, 0);
        if (records.some((r) => r.won)) totalWins++;
      }

      results.push({
        teamId: team.id,
        teamName: team.name,
        memberCount: team.members.length,
        totalMatches,
        totalKills,
        totalDamage: Math.round(totalDamage),
        totalWins,
        avgKills: totalMatches > 0 ? +(totalKills / totalMatches).toFixed(1) : 0,
        avgDamage: totalMatches > 0 ? Math.round(totalDamage / totalMatches) : 0,
        winRate: totalMatches > 0 ? +(totalWins / totalMatches).toFixed(3) : 0,
      });
    }

    // 排序找出最佳/最黑
    const byWins = [...results].sort((a, b) => b.totalWins - a.totalWins);
    const byKills = [...results].sort((a, b) => b.totalKills - a.totalKills);
    const worst = [...results].sort((a, b) => a.totalKills - b.totalKills);

    return {
      teams: results,
      bestTeam: byKills[0] || null,
      bestWinTeam: byWins[0] || null,
      worstTeam: worst[0] || null,
    };
  }
}

/**
 * 解析周标识 "2026-W24" => { start: Date, end: Date }
 */
function parseWeek(week: string): { start: Date; end: Date } | null {
  const match = week.match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const weekNum = parseInt(match[2], 10);

  // 计算该年第 weekNum 周的周一开始时刻
  const janFirst = new Date(year, 0, 1);
  const dayOfWeek = janFirst.getDay();
  const daysOffset = (weekNum - 1) * 7 - ((dayOfWeek + 6) % 7);
  const start = new Date(year, 0, 1 + daysOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}
