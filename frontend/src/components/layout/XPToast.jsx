export default function XPToast({ title, subtitle, amount }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[100] ui-card-raised px-4 py-3 border-[var(--primary)] animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDuration: '300ms' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">✨</span>
        <div>
          <p className="font-semibold text-[var(--foreground)]">{title}</p>
          {subtitle && <p className="text-sm text-[var(--muted-foreground)]">{subtitle}</p>}
          <p className="text-[var(--primary)] font-bold">+{amount} XP</p>
        </div>
      </div>
    </div>
  )
}
