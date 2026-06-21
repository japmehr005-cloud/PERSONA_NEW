import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { addXP } from '../services/xpService.js'
import {
  createSession,
  activateSession,
  generateOtp,
  validateOtp,
  forceExpire,
  getSession,
  publicSession,
  SESSION_STATUS
} from '../services/cbOtpService.js'

const router = express.Router()
router.use(authMiddleware)

/**
 * Lightweight risk evaluation for the CB-OTP demo.
 * Mirrors the platform's LOW / MEDIUM / HIGH engine but is self-contained so
 * the demo always works. `forceRisk` lets the demo deterministically drive a
 * LOW or HIGH path from the UI.
 */
function evaluateRisk({ amount, forceRisk }) {
  if (forceRisk === 'LOW') return { riskLevel: 'LOW', riskScore: 10, reasons: ['Demo override: forced LOW'] }
  if (forceRisk === 'HIGH') return { riskLevel: 'HIGH', riskScore: 85, reasons: ['Demo override: forced HIGH'] }

  const amt = Number(amount) || 0
  const reasons = []
  let score = 0
  if (amt >= 50000) {
    score += 70
    reasons.push(`High-value transfer (₹${amt.toLocaleString('en-IN')})`)
  } else if (amt >= 10000) {
    score += 35
    reasons.push(`Above-average transfer (₹${amt.toLocaleString('en-IN')})`)
  } else {
    reasons.push('Routine low-value transfer')
  }
  const riskLevel = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW'
  return { riskLevel, riskScore: score, reasons }
}

async function executeTransaction({ userId, amount, recipient }) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } })
  const transaction = await prisma.transaction.create({
    data: {
      userId,
      type: 'debit',
      category: 'transfer',
      amount: Number(amount) || 0,
      label: `Transfer to ${recipient || 'beneficiary'}`
    }
  })
  if (profile) {
    await prisma.userProfile
      .update({ where: { userId }, data: { balance: { decrement: Number(amount) || 0 } } })
      .catch(() => null)
  }
  await addXP(userId, 5).catch(() => null)
  return transaction
}

/**
 * Entry point. Runs the risk engine.
 *   LOW  -> execute immediately
 *   HIGH -> open a CB-OTP session (device-bound) and require the OTP flow
 */
router.post('/transfer', async (req, res) => {
  try {
    const userId = req.user.id
    const { amount, recipient, deviceId, forceRisk } = req.body
    if (amount == null || Number(amount) <= 0) {
      return res.status(400).json({ error: 'A valid amount is required' })
    }
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required (device binding)' })
    }

    const risk = evaluateRisk({ amount, forceRisk })
    console.log(`[CB-OTP] /transfer user=${userId} amount=${amount} risk=${risk.riskLevel}(${risk.riskScore})`)

    if (risk.riskLevel === 'LOW' || risk.riskLevel === 'MEDIUM') {
      const transaction = await executeTransaction({ userId, amount, recipient })
      console.log('[CB-OTP] LOW/MEDIUM risk — transaction executed directly.')
      return res.json({
        requiresOtp: false,
        executed: true,
        riskLevel: risk.riskLevel,
        riskScore: risk.riskScore,
        reasons: risk.reasons,
        transaction
      })
    }

    // HIGH risk -> Context-Bound OTP flow
    const session = createSession({
      userId,
      deviceId,
      amount,
      recipient,
      actionType: 'TRANSFER',
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore
    })

    return res.json({
      requiresOtp: true,
      executed: false,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      reasons: risk.reasons,
      session: publicSession(session)
    })
  } catch (err) {
    console.error('[CB-OTP] /transfer error:', err.message)
    return res.status(500).json({ error: 'Failed to start transfer' })
  }
})

// Step 2 — simulate device approval
router.post('/session/:id/activate', (req, res) => {
  const userId = req.user.id
  const { deviceId } = req.body
  const result = activateSession({ sessionId: req.params.id, userId, deviceId })
  if (!result.ok) {
    return res.status(409).json({ ok: false, code: result.code, message: result.message })
  }
  return res.json({ ok: true, session: publicSession(result.session) })
})

// Step 3 — generate an OTP bound to the session
router.post('/session/:id/otp', (req, res) => {
  const userId = req.user.id
  const { deviceId } = req.body
  const result = generateOtp({ sessionId: req.params.id, userId, deviceId })
  if (!result.ok) {
    return res.status(409).json({ ok: false, code: result.code, message: result.message })
  }
  // Demo-only: we return the OTP so it can be shown on screen.
  return res.json({
    ok: true,
    otp: result.otp,
    demoNote: 'OTP returned in response for demo visibility only.',
    session: publicSession(result.session)
  })
})

// Step 4 — validate OTP under strict context rules, then execute
router.post('/session/:id/validate', async (req, res) => {
  try {
    const userId = req.user.id
    const { otp, deviceId } = req.body
    const result = validateOtp({ sessionId: req.params.id, userId, deviceId, otp })

    if (!result.ok) {
      console.log(`[CB-OTP] Transaction REJECTED reason=${result.code}`)
      return res.status(403).json({
        ok: false,
        executed: false,
        code: result.code,
        message: result.message
      })
    }

    const { amount, recipient } = result.session
    const transaction = await executeTransaction({ userId, amount, recipient })
    console.log(`[CB-OTP] Transaction EXECUTED via CB-OTP session=${result.session.id} amount=${amount}`)

    return res.json({
      ok: true,
      executed: true,
      message: 'OTP verified in valid context — transaction executed.',
      transaction,
      session: publicSession(result.session)
    })
  } catch (err) {
    console.error('[CB-OTP] /validate error:', err.message)
    return res.status(500).json({ error: 'Validation failed' })
  }
})

// Read session status (for the expiry countdown on the frontend)
router.get('/session/:id', (req, res) => {
  const session = getSession(req.params.id)
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' })
  }
  return res.json({ session: publicSession(session) })
})

// Attack-sim helper: force a session to expire immediately
router.post('/session/:id/force-expire', (req, res) => {
  const session = getSession(req.params.id)
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' })
  }
  const result = forceExpire(req.params.id)
  return res.json({ ok: result.ok, session: publicSession(getSession(req.params.id)) })
})

export { SESSION_STATUS }
export default router
