export default function SecurityScoreRing({ score }) {
  const normalizedScore = Number.isFinite(Number(score)) ? Number(score) : 0
  const radius = 54
  const safeRadius = radius || 54
  const circumference = 2 * Math.PI * safeRadius
  const clampedScore = Math.max(0, Math.min(100, normalizedScore))
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference
  const color = clampedScore >= 90 ? 'var(--success)' : clampedScore >= 50 ? 'var(--warn)' : 'var(--danger)'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={safeRadius}
          fill="none"
          stroke="var(--surface-hover)"
          strokeWidth="8"
        />
        <circle
          cx="70"
          cy="70"
          r={safeRadius}
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
        {clampedScore}
      </span>
    </div>
  )
}
