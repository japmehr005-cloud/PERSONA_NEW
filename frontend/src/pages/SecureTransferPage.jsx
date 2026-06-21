import { useEffect, useRef, useState } from 'react'
import nodeClient from '../api/nodeClient'

// This device's stable id (persisted) — the "real" device the session binds to.
function getDeviceId() {
  let id = localStorage.getItem('cbotp_device_id')
  if (!id) {
    id = 'device-' + Math.random().toString(36).slice(2, 10)
    localStorage.setItem('cbotp_device_id', id)
  }
  return id
}

const STEP = {
  IDLE: 'IDLE',
  DEVICE: 'DEVICE', // session created, waiting for device approval
  OTP: 'OTP', // device approved, OTP generated, awaiting entry
  RESULT: 'RESULT' // success or rejected
}

const REJECT_LABEL = {
  NO_SESSION: 'No active session bound to this OTP',
  SESSION_EXPIRED: 'Session time window expired',
  WRONG_DEVICE: 'OTP used from a device not bound to the session',
  NOT_ACTIVATED: 'Session was never approved on the device',
  NO_OTP: 'No OTP was generated for this session',
  OTP_EXPIRED: 'OTP expired',
  OTP_REUSED: 'OTP already used (replay blocked)',
  OTP_MISMATCH: 'Incorrect OTP',
  WRONG_OWNER: 'Session belongs to a different user'
}

function Badge({ level }) {
  const color =
    level === 'HIGH' ? 'var(--danger)' : level === 'MEDIUM' ? 'var(--warn)' : 'var(--success)'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase"
      style={{ background: color + '30', color }}
    >
      {level}
    </span>
  )
}

export default function SecureTransferPage() {
  const deviceId = getDeviceId()

  const [amount, setAmount] = useState('75000')
  const [recipient, setRecipient] = useState('Unknown Beneficiary')
  const [forceRisk, setForceRisk] = useState('AUTO')

  const [step, setStep] = useState(STEP.IDLE)
  const [risk, setRisk] = useState(null)
  const [session, setSession] = useState(null)
  const [otp, setOtp] = useState('')
  const [issuedOtp, setIssuedOtp] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [logs, setLogs] = useState([])

  const timerRef = useRef(null)

  const addLog = (text, kind = 'info') =>
    setLogs((prev) => [{ id: Date.now() + Math.random(), text, kind, at: new Date() }, ...prev].slice(0, 40))

  // Live countdown for session expiry
  useEffect(() => {
    if (!session?.expiresAt) return undefined
    timerRef.current = setInterval(() => {
      setRemaining(Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)))
    }, 250)
    return () => clearInterval(timerRef.current)
  }, [session?.expiresAt])

  const reset = () => {
    setStep(STEP.IDLE)
    setRisk(null)
    setSession(null)
    setOtp('')
    setIssuedOtp('')
    setOtpInput('')
    setResult(null)
    setRemaining(0)
  }

  // ---- Main happy-path flow ----
  const startTransfer = async () => {
    reset()
    setLoading(true)
    try {
      const { data } = await nodeClient.post('/cb-otp/transfer', {
        amount: Number(amount),
        recipient,
        deviceId,
        forceRisk: forceRisk === 'AUTO' ? undefined : forceRisk
      })
      setRisk({ level: data.riskLevel, score: data.riskScore, reasons: data.reasons })
      addLog(`Risk engine → ${data.riskLevel} (${data.riskScore})`, data.riskLevel === 'HIGH' ? 'warn' : 'success')

      if (!data.requiresOtp) {
        setResult({ ok: true, message: 'Low risk — transaction executed directly. No OTP required.' })
        setStep(STEP.RESULT)
        addLog('Transaction executed directly (no OTP needed).', 'success')
        return
      }
      setSession(data.session)
      setStep(STEP.DEVICE)
      addLog(`Secure session created (${data.session.id.slice(0, 8)}…) bound to device ${deviceId}`, 'info')
    } catch (err) {
      addLog('Transfer failed: ' + (err.response?.data?.error || err.message), 'error')
    } finally {
      setLoading(false)
    }
  }

  const approveDevice = async () => {
    setLoading(true)
    try {
      const { data } = await nodeClient.post(`/cb-otp/session/${session.id}/activate`, { deviceId })
      setSession(data.session)
      addLog('Device approved → session ACTIVE', 'success')
      // immediately generate the OTP bound to this session
      const otpRes = await nodeClient.post(`/cb-otp/session/${session.id}/otp`, { deviceId })
      setIssuedOtp(otpRes.data.otp)
      setOtp(otpRes.data.otp)
      setSession(otpRes.data.session)
      setStep(STEP.OTP)
      addLog(`OTP ${otpRes.data.otp} generated & linked to session ${session.id.slice(0, 8)}…`, 'success')
    } catch (err) {
      addLog('Activation failed: ' + (err.response?.data?.message || err.message), 'error')
    } finally {
      setLoading(false)
    }
  }

  const submitOtp = async (overrideDevice, overrideSessionId, overrideOtp) => {
    setLoading(true)
    const useSessionId = overrideSessionId ?? session?.id
    try {
      const { data } = await nodeClient.post(`/cb-otp/session/${useSessionId}/validate`, {
        otp: overrideOtp ?? otpInput ?? otp,
        deviceId: overrideDevice ?? deviceId
      })
      setResult({ ok: true, message: data.message })
      setStep(STEP.RESULT)
      addLog('OTP accepted in valid context → transaction EXECUTED ✓', 'success')
    } catch (err) {
      const d = err.response?.data || {}
      const reason = REJECT_LABEL[d.code] || d.message || err.message
      setResult({ ok: false, code: d.code, message: reason })
      setStep(STEP.RESULT)
      addLog(`Transaction REJECTED → ${d.code}: ${reason}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // ---- Attack simulations ----
  // Each spins up its own fresh HIGH-risk session so it can be triggered independently.
  const setupHighRiskSession = async () => {
    const { data } = await nodeClient.post('/cb-otp/transfer', {
      amount: 90000,
      recipient: 'Attacker Test',
      deviceId,
      forceRisk: 'HIGH'
    })
    const s = data.session
    await nodeClient.post(`/cb-otp/session/${s.id}/activate`, { deviceId })
    const otpRes = await nodeClient.post(`/cb-otp/session/${s.id}/otp`, { deviceId })
    return { session: otpRes.data.session, otp: otpRes.data.otp }
  }

  const attackNoSession = async () => {
    setLoading(true)
    addLog('ATTACK 1 ▶ correct-looking OTP but NO session…', 'warn')
    try {
      const fakeId = 'nonexistent-session-00000000'
      await nodeClient.post(`/cb-otp/session/${fakeId}/validate`, { otp: '123456', deviceId })
      addLog('Unexpected success!', 'error')
    } catch (err) {
      const d = err.response?.data || {}
      addLog(`Blocked ✓ → ${d.code}: ${REJECT_LABEL[d.code] || d.message}`, 'success')
    } finally {
      setLoading(false)
    }
  }

  const attackWrongDevice = async () => {
    setLoading(true)
    addLog('ATTACK 2 ▶ correct OTP but WRONG device…', 'warn')
    try {
      const { session: s, otp: realOtp } = await setupHighRiskSession()
      addLog(`Prepared valid session ${s.id.slice(0, 8)}… with real OTP ${realOtp}`, 'info')
      await nodeClient.post(`/cb-otp/session/${s.id}/validate`, {
        otp: realOtp,
        deviceId: 'attacker-device-666'
      })
      addLog('Unexpected success!', 'error')
    } catch (err) {
      const d = err.response?.data || {}
      addLog(`Blocked ✓ → ${d.code}: ${REJECT_LABEL[d.code] || d.message}`, 'success')
    } finally {
      setLoading(false)
    }
  }

  const attackExpired = async () => {
    setLoading(true)
    addLog('ATTACK 3 ▶ correct OTP but EXPIRED session…', 'warn')
    try {
      const { session: s, otp: realOtp } = await setupHighRiskSession()
      addLog(`Prepared valid session ${s.id.slice(0, 8)}… with real OTP ${realOtp}`, 'info')
      await nodeClient.post(`/cb-otp/session/${s.id}/force-expire`, {})
      addLog('Forced session to expire…', 'info')
      await nodeClient.post(`/cb-otp/session/${s.id}/validate`, { otp: realOtp, deviceId })
      addLog('Unexpected success!', 'error')
    } catch (err) {
      const d = err.response?.data || {}
      addLog(`Blocked ✓ → ${d.code}: ${REJECT_LABEL[d.code] || d.message}`, 'success')
    } finally {
      setLoading(false)
    }
  }

  // Manual reuse attack from the live OTP screen
  const forceExpireLive = async () => {
    if (!session) return
    await nodeClient.post(`/cb-otp/session/${session.id}/force-expire`, {})
    addLog('You force-expired the live session — now try submitting the OTP.', 'warn')
    const { data } = await nodeClient.get(`/cb-otp/session/${session.id}`).catch(() => ({ data: {} }))
    if (data.session) setSession(data.session)
  }

  const expiryPct = session?.expiresAt
    ? Math.max(0, Math.min(100, (remaining / 120) * 100))
    : 0

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">Secure Transfer · Context-Bound OTP</h1>
      <p className="text-sm text-[var(--text-muted)] mb-2">
        An OTP here is worthless on its own. It only works inside an <b>active</b>, <b>device-bound</b>,
        <b> time-limited</b> session — and only <b>once</b>.
      </p>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        This device id: <span className="font-mono text-[var(--accent)]">{deviceId}</span>
      </p>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* LEFT — flow */}
        <div className="space-y-6">
          {/* Transfer form */}
          <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">1 · Initiate transfer</h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-[var(--text-muted)]">Amount (₹)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Recipient</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-[var(--text-muted)]">Risk (demo override)</label>
              <div className="flex gap-2 mt-1">
                {['AUTO', 'LOW', 'HIGH'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForceRisk(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      forceRisk === r
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'bg-[var(--bg)] text-[var(--text-muted)] border-[var(--border)]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">
                AUTO = amount-based (≥ ₹50,000 is HIGH). Force HIGH to always trigger the CB-OTP flow.
              </p>
            </div>
            <button
              type="button"
              onClick={startTransfer}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-50"
            >
              {loading && step === STEP.IDLE ? 'Checking…' : 'Send money'}
            </button>

            {risk && (
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[var(--text-muted)]">Risk level:</span>
                  <Badge level={risk.level} />
                  <span className="text-xs text-[var(--text-muted)]">score {risk.score}</span>
                </div>
                <ul className="text-xs text-[var(--text-muted)] list-disc ml-4">
                  {(risk.reasons || []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Security verification (HIGH risk) */}
          {step !== STEP.IDLE && risk?.level === 'HIGH' && (
            <section className="rounded-xl bg-[var(--surface)] border border-[var(--danger)]/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[var(--text)]">🔐 Security verification required</h2>
                {session?.expiresAt && step !== STEP.RESULT && (
                  <span
                    className="text-xs font-mono px-2 py-1 rounded"
                    style={{
                      background: remaining > 20 ? 'var(--success)20' : 'var(--danger)20',
                      color: remaining > 20 ? 'var(--success)' : 'var(--danger)'
                    }}
                  >
                    ⏳ {remaining}s
                  </span>
                )}
              </div>

              {session?.expiresAt && step !== STEP.RESULT && (
                <div className="h-1.5 w-full bg-[var(--bg)] rounded mb-4 overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: `${expiryPct}%`,
                      background: remaining > 20 ? 'var(--success)' : 'var(--danger)'
                    }}
                  />
                </div>
              )}

              {/* Step indicators */}
              <div className="flex items-center gap-2 mb-5 text-xs">
                {['Device approval', 'Enter OTP', 'Result'].map((label, i) => {
                  const active =
                    (i === 0 && step === STEP.DEVICE) ||
                    (i === 1 && step === STEP.OTP) ||
                    (i === 2 && step === STEP.RESULT)
                  const done =
                    (i === 0 && (step === STEP.OTP || step === STEP.RESULT)) ||
                    (i === 1 && step === STEP.RESULT)
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
                          active
                            ? 'bg-[var(--accent)] text-white'
                            : done
                            ? 'bg-[var(--success)] text-black'
                            : 'bg-[var(--bg)] text-[var(--text-muted)]'
                        }`}
                      >
                        {done ? '✓' : i + 1}
                      </span>
                      <span className={active ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}>{label}</span>
                      {i < 2 && <span className="text-[var(--text-muted)]">→</span>}
                    </div>
                  )
                })}
              </div>

              {step === STEP.DEVICE && (
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-3">
                    Step 1 — Approve this transfer on your registered device.
                  </p>
                  <button
                    type="button"
                    onClick={approveDevice}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold disabled:opacity-50"
                  >
                    📱 Approve on this device
                  </button>
                </div>
              )}

              {step === STEP.OTP && (
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-2">
                    Step 2 — Enter the OTP linked to this session.
                  </p>
                  <div className="mb-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-2 text-sm text-[var(--text)]">
                    Demo OTP (bound to this session): <span className="font-mono font-bold">{issuedOtp}</span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="6-digit OTP"
                      maxLength={6}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] font-mono tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={() => submitOtp()}
                      disabled={loading}
                      className="px-4 py-2 rounded-lg bg-[var(--success)] text-black font-semibold disabled:opacity-50"
                    >
                      Verify & Send
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => submitOtp('attacker-device-666', undefined, issuedOtp)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--danger)]/40 text-[var(--danger)]"
                    >
                      Try from wrong device
                    </button>
                    <button
                      type="button"
                      onClick={forceExpireLive}
                      className="px-3 py-1.5 rounded-lg border border-[var(--warn)]/40 text-[var(--warn)]"
                    >
                      Force-expire session
                    </button>
                  </div>
                </div>
              )}

              {step === STEP.RESULT && result && (
                <div
                  className={`rounded-lg border p-4 ${
                    result.ok
                      ? 'border-[var(--success)]/40 bg-[var(--success)]/10'
                      : 'border-[var(--danger)]/40 bg-[var(--danger)]/10'
                  }`}
                >
                  <p
                    className="font-bold mb-1"
                    style={{ color: result.ok ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {result.ok ? '✓ Transaction executed' : '✕ Transaction rejected'}
                  </p>
                  <p className="text-sm text-[var(--text)]">{result.message}</p>
                  {result.code && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">Reason code: {result.code}</p>
                  )}
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-[var(--text)] text-sm"
                  >
                    Start over
                  </button>
                </div>
              )}
            </section>
          )}

          {/* LOW risk result */}
          {step === STEP.RESULT && risk?.level !== 'HIGH' && result && (
            <section className="rounded-xl bg-[var(--surface)] border border-[var(--success)]/40 p-5">
              <p className="font-bold text-[var(--success)] mb-1">✓ Transaction executed</p>
              <p className="text-sm text-[var(--text)]">{result.message}</p>
              <button
                type="button"
                onClick={reset}
                className="mt-3 px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] text-[var(--text)] text-sm"
              >
                Start over
              </button>
            </section>
          )}

          {/* Attack simulations */}
          <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-1">🧪 Attack simulations</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Each spins up a valid HIGH-risk session with a real OTP, then attacks it. Watch the event log.
            </p>
            <div className="grid sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={attackNoSession}
                disabled={loading}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] disabled:opacity-50"
              >
                1 · Correct OTP, no session
              </button>
              <button
                type="button"
                onClick={attackWrongDevice}
                disabled={loading}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] disabled:opacity-50"
              >
                2 · Correct OTP, wrong device
              </button>
              <button
                type="button"
                onClick={attackExpired}
                disabled={loading}
                className="px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] disabled:opacity-50"
              >
                3 · Correct OTP, expired session
              </button>
            </div>
          </section>
        </div>

        {/* RIGHT — event log */}
        <div>
          <section className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 sticky top-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-[var(--text)]">Event log</h2>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                clear
              </button>
            </div>
            <div className="space-y-1.5 max-h-[70vh] overflow-y-auto font-mono text-xs">
              {logs.length === 0 && (
                <p className="text-[var(--text-muted)]">No events yet. Start a transfer or run an attack.</p>
              )}
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="flex gap-2"
                  style={{
                    color:
                      l.kind === 'error'
                        ? 'var(--danger)'
                        : l.kind === 'success'
                        ? 'var(--success)'
                        : l.kind === 'warn'
                        ? 'var(--warn)'
                        : 'var(--text-muted)'
                  }}
                >
                  <span className="opacity-60">
                    {l.at.toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span>{l.text}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
