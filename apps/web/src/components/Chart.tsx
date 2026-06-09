import { useRef, useEffect } from 'react'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, RadarChart, PieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  RadarChart,
  PieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
])

type ChartType = 'line' | 'bar' | 'radar' | 'pie'

interface ChartProps {
  type: ChartType
  data: any
  height?: number
  className?: string
}

const baseTheme = {
  backgroundColor: 'transparent',
  textStyle: { color: '#8e8e93', fontFamily: '"Noto Sans SC", sans-serif' },
  tooltip: {
    backgroundColor: '#1a1a24',
    borderColor: '#2a2a35',
    textStyle: { color: '#e5e5e5', fontSize: 12 },
  },
}

export default function Chart({ type, data, height = 300, className = '' }: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts>()

  useEffect(() => {
    if (!chartRef.current) return

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current, undefined, { renderer: 'canvas' })
    }

    const option = buildOption(type, data)
    instanceRef.current.setOption(option, true)

    const handleResize = () => instanceRef.current?.resize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [type, data])

  useEffect(() => {
    return () => {
      instanceRef.current?.dispose()
      instanceRef.current = undefined
    }
  }, [])

  return <div ref={chartRef} className={className} style={{ height: `${height}px`, width: '100%' }} />
}

function buildOption(type: ChartType, data: any) {
  switch (type) {
    case 'line':
      return buildLineChart(data)
    case 'bar':
      return buildBarChart(data)
    case 'radar':
      return buildRadarChart(data)
    case 'pie':
      return buildPieChart(data)
    default:
      return {}
  }
}

function buildLineChart(data: any) {
  const categories = data.categories || []
  const series = (data.series || []).map((s: any) => ({
    name: s.name,
    type: 'line' as const,
    data: s.data,
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    lineStyle: { width: 2 },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(255, 149, 0, 0.3)' },
        { offset: 1, color: 'rgba(255, 149, 0, 0)' },
      ]),
    },
    itemStyle: { color: '#ff9500' },
  }))

  return {
    ...baseTheme,
    tooltip: { ...baseTheme.tooltip, trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#2a2a35' } },
      axisLabel: { color: '#8e8e93', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1a1a24' } },
      axisLabel: { color: '#8e8e93' },
    },
    series,
  }
}

function buildBarChart(data: any) {
  const categories = data.categories || []
  const series = (data.series || []).map((s: any, i: number) => ({
    name: s.name,
    type: 'bar' as const,
    data: s.data,
    barWidth: '60%',
    itemStyle: {
      color: i === 0 ? '#ff9500' : '#ffc800',
      borderRadius: [4, 4, 0, 0],
    },
  }))

  return {
    ...baseTheme,
    tooltip: { ...baseTheme.tooltip, trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLine: { lineStyle: { color: '#2a2a35' } },
      axisLabel: { color: '#8e8e93', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#1a1a24' } },
      axisLabel: { color: '#8e8e93' },
    },
    series,
  }
}

function buildRadarChart(data: any) {
  const indicators = (data.indicators || []).map((ind: any) => ({
    name: ind.name,
    max: ind.max || 100,
  }))
  const series = (data.series || []).map((s: any, i: number) => ({
    name: s.name,
    type: 'radar' as const,
    data: [s.data],
    areaStyle: {
      color: i === 0 ? 'rgba(255, 149, 0, 0.3)' : 'rgba(255, 200, 0, 0.2)',
    },
    lineStyle: { color: i === 0 ? '#ff9500' : '#ffc800' },
    itemStyle: { color: i === 0 ? '#ff9500' : '#ffc800' },
  }))

  return {
    ...baseTheme,
    tooltip: { ...baseTheme.tooltip },
    radar: {
      indicator: indicators,
      radius: '65%',
      axisName: { color: '#e5e5e5', fontSize: 12 },
      splitArea: {
        areaStyle: { color: ['rgba(255, 149, 0, 0.02)', 'rgba(255, 149, 0, 0.04)'] },
      },
      axisLine: { lineStyle: { color: '#2a2a35' } },
      splitLine: { lineStyle: { color: '#2a2a35' } },
    },
    series,
  }
}

function buildPieChart(data: any) {
  const colors = data.colors || ['#ff9500', '#ffc800', '#ff3b30', '#34c759', '#007aff', '#8e8e93'];
  return {
    ...baseTheme,
    tooltip: { ...baseTheme.tooltip, trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['45%', '70%'],
        center: ['50%', '50%'],
        data: (data.data || []).map((item: any, i: number) => ({
          ...item,
          itemStyle: {
            color: colors[i % colors.length],
          },
        })),
        label: { color: '#e5e5e5', fontSize: 12 },
        labelLine: { lineStyle: { color: '#2a2a35' } },
      },
    ],
  }
}
