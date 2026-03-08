import { useEffect, useState } from 'react'
import nodeClient from '../api/nodeClient'

const LEVEL_NAMES = [
  'Money Newbie',
  'Budget Aware',
  'Smart Spender',
  'Money Mogul',
  'Wealth Builder',
  'Finance Pro',
  'Investment King',
  'Wealth God',
]

export default function AchievementsPage() {
  const [gamification, setGamification] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    nodeClient.get('/gamification').then((res) => setGamification(res.data)).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-[var(--text-muted)]">Loading...</div>
  }

  const g = gamification ?? {}
  const achievements = g.achievements ?? []
  const nextLevelXP = g.nextLevelXP ?? 100
  const progressToNextLevel = g.progressToNextLevel ?? 0
  const levelName = LEVEL_NAMES[Math.min(g.level - 1, LEVEL_NAMES.length - 1)] ?? 'Wealth God'

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Achievements</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Level {g.level}: {levelName}
      </p>

      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[var(--text)]">{g.xp} XP</span>
          <span className="text-[var(--text-muted)]">Next level: {nextLevelXP} XP</span>
        </div>
        <div className="h-3 rounded-full bg-[var(--surface-hover)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${Math.min(100, progressToNextLevel)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`rounded-xl border p-4 ${
              a.isUnlocked
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30'
                : 'bg-[var(--surface)] border-[var(--border)] opacity-60'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{a.emoji}</span>
              <div>
                <p className="font-semibold text-[var(--text)]">{a.label}</p>
                <p className="text-xs text-[var(--text-muted)]">{a.isUnlocked ? 'Unlocked' : 'Locked'}</p>
              </div>
            </div>
            {!a.isUnlocked && (
              <p className="text-xs text-[var(--text-muted)]">Earn by: completing conditions</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
