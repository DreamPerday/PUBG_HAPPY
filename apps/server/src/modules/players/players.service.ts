import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BindPlayerDto } from './dto/bind-player.dto';
import { PubgCacheService, CacheNamespace } from '../pubg/services/pubg-cache.service';
import { PubgBatchService } from '../pubg/services/pubg-batch.service';
import { SyncService } from '../sync/sync.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);
  private readonly pubgBase: string;
  private readonly apiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: PubgCacheService,
    private readonly pubgBatchService: PubgBatchService,
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
  ) {
    this.pubgBase = this.configService.get<string>('pubg.baseUrl') || 'https://api.pubg.com/shards/steam';
    this.apiKey = this.configService.get<string>('pubg.apiKey') || '';
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: { playerStats: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const player = await this.prisma.user.findFirst({
      where: {
        OR: [{ id }, { pubgId: id }],
      },
      include: { playerStats: true },
    });
    if (!player) throw new NotFoundException('玩家不存在');
    return player;
  }

  async bind(dto: BindPlayerDto) {
    // 绑定玩家时，同步获取 accountId
    let accountId: string | null = null;
    if (this.apiKey) {
      try {
        const res = await axios.get(`${this.pubgBase}/players`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/vnd.api+json',
          },
          params: { 'filter[playerNames]': dto.pubgId },
        });
        const playerData = res.data?.data?.[0];
        accountId = playerData?.id || null;
      } catch {
        // accountId 获取失败不影响绑定
      }
    }

    const user = await this.prisma.user.create({
      data: {
        pubgId: dto.pubgId,
        nickname: dto.nickname,
        avatar: dto.avatar,
        accountId,
        playerStats: { create: {} },
      },
      include: { playerStats: true },
    });

    // 如果有 accountId，写入 Redis 缓存
    if (accountId) {
      await this.cacheService.set(
        CacheNamespace.PLAYER,
        { pubgId: dto.pubgId, accountId, nickname: dto.nickname },
        undefined,
        dto.pubgId,
      );
    }

    // 绑定后异步拉取全部数据（比赛 + 赛季统计），减少后续 API 请求
    this.syncNewUserData(dto.pubgId, dto.nickname, accountId).catch((err) =>
      this.logger.error(`绑定后数据同步失败: ${err.message}`),
    );

    return user;
  }

  /** 新用户绑定后一次性拉取比赛数据和赛季统计 */
  private async syncNewUserData(pubgId: string, nickname: string, accountId: string | null) {
    this.logger.log(`新用户 ${pubgId}(${nickname}) 绑定，开始拉取全部数据...`);

    // 1. 同步比赛记录
    const syncResult = await this.syncService.syncPlayerMatches(pubgId, accountId);
    this.logger.log(`[${pubgId}] 比赛同步完成: ${syncResult.synced} 场新比赛`);

    // 2. 如果有 accountId，同步赛季统计数据并缓存
    if (accountId) {
      await this.pubgBatchService.fetchAndCacheSeasonData(accountId, pubgId);
      this.logger.log(`[${pubgId}] 赛季数据已缓存`);
    }

    // 3. 重算玩家统计
    const user = await this.prisma.user.findUnique({ where: { pubgId } });
    if (user) {
      // 使用 recalcUserStats 方法（通过 any 访问 SyncService 私有方法或直接用 Prisma）
      const matches = await this.prisma.match.findMany({ where: { pubgId } });
      if (matches.length > 0) {
        const totalMatches = matches.length;
        const totalWins = matches.filter((m) => m.won).length;
        const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
        const totalDamage = matches.reduce((sum, m) => sum + m.damage, 0);
        const totalHeadshots = matches.reduce((sum, m) => sum + m.headshots, 0);
        const avgKills = Math.round((totalKills / totalMatches) * 100) / 100;
        const avgDamage = Math.round((totalDamage / totalMatches) * 100) / 100;

        await this.prisma.playerStats.upsert({
          where: { playerId: user.id },
          update: { totalMatches, totalWins, totalKills, totalDamage: Math.round(totalDamage * 100) / 100, totalHeadshots, avgKills, avgDamage },
          create: { playerId: user.id, totalMatches, totalWins, totalKills, totalDamage: Math.round(totalDamage * 100) / 100, totalHeadshots, avgKills, avgDamage },
        });
      }
    }

    this.logger.log(`新用户 ${pubgId}(${nickname}) 数据初始化完成`);
  }

  async updateAvatar(userId: string, avatar: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar },
    });
  }

  async remove(id: string) {
    const player = await this.findOne(id);
    // 清除缓存
    await this.cacheService.del(CacheNamespace.PLAYER, player.pubgId);
    return this.prisma.user.delete({ where: { id: player.id } });
  }
}