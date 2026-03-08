import { useEffect, useMemo, useState } from 'react'
import nodeClient from '../api/nodeClient'
import SecurityScoreRing from '../components/security/SecurityScoreRing'
import { useStore } from '../store/useStore'

function getScoreLabel(score) {
  if (score < 50) return { text: 'At Risk 🔴', color: 'var(--danger)' }
  if (score < 80) return { text: 'Moderate 🟡', color: 'var(--warn)' }
  return { text: 'Strong 🟢', color: 'var(--success)' }
}

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - new Date(timestamp).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

function scoreBadgeColor(score) {
  if (score >= 60) return 'var(--danger)'
  if (score >= 30) return 'var(--warn)'
  return 'var(--success)'
}

export default function SecurityPage() {
  const showXPToast = useStore((s) => s.showXPToast)
  const setSecurityScore = useStore((s) => s.setSecurityScore)
  const [scoreData, setScoreData] = useState({ score: 0, checks: [], cardFrozen: false })
  const [events, setEvents] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false)

  const loadData = async () => {
    try {
      const [sRes, eRes, tRes] = await Promise.all([
        nodeClient.get('/security/score'),
        nodeClient.get('/security/risk-events'),
        nodeClient.get('/transactions')
      ])
      setScoreData(sRes.data)
      setEvents(eRes.data ?? [])
      setTransactions((tRes.data ?? []).slice(0, 5))
      setSecurityScore(sRes.data?.score ?? 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggle = async (checkId, enabled) => {
    try {
      const { data } = await nodeClient.put('/security/toggle', { checkId, enabled })
      setScoreData((prev) => ({ ...prev, ...data }))
      setSecurityScore(data.score ?? 0)
      if (enabled && checkId !== 'card_freeze') {
        showXPToast('Security upgraded', 'Great move for fraud prevention', 10)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleFreezeCard = async () => {
    try {
      const { data } = await nodeClient.put('/security/toggle', { checkId: 'card_freeze', enabled: true })
      setScoreData((prev) => ({ ...prev, ...data, cardFrozen: true }))
      setShowFreezeConfirm(false)
    } catch (err) {
      console.error(err)
    }
  }

  const riskIndexedTx = useMemo(() => {
    return transactions.map((tx) => {
      const txTime = new Date(tx.createdAt).getTime()
      const matched = events.find((e) => {
        const eTime = new Date(e.createdAt).getTime()
        const timeDelta = Math.abs(txTime - eTime)
        return timeDelta <= 15 * 60 * 1000 && Math.abs((e.amount || 0) - (tx.amount || 0)) < 1
      })
      return { ...tx, matchedRisk: matched }
    })
  }, [transactions, events])

  if (loading) {
    return <div className="text-[var(--text-muted)]">Loading security center...</div>
  }

  const score = scoreData.score ?? 0
  const checks = scoreData.checks ?? []
  const scoreLabel = getScoreLabel(score)

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-6">Security Center</h1>

      {scoreData.cardFrozen && (
        <div className="mb-4 rounded-lg border border-[var(--danger)]/60 bg-[var(--danger)]/15 p-3 text-[var(--danger)] font-semibold">
          Card Frozen 🔒
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Security Score</h2>
            <div className="flex items-center gap-5">
              <SecurityScoreRing score={score} />
              <div>
                <p className="text-sm text-[var(--text-muted)]">Score out of 100</p>
                <p className="text-3xl font-bold text-[var(--text)]">{score}</p>
                <p className="text-sm font-semibold" style={{ color: scoreLabel.color }}>{scoreLabel.text}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Security Checks</h2>
            <div className="space-y-3">
              {checks.map((check) => (
                <div key={check.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        <span className="mr-2">{check.icon}</span>
                        {check.label}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">{check.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(check.id, !check.enabled)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        check.enabled ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--surface-hover)] text-[var(--text-muted)]'
                      }`}
                    >
                      {check.enabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Fraud Alert Feed</h2>
            {events.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No risk events yet — your account looks clean ✓</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
                  const color = scoreBadgeColor(event.riskScore)
                  const decisionColor =
                    event.decision === 'BLOCK' ? 'var(--danger)' : event.decision === 'WARN' ? 'var(--warn)' : 'var(--success)'
                  const signals = Array.isArray(event.triggeredSignals) ? event.triggeredSignals : []
                  return (
                    <div key={event.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-sm font-semibold text-[var(--text)]">
                          {event.actionType} · ₹{Number(event.amount || 0).toLocaleString('en-IN')}
                        </p>
                        <span className="text-xs font-semibold px-2 py-1 rounded" style={{ background: color + '30', color }}>
                          Risk {event.riskScore}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-[var(--text-muted)]">
                          Decision: <span className="font-semibold" style={{ color: decisionColor }}>{event.decision}</span>
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{formatRelativeTime(event.createdAt)}</p>
                      </div>
                      {signals.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {signals.map((signal) => (
                            <span key={signal} className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-hover)] text-[var(--text-muted)]">
                              {signal.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Recent Transactions</h2>
            {riskIndexedTx.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No transactions yet.</p>
            ) : (
              <div className="space-y-2 mb-4">
                {riskIndexedTx.map((tx) => (
                  <div key={tx.id} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-[var(--text)]">
                          {tx.type === 'credit' ? '💰' : '💸'} {tx.label || tx.category}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">{new Date(tx.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${tx.type === 'credit' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                          {tx.type === 'credit' ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                        </p>
                        <p className={`text-xs ${tx.matchedRisk ? 'text-[var(--warn)]' : 'text-[var(--success)]'}`}>
                          {tx.matchedRisk ? '⚠ Reviewed' : '✓ Safe'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowFreezeConfirm(true)}
              className="w-full px-4 py-2 rounded-lg bg-[var(--danger)]/20 text-[var(--danger)] font-semibold border border-[var(--danger)]/40"
            >
              Freeze Card
            </button>
          </section>
        </div>
      </div>

      {showFreezeConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Freeze Card?</h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              This will lock debit card transactions until you manually unfreeze it.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowFreezeConfirm(false)} className="px-3 py-2 rounded bg-[var(--surface-hover)] text-[var(--text)]">
                Cancel
              </button>
              <button type="button" onClick={handleFreezeCard} className="px-3 py-2 rounded bg-[var(--danger)] text-white">
                Confirm Freeze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
