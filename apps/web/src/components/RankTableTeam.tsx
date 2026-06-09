import { Medal, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface TeamEntry {
  teamId: string
  teamName: string
  score: number
}

interface RankTableTeamProps {
  entries: TeamEntry[]
}

const rankColors = ['text-pubg-yellow', 'text-gray-300', 'text-amber-600']

export default function RankTableTeam({ entries }: RankTableTeamProps) {
  const navigate = useNavigate()

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
              <th className="text-left py-3 px-4 text-pubg-muted text-sm font-medium w-16">排名</th>
              <th className="text-left py-3 px-4 text-pubg-muted text-sm font-medium">
                <span className="flex items-center gap-1">车队</span>
              </th>
              <th className="text-right py-3 px-4 text-pubg-muted text-sm font-medium">
                <span className="flex items-center justify-end gap-1">分数</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={entry.teamId}
                className="border-b border-pubg-border/50 table-row-hover transition-colors cursor-pointer"
                onClick={() => navigate(`/team/${entry.teamId}`)}
              >
                <td className="py-3 px-4">
                  {index < 3 ? (
                    <Medal className={`w-5 h-5 ${rankColors[index]}`} />
                  ) : (
                    <span className="text-pubg-muted text-sm">{index + 1}</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-pubg-orange/20 flex items-center justify-center text-sm font-bold text-pubg-orange flex-shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-white font-medium truncate">{entry.teamName}</span>
                  </div>
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
