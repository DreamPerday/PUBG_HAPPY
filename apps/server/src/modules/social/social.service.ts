import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCommentDto } from './dto/comment.dto';
import { CreateDanmakuDto } from './dto/danmaku.dto';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async createComment(dto: CreateCommentDto) {
    const comment = await this.prisma.comment.create({
      data: {
        userId: dto.userId,
        content: dto.content,
        pageId: dto.pageId,
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });
    return comment;
  }

  async getComments(pageId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { pageId },
        include: {
          user: { select: { id: true, nickname: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where: { pageId } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createDanmaku(dto: CreateDanmakuDto) {
    const danmaku = await this.prisma.danmaku.create({
      data: {
        userId: dto.userId,
        content: dto.content,
        pageId: dto.pageId,
        color: dto.color ?? '#ff9500',
        position: dto.position ?? 0,
      },
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });
    return danmaku;
  }

  async getDanmaku(pageId: string, since?: string) {
    const where: any = { pageId };
    if (since) {
      where.createdAt = { gte: new Date(since) };
    }
    return this.prisma.danmaku.findMany({
      where,
      include: {
        user: { select: { id: true, nickname: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
