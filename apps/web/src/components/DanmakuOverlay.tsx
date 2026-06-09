import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Send, Eye, EyeOff } from 'lucide-react'
import api from '@/api/index'
import { useStore } from '@/store/useStore'

const DANMAKU_COLORS = ['#ff9500', '#ffc800', '#4caf50', '#00bcd4', '#e91e63', '#ffffff']
const LANE_COUNT = 8
const MIN_DURATION = 8
const MAX_DURATION = 10

interface DanmakuItem {
  id: string
  content: string
  nickname: string
  color: string
  lane: number
  animDuration: number
}

interface DanmakuOverlayProps {
  pageId: string
  active?: boolean
}

export default function DanmakuOverlay({ pageId, active = true }: DanmakuOverlayProps) {
  const currentUser = useStore((s) => s.currentUser)
  const [visible, setVisible] = useState(true)
  const [danmakuList, setDanmakuList] = useState<DanmakuItem[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const counterRef = useRef(0)

  const genId = useCallback(() => {
    counterRef.current += 1
    return `dm-${counterRef.current}-${Date.now()}`
  }, [])

  const getRandomLane = useCallback(() => Math.floor(Math.random() * LANE_COUNT), [])

  const getRandomColor = useCallback(() => {
    return DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)]
  }, [])

  const getRandomDuration = useCallback(() => {
    return MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION)
  }, [])

  const addDanmaku = useCallback(
    (data: any) => {
      const item: DanmakuItem = {
        id: genId(),
        content: data.content,
        nickname: data.user?.nickname || data.nickname || '匿名',
        color: data.color || getRandomColor(),
        lane: data.position ?? getRandomLane(),
        animDuration: getRandomDuration(),
      }
      setDanmakuList((prev) => [...prev, item])
      // auto-cleanup after animation completes
      setTimeout(() => {
        setDanmakuList((prev) => prev.filter((d) => d.id !== item.id))
      }, item.animDuration * 1000 + 500)
    },
    [genId, getRandomColor, getRandomLane, getRandomDuration],
  )

  // Fetch historical danmaku
  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(`/social/danmaku/${pageId}`)
      const items: any[] = res.data?.data || res.data || []
      if (Array.isArray(items)) {
        items.forEach((item) => addDanmaku(item))
      }
    } catch {
      // silent
    }
  }, [pageId, addDanmaku])

  // WebSocket connection
  useEffect(() => {
    if (!active) return

    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')
    const socket: Socket = io(`${baseUrl}/ws/social`, {
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join', pageId)
    })

    socket.on('danmaku', (data: any) => {
      addDanmaku(data)
    })

    socket.on('connect_error', () => {
      // silent
    })

    fetchHistory()

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [pageId, active, addDanmaku, fetchHistory])

  const handleSend = async () => {
    if (!input.trim() || sending || !currentUser) return
    setSending(true)
    try {
      await api.post('/social/danmaku', {
        content: input.trim(),
        pageId,
        userId: currentUser.id,
        color: getRandomColor(),
        position: getRandomLane(),
      })
      setInput('')
    } catch {
      // silent
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!active) return null

  return (
    <>
      <style>{`
        @keyframes danmaku-scroll {
          from { transform: translateX(100vw); }
          to { transform: translateX(-100%); }
        }
      `}</style>

      {/* Toggle button */}
      <button
        onClick={() => setVisible((v) => !v)}
        className="fixed bottom-28 right-6 z-[60] w-11 h-11 rounded-full bg-pubg-card/90 backdrop-blur-sm border border-pubg-border flex items-center justify-center text-pubg-muted hover:text-pubg-orange hover:border-pubg-orange transition-all shadow-lg"
        title={visible ? '隐藏弹幕' : '显示弹幕'}
      >
        {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      {/* Danmaku scrolling overlay */}
      {visible && (
        <div className="fixed inset-0 pointer-events-none z-[55] overflow-hidden">
          {danmakuList.map((danmaku) => (
            <div
              key={danmaku.id}
              className="absolute whitespace-nowrap text-lg font-bold leading-relaxed"
              style={{
                top: `${4 + danmaku.lane * 5.5}%`,
                color: danmaku.color,
                textShadow:
                  '0 0 3px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.9)',
                animation: `danmaku-scroll ${danmaku.animDuration.toFixed(1)}s linear forwards`,
              }}
            >
              <span className="mr-1.5 opacity-80 text-sm font-medium">{danmaku.nickname}:</span>
              {danmaku.content}
            </div>
          ))}

          {/* Empty state hint */}
          {danmakuList.length === 0 && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-pubg-muted/50 text-sm select-none">
              暂无弹幕，发送第一条吧
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      {visible && currentUser && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-pubg-card/90 backdrop-blur-md border border-pubg-border rounded-xl px-4 py-3 shadow-xl w-[500px] max-w-[calc(100vw-48px)]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="发送弹幕..."
            className="flex-1 bg-pubg-dark border border-pubg-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-pubg-muted focus:outline-none focus:border-pubg-orange transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="pubg-btn px-4 py-2.5 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            发送
          </button>
        </div>
      )}

      {/* Not logged in hint */}
      {visible && !currentUser && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] text-pubg-muted/60 text-xs bg-pubg-card/70 backdrop-blur-sm border border-pubg-border rounded-lg px-4 py-2">
          登录后可发送弹幕
        </div>
      )}
    </>
  )
}