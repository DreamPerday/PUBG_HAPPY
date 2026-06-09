import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Target, Zap, Trophy, Crosshair, Clock, TrendingUp, ArrowLeft, Users, ChevronDown } from 'lucide-react'
import { getPlayer, getPlayerStats, getPlayerMatches, getTeammates } from '@/api/playerApi'
import Chart from '@/components/Chart'
import StatCard from '@/components/StatCard'
import type { Player, PlayerStatsDetail, MatchPage, Match, Teammate } from '@/types'
import dayjs from 'dayjs'

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [player, setPlayer] = useState<Player | null>(null)
  const [statsDetail, setStatsDetail] = useState<PlayerStatsDetail | null>(null)
  const [matches, setMatches] = useState<MatchPage | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
  const [teammatesMap, setTeammatesMap] = useState<Record<string, Teammate[]>>({})
  const [loadingTeammates, setLoadingTeammates] = useState<Record<string, boolean>>({})

  // 初始化加载（id变化时重置所有数据）
  useEffect(() => {
    if (!id) return
    setLoading(true)
    setCurrentPage(1)
    setAllMatches([])
    Promise.all([
      getPlayer(id).catch(() => null),
      getPlayerStats(id).catch(() => null),
      getPlayerMatches(id, 1, 20).catch(() => null),
    ])
      .then(([playerData, statsData, matchData]: any[]) => {
        setPlayer(playerData)
        setStatsDetail(statsData)
        setMatches(matchData)
        setAllMatches(matchData?.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 加载更多（currentPage > 1 时追加数据）
  useEffect(() => {
    if (!id || currentPage <= 1) return
    setLoadingMore(true)
    getPlayerMatches(id, currentPage, 20)
      .then((matchData) => {
        setMatches(matchData)
        setAllMatches((prev) => [...prev, ...(matchData?.data || [])])
      })
      .finally(() => setLoadingMore(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentPage])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
        <span className="text-pubg-muted text-lg">数据加载中...</span>
      </div>
    )
  }

  if (!player) return null

  const s = statsDetail?.stats
  const recentTrend = statsDetail?.recentTrend || []
  const recent30 = recentTrend.slice(0, 30).reverse()
  const headshotRate =
    s && s.totalKills > 0 ? ((s.totalHeadshots / s.totalKills) * 100).toFixed(1) : '0.0'

  // 击杀趋势折线图
  const lineChartData = {
    categories: recent30.map((_, i) => `#${i + 1}`),
    series: [{ name: '击杀数', data: recent30.map((m) => m.kills) }],
  }

  // 击杀 vs 伤害柱状图
  const barChartData = {
    categories: recent30.map((_, i) => `#${i + 1}`),
    series: [
      { name: '击杀数', data: recent30.map((m) => m.kills) },
      { name: '伤害', data: recent30.map((m) => Math.round(m.damage)) },
    ],
  }

  // 雷达图
  const radarChartData = {
    indicators: [
      { name: 'KDA', max: 10 },
      { name: '场均击杀', max: 10 },
      { name: '场均伤害', max: 500 },
      { name: '胜率', max: 100 },
      { name: '爆头率', max: 100 },
    ],
    series: [
      {
        name: '综合能力',
        data: [
          s?.kda || 0,
          s?.avgKills || 0,
          s?.avgDamage || 0,
          ((s?.winRate || 0) * 100).toFixed(1),
          headshotRate,
        ],
      },
    ],
  }

  const matchList = allMatches
  const hasMore = matches ? matches.page < matches.totalPages : false

  const toggleExpand = async (matchId: string) => {
    if (expandedMatch === matchId) {
      setExpandedMatch(null)
      return
    }
    setExpandedMatch(matchId)
    if (!teammatesMap[matchId] && player) {
      setLoadingTeammates((prev) => ({ ...prev, [matchId]: true }))
      try {
        const data = await getTeammates(matchId, player.pubgId)
        setTeammatesMap((prev) => ({ ...prev, [matchId]: data }))
      } catch {
        setTeammatesMap((prev) => ({ ...prev, [matchId]: [] }))
      } finally {
        setLoadingTeammates((prev) => ({ ...prev, [matchId]: false }))
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-pubg-muted hover:text-pubg-orange transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>返回</span>
      </button>

      {/* 玩家信息卡片 */}
      <div className="pubg-card">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-pubg-orange/20 flex items-center justify-center text-4xl font-black text-pubg-orange">
            {player.nickname[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-white">{player.nickname}</h1>
            </div>
            <p className="text-pubg-muted text-sm mb-3">PUBG ID: {player.pubgId}</p>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs bg-pubg-orange/20 text-pubg-orange px-3 py-1.5 rounded-full font-medium">
                <Target className="w-3.5 h-3.5" />
                KDA {s?.kda?.toFixed(2) || '0.00'}
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-pubg-green/20 text-pubg-green px-3 py-1.5 rounded-full font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                胜率 {((s?.winRate || 0) * 100).toFixed(1)}%
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-pubg-blue/20 text-pubg-blue px-3 py-1.5 rounded-full font-medium">
                <Crosshair className="w-3.5 h-3.5" />
                爆头率 {headshotRate}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 个统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="总场次" value={s?.totalMatches || 0} icon={Crosshair} color="blue" />
        <StatCard title="总击杀" value={s?.totalKills || 0} icon={Target} color="red" />
        <StatCard title="场均伤害" value={Math.round(s?.avgDamage || 0)} icon={Zap} color="orange" />
        <StatCard title="吃鸡次数" value={s?.totalWins || 0} icon={Trophy} color="green" />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 击杀趋势折线图 */}
        <div className="lg:col-span-2 pubg-card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-pubg-orange" />
            <h2 className="text-lg font-bold text-white">近30场击杀趋势</h2>
          </div>
          <Chart type="line" data={lineChartData} height={300} />
        </div>

        {/* 雷达图 */}
        <div className="pubg-card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-pubg-orange" />
            <h2 className="text-lg font-bold text-white">综合能力</h2>
          </div>
          <Chart type="radar" data={radarChartData} height={300} />
        </div>
      </div>

      {/* 击杀 vs 伤害柱状图 */}
      <div className="pubg-card">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-pubg-orange" />
          <h2 className="text-lg font-bold text-white">击杀 vs 伤害（近30场）</h2>
        </div>
        <Chart type="bar" data={barChartData} height={300} />
      </div>

      {/* 最近比赛列表 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-pubg-orange" />
          <h2 className="text-lg font-bold text-white">最近比赛</h2>
        </div>

        <div className="space-y-2">
          {matchList.map((match: Match) => (
            <div key={match.id}>
              <div
                onClick={() => toggleExpand(match.matchId)}
                className="pubg-card py-3 px-5 flex items-center justify-between hover:border-pubg-orange/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-5">
                  {/* 排名 */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                      match.won
                        ? 'bg-pubg-green/20 text-pubg-green'
                        : match.rank <= 5
                          ? 'bg-pubg-orange/20 text-pubg-orange'
                          : 'bg-pubg-card text-pubg-muted border border-pubg-border'
                    }`}
                  >
                    {match.won ? (
                      <Trophy className="w-4 h-4" />
                    ) : (
                      `#${match.rank}`
                    )}
                  </div>
                  {/* 地图 / 模式 */}
                  <div>
                    <div className="text-sm text-white font-medium">{match.mapName}</div>
                    <div className="text-xs text-pubg-muted">{match.mode}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* 击杀 */}
                  <div className="text-center">
                    <div className="text-sm font-bold text-pubg-orange">{match.kills}</div>
                    <div className="text-xs text-pubg-muted">击杀</div>
                  </div>
                  {/* 伤害 */}
                  <div className="text-center">
                    <div className="text-sm font-bold text-white">{Math.round(match.damage)}</div>
                    <div className="text-xs text-pubg-muted">伤害</div>
                  </div>
                  {/* 助攻 */}
                  <div className="text-center hidden sm:block">
                    <div className="text-sm font-bold text-pubg-muted">{match.assists}</div>
                    <div className="text-xs text-pubg-muted">助攻</div>
                  </div>
                  {/* 日期 */}
                  <div className="text-xs text-pubg-muted w-20 text-right">
                    {dayjs(match.playedAt).format('MM-DD HH:mm')}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-pubg-muted transition-transform ${expandedMatch === match.matchId ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {/* 展开的队友数据 */}
              {expandedMatch === match.matchId && (
                <div className="pubg-card mt-1 p-4 border-t border-pubg-border/50">
                  <h4 className="text-sm font-bold text-pubg-muted mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />本局队友数据
                  </h4>
                  {loadingTeammates[match.matchId] ? (
                    <div className="flex items-center gap-2 text-pubg-muted text-sm py-2">
                      <div className="w-4 h-4 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
                      加载队友数据...
                    </div>
                  ) : (teammatesMap[match.matchId]?.length || 0) > 0 ? (
                    <div className="space-y-2">
                      {teammatesMap[match.matchId].map((tm) => (
                        <div key={tm.pubgId} className="flex items-center justify-between bg-pubg-dark rounded-lg px-4 py-2">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-pubg-orange/20 flex items-center justify-center text-xs font-bold text-pubg-orange">
                              {tm.nickname[0]}
                            </div>
                            <span className="text-sm text-white">{tm.nickname}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-pubg-orange font-bold">{tm.kills}击杀</span>
                            <span className="text-pubg-text">{Math.round(tm.damage)}伤害</span>
                            <span className="text-pubg-muted">{tm.assists}助攻</span>
                            <span className={`font-bold ${tm.won ? 'text-pubg-green' : 'text-pubg-muted'}`}>
                              #{tm.rank}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-pubg-muted text-sm py-2">暂无队友数据（其他玩家未注册系统）</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 加载更多 */}
        {hasMore && (
          <div className="flex items-center justify-center mt-6">
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={loadingMore}
              className="px-8 py-3 rounded-lg bg-pubg-card border border-pubg-border text-pubg-muted hover:border-pubg-orange hover:text-pubg-orange transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
                  加载中...
                </span>
              ) : (
                '加载更多'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
