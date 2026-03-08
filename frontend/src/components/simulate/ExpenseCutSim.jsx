import { useState } from 'react'
import pythonClient from '../../api/pythonClient'

export default function ExpenseCutSim({ profile, primaryGoal, onSimulationSuccess }) {
  const [cutAmount, setCutAmount] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const income = (profile?.salary ?? 0) + (profile?.otherIncome ?? 0)
  const expenses =
    (profile?.rent ?? 0) +
    (profile?.food ?? 0) +
    (profile?.transport ?? 0) +
    (profile?.subscriptions ?? 0) +
    (profile?.entertainment ?? 0) +
    (profile?.miscExpenses ?? 0)
  const currentSavings = income - expenses

  const handleRun = async (e) => {
    e.preventDefault()
    const amt = Number(cutAmount) || 0
    if (!amt) return
    setLoading(true)
    setResult(null)
    try {
      const { data } = await pythonClient.post('/simulate/cut', {
        monthlyCutAmount: amt,
        currentMonthlySavings: currentSavings,
        goalTargetAmount: primaryGoal?.targetAmount ?? 0,
        currentBalance: profile?.balance ?? 0,
      })
      setResult(data)
      await onSimulationSuccess?.()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
      <h3 className="font-semibold text-[var(--text)] mb-3">Expense cut simulator</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        See how cutting a monthly expense speeds up your goal.
      </p>
      <form onSubmit={handleRun} className="flex gap-2 mb-4">
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Monthly cut (₹)"
          value={cutAmount}
          onChange={(e) => setCutAmount(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
        >
          {loading ? '...' : 'Simulate'}
        </button>
      </form>
      {result && (
        <div className="text-sm space-y-1">
          <p className="text-[var(--text)]">New monthly savings: ₹{result.newMonthlySavings?.toLocaleString('en-IN')}</p>
          <p className="text-[var(--success)]">Months saved: {result.monthsSaved}</p>
          <p className="text-[var(--text-muted)]">Annual saving from this cut: ₹{result.annualSavingFromCut?.toLocaleString('en-IN')}</p>
        </div>
      )}
    </div>
  )
}
