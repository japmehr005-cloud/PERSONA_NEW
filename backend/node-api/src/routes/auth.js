import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../lib/prisma.js'
import { updateStreak } from '../services/streakService.js'
import { checkAchievements } from '../services/xpService.js'

const router = express.Router()
const ACCESS_EXPIRY = '15m'
const REFRESH_EXPIRY = '7d'

function signAccess(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRY })
}

function signRefresh(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY })
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password and name required' })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ message: 'Email already registered' })

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          profile: {
            create: {
              kycVerified: false,
              twoFaEnabled: false,
              biometricEnabled: false,
              alertsEnabled: false,
              locationLock: false,
              sessionTimeout: false,
              largeTransactionConfirm: false,
              newDeviceAlert: false,
              cardFreeze: false
            }
          },
          gamification: { create: {} }
        },
        select: { id: true, email: true, name: true, createdAt: true }
      })
    })
    return res.status(201).json({ user })
  } catch (err) {
    console.error(err)
    return res.status(500).json({
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message
    })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password, deviceId } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' })

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true, gamification: true }
    })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' })

    const did = deviceId || uuidv4()
    let session = await prisma.userSession.findFirst({
      where: { userId: user.id, deviceId: did, isActive: true }
    })
    const isTrustedDevice = !!session
    if (!session) {
      session = await prisma.userSession.create({
        data: { userId: user.id, deviceId: did, isTrustedDevice: false }
      })
    }

    const { newStreak } = await updateStreak(user.id)
    await checkAchievements(user.id)

    const payload = { userId: user.id, sessionId: session.id }
    const accessToken = signAccess(payload)
    const refreshToken = signRefresh(payload)

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    const { passwordHash: _, ...safeUser } = user
    return res.json({
      user: safeUser,
      profile: user.profile,
      gamification: user.gamification,
      accessToken,
      streakDays: newStreak
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({
      message: 'Login failed',
      error: process.env.NODE_ENV === 'production' ? undefined : err.message
    })
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken
    if (!token) return res.status(401).json({ error: 'No refresh token' })

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET)
    const accessToken = signAccess({ userId: decoded.userId, sessionId: decoded.sessionId })
    return res.json({ accessToken })
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' })
  }
})

router.post('/logout', async (req, res) => {
  const token = req.cookies?.refreshToken
  if (token) {
    try {
      const decoded = jwt.decode(token)
      if (decoded?.sessionId) {
        await prisma.userSession.update({
          where: { id: decoded.sessionId },
          data: { isActive: false }
        })
      }
    } catch (_) {}
  }
  res.clearCookie('refreshToken')
  return res.json({ ok: true })
})

export default router
