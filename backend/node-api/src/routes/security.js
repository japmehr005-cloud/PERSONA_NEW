import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { addXP, checkAchievements } from '../services/xpService.js'

const SECURITY_CHECKS = [
  {
    id: 'two_fa',
    label: 'Two-Factor Authentication (2FA)',
    description: 'Authenticator app or SMS',
    icon: '🔐',
    profileKey: 'twoFaEnabled',
    points: 15,
    includeInChecks: true
  },
  {
    id: 'biometric',
    label: 'Biometric Login',
    description: 'Face ID or Fingerprint unlock',
    icon: '🧬',
    profileKey: 'biometricEnabled',
    points: 15,
    includeInChecks: true
  },
  {
    id: 'alerts',
    label: 'Transaction Alerts',
    description: 'Instant SMS + email on every transaction',
    icon: '🔔',
    profileKey: 'alertsEnabled',
    points: 15,
    includeInChecks: true
  },
  {
    id: 'location_lock',
    label: 'Login Location Lock',
    description: 'Restrict access to India only',
    icon: '📍',
    profileKey: 'locationLock',
    points: 15,
    includeInChecks: true
  },
  {
    id: 'session_timeout',
    label: 'Auto Session Timeout',
    description: 'Lock after 5 minutes of inactivity',
    icon: '⏱️',
    profileKey: 'sessionTimeout',
    points: 10,
    includeInChecks: true
  },
  {
    id: 'large_transaction_confirm',
    label: 'Large Transaction Confirmation',
    description: 'Extra confirmation for amounts over Rs 50,000',
    icon: '💳',
    profileKey: 'largeTransactionConfirm',
    points: 15,
    includeInChecks: true
  },
  {
    id: 'new_device_alert',
    label: 'New Device Alert',
    description: 'Get notified on login from any new device',
    icon: '📱',
    profileKey: 'newDeviceAlert',
    points: 15,
    includeInChecks: true
  },
  {
    id: 'card_freeze',
    label: 'Card Freeze',
    description: 'Freeze all card-based debit transactions',
    icon: '🧊',
    profileKey: 'cardFreeze',
    points: 0,
    includeInChecks: false
  }
]

function computeScore(profile) {
  let score = 0
  const checks = SECURITY_CHECKS.filter((c) => c.includeInChecks).map((c) => {
    const enabled = profile?.[c.profileKey] ?? false
    if (enabled) score += c.points
    return {
      id: c.id,
      label: c.label,
      description: c.description,
      icon: c.icon,
      points: c.points,
      enabled
    }
  })
  return { score, checks }
}

const router = express.Router()
router.use(authMiddleware)

router.get('/score', async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    })
    const { score, checks } = computeScore(profile)
    return res.json({ score, checks, cardFrozen: !!profile?.cardFreeze })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch security score' })
  }
})

router.put('/toggle', async (req, res) => {
  try {
    const { checkId, enabled } = req.body
    const c = SECURITY_CHECKS.find((x) => x.id === checkId)
    if (!c) return res.status(400).json({ error: 'Invalid checkId' })

    const profileBefore = await prisma.userProfile.findUnique({
      where: { userId: req.user.id }
    })
    const scoreBefore = computeScore(profileBefore).score

    const profile = await prisma.userProfile.update({
      where: { userId: req.user.id },
      data: { [c.profileKey]: !!enabled }
    })
    const { score } = computeScore(profile)

    if (enabled && score >= 90 && scoreBefore < 90) {
      await addXP(req.user.id, 100)
      await checkAchievements(req.user.id)
    }
    if (enabled && c.points > 0) await addXP(req.user.id, 10)

    return res.json({
      score,
      checks: computeScore(profile).checks,
      cardFrozen: !!profile.cardFreeze
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to toggle' })
  }
})

router.get('/risk-events', async (req, res) => {
  try {
    const events = await prisma.riskEvent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
    return res.json(events)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch risk events' })
  }
})

router.get('/sessions', async (req, res) => {
  try {
    const sessions = await prisma.userSession.findMany({
      where: { userId: req.user.id, isActive: true },
      orderBy: { loginAt: 'desc' }
    })
    return res.json(sessions.map((s) => ({
      id: s.id,
      deviceId: s.deviceId.slice(0, 8) + '...',
      isTrustedDevice: s.isTrustedDevice,
      loginAt: s.loginAt
    })))
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

export default router
