import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);
  private readonly DEMO_ACCOUNTS = [
    'account.demo',
    'account.demo1',
    'account.demo2',
    'account.demo3',
    'account.demo4',
    'account.demo1234',
  ];

  constructor(private readonly prisma: PrismaService) {}

  private notDemoFilter() {
    return {
      playerA: { notIn: this.DEMO_ACCOUNTS },
      playerB: { notIn: this.DEMO_ACCOUNTS },
    };
  }

  private pubgIdNotDemo() {
    return { pubgId: { notIn: this.DEMO_ACCOUNTS } };
  }

  async cleanDemoData() {
    // 删除 demo 账号相关的所有数据
    await this.prisma.playerRelation.deleteMany({
      where: {
        OR: [
          { playerA: { in: this.DEMO_ACCOUNTS } },
          { playerB: { in: this.DEMO_ACCOUNTS } },
        ],
      },
    });
    await this.prisma.teamGraphCluster.deleteMany();
    return { message: '测试数据已清理' };
  }

  async getRelations() {
    return this.prisma.playerRelation.findMany({
      where: this.notDemoFilter(),
      orderBy: { relationStrength: 'desc' },
      take: 200,
    });
  }

  async getPlayerRelations(pubgId: string) {
    if (this.DEMO_ACCOUNTS.includes(pubgId)) return [];
    
    return this.prisma.playerRelation.findMany({
      where: {
        AND: [
          this.notDemoFilter(),
          { OR: [{ playerA: pubgId }, { playerB: pubgId }] },
        ],
      },
      orderBy: { relationStrength: 'desc' },
    });
  }

  async getTeamClusters() {
    return this.prisma.teamGraphCluster.findMany({
      orderBy: { matchCount: 'desc' },
    });
  }

  async getUsers() {
    return this.prisma.user.findMany({
      where: this.pubgIdNotDemo(),
      include: { playerStats: true },
      orderBy: { nickname: 'asc' },
    });
  }

  async getWeeklyAnalysis() {
    // 确保关系数据最新
    await this.detectRelations();

    const relations = await this.prisma.playerRelation.findMany({
      where: this.notDemoFilter(),
    });
    const users = await this.prisma.user.findMany({
      where: this.pubgIdNotDemo(),
    });
    const userMap = new Map(users.map((u) => [u.pubgId, u]));

    // 统计每个玩家的关系数和最高关系强度
    const stats = new Map<string, { relationCount: number; maxStrength: number; bestPartner: string }>();
    for (const rel of relations) {
      for (const pid of [rel.playerA, rel.playerB]) {
        if (!stats.has(pid)) stats.set(pid, { relationCount: 0, maxStrength: 0, bestPartner: '' });
        const s = stats.get(pid)!;
        s.relationCount++;
        if (rel.relationStrength > s.maxStrength) {
          s.maxStrength = rel.relationStrength;
          s.bestPartner = rel.playerA === pid ? rel.playerB : rel.playerA;
        }
      }
    }

    let mostPopular: { pubgId: string; nickname: string; relationCount: number } | null = null;
    let mostLoyal: { pubgId: string; nickname: string; bestPartner: string; maxStrength: number } | null = null;

    for (const [pubgId, s] of stats) {
      const user = userMap.get(pubgId);
      if (!user) continue;
      if (!mostPopular || s.relationCount > mostPopular.relationCount) {
        mostPopular = { pubgId, nickname: user.nickname, relationCount: s.relationCount };
      }
      if (!mostLoyal || s.maxStrength > mostLoyal.maxStrength) {
        const partner = userMap.get(s.bestPartner);
        mostLoyal = { pubgId, nickname: user.nickname, bestPartner: partner?.nickname || s.bestPartner, maxStrength: s.maxStrength };
      }
    }

    return { mostPopular, mostLoyal };
  }

  async detectRelations() {
    const users = await this.prisma.user.findMany({
      where: this.pubgIdNotDemo(),
    });
    const pubgIds = users.map((u) => u.pubgId);
    if (pubgIds.length < 2) return { message: '至少需要2名注册用户' };

    const allMatches = await this.prisma.match.findMany({
      select: { matchId: true, pubgId: true, playedAt: true },
      where: this.pubgIdNotDemo(),
    });

    // 按 matchId 分组
    const matchGroups = new Map<string, Array<{ pubgId: string; playedAt: Date }>>();
    for (const m of allMatches) {
      if (!pubgIds.includes(m.pubgId)) continue;
      const arr = matchGroups.get(m.matchId) || [];
      arr.push({ pubgId: m.pubgId, playedAt: m.playedAt });
      matchGroups.set(m.matchId, arr);
    }

    const relationMap = new Map<string, { together: number; lastPlayed: Date }>();
    const playerMatchCounts = new Map<string, number>();

    for (const user of users) {
      playerMatchCounts.set(user.pubgId, 0);
    }

    // 批量加载有多个注册用户的比赛的 participants
    const matchIdsWithMultiUsers = [...matchGroups.entries()]
      .filter(([, players]) => [...new Set(players.map((p) => p.pubgId))].filter((id) => pubgIds.includes(id)).length >= 2)
      .map(([matchId]) => matchId);

    const participantsMap = new Map<string, any[]>();
    if (matchIdsWithMultiUsers.length > 0) {
      const matchesWithParticipants = await this.prisma.match.findMany({
        where: { matchId: { in: matchIdsWithMultiUsers }, participants: { not: null } },
        select: { matchId: true, participants: true },
      });
      for (const m of matchesWithParticipants) {
        if (m.participants) {
          try {
            participantsMap.set(m.matchId, typeof m.participants === 'string' ? JSON.parse(m.participants) : m.participants);
          } catch { /* ignore parse errors */ }
        }
      }
    }

    for (const [matchId, players] of matchGroups) {
      const uniquePlayers = [...new Set(players.map((p) => p.pubgId))].filter(
        (id) => pubgIds.includes(id),
      );
      if (uniquePlayers.length < 2) continue;

      // 尝试从 participants 按 rosterId 分组
      const rosterGroups = this.getRosterGroups(matchId, participantsMap, uniquePlayers, pubgIds);

      // 统计每个玩家在该匹配中的出场
      const playSet = new Set(uniquePlayers);

      // 按 roster 分组处理（若无 participants 数据则回退到整场比赛所有注册玩家）
      const groups = rosterGroups.length > 0 ? rosterGroups : [uniquePlayers];

      for (const group of groups) {
        if (group.length < 2) continue;

        // 该 roster 的玩家计为一次出场
        for (const p of group) {
          playerMatchCounts.set(p, (playerMatchCounts.get(p) || 0) + 1);
        }

        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            const key = a < b ? `${a}:${b}` : `${b}:${a}`;
            const existing = relationMap.get(key) || { together: 0, lastPlayed: new Date(0) };
            existing.together++;
            const playedAt = players[0].playedAt;
            if (playedAt > existing.lastPlayed) existing.lastPlayed = playedAt;
            relationMap.set(key, existing);
          }
        }
      }
    }

    let count = 0;
    for (const [key, data] of relationMap) {
      const [playerA, playerB] = key.split(':');
      const totalA = playerMatchCounts.get(playerA) || 1;
      const totalB = playerMatchCounts.get(playerB) || 1;
      const strength = data.together / Math.min(totalA, totalB);

      await this.prisma.playerRelation.upsert({
        where: { playerA_playerB: { playerA, playerB } },
        update: {
          togetherMatches: data.together,
          totalMatchesA: totalA,
          totalMatchesB: totalB,
          relationStrength: strength,
          lastPlayedAt: data.lastPlayed,
        },
        create: {
          playerA,
          playerB,
          togetherMatches: data.together,
          totalMatchesA: totalA,
          totalMatchesB: totalB,
          relationStrength: strength,
          lastPlayedAt: data.lastPlayed,
        },
      });
      count++;
    }

    this.logger.log(`关系检测完成，共更新 ${count} 对关系`);
    return { message: `关系检测完成，共更新 ${count} 对关系`, count };
  }

  /** 从 participants 中按 rosterId 分组，返回每组玩家 pubgId 列表 */
  private getRosterGroups(
    matchId: string,
    participantsMap: Map<string, any[]>,
    uniquePlayers: string[],
    allPubgIds: string[],
  ): string[][] {
    const participants = participantsMap.get(matchId);
    if (!participants) return [];

    const playerSet = new Set(uniquePlayers);
    const rosterMap = new Map<string, string[]>();

    for (const p of participants) {
      const name: string = p.name || '';
      const rosterId: string = p.rosterId || '';
      if (!name || !rosterId) continue;
      if (!playerSet.has(name)) continue;

      if (!rosterMap.has(rosterId)) rosterMap.set(rosterId, []);
      rosterMap.get(rosterId)!.push(name);
    }

    const result = [...rosterMap.values()].filter((g) => g.length >= 2);
    return result;
  }

  async clusterTeams() {
    await this.detectRelations();

    const relations = await this.prisma.playerRelation.findMany({
      where: {
        AND: [
          this.notDemoFilter(),
          { relationStrength: { gte: 0.3 } },
        ],
      },
      orderBy: { relationStrength: 'desc' },
    });

    if (relations.length === 0) {
      return { message: '没有足够的关系数据用于聚类' };
    }

    const graph = new Map<string, Set<string>>();
    const getSet = (key: string) => {
      if (!graph.has(key)) graph.set(key, new Set());
      return graph.get(key)!;
    };

    for (const r of relations) {
      getSet(r.playerA).add(r.playerB);
      getSet(r.playerB).add(r.playerA);
    }

    const visited = new Set<string>();
    const clusters: Set<string>[] = [];

    for (const node of graph.keys()) {
      if (visited.has(node)) continue;
      const cluster = new Set<string>();
      const queue = [node];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current) || cluster.has(current)) continue;
        visited.add(current);
        cluster.add(current);
        // 一支车队最多4人
        if (cluster.size >= 4) continue;
        const neighbors = graph.get(current);
        if (neighbors) {
          for (const n of neighbors) {
            if (!visited.has(n) && !cluster.has(n)) queue.push(n);
          }
        }
      }
      if (cluster.size >= 2) clusters.push(cluster);
    }

    await this.prisma.teamGraphCluster.deleteMany({});

    let clusterCount = 0;
    const processedClusterKeys = new Set<string>();

    for (const cluster of clusters) {
      const members = [...cluster].sort();
      const clusterKey = members.join(',');
      
      if (processedClusterKeys.has(clusterKey)) continue;
      processedClusterKeys.add(clusterKey);

      let totalStrength = 0;
      let totalTogether = 0;
      let relCount = 0;

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const a = members[i];
          const b = members[j];
          const rel = relations.find(
            (r) =>
              (r.playerA === a && r.playerB === b) ||
              (r.playerA === b && r.playerB === a),
          );
          if (rel) {
            totalStrength += rel.relationStrength;
            totalTogether += rel.togetherMatches;
            relCount++;
          }
        }
      }

      const avgStrength = relCount > 0 ? totalStrength / relCount : 0;
      const stabilityScore = members.length > 1 ? avgStrength * Math.log2(members.length) : 0;

      await this.prisma.teamGraphCluster.create({
        data: {
          clusterName: `聚类 #${clusterCount + 1}（${members.length}人）`,
          memberPubgIds: JSON.stringify(members),
          avgStrength,
          stabilityScore,
          matchCount: Math.round(totalTogether / Math.max(relCount, 1)),
        },
      });
      clusterCount++;
    }

    this.logger.log(`聚类分析完成，共生成 ${clusterCount} 个聚类`);
    return { message: `聚类分析完成，共生成 ${clusterCount} 个聚类`, count: clusterCount };
  }
}
