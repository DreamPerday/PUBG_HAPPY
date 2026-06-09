import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PubgRateLimiterService {
  private readonly logger = new Logger(PubgRateLimiterService.name);
  private timestamps: number[] = [];
  private readonly maxPerMinute: number;
  private readonly windowMs = 60_000;

  constructor(private readonly configService: ConfigService) {
    // 允许通过配置覆盖限流值，默认 10 次/分钟（PUBG 官方默认值）
    this.maxPerMinute = this.configService.get<number>('pubg.rateLimitPerMinute') || 10;
  }

  /**
   * 获取限流槽位，如果当前窗口已满则等待
   * 返回实际等待的毫秒数
   */
  async acquire(): Promise<number> {
    const now = Date.now();
    // 清除窗口外的过期时间戳
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxPerMinute) {
      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 100;
      this.logger.warn(`[PUBG 限流] 等待 ${Math.round(waitMs / 1000)} 秒`);
      await new Promise((r) => setTimeout(r, waitMs));
      // 等待结束后递归重新检查（防止多个等待者同时唤醒时的竞争）
      return this.acquire();
    }

    this.timestamps.push(Date.now());
    return 0;
  }

  /**
   * 带自动重试的限流 API 调用
   * - 遇到 429 / 5xx / 网络错误时自动重试
   * - 指数退避等待
   * - 确保数据最终能获取到
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    label: string = 'API',
    maxRetries: number = 10,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // 1. 等待本地限流槽位
        await this.acquire();
        // 2. 执行 API 调用
        const result = await operation();
        if (attempt > 0) {
          this.logger.log(`[PUBG 重试成功] ${label} 第 ${attempt + 1} 次尝试成功`);
        }
        return result;
      } catch (err: any) {
        lastError = err;
        const status = err.response?.status;

        // 根据错误类型决定等待时间
        let waitTime: number;

        if (status === 429) {
          // PUBG 官方限流：使用 Retry-After 头或指数退避
          const retryAfter = parseInt(err.response?.headers?.['retry-after'] || '0', 10);
          waitTime = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * Math.pow(2, attempt), 60000);
          this.logger.warn(`[PUBG 限流] ${label} 被官方限流 (429)，等待 ${Math.round(waitTime / 1000)} 秒后重试`);
        } else if (status >= 500 || !status) {
          // 服务器错误或网络错误
          waitTime = Math.min(2000 * Math.pow(2, attempt), 30000);
          this.logger.warn(`[PUBG 重试] ${label} 失败 (${err.message})，第 ${attempt + 1}/${maxRetries + 1} 次重试，等待 ${Math.round(waitTime / 1000)} 秒`);
        } else if (status === 404) {
          // 404 不重试，直接抛出
          throw err;
        } else {
          // 其他 4xx 错误（除 429、404）
          waitTime = Math.min(2000 * Math.pow(2, attempt), 30000);
          this.logger.warn(`[PUBG 重试] ${label} 失败 (${err.message})，第 ${attempt + 1}/${maxRetries + 1} 次重试`);
        }

        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, waitTime));
        }
      }
    }

    throw lastError || new Error(`${label} 操作失败，已达最大重试次数 ${maxRetries}`);
  }
}
