import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MatchesService } from './matches.service';

@ApiTags('比赛记录')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('player/:id')
  @ApiOperation({ summary: '获取玩家比赛记录' })
  findByPlayer(
    @Param('id') playerId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    @Query('days') days?: string,
  ) {
    return this.matchesService.findByPlayer(playerId, +page, +limit, days ? +days : undefined);
  }

  @Get('teammates/:matchId')
  @ApiOperation({ summary: '获取比赛队友数据' })
  findTeammates(
    @Param('matchId') matchId: string,
    @Query('pubgId') pubgId: string,
  ) {
    return this.matchesService.findTeammates(matchId, pubgId);
  }

  @Get('damage/:matchId')
  @ApiOperation({ summary: '获取全场比赛伤害排行' })
  getMatchDamage(@Param('matchId') matchId: string) {
    return this.matchesService.getMatchDamage(matchId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取比赛详情' })
  findOne(@Param('id') matchId: string) {
    return this.matchesService.findOne(matchId);
  }
}
