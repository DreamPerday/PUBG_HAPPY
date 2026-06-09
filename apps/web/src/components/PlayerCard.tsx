import { Link } from 'react-router-dom'
import { Target, Zap, Clock } from 'lucide-react'
import type { Player } from '@/types'

interface PlayerCardProps {
  player: Player
}

export default function PlayerCard({ player }: PlayerCardProps) {
  const stats = player.stats

  return (
    <Link to={`/player/${player.id}`}>
      <div className="pubg-card hover:border-pubg-orange/50 transition-all hover:scale-[1.02] cursor-pointer group">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-xl bg-pubg-orange/20 flex items-center justify-center text-xl font-black text-pubg-orange">
            {player.nickname[0]}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white group-hover:text-pubg-orange transition-colors">
              {player.nickname}
            </h3>
            <p className="text-xs text-pubg-muted">{player.pubgId}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-pubg-dark rounded-lg">
            <Target className="w-4 h-4 mx-auto mb-1 text-pubg-red" />
            <div className="text-sm font-bold text-white">{stats?.avgKills?.toFixed(1) || 0}</div>
            <div className="text-xs text-pubg-muted">场均击杀</div>
          </div>
          <div className="text-center p-2 bg-pubg-dark rounded-lg">
            <Zap className="w-4 h-4 mx-auto mb-1 text-pubg-yellow" />
            <div className="text-sm font-bold text-white">{Math.round(stats?.avgDamage || 0)}</div>
            <div className="text-xs text-pubg-muted">场均伤害</div>
          </div>
          <div className="text-center p-2 bg-pubg-dark rounded-lg">
            <Clock className="w-4 h-4 mx-auto mb-1 text-pubg-green" />
            <div className="text-sm font-bold text-white">{stats?.totalMatches || 0}</div>
            <div className="text-xs text-pubg-muted">总场次</div>
          </div>
        </div>
      </div>
    </Link>
  )
}
