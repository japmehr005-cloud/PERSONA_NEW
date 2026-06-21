import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { addXP } from '../services/xpService.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const goals = await prisma.goal.findMany({
      where: { userId: req.user.id },
      orderBy: { targetDate: 'asc' }
    })
    const withPct = goals.map((g) => ({
      ...g,
      pctComplete: g.targetAmount > 0 ? Math.min(100, (g.savedAmount / g.targetAmount) * 100) : 0
    }))
    return res.json(withPct)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch goals' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { name, targetAmount, targetDate, savedAmount } = req.body
    if (!name || targetAmount == null) return res.status(400).json({ error: 'Name and targetAmount required' })

    const goal = await prisma.goal.create({
      data: {
        userId: req.user.id,
        name,
        targetAmount: Number(targetAmount),
        savedAmount: Number(savedAmount) || 0,
        targetDate: targetDate ? new Date(targetDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      }
    })
    await addXP(req.user.id, 15)
    return res.status(201).json(goal)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to create goal' })
  }
})

router.put('/:id', async (req, res) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (!existing) return res.status(404).json({ error: 'Goal not found' })

    const data = { ...req.body }
    if (data.targetDate) data.targetDate = new Date(data.targetDate)
    if (data.savedAmount >= existing.targetAmount) data.isCompleted = true

    const goal = await prisma.goal.update({
      where: { id: req.params.id },
      data
    })

    return res.json(goal)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update goal' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const existing = await prisma.goal.findFirst({
      where: { id: req.params.id, userId: req.user.id }
    })
    if (!existing) return res.status(404).json({ error: 'Goal not found' })
    await prisma.goal.delete({ where: { id: req.params.id } })
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to delete goal' })
  }
})

export default router
