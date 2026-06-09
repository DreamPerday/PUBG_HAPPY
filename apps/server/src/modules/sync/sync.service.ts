import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma.service';
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

/** PUBG API 限流器：最多 8 次/分钟，避免被官方限流 */
class PubgApiLimiter {
  private timestamps: number[] = [];
  private readonly maxPerMinute = 8;
  private readonly windowMs = 60_000;

  async wait() {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxPerMinute) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 1000;
      console.warn(`[PUBG API 限流] 等待 ${Math.round(waitMs / 1000)} 秒`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
    this.timestamps.push(Date.now());
  }
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly pubgBase =
    process.env.PUBG_API_BASE || 'https://api.pubg.com/shards/steam';
  private readonly apiKey = process.env.PUBG_API_KEY;
  private readonly limiter = new PubgApiLimiter();

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduledSync() {
    this.logger.log('开始定时同步所有用户的战绩...');
    const users = await this.prisma.user.findMany();
    for (const user of users) {
      try {
        const result = await this.syncPlayerMatches(user.pubgId);
        await this.prisma.syncLog.create({
          data: {
            userId: user.id,
            status: 'success',
            message: `同步完成，新增 ${result.synced} 场比赛${result.cached ? '（使用缓存）' : ''}`,
          },
        });
      } catch (error: any) {
        this.logger.error(
          `同步用户 ${user.nickname}(${user.pubgId}) 失败: ${error.message}`,
        );
        await this.prisma.syncLog.create({
          data: {
            userId: user.id,
            status: 'error',
            message: error.message,
          },
        });
      }
      // 不同用户之间间隔至少 8 秒
      await new Promise((r) => setTimeout(r, 8000));
    }
    // 同步完成后触发排行榜重算和车队检测
    if (users.length > 0) {
      await this.triggerPostSyncTasks();
    }
    this.logger.log('定时同步完成');
  }

  async syncPlayerMatches(
    pubgId: string,
  ): Promise<{ synced: number; cached: boolean }> {
    // 数据库优先：检查缓存是否存在且未过期
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

    // 缓存过期或不存在，从 PUBG API 拉取
    const { matches, accountId } = await this.fetchFromPubgApi(pubgId);
    const synced = await this.storeMatches(pubgId, matches, accountId);
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

  async fetchFromPubgApi(pubgId: string): Promise<{ matches: any[]; accountId: string }> {
    if (!this.apiKey) {
      throw new Error('PUBG_API_KEY 未配置');
    }

    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/vnd.api+json',
    };

    // Step 1: 查玩家信息
    await this.limiter.wait();
    const playerRes = await axios.get(`${this.pubgBase}/players`, {
      headers,
      params: { 'filter[playerNames]': pubgId },
    });

    const playerData = playerRes.data?.data?.[0];
    if (!playerData) {
      throw new Error(`未找到玩家 ${pubgId}`);
    }

    const accountId = playerData.id;

    // 从玩家信息的 relationships.matches 中获取比赛列表
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
      // 更新 fetchedAt 时间戳
      await this.prisma.match.updateMany({
        where: { pubgId },
        data: { fetchedAt: new Date() },
      });
      return { matches: [], accountId };
    }

    this.logger.log(`玩家 ${pubgId} 需获取 ${batch.length} 场新比赛`);

    const matchDetails: any[] = [];
    const matchHeaders = {
      Accept: 'application/vnd.api+json',
    };

    for (const matchId of batch) {
      try {
        await this.limiter.wait();
        const detailRes = await axios.get(
          `${this.pubgBase}/matches/${matchId}`,
          { headers: matchHeaders },
        );
        matchDetails.push(detailRes.data);
      } catch (err: any) {
        this.logger.warn(`获取比赛 ${matchId} 详情失败: ${err.message}`);
        if (err.response?.status === 429) {
          this.logger.warn('触发官方限流，等待后重试...');
          await new Promise((r) => setTimeout(r, 10000));
          try {
            const retryRes = await axios.get(
              `${this.pubgBase}/matches/${matchId}`,
              { headers: matchHeaders },
            );
            matchDetails.push(retryRes.data);
          } catch { /* 放弃 */ }
        }
      }
    }

    return { matches: matchDetails, accountId };
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

  private async triggerPostSyncTasks() {
    try {
      // 重算玩家统计
      const users = await this.prisma.user.findMany();
      for (const user of users) {
        await this.recalcPlayerStats(user.pubgId);
      }
      // 排行榜重算
      await this.recalcLeaderboard();
      // 车队检测
      await this.detectTeamsFromMatches();
      this.logger.log('同步后任务完成（统计重算 + 排行榜 + 车队检测）');
    } catch (error: any) {
      this.logger.error(`同步后任务失败: ${error.message}`);
    }
  }

  private async recalcLeaderboard() {
    try {
      // 由于不能直接 import LeaderboardService，直接执行 Prisma 查询
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

      // 删除旧数据
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

  private async detectTeamsFromMatches() {
    // 查找同一 matchId 中出现 >=2 个已注册用户的记录
    const rawResults: Array<{ match_id: string; player_count: number }> =
      await this.prisma.$queryRaw`
        SELECT match_id, COUNT(DISTINCT pubg_id) AS player_count
        FROM matches
        GROUP BY match_id
        HAVING COUNT(DISTINCT pubg_id) >= 2
      `;

    for (const row of rawResults) {
      const matchRecords = await this.prisma.match.findMany({
        where: { matchId: row.match_id },
        select: { pubgId: true },
      });
      const pubgIds = [...new Set(matchRecords.map((r) => r.pubgId))];
      const users = await this.prisma.user.findMany({
        where: { pubgId: { in: pubgIds } },
      });
      if (users.length < 2) continue;

      const userIds = users.map((u) => u.id);
      const existingMembers = await this.prisma.teamMember.findMany({
        where: { userId: { in: userIds } },
        include: { team: true },
      });

      const overlapMap = new Map<string, number>();
      for (const member of existingMembers) {
        overlapMap.set(member.teamId, (overlapMap.get(member.teamId) || 0) + 1);
      }

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
        team = await this.prisma.team.findUnique({ where: { id: bestTeamId } });
      }

      if (!team) {
        const teamName = users.map((u) => u.nickname).join('、') + '的车队';
        team = await this.prisma.team.create({ data: { name: teamName } });
      }

      for (const userId of userIds) {
        await this.prisma.teamMember.upsert({
          where: { teamId_userId: { teamId: team.id, userId } },
          update: { matchCount: { increment: 1 } },
          create: { teamId: team.id, userId, matchCount: 1 },
        });
      }
    }
    this.logger.log('车队检测完成');
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

  private async recalcPlayerStats(pubgId: string) {
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

    // PlayerStats 关联 User.id，需要通过 pubgId 查到 User
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
