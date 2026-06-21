import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { riskGate } from '../middleware/riskGate.js'
import { prisma } from '../lib/prisma.js'
import { addXP } from '../services/xpService.js'

const router = express.Router()
router.use(authMiddleware)

router.post('/check', riskGate, async (req, res) => {
  const riskResult = req.riskResult || {}
  return res.json({
    decision: riskResult.decision || 'ALLOW',
    riskScore: riskResult.riskScore || 0,
    riskLevel: riskResult.riskLevel || 'LOW',
    triggeredSignals: riskResult.triggeredSignals || [],
    explanation: riskResult.explanation || {},
    recommendation: riskResult.recommendation || ''
  })
})

router.post('/splurge/confirm', async (req, res) => {
  try {
    const userId = req.user.id
    const amount = Number(req.body.amount || 0)
    const description = req.body.description || 'Splurge purchase confirmed'

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' })
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId } })
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }
    if (Number(profile.balance || 0) < amount) {
      return res.status(400).json({ error: 'Insufficient balance' })
    }

    const [updatedProfile, transaction] = await prisma.$transaction([
      prisma.userProfile.update({
        where: { userId },
        data: { balance: { decrement: amount } }
      }),
      prisma.transaction.create({
        data: {
          userId,
          type: 'debit',
          category: 'splurge',
          amount,
          label: description || 'Splurge purchase'
        }
      })
    ])

    await addXP(userId, 2)

    return res.json({
      newBalance: updatedProfile.balance,
      transaction,
      xpAwarded: 2
    })
  } catch (err) {
    console.error('Splurge confirm error:', err.message)
    return res.status(500).json({ error: 'Failed to confirm splurge spend' })
  }
})

export default router
