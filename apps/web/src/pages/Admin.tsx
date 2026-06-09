import { useState, useEffect } from 'react'
import { Shield, Trash2, Edit3, Save, X, Database, Server, Users, Activity, HardDrive, Clock, Smartphone, ChevronDown, ChevronUp, RefreshCw, Brain, Key, FileText, Eye, EyeOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import api from '@/api'

interface AdminUser {
  id: string
  nickname: string
  pubgId: string
  createdAt: string
  stats: { matches: number; kills: number; damage: number; wins: number } | null
}

interface ServerStats {
  uptime: number
  userCount: number
  matchCount: number
  dbSize: number
  memory: { rss: number; heapTotal: number; heapUsed: number }
  platform: string
  nodeVersion: string
}

export default function Admin() {
  const navigate = useNavigate()
  const currentUser = useStore((s) => s.currentUser)

  const [loggedIn, setLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [editPubgId, setEditPubgId] = useState('')
  const [showStats, setShowStats] = useState(false)
  const [showAiConfig, setShowAiConfig] = useState(false)
  const [loading, setLoading] = useState(false)
  const [aiForm, setAiForm] = useState({ ai_api_key: '', ai_base_url: '', ai_model: '', ai_weekly_prompt: '', ai_match_prompt: '' })
  const [showKey, setShowKey] = useState(false)
  const [savingAi, setSavingAi] = useState(false)

  const handleLogin = () => {
    if (password === 'pubg123') {
      setLoggedIn(true)
      setError('')
    } else {
      setError('密码错误')
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [userRes, statsRes, configRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
        api.get('/admin/config'),
      ])
      setUsers(userRes.data?.data || [])
      setStats(statsRes.data?.data)
      const configData = configRes.data?.data || {}
      setAiForm({
        ai_api_key: configData.ai_api_key || '',
        ai_base_url: configData.ai_base_url || 'https://api.openai.com/v1',
        ai_model: configData.ai_model || 'gpt-4o',
        ai_weekly_prompt: configData.ai_weekly_prompt || '',
        ai_match_prompt: configData.ai_match_prompt || '',
      })
    } catch {
      setError('获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loggedIn) fetchData()
  }, [loggedIn])

  const handleDelete = async (pubgId: string) => {
    if (!window.confirm(`确定删除用户 ${pubgId}？此操作不可恢复！`)) return
    try {
      await api.delete(`/admin/user/${pubgId}`)
      setUsers((prev) => prev.filter((u) => u.pubgId !== pubgId))
    } catch {
      setError('删除失败')
    }
  }

  const handleSync = async (pubgId: string) => {
    try {
      const res = await api.post(`/admin/sync/${pubgId}`)
      alert(res.data?.message || '同步完成')
      fetchData()
    } catch (err: any) {
      const msg = err.response?.data?.message || '同步失败'
      alert(msg)
    }
  }

  const handleSaveAiConfig = async () => {
    setSavingAi(true)
    try {
      for (const [key, value] of Object.entries(aiForm)) {
        if (value) {
          await api.post('/admin/config', { key, value })
        }
      }
      alert('AI 配置保存成功！')
      setShowAiConfig(false)
      fetchData()
    } catch {
      alert('保存失败')
    } finally {
      setSavingAi(false)
    }
  }

  const startEdit = (user: AdminUser) => {
    setEditingId(user.id)
    setEditNickname(user.nickname)
    setEditPubgId(user.pubgId)
  }

  const handleSave = async (originalPubgId: string) => {
    try {
      const body: any = {}
      if (editNickname.trim()) body.nickname = editNickname.trim()
      if (editPubgId.trim() && editPubgId.trim() !== originalPubgId) body.newPubgId = editPubgId.trim()

      if (Object.keys(body).length === 0) {
        setEditingId(null)
        return
      }

      const res = await api.put(`/admin/user/${originalPubgId}`, body)
      setEditingId(null)
      fetchData()
      alert(`修改成功！${body.newPubgId ? 'PUBG ID 已变更，用户需要重新登录才能看到更新。' : '昵称已更新。'}`)
    } catch (err: any) {
      alert(err.response?.data?.message || '修改失败')
    }
  }

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return `${d}天 ${h}时 ${m}分`
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  if (!loggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="pubg-card p-6 sm:p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-pubg-orange" />
            <h1 className="text-2xl font-black text-white">管理员</h1>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-pubg-muted mb-1">管理密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-pubg-orange"
                placeholder="请输入管理密码"
                autoFocus
              />
            </div>
            {error && <p className="text-pubg-red text-sm">{error}</p>}
            <button onClick={handleLogin} className="w-full pubg-btn py-3 text-sm font-bold">
              进入管理面板
            </button>
            <button onClick={() => navigate(-1)} className="w-full text-pubg-muted text-sm hover:text-white transition-colors">
              返回
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-6 sm:w-8 h-6 sm:h-8 text-pubg-orange" />
          <div>
            <h1 className="pubg-title mb-1">管理面板</h1>
            <p className="pubg-subtitle">用户管理 & 服务器状态</p>
          </div>
        </div>
        <button onClick={() => setLoggedIn(false)} className="text-sm text-pubg-muted hover:text-white transition-colors touch-btn">
          退出管理
        </button>
      </div>

      {/* 服务器状态 */}
      <div className="pubg-card p-4 sm:p-6">
        <button
          onClick={() => setShowStats(!showStats)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-pubg-orange" />
            <h2 className="text-base sm:text-lg font-bold text-white">服务器状态</h2>
          </div>
          {showStats ? <ChevronUp className="w-4 h-4 text-pubg-muted" /> : <ChevronDown className="w-4 h-4 text-pubg-muted" />}
        </button>

        {showStats && stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
            <div className="bg-pubg-dark rounded-lg p-3 text-center">
              <Clock className="w-4 h-4 mx-auto mb-1 text-pubg-blue" />
              <div className="text-sm sm:text-lg font-bold text-white">{formatUptime(stats.uptime)}</div>
              <div className="text-xs text-pubg-muted">运行时间</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-3 text-center">
              <Users className="w-4 h-4 mx-auto mb-1 text-pubg-orange" />
              <div className="text-sm sm:text-lg font-bold text-white">{stats.userCount}</div>
              <div className="text-xs text-pubg-muted">注册用户</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-3 text-center">
              <Activity className="w-4 h-4 mx-auto mb-1 text-pubg-green" />
              <div className="text-sm sm:text-lg font-bold text-white">{stats.matchCount}</div>
              <div className="text-xs text-pubg-muted">比赛记录</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-3 text-center">
              <Database className="w-4 h-4 mx-auto mb-1 text-pubg-yellow" />
              <div className="text-sm sm:text-lg font-bold text-white">{formatBytes(stats.dbSize)}</div>
              <div className="text-xs text-pubg-muted">数据库大小</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-3 text-center col-span-2">
              <HardDrive className="w-4 h-4 mx-auto mb-1 text-pubg-muted" />
              <div className="text-xs sm:text-sm font-bold text-white">堆内存: {formatBytes(stats.memory.heapUsed)} / {formatBytes(stats.memory.heapTotal)}</div>
              <div className="text-xs text-pubg-muted">RSS: {formatBytes(stats.memory.rss)}</div>
            </div>
            <div className="bg-pubg-dark rounded-lg p-3 text-center col-span-2">
              <Smartphone className="w-4 h-4 mx-auto mb-1 text-pubg-muted" />
              <div className="text-xs sm:text-sm font-bold text-white">{stats.platform} | Node {stats.nodeVersion}</div>
              <div className="text-xs text-pubg-muted">运行环境</div>
            </div>
          </div>
        )}
        {showStats && !stats && (
          <div className="flex items-center justify-center py-6 sm:py-8 text-pubg-muted text-sm">
            {loading ? '加载中...' : '暂无数据'}
          </div>
        )}
      </div>

      {/* AI 配置 */}
      <div className="pubg-card p-4 sm:p-6">
        <button
          onClick={() => setShowAiConfig(!showAiConfig)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-3">
            <Brain className="w-5 h-5 text-pubg-orange" />
            <h2 className="text-base sm:text-lg font-bold text-white">AI 配置</h2>
          </div>
          {showAiConfig ? <ChevronUp className="w-4 h-4 text-pubg-muted" /> : <ChevronDown className="w-4 h-4 text-pubg-muted" />}
        </button>

        {showAiConfig && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-pubg-muted mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5" /> API Key
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={aiForm.ai_api_key}
                    onChange={(e) => setAiForm({ ...aiForm, ai_api_key: e.target.value })}
                    className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-3 py-2 text-sm text-white pr-10"
                    placeholder="sk-..."
                  />
                  <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-pubg-muted hover:text-white">
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm text-pubg-muted mb-1">API 地址</label>
                <input
                  type="text"
                  value={aiForm.ai_base_url}
                  onChange={(e) => setAiForm({ ...aiForm, ai_base_url: e.target.value })}
                  className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="block text-sm text-pubg-muted mb-1">模型</label>
                <input
                  type="text"
                  value={aiForm.ai_model}
                  onChange={(e) => setAiForm({ ...aiForm, ai_model: e.target.value })}
                  className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-3 py-2 text-sm text-white"
                  placeholder="gpt-4o"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-pubg-muted mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> 周报提示词（用 {'{data}'} 占位）
              </label>
              <textarea
                value={aiForm.ai_weekly_prompt}
                onChange={(e) => setAiForm({ ...aiForm, ai_weekly_prompt: e.target.value })}
                rows={6}
                className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-3 py-2 text-sm text-white font-mono"
                placeholder="自定义周报提示词..."
              />
            </div>

            <div>
              <label className="block text-sm text-pubg-muted mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> 战报提示词（用 {'{nickname}'}、{'{map}'} 等占位）
              </label>
              <textarea
                value={aiForm.ai_match_prompt}
                onChange={(e) => setAiForm({ ...aiForm, ai_match_prompt: e.target.value })}
                rows={6}
                className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-3 py-2 text-sm text-white font-mono"
                placeholder="自定义战报提示词..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowAiConfig(false)} className="px-4 py-2 text-sm text-pubg-muted hover:text-white transition-colors">
                取消
              </button>
              <button
                onClick={handleSaveAiConfig}
                disabled={savingAi}
                className="pubg-btn flex items-center gap-2"
              >
                {savingAi ? (
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                保存配置
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 用户列表 */}
      <div className="pubg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 pb-0 flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-pubg-orange" />
            注册用户
          </h2>
          <button onClick={fetchData} className="text-xs sm:text-sm text-pubg-muted hover:text-pubg-orange transition-colors touch-btn">
            刷新
          </button>
        </div>
        <div className="overflow-x-auto mt-4">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-pubg-border">
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">昵称</th>
                <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">PUBG ID</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium hidden sm:table-cell">场次</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium hidden sm:table-cell">击杀</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium hidden lg:table-cell">伤害</th>
                <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium hidden sm:table-cell">注册时间</th>
                <th className="text-center py-2 sm:py-3 px-3 sm:px-4 text-pubg-muted text-xs sm:text-sm font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-pubg-border/50 hover:bg-white/5 transition-colors">
                  {editingId === user.id ? (
                    <>
                      <td className="py-2 px-3 sm:px-4">
                        <input
                          value={editNickname}
                          onChange={(e) => setEditNickname(e.target.value)}
                          className="w-full bg-pubg-dark border border-pubg-border rounded px-2 py-1 text-xs sm:text-sm text-white"
                        />
                      </td>
                      <td className="py-2 px-3 sm:px-4">
                        <input
                          value={editPubgId}
                          onChange={(e) => setEditPubgId(e.target.value)}
                          className="w-full bg-pubg-dark border border-pubg-border rounded px-2 py-1 text-xs sm:text-sm text-white"
                        />
                      </td>
                      <td className="py-2 px-3 sm:px-4 hidden sm:table-cell text-right text-xs sm:text-sm text-pubg-muted">{user.stats?.matches || 0}</td>
                      <td className="py-2 px-3 sm:px-4 hidden sm:table-cell text-right text-xs sm:text-sm text-pubg-muted">{user.stats?.kills || 0}</td>
                      <td className="py-2 px-3 sm:px-4 hidden lg:table-cell text-right text-xs sm:text-sm text-pubg-muted">{user.stats?.damage || 0}</td>
                      <td className="py-2 px-3 sm:px-4 hidden sm:table-cell text-right text-xs sm:text-sm text-pubg-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 px-3 sm:px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleSave(user.pubgId)} className="text-pubg-green hover:text-pubg-green/80 touch-btn" title="保存">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-pubg-muted hover:text-white touch-btn" title="取消">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 text-white font-medium text-sm">{user.nickname}</td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 text-pubg-text text-xs sm:text-sm">{user.pubgId}</td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 hidden sm:table-cell text-right text-xs sm:text-sm text-pubg-muted">{user.stats?.matches || 0}</td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 hidden sm:table-cell text-right text-xs sm:text-sm text-pubg-orange font-bold">{user.stats?.kills || 0}</td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 hidden lg:table-cell text-right text-xs sm:text-sm text-pubg-muted">{user.stats?.damage || 0}</td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 hidden sm:table-cell text-right text-xs sm:text-sm text-pubg-muted">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 sm:py-3 px-3 sm:px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => startEdit(user)} className="text-pubg-blue hover:text-pubg-blue/80 touch-btn" title="编辑">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleSync(user.pubgId)} className="text-pubg-green hover:text-pubg-green/80 touch-btn" title="重新同步">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(user.pubgId)} className="text-pubg-red hover:text-pubg-red/80 touch-btn" title="删除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="text-center py-8 sm:py-12 text-pubg-muted text-sm">暂无注册用户</div>
          )}
        </div>
      </div>
    </div>
  )
}
