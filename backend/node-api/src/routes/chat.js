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
    res.json(data)
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
