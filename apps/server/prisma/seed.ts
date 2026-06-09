import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 创建演示用户
  const users = await Promise.all([
    prisma.user.upsert({
      where: { pubgId: 'account.demo1' },
      update: {},
      create: {
        pubgId: 'account.demo1',
        nickname: '老六之王',
        playerStats: { create: { totalMatches: 50, totalWins: 8, totalKills: 120, totalDamage: 45000, avgKills: 2.4, avgDamage: 900, kda: 2.4, winRate: 0.16, bestRank: 1 } },
      },
    }),
    prisma.user.upsert({
      where: { pubgId: 'account.demo2' },
      update: {},
      create: {
        pubgId: 'account.demo2',
        nickname: '空投快递员',
        playerStats: { create: { totalMatches: 48, totalWins: 3, totalKills: 45, totalDamage: 18000, avgKills: 0.9, avgDamage: 375, kda: 0.9, winRate: 0.06, bestRank: 5 } },
      },
    }),
    prisma.user.upsert({
      where: { pubgId: 'account.demo3' },
      update: {},
      create: {
        pubgId: 'account.demo3',
        nickname: '狙神附体',
        playerStats: { create: { totalMatches: 55, totalWins: 12, totalKills: 180, totalDamage: 72000, avgKills: 3.3, avgDamage: 1309, kda: 3.3, winRate: 0.22, bestRank: 1 } },
      },
    }),
    prisma.user.upsert({
      where: { pubgId: 'account.demo4' },
      update: {},
      create: {
        pubgId: 'account.demo4',
        nickname: '伏地魔',
        playerStats: { create: { totalMatches: 42, totalWins: 6, totalKills: 85, totalDamage: 32000, avgKills: 2.0, avgDamage: 762, kda: 2.0, winRate: 0.14, bestRank: 2 } },
      },
    }),
  ]);

  // 创建演示比赛数据
  const maps = ['Erangel', 'Miramar', 'Sanhok', 'Vikendi'];
  const modes = ['squad', 'squad-fpp'];

  for (const user of users) {
    const existing = await prisma.match.count({ where: { pubgId: user.pubgId } });
    if (existing > 0) continue;

    for (let i = 0; i < 20; i++) {
      const kills = Math.floor(Math.random() * 8);
      const damage = kills * 300 + Math.floor(Math.random() * 500);
      const rank = Math.floor(Math.random() * 20) + 1;
      await prisma.match.create({
        data: {
          matchId: `match-demo-${i}`,
          pubgId: user.pubgId,
          mode: modes[Math.floor(Math.random() * modes.length)],
          mapName: maps[Math.floor(Math.random() * maps.length)],
          kills,
          damage,
          rank,
          survivalTime: Math.floor(Math.random() * 1200) + 60,
          headshots: Math.floor(kills * 0.3),
          assists: Math.floor(Math.random() * 3),
          revives: Math.floor(Math.random() * 2),
          teamKills: Math.random() > 0.9 ? 1 : 0,
          won: rank === 1,
          playedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)),
        },
      });
    }
  }

  console.log('种子数据创建完成');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
