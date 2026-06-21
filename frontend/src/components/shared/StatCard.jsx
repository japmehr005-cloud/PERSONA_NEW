import { Link } from 'react-router-dom'

export default function StatCard({ title, value, subtitle, to, icon }) {
  const content = (
    <div className="ui-card p-4 hover:border-[var(--primary)] transition">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <p className="text-sm text-[var(--muted-foreground)]">{title}</p>
      <p className="text-2xl font-bold text-[var(--foreground)] mt-1">{value}</p>
      {subtitle && <p className="text-xs text-[var(--muted-foreground)] mt-1">{subtitle}</p>}
    </div>
  )
  if (to) return <Link to={to}>{content}</Link>
  return content
}
