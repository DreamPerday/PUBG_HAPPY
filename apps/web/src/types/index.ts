// ===== 玩家相关 =====
export interface Player {
  id: string
  pubgId: string
  nickname: string
  avatar?: string
  platform: string
  createdAt: string
  stats?: PlayerStats
}

export interface PlayerStats {
  totalMatches: number
  totalWins: number
  totalKills: number
  totalDamage: number
  totalHeadshots: number
  avgKills: number
  avgDamage: number
  avgSurvivalTime: number
  kda: number
  winRate: number
}

// ===== 比赛相关 =====
export interface Match {
  id: string
  matchId: string
  mode: string
  mapName: string
  kills: number
  damage: number
  rank: number
  survivalTime: number
  headshots: number
  assists: number
  revives: number
  teamKills: number
  won: boolean
  playedAt: string
  player?: Player
  telemetry?: any
}

export interface Teammate {
  pubgId: string
  nickname: string
  kills: number
  damage: number
  rank: number
  survivalTime: number
  headshots: number
  assists: number
  revives: number
  won: boolean
}

export interface MatchPage {
  data: Match[]
  total: number
  page: number
  totalPages: number
}

// ===== 榜单相关 =====
export interface LeaderboardEntry {
  id: string
  type: string
  category: string
  score: number
  week: string
  user: {
    id: string
    nickname: string
    avatar?: string
    pubgId: string
    createdAt?: string
    updatedAt?: string
  }
}

export interface LeaderboardBoard {
  week: string
  boards: Record<string, LeaderboardEntry[]>
}

export interface MvpBoard {
  week: string
  entries: LeaderboardEntry[]
}

// ===== 统计相关 =====
export interface Overview {
  totalPlayers: number
  totalMatches: number
  totalKills: number
  avgKills: number
  recentMatches: Match[]
}

export interface PlayerStatsDetail {
  stats: PlayerStats
  recentTrend: Match[]
  bestMatch: Match
}

// ===== 周报相关 =====
export interface WeeklyReport {
  id: string
  week: string
  title: string
  content: ReportContent
  topPlayers: TopPlayer[]
  funnyRankings: FunnyRanking[]
  createdAt: string
}

export interface ReportContent {
  summary: string
}

export interface TopPlayer {
  name: string
  kills: number
  damage: number
  wins: number
  matches: number
}

export interface FunnyRanking {
  title: string
  name: string
  desc: string
}

// ===== API 统一响应 =====
export interface ApiResponse<T> {
  data: T
  success: boolean
  timestamp: string
}
