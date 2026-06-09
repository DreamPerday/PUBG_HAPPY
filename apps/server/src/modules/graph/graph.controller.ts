import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GraphService } from './graph.service';

@ApiTags('关系图谱')
@Controller('graph')
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get('relations')
  @ApiOperation({ summary: '获取所有玩家关系' })
  getRelations() {
    return this.graphService.getRelations();
  }

  @Get('player/:pubgId')
  @ApiOperation({ summary: '获取指定玩家关系' })
  getPlayerRelations(@Param('pubgId') pubgId: string) {
    return this.graphService.getPlayerRelations(pubgId);
  }

  @Get('team_clusters')
  @ApiOperation({ summary: '获取车队聚类' })
  getTeamClusters() {
    return this.graphService.getTeamClusters();
  }

  @Get('users')
  @ApiOperation({ summary: '获取所有注册用户' })
  getUsers() {
    return this.graphService.getUsers();
  }

  @Get('weekly-analysis')
  @ApiOperation({ summary: '本周最受欢迎/最专一之人分析' })
  getWeeklyAnalysis() {
    return this.graphService.getWeeklyAnalysis();
  }

  @Post('clean-demo')
  @ApiOperation({ summary: '清理测试数据' })
  cleanDemoData() {
    return this.graphService.cleanDemoData();
  }

  @Post('detect')
  @ApiOperation({ summary: '触发关系检测' })
  detectRelations() {
    return this.graphService.detectRelations();
  }

  @Post('cluster')
  @ApiOperation({ summary: '触发聚类分析' })
  cluster() {
    return this.graphService.clusterTeams();
  }
}