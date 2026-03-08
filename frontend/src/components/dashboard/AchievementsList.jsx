import { Link } from 'react-router-dom'

export default function AchievementsList({ achievements }) {
  const list = achievements || []
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-[var(--text)]">Achievements</h2>
        <Link to="/achievements" className="text-sm text-[var(--accent)] hover:underline">
          View all
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.slice(0, 8).map((a) => (
          <div
            key={a.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
              a.isUnlocked
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30'
                : 'bg-[var(--bg)] border-[var(--border)] opacity-40'
            }`}
            title={a.label}
          >
            <span className="text-lg">{a.emoji}</span>
            <span className="text-sm font-medium text-[var(--text)]">{a.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
