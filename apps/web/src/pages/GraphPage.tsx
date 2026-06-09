import { useState, useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { Share2, Grid3x3, GitBranch, RefreshCw, Loader2 } from 'lucide-react'
import {
  getRelations,
  getTeamClusters,
  detectRelations,
  clusterTeams,
  getWeeklyAnalysis,
  type PlayerRelation,
  type TeamGraphCluster,
  type WeeklyAnalysis,
} from '@/api/graphApi'
import { getPlayers } from '@/api/playerApi'
import { useStore } from '@/store/useStore'
import type { Player } from '@/types'

type TabKey = 'graph' | 'matrix' | 'clusters'

interface MatrixCell {
  row: string
  col: string
  strength: number
  togetherMatches: number
  lastPlayedAt: string
}

interface ClusterMember {
  pubgId: string
  nickname: string
  totalMatches: number
  totalKills: number
}

interface D3Node extends d3.SimulationNodeDatum {
  id: string
  pubgId: string
  nickname: string
  totalMatches: number
  totalKills: number
  isCurrentUser: boolean
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  strength: number
  togetherMatches: number
  lastPlayedAt: string
}

const tabs: { key: TabKey; label: string; icon: typeof Share2 }[] = [
  { key: 'graph', label: '关系图谱', icon: Share2 },
  { key: 'matrix', label: '热力矩阵', icon: Grid3x3 },
  { key: 'clusters', label: '车队聚类', icon: GitBranch },
]

function getStrengthColor(strength: number): string {
  if (strength < 0.3) return '#6b7280'
  if (strength < 0.5) return '#9ca3af'
  if (strength < 0.7) return '#f97316'
  if (strength < 0.85) return '#ea580c'
  return '#dc2626'
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** 力导向图子组件 */
function ForceGraph({
  relations,
  players,
  currentUserPubgId,
}: {
  relations: PlayerRelation[]
  players: Player[]
  currentUserPubgId: string
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const playerMap = new Map(players.map((p) => [p.pubgId, p]))

    const nodeSet = new Set<string>()
    const nodes: D3Node[] = []
    const links: D3Link[] = []

    relations.forEach((r) => {
      if (!nodeSet.has(r.playerA)) {
        nodeSet.add(r.playerA)
        const p = playerMap.get(r.playerA)
        nodes.push({
          id: r.playerA,
          pubgId: r.playerA,
          nickname: p?.nickname || r.playerA,
          totalMatches: p?.stats?.totalMatches || r.totalMatchesA || 0,
          totalKills: p?.stats?.totalKills || 0,
          isCurrentUser: r.playerA === currentUserPubgId,
        })
      }
      if (!nodeSet.has(r.playerB)) {
        nodeSet.add(r.playerB)
        const p = playerMap.get(r.playerB)
        nodes.push({
          id: r.playerB,
          pubgId: r.playerB,
          nickname: p?.nickname || r.playerB,
          totalMatches: p?.stats?.totalMatches || r.totalMatchesB || 0,
          totalKills: p?.stats?.totalKills || 0,
          isCurrentUser: r.playerB === currentUserPubgId,
        })
      }
      links.push({
        source: r.playerA,
        target: r.playerB,
        strength: r.relationStrength,
        togetherMatches: r.togetherMatches,
        lastPlayedAt: r.lastPlayedAt,
      })
    })

    if (nodes.length === 0) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = Math.max(600, container.clientHeight || 600)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const g = svg.append('g')

    const simulation = d3
      .forceSimulation<D3Node>(nodes)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(links)
          .id((d) => d.id)
          .distance(120),
      )
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('charge', d3.forceManyBody().strength(-250))
      .force('collide', d3.forceCollide().radius(30))
      .alphaDecay(0.02)

    const maxMatches = Math.max(...nodes.map((n) => n.totalMatches), 1)

    const link = g
      .append('g')
      .selectAll<SVGLineElement, D3Link>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-width', (d) => Math.max(1, d.strength * 4))
      .attr('stroke-opacity', (d) => 0.3 + d.strength * 0.5)

    const node = g
      .append('g')
      .selectAll<SVGGElement, D3Node>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'grab')

    node
      .append('circle')
      .attr('r', (d) => Math.max(6, 10 + (d.totalMatches / maxMatches) * 16))
      .attr('fill', (d) => (d.isCurrentUser ? '#f97316' : '#374151'))
      .attr('stroke', (d) => (d.isCurrentUser ? '#fb923c' : '#6b7280'))
      .attr('stroke-width', (d) => (d.isCurrentUser ? 3 : 1.5))

    node
      .append('text')
      .text((d) => d.nickname)
      .attr('x', (d) => Math.max(6, 10 + (d.totalMatches / maxMatches) * 16) + 6)
      .attr('y', 4)
      .attr('fill', (d) => (d.isCurrentUser ? '#f97316' : '#d1d5db'))
      .attr('font-size', 12)
      .attr('font-weight', (d) => (d.isCurrentUser ? 'bold' : 'normal'))

    // drag
    const drag = d3
      .drag<SVGGElement, D3Node>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(drag as any)

    // tooltip
    const tooltip = d3.select(tooltipRef.current)
    node
      .on('mouseenter', function (event, d) {
        tooltip
          .style('opacity', 1)
          .html(
            `
            <div class="space-y-1.5">
              <div class="font-bold text-pubg-orange text-sm">${d.nickname}${d.isCurrentUser ? ' (我)' : ''}</div>
              <div class="text-xs text-gray-400">总场次: ${d.totalMatches}</div>
              <div class="text-xs text-gray-400">总击杀: ${d.totalKills}</div>
              <hr class="border-pubg-border my-1"/>
              ${(() => {
                const connectedLinks = links.filter(
                  (l) =>
                    (l.source as D3Node).id === d.id || (l.target as D3Node).id === d.id,
                )
                const otherIds = new Set<string>()
                connectedLinks.forEach((l) => {
                  const sid = (l.source as D3Node).id
                  const tid = (l.target as D3Node).id
                  if (sid !== d.id) otherIds.add(sid)
                  if (tid !== d.id) otherIds.add(tid)
                })
                const otherNodes = nodes.filter((n) => otherIds.has(n.id))
                return otherNodes
                  .map(
                    (on) =>
                      `<div class="text-xs text-gray-400">↔ ${on.nickname}</div>`,
                  )
                  .join('')
              })()}
            </div>
          `.trim(),
          )
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`)
      })
      .on('mousemove', function (event) {
        tooltip
          .style('left', `${event.offsetX + 12}px`)
          .style('top', `${event.offsetY - 10}px`)
      })
      .on('mouseleave', function () {
        tooltip.style('opacity', 0)
      })

    // zoom / pan
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom).on('dblclick.zoom', null)

    // tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x!)
        .attr('y1', (d) => (d.source as D3Node).y!)
        .attr('x2', (d) => (d.target as D3Node).x!)
        .attr('y2', (d) => (d.target as D3Node).y!)
      node.attr('transform', (d) => `translate(${d.x},${d.y})`)
    })

    // auto-stop
    setTimeout(() => {
      simulation.alphaTarget(0).alpha(0).stop()
    }, 5000)

    return () => {
      simulation.stop()
    }
  }, [relations, players, currentUserPubgId])

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[600px]">
      <svg ref={svgRef} className="w-full" />
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none z-50 bg-pubg-card/95 backdrop-blur-sm border border-pubg-border rounded-lg px-3 py-2 shadow-xl opacity-0 transition-opacity duration-150"
        style={{ minWidth: 140 }}
      />
    </div>
  )
}

/** 热力矩阵子组件 */
function HeatMatrix({
  relations,
  players,
}: {
  relations: PlayerRelation[]
  players: Player[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const { matrix, playerPubgIds } = (() => {
    const pubgIdSet = new Set<string>()
    relations.forEach((r) => {
      pubgIdSet.add(r.playerA)
      pubgIdSet.add(r.playerB)
    })
    const ids = Array.from(pubgIdSet)

    const strengthMap = new Map<string, MatrixCell>()
    relations.forEach((r) => {
      const key1 = `${r.playerA}::${r.playerB}`
      const key2 = `${r.playerB}::${r.playerA}`
      const cell: MatrixCell = {
        row: r.playerA,
        col: r.playerB,
        strength: r.relationStrength,
        togetherMatches: r.togetherMatches,
        lastPlayedAt: r.lastPlayedAt,
      }
      strengthMap.set(key1, cell)
      strengthMap.set(key2, cell)
    })

    const m: MatrixCell[][] = ids.map((rowId) =>
      ids.map((colId) => {
        if (rowId === colId) {
          return { row: rowId, col: colId, strength: 1, togetherMatches: 0, lastPlayedAt: '' }
        }
        return (
          strengthMap.get(`${rowId}::${colId}`) || {
            row: rowId,
            col: colId,
            strength: 0,
            togetherMatches: 0,
            lastPlayedAt: '',
          }
        )
      }),
    )

    return { matrix: m, playerPubgIds: ids }
  })()

  const cellSize = Math.max(24, Math.min(48, 600 / playerPubgIds.length))
  const labelWidth = 80
  const headerHeight = 40
  const svgWidth = labelWidth + playerPubgIds.length * cellSize + 20
  const svgHeight = headerHeight + playerPubgIds.length * cellSize + 20

  const playerMap = new Map(players.map((p) => [p.pubgId, p]))

  return (
    <div ref={containerRef} className="relative overflow-auto">
      <svg width={svgWidth} height={svgHeight} className="min-w-full">
        {/* row labels */}
        {playerPubgIds.map((pid, i) => {
          const p = playerMap.get(pid)
          return (
            <text
              key={`row-${pid}`}
              x={labelWidth - 8}
              y={headerHeight + i * cellSize + cellSize / 2}
              fill="#9ca3af"
              fontSize={Math.min(11, cellSize * 0.4)}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {p?.nickname || pid.slice(0, 8)}
            </text>
          )
        })}
        {/* col labels */}
        {playerPubgIds.map((pid, i) => {
          const p = playerMap.get(pid)
          return (
            <text
              key={`col-${pid}`}
              x={labelWidth + i * cellSize + cellSize / 2}
              y={headerHeight - 8}
              fill="#9ca3af"
              fontSize={Math.min(11, cellSize * 0.4)}
              textAnchor="end"
              transform={`rotate(-45, ${labelWidth + i * cellSize + cellSize / 2}, ${headerHeight - 8})`}
            >
              {p?.nickname || pid.slice(0, 8)}
            </text>
          )
        })}
        {/* cells */}
        {matrix.map((row, ri) =>
          row.map((cell, ci) => {
            if (ri === ci) {
              return (
                <rect
                  key={`${ri}-${ci}`}
                  x={labelWidth + ci * cellSize}
                  y={headerHeight + ri * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill="#1f2937"
                  stroke="#374151"
                  strokeWidth={0.5}
                />
              )
            }
            if (ri > ci) return null
            const color = getStrengthColor(cell.strength)
            return (
              <g key={`${ri}-${ci}`}>
                <rect
                  x={labelWidth + ci * cellSize}
                  y={headerHeight + ri * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={color}
                  fillOpacity={cell.strength * 0.8 + 0.1}
                  stroke="#374151"
                  strokeWidth={0.5}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rowP = playerMap.get(cell.row)
                    const colP = playerMap.get(cell.col)
                    const tl = tooltipRef.current
                    if (tl) {
                      tl.style.opacity = '1'
                      tl.style.left = `${e.clientX - containerRef.current!.getBoundingClientRect().left + 12}px`
                      tl.style.top = `${e.clientY - containerRef.current!.getBoundingClientRect().top - 10}px`
                      tl.innerHTML = `
                        <div class="space-y-1">
                          <div class="text-xs font-bold text-white">${rowP?.nickname || cell.row} ↔ ${colP?.nickname || cell.col}</div>
                          <div class="text-xs text-pubg-muted">关联强度: ${(cell.strength * 100).toFixed(0)}%</div>
                          <div class="text-xs text-pubg-muted">共同场次: ${cell.togetherMatches}</div>
                          ${cell.lastPlayedAt ? `<div class="text-xs text-pubg-muted">最近: ${formatTime(cell.lastPlayedAt)}</div>` : ''}
                        </div>
                      `
                    }
                  }}
                  onMouseMove={(e) => {
                    const tl = tooltipRef.current
                    if (tl) {
                      tl.style.left = `${e.clientX - containerRef.current!.getBoundingClientRect().left + 12}px`
                      tl.style.top = `${e.clientY - containerRef.current!.getBoundingClientRect().top - 10}px`
                    }
                  }}
                  onMouseLeave={() => {
                    if (tooltipRef.current) tooltipRef.current.style.opacity = '0'
                  }}
                />
                {/* symmetrical cell */}
                <rect
                  x={labelWidth + ri * cellSize}
                  y={headerHeight + ci * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={color}
                  fillOpacity={cell.strength * 0.8 + 0.1}
                  stroke="#374151"
                  strokeWidth={0.5}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    const rowP = playerMap.get(cell.row)
                    const colP = playerMap.get(cell.col)
                    const tl = tooltipRef.current
                    if (tl) {
                      tl.style.opacity = '1'
                      tl.style.left = `${e.clientX - containerRef.current!.getBoundingClientRect().left + 12}px`
                      tl.style.top = `${e.clientY - containerRef.current!.getBoundingClientRect().top - 10}px`
                      tl.innerHTML = `
                        <div class="space-y-1">
                          <div class="text-xs font-bold text-white">${rowP?.nickname || cell.row} ↔ ${colP?.nickname || cell.col}</div>
                          <div class="text-xs text-pubg-muted">关联强度: ${(cell.strength * 100).toFixed(0)}%</div>
                          <div class="text-xs text-pubg-muted">共同场次: ${cell.togetherMatches}</div>
                          ${cell.lastPlayedAt ? `<div class="text-xs text-pubg-muted">最近: ${formatTime(cell.lastPlayedAt)}</div>` : ''}
                        </div>
                      `
                    }
                  }}
                  onMouseMove={(e) => {
                    const tl = tooltipRef.current
                    if (tl) {
                      tl.style.left = `${e.clientX - containerRef.current!.getBoundingClientRect().left + 12}px`
                      tl.style.top = `${e.clientY - containerRef.current!.getBoundingClientRect().top - 10}px`
                    }
                  }}
                  onMouseLeave={() => {
                    if (tooltipRef.current) tooltipRef.current.style.opacity = '0'
                  }}
                />
              </g>
            )
          }),
        )}
      </svg>
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none z-50 bg-pubg-card/95 backdrop-blur-sm border border-pubg-border rounded-lg px-3 py-2 shadow-xl opacity-0 transition-opacity duration-150"
        style={{ minWidth: 140 }}
      />
    </div>
  )
}

/** 车队聚类子组件 */
function TeamClustersView({
  clusters,
  players,
}: {
  clusters: TeamGraphCluster[]
  players: Player[]
}) {
  const playerMap = new Map(players.map((p) => [p.pubgId, p]))

  const enrichedClusters = clusters.map((c) => {
    let memberPubgIds: string[] = []
    try {
      memberPubgIds = JSON.parse(c.memberPubgIds) as string[]
    } catch {
      memberPubgIds = []
    }
    const members: ClusterMember[] = memberPubgIds.map((pubgId) => {
      const p = playerMap.get(pubgId)
      return {
        pubgId,
        nickname: p?.nickname || pubgId,
        totalMatches: p?.stats?.totalMatches || 0,
        totalKills: p?.stats?.totalKills || 0,
      }
    })
    return { ...c, members }
  })

  if (clusters.length === 0) {
    return (
      <div className="pubg-card text-center py-16">
        <GitBranch className="w-16 h-16 mx-auto mb-4 text-pubg-muted opacity-30" />
        <p className="text-pubg-muted text-lg mb-2">暂无车队聚类数据</p>
        <p className="text-sm text-pubg-muted/60">点击上方"聚类分析"按钮进行车队检测</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {enrichedClusters.map((cluster) => (
        <div key={cluster.id} className="pubg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">{cluster.clusterName}</h3>
            <span className="text-xs text-pubg-muted bg-pubg-dark px-2 py-1 rounded-full">
              {cluster.members.length} 人
            </span>
          </div>

          {/* member list */}
          <div className="space-y-2 mb-4">
            {cluster.members.map((member) => (
              <div
                key={member.pubgId}
                className="flex items-center gap-3 p-2 rounded-lg bg-pubg-dark/50"
              >
                <div className="w-8 h-8 rounded-lg bg-pubg-orange/20 flex items-center justify-center text-sm font-bold text-pubg-orange shrink-0">
                  {member.nickname[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {member.nickname}
                  </div>
                  <div className="text-xs text-pubg-muted">
                    {member.totalMatches} 场 · {member.totalKills} 击杀
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-pubg-border">
            <div className="text-center">
              <div className="text-sm font-bold text-pubg-orange">
                {(cluster.avgStrength * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-pubg-muted">平均强度</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-white">
                {(cluster.stabilityScore * 100).toFixed(0)}%
              </div>
              <div className="text-xs text-pubg-muted">稳定性</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-pubg-green">{cluster.matchCount}</div>
              <div className="text-xs text-pubg-muted">比赛场次</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 主页面 */
export default function GraphPage() {
  const currentUser = useStore((s) => s.currentUser)

  const [activeTab, setActiveTab] = useState<TabKey>('graph')
  const [relations, setRelations] = useState<PlayerRelation[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [clusters, setClusters] = useState<TeamGraphCluster[]>([])
  const [loadingRelations, setLoadingRelations] = useState(true)
  const [loadingPlayers, setLoadingPlayers] = useState(true)
  const [loadingClusters, setLoadingClusters] = useState(true)
  const [detecting, setDetecting] = useState(false)
  const [clustering, setClustering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectMsg, setDetectMsg] = useState<string | null>(null)
  const [clusterMsg, setClusterMsg] = useState<string | null>(null)
  const [weeklyAnalysis, setWeeklyAnalysis] = useState<WeeklyAnalysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  const fetchAll = useCallback(async () => {
    setError(null)
    setLoadingRelations(true)
    setLoadingPlayers(true)
    try {
      const [relData, playerData] = await Promise.all([
        getRelations(),
        getPlayers(),
      ])
      setRelations(relData)
      setPlayers(playerData)
    } catch (err: any) {
      setError(err?.message || '数据加载失败')
    } finally {
      setLoadingRelations(false)
      setLoadingPlayers(false)
    }
  }, [])

  const fetchClusters = useCallback(async () => {
    setLoadingClusters(true)
    try {
      const data = await getTeamClusters()
      setClusters(data)
    } catch (err: any) {
      setError(err?.message || '聚类数据加载失败')
    } finally {
      setLoadingClusters(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    fetchClusters()
  }, [fetchAll, fetchClusters])

  const fetchWeeklyAnalysisData = useCallback(async () => {
    setAnalysisLoading(true)
    try {
      const data = await getWeeklyAnalysis()
      setWeeklyAnalysis(data)
      // weekly-analysis 会触发 detectRelations，刷新关系数据
      if (relations.length === 0) {
        const [relData, playerData] = await Promise.all([
          getRelations(),
          getPlayers(),
        ])
        setRelations(relData)
        setPlayers(playerData)
      }
    } catch {
      // ignore
    } finally {
      setAnalysisLoading(false)
    }
  }, [relations.length])

  useEffect(() => {
    fetchWeeklyAnalysisData()
  }, [fetchWeeklyAnalysisData])

  const handleDetect = async () => {
    setDetecting(true)
    setDetectMsg(null)
    setError(null)
    try {
      await detectRelations()
      setDetectMsg('关系检测完成')
      await fetchAll()
    } catch (err: any) {
      setError(err?.message || '关系检测失败')
    } finally {
      setDetecting(false)
    }
  }

  const handleCluster = async () => {
    setClustering(true)
    setClusterMsg(null)
    setError(null)
    try {
      await clusterTeams()
      setClusterMsg('聚类分析完成')
      await fetchClusters()
    } catch (err: any) {
      setError(err?.message || '聚类分析失败')
    } finally {
      setClustering(false)
    }
  }

  const isLoading =
    loadingRelations || loadingPlayers || loadingClusters

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="pubg-title mb-1 flex items-center gap-3">
            <Share2 className="w-8 h-8 text-pubg-orange" />
            关系图谱
          </h1>
          <p className="pubg-subtitle">玩家社交关系网络与车队聚类分析</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDetect}
            disabled={detecting}
            className="pubg-btn flex items-center gap-2 px-4 py-2 rounded-lg bg-pubg-orange/20 text-pubg-orange border border-pubg-orange/30 hover:bg-pubg-orange/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {detecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            检测关系
          </button>
          <button
            onClick={handleCluster}
            disabled={clustering}
            className="pubg-btn flex items-center gap-2 px-4 py-2 rounded-lg bg-pubg-orange/20 text-pubg-orange border border-pubg-orange/30 hover:bg-pubg-orange/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {clustering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GitBranch className="w-4 h-4" />
            )}
            聚类分析
          </button>
        </div>
      </div>

      {/* status messages */}
      {detectMsg && (
        <div className="pubg-card border-pubg-orange/30 bg-pubg-orange/5 px-4 py-2 text-sm text-pubg-orange">
          {detectMsg}
        </div>
      )}
      {clusterMsg && (
        <div className="pubg-card border-pubg-orange/30 bg-pubg-orange/5 px-4 py-2 text-sm text-pubg-orange">
          {clusterMsg}
        </div>
      )}
      {error && (
        <div className="pubg-card border-red-500/30 bg-red-500/5 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 本周分析 */}
      {weeklyAnalysis && !analysisLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {weeklyAnalysis.mostPopular && (
            <div className="pubg-card border-pubg-orange/50 bg-gradient-to-br from-pubg-orange/5 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-pubg-orange/20 flex items-center justify-center">
                  <Share2 className="w-5 h-5 text-pubg-orange" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pubg-orange">最受欢迎之人</h3>
                  <p className="text-xs text-pubg-muted">本周关系网络最广</p>
                </div>
              </div>
              <p className="text-white font-bold text-lg">
                {weeklyAnalysis.mostPopular.nickname}
              </p>
              <p className="text-sm text-pubg-muted">
                与 {weeklyAnalysis.mostPopular.relationCount} 位玩家有关联
              </p>
            </div>
          )}
          {weeklyAnalysis.mostLoyal && (
            <div className="pubg-card border-pubg-blue/50 bg-gradient-to-br from-pubg-blue/5 to-transparent">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-pubg-blue/20 flex items-center justify-center">
                  <GitBranch className="w-5 h-5 text-pubg-blue" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pubg-blue">最专一之人</h3>
                  <p className="text-xs text-pubg-muted">与固定队友配合最多</p>
                </div>
              </div>
              <p className="text-white font-bold text-lg">
                {weeklyAnalysis.mostLoyal.nickname}
              </p>
              <p className="text-sm text-pubg-muted">
                与 {weeklyAnalysis.mostLoyal.bestPartner} 的关联强度最高
              </p>
            </div>
          )}
        </div>
      )}

      {/* tabs */}
      <div className="flex gap-1 bg-pubg-card/50 rounded-lg p-1 border border-pubg-border w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? 'bg-pubg-orange/20 text-pubg-orange border border-pubg-orange/30'
                  : 'text-pubg-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* tab content */}
      <div className="min-h-[400px]">
        {/* loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <div className="w-10 h-10 border-2 border-pubg-orange border-t-transparent rounded-full animate-spin" />
            <span className="text-pubg-muted text-lg">数据加载中...</span>
          </div>
        )}

        {/* error with retry */}
        {!isLoading && error && !detectMsg && !clusterMsg && (
          <div className="pubg-card text-center py-16">
            <p className="text-pubg-muted text-lg mb-4">{error}</p>
            <button
              onClick={() => {
                fetchAll()
                fetchClusters()
              }}
              className="pubg-btn flex items-center gap-2 px-4 py-2 rounded-lg bg-pubg-orange/20 text-pubg-orange border border-pubg-orange/30 hover:bg-pubg-orange/30 transition-colors mx-auto text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
          </div>
        )}

        {/* graph tab */}
        {!isLoading && activeTab === 'graph' && !error && (
          <>
            {relations.length === 0 ? (
              <div className="pubg-card text-center py-16">
                <Share2 className="w-16 h-16 mx-auto mb-4 text-pubg-muted opacity-30" />
                <p className="text-pubg-muted text-lg mb-2">暂无关系数据</p>
                <p className="text-sm text-pubg-muted/60">
                  点击上方"检测关系"按钮分析玩家之间的关联
                </p>
              </div>
            ) : (
              <div className="pubg-card p-0 overflow-hidden">
                <ForceGraph
                  relations={relations}
                  players={players}
                  currentUserPubgId={currentUser?.pubgId || ''}
                />
              </div>
            )}
          </>
        )}

        {/* matrix tab */}
        {!isLoading && activeTab === 'matrix' && !error && (
          <>
            {relations.length === 0 ? (
              <div className="pubg-card text-center py-16">
                <Grid3x3 className="w-16 h-16 mx-auto mb-4 text-pubg-muted opacity-30" />
                <p className="text-pubg-muted text-lg mb-2">暂无关系数据</p>
                <p className="text-sm text-pubg-muted/60">
                  点击上方"检测关系"按钮生成热力矩阵
                </p>
              </div>
            ) : (
              <div className="pubg-card">
                <div className="flex items-center gap-2 mb-4">
                  <Grid3x3 className="w-5 h-5 text-pubg-orange" />
                  <h2 className="text-lg font-bold text-white">玩家关联热力矩阵</h2>
                </div>
                <HeatMatrix relations={relations} players={players} />
              </div>
            )}
          </>
        )}

        {/* clusters tab */}
        {!isLoading && activeTab === 'clusters' && !error && (
          <TeamClustersView clusters={clusters} players={players} />
        )}
      </div>
    </div>
  )
}