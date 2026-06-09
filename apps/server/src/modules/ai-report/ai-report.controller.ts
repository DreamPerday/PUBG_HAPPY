import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AiReportService } from './ai-report.service';

@ApiTags('AI战报')
@Controller('reports')
export class AiReportController {
  constructor(private readonly aiReportService: AiReportService) {}

  @Get('weekly')
  @ApiOperation({ summary: '获取周报列表' })
  getWeeklyReports() {
    return this.aiReportService.getWeeklyReports();
  }

  @Get('weekly/:week')
  @ApiOperation({ summary: '获取指定周报' })
  getWeeklyReport(@Param('week') week: string) {
    return this.aiReportService.getWeeklyReport(week);
  }

  @Post('weekly/generate')
  @ApiOperation({ summary: '生成周报' })
  generateWeekly(@Query('week') week?: string) {
    return this.aiReportService.generateWeeklyReport(week);
  }

  @Post('match/:matchId')
  @ApiOperation({ summary: '生成单场战报' })
  generateMatchReport(@Param('matchId') matchId: string) {
    return this.aiReportService.generateMatchReport(matchId);
  }
}
