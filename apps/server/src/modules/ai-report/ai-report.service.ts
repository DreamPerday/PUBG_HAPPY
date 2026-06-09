import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import axios from 'axios';
import * as dayjs from 'dayjs';

@Injectable()
export class AiReportService {
  private readonly logger = new Logger(AiReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getAiConfig() {
    const configs = await this.prisma.systemConfig.findMany();
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;
    return {
      apiKey: map['ai_api_key'] || process.env.AI_API_KEY || '',
      baseUrl: map['ai_base_url'] || process.env.AI_API_BASE || 'https://api.openai.com/v1',
      model: map['ai_model'] || process.env.AI_MODEL || 'gpt-4o',
      weeklyPrompt: map['ai_weekly_prompt'] || this.defaultWeeklyPrompt(),
      matchPrompt: map['ai_match_prompt'] || this.defaultMatchPrompt(),
    };
  }

  private defaultWeeklyPrompt() {
    return `你是PUBG电竞战报写手，请根据以下车队本周战绩生成一份幽默风趣的中文周报：

{data}

请包含：
1. 总体评价（车队整体表现）
2. 击杀王表扬
3. 吐槽担当（表现最"稳定"的玩家）
4. 下周展望
5. 一个搞笑标题

风格要求：毒舌、幽默、电竞圈黑话、中文网络梗，禁止英文。`;
  }

  private defaultMatchPrompt() {
    return `请为以下PUBG比赛生成一段中文吐槽战报，风格幽默毒舌，电竞解说风格：
玩家：{nickname}
地图：{map}
模式：{mode}
击杀：{kills}
伤害：{damage}
排名：{rank}
存活时间：{survivalTime}分钟
爆头：{headshots}

请输出：
1. 一句话总结
2. 高光时刻（如果有）
3. 吐槽内容`;
  }

  async getWeeklyReports() {
    const reports = await this.prisma.weeklyReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return reports.map((r) => this.parseReport(r));
  }

  async getWeeklyReport(week: string) {
    const report = await this.prisma.weeklyReport.findFirst({ where: { week } });
    return report ? this.parseReport(report) : null;
  }

  private parseReport(report: any) {
    return {
      ...report,
      content: report.content ? JSON.parse(report.content) : {},
      topPlayers: report.topPlayers ? JSON.parse(report.topPlayers) : [],
      funnyRankings: report.funnyRankings ? JSON.parse(report.funnyRankings) : [],
    };
  }

  async generateWeeklyReport(week?: string) {
    const targetWeek = week || dayjs().format('YYYY-WW');
    const startOfWeek = dayjs().startOf('week').toDate();
    const endOfWeek = dayjs().endOf('week').toDate();

    const users = await this.prisma.user.findMany({
      include: {
        playerStats: true,
        matches: {
          where: { playedAt: { gte: startOfWeek, lte: endOfWeek } },
          orderBy: { playedAt: 'desc' },
        },
      },
    });

    if (!users.length) {
      return { message: '本周暂无数据' };
    }

    const topPlayers = users
      .map((p) => ({
        name: p.nickname,
        kills: p.matches.reduce((s, m) => s + m.kills, 0),
        damage: p.matches.reduce((s, m) => s + m.damage, 0),
        wins: p.matches.filter((m) => m.won).length,
        matches: p.matches.length,
      }))
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 5);

    const funnyRankings = [
      { title: '最快快递员', name: topPlayers[topPlayers.length - 1]?.name || '暂无', desc: '场均存活时间最短' },
      { title: '最强人机', name: topPlayers.find((p) => p.kills < 2)?.name || '暂无', desc: '击杀最少' },
    ];

    const prompt = this.buildWeeklyPrompt(users, topPlayers);
    const aiConfig = await this.getAiConfig();
    const finalPrompt = aiConfig.weeklyPrompt.replace('{data}', prompt);
    const aiContent = await this.callAI(finalPrompt, aiConfig);

    const existing = await this.prisma.weeklyReport.findFirst({
      where: { week: targetWeek },
    });

    const report = existing
      ? await this.prisma.weeklyReport.update({
          where: { id: existing.id },
          data: {
            title: `${targetWeek} 车队周报`,
            content: JSON.stringify({ summary: aiContent }),
            topPlayers: JSON.stringify(topPlayers),
            funnyRankings: JSON.stringify(funnyRankings),
          },
        })
      : await this.prisma.weeklyReport.create({
          data: {
            week: targetWeek,
            title: `${targetWeek} 车队周报`,
            content: JSON.stringify({ summary: aiContent }),
            topPlayers: JSON.stringify(topPlayers),
            funnyRankings: JSON.stringify(funnyRankings),
          },
        });

    return this.parseReport(report);
  }

  async generateMatchReport(matchId: string) {
    const match = await this.prisma.match.findFirst({
      where: { matchId },
      include: { user: true },
    });
    if (!match) return { message: '比赛不存在' };

    const aiConfig = await this.getAiConfig();
    const prompt = aiConfig.matchPrompt
      .replace('{nickname}', (match as any).user?.nickname || '未知')
      .replace('{map}', match.mapName)
      .replace('{mode}', match.mode)
      .replace('{kills}', String(match.kills))
      .replace('{damage}', String(Math.round(match.damage)))
      .replace('{rank}', String(match.rank))
      .replace('{survivalTime}', String(Math.round(match.survivalTime / 60)))
      .replace('{headshots}', String(match.headshots));

    const content = await this.callAI(prompt, aiConfig);
    return { matchId, content };
  }

  private buildWeeklyPrompt(users: any[], topPlayers: any[]) {
    const lines = users.map((p) => {
      const kills = p.matches.reduce((s: number, m: any) => s + m.kills, 0);
      const damage = Math.round(p.matches.reduce((s: number, m: any) => s + m.damage, 0));
      const wins = p.matches.filter((m: any) => m.won).length;
      return `${p.nickname}: ${p.matches.length}场, ${kills}杀, ${damage}伤害, ${wins}鸡`;
    });

    return `你是PUBG电竞战报写手，请根据以下车队本周战绩生成一份幽默风趣的中文周报：

${lines.join('\n')}

请包含：
1. 总体评价（车队整体表现）
2. 击杀王表扬
3. 吐槽担当（表现最"稳定"的玩家）
4. 下周展望
5. 一个搞笑标题

风格要求：毒舌、幽默、电竞圈黑话、中文网络梗，禁止英文。`;
  }

  private async callAI(prompt: string, aiConfig: { apiKey: string; baseUrl: string; model: string }): Promise<string> {
    if (!aiConfig.apiKey) {
      this.logger.warn('AI_API_KEY未设置，返回默认文案');
      return '【AI战报功能未配置】请在管理面板中设置 AI API Key 以启用智能战报生成。';
    }

    try {
      const res = await axios.post(
        `${aiConfig.baseUrl}/chat/completions`,
        {
          model: aiConfig.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.9,
        },
        { headers: { Authorization: `Bearer ${aiConfig.apiKey}`, 'Content-Type': 'application/json' } },
      );
      return res.data.choices[0]?.message?.content || 'AI生成失败';
    } catch (error) {
      this.logger.error('AI调用失败', error.message);
      return 'AI战报生成失败，请稍后重试。';
    }
  }
}
