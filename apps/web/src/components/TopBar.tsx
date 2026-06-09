import { Search } from 'lucide-react'
import { useStore } from '@/store/useStore'

export default function TopBar() {
  const currentUser = useStore((s) => s.currentUser)

  return (
    <header className="h-14 sm:h-16 bg-pubg-card border-b border-pubg-border flex items-center justify-between px-3 sm:px-6 safe-area-top">
      <div className="flex items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-pubg-muted" />
          <input
            type="text"
            placeholder="搜索玩家..."
            className="w-full bg-pubg-dark border border-pubg-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-pubg-orange text-white placeholder-pubg-muted"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-pubg-muted">
        <span className="hidden sm:inline">欢迎,</span>
        <span className="text-pubg-orange font-medium truncate max-w-[120px] sm:max-w-none">
          {currentUser?.nickname || '游客'}
        </span>
      </div>
    </header>
  )
}
