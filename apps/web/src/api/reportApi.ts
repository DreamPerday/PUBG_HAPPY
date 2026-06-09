import api, { type ApiResponse } from './index'
import type { WeeklyReport } from '@/types'

export async function getWeeklyReports(): Promise<WeeklyReport[]> {
  const res = await api.get<ApiResponse<WeeklyReport[]>>('/reports/weekly')
  return res.data.data
}

export async function getWeeklyReport(week: string): Promise<WeeklyReport> {
  const res = await api.get<ApiResponse<WeeklyReport>>(`/reports/weekly/${week}`)
  return res.data.data
}

export async function generateWeeklyReport(week?: string): Promise<WeeklyReport> {
  const res = await api.post<ApiResponse<WeeklyReport>>(
    `/reports/weekly/generate${week ? `?week=${week}` : ''}`,
  )
  return res.data.data
}
