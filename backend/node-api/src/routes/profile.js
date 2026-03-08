import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { checkAchievements } from '../services/xpService.js'

const router = express.Router()
router.use(authMiddleware)

function computeProfile(profile) {
  if (!profile) return null
  const totalIncome = (profile.salary || 0) + (profile.otherIncome || 0)
  const totalExpenses =
    (profile.rent || 0) +
    (profile.food || 0) +
    (profile.transport || 0) +
    (profile.subscriptions || 0) +
    (profile.entertainment || 0) +
    (profile.miscExpenses || 0)
  const monthlySavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0
  return {
    ...profile,
    totalIncome,
    totalExpenses,
    monthlySavings,
    savingsRate,
    kycStatus: profile.kycVerified ? 'verified' : 'pending'
  }
}

router.get('/', async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    })
    return res.json(computeProfile(profile))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

router.put('/', async (req, res) => {
  try {
    const before = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    })
    const hasDataBefore = before && (before.salary > 0 || before.rent > 0)

    const profile = await prisma.userProfile.update({
      where: { userId: req.user.id },
      data: req.body
    })

    if (!hasDataBefore && (profile.salary > 0 || profile.rent > 0)) {
      const { addXP } = await import('../services/xpService.js')
      await addXP(req.user.id, 25)
    }
    await checkAchievements(req.user.id)

    return res.json(computeProfile(profile))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update profile' })
  }
})

router.get('/summary', async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    })
    const [primaryGoal] = await prisma.goal.findMany({
      where: { userId: req.user.id, isCompleted: false },
      orderBy: { targetDate: 'asc' },
      take: 1
    })

    const totalIncome = (profile?.salary || 0) + (profile?.otherIncome || 0)
    const totalExpenses =
      (profile?.rent || 0) +
      (profile?.food || 0) +
      (profile?.transport || 0) +
      (profile?.subscriptions || 0) +
      (profile?.entertainment || 0) +
      (profile?.miscExpenses || 0)
    const savings = totalIncome - totalExpenses
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0

    let monthsToGoal = null
    if (primaryGoal && savings > 0) {
      const remaining = Math.max(0, primaryGoal.targetAmount - primaryGoal.savedAmount)
      monthsToGoal = remaining / savings
    }

    return res.json({
      balance: profile?.balance ?? 0,
      totalIncome,
      totalExpenses,
      savingsRate,
      monthsToGoal,
      primaryGoal: primaryGoal
        ? {
            name: primaryGoal.name,
            targetAmount: primaryGoal.targetAmount,
            savedAmount: primaryGoal.savedAmount,
            targetDate: primaryGoal.targetDate
          }
        : null
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch summary' })
  }
})

export default router
