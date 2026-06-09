import { useEffect, useMemo } from 'react'
import { Star, Trophy, Target, Zap, Crown, Medal } from 'lucide-react'
import Chart from '@/components/Chart'
import { useStore } from '@/store/useStore'

export default function Hall() {
  const players = useStore((state) => state.players)
  const loading = useStore((state) => state.playersLoading)
  const fetchPlayers = useStore((state) => state.fetchPlayers)

  useEffect(() => {
    fetchPlayers()
  }, [fetchPlayers])

  const legends = useMemo(() => {
    const withStats = players.filter((p) => p.stats)
    if (!withStats.length) return { mostKills: null, mostWins: null, mostDamage: null }

    const byKills = withStats.reduce((best, p) =>
      p.stats!.totalKills > (best?.stats?.totalKills || 0) ? p : best, withStats[0])
    const byWins = withStats.reduce((best, p) =>
      p.stats!.totalWins > (best?.stats?.totalWins || 0) ? p : best, withStats[0])
    const byDamage = withStats.reduce((best, p) =>
      p.stats!.totalDamage > (best?.stats?.totalDamage || 0) ? p : best, withStats[0])

    return { mostKills: byKills, mostWins: byWins, mostDamage: byDamage }
  }, [players])

  const rankedPlayers = useMemo(() => {
    return [...players]
      .filter((p) => p.stats)
      .sort((a, b) => (b.stats?.totalKills || 0) - (a.stats?.totalKills || 0))
  }, [players])

  const pieData = useMemo(() => {
    return players
      .filter((p) => p.stats && p.stats.totalKills > 0)
      .map((p) => ({ name: p.nickname, value: p.stats!.totalKills }))
  }, [players])

  const barData = useMemo(() => {
    const withStats = players.filter((p) => p.stats)
    return {
      categories: withStats.map((p) => p.nickname),
      series: [
        { name: '击杀', data: withStats.map((p) => p.stats!.totalKills) },
        { name: '伤害', data: withStats.map((p) => Math.round(p.stats!.totalDamage)) },
        { name: '胜利', data: withStats.map((p) => p.stats!.totalWins) },
      ],
    }
  }, [players])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="loading-spinner" />
          <span className="text-pubg-muted text-sm">数据加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="pubg-title mb-1 flex items-center gap-2 sm:gap-3">
            <Star className="w-6 sm:w-8 h-6 sm:h-8 text-pubg-yellow fill-pubg-yellow" />
            名人堂
          </h1>
          <p className="pubg-subtitle">车队传奇荣誉殿堂</p>
        </div>
        <Trophy className="w-5 sm:w-6 h-5 sm:h-6 text-pubg-yellow" />
      </div>

      {/* 三大传奇卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* 击杀传奇 */}
        <div className="pubg-card card-glow text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-pubg-red/10 to-transparent" />
          <div className="relative">
            <div className="w-10 sm:w-12 h-10 sm:h-12 mx-auto rounded-full bg-pubg-red/20 flex items-center justify-center mb-2 sm:mb-3">
              <Target className="w-5 sm:w-6 h-5 sm:h-6 text-pubg-red" />
            </div>
            <h3 className="text-xs sm:text-sm text-pubg-muted mb-1">击杀传奇</h3>
            {legends.mostKills ? (
              <>
                <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto rounded-full bg-pubg-orange/20 flex items-center justify-center text-xl sm:text-2xl font-black text-pubg-orange mb-2 sm:mb-3">
                  {legends.mostKills.nickname[0]}
                </div>
                <p className="text-white font-bold text-sm sm:text-lg">{legends.mostKills.nickname}</p>
                <p className="text-2xl sm:text-3xl font-black text-pubg-red mt-1 sm:mt-2 tabular-nums">
                  {legends.mostKills.stats!.totalKills}
                </p>
                <p className="text-xs text-pubg-muted mt-1">总击杀</p>
              </>
            ) : (
              <p className="text-pubg-muted text-sm py-4 sm:py-6">暂无数据</p>
            )}
          </div>
        </div>

        {/* 吃鸡传奇 */}
        <div className="pubg-card card-glow text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-pubg-yellow/10 to-transparent" />
          <div className="relative">
            <div className="w-10 sm:w-12 h-10 sm:h-12 mx-auto rounded-full bg-pubg-yellow/20 flex items-center justify-center mb-2 sm:mb-3">
              <Crown className="w-5 sm:w-6 h-5 sm:h-6 text-pubg-yellow" />
            </div>
            <h3 className="text-xs sm:text-sm text-pubg-muted mb-1">吃鸡传奇</h3>
            {legends.mostWins ? (
              <>
                <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto rounded-full bg-pubg-orange/20 flex items-center justify-center text-xl sm:text-2xl font-black text-pubg-orange mb-2 sm:mb-3">
                  {legends.mostWins.nickname[0]}
                </div>
                <p className="text-white font-bold text-sm sm:text-lg">{legends.mostWins.nickname}</p>
                <p className="text-2xl sm:text-3xl font-black text-pubg-yellow mt-1 sm:mt-2 tabular-nums">
                  {legends.mostWins.stats!.totalWins}
                </p>
                <p className="text-xs text-pubg-muted mt-1">总吃鸡</p>
              </>
            ) : (
              <p className="text-pubg-muted text-sm py-4 sm:py-6">暂无数据</p>
            )}
          </div>
        </div>

        {/* 伤害传奇 */}
        <div className="pubg-card card-glow text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-pubg-orange/10 to-transparent" />
          <div className="relative">
            <div className="w-10 sm:w-12 h-10 sm:h-12 mx-auto rounded-full bg-pubg-orange/20 flex items-center justify-center mb-2 sm:mb-3">
              <Zap className="w-5 sm:w-6 h-5 sm:h-6 text-pubg-orange" />
            </div>
            <h3 className="text-xs sm:text-sm text-pubg-muted mb-1">伤害传奇</h3>
            {legends.mostDamage ? (
              <>
                <div className="w-12 sm:w-16 h-12 sm:h-16 mx-auto rounded-full bg-pubg-orange/20 flex items-center justify-center text-xl sm:text-2xl font-black text-pubg-orange mb-2 sm:mb-3">
                  {legends.mostDamage.nickname[0]}
                </div>
                <p className="text-white font-bold text-sm sm:text-lg">{legends.mostDamage.nickname}</p>
                <p className="text-2xl sm:text-3xl font-black text-pubg-orange mt-1 sm:mt-2 tabular-nums">
                  {Math.round(legends.mostDamage.stats!.totalDamage)}
                </p>
                <p className="text-xs text-pubg-muted mt-1">总伤害</p>
              </>
            ) : (
              <p className="text-pubg-muted text-sm py-4 sm:py-6">暂无数据</p>
            )}
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* 击杀分布饼图 */}
        <div className="pubg-card">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4">击杀分布</h2>
          {pieData.length > 0 ? (
            <Chart type="pie" data={{ data: pieData }} height={220} />
          ) : (
            <div className="flex items-center justify-center h-[220px] text-pubg-muted text-sm">暂无数据</div>
          )}
        </div>

        {/* 数据对比柱状图 */}
        <div className="pubg-card">
          <h2 className="text-base sm:text-lg font-bold text-white mb-4">数据对比</h2>
          {barData.categories.length > 0 ? (
            <Chart type="bar" data={barData} height={220} />
          ) : (
            <div className="flex items-center justify-center h-[220px] text-pubg-muted text-sm">暂无数据</div>
          )}
        </div>
      </div>

      {/* 全员排名列表 */}
      <div className="pubg-card">
        <h2 className="text-base sm:text-lg font-bold text-white mb-4">全员排名</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-pubg-border">
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">排名</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">玩家</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">击杀</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">伤害</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">胜利</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">场次</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">KDA</th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((player, index) => (
                <tr
                  key={player.id}
                  className="border-b border-pubg-border/50 hover:bg-white/5 transition-colors"
                >
                  <td className="py-2 sm:py-3 px-3 sm:px-4">
                    {index === 0 ? (
                      <span className="text-base sm:text-lg">🥇</span>
                    ) : index === 1 ? (
                      <span className="text-base sm:text-lg">🥈</span>
                    ) : index === 2 ? (
                      <span className="text-base sm:text-lg">🥉</span>
                    ) : (
                      <span className="text-xs sm:text-sm text-pubg-muted font-mono">#{index + 1}</span>
                    )}
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-pubg-orange/20 flex items-center justify-center text-sm font-bold text-pubg-orange flex-shrink-0">
                        {player.nickname[0]}
                      </div>
                      <div>
                        <span className="text-white font-medium text-xs sm:text-sm">{player.nickname}</span>
                        {index < 3 && (
                          <Medal
                            className={`inline-block ml-1 sm:ml-2 w-3 sm:w-4 h-3 sm:h-4 ${
                              index === 0
                                ? 'text-pubg-yellow'
                                : index === 1
                                  ? 'text-pubg-muted'
                                  : 'text-pubg-orange'
                            }`}
                          />
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4 text-right">
                    <span className="text-pubg-orange font-bold text-xs sm:text-sm tabular-nums">
                      {player.stats!.totalKills}
                    </span>
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4 text-right">
                    <span className="text-pubg-text text-xs sm:text-sm tabular-nums">
                      {Math.round(player.stats!.totalDamage)}
                    </span>
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4 text-right">
                    <span className="text-pubg-green font-semibold text-xs sm:text-sm tabular-nums">
                      {player.stats!.totalWins}
                    </span>
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4 text-right">
                    <span className="text-pubg-muted text-xs sm:text-sm tabular-nums">
                      {player.stats!.totalMatches}
                    </span>
                  </td>
                  <td className="py-2 sm:py-3 px-3 sm:px-4 text-right">
                    <span className="text-pubg-yellow font-bold text-xs sm:text-sm tabular-nums">
                      {player.stats!.kda.toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rankedPlayers.length === 0 && (
            <div className="flex items-center justify-center py-8 sm:py-12 text-pubg-muted text-sm">
              暂无排名数据
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
