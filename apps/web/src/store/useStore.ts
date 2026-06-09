import { create } from 'zustand'
import type { Player, LeaderboardBoard, MvpBoard, WeeklyReport, Overview, PlayerStatsDetail } from '@/types'
import { getOverview, getPlayers } from '@/api/playerApi'
import { getRedBoard, getBlackBoard, getMvpBoard, recalculateLeaderboard } from '@/api/leaderboardApi'
import { getWeeklyReports } from '@/api/reportApi'

export interface User {
  id: string
  nickname: string
  pubgId: string
  avatar?: string
}

export interface Team {
  id: string
  name: string
  members: any[]
}

interface AppState {
  // 玩家
  players: Player[]
  playersLoading: boolean
  overview: Overview | null
  overviewLoading: boolean

  // 榜单（带缓存）
  redBoard: LeaderboardBoard | null
  blackBoard: LeaderboardBoard | null
  mvpBoard: MvpBoard | null
  boardWeek: string
  boardLoading: boolean

  // 周报
  reports: WeeklyReport[]
  reportsLoading: boolean

  // 玩家详情缓存
  playerDetails: Record<string, PlayerStatsDetail>
  playerMatchPages: Record<string, any>

  // 用户会话
  currentUser: User | null
  currentTeam: Team | null
  viewMode: 'personal' | 'team'

  // 操作
  fetchPlayers: () => Promise<void>
  fetchOverview: () => Promise<void>
  fetchBoards: (week?: string) => Promise<void>
  fetchReports: () => Promise<void>
  setPlayerDetail: (id: string, data: PlayerStatsDetail) => void
  setPlayerMatches: (id: string, data: any) => void
  login: (user: User) => void
  logout: () => void
  updateUser: (user: User) => void
  setTeam: (team: Team | null) => void
  setViewMode: (mode: 'personal' | 'team') => void
  loadUser: () => void
}

export const useStore = create<AppState>((set, get) => ({
  players: [],
  playersLoading: false,
  overview: null,
  overviewLoading: false,
  redBoard: null,
  blackBoard: null,
  mvpBoard: null,
  boardWeek: '',
  boardLoading: false,
  reports: [],
  reportsLoading: false,
  playerDetails: {},
  playerMatchPages: {},

  // 用户会话
  currentUser: null,
  currentTeam: null,
  viewMode: 'personal',

  fetchPlayers: async () => {
    set({ playersLoading: true })
    try {
      const data = await getPlayers()
      set({ players: data, playersLoading: false })
    } catch {
      set({ playersLoading: false })
    }
  },

  fetchOverview: async () => {
    set({ overviewLoading: true })
    try {
      const data = await getOverview()
      set({ overview: data, overviewLoading: false })
    } catch {
      set({ overviewLoading: false })
    }
  },

  fetchBoards: async (week?: string) => {
    set({ boardLoading: true })
    try {
      let [red, black, mvp] = await Promise.all([
        getRedBoard(week),
        getBlackBoard(week),
        getMvpBoard(week),
      ])
      // 如果榜单为空，触发重算后再获取
      const redEmpty = Object.values(red.boards).every((arr) => arr.length === 0)
      if (redEmpty) {
        await recalculateLeaderboard(week)
        ;[red, black, mvp] = await Promise.all([
          getRedBoard(week),
          getBlackBoard(week),
          getMvpBoard(week),
        ])
      }
      set({
        redBoard: red,
        blackBoard: black,
        mvpBoard: mvp,
        boardWeek: red.week,
        boardLoading: false,
      })
    } catch {
      set({ boardLoading: false })
    }
  },

  fetchReports: async () => {
    set({ reportsLoading: true })
    try {
      const data = await getWeeklyReports()
      set({ reports: data, reportsLoading: false })
    } catch {
      set({ reportsLoading: false })
    }
  },

  setPlayerDetail: (id, data) => {
    const details = { ...get().playerDetails, [id]: data }
    set({ playerDetails: details })
  },

  setPlayerMatches: (id, data) => {
    const pages = { ...get().playerMatchPages, [id]: data }
    set({ playerMatchPages: pages })
  },

  // 用户会话操作
  login: (user: User) => {
    localStorage.setItem('current_user', JSON.stringify(user))
    set({ currentUser: user })
  },

  logout: () => {
    localStorage.removeItem('current_user')
    set({ currentUser: null })
  },

  updateUser: (user: User) => {
    localStorage.setItem('current_user', JSON.stringify(user))
    set({ currentUser: user })
  },

  setTeam: (team: Team | null) => {
    set({ currentTeam: team })
  },

  setViewMode: (mode: 'personal' | 'team') => {
    set({ viewMode: mode })
  },

  loadUser: () => {
    try {
      const raw = localStorage.getItem('current_user')
      if (raw) {
        const user = JSON.parse(raw) as User
        set({ currentUser: user })
      }
    } catch {
      localStorage.removeItem('current_user')
    }
  },
}))
