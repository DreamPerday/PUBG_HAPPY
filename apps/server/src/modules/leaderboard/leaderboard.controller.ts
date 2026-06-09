import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('榜单系统')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('red')
  @ApiOperation({ summary: '红榜 - 击杀/伤害/吃鸡（个人）' })
  getRedBoard(@Query('week') week?: string) {
    return this.leaderboardService.getRedBoard(week);
  }

  @Get('red/team')
  @ApiOperation({ summary: '红榜 - 车队排行' })
  getTeamRedBoard(@Query('week') week?: string) {
    return this.leaderboardService.getTeamRedBoard(week);
  }

  @Get('black')
  @ApiOperation({ summary: '黑榜 - 落地成盒/队友伤害' })
  getBlackBoard(@Query('week') week?: string) {
    return this.leaderboardService.getBlackBoard(week);
  }

  @Get('mvp')
  @ApiOperation({ summary: 'MVP榜' })
  getMvpBoard(@Query('week') week?: string) {
    return this.leaderboardService.getMvpBoard(week);
  }

  @Post('recalculate')
  @ApiOperation({ summary: '重新计算榜单' })
  recalculate(@Query('week') week?: string, @Query('teamId') teamId?: string) {
    return this.leaderboardService.recalculateAll(week, teamId);
  }
}
