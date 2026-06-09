import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import axios from 'axios';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly pubgBase = process.env.PUBG_API_BASE || 'https://api.pubg.com/shards/steam';
  private readonly apiKey = process.env.PUBG_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

  async getSeasonStats(pubgId: string) {
    if (!this.apiKey) throw new Error('PUBG_API_KEY 未配置');

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/vnd.api+json',
    };

    try {
      const playerRes = await axios.get(`${this.pubgBase}/players`, {
        headers,
        params: { 'filter[playerNames]': pubgId },
      });
      const playerData = playerRes.data?.data?.[0];
      if (!playerData) throw new NotFoundException('未找到玩家');
      const accountId = playerData.id;

      const seasonsRes = await axios.get(`${this.pubgBase}/seasons`, { headers });
      const seasons = seasonsRes.data?.data || [];
      const currentSeason = seasons.find((s: any) => s.attributes?.isCurrentSeason === true);
      const seasonId = currentSeason?.id || 'lifetime';

      const statsRes = await axios.get(
        `${this.pubgBase}/players/${accountId}/seasons/${seasonId}`,
        { headers },
      );
      const statsData = statsRes.data?.data?.attributes;
      const gameModes = statsData?.gameModeStats || {};

      const extract = (mode: any) => ({
      roundsPlayed: mode?.roundsPlayed || 0,
      kills: mode?.kills || 0,
      damageDealt: mode?.damageDealt || 0,
      wins: mode?.wins || 0,
      headshotKills: mode?.headshotKills || 0,
      assists: mode?.assists || 0,
      revives: mode?.revives || 0,
      longestKill: mode?.longestKill || 0,
      bestRank: mode?.bestRank || 99,
      avgRank: mode?.avgRank || 0,
      winPoints: mode?.winPoints || 0,
    });

    const squad = extract(gameModes.squad);
    const squadFpp = extract(gameModes['squad-fpp']);
    const totalRounds = squad.roundsPlayed + squadFpp.roundsPlayed;

      return {
        roundsPlayed: totalRounds,
        kills: squad.kills + squadFpp.kills,
        damageDealt: Math.round((squad.damageDealt + squadFpp.damageDealt) * 100) / 100,
        wins: squad.wins + squadFpp.wins,
        headshotKills: squad.headshotKills + squadFpp.headshotKills,
        assists: squad.assists + squadFpp.assists,
        revives: squad.revives + squadFpp.revives,
        longestKill: Math.max(squad.longestKill, squadFpp.longestKill),
        bestRank: Math.min(squad.bestRank, squadFpp.bestRank),
        avgKills: totalRounds > 0 ? Math.round(((squad.kills + squadFpp.kills) / totalRounds) * 100) / 100 : 0,
        avgDamage: totalRounds > 0 ? Math.round(((squad.damageDealt + squadFpp.damageDealt) / totalRounds) * 100) / 100 : 0,
        winRate: totalRounds > 0 ? Math.round(((squad.wins + squadFpp.wins) / totalRounds) * 10000) / 10000 : 0,
        seasonId,
      };
    } catch (err: any) {
      if (err.response?.status === 429) {
        this.logger.warn(`PUBG API 限流，赛季统计暂时不可用`);
        return null;
      }
      throw err;
    }
  }

  async getOverview() {
    const [
      totalPlayers,
      totalMatches,
      totalKills,
      avgKills,
      recentMatches,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.match.count(),
      this.prisma.match.aggregate({ _sum: { kills: true } }),
      this.prisma.playerStats.aggregate({ _avg: { avgKills: true } }),
      this.prisma.match.findMany({
        take: 5,
        orderBy: { playedAt: 'desc' },
        include: { user: true },
      }),
    ]);

    return {
      totalPlayers,
      totalMatches,
      totalKills: totalKills._sum.kills || 0,
      avgKills: avgKills._avg.avgKills || 0,
      recentMatches,
    };
  }

  async getPlayerStats(userId: string, pubgId?: string) {
    // Resolve pubgId if only userId is provided
    if (!pubgId) {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: userId }, { pubgId: userId }],
        },
        select: { id: true, pubgId: true },
      });
      if (!user) throw new NotFoundException('用户不存在');
      userId = user.id;
      pubgId = user.pubgId;
    }

    const stats = await this.prisma.playerStats.findUnique({
      where: { playerId: userId },
      include: { player: true },
    });

    const recentTrend = await this.prisma.match.findMany({
      where: { pubgId },
      orderBy: { playedAt: 'desc' },
      take: 30,
      select: {
        kills: true,
        damage: true,
        rank: true,
        survivalTime: true,
        won: true,
        playedAt: true,
      },
    });

    const bestMatch = await this.prisma.match.findFirst({
      where: { pubgId },
      select: {
        id: true,
        matchId: true,
        kills: true,
        damage: true,
        rank: true,
        won: true,
        mapName: true,
        playedAt: true,
      },
      orderBy: [{ kills: 'desc' }, { damage: 'desc' }],
    });

    return { stats, recentTrend, bestMatch };
  }

  async recalculateStats(userId: string, pubgId?: string) {
    // Resolve pubgId if only userId is provided
    if (!pubgId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { pubgId: true } });
      if (!user) return;
      pubgId = user.pubgId;
    }

    const matches = await this.prisma.match.findMany({ where: { pubgId } });
    if (!matches.length) return;

    const totalMatches = matches.length;
    const totalWins = matches.filter((m) => m.won).length;
    const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
    const totalDamage = matches.reduce((sum, m) => sum + m.damage, 0);
    const totalHeadshots = matches.reduce((sum, m) => sum + m.headshots, 0);
    const avgKills = totalKills / totalMatches;
    const avgDamage = totalDamage / totalMatches;
    const avgSurvivalTime = Math.round(matches.reduce((sum, m) => sum + m.survivalTime, 0) / totalMatches);
    const kda = Math.round(avgKills * 100) / 100;
    const winRate = Math.round((totalWins / totalMatches) * 100) / 100;

    await this.prisma.playerStats.upsert({
      where: { playerId: userId },
      update: {
        totalMatches,
        totalWins,
        totalKills,
        totalDamage: Math.round(totalDamage * 100) / 100,
        totalHeadshots,
        avgKills: Math.round(avgKills * 100) / 100,
        avgDamage: Math.round(avgDamage * 100) / 100,
        avgSurvivalTime: Math.round(avgSurvivalTime),
        kda,
        winRate,
      },
      create: {
        playerId: userId,
        totalMatches,
        totalWins,
        totalKills,
        totalDamage: Math.round(totalDamage * 100) / 100,
        totalHeadshots,
        avgKills: Math.round(avgKills * 100) / 100,
        avgDamage: Math.round(avgDamage * 100) / 100,
        avgSurvivalTime: Math.round(avgSurvivalTime),
        kda,
        winRate,
      },
    });
  }

  async getTeamStats(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: {
              include: { playerStats: true },
            },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('队伍不存在');

    const memberStats = team.members.map((m) => ({
      userId: m.user.id,
      nickname: m.user.nickname,
      pubgId: m.user.pubgId,
      stats: m.user.playerStats,
      matchCount: m.matchCount,
    }));

    const totalKills = memberStats.reduce((s, m) => s + (m.stats?.totalKills || 0), 0);
    const totalWins = memberStats.reduce((s, m) => s + (m.stats?.totalWins || 0), 0);
    const totalMatches = memberStats.reduce((s, m) => s + (m.stats?.totalMatches || 0), 0);

    return {
      teamId: team.id,
      teamName: team.name,
      memberCount: team.members.length,
      totalKills,
      totalWins,
      totalMatches,
      members: memberStats,
    };
  }
}
