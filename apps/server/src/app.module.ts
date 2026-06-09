import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaService } from './prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { MatchesModule } from './modules/matches/matches.module';
import { StatsModule } from './modules/stats/stats.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { SyncModule } from './modules/sync/sync.module';
import { AiReportModule } from './modules/ai-report/ai-report.module';
import { TeamsModule } from './modules/teams/teams.module';
import { SocialModule } from './modules/social/social.module';
import { GraphModule } from './modules/graph/graph.module';
import { PlayersModule } from './modules/players/players.module';
import { AdminModule } from './modules/admin/admin.module';
import { PubgModule } from './modules/pubg/pubg.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    MatchesModule,
    StatsModule,
    LeaderboardModule,
    SyncModule,
    AiReportModule,
    TeamsModule,
    SocialModule,
    GraphModule,
     PlayersModule,
     AdminModule,
     PubgModule,
  ],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
