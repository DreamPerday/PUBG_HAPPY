import { useEffect, useState } from 'react'
import { Skull, Bomb, Package, Bot, Search } from 'lucide-react'
import { useStore } from '@/store/useStore'
import RankTable from '@/components/RankTable'
import WeekSelector, { getWeekNumber } from '@/components/WeekSelector'

const categories = [
  { key: '落地成盒王', icon: Skull, desc: '存活时间最短', color: 'text-red-400' },
  { key: '队友克星', icon: Bomb, desc: '误伤队友最多', color: 'text-pubg-orange' },
  { key: '快递员', icon: Package, desc: '送人头最多', color: 'text-pubg-yellow' },
  { key: '修脚大师', icon: Bot, desc: '爆头率最低', color: 'text-green-400' },
]

export default function Blackboard() {
  const { blackBoard, boardWeek, boardLoading, fetchBoards } = useStore()
  const [search, setSearch] = useState('')
  const [selectedWeek, setSelectedWeek] = useState(boardWeek || getWeekNumber())

  useEffect(() => {
    fetchBoards(selectedWeek)
  }, [fetchBoards, selectedWeek])

  useEffect(() => {
    if (boardWeek && boardWeek !== selectedWeek) {
      setSelectedWeek(boardWeek)
    }
  }, [boardWeek])

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week)
  }

  const filterEntries = (entries: any[]) => {
    if (!search.trim()) return entries
    const q = search.trim().toLowerCase()
    return entries.filter((e) => e.user?.nickname?.toLowerCase().includes(q))
  }

  return (
    <div className="space-y-6">
      {/* 标题栏 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="pubg-title mb-1 flex items-center gap-3">
            <Skull className="w-8 h-8 text-pubg-red" />
            黑榜耻辱柱
          </h1>
          <p className="pubg-subtitle">本周反面教材排行榜</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pubg-muted" />
            <input
              type="text"
              placeholder="搜索玩家..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-pubg-dark/50 border border-pubg-border rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-pubg-muted focus:outline-none focus:border-pubg-orange/50 transition-colors w-48"
            />
          </div>
          <WeekSelector value={selectedWeek} onChange={handleWeekChange} />
        </div>
      </div>

      {/* 加载状态 */}
      {boardLoading && (
        <div className="pubg-card text-center py-16">
          <div className="animate-pulse text-pubg-muted text-lg">榜单数据加载中...</div>
        </div>
      )}

      {/* 榜单内容 */}
      {!boardLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => {
            const entries = filterEntries(blackBoard?.boards?.[cat.key] || [])
            return (
              <div key={cat.key}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-pubg-dark/60 border border-pubg-border flex items-center justify-center">
                    <cat.icon className={`w-5 h-5 ${cat.color}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{cat.key}</h2>
                    <p className="text-xs text-pubg-muted">{cat.desc}</p>
                  </div>
                </div>
                <RankTable entries={entries} />
                {entries.length === 0 && (
                  <div className="pubg-card text-center py-8 text-pubg-muted text-sm">
                    暂无数据
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
