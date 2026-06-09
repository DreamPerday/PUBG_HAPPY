import { Medal, ArrowUpDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { LeaderboardEntry } from '@/types'

interface RankTableProps {
  entries: LeaderboardEntry[]
  showRank?: boolean
  sortable?: boolean
  onSort?: (field: string) => void
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}

const rankColors = ['text-pubg-yellow', 'text-gray-300', 'text-amber-600']

export default function RankTable({
  entries,
  showRank = true,
  sortable = false,
  onSort,
  sortField,
}: RankTableProps) {
  if (!entries?.length) {
    return (
      <div className="bg-pubg-card border border-pubg-border rounded-xl p-6 text-center text-pubg-muted text-sm">
        暂无数据
      </div>
    )
  }

  return (
    <div className="bg-pubg-card border border-pubg-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-pubg-border">
              {showRank && (
                <th className="text-left py-3 px-4 text-pubg-muted text-sm font-medium w-16">
                  排名
                </th>
              )}
              <th
                className={`text-left py-3 px-4 text-pubg-muted text-sm font-medium ${
                  sortable ? 'cursor-pointer hover:text-white select-none' : ''
                }`}
                onClick={() => sortable && onSort?.('nickname')}
              >
                <span className="flex items-center gap-1">
                  玩家
                  {sortable && sortField === 'nickname' && (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </span>
              </th>
              <th
                className={`text-right py-3 px-4 text-pubg-muted text-sm font-medium ${
                  sortable ? 'cursor-pointer hover:text-white select-none' : ''
                }`}
                onClick={() => sortable && onSort?.('score')}
              >
                <span className="flex items-center justify-end gap-1">
                  {sortable && sortField === 'score' && (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                  分数
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={entry.id}
                className="border-b border-pubg-border/50 table-row-hover transition-colors"
              >
                {showRank && (
                  <td className="py-3 px-4">
                    {index < 3 ? (
                      <Medal className={`w-5 h-5 ${rankColors[index]}`} />
                    ) : (
                      <span className="text-pubg-muted text-sm">{index + 1}</span>
                    )}
                  </td>
                )}
                <td className="py-3 px-4">
                  <Link
                    to={`/player/${entry.user.id}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <div className="w-8 h-8 rounded-lg bg-pubg-orange/20 flex items-center justify-center text-sm font-bold text-pubg-orange flex-shrink-0">
                      {entry.user.nickname[0]}
                    </div>
                    <span className="text-white font-medium truncate">
                      {entry.user.nickname}
                    </span>
                  </Link>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-pubg-orange font-bold tabular-nums">
                    {typeof entry.score === 'number' ? Math.round(entry.score) : entry.score}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
