import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../prisma.service';
import { PubgCacheService } from './services/pubg-cache.service';
import { PubgBatchService } from './services/pubg-batch.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PubgCacheService, PubgBatchService, PrismaService],
  exports: [PubgCacheService, PubgBatchService],
})
export class PubgModule {}