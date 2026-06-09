import api, { type ApiResponse } from './index'
import type { LeaderboardBoard, MvpBoard } from '@/types'

export async function getRedBoard(week?: string): Promise<LeaderboardBoard> {
  const res = await api.get<ApiResponse<LeaderboardBoard>>(
    `/leaderboard/red${week ? `?week=${week}` : ''}`,
  )
  return res.data.data
}

export async function getTeamRedBoard(week?: string): Promise<LeaderboardBoard> {
  const res = await api.get<ApiResponse<LeaderboardBoard>>(
    `/leaderboard/red/team${week ? `?week=${week}` : ''}`,
  )
  return res.data.data
}

export async function getBlackBoard(week?: string): Promise<LeaderboardBoard> {
  const res = await api.get<ApiResponse<LeaderboardBoard>>(
    `/leaderboard/black${week ? `?week=${week}` : ''}`,
  )
  return res.data.data
}

export async function getMvpBoard(week?: string): Promise<MvpBoard> {
  const res = await api.get<ApiResponse<MvpBoard>>(
    `/leaderboard/mvp${week ? `?week=${week}` : ''}`,
  )
  return res.data.data
}

export async function recalculateLeaderboard(week?: string): Promise<any> {
  const res = await api.post<ApiResponse<any>>(
    `/leaderboard/recalculate${week ? `?week=${week}` : ''}`,
  )
  return res.data.data
}
