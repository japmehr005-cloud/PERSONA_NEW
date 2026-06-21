export default function BalanceHero({ balance, totalIncome, totalExpenses, savingsRate, goalPct }) {
  const savings = totalIncome - totalExpenses
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[var(--surface)] border border-[var(--border)] p-6 mb-6">
      <p className="text-sm text-[var(--text-muted)] uppercase tracking-wide">Current balance</p>
      <p className="text-4xl font-bold text-[var(--text)] mt-1">
        ₹{Number(balance ?? 0).toLocaleString('en-IN')}
      </p>
      <div className="flex flex-wrap gap-6 mt-4 text-sm">
        <span className="text-[var(--success)]">Income: ₹{Number(totalIncome ?? 0).toLocaleString('en-IN')}</span>
        <span className="text-[var(--danger)]">Expenses: ₹{Number(totalExpenses ?? 0).toLocaleString('en-IN')}</span>
        <span className="text-[var(--accent)]">Savings: ₹{Number(savings ?? 0).toLocaleString('en-IN')}</span>
        {savingsRate != null && (
          <span className="text-[var(--text-muted)]">Savings rate: {savingsRate.toFixed(1)}%</span>
        )}
        {goalPct != null && (
          <span className="text-[var(--accent-light)]">Goal progress: {goalPct.toFixed(0)}%</span>
        )}
      </div>
    </div>
  )
}
