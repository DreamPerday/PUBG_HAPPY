import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PrismaService } from '../../prisma.service';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [SyncModule],
  controllers: [PlayersController],
  providers: [PlayersService, PrismaService],
  exports: [PlayersService],
})
export class PlayersModule {}