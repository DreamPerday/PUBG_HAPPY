import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Calendar, User } from 'lucide-react'
import type { WeeklyReport } from '@/types'

interface AIReportCardProps {
  report: WeeklyReport
  defaultExpanded?: boolean
}

export default function AIReportCard({ report, defaultExpanded = false }: AIReportCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!report) return null

  const summary = report.content?.summary || '暂无战报内容'

  return (
    <div className="pubg-card overflow-hidden border-l-4 border-l-pubg-orange">
      {/* 头部 */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-pubg-yellow" />
            <h3 className="text-lg font-bold text-white">{report.title}</h3>
          </div>
          <div className="flex items-center gap-4 text-xs text-pubg-muted">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              第 {report.week} 周
            </span>
            <span>生成于 {new Date(report.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg hover:bg-white/5 text-pubg-muted hover:text-white transition-colors"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* AI 战报内容 */}
      <div className={`transition-all duration-300 overflow-hidden ${expanded ? 'max-h-[2000px]' : 'max-h-[120px]'}`}>
        <div className="prose prose-invert max-w-none">
          <div className="text-pubg-text whitespace-pre-line leading-relaxed text-sm">
            {summary}
          </div>
        </div>

        {/* 本周之星 */}
        {expanded && report.topPlayers?.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1">
              <User className="w-4 h-4 text-pubg-orange" />
              本周之星
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {report.topPlayers.map((p, i) => (
                <div
                  key={i}
                  className="bg-pubg-dark rounded-lg p-3 text-center"
                >
                  <div className="w-10 h-10 mx-auto rounded-full bg-pubg-orange/20 flex items-center justify-center text-lg font-bold text-pubg-orange mb-2">
                    {p.name[0]}
                  </div>
                  <div className="text-white text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-pubg-muted mt-1">{p.kills}杀 / {p.wins}鸡</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 搞笑榜单 */}
        {expanded && report.funnyRankings?.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-bold text-white mb-3">搞笑榜单</h4>
            <div className="space-y-2">
              {report.funnyRankings.map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-pubg-dark rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-pubg-red/20 flex items-center justify-center text-sm font-bold text-pubg-red">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-pubg-muted truncate">{r.desc}</div>
                  </div>
                  <div className="text-pubg-orange text-sm font-bold">{r.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="text-xs text-pubg-orange hover:text-pubg-yellow mt-2"
        >
          展开查看完整战报
        </button>
      )}
    </div>
  )
}
