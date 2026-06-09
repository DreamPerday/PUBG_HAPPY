import api, { type ApiResponse } from './index'

export interface Team {
  id: string
  name: string
  _count?: { members: number }
  createdAt: string
}

export interface TeamMember {
  id: string
  teamId: string
  userId: string
  matchCount: number
  user: {
    id: string
    nickname: string
    pubgId: string
    avatar?: string
    playerStats?: {
      totalKills: number
      totalWins: number
      totalMatches: number
      avgKills: number
      avgDamage: number
      kda: number
      winRate: number
    }
  }
}

export interface TeamDetail {
  id: string
  name: string
  createdAt: string
  members: TeamMember[]
}

export interface TeamStats {
  team: TeamDetail
  totalMatches: number
  totalKills: number
  totalDamage: number
  totalWins: number
  avgKills: number
  avgDamage: number
  winRate: number
  bestRank: number | null
  memberStats: Array<{
    user: { id: string; nickname: string; pubgId: string }
    matches: number
    kills: number
    damage: number
    wins: number
    avgKills: number
    avgDamage: number
    bestRank: number | null
  }>
}

export async function getTeams(): Promise<Team[]> {
  const res = await api.get<ApiResponse<Team[]>>('/teams')
  return res.data.data
}

export async function getTeam(id: string): Promise<TeamDetail> {
  const res = await api.get<ApiResponse<TeamDetail>>(`/teams/${id}`)
  return res.data.data
}

export async function getTeamStats(id: string, week?: string): Promise<TeamStats> {
  const res = await api.get<ApiResponse<TeamStats>>(
    `/teams/${id}/stats${week ? `?week=${week}` : ''}`,
  )
  return res.data.data
}

export async function getUserTeams(userId: string): Promise<TeamDetail[]> {
  const res = await api.get<ApiResponse<TeamDetail[]>>(`/teams/user/${userId}`)
  return res.data.data
}

export async function detectTeams(): Promise<any> {
  const res = await api.post<ApiResponse<any>>('/teams/detect')
  return res.data.data
}

export interface TeamComparisonItem {
  teamId: string
  teamName: string
  memberCount: number
  totalMatches: number
  totalKills: number
  totalDamage: number
  totalWins: number
  avgKills: number
  avgDamage: number
  winRate: number
}

export interface TeamComparison {
  teams: TeamComparisonItem[]
  bestTeam: TeamComparisonItem | null
  bestWinTeam: TeamComparisonItem | null
  worstTeam: TeamComparisonItem | null
}

export async function getAllTeamStats(): Promise<TeamComparison> {
  const res = await api.get<ApiResponse<TeamComparison>>('/teams/all-stats')
  return res.data.data
}