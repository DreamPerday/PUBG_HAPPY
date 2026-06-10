import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TeamsService } from './teams.service';

@ApiTags('动态车队')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: '获取所有车队' })
  findAll() {
    return this.teamsService.findAll();
  }

  @Get('all-stats')
  @ApiOperation({ summary: '获取所有车队统计对比（最佳/最黑）' })
  getAllTeamStats() {
    return this.teamsService.getAllTeamStats();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: '获取用户所属车队' })
  getUserTeams(@Param('userId') userId: string) {
    return this.teamsService.getUserTeams(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取车队详情' })
  findOne(@Param('id') id: string) {
    return this.teamsService.findOne(id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: '获取车队统计（可按周过滤）' })
  getTeamStats(
    @Param('id') id: string,
    @Query('week') week?: string,
  ) {
    return this.teamsService.getTeamStats(id, week);
  }

  @Post('detect')
  @ApiOperation({ summary: '触发自动车队检测' })
  detectTeams() {
    return this.teamsService.detectTeams();
  }

  @Get(':id/matchups')
  @ApiOperation({ summary: '获取指定车队的撞车记录' })
  getTeamMatchups(@Param('id') id: string) {
    return this.teamsService.getTeamMatchups(id);
  }

  @Get('matchups/all')
  @ApiOperation({ summary: '获取所有撞车记录' })
  getAllMatchups() {
    return this.teamsService.getAllMatchups();
  }
}
