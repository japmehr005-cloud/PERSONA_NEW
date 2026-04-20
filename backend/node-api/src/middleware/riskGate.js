import axios from 'axios'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'

export async function riskGate(req, res, next) {
  const userId = req.user.userId || req.user.id
  const { sessionId } = req.user
  const intentConfirmed = String(req.headers['x-intent-confirmed'] || '').toLowerCase() === 'true'

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

  let actionsLastHour = 0
  if (redis) {
    try {
      const actionKey = `actions:${userId}`
      actionsLastHour = await redis.incr(actionKey)
      if (actionsLastHour === 1) {
        await redis.expire(actionKey, 3600)
      }
    } catch (err) {
      console.warn('Redis action velocity tracking failed:', err.message)
    }
  }

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
    securityScore: req.body.securityScore ?? computeSecurityScore(profile),
    hour_of_day: new Date().getHours(),
    user_typical_hours: req.body.userTypicalHours ?? [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
    actions_last_hour: req.body.actionsLastHour ?? actionsLastHour ?? 0,
    is_new_beneficiary: req.body.isNewBeneficiary ?? false,
    previous_transfer_count_to_beneficiary: req.body.previousTransferCount ?? 0,
    conversational_deviation_score: req.body.conversationalDeviationScore ?? 0
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

    if (riskResult.riskScore >= 90 || riskResult.decision === 'CRITICAL_BLOCK') {
      return res.status(403).json({
        blocked: true,
        critical: true,
        decision: 'CRITICAL_BLOCK',
        message: 'This action has been blocked for your protection',
        signals: riskResult.triggeredSignals || [],
        riskScore: riskResult.riskScore,
        riskLevel: riskResult.riskLevel
      })
    }

    if (riskResult.riskScore >= 30 && riskResult.riskScore <= 89) {
      if (!intentConfirmed) {
        return res.status(202).json({
          requiresIntentCheck: true,
          riskScore: riskResult.riskScore,
          riskLevel: riskResult.riskLevel,
          signals: riskResult.triggeredSignals || [],
          triggeredSignals: riskResult.triggeredSignals || [],
          decision: 'INTENT_CHECK_REQUIRED',
          message: 'We need to verify your intent before proceeding',
          chatbot_message: 'Before we proceed, please confirm this action in your own words.',
          recommended_action: 'PROCEED_WITH_CONFIRMATION',
          show_cooloff_option: false,
          silent_block: false,
          actionType: riskPayload.actionType,
          actionDetails: {
            amount: riskPayload.amount,
            isNewBeneficiary: riskPayload.is_new_beneficiary
          },
          explanation: riskResult.explanation,
          recommendation: riskResult.recommendation
        })
      }
    }

    if (riskResult.decision === 'BLOCK' && !intentConfirmed) {
      return res.status(403).json({
        blocked: true,
        riskScore: riskResult.riskScore,
          riskLevel: riskResult.riskLevel,
          message: riskResult.message,
          explanation: riskResult.explanation,
          recommendation: riskResult.recommendation
        })
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
