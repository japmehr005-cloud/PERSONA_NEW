import { Link } from 'react-router-dom'

export default function StatCard({ title, value, subtitle, to, icon }) {
  const content = (
    <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)]/50 transition">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <p className="text-sm text-[var(--text-muted)]">{title}</p>
      <p className="text-2xl font-bold text-[var(--text)] mt-1">{value}</p>
      {subtitle && <p className="text-xs text-[var(--text-muted)] mt-1">{subtitle}</p>}
    </div>
  )
  if (to) return <Link to={to}>{content}</Link>
  return content
}
