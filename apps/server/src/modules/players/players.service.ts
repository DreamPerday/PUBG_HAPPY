import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BindPlayerDto } from './dto/bind-player.dto';
import { PubgCacheService, CacheNamespace } from '../pubg/services/pubg-cache.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class PlayersService {
  private readonly pubgBase: string;
  private readonly apiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: PubgCacheService,
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

    return user;
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