import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface ApiResponse<T> {
  data: T
  success: boolean
  timestamp: string
}

export async function getPlayers() {
  const res = await api.get<ApiResponse<any[]>>('/players')
  return res.data.data
}

export async function getPlayer(id: string) {
  const res = await api.get<ApiResponse<any>>(`/players/${id}`)
  return res.data.data
}

export async function getPlayerMatches(playerId: string, page = 1, limit = 20) {
  const res = await api.get<ApiResponse<any>>(`/matches/player/${playerId}?page=${page}&limit=${limit}`)
  return res.data.data
}

export async function getOverview() {
  const res = await api.get<ApiResponse<any>>('/stats/overview')
  return res.data.data
}

export async function getPlayerStats(playerId: string) {
  const res = await api.get<ApiResponse<any>>(`/stats/player/${playerId}`)
  return res.data.data
}

export async function getRedBoard(week?: string) {
  const res = await api.get<ApiResponse<any>>(`/leaderboard/red${week ? `?week=${week}` : ''}`)
  return res.data.data
}

export async function getBlackBoard(week?: string) {
  const res = await api.get<ApiResponse<any>>(`/leaderboard/black${week ? `?week=${week}` : ''}`)
  return res.data.data
}

export async function getMvpBoard(week?: string) {
  const res = await api.get<ApiResponse<any>>(`/leaderboard/mvp${week ? `?week=${week}` : ''}`)
  return res.data.data
}

export async function getWeeklyReports() {
  const res = await api.get<ApiResponse<any[]>>('/reports/weekly')
  return res.data.data
}

export async function getWeeklyReport(week: string) {
  const res = await api.get<ApiResponse<any>>(`/reports/weekly/${week}`)
  return res.data.data
}

export async function generateWeeklyReport(week?: string) {
  const res = await api.post<ApiResponse<any>>(`/reports/weekly/generate${week ? `?week=${week}` : ''}`)
  return res.data.data
}

export async function bindPlayer(data: { pubgId: string; nickname: string; avatar?: string }) {
  const res = await api.post<ApiResponse<any>>('/players/bind', data)
  return res.data.data
}

export default api
