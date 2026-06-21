import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import nodeClient from '../api/nodeClient'

function getDeviceId() {
  let id = localStorage.getItem('persona_deviceId')
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'dev-' + Math.random().toString(36).slice(2)
    localStorage.setItem('persona_deviceId', id)
  }
  return id
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useStore((s) => s.setAuth)
  const setProfile = useStore((s) => s.setProfile)
  const setGamification = useStore((s) => s.setGamification)

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('[LoginPage] handleSubmit called', { isLogin, email: email ? '***' : '(empty)' })

    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const payload = { email, password, deviceId: getDeviceId() }
        console.log('[LoginPage] Calling POST /api/auth/login with', { ...payload, password: password ? '***' : '(empty)' })

        const { data } = await nodeClient.post('/auth/login', payload)

        console.log('[LoginPage] Login success', { hasUser: !!data.user, hasToken: !!data.accessToken })

        setAuth(data.user, data.accessToken)
        setProfile(data.profile)
        setGamification(data.gamification)
        navigate('/dashboard')
      } else {
        await nodeClient.post('/auth/register', { email, password, name })
        setError('')
        setIsLogin(true)
        setPassword('')
      }
    } catch (err) {
      console.error('[LoginPage] Login/register failed', err)
      const isNetworkError = !err.response && (err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network'))
      if (isNetworkError) {
        setError('Cannot connect to server. Is the API running on port 3001?')
      } else {
        setError(err.response?.data?.message ?? err.response?.data?.error ?? err.message ?? 'Invalid email or password')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-8">
        <h1 className="text-2xl font-bold text-[var(--accent)] mb-2">PERSONA</h1>
        <p className="text-sm text-[var(--text-muted)] mb-2">SecureWealth Twin — Your wealth, protected.</p>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          No account yet? Click &quot;Don&apos;t have an account? Register&quot; below, then log in with the same email and password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              required
              autoComplete="email"
            />
          </div>
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                required
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
          >
            {loading ? '...' : isLogin ? 'Log in' : 'Register'}
          </button>
          {error && (
            <p className="text-sm text-[var(--danger)] text-center mt-2" role="alert">
              {error}
            </p>
          )}
        </form>

        <button
          type="button"
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="mt-4 w-full text-sm text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          {isLogin ? "Don't have an account? Register" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
