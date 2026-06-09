import { Module } from '@nestjs/common';
import { AiReportController } from './ai-report.controller';
import { AiReportService } from './ai-report.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [AiReportController],
  providers: [AiReportService, PrismaService],
})
export class AiReportModule {}
