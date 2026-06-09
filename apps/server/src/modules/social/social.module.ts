import { Module } from '@nestjs/common';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';
import { SocialGateway } from './social.gateway';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [SocialController],
  providers: [SocialService, SocialGateway, PrismaService],
  exports: [SocialService],
})
export class SocialModule {}
