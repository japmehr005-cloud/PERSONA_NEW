import express from 'express'
import axios from 'axios'
import { prisma } from '../lib/prisma.js'
import { authMiddleware } from '../middleware/auth.js'
import { addXP } from '../services/xpService.js'

const router = express.Router()

function parseAmountFromMessage(message) {
  const text = String(message || '').toLowerCase()
  const rupeeMatch = text.match(/₹\s*([\d,]+(?:\.\d+)?)/i)
  if (rupeeMatch) return Number(String(rupeeMatch[1]).replace(/,/g, ''))

  const kMatch = text.match(/\b(\d+(?:\.\d+)?)\s*k\b/i)
  if (kMatch) return Number(kMatch[1]) * 1000

  const thousandMatch = text.match(/\b(\d+(?:\.\d+)?)\s*thousand\b/i)
  if (thousandMatch) return Number(thousandMatch[1]) * 1000

  const lakhMatch = text.match(/\b(\d+(?:\.\d+)?)\s*lakh\b/i)
  if (lakhMatch) return Number(lakhMatch[1]) * 100000

  const rawNumber = text.match(/\b(\d{4,})\b/)
  if (rawNumber) return Number(rawNumber[1])
  return null
}

function detectFinancialAction(message) {
  const text = String(message || '').toLowerCase()
  const groups = [
    { type: 'transfer', keywords: ['transfer', 'send money', 'move funds', 'send to'] },
    { type: 'purchase', keywords: ['buy', 'purchase', 'spend', 'pay for'] },
    { type: 'investment', keywords: ['invest', 'put money', 'move to', 'shift to'] }
  ]
  for (const group of groups) {
    const found = group.keywords.find((kw) => text.includes(kw))
    if (found) return { detectedAction: found, detectedType: group.type }
  }
  return { detectedAction: null, detectedType: null }
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
    const amount = parseAmountFromMessage(message)
    const actionDetected = detectFinancialAction(message)
    const financialActionDetected = Boolean(actionDetected.detectedAction && amount && amount > 1000)

    res.json({
      ...data,
      financialActionDetected,
      detectedAmount: financialActionDetected ? amount : null,
      detectedAction: financialActionDetected ? actionDetected.detectedAction : null,
      intentCheckSuggested: financialActionDetected,
      intentMessage: financialActionDetected
        ? 'I noticed you mentioned a financial action. Would you like me to help you execute this safely?'
        : null
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
