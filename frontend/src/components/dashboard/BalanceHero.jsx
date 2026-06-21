export default function BalanceHero({ balance, totalIncome, totalExpenses, savingsRate, goalPct }) {
  const savings = totalIncome - totalExpenses
  return (
    <div className="ui-card-raised p-6 mb-6">
      <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-[0.12em] font-medium">Current balance</p>
      <p className="text-4xl font-bold text-[var(--foreground)] mt-2 tracking-tight">
        ₹{Number(balance ?? 0).toLocaleString('en-IN')}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
        <div className="ui-panel-muted px-3 py-2 text-sm">
          <span className="block text-[var(--muted-foreground)] text-xs">Income</span>
          <span className="font-semibold text-[var(--foreground)]">₹{Number(totalIncome ?? 0).toLocaleString('en-IN')}</span>
        </div>
        <div className="ui-panel px-3 py-2 text-sm">
          <span className="block text-[var(--muted-foreground)] text-xs">Expenses</span>
          <span className="font-semibold text-[var(--destructive)]">₹{Number(totalExpenses ?? 0).toLocaleString('en-IN')}</span>
        </div>
        <div className="ui-panel px-3 py-2 text-sm">
          <span className="block text-[var(--muted-foreground)] text-xs">Savings</span>
          <span className="font-semibold text-[var(--foreground)]">₹{Number(savings ?? 0).toLocaleString('en-IN')}</span>
        </div>
        {savingsRate != null && (
          <div className="ui-panel px-3 py-2 text-sm">
            <span className="block text-[var(--muted-foreground)] text-xs">Savings rate</span>
            <span className="font-semibold text-[var(--foreground)]">{savingsRate.toFixed(1)}%</span>
          </div>
        )}
        {goalPct != null && (
          <div className="ui-panel px-3 py-2 text-sm">
            <span className="block text-[var(--muted-foreground)] text-xs">Goal progress</span>
            <span className="font-semibold text-[var(--secondary-foreground)]">{goalPct.toFixed(0)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
