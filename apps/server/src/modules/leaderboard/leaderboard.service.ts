import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

/** 获取 ISO 周标识，如 "2026-W24" */
function getWeekNumber(date: Date = new Date()): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  // 周四所在周即为该年的 ISO 周
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  getCurrentWeek() {
    return getWeekNumber();
  }

  async getRedBoard(week?: string) {
    const targetWeek = week || this.getCurrentWeek();
    const entries = await this.prisma.leaderboard.findMany({
      where: { type: 'RED', week: targetWeek },
      include: { user: true },
      orderBy: { score: 'desc' },
    });

    const categories = ['击杀王', '伤害王', '吃鸡王', '爆头王'];
    const result: Record<string, typeof entries> = {};
    for (const cat of categories) {
      result[cat] = entries.filter((e) => e.category === cat).slice(0, 10);
    }
    return { week: targetWeek, boards: result };
  }

  async getTeamRedBoard(week?: string) {
    const targetWeek = week || this.getCurrentWeek();
    const year = parseInt(targetWeek.substring(0, 4), 10);
    const weekNum = parseInt(targetWeek.substring(6), 10);
    const janFirst = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7 - ((janFirst.getDay() + 6) % 7);
    const startOfWeek = new Date(year, 0, 1 + daysOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const teams = await this.prisma.team.findMany({ include: { members: true } });
    const teamBoards: { teamId: string; teamName: string; kills: number; damage: number; wins: number; headshots: number }[] = [];

    for (const team of teams) {
      const userIds = team.members.map((m) => m.userId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: userIds } },
      });
      const pubgIds = users.map((u) => u.pubgId);
      if (!pubgIds.length) continue;

      // 只统计共同组排的比赛
      const allMatches = await this.prisma.match.findMany({
        where: { pubgId: { in: pubgIds }, playedAt: { gte: startOfWeek, lte: endOfWeek } },
      });

      // 按 matchId 分组，只保留 ≥2 名车队成员共同参与的场次
      const matchGroups = new Map<string, any[]>();
      for (const m of allMatches) {
        const arr = matchGroups.get(m.matchId) || [];
        arr.push(m);
        matchGroups.set(m.matchId, arr);
      }
      const teamPubgIdSet = new Set(pubgIds);
      const commonMatchIds = new Set<string>();
      for (const [matchId, records] of matchGroups) {
        const uniqueIds = new Set(records.map((r) => r.pubgId));
        const common = [...uniqueIds].filter((id) => teamPubgIdSet.has(id)).length;
        if (common >= 2) commonMatchIds.add(matchId);
      }

      const matches = allMatches.filter((m) => commonMatchIds.has(m.matchId));
      const kills = matches.reduce((s, m) => s + m.kills, 0);
      const damage = Math.round(matches.reduce((s, m) => s + m.damage, 0) * 100) / 100;
      const headshots = matches.reduce((s, m) => s + m.headshots, 0);

      // 吃鸡次数：按 matchId 去重（同场多人吃鸡只算一次）
      const winMatchIds = new Set(matches.filter((m) => m.won).map((m) => m.matchId));
      const wins = winMatchIds.size;

      teamBoards.push({ teamId: team.id, teamName: team.name, kills, damage, wins, headshots });
    }

    const categories = ['击杀王', '伤害王', '吃鸡王', '爆头王'];
    const result: Record<string, any[]> = {};
    result['击杀王'] = teamBoards.sort((a, b) => b.kills - a.kills).map((t) => ({ teamId: t.teamId, teamName: t.teamName, score: t.kills }));
    result['伤害王'] = teamBoards.sort((a, b) => b.damage - a.damage).map((t) => ({ teamId: t.teamId, teamName: t.teamName, score: t.damage }));
    result['吃鸡王'] = teamBoards.sort((a, b) => b.wins - a.wins).map((t) => ({ teamId: t.teamId, teamName: t.teamName, score: t.wins }));
    result['爆头王'] = teamBoards.sort((a, b) => b.headshots - a.headshots).map((t) => ({ teamId: t.teamId, teamName: t.teamName, score: t.headshots }));

    return { week: targetWeek, boards: result };
  }

  async getBlackBoard(week?: string) {
    const targetWeek = week || this.getCurrentWeek();
    const entries = await this.prisma.leaderboard.findMany({
      where: { type: 'BLACK', week: targetWeek },
      include: { user: true },
      orderBy: { score: 'desc' },
    });

    const categories = ['落地成盒王', '队友克星', '快递员', '修脚大师'];
    const result: Record<string, typeof entries> = {};
    for (const cat of categories) {
      result[cat] = entries.filter((e) => e.category === cat).slice(0, 10);
    }
    return { week: targetWeek, boards: result };
  }

  async getMvpBoard(week?: string) {
    const targetWeek = week || this.getCurrentWeek();
    const entries = await this.prisma.leaderboard.findMany({
      where: { type: 'MVP', week: targetWeek },
      include: { user: true },
      orderBy: { score: 'desc' },
      take: 20,
    });
    return { week: targetWeek, entries };
  }

  async recalculateAll(week?: string, teamId?: string) {
    const targetWeek = week || this.getCurrentWeek();
    // 解析周标识获取周一起始和周日结束
    const year = parseInt(targetWeek.substring(0, 4), 10);
    const weekNum = parseInt(targetWeek.substring(6), 10);
    const janFirst = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7 - ((janFirst.getDay() + 6) % 7);
    const startOfWeek = new Date(year, 0, 1 + daysOffset);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        pubgId: true,
        matches: {
          where: { playedAt: { gte: startOfWeek, lte: endOfWeek } },
          select: {
            kills: true,
            damage: true,
            won: true,
            headshots: true,
            teamKills: true,
            survivalTime: true,
            matchId: true,
          },
        },
      },
    });

    // 如果当前周没有比赛，自动回退到最近有比赛的周
    const hasMatches = users.some((u) => u.matches.length > 0);
    if (!hasMatches) {
      const latestMatch = await this.prisma.match.findFirst({
        orderBy: { playedAt: 'desc' },
        select: { playedAt: true },
      });
      if (latestMatch) {
        const fallbackWeek = getWeekNumber(latestMatch.playedAt);
        if (fallbackWeek !== targetWeek) {
          return this.recalculateAll(fallbackWeek, teamId);
        }
      }
      return { week: targetWeek, calculated: 0 };
    }

    const entries = [];
    for (const user of users) {
      const matches = user.matches;
      if (!matches.length) continue;

      const totalKills = matches.reduce((s, m) => s + m.kills, 0);
      const totalDamage = matches.reduce((s, m) => s + m.damage, 0);
      const totalWins = matches.filter((m) => m.won).length;
      const totalHeadshots = matches.reduce((s, m) => s + m.headshots, 0);
      const totalTeamKills = matches.reduce((s, m) => s + m.teamKills, 0);
      const avgSurvival = matches.reduce((s, m) => s + m.survivalTime, 0) / matches.length;
      const earlyDeaths = matches.filter((m) => m.survivalTime < 120).length;

      // MVP Score: weighted formula combining kills, damage, wins, headshots, and survival
      const mvpScore = Math.round((totalKills * 3 + totalDamage * 0.02 + avgSurvival * 0.01 + totalWins * 100 + totalHeadshots * 2) * 100) / 100;

      entries.push(
        { type: 'RED', category: '击杀王', userId: user.id, teamId: teamId || null, score: totalKills, week: targetWeek },
        { type: 'RED', category: '伤害王', userId: user.id, teamId: teamId || null, score: Math.round(totalDamage * 100) / 100, week: targetWeek },
        { type: 'RED', category: '吃鸡王', userId: user.id, teamId: teamId || null, score: totalWins, week: targetWeek },
        { type: 'RED', category: '爆头王', userId: user.id, teamId: teamId || null, score: totalHeadshots, week: targetWeek },
        { type: 'BLACK', category: '落地成盒王', userId: user.id, teamId: teamId || null, score: earlyDeaths, week: targetWeek },
        { type: 'BLACK', category: '队友克星', userId: user.id, teamId: teamId || null, score: totalTeamKills, week: targetWeek },
        { type: 'BLACK', category: '修脚大师', userId: user.id, teamId: teamId || null, score: totalKills > 0 ? Math.round(((totalKills - totalHeadshots) / totalKills) * 100) : 0, week: targetWeek },
        { type: 'MVP', category: 'MVP', userId: user.id, teamId: teamId || null, score: mvpScore, week: targetWeek },
      );

      // 快递员：负数不上榜（击杀数 ≥ 场次的不计入）
      const courierScore = matches.length - totalKills;
      if (courierScore > 0) {
        entries.push({ type: 'BLACK', category: '快递员', userId: user.id, teamId: teamId || null, score: courierScore, week: targetWeek });
      }
    }

    // Batch upsert
    await this.prisma.$transaction(
      entries.map((e) =>
        this.prisma.leaderboard.upsert({
          where: {
            type_category_userId_week: {
              type: e.type,
              category: e.category,
              userId: e.userId,
              week: e.week,
            },
          },
          update: { score: e.score, teamId: e.teamId },
          create: e,
        }),
      ),
    );

    return { week: targetWeek, calculated: entries.length };
  }
}
