import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [MatchesController],
  providers: [MatchesService, PrismaService],
  exports: [MatchesService],
})
export class MatchesModule {}
