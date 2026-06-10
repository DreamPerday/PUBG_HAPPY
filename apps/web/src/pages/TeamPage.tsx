import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Users,
  Crosshair,
  Trophy,
  TrendingUp,
  Target,
  Zap,
  Skull,
  Crown,
  ArrowLeft,
  Swords,
  Medal,
  ChevronRight,
} from 'lucide-react'
import { getTeam, getTeams, getTeamStats, getTeamMatchups, getAllTeamStats, type TeamDetail, type TeamStats, type Team, type TeamComparison, type TeamMatchupItem } from '@/api/teamApi'
import Chart from '@/components/Chart'
import StatCard from '@/components/StatCard'
import { useStore } from '@/store/useStore'

/** 车队列表页 */
function TeamListView() {
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [comparison, setComparison] = useState<TeamComparison | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getTeams(),
      getAllTeamStats(),
    ])
      .then(([teamData, compData]) => {
        setTeams(teamData)
        setComparison(compData)
      })
      .finally(() => setLoading(false))
  }, [])

  const comparisonChartData = comparison?.teams?.length
    ? {
        categories: comparison.teams.map((t) => t.teamName),
        series: [
          { name: '总击杀', data: comparison.teams.map((t) => t.totalKills) },
          { name: '总伤害', data: comparison.teams.map((t) => t.totalDamage) },
        ],
      }
    : null

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
        <span className="text-pubg-muted text-lg">加载车队列表...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="pubg-title mb-1">车队状况</h1>
        <p className="pubg-subtitle">所有动态检测到的车队信息总览</p>
      </div>

      {teams.length === 0 && (
        <div className="pubg-card text-center py-16">
          <Users className="w-16 h-16 mx-auto mb-4 text-pubg-muted opacity-30" />
          <p className="text-pubg-muted text-lg mb-2">暂无车队数据</p>
          <p className="text-sm text-pubg-muted/60">
            系统会自动检测在同一场比赛中出现≥2名注册用户的情况并创建车队
          </p>
        </div>
      )}

      {/* 车队对比排行 */}
      {comparison && comparison.teams.length > 0 && (
        <>
          {/* 最佳/最黑车队卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {comparison.bestTeam && (
              <div className="pubg-card border-pubg-green/50 bg-gradient-to-br from-pubg-green/5 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="w-5 h-5 text-pubg-green" />
                  <h3 className="text-sm font-bold text-pubg-green">最佳车队（击杀）</h3>
                </div>
                <p className="text-white font-bold text-lg truncate">{comparison.bestTeam.teamName}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-pubg-muted">{comparison.bestTeam.totalKills} 击杀</span>
                  <span className="text-pubg-muted">{comparison.bestTeam.totalWins} 吃鸡</span>
                </div>
              </div>
            )}
            {comparison.bestWinTeam && comparison.bestWinTeam.teamId !== comparison.bestTeam?.teamId && (
              <div className="pubg-card border-pubg-yellow/50 bg-gradient-to-br from-pubg-yellow/5 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <Crown className="w-5 h-5 text-pubg-yellow" />
                  <h3 className="text-sm font-bold text-pubg-yellow">最佳车队（吃鸡）</h3>
                </div>
                <p className="text-white font-bold text-lg truncate">{comparison.bestWinTeam.teamName}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-pubg-muted">{comparison.bestWinTeam.totalWins} 吃鸡</span>
                  <span className="text-pubg-muted">{comparison.bestWinTeam.totalKills} 击杀</span>
                </div>
              </div>
            )}
            {comparison.worstTeam && (
              <div className="pubg-card border-pubg-red/50 bg-gradient-to-br from-pubg-red/5 to-transparent">
                <div className="flex items-center gap-2 mb-3">
                  <Skull className="w-5 h-5 text-pubg-red" />
                  <h3 className="text-sm font-bold text-pubg-red">最黑车队</h3>
                </div>
                <p className="text-white font-bold text-lg truncate">{comparison.worstTeam.teamName}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-pubg-muted">{comparison.worstTeam.totalKills} 击杀</span>
                  <span className="text-pubg-muted">{comparison.worstTeam.totalWins} 吃鸡</span>
                </div>
              </div>
            )}
          </div>

          {/* 车队数据对比柱状图 */}
          {comparisonChartData && comparison.teams.length > 1 && (
            <div className="pubg-card">
              <div className="flex items-center gap-2 mb-4">
                <Swords className="w-5 h-5 text-pubg-orange" />
                <h2 className="text-lg font-bold text-white">车队数据对比</h2>
              </div>
              <Chart type="bar" data={comparisonChartData} height={280} />
            </div>
          )}
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            onClick={() => navigate(`/team/${team.id}`)}
            className="pubg-card hover:border-pubg-orange/50 hover:scale-[1.02] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pubg-orange/30 to-pubg-orange/10 flex items-center justify-center border border-pubg-orange/30">
                <Users className="w-7 h-7 text-pubg-orange" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white group-hover:text-pubg-orange transition-colors truncate">
                  {team.name}
                </h3>
                <p className="text-xs text-pubg-muted">
                  {team._count?.members || 0} 名成员
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-pubg-muted group-hover:text-pubg-orange transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** 车队详情页 */
function TeamDetailView({ teamId }: { teamId: string }) {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)

  const [loading, setLoading] = useState(true)
  const [team, setTeam] = useState<TeamDetail | null>(null)
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [matchups, setMatchups] = useState<TeamMatchupItem[]>([])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getTeam(teamId),
      getTeamStats(teamId),
      getTeamMatchups(teamId),
    ])
      .then(([teamData, statsData, matchupData]) => {
        setTeam(teamData)
        setTeamStats(statsData)
        setMatchups(matchupData || [])
      })
      .finally(() => setLoading(false))
  }, [teamId])

  const memberKillsChart = useMemo(() => {
    if (!teamStats?.memberStats) return null
    const sorted = [...teamStats.memberStats].sort((a, b) => b.kills - a.kills)
    return {
      categories: sorted.map((m) => m.user.nickname),
      series: [
        { name: '击杀', data: sorted.map((m) => m.kills) },
        { name: '伤害', data: sorted.map((m) => Math.round(m.damage)) },
      ],
    }
  }, [teamStats])

  const memberAvgChart = useMemo(() => {
    if (!teamStats?.memberStats) return null
    const sorted = [...teamStats.memberStats].sort((a, b) => b.avgKills - a.avgKills)
    return {
      categories: sorted.map((m) => m.user.nickname),
      series: [
        { name: '场均击杀', data: sorted.map((m) => parseFloat(m.avgKills.toFixed(1))) },
        { name: '场均伤害', data: sorted.map((m) => Math.round(m.avgDamage)) },
      ],
    }
  }, [teamStats])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
        <span className="text-pubg-muted text-lg">车队数据加载中...</span>
      </div>
    )
  }

  if (!team) return null

  const s = teamStats

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/teams')}
        className="flex items-center gap-2 text-pubg-muted hover:text-pubg-orange transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>返回车队列表</span>
      </button>

      {/* 车队信息 */}
      <div className="pubg-card">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pubg-orange/30 to-pubg-orange/10 flex items-center justify-center border border-pubg-orange/30">
            <Users className="w-10 h-10 text-pubg-orange" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-black text-white">{team.name}</h1>
              <span className="px-3 py-1 text-xs bg-pubg-orange/20 text-pubg-orange rounded-full font-medium border border-pubg-orange/30">
                {team.members?.length || 0} 人车队
              </span>
            </div>
            <p className="text-pubg-muted text-sm mb-3">动态检测自动创建</p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs bg-pubg-orange/20 text-pubg-orange px-3 py-1.5 rounded-full font-medium">
                <Crosshair className="w-3.5 h-3.5" />
                总场次 {s?.totalMatches || 0}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-pubg-green/20 text-pubg-green px-3 py-1.5 rounded-full font-medium">
                <Trophy className="w-3.5 h-3.5" />
                吃鸡 {s?.totalWins || 0}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-pubg-red/20 text-pubg-red px-3 py-1.5 rounded-full font-medium">
                <Target className="w-3.5 h-3.5" />
                总击杀 {s?.totalKills || 0}
              </span>
              {s?.bestRank && (
                <span className="inline-flex items-center gap-1.5 text-xs bg-purple-500/20 text-purple-400 px-3 py-1.5 rounded-full font-medium">
                  <Crown className="w-3.5 h-3.5" />
                  最佳排名 #{s.bestRank}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="总场次" value={s?.totalMatches || 0} icon={Crosshair} color="blue" trend="车队累计对战" />
        <StatCard title="总击杀" value={s?.totalKills || 0} icon={Target} color="red" trend="全员击杀总和" />
        <StatCard title="总伤害" value={Math.round(s?.totalDamage || 0)} icon={Zap} color="orange" trend="全员伤害输出" />
        <StatCard title="吃鸡次数" value={s?.totalWins || 0} icon={Trophy} color="green" trend="大吉大利" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="场均击杀" value={s?.avgKills?.toFixed(1) || '0'} icon={Skull} color="orange" trend="团队平均水平" />
        <StatCard title="场均伤害" value={Math.round(s?.avgDamage || 0)} icon={Swords} color="orange" trend="团队火力" />
        <StatCard title="胜率" value={s ? `${(s.winRate * 100).toFixed(1)}%` : '0%'} icon={TrendingUp} color="green" trend="吃鸡率" />
        <StatCard title="成员数" value={team.members?.length || 0} icon={Users} color="blue" trend="车队规模" />
      </div>

      {/* 图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {memberKillsChart && (
          <div className="pubg-card">
            <div className="flex items-center gap-2 mb-4">
              <Swords className="w-5 h-5 text-pubg-orange" />
              <h2 className="text-lg font-bold text-white">成员击杀 & 伤害对比</h2>
            </div>
            <Chart type="bar" data={memberKillsChart} height={300} />
          </div>
        )}
        {memberAvgChart && (
          <div className="pubg-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-pubg-orange" />
              <h2 className="text-lg font-bold text-white">成员场均数据对比</h2>
            </div>
            <Chart type="bar" data={memberAvgChart} height={300} />
          </div>
        )}
      </div>

      {/* 成员战绩排行 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Medal className="w-5 h-5 text-pubg-orange" />
          <h2 className="text-lg font-bold text-white">成员战绩排行</h2>
        </div>
        <div className="space-y-3">
          {s?.memberStats
            ?.sort((a, b) => b.kills - a.kills)
            .map((member, index) => {
              const isMe = member.user.id === currentUser?.id
              const medalEmojis = ['🥇', '🥈', '🥉']
              return (
                <div
                  key={member.user.id}
                  className={`pubg-card py-4 px-5 flex items-center gap-6 ${
                    isMe ? 'border-pubg-orange/50 bg-pubg-orange/5' : ''
                  }`}
                >
                  <div className="w-8 text-center">
                    {index < 3 ? (
                      <span className="text-xl">{medalEmojis[index]}</span>
                    ) : (
                      <span className="text-pubg-muted font-bold">#{index + 1}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold ${
                      isMe ? 'bg-pubg-orange/30 text-pubg-orange' : 'bg-pubg-card text-pubg-muted border border-pubg-border'
                    }`}>
                      {member.user.nickname[0]}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {member.user.nickname}
                        {isMe && <span className="text-xs text-pubg-orange font-normal">(我)</span>}
                      </div>
                      <div className="text-xs text-pubg-muted">{member.matches}场</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center min-w-[48px]">
                      <div className="font-bold text-pubg-orange">{member.kills}</div>
                      <div className="text-xs text-pubg-muted">击杀</div>
                    </div>
                    <div className="text-center min-w-[48px] hidden sm:block">
                      <div className="font-bold text-white">{Math.round(member.damage)}</div>
                      <div className="text-xs text-pubg-muted">伤害</div>
                    </div>
                    <div className="text-center min-w-[48px]">
                      <div className="font-bold text-pubg-green">{member.wins}</div>
                      <div className="text-xs text-pubg-muted">吃鸡</div>
                    </div>
                    <div className="text-center min-w-[64px] hidden md:block">
                      <div className="font-bold text-pubg-muted">{member.avgKills.toFixed(1)}</div>
                      <div className="text-xs text-pubg-muted">场均击杀</div>
                    </div>
                    <div className="text-center min-w-[48px] hidden md:block">
                      <div className="font-bold text-purple-400">
                        {member.bestRank ? `#${member.bestRank}` : '-'}
                      </div>
                      <div className="text-xs text-pubg-muted">最佳</div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* 成员卡片 */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-pubg-orange" />
          <h2 className="text-lg font-bold text-white">车队成员</h2>
          <span className="text-pubg-muted text-sm">({team.members?.length || 0}人)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {team.members?.map((member) => {
            const isMe = member.user.id === currentUser?.id
            const ms = s?.memberStats?.find((m: any) => m.user.id === member.user.id)
            return (
              <div key={member.id} className={`pubg-card ${isMe ? 'border-pubg-orange/50' : ''}`}>
                <div className="flex items-center gap-4 mb-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                    isMe ? 'bg-pubg-orange/30 text-pubg-orange' : 'bg-pubg-orange/20 text-pubg-orange'
                  }`}>
                    {member.user.nickname[0]}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {member.user.nickname}
                      {isMe && <span className="text-xs bg-pubg-orange/20 text-pubg-orange px-2 py-0.5 rounded-full">我</span>}
                    </h3>
                    <p className="text-xs text-pubg-muted">共同作战 {member.matchCount} 场</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-pubg-dark rounded-lg">
                    <div className="text-sm font-bold text-pubg-orange">{ms?.kills || 0}</div>
                    <div className="text-xs text-pubg-muted">组排击杀</div>
                  </div>
                  <div className="text-center p-2 bg-pubg-dark rounded-lg">
                    <div className="text-sm font-bold text-white">{ms?.avgKills?.toFixed(1) || 0}</div>
                    <div className="text-xs text-pubg-muted">场均击杀</div>
                  </div>
                  <div className="text-center p-2 bg-pubg-dark rounded-lg">
                    <div className="text-sm font-bold text-pubg-green">{ms?.wins || 0}</div>
                    <div className="text-xs text-pubg-muted">组排吃鸡</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 撞车记录 */}
      {matchups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Swords className="w-5 h-5 text-pubg-orange" />
            <h2 className="text-lg font-bold text-white">撞车记录</h2>
            <span className="text-pubg-muted text-sm">({matchups.length}次)</span>
          </div>
          <div className="space-y-3">
            {matchups.map((m) => {
              const d = new Date(m.playedAt)
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              return (
                <div key={m.matchId + '-' + m.opponentTeam.id} className="pubg-card py-3 px-5 flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[100px] text-sm text-pubg-muted">
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-sm font-bold text-white">{team?.name}</span>
                    <span className="text-xs text-pubg-muted px-2 py-0.5 rounded border border-pubg-border">vs</span>
                    <span className="text-sm font-bold text-pubg-orange">{m.opponentTeam.name}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-pubg-muted">
                    {m.opponentTeam.members?.slice(0, 4).map((mm: any) => (
                      <span key={mm.user.pubgId} className="px-2 py-0.5 rounded-full bg-pubg-dark border border-pubg-border">
                        {mm.user.nickname}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** 车队主页面 - 根据是否有 id 参数切换列表/详情 */
export default function TeamPage() {
  const { id } = useParams<{ id: string }>()
  if (id) return <TeamDetailView teamId={id} />
  return <TeamListView />
}