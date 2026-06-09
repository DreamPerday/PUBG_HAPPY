import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: string
  color?: 'orange' | 'green' | 'red' | 'blue'
}

const colorMap = {
  orange: 'text-pubg-orange',
  green: 'text-pubg-green',
  red: 'text-pubg-red',
  blue: 'text-pubg-blue',
}

export default function StatCard({ title, value, icon: Icon, trend, color = 'orange' }: StatCardProps) {
  return (
    <div className="pubg-card hover:border-pubg-orange/50 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-pubg-muted text-sm">{title}</span>
        <div className={`p-2 rounded-lg bg-${color === 'orange' ? 'pubg-orange' : color === 'green' ? 'pubg-green' : color === 'red' ? 'pubg-red' : 'pubg-blue'}/10`}>
          <Icon className={`w-5 h-5 ${colorMap[color]}`} />
        </div>
      </div>
      <div className="text-3xl font-black text-white mb-1">{value}</div>
      {trend && <div className="text-xs text-pubg-muted">{trend}</div>}
    </div>
  )
}
