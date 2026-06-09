import { ChevronLeft, ChevronRight } from 'lucide-react'

export function getWeekNumber(date: Date = new Date()): string {
  const d = new Date(date.getTime())
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function parseWeek(week: string): Date {
  const match = week.match(/^(\d{4})-W(\d{1,2})$/)
  if (!match) return new Date()
  const year = parseInt(match[1], 10)
  const weekNum = parseInt(match[2], 10)
  const janFirst = new Date(year, 0, 1)
  const daysOffset = (weekNum - 1) * 7 - ((janFirst.getDay() + 6) % 7)
  return new Date(year, 0, 1 + daysOffset)
}

function formatWeekLabel(week: string): string {
  const date = parseWeek(week)
  const end = new Date(date)
  end.setDate(end.getDate() + 6)
  return `${date.getMonth() + 1}/${date.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
}

interface WeekSelectorProps {
  value: string
  onChange: (week: string) => void
  label?: string
}

export default function WeekSelector({ value, onChange, label }: WeekSelectorProps) {
  const currentWeek = getWeekNumber()

  const weeks: string[] = []
  const current = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(current)
    d.setDate(d.getDate() - i * 7)
    const w = getWeekNumber(d)
    if (!weeks.includes(w)) weeks.push(w)
  }

  const canGoPrev = weeks.indexOf(value) < weeks.length - 1
  const canGoNext = value !== currentWeek

  const goPrev = () => {
    const idx = weeks.indexOf(value)
    if (idx < weeks.length - 1) onChange(weeks[idx + 1])
  }

  const goNext = () => {
    const idx = weeks.indexOf(value)
    if (idx > 0) onChange(weeks[idx - 1])
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-pubg-muted text-sm">{label}</span>}
      <div className="flex items-center gap-1 bg-pubg-card border border-pubg-border rounded-lg overflow-hidden">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className="p-2 text-pubg-muted hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-white text-sm font-medium px-2 py-2 focus:outline-none cursor-pointer min-w-[120px] text-center"
        >
          {weeks.map((w) => (
            <option key={w} value={w} className="bg-pubg-card text-white">
              第{w}周 ({formatWeekLabel(w)})
            </option>
          ))}
        </select>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="p-2 text-pubg-muted hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
