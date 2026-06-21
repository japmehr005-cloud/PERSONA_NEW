export default function BalanceHero({ balance, totalIncome, totalExpenses, savingsRate, goalPct }) {
  const savings = totalIncome - totalExpenses
  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 mb-6 shadow-sm">
      <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.12em] font-medium">Current balance</p>
      <p className="text-4xl font-bold text-[var(--text)] mt-2 tracking-tight">
        ₹{Number(balance ?? 0).toLocaleString('en-IN')}
      </p>
      <div className="flex flex-wrap gap-x-8 gap-y-2 mt-5 text-sm">
        <span className="text-[var(--text-muted)]">
          Income <span className="font-semibold text-[var(--success)]">₹{Number(totalIncome ?? 0).toLocaleString('en-IN')}</span>
        </span>
        <span className="text-[var(--text-muted)]">
          Expenses <span className="font-semibold text-[var(--danger)]">₹{Number(totalExpenses ?? 0).toLocaleString('en-IN')}</span>
        </span>
        <span className="text-[var(--text-muted)]">
          Savings <span className="font-semibold text-[var(--text)]">₹{Number(savings ?? 0).toLocaleString('en-IN')}</span>
        </span>
        {savingsRate != null && (
          <span className="text-[var(--text-muted)]">Savings rate <span className="font-semibold text-[var(--text)]">{savingsRate.toFixed(1)}%</span></span>
        )}
        {goalPct != null && (
          <span className="text-[var(--text-muted)]">Goal progress <span className="font-semibold text-[var(--secondary)]">{goalPct.toFixed(0)}%</span></span>
        )}
      </div>
    </div>
  )
}
