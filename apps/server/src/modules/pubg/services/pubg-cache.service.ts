import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export enum CacheNamespace {
  PLAYER = 'pubg:player',
  SEASON_LIST = 'pubg:season:list',
  SEASON_STATS = 'pubg:season',
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
}

@Injectable()
export class PubgCacheService {
  private readonly logger = new Logger(PubgCacheService.name);
  private redis: Redis | null = null;
  private redisAvailable = false;
  private readonly defaultTTL: Record<CacheNamespace, number> = {
    [CacheNamespace.PLAYER]: 30 * 60,          // 30 分钟
    [CacheNamespace.SEASON_LIST]: 24 * 60 * 60, // 24 小时
    [CacheNamespace.SEASON_STATS]: 12 * 60 * 60, // 12 小时
  };

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('redis.url');
    // 没有配置 Redis 或使用默认 localhost（如 Railway 环境），跳过 Redis
    if (!redisUrl || redisUrl === 'redis://localhost:6379' || redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1')) {
      this.logger.log('Redis 未配置或指向本地地址，缓存功能不可用（不影响核心功能）');
      return;
    }

    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 5) {
          this.logger.warn('Redis 重连次数过多，停止重连，缓存降级为不可用');
          this.redisAvailable = false;
          return null;
        }
        return Math.min(times * 1000, 10000);
      },
    });
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis 连接错误: ${err.message}`);
    });
  }

  async onModuleInit() {
    if (!this.redis) return;
    try {
      await this.redis.connect();
      this.redisAvailable = true;
      this.logger.log('Redis 连接成功');
    } catch (err: any) {
      this.redisAvailable = false;
      this.logger.warn(`Redis 连接失败，缓存将不可用: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (!this.redis) return;
    try {
      await this.redis.quit();
    } catch {
      // ignore
    }
  }

  /** 生成缓存键 */
  private buildKey(namespace: CacheNamespace, ...parts: string[]): string {
    return [namespace, ...parts].join(':');
  }

  /** 获取缓存，命中时记录日志 */
  async get<T>(namespace: CacheNamespace, ...parts: string[]): Promise<T | null> {
    if (!this.redisAvailable || !this.redis) return null;
    const key = this.buildKey(namespace, ...parts);
    try {
      const raw = await this.redis.get(key);
      if (raw) {
        const entry: CacheEntry<T> = JSON.parse(raw);
        this.logger.log(`[RedisHit] ${key}`);
        return entry.data;
      }
      this.logger.log(`[RedisMiss] ${key}`);
      return null;
    } catch (err: any) {
      this.logger.warn(`Redis 读取失败 [${key}]: ${err.message}`);
      return null;
    }
  }

  /** 设置缓存 */
  async set<T>(
    namespace: CacheNamespace,
    data: T,
    ttl?: number,
    ...parts: string[]
  ): Promise<void> {
    if (!this.redisAvailable || !this.redis) return;
    const key = this.buildKey(namespace, ...parts);
    const effectiveTTL = ttl ?? this.defaultTTL[namespace];
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    try {
      await this.redis.setex(key, effectiveTTL, JSON.stringify(entry));
    } catch (err: any) {
      this.logger.warn(`Redis 写入失败 [${key}]: ${err.message}`);
    }
  }

  /** 删除缓存 */
  async del(namespace: CacheNamespace, ...parts: string[]): Promise<void> {
    if (!this.redisAvailable || !this.redis) return;
    const key = this.buildKey(namespace, ...parts);
    try {
      await this.redis.del(key);
    } catch {
      // ignore
    }
  }

  /** 清除指定命名空间下的所有缓存（按前缀匹配） */
  async clearNamespace(namespace: CacheNamespace): Promise<void> {
    if (!this.redisAvailable || !this.redis) return;
    try {
      const keys = await this.redis.keys(`${namespace}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // ignore
    }
  }

  /** 获取原始 Redis 实例（供高级操作） */
  getClient(): Redis | null {
    return this.redis;
  }
}