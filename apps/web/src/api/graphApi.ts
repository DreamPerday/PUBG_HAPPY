import api, { type ApiResponse } from './index'

export interface PlayerRelation {
  id: string
  playerA: string
  playerB: string
  togetherMatches: number
  totalMatchesA: number
  totalMatchesB: number
  relationStrength: number
  lastPlayedAt: string
}

export interface TeamGraphCluster {
  id: string
  clusterName: string
  memberPubgIds: string
  avgStrength: number
  stabilityScore: number
  matchCount: number
  createdAt: string
}

export interface GraphNode {
  id: string
  pubgId: string
  nickname: string
  avatar?: string
  totalMatches: number
  totalKills: number
}

export interface GraphLink {
  source: string
  target: string
  strength: number
  togetherMatches: number
  lastPlayedAt: string
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export async function getRelations(): Promise<PlayerRelation[]> {
  const res = await api.get<ApiResponse<PlayerRelation[]>>('/graph/relations')
  return res.data.data
}

export async function getPlayerRelations(pubgId: string): Promise<PlayerRelation[]> {
  const res = await api.get<ApiResponse<PlayerRelation[]>>(`/graph/player/${pubgId}`)
  return res.data.data
}

export async function getTeamClusters(): Promise<TeamGraphCluster[]> {
  const res = await api.get<ApiResponse<TeamGraphCluster[]>>('/graph/team_clusters')
  return res.data.data
}

export async function detectRelations(): Promise<any> {
  const res = await api.post<ApiResponse<any>>('/graph/detect')
  return res.data.data
}

export async function clusterTeams(): Promise<any> {
  const res = await api.post<ApiResponse<any>>('/graph/cluster')
  return res.data.data
}

export interface WeeklyAnalysis {
  mostPopular: { pubgId: string; nickname: string; relationCount: number } | null
  mostLoyal: { pubgId: string; nickname: string; bestPartner: string; maxStrength: number } | null
}

export async function getWeeklyAnalysis(): Promise<WeeklyAnalysis> {
  const res = await api.get<ApiResponse<WeeklyAnalysis>>('/graph/weekly-analysis')
  return res.data.data
}