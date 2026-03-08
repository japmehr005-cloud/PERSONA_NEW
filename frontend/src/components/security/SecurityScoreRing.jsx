export default function SecurityScoreRing({ score }) {
  const r = 40
  const circumference = 2 * Math.PI * r
  const strokeDashoffset = circumference - (score / 100) * circumference
  const color = score >= 90 ? 'var(--success)' : score >= 50 ? 'var(--warn)' : 'var(--danger)'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" className="-rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--surface-hover)"
          strokeWidth="8"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-2xl font-bold text-[var(--text)]" style={{ color }}>
        {score}
      </span>
    </div>
  )
}
