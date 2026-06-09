import { useState } from 'react'
import { Crosshair, Loader2 } from 'lucide-react'
import api from '@/api/index'

export default function LoginPage() {
  const [loginValue, setLoginValue] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [regNickname, setRegNickname] = useState('')
  const [regPubgId, setRegPubgId] = useState('')
  const [error, setError] = useState('')
  const [logging, setLogging] = useState(false)
  const [registering, setRegistering] = useState(false)

  const handleLogin = async () => {
    if (!loginValue.trim()) return
    setError('')
    setLogging(true)
    try {
      const res = await api.post('/auth/login', { input: loginValue.trim() })
      const user = res.data.data
      localStorage.setItem('current_user', JSON.stringify(user))
      window.location.href = '/'
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || '登录失败，请检查输入')
    } finally {
      setLogging(false)
    }
  }

  const handleRegister = async () => {
    if (!regNickname.trim() || !regPubgId.trim()) return
    setError('')
    setRegistering(true)
    try {
      const res = await api.post('/auth/register', {
        nickname: regNickname.trim(),
        pubgId: regPubgId.trim(),
      })
      const user = res.data.data
      localStorage.setItem('current_user', JSON.stringify(user))
      window.location.href = '/'
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || '注册失败，请重试')
    } finally {
      setRegistering(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showRegister) {
        handleRegister()
      } else {
        handleLogin()
      }
    }
  }

  return (
    <div className="min-h-screen bg-pubg-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-pubg-orange/10 border border-pubg-orange/30 mb-4">
            <Crosshair className="w-10 h-10 text-pubg-orange" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-wider">PUBG 车队战绩系统</h1>
          <p className="text-pubg-muted mt-2 text-sm">输入你的身份信息开始</p>
        </div>

        {/* Card */}
        <div className="pubg-card">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-pubg-red/10 border border-pubg-red/30 text-pubg-red text-sm">
              {error}
            </div>
          )}

          {!showRegister ? (
            /* Login Form */
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  value={loginValue}
                  onChange={(e) => setLoginValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入昵称或 PUBG ID"
                  className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-4 py-3 text-sm text-white placeholder-pubg-muted focus:outline-none focus:border-pubg-orange transition-colors"
                />
              </div>
              <button
                onClick={handleLogin}
                disabled={logging || !loginValue.trim()}
                className="w-full pubg-btn py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {logging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    登录中...
                  </>
                ) : (
                  '登录'
                )}
              </button>
              <p className="text-center">
                <button
                  onClick={() => { setShowRegister(true); setError('') }}
                  className="text-pubg-muted hover:text-pubg-orange text-sm transition-colors"
                >
                  注册新玩家
                </button>
              </p>
            </div>
          ) : (
            /* Register Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-pubg-muted mb-1">昵称</label>
                <input
                  type="text"
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入游戏昵称"
                  className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-4 py-3 text-sm text-white placeholder-pubg-muted focus:outline-none focus:border-pubg-orange transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm text-pubg-muted mb-1">PUBG ID</label>
                <input
                  type="text"
                  value={regPubgId}
                  onChange={(e) => setRegPubgId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入 PUBG ID"
                  className="w-full bg-pubg-dark border border-pubg-border rounded-lg px-4 py-3 text-sm text-white placeholder-pubg-muted focus:outline-none focus:border-pubg-orange transition-colors"
                />
              </div>
              <button
                onClick={handleRegister}
                disabled={registering || !regNickname.trim() || !regPubgId.trim()}
                className="w-full pubg-btn py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {registering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    注册中...
                  </>
                ) : (
                  '注册'
                )}
              </button>
              <p className="text-center">
                <button
                  onClick={() => { setShowRegister(false); setError('') }}
                  className="text-pubg-muted hover:text-pubg-orange text-sm transition-colors"
                >
                  返回登录
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
