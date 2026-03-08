import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { riskGate } from '../middleware/riskGate.js'
import { prisma } from '../lib/prisma.js'
import { addXP, checkAchievements } from '../services/xpService.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
    return res.json(transactions)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch transactions' })
  }
})

router.post('/', riskGate, async (req, res) => {
  try {
    const { type, category, amount, label } = req.body
    if (!type || !category || amount == null) {
      return res.status(400).json({ error: 'type, category and amount required' })
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.user.id,
        type,
        category,
        amount: Number(amount),
        label: label || ''
      }
    })
    await addXP(req.user.id, 5)
    await checkAchievements(req.user.id)
    return res.status(201).json(transaction)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to create transaction' })
  }
})

router.get('/stats', async (req, res) => {
  try {
    const txns = await prisma.transaction.findMany({
      where: { userId: req.user.id }
    })
    const totalCredits = txns.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0)
    const totalDebits = txns.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0)
    const byCategory = {}
    txns.filter((t) => t.type === 'debit').forEach((t) => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
    })
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
    const months = 12
    const monthlyAvg = txns.length ? (totalCredits - totalDebits) / months : 0

    return res.json({
      totalCredits,
      totalDebits,
      topCategory,
      monthlyAvg
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

export default router
