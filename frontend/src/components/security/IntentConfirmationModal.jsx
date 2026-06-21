import { useEffect, useMemo, useState } from 'react'
import nodeClient from '../../api/nodeClient'

function normalizeSignal(signal) {
  if (typeof signal === 'string') {
    return { name: signal, explanation: '' }
  }
  return {
    name: signal?.name || 'Signal',
    explanation: signal?.explanation || ''
  }
}

function getRiskLevel(score) {
  if (score > 70) return 'CRITICAL'
  if (score > 45) return 'HIGH'
  if (score > 20) return 'MEDIUM'
  return 'LOW'
}

export default function IntentConfirmationModal({ data, onConfirm, onCancel }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [sending, setSending] = useState(false)
  const [analysis, setAnalysis] = useState(data || {})
  const [scheduledAt, setScheduledAt] = useState(null)
  const [manualConfirmFallback, setManualConfirmFallback] = useState(false)

  useEffect(() => {
    setAnalysis(data || {})
    const initialMessage = data?.chatbot_message || 'Before we proceed, please confirm this action in your own words.'
    setMessages([{ role: 'assistant', content: initialMessage }])
  }, [data])

  useEffect(() => {
    if (analysis?.recommended_action === 'SILENT_BLOCK') {
      const timer = setTimeout(() => onCancel?.(), 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [analysis?.recommended_action, onCancel])

  const riskScore = Number(analysis?.deviation_score ?? analysis?.riskScore ?? 0)
  const riskLevel = analysis?.risk_level || getRiskLevel(riskScore)
  const signals = (analysis?.triggered_signals || analysis?.signals || []).map(normalizeSignal)
  const pendingRequestData = useMemo(() => {
    try {
      return typeof data?.pendingRequest?.data === 'string'
        ? JSON.parse(data.pendingRequest.data)
        : (data?.pendingRequest?.data || {})
    } catch {
      return {}
    }
  }, [data])

  const actionType = analysis?.actionType || data?.actionType || pendingRequestData?.actionType || 'GENERIC_ACTION'
  const actionDetails = {
    amount: pendingRequestData?.amount ?? data?.actionDetails?.amount,
    recipient: pendingRequestData?.recipient ?? data?.actionDetails?.recipient
  }

  async function sendIntentMessage() {
    if (!input.trim() || sending) return
    const text = input.trim()
    const lowerText = text.toLowerCase()

    if (manualConfirmFallback) {
      setMessages((prev) => [...prev, { role: 'user', content: text }])
      setInput('')
      if (['yes', 'y', 'proceed'].includes(lowerText)) {
        await onConfirm?.()
        onCancel?.()
        return
      }
      if (['no', 'n', 'cancel'].includes(lowerText)) {
        onCancel?.()
        return
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Please reply with yes or no so I can continue safely.' }
      ])
      return
    }

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setSending(true)
    try {
      const { data: next } = await nodeClient.post('/intent/check', {
        message: text,
        actionType,
        actionDetails,
        conversationalDeviationScore: riskScore
      })
      setAnalysis((prev) => ({ ...prev, ...next }))
      setMessages((prev) => [...prev, { role: 'assistant', content: next.chatbot_message || 'Thanks. I processed your response.' }])
      if (next.recommended_action === 'COOLING_OFF') {
        const at = new Date(Date.now() + 4 * 60 * 60 * 1000)
        setScheduledAt(at)
      }
    } catch {
      setManualConfirmFallback(true)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I had trouble analysing that. Please confirm manually — do you want to proceed with this action? (yes/no)'
        }
      ])
    } finally {
      setSending(false)
    }
  }

  async function handleProceed() {
    await onConfirm?.()
    onCancel?.()
  }

  function handleSchedule() {
    const at = new Date(Date.now() + 4 * 60 * 60 * 1000)
    setScheduledAt(at)
    setAnalysis((prev) => ({ ...prev, recommended_action: 'COOLING_OFF' }))
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-gray-900 border border-[var(--border)] shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text)]">Let us confirm this with you</h3>
              <p className="text-sm text-[var(--text-muted)]">Before we proceed, answer one quick question</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--warn)]/20 text-[var(--warn)]">
              Score {riskScore} · {riskLevel}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
          <div className="space-y-2">
            {messages.map((msg, idx) => (
              <div key={`${msg.role}-${idx}`} className={`max-w-[80%] ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                <div
                  className={`px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-purple-600 to-violet-700 text-white rounded-br-sm'
                      : 'bg-gray-800 border border-[var(--border)] text-[var(--text)] rounded-bl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your response..."
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              disabled={sending || analysis?.recommended_action === 'SILENT_BLOCK'}
            />
            <button
              type="button"
              onClick={sendIntentMessage}
              disabled={sending || analysis?.recommended_action === 'SILENT_BLOCK'}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-50"
            >
              Send
            </button>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="w-full px-3 py-2 flex items-center justify-between text-sm text-[var(--text)]"
            >
              <span>Why are we asking?</span>
              <span>{expanded ? '▾' : '▸'}</span>
            </button>
            {expanded && (
              <div className="p-3 border-t border-[var(--border)] space-y-2">
                {signals.length === 0 && <p className="text-xs text-[var(--text-muted)]">No additional signals.</p>}
                {signals.map((sig, i) => (
                  <div key={`${sig.name}-${i}`} className="rounded-lg border border-[var(--border)] bg-gray-800 p-2">
                    <p className="text-xs font-semibold text-[var(--text)]">{sig.name}</p>
                    {sig.explanation && <p className="text-xs text-[var(--text-muted)] mt-1">{sig.explanation}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border)]">
          {analysis?.recommended_action === 'PROCEED_WITH_CONFIRMATION' && (
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--text)] text-sm">Cancel</button>
              <button type="button" onClick={handleProceed} className="px-3 py-2 rounded-lg bg-[var(--success)] text-black text-sm font-semibold">Yes, proceed with this action</button>
            </div>
          )}

          {analysis?.recommended_action === 'EXPLAIN_AND_RECONFIRM' && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--text)] text-sm">Cancel, I will think about it</button>
              <button type="button" onClick={handleSchedule} className="px-3 py-2 rounded-lg bg-purple-700 text-white text-sm">Schedule for 4 hours later</button>
              <button type="button" onClick={handleProceed} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">I understand, proceed anyway</button>
            </div>
          )}

          {analysis?.recommended_action === 'COOLING_OFF' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-[var(--warn)]/40 bg-[var(--warn)]/10 p-3 text-sm text-[var(--text)]">
                Your request has been saved. We will process it at {scheduledAt ? scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'later'}.
                You can cancel anytime from the Security page.
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={onCancel} className="px-3 py-2 rounded-lg border border-red-400 text-red-300 text-sm">Cancel this scheduled action</button>
              </div>
            </div>
          )}

          {analysis?.recommended_action === 'SILENT_BLOCK' && (
            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <span className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
              Processing your request, this may take a few minutes...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
