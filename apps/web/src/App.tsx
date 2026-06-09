import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Home'
import PlayerDetail from './pages/PlayerDetail'
import Leaderboard from './pages/Leaderboard'
import Blackboard from './pages/Blackboard'
import MVP from './pages/MVP'
import Report from './pages/Report'
import Hall from './pages/Hall'
import LoginPage from './pages/LoginPage'
import ProfilePage from './pages/ProfilePage'
import TeamPage from './pages/TeamPage'
import GraphPage from './pages/GraphPage'
import Admin from './pages/Admin'
import DanmakuOverlay from './components/DanmakuOverlay'
import { useStore } from './store/useStore'

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="flex min-h-screen bg-pubg-dark overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/player/:id" element={<PlayerDetail />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/teams" element={<TeamPage />} />
            <Route path="/team/:id" element={<TeamPage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/blackboard" element={<Blackboard />} />
            <Route path="/mvp" element={<MVP />} />
            <Route path="/report" element={<Report />} />
            <Route path="/hall" element={<Hall />} />
          </Routes>
          <DanmakuOverlay pageId="global" />
        </main>
      </div>
    </div>
  )
}

function App() {
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const currentUser = useStore((s) => s.currentUser)
  const loadUser = useStore((s) => s.loadUser)

  useEffect(() => {
    loadUser()
    setChecking(false)
  }, [loadUser])

  if (checking) {
    return (
      <div className="min-h-screen bg-pubg-dark flex items-center justify-center">
        <div className="text-pubg-muted text-lg animate-pulse">加载中...</div>
      </div>
    )
  }

  if (location.pathname === '/admin') {
    return <Admin />
  }

  if (!currentUser) {
    return <LoginPage />
  }

  return <AppLayout />
}

export default App
