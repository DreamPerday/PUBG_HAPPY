import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * 数据迁移脚本
 * 为已有用户补充 account_id 字段
 * 
 * 运行方式：
 *   npx ts-node src/scripts/migrate-account-ids.ts
 */
@Injectable()
export class AccountIdMigrationService {
  private readonly logger = new Logger(AccountIdMigrationService.name);
  private readonly pubgBase = process.env.PUBG_API_BASE || 'https://api.pubg.com/shards/steam';
  private readonly apiKey = process.env.PUBG_API_KEY;
  private timestamps: number[] = [];
  private readonly maxPerMinute = 8;
  private readonly windowMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxPerMinute) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 1000;
      await new Promise((r) => setTimeout(r, waitMs));
    }
    this.timestamps.push(Date.now());
  }

  async migrate(): Promise<{ total: number; updated: number; skipped: number }> {
    if (!this.apiKey) {
      this.logger.warn('PUBG_API_KEY 未配置，跳过迁移');
      return { total: 0, updated: 0, skipped: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: { accountId: null },
      select: { id: true, pubgId: true },
    });

    this.logger.log(`需要补充 account_id 的用户: ${users.length} 个`);

    let updated = 0;
    const skipped: string[] = [];

    for (const user of users) {
      try {
        await this.waitForRateLimit();
        const res = await fetch(
          `${this.pubgBase}/players?filter[playerNames]=${user.pubgId}`,
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              Accept: 'application/vnd.api+json',
            },
          },
        );

        if (!res.ok) {
          this.logger.warn(`获取 ${user.pubgId} 失败: ${res.status}`);
          skipped.push(user.pubgId);
          continue;
        }

        const data = await res.json();
        const playerData = data?.data?.[0];
        if (playerData?.id) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { accountId: playerData.id },
          });
          updated++;
          this.logger.log(`已更新 ${user.pubgId} -> accountId: ${playerData.id}`);
        } else {
          skipped.push(user.pubgId);
        }
      } catch (err: any) {
        this.logger.error(`迁移 ${user.pubgId} 失败: ${err.message}`);
        skipped.push(user.pubgId);
      }
    }

    this.logger.log(`迁移完成: 更新 ${updated}, 跳过 ${skipped.length}`);
    return { total: users.length, updated, skipped: skipped.length };
  }
}