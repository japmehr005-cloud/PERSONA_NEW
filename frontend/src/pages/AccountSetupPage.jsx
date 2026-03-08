import { useEffect, useState } from 'react'
import nodeClient from '../api/nodeClient'
import { useStore } from '../store/useStore'
import GoalProgressBar from '../components/shared/GoalProgressBar'

export default function AccountSetupPage() {
  const showXPToast = useStore((s) => s.showXPToast)
  const setGamification = useStore((s) => s.setGamification)
  const [profile, setProfile] = useState(null)
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newGoal, setNewGoal] = useState({ name: '', targetAmount: '', targetDate: '', savedAmount: '0' })
  const [addingGoal, setAddingGoal] = useState(false)
  const [editingGoalId, setEditingGoalId] = useState(null)
  const [goalAddAmount, setGoalAddAmount] = useState('')
  const [goalSetTotal, setGoalSetTotal] = useState('')

  const form = {
    balance: profile?.balance ?? 0,
    salary: profile?.salary ?? 0,
    otherIncome: profile?.otherIncome ?? 0,
    investments: profile?.investments ?? 0,
    rent: profile?.rent ?? 0,
    food: profile?.food ?? 0,
    transport: profile?.transport ?? 0,
    subscriptions: profile?.subscriptions ?? 0,
    entertainment: profile?.entertainment ?? 0,
    miscExpenses: profile?.miscExpenses ?? 0,
  }

  const [data, setData] = useState(form)

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, gRes] = await Promise.all([
          nodeClient.get('/profile'),
          nodeClient.get('/goals'),
        ])
        setProfile(pRes.data)
        setGoals(gRes.data)
        setData({
          balance: pRes.data?.balance ?? 0,
          salary: pRes.data?.salary ?? 0,
          otherIncome: pRes.data?.otherIncome ?? 0,
          investments: pRes.data?.investments ?? 0,
          rent: pRes.data?.rent ?? 0,
          food: pRes.data?.food ?? 0,
          transport: pRes.data?.transport ?? 0,
          subscriptions: pRes.data?.subscriptions ?? 0,
          entertainment: pRes.data?.entertainment ?? 0,
          miscExpenses: pRes.data?.miscExpenses ?? 0,
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalIncome = data.salary + data.otherIncome
  const totalExpenses =
    data.rent + data.food + data.transport + data.subscriptions + data.entertainment + data.miscExpenses
  const monthlySavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (monthlySavings / totalIncome) * 100 : 0

  const handleAddGoal = async (e) => {
    e.preventDefault()
    if (!newGoal.name || !newGoal.targetAmount) return
    setAddingGoal(true)
    try {
      await nodeClient.post('/goals', {
        name: newGoal.name,
        targetAmount: parseFloat(newGoal.targetAmount),
        targetDate: newGoal.targetDate || undefined,
        savedAmount: parseFloat(newGoal.savedAmount) || 0,
      })
      setNewGoal({ name: '', targetAmount: '', targetDate: '', savedAmount: '0' })
      const gRes = await nodeClient.get('/goals')
      setGoals(gRes.data)
      showXPToast('Goal created', '+15 XP', 15)
    } catch (err) {
      console.error(err)
    } finally {
      setAddingGoal(false)
    }
  }

  const handleGoalProgressUpdate = async (goal) => {
    const add = parseFloat(goalAddAmount) || 0
    const setValue = goalSetTotal !== '' ? parseFloat(goalSetTotal) || 0 : null
    const newSavedAmount = setValue != null ? setValue : goal.savedAmount + add
    if (newSavedAmount < 0) return

    try {
      const completedNow = !goal.isCompleted && newSavedAmount >= goal.targetAmount
      await nodeClient.put(`/goals/${goal.id}`, {
        savedAmount: newSavedAmount,
        isCompleted: completedNow ? true : goal.isCompleted
      })
      await nodeClient.post('/gamification/xp', { amount: 15, reason: 'goal_progress_update' })
      showXPToast('Goal progress updated', '+15 XP', 15)
      if (completedNow) {
        await nodeClient.post('/gamification/xp', { amount: 500, reason: 'goal completed' })
        showXPToast('🎉 Goal Completed!', 'Massive progress unlocked', 500)
      }
      const [gRes, gamiRes] = await Promise.all([
        nodeClient.get('/goals'),
        nodeClient.get('/gamification')
      ])
      setGoals(gRes.data)
      setGamification(gamiRes.data)
      setEditingGoalId(null)
      setGoalAddAmount('')
      setGoalSetTotal('')
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await nodeClient.put('/profile', data)
      setProfile((prev) => ({ ...prev, ...data }))
      showXPToast('Profile updated', 'Keep your numbers updated for better insights', 25)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const markKycVerified = async () => {
    try {
      await nodeClient.put('/profile', { kycVerified: true })
      setProfile((prev) => ({ ...prev, kycVerified: true }))
      showXPToast('KYC Updated', 'Demo verification applied', 10)
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return <div className="text-[var(--text-muted)]">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Account setup</h1>
      {profile?.kycVerified ? (
        <div className="mb-4 rounded-lg border border-[var(--success)]/50 bg-[var(--success)]/15 p-3">
          <p className="text-sm font-semibold text-[var(--success)]">✓ KYC Verified — PAN & Aadhaar linked</p>
        </div>
      ) : (
        <div className="mb-4 rounded-lg border border-[var(--warn)]/50 bg-[var(--warn)]/15 p-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--warn)]">
            ⚠ KYC Pending — Verification required for real transactions
          </p>
          <button
            type="button"
            onClick={markKycVerified}
            className="shrink-0 px-3 py-1.5 rounded-md bg-[var(--warn)] text-black text-xs font-semibold"
          >
            Mark as Verified (Demo)
          </button>
        </div>
      )}

      <div className="mb-4 p-3 rounded-lg bg-[var(--surface-hover)] text-xs text-[var(--text-muted)]">
        * For simulation and demo purposes only. Not financial advice.
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <h2 className="font-semibold text-[var(--text)]">Income & balance</h2>
          {['balance', 'salary', 'otherIncome', 'investments'].map((key) => (
            <div key={key}>
              <label className="block text-sm text-[var(--text-muted)] mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={data[key] || ''}
                onChange={(e) => setData((d) => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <h2 className="font-semibold text-[var(--text)]">Monthly expenses</h2>
          {['rent', 'food', 'transport', 'subscriptions', 'entertainment', 'miscExpenses'].map((key) => (
            <div key={key}>
              <label className="block text-sm text-[var(--text-muted)] mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={data[key] || ''}
                onChange={(e) => setData((d) => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold text-[var(--text)] mb-4">Goals</h2>
          <form onSubmit={handleAddGoal} className="space-y-2 mb-4 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
            <input
              type="text"
              placeholder="Goal name"
              value={newGoal.name}
              onChange={(e) => setNewGoal((g) => ({ ...g, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Target (₹)"
                value={newGoal.targetAmount}
                onChange={(e) => setNewGoal((g) => ({ ...g, targetAmount: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Saved (₹)"
                value={newGoal.savedAmount}
                onChange={(e) => setNewGoal((g) => ({ ...g, savedAmount: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
              />
            </div>
            <input
              type="date"
              value={newGoal.targetDate}
              onChange={(e) => setNewGoal((g) => ({ ...g, targetDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]"
            />
            <button type="submit" disabled={addingGoal} className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
              {addingGoal ? '...' : 'Add goal'}
            </button>
          </form>
          {goals.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No goals yet. Add one above.</p>
          ) : (
            <div className="space-y-4">
              {goals.slice(0, 5).map((g) => (
                <div key={g.id} className="space-y-2">
                  <GoalProgressBar
                    name={g.name}
                    savedAmount={g.savedAmount}
                    targetAmount={g.targetAmount}
                    pctComplete={g.pctComplete}
                  />
                  {editingGoalId === g.id ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
                      <p className="text-xs text-[var(--text-muted)] mb-2">
                        Current saved: ₹{Number(g.savedAmount).toLocaleString('en-IN')}
                      </p>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Add amount saved (₹)"
                          value={goalAddAmount}
                          onChange={(e) => setGoalAddAmount(e.target.value)}
                          className="px-2 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
                        />
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Set total saved (₹)"
                          value={goalSetTotal}
                          onChange={(e) => setGoalSetTotal(e.target.value)}
                          className="px-2 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGoalId(null)
                            setGoalAddAmount('')
                            setGoalSetTotal('')
                          }}
                          className="px-2 py-1 rounded text-xs bg-[var(--surface-hover)] text-[var(--text)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGoalProgressUpdate(g)}
                          className="px-2 py-1 rounded text-xs bg-[var(--accent)] text-white"
                        >
                          Confirm
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingGoalId(g.id)}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Update Progress
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
          <h2 className="font-semibold text-[var(--text)] mb-2">Live summary</h2>
          <p className="text-sm text-[var(--text-muted)]">Income: ₹{totalIncome.toLocaleString('en-IN')}</p>
          <p className="text-sm text-[var(--text-muted)]">Expenses: ₹{totalExpenses.toLocaleString('en-IN')}</p>
          <p className="text-sm text-[var(--accent)]">Monthly savings: ₹{monthlySavings.toLocaleString('en-IN')}</p>
          <p className="text-sm text-[var(--text)]">Savings rate: {savingsRate.toFixed(1)}%</p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-6 px-6 py-2.5 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save profile'}
      </button>
    </div>
  )
}
