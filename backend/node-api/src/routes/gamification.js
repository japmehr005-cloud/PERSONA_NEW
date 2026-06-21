import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { addXP, checkAchievements, LEVELS, ACHIEVEMENTS } from '../services/xpService.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const g = await prisma.gamification.findUnique({
      where: { userId: req.user.id }
    })
    if (!g) return res.status(404).json({ error: 'Gamification not found' })

    const currentLevel = g.level
    const nextThreshold = LEVELS[currentLevel] ?? LEVELS[LEVELS.length - 1]
    const prevThreshold = LEVELS[currentLevel - 1] ?? 0
    const progressToNextLevel = nextThreshold > prevThreshold
      ? ((g.xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100
      : 100

    const unlockedIds = (Array.isArray(g.achievements) ? g.achievements : []).map((a) =>
      typeof a === 'object' ? a.id : a
    )
    const achievementsWithStatus = ACHIEVEMENTS.map((a) => ({
      ...a,
      isUnlocked: unlockedIds.includes(a.id)
    }))

    return res.json({
      xp: g.xp,
      level: g.level,
      streakDays: g.streakDays,
      achievements: achievementsWithStatus,
      simCount: g.simCount,
      nextLevelXP: nextThreshold,
      progressToNextLevel
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch gamification' })
  }
})

router.post('/xp', async (req, res) => {
  try {
    const { amount } = req.body
    const amt = Number(amount) || 0
    if (amt <= 0) return res.status(400).json({ error: 'Positive amount required' })

    const result = await addXP(req.user.id, amt)
    const newAchievements = await checkAchievements(req.user.id)

    return res.json({
      newXP: result.newXP,
      newLevel: result.newLevel,
      leveledUp: result.leveledUp,
      newAchievements
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to add XP' })
  }
})

router.post('/sim-count', async (req, res) => {
  try {
    const updated = await prisma.gamification.update({
      where: { userId: req.user.id },
      data: { simCount: { increment: 1 } },
      select: { simCount: true }
    })
    return res.json({ simCount: updated.simCount })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to increment sim count' })
  }
})

router.get('/achievements', async (req, res) => {
  try {
    const g = await prisma.gamification.findUnique({
      where: { userId: req.user.id }
    })
    const unlockedIds = (Array.isArray(g?.achievements) ? g.achievements : []).map((a) =>
      typeof a === 'object' ? a.id : a
    )
    const list = ACHIEVEMENTS.map((a) => ({
      ...a,
      isUnlocked: unlockedIds.includes(a.id)
    }))
    return res.json(list)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch achievements' })
  }
})

export default router
