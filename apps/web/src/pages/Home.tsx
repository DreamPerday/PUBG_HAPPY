import { useEffect, useMemo, useState } from 'react'
import { Users, Crosshair, Trophy, TrendingUp, Target, Zap, Skull, Crown, RefreshCw, Loader2, User, Eye } from 'lucide-react'
import { useStore } from '@/store/useStore'
import Chart from '@/components/Chart'
import StatCard from '@/components/StatCard'
import PlayerCard from '@/components/PlayerCard'
import type { LeaderboardEntry } from '@/types'

const rankMedal = (rank: number) => {
  if (rank === 1) return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '🥇' }
  if (rank === 2) return { bg: 'bg-gray-300/20', text: 'text-gray-300', label: '🥈' }
  return { bg: 'bg-amber-700/20', text: 'text-amber-600', label: '🥉' }
}

export default function Home() {
  const overview = useStore((s) => s.overview)
  const overviewLoading = useStore((s) => s.overviewLoading)
  const players = useStore((s) => s.players)
  const playersLoading = useStore((s) => s.playersLoading)
  const redBoard = useStore((s) => s.redBoard)
  const boardLoading = useStore((s) => s.boardLoading)
  const currentUser = useStore((s) => s.currentUser)
  const fetchOverview = useStore((s) => s.fetchOverview)
  const fetchPlayers = useStore((s) => s.fetchPlayers)
  const fetchBoards = useStore((s) => s.fetchBoards)

  const [refreshing, setRefreshing] = useState(false)
  const [showAll, setShowAll] = useState(true)

  useEffect(() => {
    fetchOverview()
    fetchPlayers()
    fetchBoards()
  }, [fetchOverview, fetchPlayers, fetchBoards])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchOverview(), fetchPlayers(), fetchBoards()])
    setRefreshing(false)
  }

  const loading = overviewLoading || playersLoading || boardLoading

  const displayedPlayers = useMemo(() => {
    if (showAll) return players
    return currentUser ? players.filter(p => p.id === currentUser.id) : players
  }, [players, showAll, currentUser])

  const lineChartData = useMemo(() => {
    const matches = overview?.recentMatches || []
    return {
      categories: matches.map((_, i) => `#${i + 1}`),
      series: [
        { name: '击杀数', data: matches.map((m) => m.kills) },
      ],
    }
  }, [overview?.recentMatches])

  const radarChartData = useMemo(() => {
    const maxKda = Math.max(...players.map((p) => p.stats?.kda ?? 0), 5)
    const maxDamage = Math.max(...players.map((p) => p.stats?.avgDamage ?? 0), 300)
    return {
      indicators: [
        { name: 'KDA', max: Math.ceil(maxKda * 1.2) },
        { name: '场均伤害', max: Math.ceil(maxDamage * 1.2) },
        { name: '胜率', max: 100 },
      ],
      series: players.map((p) => ({
        name: p.nickname,
        data: [
          p.stats?.kda ?? 0,
          Math.round(p.stats?.avgDamage ?? 0),
          parseFloat(((p.stats?.winRate ?? 0) * 100).toFixed(1)),
        ],
      })),
    }
  }, [players])

  const topEntries = useMemo(() => {
    const all: { entry: LeaderboardEntry; category: string }[] = []
    if (redBoard?.boards) {
      for (const [cat, entries] of Object.entries(redBoard.boards)) {
        entries.forEach((e) => all.push({ entry: e, category: cat }))
      }
    }
    all.sort((a, b) => b.entry.score - a.entry.score)
    return all.slice(0, 3)
  }, [redBoard])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-pubg-muted text-lg animate-pulse">数据加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="pubg-title mb-1">PUBG 战队数据概览</h1>
          <p className="pubg-subtitle">实时监控战队战绩与成员表现</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-pubg-muted hover:text-pubg-orange hover:bg-pubg-orange/10 transition-all border border-pubg-border hover:border-pubg-orange/30 text-xs sm:text-sm touch-btn"
          >
            {showAll ? <User className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAll ? '只看我' : '全部'}
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-pubg-muted hover:text-pubg-orange hover:bg-pubg-orange/10 transition-all border border-pubg-border hover:border-pubg-orange/30 text-xs sm:text-sm touch-btn"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            刷新
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="车队人数"
          value={overview?.totalPlayers ?? 0}
          icon={Users}
          trend="活跃车队成员"
          color="blue"
        />
        <StatCard
          title="总比赛场次"
          value={overview?.totalMatches ?? 0}
          icon={Crosshair}
          trend="累计对战数据"
          color="orange"
        />
        <StatCard
          title="总击杀数"
          value={overview?.totalKills ?? 0}
          icon={Trophy}
          trend="全员击杀总和"
          color="red"
        />
        <StatCard
          title="场均击杀"
          value={(overview?.avgKills ?? 0).toFixed(2)}
          icon={TrendingUp}
          trend="车队平均水平"
          color="green"
        />
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="pubg-card">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-pubg-orange" />
            近期击杀趋势
          </h2>
          <Chart type="line" data={lineChartData} height={250} />
        </div>
        <div className="pubg-card">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-pubg-orange" />
            成员数据对比
          </h2>
          <Chart type="radar" data={radarChartData} height={250} />
        </div>
      </div>

      {/* 成员卡片 & 红榜排行 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 左侧：成员卡片 */}
        <div className="lg:col-span-2">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-pubg-orange" />
            车队成员
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {displayedPlayers.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
            {displayedPlayers.length === 0 && (
              <div className="col-span-full pubg-card text-center py-6 sm:py-8 text-pubg-muted">
                <Skull className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">暂无成员数据</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：红榜 Top 3 */}
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-pubg-yellow" />
            红榜荣耀 Top 3
          </h2>
          <div className="space-y-3">
            {topEntries.length === 0 && (
              <div className="pubg-card text-center text-pubg-muted py-6 sm:py-8">
                <Skull className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">暂无排行数据</p>
              </div>
            )}
            {topEntries.map(({ entry, category }, i) => {
              const medal = rankMedal(i + 1)
              return (
                <div
                  key={`${entry.user.id}-${entry.category}`}
                  className="pubg-card flex items-center gap-3 sm:gap-4 hover:border-pubg-orange/50 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black shrink-0 ${medal.bg} ${medal.text}`}
                  >
                    {medal.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-bold truncate text-sm">{entry.user.nickname}</div>
                    <div className="text-xs text-pubg-muted">{category}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-pubg-orange font-black text-sm">{entry.score}</div>
                    <div className="text-xs text-pubg-muted">评分</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
