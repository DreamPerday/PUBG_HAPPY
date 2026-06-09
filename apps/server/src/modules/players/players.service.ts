import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { BindPlayerDto } from './dto/bind-player.dto';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: { playerStats: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const player = await this.prisma.user.findFirst({
      where: {
        OR: [{ id }, { pubgId: id }],
      },
      include: { playerStats: true },
    });
    if (!player) throw new NotFoundException('玩家不存在');
    return player;
  }

  async bind(dto: BindPlayerDto) {
    return this.prisma.user.create({
      data: {
        pubgId: dto.pubgId,
        nickname: dto.nickname,
        avatar: dto.avatar,
        playerStats: { create: {} },
      },
      include: { playerStats: true },
    });
  }

  async updateAvatar(userId: string, avatar: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar },
    });
  }

  async remove(id: string) {
    const player = await this.findOne(id);
    return this.prisma.user.delete({ where: { id: player.id } });
  }
}
