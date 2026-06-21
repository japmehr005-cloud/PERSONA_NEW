export default function RiskInterceptModal({ riskData, onConfirm, onCancel }) {
  if (!riskData) return null

  const { riskScore = 0, riskLevel, decision, message, explanation, recommendation } = riskData
  const isBlocked = decision === 'BLOCK'
  const isWarn = decision === 'WARN'
  if (decision === 'ALLOW') return null

  const scoreColor = riskScore >= 60 ? 'var(--danger)' : riskScore >= 30 ? 'var(--warn)' : 'var(--success)'
  const signalLabelMap = {
    new_device: 'New Device Detected',
    fast_action: 'Fast Action After Login',
    large_amount: 'Large Amount Spike',
    very_large_amount: 'Very Large Amount Spike',
    multiple_otp_attempts: 'Multiple OTP Attempts',
    first_time_action_type: 'First Time Action Type',
    high_retry_count: 'High Retry Count',
    very_high_amount_abs: 'Very High Absolute Amount',
    weak_security_posture: 'Weak Security Posture'
  }
  const signalCards = Object.entries(explanation || {}).map(([key, value]) => {
    const pointsMatch = String(value).match(/\(\+(\d+)\s*points\)/i)
    const points = pointsMatch ? Number(pointsMatch[1]) : null
    const text = String(value).replace(/\s*\(\+\d+\s*points\)/i, '').trim()
    return {
      key,
      label: signalLabelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase()),
      points,
      text
    }
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-xl rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-xl">
        <h3 className="text-lg font-bold text-[var(--text)] mb-2">Risk Check</h3>
        {isBlocked && (
          <div className="mb-4 p-3 rounded-lg border border-[var(--danger)]/60 bg-[var(--danger)]/15 text-[var(--danger)] font-semibold">
            Action Blocked by Fraud Protection
          </div>
        )}
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{ background: scoreColor + '20', color: scoreColor }}
          >
            {riskScore}
          </div>
          <div>
            <span
              className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase"
              style={{ background: scoreColor + '30', color: scoreColor }}
            >
              {riskLevel}
            </span>
            <p className="text-sm text-[var(--text-muted)] mt-1">{message}</p>
          </div>
        </div>

        {signalCards.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Triggered signals</p>
            <div className="space-y-2">
              {signalCards.map((sig) => (
                <div key={sig.key} className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-[var(--text)]">{sig.label}</p>
                    <span className="text-xs font-medium text-[var(--warn)]">
                      {sig.points != null ? `+${sig.points} points` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{sig.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendation && (
          <p className="text-sm text-[var(--text-muted)] mb-6">{recommendation}</p>
        )}

        <div className="flex gap-3 justify-end">
          {isBlocked && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--text)]"
            >
              OK, I understand
            </button>
          )}
          {isWarn && (
            <>
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-lg bg-[var(--surface-hover)] text-[var(--text)]"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium"
              >
                I confirm this is me →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
