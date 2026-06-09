import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPlayer(userId: string, page = 1, limit = 20, days?: number) {
    // 支持用 pubgId（玩家昵称）或内部 userId 查询
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { pubgId: userId }],
      },
      select: { pubgId: true },
    });
    const pubgId = user?.pubgId || userId;

    const where: any = { pubgId };
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      where.playedAt = { gte: since };
    }

    const [data, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        orderBy: { playedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.match.count({ where }),
    ]);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOne(matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: { matchId },
      include: { user: true },
    });
    if (!match) throw new NotFoundException('比赛不存在');
    return match;
  }

  async findTeammates(matchId: string, pubgId: string) {
    // 先从数据库查找本场比赛的记录
    const matchRecord = await this.prisma.match.findFirst({
      where: { matchId, pubgId },
      select: { participants: true },
    });

    if (matchRecord?.participants) {
      try {
        const allPlayers = JSON.parse(matchRecord.participants);
        // 找到当前玩家的 rosterId
        const currentPlayer = allPlayers.find(
          (p: any) => p.name === pubgId || p.playerId === pubgId,
        );
        const myRosterId = currentPlayer?.rosterId;

        // 过滤出同一队伍的队友（排除自己）
        return allPlayers
          .filter((p: any) =>
            p.rosterId && p.rosterId === myRosterId &&
            p.name !== pubgId && p.playerId !== pubgId
          )
          .map((p: any) => ({
            pubgId: p.name,
            nickname: p.name,
            kills: p.kills,
            damage: p.damageDealt,
            rank: p.winPlace,
            survivalTime: p.timeSurvived,
            headshots: p.headshotKills,
            assists: p.assists,
            revives: p.revives,
            won: p.winPlace === 1,
          }));
      } catch { /* ignore parse errors */ }
    }

    return [];
  }

  async getMatchDamage(matchId: string) {
    // 查找该场比赛的所有记录，取第一条有 participants 的
    const matchRecord = await this.prisma.match.findFirst({
      where: { matchId },
      select: { participants: true },
    });

    if (!matchRecord?.participants) return [];

    try {
      const allPlayers = JSON.parse(matchRecord.participants);
      return allPlayers
        .map((p: any) => ({
          name: p.name,
          kills: p.kills || 0,
          damage: Math.round((p.damageDealt || 0) * 100) / 100,
          rank: p.winPlace || 99,
          survivalTime: p.timeSurvived || 0,
          headshots: p.headshotKills || 0,
          assists: p.assists || 0,
          revives: p.revives || 0,
        }))
        .sort((a: any, b: any) => b.damage - a.damage);
    } catch {
      return [];
    }
  }

  async createMatches(matches: any[]) {
    const created = [];
    for (const m of matches) {
      try {
        const match = await this.prisma.match.upsert({
          where: { matchId_pubgId: { matchId: m.matchId, pubgId: m.pubgId } },
          update: m,
          create: m,
        });
        created.push(match);
      } catch (e) {
        // ignore duplicate
      }
    }
    return created;
  }
}
