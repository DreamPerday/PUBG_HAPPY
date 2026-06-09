import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncService } from './sync.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [SyncService, PrismaService],
  exports: [SyncService],
})
export class SyncModule {}
