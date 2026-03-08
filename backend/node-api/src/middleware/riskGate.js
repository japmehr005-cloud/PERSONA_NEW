import axios from 'axios'
import { prisma } from '../lib/prisma.js'

export async function riskGate(req, res, next) {
  const { userId, sessionId } = req.user

  const session = await prisma.userSession.findUnique({ where: { id: sessionId } })
  const profile = await prisma.userProfile.findUnique({ where: { userId } })

  const txns = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 30
  })
  const avgAmount = txns.length ? txns.reduce((sum, t) => sum + t.amount, 0) / txns.length : 0

  const sessionAgeSeconds = session?.loginAt
    ? Math.floor((Date.now() - new Date(session.loginAt).getTime()) / 1000)
    : 999

  const riskPayload = {
    userId,
    actionType: req.body.actionType || 'GENERIC',
    amount: req.body.amount ?? 0,
    sessionAgeSeconds,
    isNewDevice: !session?.isTrustedDevice,
    otpAttempts: req.body.otpAttempts ?? 0,
    isFirstTimeActionType: req.body.isFirstTimeActionType ?? false,
    retryCount: req.body.retryCount ?? 0,
    userAvgTransactionAmount: avgAmount,
    securityScore: req.body.securityScore ?? computeSecurityScore(profile)
  }

  try {
    const { data: riskResult } = await axios.post(
      `${process.env.PYTHON_API_URL}/risk/score`,
      riskPayload,
      { timeout: 5000 }
    )

    await prisma.riskEvent.create({
      data: {
        userId,
        actionType: riskPayload.actionType,
        amount: riskPayload.amount,
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        decision: riskResult.decision,
        triggeredSignals: riskResult.triggeredSignals || []
      }
    })

    if (riskResult.decision === 'BLOCK') {
      return res.status(403).json({
        blocked: true,
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel,
        message: riskResult.message,
        explanation: riskResult.explanation,
        recommendation: riskResult.recommendation
      })
    }

    if (riskResult.decision === 'WARN') {
      if (!req.body.userConfirmed) {
        return res.status(202).json({
          requiresConfirmation: true,
          riskScore: riskResult.riskScore,
          riskLevel: riskResult.riskLevel,
          message: riskResult.message,
          explanation: riskResult.explanation,
          recommendation: riskResult.recommendation
        })
      }
    }

    req.riskResult = riskResult
    next()
  } catch (err) {
    console.error('Risk engine error:', err.message)
    return res.status(503).json({ error: 'Risk engine unavailable' })
  }
}

function computeSecurityScore(profile) {
  if (!profile) return 0
  let score = 0
  if (profile.twoFaEnabled) score += 15
  if (profile.biometricEnabled) score += 15
  if (profile.alertsEnabled) score += 15
  if (profile.locationLock) score += 15
  if (profile.sessionTimeout) score += 10
  if (profile.largeTransactionConfirm) score += 15
  if (profile.newDeviceAlert) score += 15
  return score
}
