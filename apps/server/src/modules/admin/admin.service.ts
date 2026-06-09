import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as fs from 'fs';
import * as os from 'os';

@Injectable()
export class AdminService {
  private startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  async getUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        playerStats: {
          select: {
            totalMatches: true,
            totalKills: true,
            totalDamage: true,
            totalWins: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      pubgId: u.pubgId,
      createdAt: u.createdAt,
      stats: u.playerStats
        ? {
            matches: u.playerStats.totalMatches,
            kills: u.playerStats.totalKills,
            damage: Math.round(u.playerStats.totalDamage),
            wins: u.playerStats.totalWins,
          }
        : null,
    }));
  }

  async getServerStats() {
    // 数据库文件大小
    let dbSize = 0;
    const paths = ['./dev.db', 'dev.db', 'prisma/dev.db', '../dev.db'];
    for (const p of paths) {
      try {
        const st = fs.statSync(p);
        dbSize = st.size;
        break;
      } catch {}
    }

    const userCount = await this.prisma.user.count();
    const matchCount = await this.prisma.match.count();

    return {
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      userCount,
      matchCount,
      dbSize,
      memory: process.memoryUsage(),
      platform: os.platform(),
      nodeVersion: process.version,
    };
  }

  async deleteUser(pubgId: string) {
    const user = await this.prisma.user.findUnique({ where: { pubgId } });
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);

    await this.prisma.leaderboard.deleteMany({ where: { userId: user.id } });
    await this.prisma.teamMember.deleteMany({ where: { userId: user.id } });
    await this.prisma.syncLog.deleteMany({ where: { userId: user.id } });
    await this.prisma.match.deleteMany({ where: { pubgId } });
    await this.prisma.playerStats.deleteMany({ where: { playerId: user.id } });
    await this.prisma.user.delete({ where: { id: user.id } });

    return { success: true, message: `用户 ${pubgId} 已删除` };
  }

  async updateUser(pubgId: string, body: { nickname?: string; newPubgId?: string }) {
    const user = await this.prisma.user.findUnique({ where: { pubgId } });
    if (!user) throw new HttpException('用户不存在', HttpStatus.NOT_FOUND);

    const data: any = {};
    if (body.nickname) data.nickname = body.nickname;
    if (body.newPubgId) {
      // 检查新 pubgId 是否已存在
      const exists = await this.prisma.user.findUnique({ where: { pubgId: body.newPubgId } });
      if (exists) throw new HttpException('该 PUBG ID 已被注册', HttpStatus.CONFLICT);

      // 更新关联的 match 记录
      await this.prisma.match.updateMany({ where: { pubgId }, data: { pubgId: body.newPubgId } });
      data.pubgId = body.newPubgId;
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      include: { playerStats: true },
    });

    return {
      success: true,
      message: `用户已更新`,
      user: {
        id: updated.id,
        nickname: updated.nickname,
        pubgId: updated.pubgId,
      },
    };
  }

  async recalcUserStats(pubgId: string) {
    const user = await this.prisma.user.findUnique({ where: { pubgId } });
    if (!user) return;

    const matches = await this.prisma.match.findMany({ where: { pubgId } });
    if (!matches.length) return;

    const totalMatches = matches.length;
    const totalWins = matches.filter((m) => m.won).length;
    const totalKills = matches.reduce((sum, m) => sum + m.kills, 0);
    const totalDamage = matches.reduce((sum, m) => sum + m.damage, 0);
    const totalHeadshots = matches.reduce((sum, m) => sum + m.headshots, 0);
    const avgKills = Math.round((totalKills / totalMatches) * 100) / 100;
    const avgDamage = Math.round((totalDamage / totalMatches) * 100) / 100;
    const avgSurvivalTime = Math.round(matches.reduce((sum, m) => sum + m.survivalTime, 0) / totalMatches);
    const bestRank = Math.min(...matches.map((m) => m.rank));
    const kda = avgKills;
    const winRate = Math.round((totalWins / totalMatches) * 100) / 100;

    await this.prisma.playerStats.upsert({
      where: { playerId: user.id },
      update: {
        totalMatches, totalWins, totalKills,
        totalDamage: Math.round(totalDamage * 100) / 100,
        totalHeadshots, avgKills, avgDamage,
        avgSurvivalTime, bestRank, kda, winRate,
      },
      create: {
        playerId: user.id,
        totalMatches, totalWins, totalKills,
        totalDamage: Math.round(totalDamage * 100) / 100,
        totalHeadshots, avgKills, avgDamage,
        avgSurvivalTime, bestRank, kda, winRate,
      },
    });
  }

  async cleanupUnregistered() {
    // 删除所有没有比赛记录的注册用户（误注册）
    const users = await this.prisma.user.findMany({
      select: { id: true, pubgId: true, _count: { select: { matches: true } } },
    });
    const toDelete = users.filter((u) => u._count.matches === 0);
    let deleted = 0;
    for (const user of toDelete) {
      await this.prisma.leaderboard.deleteMany({ where: { userId: user.id } });
      await this.prisma.teamMember.deleteMany({ where: { userId: user.id } });
      await this.prisma.playerStats.deleteMany({ where: { playerId: user.id } });
      await this.prisma.user.delete({ where: { id: user.id } });
      deleted++;
    }
    return { success: true, message: `已清理 ${deleted} 名误注册用户`, deleted };
  }

  async resetDatabase() {
    // 按外键依赖顺序清空所有表
    await this.prisma.matchTelemetry.deleteMany();
    await this.prisma.danmaku.deleteMany();
    await this.prisma.comment.deleteMany();
    await this.prisma.weeklyReport.deleteMany();
    await this.prisma.leaderboard.deleteMany();
    await this.prisma.teamMember.deleteMany();
    await this.prisma.teamGraphCluster.deleteMany();
    await this.prisma.playerRelation.deleteMany();
    await this.prisma.playerStats.deleteMany();
    await this.prisma.syncLog.deleteMany();
    await this.prisma.match.deleteMany();
    await this.prisma.team.deleteMany();
    await this.prisma.user.deleteMany();

    return { success: true, message: '所有数据已清空，请重新同步玩家数据' };
  }

  async getConfig(key: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });
    return config ? config.value : null;
  }

  async setConfig(key: string, value: string) {
    const config = await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    return config;
  }

  async getAllConfigs() {
    const configs = await this.prisma.systemConfig.findMany();
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;
    return map;
  }
}
