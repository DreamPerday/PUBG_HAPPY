import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target,
  Zap,
  Trophy,
  Crosshair,
  Clock,
  TrendingUp,
  Users,
  Skull,
  Crown,
  Swords,
  Map,
  LogOut,
  ChevronDown,
  Upload,
  X,
  Check,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { getPlayerStats, getPlayerMatches, getTeammates, getSeasonStats, getMatchDamage, type MatchDamageEntry, type SeasonStats } from '@/api/playerApi'
import api from '@/api'
import Chart from '@/components/Chart'
import StatCard from '@/components/StatCard'
import { getUserTeams, type TeamDetail } from '@/api/teamApi'
import type { PlayerStatsDetail, MatchPage, Match, Teammate } from '@/types'

export default function ProfilePage() {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)
  const logout = useStore((s) => s.logout)

  const [loading, setLoading] = useState(true)
  const [statsDetail, setStatsDetail] = useState<PlayerStatsDetail | null>(null)
  const [matches, setMatches] = useState<MatchPage | null>(null)
  const [matchPageMatches, setMatchPageMatches] = useState<Match[]>([])
  const [weekStats, setWeekStats] = useState<{
    totalKills: number
    totalDamage: number
    totalWins: number
    totalMatches: number
    avgKills: number
  } | null>(null)
  const [teams, setTeams] = useState<TeamDetail[]>([])
  const [seasonStats, setSeasonStats] = useState<SeasonStats | null>(null)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'teams'>('overview')
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
  const [teammatesMap, setTeammatesMap] = useState<Record<string, Teammate[]>>({})
  const [loadingTeammates, setLoadingTeammates] = useState<Record<string, boolean>>({})
  const [damageMap, setDamageMap] = useState<Record<string, MatchDamageEntry[]>>({})
  const [showDamageMap, setShowDamageMap] = useState<Record<string, boolean>>({})
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showAvatarUploader, setShowAvatarUploader] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!currentUser) return
    setLoading(true)
    Promise.all([
      getPlayerStats(currentUser.id).catch(() => null),
      getPlayerMatches(currentUser.id, 1, 100, 7).catch(() => null),
      getUserTeams(currentUser.id).catch(() => null),
      getSeasonStats(currentUser.pubgId).catch(() => null),
    ])
      .then(([statsData, matchData, teamData, seasonData]: any[]) => {
        setStatsDetail(statsData)
        setSeasonStats(seasonData)
        setMatches(matchData)
        setTeams(teamData || [])
        // 用7天数据计算周统计
        const weekMatches = matchData?.data || []
        const totalMatches = weekMatches.length
        const totalKills = weekMatches.reduce((sum: number, m: Match) => sum + m.kills, 0)
        const totalDamage = weekMatches.reduce((sum: number, m: Match) => sum + m.damage, 0)
        const totalWins = weekMatches.filter((m: Match) => m.won).length
        const avgKills = totalMatches > 0 ? +(totalKills / totalMatches).toFixed(1) : 0
        setWeekStats({ totalKills, totalDamage, totalWins, totalMatches, avgKills })
      })
      .catch(() => { /* 单个 API 已各自处理错误 */ })
      .finally(() => setLoading(false))
  }, [currentUser])

  // 分页获取比赛记录（"比赛记录"Tab用）
  useEffect(() => {
    if (!currentUser) return
    getPlayerMatches(currentUser.id, page, 20).then((data) => {
      if (page === 1) {
        setMatchPageMatches(data?.data || [])
      } else {
        setMatchPageMatches((prev) => [...prev, ...(data?.data || [])])
      }
      setMatches(data)
    })
  }, [currentUser, page])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setAvatarPreview(result)
      setShowAvatarUploader(true)
    }
    reader.readAsDataURL(file)
  }

  const handleUploadAvatar = async () => {
    if (!avatarPreview || !currentUser) return

    setUploadingAvatar(true)
    try {
      await api.patch(`/players/${currentUser.id}/avatar`, { avatar: avatarPreview })
      useStore.getState().updateUser({ ...currentUser, avatar: avatarPreview })
      setShowAvatarUploader(false)
      setAvatarPreview(null)
      alert('头像上传成功！')
    } catch (error) {
      alert('头像上传失败，请重试')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const cancelUpload = () => {
    setShowAvatarUploader(false)
    setAvatarPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!currentUser) return null

  const s = statsDetail?.stats
  const recentTrend = statsDetail?.recentTrend || []
  const headshotRate =
    s && s.totalKills > 0 ? ((s.totalHeadshots / s.totalKills) * 100).toFixed(1) : '0.0'

  const lineChartData = useMemo(() => {
    const reversed = [...recentTrend].reverse()
    return {
      categories: reversed.map((_, i) => `#${i + 1}`),
      series: [{ name: '击杀数', data: reversed.map((m) => m.kills) }],
    }
  }, [recentTrend])

  const barChartData = useMemo(() => {
    const reversed = [...recentTrend].reverse()
    return {
      categories: reversed.map((_, i) => `#${i + 1}`),
      series: [
        { name: '击杀数', data: reversed.map((m) => m.kills) },
        { name: '伤害', data: reversed.map((m) => Math.round(m.damage)) },
      ],
    }
  }, [recentTrend])

  const radarChartData = useMemo(() => ({
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
  }), [s, headshotRate])

  const rankDistribution = useMemo(() => {
    const matches30 = [...recentTrend].reverse().slice(-30)
    if (matches30.length === 0) return null

    const dist = { '吃鸡': 0, '前10': 0, '前25': 0, '前50': 0, '其他': 0 }
    matches30.forEach((m: any) => {
      if (m.won || m.rank === 1) dist['吃鸡']++
      else if (m.rank <= 10) dist['前10']++
      else if (m.rank <= 25) dist['前25']++
      else if (m.rank <= 50) dist['前50']++
      else dist['其他']++
    })

    const data = Object.entries(dist)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name: `${name} (${value})`, value }))

    return { data }
  }, [recentTrend])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
        <span className="text-pubg-muted text-lg">数据加载中...</span>
      </div>
    )
  }

  const matchList = matchPageMatches

  const toggleExpand = async (matchId: string) => {
    if (expandedMatch === matchId) {
      setExpandedMatch(null)
      return
    }
    setExpandedMatch(matchId)
    if (!teammatesMap[matchId] && currentUser) {
      setLoadingTeammates((prev) => ({ ...prev, [matchId]: true }))
      try {
        const data = await getTeammates(matchId, currentUser.pubgId)
        setTeammatesMap((prev) => ({ ...prev, [matchId]: data }))
      } catch {
        setTeammatesMap((prev) => ({ ...prev, [matchId]: [] }))
      } finally {
        setLoadingTeammates((prev) => ({ ...prev, [matchId]: false }))
      }
    }
    if (!damageMap[matchId]) {
      try {
        const damageData = await getMatchDamage(matchId)
        setDamageMap((prev) => ({ ...prev, [matchId]: damageData }))
      } catch { /* ignore */ }
    }
  }

  return (
    <>
    <div className="space-y-4 sm:space-y-6">
      {/* 页面标题 & 退出登录 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="pubg-title mb-1">个人战绩</h1>
          <p className="pubg-subtitle">你的PUBG战斗数据总览</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-pubg-muted hover:text-pubg-red hover:bg-pubg-red/10 transition-all border border-pubg-border hover:border-pubg-red/30 text-xs sm:text-sm touch-btn"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">退出登录</span>
        </button>
      </div>

      {/* 个人信息卡片 */}
      <div className="pubg-card">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-pubg-orange/30 to-pubg-orange/10 flex items-center justify-center text-3xl sm:text-4xl font-black text-pubg-orange border border-pubg-orange/30">
              {currentUser.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.nickname}
                  className="w-full h-full object-cover"
                />
              ) : (
                currentUser.nickname[0]
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 bg-pubg-orange rounded-full flex items-center justify-center text-black hover:bg-pubg-yellow transition-colors border-2 border-pubg-card shadow-lg"
              title="上传头像"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-black text-white">{currentUser.nickname}</h1>
              <span className="px-2 sm:px-3 py-0.5 sm:py-1 text-xs bg-pubg-orange/20 text-pubg-orange rounded-full font-medium border border-pubg-orange/30">
                已认证
              </span>
            </div>
            <p className="text-pubg-muted text-xs sm:text-sm mb-2 sm:mb-3">PUBG ID: {currentUser.pubgId}</p>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs bg-pubg-orange/20 text-pubg-orange px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium">
                <Target className="w-3.5 h-3.5" />
                KDA {s?.kda?.toFixed(2) || '0.00'}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-pubg-green/20 text-pubg-green px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium">
                <TrendingUp className="w-3.5 h-3.5" />
                胜率 {((s?.winRate || 0) * 100).toFixed(1)}%
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-pubg-blue/20 text-pubg-blue px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium">
                <Crosshair className="w-3.5 h-3.5" />
                爆头率 {headshotRate}%
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-purple-500/20 text-purple-400 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-medium">
                <Users className="w-3.5 h-3.5" />
                {teams.length} 个车队
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 bg-pubg-card rounded-xl p-1 border border-pubg-border">
        {([
          { key: 'overview' as const, label: '数据概览', icon: Target },
          { key: 'matches' as const, label: '比赛记录', icon: Clock },
          { key: 'teams' as const, label: '我的车队', icon: Users },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 sm:py-3 rounded-lg text-xs sm:text-sm font-medium transition-all touch-btn ${
              activeTab === tab.key
                ? 'bg-pubg-orange text-black'
                : 'text-pubg-muted hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 数据概览 Tab ===== */}
      {activeTab === 'overview' && (
        <>
          {/* 6 个核心统计卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <StatCard title="总场次" value={seasonStats?.roundsPlayed || 0} icon={Crosshair} color="blue" trend="累计对战" />
            <StatCard title="总击杀" value={seasonStats?.kills || 0} icon={Target} color="red" trend="火力凶猛" />
            <StatCard title="总伤害" value={Math.round(seasonStats?.damageDealt || 0)} icon={Zap} color="orange" trend="伤害输出" />
            <StatCard title="吃鸡次数" value={seasonStats?.wins || 0} icon={Trophy} color="green" trend="大吉大利" />
            <StatCard title="场均击杀" value={(seasonStats?.avgKills || 0).toFixed(1)} icon={Skull} color="orange" trend="平均水平" />
            <StatCard title="最佳排名" value={`#${seasonStats?.bestRank || '-'}`} icon={Crown} color="orange" trend="历史最佳" />
          </div>

          {/* 最近7天表现 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-pubg-orange" />
              <h2 className="text-base sm:text-lg font-bold text-white">最近7天表现</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <StatCard title="场次" value={weekStats?.totalMatches || 0} icon={Crosshair} color="blue" trend="近7天" />
              <StatCard title="总击杀" value={weekStats?.totalKills || 0} icon={Target} color="red" trend="近7天" />
              <StatCard title="总伤害" value={Math.round(weekStats?.totalDamage || 0)} icon={Zap} color="orange" trend="近7天" />
              <StatCard title="场均击杀" value={weekStats?.avgKills?.toFixed(1) || '0'} icon={Skull} color="orange" trend="近7天" />
            </div>
          </div>

          {/* 图表区 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 pubg-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-pubg-orange" />
                <h2 className="text-base sm:text-lg font-bold text-white">近30场击杀趋势</h2>
              </div>
              <Chart type="line" data={lineChartData} height={220} />
            </div>
            <div className="pubg-card">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-pubg-orange" />
                <h2 className="text-base sm:text-lg font-bold text-white">综合能力雷达</h2>
              </div>
              <Chart type="radar" data={radarChartData} height={220} />
            </div>
          </div>

          {/* 击杀 vs 伤害 & 排名分布 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="pubg-card">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="w-5 h-5 text-pubg-orange" />
                <h2 className="text-base sm:text-lg font-bold text-white">击杀 vs 伤害（近30场）</h2>
              </div>
              <Chart type="bar" data={barChartData} height={220} />
            </div>
            <div className="pubg-card">
              <div className="flex items-center gap-2 mb-4">
                <Map className="w-5 h-5 text-pubg-orange" />
                <h2 className="text-base sm:text-lg font-bold text-white">排名分布（近30场）</h2>
              </div>
              {rankDistribution ? (
                <Chart type="pie" data={{ ...rankDistribution, colors: ['#ffd700', '#ff9500', '#3b82f6', '#22c55e', '#6b7280'] }} height={220} />
              ) : (
                <div className="flex items-center justify-center h-[220px] text-pubg-muted">
                  暂无比赛数据
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ===== 比赛记录 Tab ===== */}
      {activeTab === 'matches' && (
        <div>
          <div className="space-y-2">
            {matchList.length === 0 && (
              <div className="pubg-card text-center py-8 sm:py-12">
                <Skull className="w-12 h-12 mx-auto mb-3 text-pubg-muted opacity-40" />
                <p className="text-pubg-muted">暂无比赛记录</p>
              </div>
            )}
            {matchList.map((match: Match) => (
              <div key={match.id}>
                <div
                  onClick={() => toggleExpand(match.matchId)}
                  className="pubg-card py-3 px-4 sm:px-5 flex items-center justify-between hover:border-pubg-orange/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 sm:gap-5">
                    {/* 排名 */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        match.won
                          ? 'bg-pubg-green/20 text-pubg-green'
                          : match.rank <= 5
                            ? 'bg-pubg-orange/20 text-pubg-orange'
                            : match.rank <= 10
                              ? 'bg-pubg-blue/20 text-pubg-blue'
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
                      <div className="text-xs sm:text-sm text-white font-medium">{match.mapName}</div>
                      <div className="text-xs text-pubg-muted">{match.mode}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:gap-6">
                    <div className="text-center">
                      <div className="text-sm font-bold text-pubg-orange">{match.kills}</div>
                      <div className="text-xs text-pubg-muted">击杀</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-bold text-white">{Math.round(match.damage)}</div>
                      <div className="text-xs text-pubg-muted">伤害</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-sm font-bold text-pubg-muted">{match.assists}</div>
                      <div className="text-xs text-pubg-muted">助攻</div>
                    </div>
                    <div className="text-center hidden sm:block">
                      <div className="text-sm font-bold text-green-400">{match.revives || 0}</div>
                      <div className="text-xs text-pubg-muted">救援</div>
                    </div>
                    <div className="text-xs text-pubg-muted w-16 sm:w-20 text-right">
                      {new Date(match.playedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-pubg-muted transition-transform shrink-0 ${expandedMatch === match.matchId ? 'rotate-180' : ''}`} />
                  </div>
                </div>
                {/* 展开的队友数据 */}
                {expandedMatch === match.matchId && (
                  <>
                  <div className="pubg-card mt-1 p-4 sm:p-5 border-t border-pubg-border/50">
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
                          <div key={tm.pubgId} className="flex items-center justify-between bg-pubg-dark rounded-lg px-3 sm:px-4 py-2">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-7 h-7 rounded-full bg-pubg-orange/20 flex items-center justify-center text-xs font-bold text-pubg-orange">
                                {tm.nickname[0]}
                              </div>
                              <span className="text-xs sm:text-sm text-white">{tm.nickname}</span>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 text-xs">
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
                  {/* 全场伤害排行 */}
                  <div className="mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDamageMap((prev) => ({ ...prev, [match.matchId]: !prev[match.matchId] })) }}
                      className="text-xs text-pubg-muted hover:text-pubg-orange transition-colors flex items-center gap-1 touch-btn"
                    >
                      <Zap className="w-3 h-3" />查看全场伤害排行
                    </button>
                    {showDamageMap[match.matchId] && (
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {(damageMap[match.matchId] || []).map((p, idx) => (
                          <div key={p.name} className="flex items-center justify-between bg-pubg-dark/50 rounded px-3 py-1.5 text-xs">
                            <span className="text-pubg-muted w-6">{idx + 1}</span>
                            <span className="text-white flex-1">{p.name}</span>
                            <span className="text-pubg-orange font-bold w-14 sm:w-16 text-right">{Math.round(p.damage)}</span>
                            <span className="text-pubg-muted w-8 sm:w-10 text-right">{p.kills}击杀</span>
                            <span className="text-pubg-muted w-6 sm:w-8 text-right">#{p.rank}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* 加载更多 */}
          {matches && matches.page < matches.totalPages && (
            <div className="flex justify-center mt-4 sm:mt-6">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-4 sm:px-6 py-2 rounded-lg bg-pubg-card border border-pubg-border text-pubg-muted hover:border-pubg-orange hover:text-pubg-orange transition-colors text-xs sm:text-sm font-medium touch-btn"
              >
                加载更多
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== 我的车队 Tab ===== */}
      {activeTab === 'teams' && (
        <div className="space-y-3 sm:space-y-4">
          {teams.length === 0 && (
            <div className="pubg-card text-center py-8 sm:py-12">
              <Users className="w-12 h-12 mx-auto mb-3 text-pubg-muted opacity-40" />
              <p className="text-pubg-muted text-base sm:text-lg mb-2">暂未加入任何车队</p>
              <p className="text-sm text-pubg-muted/60">与其他玩家组队比赛后会自动检测并创建车队</p>
            </div>
          )}
          {teams.map((team) => (
            <div
              key={team.id}
              className="pubg-card hover:border-pubg-orange/50 transition-all cursor-pointer"
              onClick={() => navigate(`/team/${team.id}`)}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-pubg-orange/20 flex items-center justify-center">
                    <Users className="w-5 h-5 sm:w-6 sm:h-6 text-pubg-orange" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-white">{team.name}</h3>
                    <p className="text-xs text-pubg-muted">
                      {team.members?.length || 0} 名成员
                    </p>
                  </div>
                </div>
                <button className="text-xs sm:text-sm text-pubg-orange hover:text-pubg-orange/80 font-medium touch-btn">
                  查看详情 →
                </button>
              </div>

              {/* 成员列表 */}
              <div className="flex flex-wrap gap-2">
                {team.members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-pubg-dark border border-pubg-border"
                  >
                    <div className="w-6 h-6 rounded-full bg-pubg-orange/20 flex items-center justify-center text-xs font-bold text-pubg-orange">
                      {member.user.avatar ? (
                        <img
                          src={member.user.avatar}
                          alt={member.user.nickname}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        member.user.nickname[0]
                      )}
                    </div>
                    <span className={`text-xs sm:text-sm font-medium ${member.user.id === currentUser.id ? 'text-pubg-orange' : 'text-white'}`}>
                      {member.user.nickname}
                      {member.user.id === currentUser.id && ' (我)'}
                    </span>
                    <span className="text-xs text-pubg-muted">{member.matchCount}场</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

        {/* 头像上传确认弹窗 */}
        {showAvatarUploader && avatarPreview && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-pubg-card border border-pubg-border rounded-xl p-6 max-w-sm w-full">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white mb-2">确认上传头像</h3>
                <p className="text-sm text-pubg-muted">预览效果：</p>
              </div>
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-pubg-orange">
                  <img
                    src={avatarPreview}
                    alt="预览"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={cancelUpload}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-pubg-border text-pubg-muted hover:text-white hover:border-pubg-orange transition-colors"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
                <button
                  onClick={handleUploadAvatar}
                  disabled={uploadingAvatar}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-pubg-orange text-black font-bold hover:bg-pubg-yellow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingAvatar ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {uploadingAvatar ? '上传中...' : '确认上传'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
