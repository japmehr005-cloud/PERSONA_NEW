import axios from 'axios'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'

export async function riskGate(req, res, next) {
  const userId = req.user.userId || req.user.id
  const { sessionId } = req.user
  const intentConfirmed = String(req.headers['x-intent-confirmed'] || '').toLowerCase() === 'true'
  const actionType = req.body.actionType || 'GENERIC'

  if (intentConfirmed) {
    console.log('Intent confirmed bypass for userId:', userId)
    if (redis) {
      const ts = Date.now()
      await redis.set(`intent_confirmed:${userId}:${ts}`, actionType, 'EX', 3600).catch(() => null)
    }
    return next()
  }

  const session = await prisma.userSession.findUnique({ where: { id: sessionId } })
  const profile = await prisma.userProfile.findUnique({ where: { userId } })
  const conversationalProfile = await prisma.conversationalProfile.findUnique({ where: { userId } })

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

  const monthlySavings = profile
    ? (
        (Number(profile.salary || 0) + Number(profile.otherIncome || 0)) -
        (
          Number(profile.rent || 0) +
          Number(profile.food || 0) +
          Number(profile.transport || 0) +
          Number(profile.subscriptions || 0) +
          Number(profile.entertainment || 0) +
          Number(profile.miscExpenses || 0)
        )
      )
    : 0

  const riskPayload = {
    userId,
    actionType,
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

    // Local additive signal for high balance-percentage splurges.
    let boostedScore = Number(riskResult.riskScore || 0)
    const boostedSignals = [...(riskResult.triggeredSignals || [])]
    const boostedExplanation = { ...(riskResult.explanation || {}) }
    const splurgePct = Number(req.body.splurgePercentageOfBalance || 0)
    if (req.body.isHighPercentageSplurge === true) {
      const boost = splurgePct > 75 ? 55 : 35
      boostedScore += boost
      boostedSignals.push('Large Percentage of Balance')
      boostedExplanation['Large Percentage of Balance'] =
        `This purchase represents more than 50% of your current balance (+${boost} points)`
    }

    let boostedDecision = riskResult.decision
    let boostedLevel = riskResult.riskLevel
    let boostedMessage = riskResult.message
    let boostedRecommendation = riskResult.recommendation

    if (boostedScore >= 90) {
      boostedDecision = 'CRITICAL_BLOCK'
      boostedLevel = 'CRITICAL'
      boostedMessage = 'This action has been blocked for your protection'
      boostedRecommendation = 'This action cannot be overridden'
    } else if (boostedScore >= 60) {
      boostedDecision = 'BLOCK'
      boostedLevel = 'HIGH'
    } else if (boostedScore >= 30) {
      boostedDecision = 'WARN'
      boostedLevel = 'MEDIUM'
    } else {
      boostedDecision = 'ALLOW'
      boostedLevel = 'LOW'
    }

    await prisma.riskEvent.create({
      data: {
        userId,
        actionType: riskPayload.actionType,
        amount: riskPayload.amount,
        riskScore: boostedScore,
        riskLevel: boostedLevel,
        decision: boostedDecision,
        triggeredSignals: boostedSignals
      }
    })

    if (boostedScore >= 90 || boostedDecision === 'CRITICAL_BLOCK') {
      return res.status(403).json({
        blocked: true,
        critical: true,
        decision: 'CRITICAL_BLOCK',
        message: 'This action has been blocked for your protection',
        signals: boostedSignals,
        riskScore: boostedScore,
        riskLevel: boostedLevel
      })
    }

    const baselineMature = Number(conversationalProfile?.totalMessagesSampled || 0) >= 5
    const significantBySavings =
      Number(monthlySavings || 0) > 0 &&
      Number(riskPayload.amount || 0) > Number(monthlySavings) * 0.3
    const shouldIntentCheckMature =
      baselineMature &&
      boostedScore >= 20 &&
      boostedScore <= 89 &&
      significantBySavings
    const shouldIntentCheckNewUser =
      !baselineMature &&
      boostedScore >= 25 &&
      boostedScore <= 89

    if (shouldIntentCheckMature || shouldIntentCheckNewUser) {
      return res.status(202).json({
        requiresIntentCheck: true,
        riskScore: boostedScore,
        riskLevel: boostedLevel,
        signals: boostedSignals,
        triggeredSignals: boostedSignals,
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
        explanation: boostedExplanation,
        recommendation: boostedRecommendation,
        baselineMature,
        totalMessagesSampled: Number(conversationalProfile?.totalMessagesSampled || 0)
      })
    }

    if (boostedDecision === 'BLOCK') {
      return res.status(403).json({
        blocked: true,
        riskScore: boostedScore,
        riskLevel: boostedLevel,
        message: boostedMessage,
        explanation: boostedExplanation,
        recommendation: boostedRecommendation
      })
    }

    req.riskResult = {
      ...riskResult,
      riskScore: boostedScore,
      riskLevel: boostedLevel,
      decision: boostedDecision,
      triggeredSignals: boostedSignals,
      explanation: boostedExplanation,
      message: boostedMessage,
      recommendation: boostedRecommendation
    }
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
