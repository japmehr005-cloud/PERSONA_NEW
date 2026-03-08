export default function GoalProgressBar({ name, savedAmount, targetAmount, pctComplete }) {
  const pct = Math.min(100, pctComplete ?? (targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text)]">{name}</span>
        <span className="text-[var(--text-muted)]">
          ₹{Number(savedAmount).toLocaleString('en-IN')} / ₹{Number(targetAmount).toLocaleString('en-IN')} ({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-hover)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
