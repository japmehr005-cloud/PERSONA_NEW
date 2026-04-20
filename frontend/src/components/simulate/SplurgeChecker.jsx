import { useState } from 'react'
import pythonClient from '../../api/pythonClient'
import nodeClient from '../../api/nodeClient'
import { useStore } from '../../store/useStore'
export default function SplurgeChecker({ profile, primaryGoal, onSimulationSuccess }) {
  const setPendingAction = useStore((s) => s.setPendingAction)
  const clearPendingAction = useStore((s) => s.clearPendingAction)
  const securityScore = useStore((s) => s.securityScore)

  const [amount, setAmount] = useState('')
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

  const runSimulation = async (userConfirmed = false) => {
    const purchaseAmount = Number(amount) || 0
    if (!purchaseAmount) return

    setLoading(true)
    setResult(null)
    try {
      const riskRes = await nodeClient
        .post('/simulate/check', {
          actionType: 'SIMULATE',
          amount: purchaseAmount,
          userConfirmed,
          securityScore
        })
        .catch((err) => err.response)

      if (riskRes?.status === 202 && riskRes?.data?.requiresConfirmation) {
        setPendingAction({
          riskData: riskRes.data,
          onConfirm: () => runSimulation(true),
          onCancel: clearPendingAction,
        })
        setLoading(false)
        return
      }
      if (riskRes?.status === 202 && riskRes?.data?.requiresIntentCheck) {
        setLoading(false)
        return
      }
      if (riskRes?.status === 403) {
        setPendingAction({
          riskData: riskRes.data,
          onCancel: clearPendingAction,
        })
        setLoading(false)
        return
      }

      const { data } = await pythonClient.post('/simulate/splurge', {
        purchaseAmount,
        monthlyIncome: income,
        monthlyExpenses: expenses,
        goalTargetAmount: primaryGoal?.targetAmount ?? 0,
        currentBalance: profile?.balance ?? 0,
      })
      setResult(data)
      await onSimulationSuccess?.()
    } catch (err) {
      if (err.response?.status !== 202 && err.response?.status !== 403) {
        const { data } = await pythonClient
          .post('/simulate/splurge', {
            purchaseAmount: Number(amount) || 0,
            monthlyIncome: income,
            monthlyExpenses: expenses,
            goalTargetAmount: primaryGoal?.targetAmount ?? 0,
            currentBalance: profile?.balance ?? 0,
          })
          .catch(() => ({}))
        if (data) setResult(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    runSimulation()
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 mb-6">
      <h3 className="font-semibold text-[var(--text)] mb-3">Splurge checker</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        What if I buy this? See how it affects your goal.
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="number"
          min="0"
          step="1"
          placeholder="Amount (₹)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
        >
          {loading ? '...' : 'Check'}
        </button>
      </form>
      {result && (
        <div
          className={`p-3 rounded-lg text-sm ${
            result.verdictLevel === 'BAD'
              ? 'bg-[var(--danger)]/20 text-[var(--danger)]'
              : result.verdictLevel === 'WARN'
              ? 'bg-[var(--warn)]/20 text-[var(--warn)]'
              : 'bg-[var(--success)]/20 text-[var(--success)]'
          }`}
        >
          {result.verdictMessage}
          <p className="mt-1 text-[var(--text-muted)]">
            {result.pctOfSavings}% of savings · Goal delay: {result.goalDelayDays} days
          </p>
        </div>
      )}
    </div>
  )
}
