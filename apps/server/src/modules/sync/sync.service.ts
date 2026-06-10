import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
import { PubgBatchService } from '../pubg/services/pubg-batch.service';
import { PubgRateLimiterService } from '../pubg/services/pubg-rate-limiter.service';
import { chunkArray } from '../../common/utils/chunk';
import axios from 'axios';

/** 获取 ISO 周标识，如 "2026-W24" */
function getWeekNumber(date: Date = new Date()): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly pubgBase =
    process.env.PUBG_API_BASE || 'https://api.pubg.com/shards/steam';
  private readonly apiKey = process.env.PUBG_API_KEY;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pubgBatchService: PubgBatchService,
    private readonly rateLimiter: PubgRateLimiterService,
  ) {}

  // ==================== 批量同步（改造核心） ====================

  /**
   * 批量同步所有用户
   * 改造目标：
   * 1. 每10人一组，使用 PUBG Batch Endpoint
   * 2. 优先使用 Redis 缓存
   * 3. 利用 account_id 避免不必要的 /players 请求
   * 4. 保持 ≤8 req/min 限流
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledSync() {
    this.logger.log('开始定时批量同步所有用户的战绩...');
    const users = await this.prisma.user.findMany();
    const pubgIds = users.map((u) => u.pubgId);

    if (pubgIds.length === 0) {
      this.logger.log('没有用户需要同步');
      return;
    }

    // 按每批10个玩家分组
    const batches = chunkArray(pubgIds, 10);
    this.logger.log(`共 ${pubgIds.length} 个用户，分为 ${batches.length} 批`);

    for (const batch of batches) {
      try {
        await this.syncPlayersBatch(batch);
        // 每批之间留出间隔，控制总体速率
        if (batches.length > 1) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      } catch (error: any) {
        this.logger.error(`批量同步失败 (${batch.join(',')}): ${error.message}`);
        // 批量失败时，逐个重试
        for (const pubgId of batch) {
          try {
            const user = users.find((u) => u.pubgId === pubgId);
            if (!user) continue;
            await this.syncSinglePlayerFallback(pubgId, user.id);
          } catch (innerErr: any) {
            const failedUser = users.find((u) => u.pubgId === pubgId);
            this.logger.error(`单点兜底同步 ${pubgId} 失败: ${innerErr.message}`);
            await this.prisma.syncLog.create({
              data: {
                userId: failedUser?.id || 'unknown',
                status: 'error',
                message: innerErr.message,
              },
            });
          }
        }
      }
    }

    // 同步完成后触发后续任务
    if (pubgIds.length > 0) {
      await this.triggerPostSyncTasks();
    }
    this.logger.log('定时批量同步完成');
  }

  /**
   * 批量同步一组玩家（最多10人）
   * 流程：
   * 1. 批量获取 accountId（优先 DB/Redis，再调 API）
   * 2. 批量获取玩家比赛列表
   * 3. 批量写库
   */
  private async syncPlayersBatch(pubgIds: string[]) {
    this.logger.log(`[BatchPlayer] 开始同步 ${pubgIds.length} 玩家: ${pubgIds.join(',')}`);

    // 1. 批量获取 accountId
    const accountIdMap = await this.pubgBatchService.batchGetAccountIds(pubgIds);

    // 2. 对每个玩家同步比赛数据（PUBG API 无批量比赛详情接口，优化为并行+缓存）
    const promises = pubgIds.map(async (pubgId) => {
      const accountId = accountIdMap.get(pubgId);
      if (!accountId) {
        this.logger.warn(`玩家 ${pubgId} 无 accountId，跳过`);
        return null;
      }

      const user = await this.prisma.user.findUnique({ where: { pubgId } });
      if (!user) return null;

      try {
        const result = await this.syncPlayerMatches(pubgId, accountId);
        await this.prisma.syncLog.create({
          data: {
            userId: user.id,
            status: 'success',
            message: `批量同步完成，新增 ${result.synced} 场比赛${result.cached ? '（使用缓存）' : ''}`,
          },
        });
        return result;
      } catch (error: any) {
        this.logger.error(`同步玩家 ${pubgId} 失败: ${error.message}`);
        await this.prisma.syncLog.create({
          data: {
            userId: user.id,
            status: 'error',
            message: error.message,
          },
        });
        return null;
      }
    });

    // 并行执行同一批玩家的比赛同步（不消耗额外 /players 请求，仅用 match 详情接口）
    const results = await Promise.all(promises);
    const totalSynced = results.reduce((sum, r) => sum + (r?.synced || 0), 0);
    this.logger.log(`[BatchPlayer] 批量同步完成，共新增 ${totalSynced} 场比赛`);
  }

  /** 单点兜底同步（当批量同步失败时使用） */
  private async syncSinglePlayerFallback(pubgId: string, userId: string) {
    this.logger.log(`[Fallback] 单点同步 ${pubgId}`);
    const result = await this.syncPlayerMatches(pubgId, null);
    await this.prisma.syncLog.create({
      data: {
        userId,
        status: result.synced > 0 ? 'success' : 'error',
        message: `兜底同步完成，新增 ${result.synced} 场比赛`,
      },
    });
  }

  // ==================== 单用户比赛同步（保持兼容） ====================

  async syncPlayerMatches(
    pubgId: string,
    accountId?: string | null,
  ): Promise<{ synced: number; cached: boolean }> {
    // 数据库缓存检查
    const lastMatch = await this.prisma.match.findFirst({
      where: { pubgId },
      orderBy: { fetchedAt: 'desc' },
    });

    if (lastMatch) {
      const elapsed = Date.now() - lastMatch.fetchedAt.getTime();
      const thirtyMin = 30 * 60 * 1000;
      if (elapsed < thirtyMin) {
        this.logger.log(
          `玩家 ${pubgId} 的战绩缓存仍有效（${Math.round(elapsed / 1000 / 60)} 分钟前获取）`,
        );
        return { synced: 0, cached: true };
      }
    }

    const { matches, resolvedAccountId } = await this.fetchFromPubgApi(pubgId, accountId);
    const synced = await this.storeMatches(pubgId, matches, resolvedAccountId);
    return { synced, cached: false };
  }

  async needsRefresh(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const lastMatch = await this.prisma.match.findFirst({
      where: { pubgId: user.pubgId },
      orderBy: { fetchedAt: 'desc' },
    });

    if (!lastMatch) return true;

    const elapsed = Date.now() - lastMatch.fetchedAt.getTime();
    return elapsed >= 30 * 60 * 1000;
  }

  /**
   * 从 PUBG API 获取比赛数据
   * 改造：如果已传入 accountId，跳过 /players 请求
   */
  async fetchFromPubgApi(
    pubgId: string,
    existingAccountId?: string | null,
  ): Promise<{ matches: any[]; resolvedAccountId: string }> {
    if (!this.apiKey) {
      throw new Error('PUBG_API_KEY 未配置');
    }

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/vnd.api+json',
    };

    let accountId = existingAccountId || null;

    // 如果未提供 accountId，尝试从数据库获取
    if (!accountId) {
      const user = await this.prisma.user.findUnique({ where: { pubgId }, select: { accountId: true } });
      accountId = user?.accountId || null;
    }

    // 仍然没有 accountId，需要请求 /players API
    if (!accountId) {
      this.logger.log(`玩家 ${pubgId} 无 accountId，需要请求 /players API`);
      const playerRes = await this.rateLimiter.executeWithRetry(
        () => axios.get(`${this.pubgBase}/players`, {
          headers,
          params: { 'filter[playerNames]': pubgId },
        }),
        `PlayerLookup(${pubgId})`,
      );

      const playerData = playerRes.data?.data?.[0];
      if (!playerData) {
        throw new Error(`未找到玩家 ${pubgId}`);
      }

      accountId = playerData.id;

      // 回写 accountId 到数据库
      await this.prisma.user.update({
        where: { pubgId },
        data: { accountId },
      });
      this.logger.log(`玩家 ${pubgId} accountId 已更新到数据库`);
    }

    // 从玩家信息的 relationships.matches 中获取比赛列表
    // 需要再请求一次 /players 获取 match list（PUBG API 限制）
    const playerRes = await this.rateLimiter.executeWithRetry(
      () => axios.get(`${this.pubgBase}/players`, {
        headers,
        params: { 'filter[playerNames]': pubgId },
      }),
      `PlayerMatches(${pubgId})`,
    );

    const playerData = playerRes.data?.data?.[0];
    if (!playerData) {
      throw new Error(`未找到玩家 ${pubgId}`);
    }

    const matchRefs: any[] = playerData.relationships?.matches?.data || [];
    const matchIds = matchRefs.map((m: any) => m.id);

    this.logger.log(
      `玩家 ${pubgId} 有 ${matchIds.length} 场比赛，开始获取详情...`,
    );

    // 跳过已缓存的比赛
    const existingMatchIds = new Set(
      (await this.prisma.match.findMany({
        where: { pubgId, matchId: { in: matchIds.slice(0, 50) } },
        select: { matchId: true },
      })).map((m) => m.matchId),
    );

    const batch = matchIds.slice(0, 50).filter((id) => !existingMatchIds.has(id));

    if (batch.length === 0) {
      this.logger.log(`玩家 ${pubgId} 的比赛已全部缓存，跳过 API 请求`);
      await this.prisma.match.updateMany({
        where: { pubgId },
        data: { fetchedAt: new Date() },
      });
      return { matches: [], resolvedAccountId: accountId };
    }

    this.logger.log(`玩家 ${pubgId} 需获取 ${batch.length} 场新比赛`);

    const matchDetails: any[] = [];
    const matchHeaders = {
      Accept: 'application/vnd.api+json',
    };

    for (const matchId of batch) {
      try {
        // /matches 端点不限流（PUBG 官方文档说明），直接请求
        const detailRes = await axios.get(
          `${this.pubgBase}/matches/${matchId}`,
          { headers: matchHeaders },
        );
        matchDetails.push(detailRes.data);
      } catch (err: any) {
        this.logger.warn(`获取比赛 ${matchId} 详情失败: ${err.message}`);
        // 网络错误时简单重试一次
        if (!err.response || err.response?.status >= 500) {
          try {
            await new Promise((r) => setTimeout(r, 2000));
            const retryRes = await axios.get(
              `${this.pubgBase}/matches/${matchId}`,
              { headers: matchHeaders },
            );
            matchDetails.push(retryRes.data);
            continue;
          } catch { /* 放弃 */ }
        }
      }
    }

    return { matches: matchDetails, resolvedAccountId: accountId };
  }

  async storeMatches(pubgId: string, matchDetails: any[], accountId: string): Promise<number> {
    let syncedCount = 0;

    for (const detail of matchDetails) {
      const matchId = detail.data?.id;
      if (!matchId) continue;

      const participants =
        detail.included?.filter(
          (item: any) => item.type === 'participant',
        ) || [];

      let participantStats = null;
      for (const p of participants) {
        const stats = p.attributes?.stats;
        if (stats?.name === pubgId || stats?.playerId === accountId) {
          participantStats = stats;
          break;
        }
      }

      if (!participantStats) continue;

      const matchAttrs = detail.data.attributes || {};
      const gameMode = matchAttrs.gameMode || 'unknown';

      if (gameMode !== 'squad' && gameMode !== 'squad-fpp') {
        continue;
      }

      // 提取本局所有参与者数据
      const rosters = detail.included?.filter(
        (item: any) => item.type === 'roster',
      ) || [];

      const participantRosterMap: Record<string, string> = {};
      for (const roster of rosters) {
        const rosterId = roster.id;
        const rosterParticipants = roster.relationships?.participants?.data || [];
        for (const rp of rosterParticipants) {
          if (rp.id) {
            participantRosterMap[rp.id] = rosterId;
          }
        }
      }

      const allParticipants = participants.map((p: any) => {
        const s = p.attributes?.stats || {};
        return {
          name: s.name || '未知',
          playerId: s.playerId || '',
          rosterId: participantRosterMap[p.id] || '',
          kills: s.kills || 0,
          damageDealt: s.damageDealt || 0,
          winPlace: s.winPlace || 99,
          timeSurvived: s.timeSurvived || 0,
          headshotKills: s.headshotKills || 0,
          assists: s.assists || 0,
          revives: s.revives || 0,
        };
      });

      await this.prisma.match.upsert({
        where: { matchId_pubgId: { matchId, pubgId } },
        update: {
          pubgId,
          kills: participantStats.kills || 0,
          damage: Math.round((participantStats.damageDealt || 0) * 100) / 100,
          rank: participantStats.winPlace || 99,
          survivalTime: Math.round(participantStats.timeSurvived || 0),
          headshots: participantStats.headshotKills || 0,
          assists: participantStats.assists || 0,
          revives: participantStats.revives || 0,
          teamKills: participantStats.teamKills || 0,
          won: participantStats.winPlace === 1,
          mapName: matchAttrs.mapName || 'unknown',
          mode: matchAttrs.gameMode || 'unknown',
          playedAt: new Date(matchAttrs.createdAt || Date.now()),
          fetchedAt: new Date(),
          participants: JSON.stringify(allParticipants),
        },
        create: {
          matchId,
          pubgId,
          kills: participantStats.kills || 0,
          damage: Math.round((participantStats.damageDealt || 0) * 100) / 100,
          rank: participantStats.winPlace || 99,
          survivalTime: Math.round(participantStats.timeSurvived || 0),
          headshots: participantStats.headshotKills || 0,
          assists: participantStats.assists || 0,
          revives: participantStats.revives || 0,
          teamKills: participantStats.teamKills || 0,
          won: participantStats.winPlace === 1,
          mapName: matchAttrs.mapName || 'unknown',
          mode: matchAttrs.gameMode || 'unknown',
          playedAt: new Date(matchAttrs.createdAt || Date.now()),
          fetchedAt: new Date(),
          participants: JSON.stringify(allParticipants),
        },
      });

      syncedCount++;
    }

    this.logger.log(`已存储 ${syncedCount} 场比赛记录（玩家 ${pubgId}）`);
    return syncedCount;
  }

  // ==================== 后续任务（保持兼容） ====================

  private async triggerPostSyncTasks() {
    try {
      const users = await this.prisma.user.findMany();
      for (const user of users) {
        await this.recalcPlayerStats(user.pubgId);
      }
      await this.recalcLeaderboard();
      await this.detectTeamsFromMatches();
      this.logger.log('同步后任务完成（统计重算 + 排行榜 + 车队检测）');
    } catch (error: any) {
      this.logger.error(`同步后任务失败: ${error.message}`);
    }
  }

  private async recalcLeaderboard() {
    try {
      const targetWeek = getWeekNumber();
      const year = parseInt(targetWeek.substring(0, 4), 10);
      const weekNum = parseInt(targetWeek.substring(6), 10);
      const janFirst = new Date(year, 0, 1);
      const daysOffset = (weekNum - 1) * 7 - ((janFirst.getDay() + 6) % 7);
      const startOfWeek = new Date(year, 0, 1 + daysOffset);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 7);

      const users = await this.prisma.user.findMany({
        include: { matches: { where: { playedAt: { gte: startOfWeek, lte: endOfWeek } } } },
      });

      await this.prisma.leaderboard.deleteMany({ where: { week: targetWeek } });

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
        const mvpScore = totalKills * 3 + totalDamage * 0.02 + avgSurvival * 0.01 + totalWins * 100 + totalHeadshots * 2;

        entries.push(
          { type: 'RED', category: '击杀王', userId: user.id, teamId: null, score: totalKills, week: targetWeek },
          { type: 'RED', category: '伤害王', userId: user.id, teamId: null, score: totalDamage, week: targetWeek },
          { type: 'RED', category: '吃鸡王', userId: user.id, teamId: null, score: totalWins, week: targetWeek },
          { type: 'RED', category: '爆头王', userId: user.id, teamId: null, score: totalHeadshots, week: targetWeek },
          { type: 'BLACK', category: '落地成盒王', userId: user.id, teamId: null, score: earlyDeaths, week: targetWeek },
          { type: 'BLACK', category: '队友克星', userId: user.id, teamId: null, score: totalTeamKills, week: targetWeek },
          { type: 'BLACK', category: '快递员', userId: user.id, teamId: null, score: matches.length - totalKills, week: targetWeek },
          { type: 'BLACK', category: '人机杀手', userId: user.id, teamId: null, score: totalKills - totalHeadshots, week: targetWeek },
          { type: 'MVP', category: 'MVP', userId: user.id, teamId: null, score: mvpScore, week: targetWeek },
        );
      }

      if (entries.length > 0) {
        await this.prisma.leaderboard.createMany({ data: entries });
      }

      this.logger.log(`排行榜重算完成：${entries.length} 条记录`);
    } catch (error: any) {
      this.logger.error(`排行榜重算失败: ${error.message}`);
    }
  }

  /**
   * 车队检测：按比赛实际分组创建车队
   *
   * 规则：
   * 1. 同一场比赛中的全部已注册玩家构成一个车队
   * 2. 允许一个车队是另一个车队的子集
   *    （例如 {A,B,C,D} 一起打过一场、{A,B,C} 一起打过另一场，则两个都是独立车队）
   *
   * 算法：遍历每场比赛 → 提取已注册玩家集合 → 去重 → 创建车队
   */
  async detectTeamsFromMatches() {
    // 1. 找出有 2+ 已注册用户共同参与的比赛
    const matchGroups: Array<{ match_id: string }> = await this.prisma.$queryRaw`
      SELECT match_id
      FROM matches
      GROUP BY match_id
      HAVING COUNT(DISTINCT pubg_id) >= 2
    `;

    if (matchGroups.length === 0) {
      this.logger.log('车队检测: 没有含多名玩家的比赛');
      return;
    }

    // 2. 获取所有已注册用户
    const allUsers = await this.prisma.user.findMany({
      select: { id: true, pubgId: true, nickname: true },
    });
    if (allUsers.length < 2) return;

    const userIdByPubgId = new Map(allUsers.map((u) => [u.pubgId, u.id]));
    const userNicknameById = new Map(allUsers.map((u) => [u.id, u.nickname]));

    // 3. 遍历每场比赛，提取实际玩家分组（去重）
    const teamSets = new Set<string>();

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

      // 同一场比赛中的全部已注册玩家构成一个车队候选
      teamSets.add([...matchedIds].sort().join(','));
    }

    this.logger.log(`车队检测: 共发现 ${teamSets.size} 个不同的玩家分组`);

    if (teamSets.size === 0) {
      this.logger.log('车队检测: 没有形成任何有效车队');
      return;
    }

    // 4. 收集已有的车队信息（用于名称复用）
    const existingTeams = await this.prisma.team.findMany({
      include: { members: { select: { userId: true } } },
    });

    // 按成员 ID 排序后的字符串索引已有车队
    const teamByMemberKey = new Map<string, typeof existingTeams[0]>();
    for (const team of existingTeams) {
      const key = team.members.map((m) => m.userId).sort().join(',');
      teamByMemberKey.set(key, team);
    }

    // 5. 清空所有车队成员关系（准备重建）
    const deleteResult = await this.prisma.teamMember.deleteMany();
    this.logger.log(`车队检测: 清除了 ${deleteResult.count} 条旧的成员关系`);

    // 6. 为每个玩家分组创建/更新车队
    const activeTeamIds = new Set<string>();
    const teamList = [...teamSets].map((key) => key.split(','));

    // 记录成员组合 → 车队 ID 的映射（后续撞车分析用）
    const teamIdByKey = new Map<string, string>();

    for (const memberIds of teamList) {
      const memberKey = [...memberIds].sort().join(',');
      const existing = teamByMemberKey.get(memberKey);

      let teamId: string;
      if (existing) {
        teamId = existing.id;
        activeTeamIds.add(teamId);
        teamIdByKey.set(memberKey, teamId);
      } else {
        const nicknames = memberIds
          .map((id) => userNicknameById.get(id) || '未知')
          .join('、');
        const team = await this.prisma.team.create({
          data: { name: `${nicknames}的车队` },
        });
        teamId = team.id;
        activeTeamIds.add(teamId);
        teamIdByKey.set(memberKey, teamId);
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

    // 7. 清理不再匹配任何分组的旧车队
    for (const team of existingTeams) {
      if (!activeTeamIds.has(team.id)) {
        await this.prisma.team
          .delete({ where: { id: team.id } })
          .catch(() => {});
        this.logger.log(`车队检测: 清理了过期车队 ${team.name}`);
      }
    }

    this.logger.log(
      `车队检测完成: 共 ${teamList.length} 个车队，${teamList.reduce((s, c) => s + c.length, 0)} 名成员`,
    );

    // ========== 8. 记录撞车数据 ==========
    await this.recordTeamMatchups(matchGroups, allUsers, userIdByPubgId);
  }

  /**
   * 记录撞车数据：同一场比赛中不同 roster 的车队互相撞车
   */
  private async recordTeamMatchups(
    matchGroups: Array<{ match_id: string }>,
    allUsers: Array<{ id: string; pubgId: string; nickname: string }>,
    userIdByPubgId: Map<string, string>,
  ) {
    // 获取所有车队及其成员的 pubgId
    const allTeams = await this.prisma.team.findMany({
      include: {
        members: {
          include: { user: { select: { pubgId: true } } },
        },
      },
    });

    if (allTeams.length < 2) {
      this.logger.log('撞车记录: 车队不足 2 个，跳过');
      return;
    }

    // 构建 pubgId → 车队 ID 映射（一个玩家可能属于多个车队，取最长的那个）
    // 实际上一个玩家可以属于多个车队（子集关系），但对于撞车分析，我们用玩家所属的所有车队
    const pubgIdToTeamIds = new Map<string, Set<string>>();
    for (const team of allTeams) {
      for (const member of team.members) {
        const pubgId = member.user.pubgId;
        if (!pubgIdToTeamIds.has(pubgId)) {
          pubgIdToTeamIds.set(pubgId, new Set());
        }
        pubgIdToTeamIds.get(pubgId)!.add(team.id);
      }
    }

    let matchupCount = 0;

    for (const row of matchGroups) {
      const matchId = row.match_id;

      // 获取该场比赛任意一条记录的 participants 字段
      const sampleMatch = await this.prisma.match.findFirst({
        where: { matchId, participants: { not: null } },
        select: { participants: true, playedAt: true },
        orderBy: { fetchedAt: 'desc' },
      });

      if (!sampleMatch?.participants) continue;

      let participants: Array<{ name: string; rosterId: string }> = [];
      try {
        participants = JSON.parse(sampleMatch.participants as string);
      } catch {
        continue;
      }

      // 按 rosterId 分组
      const rosterMap = new Map<string, Set<string>>(); // rosterId -> Set<pubgId>
      for (const p of participants) {
        if (!p.name || !p.rosterId) continue;
        if (!rosterMap.has(p.rosterId)) {
          rosterMap.set(p.rosterId, new Set());
        }
        rosterMap.get(p.rosterId)!.add(p.name);
      }

      // 每个 roster 中找到已注册车队
      const rosterTeams: string[] = []; // teamIds found in this match
      const seenRosterTeams = new Set<string>();

      for (const [, playerNames] of rosterMap) {
        // 该 roster 中已注册玩家的车队
        const teamIdsInRoster = new Set<string>();
        for (const name of playerNames) {
          const teamIds = pubgIdToTeamIds.get(name);
          if (teamIds) {
            for (const tid of teamIds) {
              teamIdsInRoster.add(tid);
            }
          }
        }

        // 一个 roster 中可能有多人属于同一个车队，取一个即可
        for (const tid of teamIdsInRoster) {
          if (!seenRosterTeams.has(tid)) {
            seenRosterTeams.add(tid);
            rosterTeams.push(tid);
          }
        }
      }

      // 记录撞车：同一场比赛中不同 roster 的车队配对
      if (rosterTeams.length >= 2) {
        for (let i = 0; i < rosterTeams.length; i++) {
          for (let j = i + 1; j < rosterTeams.length; j++) {
            const teamA = rosterTeams[i];
            const teamB = rosterTeams[j];

            // 确保 teamA < teamB 以保证唯一性
            const [tidA, tidB] = teamA < teamB ? [teamA, teamB] : [teamB, teamA];

            try {
              await this.prisma.teamMatchup.upsert({
                where: {
                  matchId_teamAId_teamBId: {
                    matchId,
                    teamAId: tidA,
                    teamBId: tidB,
                  },
                },
                update: {}, // 已存在则跳过
                create: {
                  matchId,
                  teamAId: tidA,
                  teamBId: tidB,
                  playedAt: sampleMatch.playedAt,
                },
              });
              matchupCount++;
            } catch (err: any) {
              this.logger.warn(
                `撞车记录失败 (${matchId}): ${err.message}`,
              );
            }
          }
        }
      }
    }

    if (matchupCount > 0) {
      this.logger.log(`撞车记录完成: 新增 ${matchupCount} 条撞车数据`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyCleanupDanmaku() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await this.prisma.danmaku.deleteMany({
      where: { createdAt: { lt: yesterday } },
    });
    this.logger.log(`每日弹幕清理：删除了 ${result.count} 条过期弹幕`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyRecalc() {
    this.logger.log('开始每日统计重算...');
    const users = await this.prisma.user.findMany();
    for (const user of users) {
      await this.recalcPlayerStats(user.pubgId);
    }
    await this.recalcLeaderboard();
    await this.detectTeamsFromMatches();
    this.logger.log('每日统计重算完成（统计 + 排行榜 + 车队检测）');
  }

  async recalcPlayerStats(pubgId: string) {
    const matches = await this.prisma.match.findMany({ where: { pubgId } });
    if (!matches.length) return;

    const totalMatches = matches.length;
    const totalWins = matches.filter((m) => m.won).length;
    const totalKills = matches.reduce((s, m) => s + m.kills, 0);
    const totalDamage = matches.reduce((s, m) => s + m.damage, 0);
    const totalHeadshots = matches.reduce((s, m) => s + m.headshots, 0);
    const avgKills = totalKills / totalMatches;
    const avgDamage = totalDamage / totalMatches;
    const avgSurvivalTime = Math.round(
      matches.reduce((s, m) => s + m.survivalTime, 0) / totalMatches,
    );
    const bestRank = Math.min(...matches.map((m) => m.rank));

    const user = await this.prisma.user.findUnique({ where: { pubgId } });
    if (!user) return;

    await this.prisma.playerStats.upsert({
      where: { playerId: user.id },
      update: {
        totalMatches,
        totalWins,
        totalKills,
        totalDamage: Math.round(totalDamage * 100) / 100,
        totalHeadshots,
        avgKills: Math.round(avgKills * 100) / 100,
        avgDamage: Math.round(avgDamage * 100) / 100,
        avgSurvivalTime,
        bestRank,
        kda: Math.round(avgKills * 100) / 100,
        winRate: Math.round((totalWins / totalMatches) * 100) / 100,
      },
      create: {
        playerId: user.id,
        totalMatches,
        totalWins,
        totalKills,
        totalDamage: Math.round(totalDamage * 100) / 100,
        totalHeadshots,
        avgKills: Math.round(avgKills * 100) / 100,
        avgDamage: Math.round(avgDamage * 100) / 100,
        avgSurvivalTime,
        bestRank,
        kda: Math.round(avgKills * 100) / 100,
        winRate: Math.round((totalWins / totalMatches) * 100) / 100,
      },
    });
  }
}