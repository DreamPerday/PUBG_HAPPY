import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma.service';
import { PubgCacheService, CacheNamespace } from './pubg-cache.service';
import { PubgRateLimiterService } from './pubg-rate-limiter.service';
import { chunkArray } from '../../../common/utils/chunk';
import axios from 'axios';

interface BatchPlayerResult {
  pubgId: string;
  accountId: string;
  nickname: string;
}

interface SeasonStatsResult {
  accountId: string;
  stats: any;
}

@Injectable()
export class PubgBatchService {
  private readonly logger = new Logger(PubgBatchService.name);
  private readonly pubgBase: string;
  private readonly apiKey: string;

  /** 内存缓存：赛季列表（Redis 不可用时降级使用） */
  private static seasonListCache: { seasons: { id: string; isCurrent: boolean }[]; fetchedAt: number } | null = null;
  private static readonly SEASON_LIST_TTL = 3600_000; // 1 小时

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cacheService: PubgCacheService,
    private readonly rateLimiter: PubgRateLimiterService,
  ) {
    this.pubgBase = this.configService.get<string>('pubg.baseUrl') || 'https://api.pubg.com/shards/steam';
    this.apiKey = this.configService.get<string>('pubg.apiKey') || '';
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/vnd.api+json',
    };
  }

  // ==================== Player Batch API ====================

  /**
   * 批量查询玩家信息
   * 通过 PUBG Batch Endpoint: GET /players?filter[playerNames]=name1,name2,...,nameN
   * 最多 10 人一批
   */
  async batchFetchPlayers(pubgIds: string[]): Promise<BatchPlayerResult[]> {
    const results: BatchPlayerResult[] = [];

    if (!this.apiKey) {
      throw new Error('PUBG_API_KEY 未配置');
    }

    const chunks = chunkArray(pubgIds, 10);
    this.logger.log(`[BatchPlayer] 开始批量同步 ${pubgIds.length} 玩家，分 ${chunks.length} 组`);

    for (const chunk of chunks) {
      this.logger.log(`[BatchPlayer] 同步 ${chunk.length} 玩家: ${chunk.join(', ')}`);

      // 1. 先查 Redis 缓存
      const cachedResults: BatchPlayerResult[] = [];
      const uncachedIds: string[] = [];

      for (const pubgId of chunk) {
        const cached = await this.cacheService.get<BatchPlayerResult>(
          CacheNamespace.PLAYER,
          pubgId,
        );
        if (cached && cached.accountId) {
          cachedResults.push(cached);
        } else {
          uncachedIds.push(pubgId);
        }
      }

      // 2. 如果全部缓存命中，直接合并结果
      if (uncachedIds.length === 0) {
        results.push(...cachedResults);
        continue;
      }

      // 3. 未命中缓存的需要请求 API
      const namesParam = uncachedIds.join(',');
      this.logger.log(`[BatchPlayer] 请求 API 获取 ${uncachedIds.length} 玩家`);

      try {
        const res = await this.rateLimiter.executeWithRetry(
          () => axios.get(`${this.pubgBase}/players`, {
            headers: this.getHeaders(),
            params: { 'filter[playerNames]': namesParam },
          }),
          `BatchPlayer(${namesParam})`,
        );

        const playerList = res.data?.data || [];
        for (const player of playerList) {
          const pubgId = player.attributes?.name || '';
          const accountId = player.id || '';
          const nickname = player.attributes?.name || '';

          if (pubgId && accountId) {
            const result: BatchPlayerResult = { pubgId, accountId, nickname };
            results.push(result);
            // 写 Redis 缓存
            await this.cacheService.set(CacheNamespace.PLAYER, result, undefined, pubgId);
          }
        }
      } catch (err: any) {
        this.logger.error(`[BatchPlayer] API 请求失败: ${err.message}`);
        // 对于失败的批次，将未缓存的玩家标记为需要单独处理
        for (const id of uncachedIds) {
          // 尝试从数据库获取已存储的 accountId
          const user = await this.prisma.user.findUnique({ where: { pubgId: id } });
          if (user?.accountId) {
            results.push({ pubgId: id, accountId: user.accountId, nickname: user.nickname });
          }
        }
      }
    }

    this.logger.log(`[BatchPlayer] 批量同步完成，获取到 ${results.length} 个玩家信息`);
    return results;
  }

  /**
   * 批量获取玩家 accountId
   * 优先使用数据库存储的 accountId，再查缓存，最后请求 API
   */
  async batchGetAccountIds(pubgIds: string[]): Promise<Map<string, string>> {
    const accountIdMap = new Map<string, string>();
    
    // 1. 从数据库获取已存储的 accountId
    const users = await this.prisma.user.findMany({
      where: { pubgId: { in: pubgIds } },
      select: { pubgId: true, accountId: true },
    });

    const dbFound = new Set<string>();
    for (const user of users) {
      if (user.accountId) {
        accountIdMap.set(user.pubgId, user.accountId);
        dbFound.add(user.pubgId);
      }
    }

    // 2. 找出需要从 API 获取的玩家
    const needFetch = pubgIds.filter((id) => !dbFound.has(id));
    if (needFetch.length === 0) {
      return accountIdMap;
    }

    // 3. 批量请求 API 获取 accountId
    const batchResults = await this.batchFetchPlayers(needFetch);
    for (const r of batchResults) {
      accountIdMap.set(r.pubgId, r.accountId);
      // 回写数据库
      await this.prisma.user.update({
        where: { pubgId: r.pubgId },
        data: { accountId: r.accountId },
      });
    }

    this.logger.log(`[AccountId] 共获取 ${accountIdMap.size} 个 accountId（DB: ${dbFound.size}, API: ${batchResults.length}）`);
    return accountIdMap;
  }

  // ==================== Season Stats Batch API ====================

  /**
   * 批量获取玩家赛季数据
   * 使用 PUBG Batch Endpoint: /seasons/{seasonId}/gameMode/{gameMode}/players
   */
  async batchFetchSeasonStats(
    accountIds: string[],
    seasonId: string,
    gameMode: string = 'squad',
  ): Promise<SeasonStatsResult[]> {
    const results: SeasonStatsResult[] = [];

    if (!this.apiKey) {
      throw new Error('PUBG_API_KEY 未配置');
    }

    const chunks = chunkArray(accountIds, 10);
    this.logger.log(`[SeasonBatch] 开始批量获取 ${accountIds.length} 玩家的赛季数据，分 ${chunks.length} 组`);

    for (const chunk of chunks) {
      this.logger.log(`[SeasonBatch] 同步 ${chunk.length} 玩家赛季数据`);

      // 1. 先查 Redis 缓存
      const cachedResults: SeasonStatsResult[] = [];
      const uncachedIds: string[] = [];

      for (const accountId of chunk) {
        const cached = await this.cacheService.get<any>(
          CacheNamespace.SEASON_STATS,
          seasonId,
          accountId,
        );
        if (cached) {
          cachedResults.push({ accountId, stats: cached });
        } else {
          uncachedIds.push(accountId);
        }
      }

      if (uncachedIds.length === 0) {
        results.push(...cachedResults);
        continue;
      }

      // 2. 请求 Batch API（带自动重试）
      const filterParam = uncachedIds.join(',');

      try {
        const res = await this.rateLimiter.executeWithRetry(
          () => axios.get(
            `${this.pubgBase}/seasons/${seasonId}/gameMode/${gameMode}/players`,
            { headers: this.getHeaders(), params: { 'filter[playerIds]': filterParam } },
          ),
          `SeasonBatch(${gameMode},${uncachedIds.length}人)`,
        );

        const statsList = res.data?.data || [];
        const processedInBatch = new Set<string>();

        for (let i = 0; i < statsList.length; i++) {
          const entry = statsList[i];
          // 批量端点返回的 entry.id 可能为 undefined（部分账号格式），降级按数组索引匹配
          const accountId = entry.id || (i < uncachedIds.length ? uncachedIds[i] : '');
          if (!accountId) continue;

          const attributes = entry.attributes || {};
          const gameModeStats = attributes.gameModeStats?.[gameMode] || {};

          const stats = {
            roundsPlayed: gameModeStats.roundsPlayed || 0,
            kills: gameModeStats.kills || 0,
            damageDealt: gameModeStats.damageDealt || 0,
            wins: gameModeStats.wins || 0,
            headshotKills: gameModeStats.headshotKills || 0,
            assists: gameModeStats.assists || 0,
            revives: gameModeStats.revives || 0,
            longestKill: gameModeStats.longestKill || 0,
            bestRank: gameModeStats.bestRank || 99,
            avgRank: gameModeStats.avgRank || 0,
            winPoints: gameModeStats.winPoints || 0,
          };

          processedInBatch.add(accountId);
          const result: SeasonStatsResult = { accountId, stats };
          results.push(result);
          // 写 Redis 缓存
          await this.cacheService.set(
            CacheNamespace.SEASON_STATS,
            stats,
            undefined,
            seasonId,
            accountId,
          );
        }

        // 批量 API 未覆盖的账号走单点兜底
        const missingIds = uncachedIds.filter((id) => !processedInBatch.has(id));
        if (missingIds.length > 0) {
          this.logger.warn(`[SeasonBatch] 批量 API 未覆盖 ${missingIds.length} 个账号，启动单点兜底`);
          for (const id of missingIds) {
            const retryResult = await this.fetchSingleSeasonStats(id, seasonId, gameMode);
            if (retryResult) {
              results.push(retryResult);
            }
          }
        }
      } catch (err: any) {
        this.logger.error(`[SeasonBatch] 批量 API 请求失败: ${err.message}`);
        // 对于失败的玩家，尝试单点兜底（带重试）
        for (const id of uncachedIds) {
          const retryResult = await this.fetchSingleSeasonStats(id, seasonId, gameMode);
          if (retryResult) {
            results.push(retryResult);
          }
        }
      }
    }

    this.logger.log(`[SeasonBatch] 批量获取赛季数据完成，共获取 ${results.length} 条`);
    return results;
  }

  /** 兜底：单个玩家赛季数据（用于批处理失败时的降级，带自动重试确保障终能获取） */
  async fetchSingleSeasonStats(
    accountId: string,
    seasonId: string,
    gameMode: string,
  ): Promise<SeasonStatsResult | null> {
    try {
      const res = await this.rateLimiter.executeWithRetry(
        () => axios.get(
          `${this.pubgBase}/players/${accountId}/seasons/${seasonId}`,
          { headers: this.getHeaders() },
        ),
        `SingleSeason(${accountId.slice(0, 8)}...,${gameMode})`,
      );
      const attributes = res.data?.data?.attributes || {};
      const modeStats = attributes.gameModeStats?.[gameMode] || {};

      const stats = {
        roundsPlayed: modeStats.roundsPlayed || 0,
        kills: modeStats.kills || 0,
        damageDealt: modeStats.damageDealt || 0,
        wins: modeStats.wins || 0,
        headshotKills: modeStats.headshotKills || 0,
        assists: modeStats.assists || 0,
        revives: modeStats.revives || 0,
        longestKill: modeStats.longestKill || 0,
        bestRank: modeStats.bestRank || 99,
        avgRank: modeStats.avgRank || 0,
        winPoints: modeStats.winPoints || 0,
      };

      const result: SeasonStatsResult = { accountId, stats };
      await this.cacheService.set(CacheNamespace.SEASON_STATS, stats, undefined, seasonId, accountId);
      return result;
    } catch (err: any) {
      this.logger.warn(`[SeasonBatch] 单点兜底获取 ${accountId} 赛季数据失败: ${err.message}`);
      return null;
    }
  }

  /**
   * 获取当前赛季 ID
   * 缓存优先级：内存（1小时） > Redis（24小时） > PUBG API
   * Redis 不可用时也不会重复调 API
   */
  private async getCurrentSeasonId(): Promise<string> {
    // 1. 内存缓存
    const now = Date.now();
    if (PubgBatchService.seasonListCache && (now - PubgBatchService.seasonListCache.fetchedAt) < PubgBatchService.SEASON_LIST_TTL) {
      const current = PubgBatchService.seasonListCache.seasons.find((s) => s.isCurrent);
      return current?.id || 'lifetime';
    }

    // 2. Redis 缓存
    const cachedSeasons = await this.cacheService.get<{ id: string; isCurrent: boolean }[]>(
      CacheNamespace.SEASON_LIST,
    );
    if (cachedSeasons) {
      PubgBatchService.seasonListCache = { seasons: cachedSeasons, fetchedAt: now };
      const current = cachedSeasons.find((s) => s.isCurrent);
      return current?.id || 'lifetime';
    }

    // 3. 调 API
    const res = await this.rateLimiter.executeWithRetry(
      () => axios.get(`${this.pubgBase}/seasons`, { headers: this.getHeaders() }),
      'SeasonList',
    );
    const seasons = (res.data?.data || []).map((s: any) => ({
      id: s.id,
      isCurrent: s.attributes?.isCurrentSeason === true,
    }));
    const current = seasons.find((s) => s.isCurrent);
    const seasonId = current?.id || 'lifetime';

    // 写入两级缓存
    PubgBatchService.seasonListCache = { seasons, fetchedAt: now };
    await this.cacheService.set(CacheNamespace.SEASON_LIST, seasons, 86400);

    return seasonId;
  }

  /**
   * 获取并缓存指定玩家的完整赛季数据（squad + squad-fpp）
   * 自动获取当前赛季 ID（优先使用缓存），结果写入 Redis 缓存
   * 注册/绑定时调用，减少后续 API 请求次数
   */
  async fetchAndCacheSeasonData(accountId: string, pubgId: string): Promise<void> {
    try {
      // 1. 获取当前赛季 ID（内存 → Redis → API，不会重复调用）
      const seasonId = await this.getCurrentSeasonId();

      // 2. 获取 squad 模式赛季数据（自动走缓存，若已有则跳过 API 调用）
      const squadResult = await this.fetchSingleSeasonStats(accountId, seasonId, 'squad');
      if (squadResult) {
        this.logger.log(`[SeasonData] ${pubgId} squad 赛季数据已缓存`);
      }

      // 3. 获取 squad-fpp 模式赛季数据
      const fppResult = await this.fetchSingleSeasonStats(accountId, seasonId, 'squad-fpp');
      if (fppResult) {
        this.logger.log(`[SeasonData] ${pubgId} squad-fpp 赛季数据已缓存`);
      }
    } catch (err: any) {
      this.logger.warn(`[SeasonData] 获取 ${pubgId} 赛季数据失败: ${err.message}`);
    }
  }

  /**
   * 批量写入赛季数据到数据库 PlayerStats
   */
  async batchUpdateSeasonStats(
    accountIdMap: Map<string, string>,
    seasonStats: SeasonStatsResult[],
  ): Promise<number> {
    let updated = 0;

    // 构建 accountId -> pubgId 的逆向映射
    const reverseMap = new Map<string, string>();
    for (const [pubgId, accountId] of accountIdMap) {
      reverseMap.set(accountId, pubgId);
    }

    for (const result of seasonStats) {
      const pubgId = reverseMap.get(result.accountId);
      if (!pubgId) continue;

      const user = await this.prisma.user.findUnique({ where: { pubgId } });
      if (!user) continue;

      const s = result.stats;
      await this.prisma.playerStats.upsert({
        where: { playerId: user.id },
        update: {
          totalMatches: s.roundsPlayed,
          totalKills: s.kills,
          totalDamage: Math.round(s.damageDealt * 100) / 100,
          totalWins: s.wins,
          totalHeadshots: s.headshotKills,
          avgKills: s.roundsPlayed > 0 ? Math.round((s.kills / s.roundsPlayed) * 100) / 100 : 0,
          avgDamage: s.roundsPlayed > 0 ? Math.round((s.damageDealt / s.roundsPlayed) * 100) / 100 : 0,
          kda: s.roundsPlayed > 0 ? Math.round((s.kills / s.roundsPlayed) * 100) / 100 : 0,
          winRate: s.roundsPlayed > 0 ? Math.round((s.wins / s.roundsPlayed) * 10000) / 10000 : 0,
          bestRank: s.bestRank || 99,
        },
        create: {
          playerId: user.id,
          totalMatches: s.roundsPlayed,
          totalKills: s.kills,
          totalDamage: Math.round(s.damageDealt * 100) / 100,
          totalWins: s.wins,
          totalHeadshots: s.headshotKills,
          avgKills: s.roundsPlayed > 0 ? Math.round((s.kills / s.roundsPlayed) * 100) / 100 : 0,
          avgDamage: s.roundsPlayed > 0 ? Math.round((s.damageDealt / s.roundsPlayed) * 100) / 100 : 0,
          kda: s.roundsPlayed > 0 ? Math.round((s.kills / s.roundsPlayed) * 100) / 100 : 0,
          winRate: s.roundsPlayed > 0 ? Math.round((s.wins / s.roundsPlayed) * 10000) / 10000 : 0,
          bestRank: s.bestRank || 99,
        },
      });
      updated++;
    }

    this.logger.log(`[SeasonBatch] 批量更新数据库完成，共更新 ${updated} 条`);
    return updated;
  }
}