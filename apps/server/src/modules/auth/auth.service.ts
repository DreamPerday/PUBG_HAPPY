import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SyncService } from '../sync/sync.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
  ) {}

  async login(input: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ nickname: input }, { pubgId: input }],
      },
      include: { playerStats: true },
    });
    return user ?? null;
  }

  async register(nickname: string, pubgId: string) {
    const user = await this.prisma.user.create({
      data: {
        nickname,
        pubgId,
        playerStats: { create: {} },
      },
      include: { playerStats: true },
    });

    // 注册后自动同步战绩
    this.syncPlayerData(pubgId).catch((err) =>
      this.logger.error(`注册后同步失败: ${err.message}`),
    );

    return user;
  }

  private async syncPlayerData(pubgId: string) {
    this.logger.log(`新用户 ${pubgId} 注册，开始同步战绩...`);
    await this.syncService.syncPlayerMatches(pubgId);
    this.logger.log(`同步完成，开始重算统计...`);

    // 重算玩家统计
    const user = await this.prisma.user.findUnique({ where: { pubgId } });
    if (user) {
      await this.syncService['recalcPlayerStats'](pubgId);
    }

    // 更新车队检测
    await this.syncService.detectTeamsFromMatches();

    this.logger.log(`新用户 ${pubgId} 数据初始化完成`);
  }
}
