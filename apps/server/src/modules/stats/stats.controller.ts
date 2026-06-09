import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('数据统计')
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: '获取全局概览' })
  getOverview() {
    return this.statsService.getOverview();
  }

  @Get('season/:pubgId')
  @ApiOperation({ summary: '获取玩家赛季统计数据' })
  getSeasonStats(@Param('pubgId') pubgId: string) {
    return this.statsService.getSeasonStats(pubgId);
  }

  @Get('player/:id')
  @ApiOperation({ summary: '获取玩家统计' })
  getPlayerStats(@Param('id') playerId: string) {
    return this.statsService.getPlayerStats(playerId);
  }
}
