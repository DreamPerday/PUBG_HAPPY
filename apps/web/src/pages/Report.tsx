import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Sparkles, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import AIReportCard from '@/components/AIReportCard'
import { generateWeeklyReport } from '@/api/reportApi'

export default function Report() {
  const {
    reports,
    reportsLoading,
    overview,
    fetchReports,
    fetchOverview,
  } = useStore()

  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    fetchReports()
    fetchOverview()
  }, [fetchReports, fetchOverview])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await generateWeeklyReport()
      await fetchReports()
      await fetchOverview()
    } catch {
      // 静默处理错误
    } finally {
      setGenerating(false)
    }
  }

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => a.week.localeCompare(b.week)),
    [reports],
  )

  const visibleReports = selectedWeek
    ? reports.filter((r) => r.week === selectedWeek)
    : reports

  const currentIndex = useMemo(
    () => sortedReports.findIndex((r) => r.week === selectedWeek),
    [sortedReports, selectedWeek],
  )

  const goPrevWeek = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedWeek(sortedReports[currentIndex - 1].week)
    }
  }, [currentIndex, sortedReports])

  const goNextWeek = useCallback(() => {
    if (currentIndex < sortedReports.length - 1) {
      setSelectedWeek(sortedReports[currentIndex + 1].week)
    }
  }, [currentIndex, sortedReports])

  const canGoPrev = selectedWeek && currentIndex > 0
  const canGoNext = selectedWeek && currentIndex < sortedReports.length - 1

  if (reportsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="text-pubg-muted text-lg">数据加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 页面标题行 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="pubg-title mb-1 flex items-center gap-3">
            <FileText className="w-8 h-8 text-pubg-blue" />
            AI战报中心
          </h1>
          <p className="pubg-subtitle">智能生成车队周报与比赛吐槽</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="pubg-btn flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {generating ? '生成中...' : '生成周报'}
        </button>
      </div>

      {/* 周选择器 */}
      <div className="flex items-center gap-4">
        <Calendar className="w-5 h-5 text-pubg-muted" />
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="bg-pubg-dark/50 border border-pubg-border rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-pubg-orange transition-colors"
        >
          <option value="">全部周报</option>
          {reports.map((r) => (
            <option key={r.id} value={r.week}>
              第 {r.week} 周
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1">
          <button
            onClick={goPrevWeek}
            disabled={!canGoPrev}
            className="p-2 rounded-lg hover:bg-white/5 text-pubg-muted hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="上一周"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goNextWeek}
            disabled={!canGoNext}
            className="p-2 rounded-lg hover:bg-white/5 text-pubg-muted hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="下一周"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 战报列表 */}
      {visibleReports.length === 0 ? (
        <div className="pubg-card text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-pubg-muted mb-4" />
          <p className="text-pubg-muted text-lg mb-2">暂无周报数据</p>
          <p className="text-pubg-muted text-sm">
            点击右上角「生成周报」按钮创建第一份周报
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleReports.map((report) => (
            <AIReportCard
              key={report.id}
              report={report}
              defaultExpanded={visibleReports.length === 1}
            />
          ))}
        </div>
      )}

      {/* 数据概览 */}
      {overview && (
        <div className="pubg-card">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-pubg-orange" />
            车队数据概览
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-pubg-dark rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-pubg-blue">
                {overview.totalPlayers}
              </div>
              <div className="text-xs text-pubg-muted mt-1">车队人数</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-pubg-orange">
                {overview.totalMatches}
              </div>
              <div className="text-xs text-pubg-muted mt-1">总比赛场次</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-pubg-red">
                {overview.totalKills}
              </div>
              <div className="text-xs text-pubg-muted mt-1">总击杀数</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-pubg-green">
                {overview.avgKills.toFixed(2)}
              </div>
              <div className="text-xs text-pubg-muted mt-1">场均击杀</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
