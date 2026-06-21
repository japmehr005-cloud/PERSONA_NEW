import StatCard from '../shared/StatCard'

export default function StatsGrid({ summary, gamification, securityScore }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Investments"
        value={`₹${Number(summary?.balance ?? 0).toLocaleString('en-IN')}`}
        subtitle="Balance"
        to="/account"
        icon="💰"
      />
      <StatCard
        title="Simulations"
        value={gamification?.simCount ?? 0}
        subtitle="Run so far"
        to="/simulate"
        icon="📊"
      />
      <StatCard
        title="Level"
        value={gamification?.level ?? 1}
        subtitle={`${gamification?.xp ?? 0} XP`}
        to="/achievements"
        icon="⭐"
      />
      <StatCard
        title="Security score"
        value={securityScore ?? 0}
        subtitle="/ 100"
        to="/security"
        icon="🛡️"
      />
    </div>
  )
}
