import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 自动检测车队：使用图论最大团算法
   *
   * 规则：
   * 1. 车队所有成员必须是全连通的（每对玩家至少一起打过一局比赛）
   * 2. 允许一个车队是另一个车队的子集
   *
   * 算法：Bron-Kerbosch 查找所有最大团
   */
  async detectTeams() {
    // 1. 找出有 2+ 已注册用户共同参与的比赛
    const matchGroups: Array<{ match_id: string }> = await this.prisma.$queryRaw`
      SELECT match_id
      FROM matches
      GROUP BY match_id
      HAVING COUNT(DISTINCT pubg_id) >= 2
    `;

    if (matchGroups.length === 0) {
      return { message: '没有含多名玩家的比赛' };
    }

    // 2. 获取所有已注册用户
    const allUsers = await this.prisma.user.findMany({
      select: { id: true, pubgId: true, nickname: true },
    });
    if (allUsers.length < 2) {
      return { message: '注册用户不足 2 人' };
    }

    const userIdByPubgId = new Map(allUsers.map((u) => [u.pubgId, u.id]));
    const userNicknameById = new Map(allUsers.map((u) => [u.id, u.nickname]));

    // 3. 构建邻接图
    const adjacency = new Map<string, Set<string>>();
    for (const u of allUsers) adjacency.set(u.id, new Set());

    for (const row of matchGroups) {
      const records = await this.prisma.match.findMany({
        where: { matchId: row.match_id },
        select: { pubgId: true },
      });
      const matchedIds = [
        ...new Set(
          records
            .map((r) => userIdByPubgId.get(r.pubgId))
            .filter(Boolean) as string[],
        ),
      ];
      if (matchedIds.length < 2) continue;
      for (const u of matchedIds) {
        for (const v of matchedIds) {
          if (u !== v) adjacency.get(u)!.add(v);
        }
      }
    }

    // 4. Bron-Kerbosch 查找所有最大团
    const allNodes = [...adjacency.entries()]
      .filter(([, neighbors]) => neighbors.size > 0)
      .map(([id]) => id);

    if (allNodes.length < 2) {
      return { message: '没有连通的玩家关系' };
    }

    const cliques: string[][] = [];

    const bronKerbosch = (R: Set<string>, P: Set<string>, X: Set<string>) => {
      if (P.size === 0 && X.size === 0) {
        if (R.size >= 2) cliques.push([...R].sort());
        return;
      }
      const pArr = [...P];
      for (const v of pArr) {
        const neighbors = adjacency.get(v) || new Set();
        bronKerbosch(
          new Set([...R, v]),
          new Set(pArr.filter((x) => x !== v && neighbors.has(x))),
          new Set([...X].filter((x) => neighbors.has(x))),
        );
        P.delete(v);
        X.add(v);
      }
    };

    bronKerbosch(new Set(), new Set(allNodes), new Set());

    if (cliques.length === 0) {
      return { message: '没有形成任何有效车队', cliques: 0 };
    }

    // 5. 收集已有车队信息
    const existingTeams = await this.prisma.team.findMany({
      include: { members: { select: { userId: true } } },
    });

    const teamByMemberKey = new Map<string, any>();
    for (const team of existingTeams) {
      const key = team.members.map((m: any) => m.userId).sort().join(',');
      teamByMemberKey.set(key, team);
    }

    // 6. 清空旧成员关系
    await this.prisma.teamMember.deleteMany();

    // 7. 创建/更新车队
    const activeTeamIds = new Set<string>();

    for (const memberIds of cliques) {
      const memberKey = [...memberIds].sort().join(',');
      const existing = teamByMemberKey.get(memberKey);

      let teamId: string;
      if (existing) {
        teamId = existing.id;
        activeTeamIds.add(teamId);
      } else {
        const nicknames = memberIds
          .map((id) => userNicknameById.get(id) || '未知')
          .join('、');
        const team = await this.prisma.team.create({
          data: { name: `${nicknames}的车队` },
        });
        teamId = team.id;
        activeTeamIds.add(teamId);
      }

      for (const userId of memberIds) {
        const pubgId = allUsers.find((u) => u.id === userId)?.pubgId;
        const matchCount = pubgId
          ? await this.prisma.match.count({ where: { pubgId } })
          : 0;

        await this.prisma.teamMember.create({
          data: { teamId, userId, matchCount },
        });
      }
    }

    // 8. 清理过期车队
    for (const team of existingTeams) {
      if (!activeTeamIds.has(team.id)) {
        await this.prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      }
    }

    return {
      message: `车队检测完成，共 ${cliques.length} 个全连通车队`,
      cliques: cliques.length,
      members: cliques.reduce((s, c) => s + c.length, 0),
    };
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

  // ==================== 撞车记录 ====================

  /** 获取某个车队的撞车记录（含对手车队信息） */
  async getTeamMatchups(teamId: string) {
    const matchups = await this.prisma.teamMatchup.findMany({
      where: {
        OR: [{ teamAId: teamId }, { teamBId: teamId }],
      },
      include: {
        teamA: {
          include: {
            members: { include: { user: { select: { nickname: true, pubgId: true } } } },
          },
        },
        teamB: {
          include: {
            members: { include: { user: { select: { nickname: true, pubgId: true } } } },
          },
        },
      },
      orderBy: { playedAt: 'desc' },
    });

    return matchups.map((m) => ({
      matchId: m.matchId,
      playedAt: m.playedAt,
      opponentTeam:
        m.teamAId === teamId
          ? { id: m.teamBId, name: m.teamB.name, members: m.teamB.members }
          : { id: m.teamAId, name: m.teamA.name, members: m.teamA.members },
    }));
  }

  /** 获取所有撞车记录 */
  async getAllMatchups() {
    const matchups = await this.prisma.teamMatchup.findMany({
      include: {
        teamA: {
          include: {
            members: { include: { user: { select: { nickname: true, pubgId: true } } } },
          },
        },
        teamB: {
          include: {
            members: { include: { user: { select: { nickname: true, pubgId: true } } } },
          },
        },
      },
      orderBy: { playedAt: 'desc' },
      take: 100,
    });

    return matchups.map((m) => ({
      matchId: m.matchId,
      playedAt: m.playedAt,
      teamA: { id: m.teamAId, name: m.teamA.name, members: m.teamA.members },
      teamB: { id: m.teamBId, name: m.teamB.name, members: m.teamB.members },
    }));
  }
}
/** 解析周标识 "2026-W24" => { start: Date, end: Date }
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
