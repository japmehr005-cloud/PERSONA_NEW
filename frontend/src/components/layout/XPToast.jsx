export default function XPToast({ title, subtitle, amount }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[100] px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--accent)] shadow-lg animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDuration: '300ms' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">✨</span>
        <div>
          <p className="font-semibold text-[var(--text)]">{title}</p>
          {subtitle && <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>}
          <p className="text-[var(--accent)] font-bold">+{amount} XP</p>
        </div>
      </div>
    </div>
  )
}
