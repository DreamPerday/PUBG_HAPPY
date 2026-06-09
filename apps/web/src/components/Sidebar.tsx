import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Trophy,
  Skull,
  Crown,
  FileText,
  Star,
  Crosshair,
  User,
  Users,
  Share2,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { path: '/', label: '首页', icon: LayoutDashboard },
  { path: '/profile', label: '个人战绩', icon: User },
  { path: '/teams', label: '车队状况', icon: Users },
  { path: '/graph', label: '关系图谱', icon: Share2 },
  { path: '/leaderboard', label: '红榜', icon: Trophy },
  { path: '/blackboard', label: '黑榜', icon: Skull },
  { path: '/mvp', label: 'MVP榜', icon: Crown },
  { path: '/report', label: 'AI周报', icon: FileText },
  { path: '/hall', label: '名人堂', icon: Star },
]

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <>
      {/* 移动端菜单按钮 */}
      {isMobile && (
        <button
          onClick={onToggle}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-pubg-card border border-pubg-border text-pubg-orange hover:bg-pubg-orange/10 transition-colors md:hidden"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      )}

      {/* 侧边栏 */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-pubg-card border-r border-pubg-border flex flex-col transition-transform duration-300 ease-in-out ${
          isMobile
            ? isOpen
              ? 'translate-x-0 shadow-2xl'
              : '-translate-x-full'
            : 'translate-x-0'
        }`}
      >
        {/* Logo区域 */}
        <div className="p-6 border-b border-pubg-border">
          <div className="flex items-center gap-3">
            <Crosshair className="w-8 h-8 text-pubg-orange" />
            <div>
              <h1 className="text-xl font-black text-white tracking-wider">PUBG</h1>
              <p className="text-xs text-pubg-muted">车队战绩系统</p>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={isMobile ? onToggle : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-pubg-orange/10 text-pubg-orange border border-pubg-orange/30'
                    : 'text-pubg-muted hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* 系统状态 */}
        <div className="p-4 border-t border-pubg-border">
          <div className="pubg-card p-4">
            <p className="text-xs text-pubg-muted mb-2">系统状态</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pubg-green animate-pulse" />
              <span className="text-sm text-pubg-green">数据同步正常</span>
            </div>
          </div>
        </div>
      </aside>

      {/* 移动端遮罩层 */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onToggle}
        />
      )}
    </>
  )
}
