import { useState, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import api from '@/api/index'
import { useStore } from '@/store/useStore'

interface Comment {
  id: string
  nickname: string
  content: string
  createdAt: string
}

export default function CommentSection({ pageId }: { pageId: string }) {
  const currentUser = useStore((s) => s.currentUser)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [posting, setPosting] = useState(false)

  const fetchComments = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/social/comments/${pageId}`)
      setComments(res.data.data || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComments()
  }, [pageId])

  const handlePost = async () => {
    if (!input.trim() || posting) return
    setPosting(true)
    try {
      await api.post('/social/comments', {
        pageId,
        content: input.trim(),
      })
      setInput('')
      await fetchComments()
    } catch {
      // silent
    } finally {
      setPosting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePost()
    }
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    return d.toLocaleDateString('zh-CN')
  }

  return (
    <div className="pubg-card">
      <h3 className="text-lg font-bold text-white mb-4">评论</h3>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-pubg-muted text-sm animate-pulse">数据加载中...</div>
        </div>
      ) : (
        <div className="space-y-4 mb-4 max-h-80 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-pubg-muted text-sm text-center py-4">暂无评论，来写第一条吧</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-pubg-orange/20 flex items-center justify-center text-sm font-bold text-pubg-orange shrink-0">
                {comment.nickname?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{comment.nickname}</span>
                  <span className="text-xs text-pubg-muted">{formatTime(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-pubg-text leading-relaxed break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {currentUser && (
        <div className="flex gap-3 border-t border-pubg-border pt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入评论..."
            className="flex-1 bg-pubg-dark border border-pubg-border rounded-lg px-4 py-2 text-sm text-white placeholder-pubg-muted focus:outline-none focus:border-pubg-orange transition-colors"
          />
          <button
            onClick={handlePost}
            disabled={posting || !input.trim()}
            className="pubg-btn px-4 py-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {posting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            发送
          </button>
        </div>
      )}
    </div>
  )
}
