import { useEffect, useMemo, useState } from 'react'
import { Trophy, Target, Zap, Crown, Search, RefreshCw, Loader2, Users, User } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getTeamRedBoard } from '@/api/leaderboardApi'
import RankTable from '@/components/RankTable'
import RankTableTeam from '@/components/RankTableTeam'
import WeekSelector, { getWeekNumber } from '@/components/WeekSelector'
import Chart from '@/components/Chart'
import type { LeaderboardEntry, LeaderboardBoard } from '@/types'

const categories = [
  { key: '击杀王', icon: Trophy, color: 'text-pubg-orange', desc: '总击杀数最高' },
  { key: '伤害王', icon: Target, color: 'text-pubg-red', desc: '总伤害量最高' },
  { key: '吃鸡王', icon: Crown, color: 'text-pubg-yellow', desc: '吃鸡次数最多' },
  { key: '爆头王', icon: Zap, color: 'text-pubg-blue', desc: '爆头数最高' },
]

export default function Leaderboard() {
  const fetchBoards = useStore(state => state.fetchBoards)
  const redBoard = useStore(state => state.redBoard)
  const boardLoading = useStore(state => state.boardLoading)
  const boardWeek = useStore(state => state.boardWeek)
  const currentUser = useStore(state => state.currentUser)

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('personal')
  const [refreshing, setRefreshing] = useState(false)
  const [teamBoard, setTeamBoard] = useState<LeaderboardBoard | null>(null)
  const [teamBoardLoading, setTeamBoardLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(boardWeek || getWeekNumber())

  useEffect(() => {
    fetchBoards(selectedWeek)
  }, [fetchBoards, selectedWeek])

  useEffect(() => {
    if (boardWeek && boardWeek !== selectedWeek) {
      setSelectedWeek(boardWeek)
    }
  }, [boardWeek])

  useEffect(() => {
    if (viewMode !== 'team' || !selectedWeek) return
    setTeamBoardLoading(true)
    getTeamRedBoard(selectedWeek).then(setTeamBoard).finally(() => setTeamBoardLoading(false))
  }, [viewMode, selectedWeek])

  const handleRefresh = async () => {
    setRefreshing(true)
    if (viewMode === 'personal') {
      await fetchBoards(selectedWeek)
    } else {
      setTeamBoardLoading(true)
      await getTeamRedBoard(selectedWeek).then(setTeamBoard)
      setTeamBoardLoading(false)
    }
    setRefreshing(false)
  }

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week)
  }

  const activeBoard = viewMode === 'team' ? teamBoard : redBoard
  const activeLoading = viewMode === 'team' ? teamBoardLoading : boardLoading

  const filteredBoards = useMemo(() => {
    if (!activeBoard?.boards) return {}
    const q = search.trim().toLowerCase()

    const result: Record<string, LeaderboardEntry[]> = {}
    for (const [key, entries] of Object.entries(activeBoard.boards)) {
      let filtered = entries as any[]

      if (q) {
        filtered = filtered.filter((e: any) => (e.user?.nickname || e.teamName || '').toLowerCase().includes(q))
      }

      result[key] = filtered
    }
    return result
  }, [activeBoard, search, viewMode, currentUser])

  const chartData = useMemo(() => {
    if (!activeBoard?.boards) return null
    if (viewMode === 'team') return null
    const damageEntries = activeBoard.boards['伤害王'] || []
    const top5 = damageEntries.slice(0, 5)
    return {
      categories: top5.map((e: any) => e.user?.nickname || '未知'),
      series: [{ name: '总伤害', data: top5.map((e: any) => Math.round(e.score)) }],
    }
  }, [activeBoard, viewMode])

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="pubg-title mb-1 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-pubg-orange" />
            红榜荣耀
          </h1>
          <p className="pubg-subtitle">本周顶尖选手榜单</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-pubg-muted hover:text-pubg-orange hover:bg-pubg-orange/10 transition-all border border-pubg-border hover:border-pubg-orange/30 text-sm"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            刷新
          </button>
          <WeekSelector value={selectedWeek} onChange={handleWeekChange} />
        </div>
      </div>

      {/* 操作栏：搜索 + 视图切换 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pubg-muted" />
          <input
            type="text"
            placeholder="搜索玩家昵称..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-pubg-card border border-pubg-border rounded-lg py-2.5 pl-10 pr-4 text-pubg-text placeholder:text-pubg-muted text-sm focus:outline-none focus:border-pubg-orange transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-pubg-card rounded-lg p-1 border border-pubg-border">
          <button
            onClick={() => setViewMode('personal')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'personal'
                ? 'bg-pubg-orange text-black'
                : 'text-pubg-muted hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            个人
          </button>
          <button
            onClick={() => setViewMode('team')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              viewMode === 'team'
                ? 'bg-pubg-orange text-black'
                : 'text-pubg-muted hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            车队
          </button>
        </div>
      </div>

      {/* 加载态 */}
      {activeLoading && !activeBoard && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
            <span className="text-pubg-muted text-sm">榜单数据加载中...</span>
          </div>
        </div>
      )}

      {/* 分类榜单 2x2 网格 */}
      {activeBoard && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map(cat => {
              const entries = filteredBoards[cat.key] || []
              return (
                <div key={cat.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <cat.icon className={`w-5 h-5 ${cat.color}`} />
                    <h2 className="text-lg font-bold text-white">{cat.key}</h2>
                  </div>
                  <p className="text-xs text-pubg-muted mb-4">{viewMode === 'team' ? '车队排行' : cat.desc}</p>
                  {viewMode === 'team' ? (
                    <RankTableTeam entries={entries as any} />
                  ) : (
                    <RankTable entries={entries} />
                  )}
                </div>
              )
            })}
          </div>

          {/* 柱状图：仅个人模式显示 */}
          {viewMode === 'personal' && chartData && chartData.categories.length > 0 && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-pubg-orange" />
                伤害 Top 5 对比
              </h2>
              <div className="pubg-card p-4">
                <Chart type="bar" data={chartData} height={320} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
