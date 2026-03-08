import { Link } from 'react-router-dom'
import { useState } from 'react'
import GoalProgressBar from '../shared/GoalProgressBar'
import nodeClient from '../../api/nodeClient'
import { useStore } from '../../store/useStore'

export default function GoalsPanel({ goals, onGoalsChange }) {
  const [editingGoalId, setEditingGoalId] = useState(null)
  const [addAmount, setAddAmount] = useState('')
  const [setTotal, setSetTotal] = useState('')
  const showXPToast = useStore((s) => s.showXPToast)
  const setGamification = useStore((s) => s.setGamification)

  const active = (goals || []).filter((g) => !g.isCompleted)

  const refreshGamification = async () => {
    const { data } = await nodeClient.get('/gamification')
    setGamification(data)
  }

  const handleProgressUpdate = async (goal) => {
    const add = parseFloat(addAmount) || 0
    const setValue = setTotal !== '' ? parseFloat(setTotal) || 0 : null
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

      const { data: updatedGoals } = await nodeClient.get('/goals')
      onGoalsChange?.(updatedGoals)
      await refreshGamification()
      setEditingGoalId(null)
      setAddAmount('')
      setSetTotal('')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-[var(--text)]">Goals</h2>
        <Link to="/account" className="text-sm text-[var(--accent)] hover:underline">
          Manage
        </Link>
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No goals yet. Set up your first goal in Account.</p>
      ) : (
        <div className="space-y-4">
          {active.slice(0, 3).map((g) => (
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
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="px-2 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Set total saved (₹)"
                      value={setTotal}
                      onChange={(e) => setSetTotal(e.target.value)}
                      className="px-2 py-1.5 rounded bg-[var(--surface)] border border-[var(--border)] text-sm text-[var(--text)]"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGoalId(null)
                        setAddAmount('')
                        setSetTotal('')
                      }}
                      className="px-2 py-1 rounded text-xs bg-[var(--surface-hover)] text-[var(--text)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProgressUpdate(g)}
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
  )
}
