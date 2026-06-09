import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PubgBatchService } from '../pubg/services/pubg-batch.service';
import { PubgCacheService, CacheNamespace } from '../pubg/services/pubg-cache.service';
import { PubgRateLimiterService } from '../pubg/services/pubg-rate-limiter.service';
import axios from 'axios';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private readonly pubgBase = process.env.PUBG_API_BASE || 'https://api.pubg.com/shards/steam';
  private readonly apiKey = process.env.PUBG_API_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pubgBatchService: PubgBatchService,
    private readonly cacheService: PubgCacheService,
    private readonly rateLimiter: PubgRateLimiterService,
  ) {}

  async getSeasonStats(pubgId: string) {
    if (!this.apiKey) throw new Error('PUBG_API_KEY 未配置');

    // 1. 获取 accountId（优先使用缓存或数据库）
    const accountIdMap = await this.pubgBatchService.batchGetAccountIds([pubgId]);
    const accountId = accountIdMap.get(pubgId);
    if (!accountId) throw new NotFoundException('未找到玩家');

    // 2. 获取赛季列表（缓存 24 小时，带自动重试）
    const cachedSeasons = await this.cacheService.get<{ id: string; isCurrent: boolean }[]>(
      CacheNamespace.SEASON_LIST,
    );
    let seasons: { id: string; isCurrent: boolean }[];
    if (cachedSeasons) {
      seasons = cachedSeasons;
    } else {
      const seasonsRes = await this.rateLimiter.executeWithRetry(
        () => axios.get(`${this.pubgBase}/seasons`, {
          headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/vnd.api+json' },
        }),
        'SeasonList',
      );
      seasons = (seasonsRes.data?.data || []).map((s: any) => ({
        id: s.id,
        isCurrent: s.attributes?.isCurrentSeason === true,
      }));
      await this.cacheService.set(CacheNamespace.SEASON_LIST, seasons, 86400);
    }

    const currentSeason = seasons.find((s) => s.isCurrent === true);
    const seasonId = currentSeason?.id || 'lifetime';

    // 3. 使用批量接口获取赛季统计（或从缓存读取）
    const batchResults = await this.pubgBatchService.batchFetchSeasonStats([accountId], seasonId, 'squad');
    const squadResult = batchResults.find((r) => r.accountId === accountId);
    const squadStats = squadResult?.stats || {
      roundsPlayed: 0, kills: 0, damageDealt: 0, wins: 0, headshotKills: 0,
      assists: 0, revives: 0, longestKill: 0, bestRank: 99, avgRank: 0, winPoints: 0,
    };

    // 4. 获取 squad-fpp 数据
    const fppResults = await this.pubgBatchService.batchFetchSeasonStats([accountId], seasonId, 'squad-fpp');
    const fppResult = fppResults.find((r) => r.accountId === accountId);
    const fppStats = fppResult?.stats || {
      roundsPlayed: 0, kills: 0, damageDealt: 0, wins: 0, headshotKills: 0,
      assists: 0, revives: 0, longestKill: 0, bestRank: 99, avgRank: 0, winPoints: 0,
    };

    const totalRounds = squadStats.roundsPlayed + fppStats.roundsPlayed;

    return {
      roundsPlayed: totalRounds,
      kills: squadStats.kills + fppStats.kills,
      damageDealt: Math.round((squadStats.damageDealt + fppStats.damageDealt) * 100) / 100,
      wins: squadStats.wins + fppStats.wins,
      headshotKills: squadStats.headshotKills + fppStats.headshotKills,
      assists: squadStats.assists + fppStats.assists,
      revives: squadStats.revives + fppStats.revives,
      longestKill: Math.max(squadStats.longestKill, fppStats.longestKill),
      bestRank: Math.min(squadStats.bestRank, fppStats.bestRank),
      avgKills: totalRounds > 0 ? Math.round(((squadStats.kills + fppStats.kills) / totalRounds) * 100) / 100 : 0,
      avgDamage: totalRounds > 0 ? Math.round(((squadStats.damageDealt + fppStats.damageDealt) / totalRounds) * 100) / 100 : 0,
      winRate: totalRounds > 0 ? Math.round(((squadStats.wins + fppStats.wins) / totalRounds) * 10000) / 10000 : 0,
      seasonId,
    };
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
    if (!pubgId) {
      const user = await this.prisma.user.findFirst({
        where: { OR: [{ id: userId }, { pubgId: userId }] },
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