import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [PlayersController],
  providers: [PlayersService, PrismaService],
  exports: [PlayersService],
})
export class PlayersModule {}
