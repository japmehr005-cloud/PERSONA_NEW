import { prisma } from '../lib/prisma.js'

export async function updateStreak(userId) {
  const gami = await prisma.gamification.findUnique({ where: { userId } })
  if (!gami) return { newStreak: 0, xpBonus: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const lastLogin = gami.lastLoginDate ? new Date(gami.lastLoginDate) : null
  if (lastLogin) lastLogin.setHours(0, 0, 0, 0)

  let newStreak = gami.streakDays
  let xpBonus = 0

  if (!lastLogin || lastLogin.getTime() < yesterday.getTime()) {
    newStreak = 1
  } else if (lastLogin.getTime() === yesterday.getTime()) {
    newStreak += 1
    if (newStreak === 3) xpBonus = 50
    if (newStreak === 7) xpBonus = 100
    if (newStreak === 14) xpBonus = 250
    if (newStreak === 30) xpBonus = 500
  }

  await prisma.gamification.update({
    where: { userId },
    data: {
      streakDays: newStreak,
      lastLoginDate: new Date(),
      xp: { increment: xpBonus + 10 }
    }
  })

  return { newStreak, xpBonus }
}
