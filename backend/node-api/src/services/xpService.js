import { prisma } from '../lib/prisma.js'

export const LEVELS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500]

export const ACHIEVEMENTS = [
  { id: 'first_login', label: 'First Step', emoji: '👋', xp: 50, check: () => true },
  { id: 'week_warrior', label: 'Week Warrior', emoji: '🔥', xp: 100, check: (g) => g.streakDays >= 7 },
  { id: 'month_grind', label: 'Month Grind', emoji: '💀', xp: 500, check: (g) => g.streakDays >= 30 },
  { id: 'sim_starter', label: 'Sim Starter', emoji: '🎮', xp: 50, check: (g) => g.simCount >= 1 },
  { id: 'sim_addict', label: 'Sim Addict', emoji: '📊', xp: 75, check: (g) => g.simCount >= 5 },
  { id: 'data_nerd', label: 'Data Nerd', emoji: '🧠', xp: 150, check: (g) => g.simCount >= 10 },
  {
    id: 'saver_50',
    label: 'Saver Pro',
    emoji: '💸',
    xp: 200,
    check: (g, p) => {
      const inc = (p?.salary || 0) + (p?.otherIncome || 0)
      const exp = (p?.rent || 0) + (p?.food || 0) + (p?.transport || 0) + (p?.subscriptions || 0) + (p?.entertainment || 0) + (p?.miscExpenses || 0)
      return inc > 0 && (inc - exp) / inc >= 0.5
    }
  },
  { id: 'security_first', label: 'Security First', emoji: '🛡️', xp: 100, check: (g, p, secScore) => secScore >= 90 },
  { id: 'goal_crusher', label: 'Goal Crusher', emoji: '🎯', xp: 500, check: (g, p, s, goals) => goals?.some((goal) => goal.isCompleted) }
]

export async function addXP(userId, amount) {
  const gami = await prisma.gamification.findUnique({ where: { userId } })
  if (!gami) return { newXP: 0, newLevel: 1, leveledUp: false }

  const newXP = gami.xp + amount
  const newLevel = LEVELS.filter((threshold) => newXP >= threshold).length || 1

  await prisma.gamification.update({
    where: { userId },
    data: { xp: newXP, level: newLevel }
  })

  return { newXP, newLevel, leveledUp: newLevel > gami.level }
}

export async function checkAchievements(userId) {
  const gami = await prisma.gamification.findUnique({ where: { userId } })
  const profile = await prisma.userProfile.findUnique({ where: { userId } })
  const goals = await prisma.goal.findMany({ where: { userId } })

  const securityScore = getSecurityScore(profile)
  const currentAchievements = Array.isArray(gami.achievements) ? gami.achievements : []
  const currentIds = currentAchievements.map((a) => (typeof a === 'object' ? a.id : a))

  const newlyUnlocked = []
  for (const ach of ACHIEVEMENTS) {
    if (currentIds.includes(ach.id)) continue
    const unlocked = ach.check(gami, profile, securityScore, goals)
    if (unlocked) {
      newlyUnlocked.push({ ...ach, unlockedAt: new Date() })
      currentIds.push(ach.id)
    }
  }

  if (newlyUnlocked.length > 0) {
    const totalXP = newlyUnlocked.reduce((sum, a) => sum + a.xp, 0)
    const updatedAchievements = [
      ...currentAchievements.map((a) => (typeof a === 'object' ? a : { id: a })),
      ...newlyUnlocked.map((a) => ({ id: a.id, unlockedAt: a.unlockedAt }))
    ]
    await prisma.gamification.update({
      where: { userId },
      data: { achievements: updatedAchievements, xp: { increment: totalXP } }
    })
  }
  return newlyUnlocked
}

function getSecurityScore(profile) {
  if (!profile) return 0
  let score = 0
  if (profile.twoFaEnabled) score += 15
  if (profile.biometricEnabled) score += 15
  if (profile.alertsEnabled) score += 15
  if (profile.locationLock) score += 15
  if (profile.sessionTimeout) score += 10
  if (profile.largeTransactionConfirm) score += 15
  if (profile.newDeviceAlert) score += 15
  return score
}
