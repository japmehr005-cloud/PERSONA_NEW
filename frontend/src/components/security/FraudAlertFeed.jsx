export default function FraudAlertFeed({ events }) {
  const list = events || []
  const levelColor = (level) =>
    level === 'HIGH' ? 'var(--danger)' : level === 'MEDIUM' ? 'var(--warn)' : 'var(--success)'

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
      <h3 className="font-semibold text-[var(--text)] mb-3">Risk events (last 10)</h3>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No risk events yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between text-sm py-2 border-b border-[var(--border)] last:border-0"
            >
              <span className="text-[var(--text)]">{e.actionType}</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: levelColor(e.riskLevel) + '30', color: levelColor(e.riskLevel) }}
              >
                {e.riskLevel}
              </span>
              <span className="text-[var(--text-muted)]">{e.decision}</span>
              <span className="text-[var(--text-muted)]">{new Date(e.createdAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
