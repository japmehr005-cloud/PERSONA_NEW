import { useEffect, useState } from 'react'
import nodeClient from '../api/nodeClient'
import BalanceHero from '../components/dashboard/BalanceHero'
import StatsGrid from '../components/dashboard/StatsGrid'
import GoalsPanel from '../components/dashboard/GoalsPanel'
import AchievementsList from '../components/dashboard/AchievementsList'
import { useStore } from '../store/useStore'

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [goals, setGoals] = useState([])
  const [securityScore, setSecurityScore] = useState(0)
  const [loading, setLoading] = useState(true)
  const gamification = useStore((s) => s.gamification)
  const setGamification = useStore((s) => s.setGamification)

  useEffect(() => {
    const load = async () => {
      try {
        const [sumRes, gamiRes, goalsRes, secRes] = await Promise.all([
          nodeClient.get('/profile/summary'),
          nodeClient.get('/gamification'),
          nodeClient.get('/goals'),
          nodeClient.get('/security/score'),
        ])
        setSummary(sumRes.data)
        setGamification(gamiRes.data)
        setGoals(goalsRes.data)
        setSecurityScore(secRes.data?.score ?? 0)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-muted)]">Loading dashboard...</p>
      </div>
    )
  }

  const primaryGoal = summary?.primaryGoal
  const goalPct = primaryGoal && summary?.balance != null
    ? Math.min(100, (primaryGoal.savedAmount / primaryGoal.targetAmount) * 100)
    : null

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text)]">Dashboard</h1>
        {gamification?.streakDays > 1 && (
          <p className="text-sm text-[var(--accent)] mt-1">Welcome back! 🔥 Day {gamification.streakDays} streak</p>
        )}
      </div>
      <BalanceHero
        balance={summary?.balance}
        totalIncome={summary?.totalIncome}
        totalExpenses={summary?.totalExpenses}
        savingsRate={summary?.savingsRate}
        goalPct={goalPct}
      />
      <StatsGrid summary={summary} gamification={gamification} securityScore={securityScore} />
      <div className="grid md:grid-cols-2 gap-6">
        <GoalsPanel goals={goals} onGoalsChange={setGoals} />
        <AchievementsList achievements={gamification?.achievements} />
      </div>
    </div>
  )
}
