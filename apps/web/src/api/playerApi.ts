import api, { type ApiResponse } from './index'
import type { Player, PlayerStatsDetail, MatchPage, Overview, Match, Teammate } from '@/types'

export interface User {
  id: string
  nickname: string
  pubgId: string
  avatar?: string
}

export async function getPlayers(): Promise<Player[]> {
  const res = await api.get<ApiResponse<any[]>>('/graph/users')
  // 将 API 返回的 playerStats 映射为 stats
  return (res.data.data || []).map((u: any) => ({
    ...u,
    platform: u.platform || 'steam',
    stats: u.playerStats || undefined,
  }))
}

export async function getPlayer(id: string): Promise<Player | null> {
  try {
    const res = await api.get<ApiResponse<any>>(`/players/${id}`)
    const data = res.data?.data
    if (!data) return null
    return {
      ...data,
      platform: data.platform || 'steam',
      stats: data.playerStats || undefined,
    }
  } catch {
    return null
  }
}

export async function getPlayerMatches(
  playerId: string,
  page = 1,
  limit = 20,
  days?: number,
): Promise<MatchPage | null> {
  try {
    let url = `/matches/player/${playerId}?page=${page}&limit=${limit}`
    if (days) url += `&days=${days}`
    const res = await api.get<ApiResponse<MatchPage>>(url)
    return res.data?.data || null
  } catch {
    return null
  }
}

export async function getOverview(): Promise<Overview | null> {
  try {
    const res = await api.get<ApiResponse<Overview>>('/stats/overview')
    return res.data?.data || null
  } catch {
    return null
  }
}

export async function getPlayerStats(playerId: string): Promise<PlayerStatsDetail | null> {
  try {
    const res = await api.get<ApiResponse<PlayerStatsDetail>>(`/stats/player/${playerId}`)
    return res.data?.data || null
  } catch {
    return null
  }
}

export interface SeasonStats {
  roundsPlayed: number
  kills: number
  damageDealt: number
  wins: number
  headshotKills: number
  assists: number
  revives: number
  longestKill: number
  bestRank: number
  avgKills: number
  avgDamage: number
  winRate: number
  seasonId: string
}

export async function getSeasonStats(pubgId: string): Promise<SeasonStats | null> {
  try {
    const res = await api.get<ApiResponse<SeasonStats>>(`/stats/season/${pubgId}`)
    return res.data?.data || null
  } catch {
    return null
  }
}

export async function bindPlayer(data: {
  pubgId: string
  nickname: string
  avatar?: string
}): Promise<Player | null> {
  try {
    const res = await api.post<ApiResponse<Player>>('/players/bind', data)
    return res.data?.data || null
  } catch {
    return null
  }
}

export async function login(keyword: string): Promise<User | null> {
  try {
    const res = await api.post<ApiResponse<User>>('/auth/login', { keyword })
    return res.data?.data || null
  } catch {
    return null
  }
}

export async function register(data: {
  nickname: string
  pubgId: string
}): Promise<User | null> {
  try {
    const res = await api.post<ApiResponse<User>>('/auth/register', data)
    return res.data?.data || null
  } catch {
    return null
  }
}

export async function getTeammates(matchId: string, pubgId: string): Promise<Teammate[]> {
  try {
    const res = await api.get<ApiResponse<Teammate[]>>(`/matches/teammates/${matchId}?pubgId=${pubgId}`)
    return res.data?.data || []
  } catch {
    return []
  }
}

export interface MatchDamageEntry {
  name: string
  kills: number
  damage: number
  rank: number
  survivalTime: number
  headshots: number
  assists: number
  revives: number
}

export async function getMatchDamage(matchId: string): Promise<MatchDamageEntry[]> {
  try {
    const res = await api.get<ApiResponse<MatchDamageEntry[]>>(`/matches/damage/${matchId}`)
    return res.data?.data || []
  } catch {
    return []
  }
}
