import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { PubgCacheService } from './services/pubg-cache.service';
import { PubgBatchService } from './services/pubg-batch.service';
import { PubgRateLimiterService } from './services/pubg-rate-limiter.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PubgCacheService, PubgBatchService, PubgRateLimiterService, PrismaService],
  exports: [PubgCacheService, PubgBatchService, PubgRateLimiterService],
})
export class PubgModule {}