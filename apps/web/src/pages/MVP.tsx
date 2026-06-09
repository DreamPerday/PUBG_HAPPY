import { useEffect, useState } from 'react'
import { Crown, Star, Medal, Trophy } from 'lucide-react'
import { useStore } from '@/store/useStore'
import WeekSelector, { getWeekNumber } from '@/components/WeekSelector'
import Chart from '@/components/Chart'

const medalColors = ['text-pubg-yellow', 'text-gray-300', 'text-amber-600']

export default function MVP() {
  const state = useStore()
  const { mvpBoard, boardWeek, boardLoading } = state
  const [selectedWeek, setSelectedWeek] = useState(boardWeek || getWeekNumber())

  useEffect(() => {
    state.fetchBoards(selectedWeek)
  }, [selectedWeek])

  useEffect(() => {
    if (boardWeek && boardWeek !== selectedWeek) {
      setSelectedWeek(boardWeek)
    }
  }, [boardWeek])

  const handleWeekChange = (week: string) => {
    setSelectedWeek(week)
  }

  if (boardLoading && !mvpBoard) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-pubg-muted text-lg">数据加载中...</span>
      </div>
    )
  }

  const entries = mvpBoard?.entries || []
  const champion = entries[0]
  const top10 = entries.slice(0, 10)

  const chartData = {
    categories: top10.map((e) => e.user.nickname),
    series: [{ name: 'MVP积分', data: top10.map((e) => Math.round(e.score)) }],
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="pubg-title mb-1 flex items-center gap-3">
            <Crown className="w-8 h-8 text-pubg-yellow" />
            MVP殿堂
          </h1>
          <p className="pubg-subtitle">综合评分最强王者</p>
        </div>
        <WeekSelector value={selectedWeek} onChange={handleWeekChange} />
      </div>

      {/* MVP冠军 */}
      {champion && (
        <div className="pubg-card text-center py-12 relative overflow-hidden animate-glow">
          <div className="absolute inset-0 bg-gradient-to-b from-pubg-yellow/10 to-transparent" />
          <div className="relative z-10">
            {champion.user.avatar ? (
              <img
                src={champion.user.avatar}
                alt={champion.user.nickname}
                className="w-24 h-24 mx-auto rounded-full border-4 border-pubg-yellow/50 object-cover mb-4"
              />
            ) : (
              <div className="w-24 h-24 mx-auto rounded-full bg-pubg-yellow/20 flex items-center justify-center text-4xl font-black text-pubg-yellow mb-4">
                {champion.user.nickname[0]}
              </div>
            )}
            <h2 className="text-3xl font-black text-white mb-2">{champion.user.nickname}</h2>
            <div className="flex items-center justify-center gap-2 mb-4">
              <Star className="w-5 h-5 text-pubg-yellow fill-pubg-yellow" />
              <span className="text-2xl font-bold text-pubg-yellow">{Math.round(champion.score)}</span>
              <span className="text-pubg-muted">MVP积分</span>
            </div>
            <p className="text-pubg-muted">本周综合表现最强的选手</p>
          </div>
        </div>
      )}

      {/* Top 10 柱状图 */}
      {top10.length > 0 && (
        <div className="pubg-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-pubg-yellow" />
            <h2 className="text-lg font-bold text-white">MVP积分 TOP 10</h2>
          </div>
          <Chart type="bar" data={chartData} height={320} />
        </div>
      )}

      {/* 排名表格 */}
      {entries.length > 0 && (
        <div className="pubg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pubg-border">
                  <th className="text-left py-3 px-4 text-pubg-muted text-sm font-medium">排名</th>
                  <th className="text-left py-3 px-4 text-pubg-muted text-sm font-medium">玩家</th>
                  <th className="text-right py-3 px-4 text-pubg-muted text-sm font-medium">MVP积分</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    className="border-b border-pubg-border/50 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4">
                      {index < 3 ? (
                        <Medal className={`w-5 h-5 ${medalColors[index]}`} />
                      ) : (
                        <span className="text-pubg-muted text-sm">{index + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {entry.user.avatar ? (
                          <img
                            src={entry.user.avatar}
                            alt={entry.user.nickname}
                            className="w-8 h-8 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-pubg-orange/20 flex items-center justify-center text-sm font-bold text-pubg-orange">
                            {entry.user.nickname[0]}
                          </div>
                        )}
                        <span className="text-white font-medium">{entry.user.nickname}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-pubg-orange font-bold">
                        {Math.round(entry.score)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
