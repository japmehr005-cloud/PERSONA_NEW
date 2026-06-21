import { useEffect, useMemo, useState } from 'react'
import pythonClient from '../../api/pythonClient'
import nodeClient from '../../api/nodeClient'
import { useStore } from '../../store/useStore'

export default function SplurgeChecker({ profile, primaryGoal, onSimulationSuccess }) {
  const setPendingAction = useStore((s) => s.setPendingAction)
  const clearPendingAction = useStore((s) => s.clearPendingAction)
  const securityScore = useStore((s) => s.securityScore)
  const setProfile = useStore((s) => s.setProfile)

  const [amount, setAmount] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('impact')
  const [preWarning, setPreWarning] = useState('')
  const [spendConfirmation, setSpendConfirmation] = useState('')
  const [pendingIntent, setPendingIntent] = useState(null)
  const [balanceOverride, setBalanceOverride] = useState(null)
  const [conversationalStatus, setConversationalStatus] = useState(null)

  const userBalance = Number(balanceOverride ?? profile?.balance ?? 0)
  const splurgePercentage = useMemo(() => {
    const purchaseAmount = Number(amount || 0)
    if (!purchaseAmount || userBalance <= 0) return 0
    return (purchaseAmount / userBalance) * 100
  }, [amount, userBalance])

  const income = (profile?.salary ?? 0) + (profile?.otherIncome ?? 0)
  const expenses =
    (profile?.rent ?? 0) +
    (profile?.food ?? 0) +
    (profile?.transport ?? 0) +
    (profile?.subscriptions ?? 0) +
    (profile?.entertainment ?? 0) +
    (profile?.miscExpenses ?? 0)

  useEffect(() => {
    nodeClient.get('/profile/conversational-status')
      .then((res) => setConversationalStatus(res.data))
      .catch(() => setConversationalStatus(null))
  }, [])

  useEffect(() => {
    const onIntentResolved = async (event) => {
      if (!pendingIntent) return
      const detail = event?.detail || {}
      const resolvedActionType = detail?.intentData?.actionType
      if (resolvedActionType !== 'SIMULATE_SPLURGE') return

      if (!detail.confirmed) {
        setPendingIntent(null)
        return
      }

      await finalizeSplurgeFlow(pendingIntent.amount, pendingIntent.shouldDeduct)
      setPendingIntent(null)
    }
    window.addEventListener('intentCheckResolved', onIntentResolved)
    return () => window.removeEventListener('intentCheckResolved', onIntentResolved)
  }, [pendingIntent, profile, primaryGoal, securityScore])

  const finalizeSplurgeFlow = async (purchaseAmount, shouldDeduct) => {
    const { data } = await pythonClient.post('/simulate/splurge', {
      purchaseAmount,
      monthlyIncome: income,
      monthlyExpenses: expenses,
      goalTargetAmount: primaryGoal?.targetAmount ?? 0,
      currentBalance: userBalance,
    })
    setResult(data)

    if (shouldDeduct) {
      const confirmRes = await nodeClient.post('/simulate/splurge/confirm', {
        amount: purchaseAmount,
        description: 'Splurge purchase confirmed'
      })
      const newBalance = Number(confirmRes.data?.newBalance || 0)
      setBalanceOverride(newBalance)
      setProfile({ ...(profile || {}), balance: newBalance })
      setSpendConfirmation(
        `₹${purchaseAmount.toLocaleString('en-IN')} has been recorded as spent. Your new balance is ₹${newBalance.toLocaleString('en-IN')}`
      )
    } else {
      setSpendConfirmation('')
    }
    await onSimulationSuccess?.()
  }

  const runSimulation = async () => {
    const purchaseAmount = Number(amount) || 0
    if (!purchaseAmount) return
    const isHighPercentageSplurge = splurgePercentage > 50
    const shouldDeduct = mode === 'spend' && isHighPercentageSplurge
    setPreWarning(
      isHighPercentageSplurge
        ? `This purchase is ${splurgePercentage.toFixed(1)}% of your current balance. Our security layer will verify your intent before proceeding.`
        : ''
    )
    setSpendConfirmation('')

    setLoading(true)
    setResult(null)
    try {
      if (isHighPercentageSplurge) {
        const riskRes = await nodeClient.post('/simulate/check', {
          actionType: 'SIMULATE_SPLURGE',
          amount: purchaseAmount,
          securityScore,
          splurgePercentageOfBalance: splurgePercentage,
          isHighPercentageSplurge: true,
          isNewBeneficiary: false
        })

        if (riskRes?.data?.intentCheckDeferred) {
          setPendingIntent({
            amount: purchaseAmount,
            shouldDeduct
          })
          setLoading(false)
          return
        }
      }

      await finalizeSplurgeFlow(purchaseAmount, false)
    } catch (err) {
      if (err.response?.status === 202 && err.response?.data?.requiresConfirmation) {
        setPendingAction({
          riskData: err.response.data,
          onConfirm: () => runSimulation(),
          onCancel: clearPendingAction,
        })
        setLoading(false)
        return
      }
      if (err.response?.status === 403) {
        setPendingAction({
          riskData: err.response.data,
          onCancel: clearPendingAction,
        })
        setLoading(false)
        return
      }
      console.error(err)
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
      <div className={`mb-3 rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
        conversationalStatus == null
          ? 'bg-gray-500/10 border-gray-500/40 text-gray-300'
          : conversationalStatus.baselineMature
            ? 'bg-[var(--success)]/10 border-[var(--success)]/40 text-[var(--success)]'
            : 'bg-[var(--warn)]/10 border-[var(--warn)]/40 text-[var(--warn)]'
      }`}>
        <span>🛡</span>
        {conversationalStatus == null && 'Protected by PERSONA Security Layer — Setting up protection...'}
        {conversationalStatus && conversationalStatus.baselineMature && 'Protected by PERSONA Security Layer — Active — Behavioural baseline established'}
        {conversationalStatus && !conversationalStatus.baselineMature &&
          `Protected by PERSONA Security Layer — Learning — Building your behavioural profile (${conversationalStatus.totalMessagesSampled || 0}/5 messages)`}
      </div>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        What if I buy this? See how it affects your goal.
      </p>
      <div className="mb-4">
        <p className="text-xs text-[var(--text-muted)] mb-2">What do you want to do?</p>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-2 text-[var(--text)]">
            <input
              type="radio"
              name="splurgeMode"
              checked={mode === 'impact'}
              onChange={() => setMode('impact')}
            />
            Just check the impact
          </label>
          <label className="flex items-center gap-2 text-[var(--text)]">
            <input
              type="radio"
              name="splurgeMode"
              checked={mode === 'spend'}
              onChange={() => setMode('spend')}
            />
            I am actually spending this
          </label>
        </div>
      </div>
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
      {preWarning && (
        <div className="mb-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          {preWarning}
        </div>
      )}
      {spendConfirmation && (
        <div className="mb-3 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 p-3 text-sm text-[var(--success)]">
          {spendConfirmation}
        </div>
      )}
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
