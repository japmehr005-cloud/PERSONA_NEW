import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true }
    })
    if (!user) {
      return res.status(401).json({ error: 'User not found' })
    }
    req.user = { ...user, sessionId: decoded.sessionId }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export const authenticateToken = authMiddleware
