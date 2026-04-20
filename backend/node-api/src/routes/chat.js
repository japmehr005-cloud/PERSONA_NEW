import express from 'express'
import axios from 'axios'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { addXP } from '../services/xpService.js'

const router = express.Router()

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

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { id: userId, name: userName } = req.user
    const { message, conversationHistory } = req.body

    const [profile, gamification, goals] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.gamification.findUnique({ where: { userId } }),
      prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
    ])

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found. Please complete account setup first.' })
    }

    const totalIncome = profile.salary + profile.otherIncome
    const totalExpenses = profile.rent + profile.food + profile.transport +
      profile.subscriptions + profile.entertainment + profile.miscExpenses
    const monthlySavings = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0
    const primaryGoal = goals[0] || null
    const primaryGoalPct = primaryGoal && primaryGoal.targetAmount > 0
      ? (primaryGoal.savedAmount / primaryGoal.targetAmount) * 100
      : 0
    const monthsToGoal = primaryGoal && monthlySavings > 0
      ? Math.ceil((primaryGoal.targetAmount - primaryGoal.savedAmount) / monthlySavings)
      : 0

    const userContext = {
      name: userName || 'there',
      salary: profile.salary,
      otherIncome: profile.otherIncome,
      rent: profile.rent,
      food: profile.food,
      transport: profile.transport,
      subscriptions: profile.subscriptions,
      entertainment: profile.entertainment,
      miscExpenses: profile.miscExpenses,
      balance: profile.balance,
      investments: profile.investments,
      savingsRate: Math.round(savingsRate * 10) / 10,
      streakDays: gamification?.streakDays || 0,
      xp: gamification?.xp || 0,
      level: gamification?.level || 1,
      primaryGoalName: primaryGoal?.name || 'No goal set',
      primaryGoalPct: Math.round(primaryGoalPct * 10) / 10,
      monthsToGoal,
      kycVerified: profile.kycVerified,
      securityScore: computeSecurityScore(profile)
    }

    const { data } = await axios.post(
      `${process.env.PYTHON_API_URL}/chat/`,
      {
        message,
        conversationHistory: conversationHistory || [],
        userContext
      }
    )

    await addXP(userId, 3)

    const userMessage = String(req.body.message || '').toLowerCase()
    const aiResponse = data.reply

    const transferPatterns = [
      'transfer', 'send money', 'move funds', 'send to',
      'wire', 'pay to', 'remit', 'send ₹', 'transfer ₹'
    ]

    const purchasePatterns = [
      'buy', 'purchase', 'spend', 'pay for', 'buying',
      'want to get', 'going to buy', 'should i buy',
      'can i buy', 'afford', 'splurge'
    ]

    const investmentPatterns = [
      'invest', 'put money', 'move to', 'shift to',
      'put in', 'fd', 'fixed deposit', 'mutual fund',
      'sip', 'stocks', 'shares', 'crypto', 'gold'
    ]

    const urgencyPatterns = [
      'right now', 'immediately', 'urgent', 'asap',
      'quickly', 'fast', 'hurry', 'now', 'instant',
      'emergency', 'they are waiting', 'please just',
      'dont ask', 'just do it', 'need this done',
      'waiting for me', 'person is waiting', 'he is waiting',
      'she is waiting', 'they need', 'told me to'
    ]

    const IMMEDIATE_ALERT_WORDS = [
      'panic', 'scam', 'scared', 'afraid', 'fear',
      'threatening', 'threatened', 'blackmail', 'blackmailing',
      'kidnap', 'ransom', 'police', 'arrested', 'arrest',
      'forced', 'forcing', 'help me', 'please help',
      'dont tell', 'keep secret', 'secret transfer',
      'someone is watching', 'being watched', 'surveillance',
      'danger', 'dangerous', 'unsafe', 'not safe',
      'coerced', 'coercion', 'pressure', 'pressured',
      'gun', 'knife', 'weapon', 'hurt', 'harm',
      'fraud', 'hacked', 'compromised', 'stolen',
      'impersonat', 'fake officer', 'fake police',
      'cyber crime', 'cybercrime', 'rbi called',
      'bank called', 'income tax', 'tax notice',
      'court notice', 'legal notice', 'arrest warrant'
    ]

    const immediateAlert = IMMEDIATE_ALERT_WORDS.some(word => userMessage.includes(word))

    if (immediateAlert || data?.distressDetected) {
      return res.json({
        ...data,
        reply: aiResponse,
        immediateAlert: true,
        alertType: 'DISTRESS_SIGNAL',
        alertMessage: 'We detected something in your message that concerns us.',
        safetyMessage: 'If you are in danger or being pressured, you can type your panic phrase or close the app. Your account is being protected.',
        intentCheckSuggested: true,
        detectedAction: 'distress_signal',
        detectedAmount: 0,
        severity: 'CRITICAL'
      })
    }

    const amountRegex = /(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*(k|thousand|lakh|lac|crore|l|cr)?/gi
    const amounts = []
    for (const match of userMessage.matchAll(amountRegex)) {
      const raw = Number(String(match[1] || '').replace(/,/g, ''))
      if (!Number.isFinite(raw)) continue
      const suffix = String(match[2] || '').toLowerCase()
      let multiplier = 1
      if (suffix === 'k' || suffix === 'thousand') multiplier = 1000
      else if (suffix === 'lakh' || suffix === 'lac' || suffix === 'l') multiplier = 100000
      else if (suffix === 'crore' || suffix === 'cr') multiplier = 10000000
      amounts.push(raw * multiplier)
    }
    const detectedAmount = amounts.length > 0 ? Math.max(...amounts) : 0

    const matchedTransfer = transferPatterns.some(p => userMessage.includes(p))
    const matchedPurchase = purchasePatterns.some(p => userMessage.includes(p))
    const matchedInvestment = investmentPatterns.some(p => userMessage.includes(p))
    const matchedUrgency = urgencyPatterns.some(p => userMessage.includes(p))

    const financialActionDetected = matchedTransfer || matchedPurchase || matchedInvestment || matchedUrgency

    if (financialActionDetected && (detectedAmount > 500 || matchedUrgency)) {
      const detectedAction = matchedTransfer
        ? 'transfer'
        : matchedPurchase
          ? 'purchase'
          : matchedInvestment
            ? 'investment'
            : 'financial action'
      const intentSeverity = matchedUrgency
        ? 'HIGH'
        : detectedAmount > 50000
          ? 'HIGH'
          : detectedAmount > 10000
            ? 'MEDIUM'
            : 'LOW'

      return res.json({
        ...data,
        reply: aiResponse,
        financialActionDetected: true,
        detectedAmount,
        detectedAction,
        intentCheckSuggested: true,
        severity: intentSeverity,
        urgencyDetected: matchedUrgency,
        intentMessage: matchedUrgency
          ? 'I noticed some urgency in your message. Before any action, let me make sure you are safe.'
          : 'I noticed you mentioned a financial action. Would you like me to help you execute this safely?'
      })
    }

    return res.json({
      ...data,
      financialActionDetected: false,
      detectedAmount: 0,
      detectedAction: null,
      intentCheckSuggested: false,
      severity: null,
      urgencyDetected: false,
      intentMessage: null
    })
  } catch (err) {
    console.error('Chat route error:', err.message)
    res.status(500).json({ message: 'Chat failed', error: err.message })
  }
})

router.get('/health', authMiddleware, async (req, res) => {
  try {
    const { data } = await axios.get(`${process.env.PYTHON_API_URL}/chat/health`)
    res.json(data)
  } catch {
    res.json({ running: false, modelLoaded: false })
  }
})

export default router
