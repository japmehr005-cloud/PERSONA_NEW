import express from 'express'
import { authenticateToken } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import {
  analyseIntent,
  updateProfile as updateConversationalProfile,
  getOrCreateProfile,
  logConversationalRiskEvent
} from '../services/intentSecurityService.js'

const router = express.Router()

function maskPhrase(phrase) {
  if (!phrase) return null
  const trimmed = phrase.trim()
  if (trimmed.length <= 2) return '*'.repeat(trimmed.length)
  return `${trimmed[0]}${'*'.repeat(trimmed.length - 2)}${trimmed[trimmed.length - 1]}`
}

router.post('/check', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { message, actionType, actionDetails, conversationalDeviationScore } = req.body

    const detailsWithDeviation = {
      ...(actionDetails || {}),
      conversationalDeviationScore: conversationalDeviationScore || 0
    }

    const analysis = await analyseIntent(
      userId,
      message || '',
      actionType || 'GENERIC_ACTION',
      detailsWithDeviation,
      prisma
    )
    await logConversationalRiskEvent(userId, analysis, actionType || 'GENERIC_ACTION', prisma)
    return res.json(analysis)
  } catch (err) {
    console.error('Intent check failed:', err.message)
    return res.status(500).json({ error: 'Intent analysis failed' })
  }
})

router.post('/update-baseline', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { message } = req.body
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'message required' })
    }
    await updateConversationalProfile(userId, String(message), prisma)
    return res.json({ updated: true })
  } catch (err) {
    console.error('Intent baseline update failed:', err.message)
    return res.status(500).json({ error: 'Failed to update conversational baseline' })
  }
})

router.put('/safety-phrases', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { panicPhrase, safePhrase } = req.body
    await getOrCreateProfile(userId, prisma)
    await prisma.conversationalProfile.update({
      where: { userId },
      data: {
        panicPhrase: panicPhrase || null,
        safePhrase: safePhrase || null
      }
    })
    return res.json({ updated: true })
  } catch (err) {
    console.error('Failed to save safety phrases:', err.message)
    return res.status(500).json({ error: 'Failed to update safety phrases' })
  }
})

router.get('/safety-phrases', authenticateToken, async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user.id, prisma)
    return res.json({
      safePhrase: maskPhrase(profile.safePhrase),
      panicPhrase: maskPhrase(profile.panicPhrase)
    })
  } catch (err) {
    console.error('Failed to read safety phrases:', err.message)
    return res.status(500).json({ error: 'Failed to read safety phrases' })
  }
})

router.get('/conversational-status', authenticateToken, async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user.id, prisma)
    const totalMessagesSampled = Number(profile.totalMessagesSampled || 0)
    return res.json({
      totalMessagesSampled,
      baselineMature: totalMessagesSampled >= 5,
      hasPanicPhrase: Boolean(profile.panicPhrase),
      hasSafePhrase: Boolean(profile.safePhrase)
    })
  } catch (err) {
    console.error('Failed to get conversational status:', err.message)
    return res.status(500).json({ error: 'Failed to fetch conversational status' })
  }
})

export default router
