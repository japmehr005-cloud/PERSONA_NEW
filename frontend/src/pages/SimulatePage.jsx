import { useEffect, useState } from 'react'
import nodeClient from '../api/nodeClient'
import SplurgeChecker from '../components/simulate/SplurgeChecker'
import InvestmentSim from '../components/simulate/InvestmentSim'
import ExpenseCutSim from '../components/simulate/ExpenseCutSim'
import { useStore } from '../store/useStore'

const INVESTMENT_TIERS = [
  {
    title: 'LOW RISK 🟢',
    accent: 'var(--success)',
    items: [
      { name: 'Fixed Deposits (FD)', returns: '6.5-7.5% p.a.', avgReturn: 7, min: '₹500/month', desc: 'Capital guaranteed with fixed tenure.' },
      { name: 'Recurring Deposits (RD)', returns: '6-7% p.a.', avgReturn: 6.5, min: '₹500/month', desc: 'Disciplined monthly contributions.' },
      { name: 'Government Bonds', returns: '7-8% p.a.', avgReturn: 7.5, min: '₹1,000', desc: 'Sovereign-backed debt instruments.' },
      { name: 'PPF', returns: '7.1% p.a.', avgReturn: 7.1, min: '₹500/month', desc: 'Long-term tax-efficient wealth builder.' },
      { name: 'Debt Mutual Funds', returns: '6-8% p.a.', avgReturn: 7, min: '₹500/month SIP', desc: 'Low-volatility income-oriented funds.' }
    ]
  },
  {
    title: 'MEDIUM RISK 🟡',
    accent: 'var(--warn)',
    items: [
      { name: 'Index Funds (Nifty 50)', returns: '10-14% p.a.', avgReturn: 12, min: '₹500/month SIP', desc: 'Broad market exposure with low cost.' },
      { name: 'Balanced/Hybrid Funds', returns: '8-12% p.a.', avgReturn: 10, min: '₹500/month SIP', desc: 'Mix of equity and debt assets.' },
      { name: 'Corporate Bonds', returns: '8-10% p.a.', avgReturn: 9, min: '₹1,000', desc: 'Higher coupon than sovereign debt.' },
      { name: 'REITs', returns: '8-12% p.a.', avgReturn: 10, min: '₹300', desc: 'Real-estate income without owning property.' },
      { name: 'Gold ETF', returns: '8-11% p.a.', avgReturn: 9.5, min: '₹50', desc: 'Digital gold with exchange liquidity.' }
    ]
  },
  {
    title: 'HIGH RISK 🔴',
    accent: 'var(--danger)',
    items: [
      { name: 'Direct Equity (Stocks)', returns: '12-20%+ p.a.', avgReturn: 16, min: '₹100', desc: 'High upside with stock-specific risk.' },
      { name: 'Small Cap Funds', returns: '14-20% p.a.', avgReturn: 18, min: '₹500/month SIP', desc: 'High-growth funds with high volatility.' },
      { name: 'Sectoral/Thematic Funds', returns: 'Varies widely', avgReturn: 15, min: '₹500/month SIP', desc: 'Concentrated sector bets.' },
      { name: 'Crypto (Bitcoin/ETH)', returns: 'Highly volatile', avgReturn: 20, min: '₹100', desc: 'Speculative, high drawdown potential.' },
      { name: 'International Funds', returns: '10-18% p.a.', avgReturn: 14, min: '₹500/month SIP', desc: 'Global diversification with FX risk.' }
    ]
  }
]

export default function SimulatePage() {
  const [profile, setProfile] = useState(null)
  const [goals, setGoals] = useState([])
  const [gamification, setGamificationLocal] = useState(null)
  const [prefillReturn, setPrefillReturn] = useState(null)
  const [showGoldGoalModal, setShowGoldGoalModal] = useState(false)
  const [goldTarget, setGoldTarget] = useState('')
  const incrementSimCount = useStore((s) => s.incrementSimCount)
  const setGamification = useStore((s) => s.setGamification)
  const showXPToast = useStore((s) => s.showXPToast)

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, gRes, gamiRes] = await Promise.all([
          nodeClient.get('/profile'),
          nodeClient.get('/goals'),
          nodeClient.get('/gamification'),
        ])
        setProfile(pRes.data)
        setGoals(gRes.data)
        setGamificationLocal(gamiRes.data)
        setGamification(gamiRes.data)
      } catch (err) {
        console.error(err)
      }
    }
    load()
  }, [])

  const handleSimulationSuccess = async () => {
    try {
      await nodeClient.post('/gamification/xp', { amount: 5, reason: 'simulation' })
      const { data } = await nodeClient.post('/gamification/sim-count')
      incrementSimCount()
      showXPToast('Simulation complete', 'Great consistency streak', 5)
      const { data: gData } = await nodeClient.get('/gamification')
      setGamification(gData)
      setGamificationLocal((prev) => ({ ...(prev || {}), simCount: data?.simCount ?? (prev?.simCount || 0) + 1 }))
    } catch (err) {
      console.error(err)
    }
  }

  const primaryGoal = goals.find((g) => !g.isCompleted) ?? goals[0]
  const createGoldGoal = async () => {
    if (!goldTarget) return
    try {
      await nodeClient.post('/goals', {
        name: 'Gold Purchase',
        targetAmount: Number(goldTarget),
        savedAmount: 0
      })
      const gRes = await nodeClient.get('/goals')
      setGoals(gRes.data)
      setGoldTarget('')
      setShowGoldGoalModal(false)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div>
      <div className="mb-4 p-3 rounded-lg bg-amber-600/20 border border-amber-500/40 text-xs text-amber-200">
        ⚠ For simulation and demo purposes only. Not financial advice. Actual returns may vary.
        Complete KYC before making real investments.
      </div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-2">Simulate</h1>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Run splurge, investment and expense-cut simulations. Every run counts toward achievements.
      </p>
      {gamification != null && (
        <p className="text-sm text-[var(--accent)] mb-6">
          You&apos;ve run {gamification.simCount} simulations
          {gamification.simCount < 10 ? ` — ${10 - gamification.simCount} more to unlock Data Nerd badge 🧠` : ''}
        </p>
      )}
      <SplurgeChecker profile={profile} primaryGoal={primaryGoal} onSimulationSuccess={handleSimulationSuccess} />
      <InvestmentSim prefillReturn={prefillReturn} onSimulationSuccess={handleSimulationSuccess} />
      <ExpenseCutSim profile={profile} primaryGoal={primaryGoal} onSimulationSuccess={handleSimulationSuccess} />

      <section className="mt-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
        <h2 className="text-xl font-semibold text-[var(--text)] mb-4">📊 Investment Explorer</h2>

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {INVESTMENT_TIERS.map((tier) => (
            <div key={tier.title} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
              <h3 className="font-bold mb-3" style={{ color: tier.accent }}>{tier.title}</h3>
              <div className="space-y-3">
                {tier.items.map((item) => (
                  <div key={item.name} className="rounded-lg border border-[var(--border)] p-3">
                    <p className="text-sm font-semibold text-[var(--text)]">{item.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.returns}</p>
                    <p className="text-xs text-[var(--text-muted)]">Min: {item.min}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{item.desc}</p>
                    <button
                      type="button"
                      onClick={() => setPrefillReturn(String(item.avgReturn))}
                      className="mt-2 text-xs font-semibold text-[var(--accent)] hover:underline"
                    >
                      Simulate This →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 mb-4">
          <h3 className="font-semibold text-[var(--text)] mb-2">Precious Metals Tracker</h3>
          <p className="text-sm text-[var(--text-muted)] mb-2">Gold 24K: ₹9,200/gram · Silver: ₹110/gram</p>
          <p className="text-xs text-[var(--text-muted)] mb-3">Indicative price, not live data.</p>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs border border-[var(--border)]">
              <thead>
                <tr className="bg-[var(--surface-hover)]">
                  <th className="text-left p-2 border-b border-[var(--border)]">Feature</th>
                  <th className="text-left p-2 border-b border-[var(--border)]">Physical Gold</th>
                  <th className="text-left p-2 border-b border-[var(--border)]">Gold ETF</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-2 border-t border-[var(--border)]">Storage</td><td className="p-2 border-t border-[var(--border)]">Required</td><td className="p-2 border-t border-[var(--border)]">Not needed</td></tr>
                <tr><td className="p-2 border-t border-[var(--border)]">Min Buy</td><td className="p-2 border-t border-[var(--border)]">1 gram</td><td className="p-2 border-t border-[var(--border)]">1 unit (~₹50)</td></tr>
                <tr><td className="p-2 border-t border-[var(--border)]">Purity risk</td><td className="p-2 border-t border-[var(--border)]">Yes</td><td className="p-2 border-t border-[var(--border)]">No</td></tr>
                <tr><td className="p-2 border-t border-[var(--border)]">Liquidity</td><td className="p-2 border-t border-[var(--border)]">Medium</td><td className="p-2 border-t border-[var(--border)]">High</td></tr>
                <tr><td className="p-2 border-t border-[var(--border)]">Tax</td><td className="p-2 border-t border-[var(--border)]">Same</td><td className="p-2 border-t border-[var(--border)]">Same</td></tr>
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setShowGoldGoalModal(true)}
            className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold"
          >
            Add Gold to Goals
          </button>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Investment returns shown are historical averages and indicative only. Past performance does not
          guarantee future results. Consult a SEBI-registered advisor before investing.
        </p>
      </section>

      {showGoldGoalModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
            <h3 className="text-lg font-semibold text-[var(--text)] mb-2">Create Gold Goal</h3>
            <input
              type="number"
              min="0"
              step="1"
              placeholder="Target amount (₹)"
              value={goldTarget}
              onChange={(e) => setGoldTarget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] mb-4"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowGoldGoalModal(false)} className="px-3 py-2 rounded bg-[var(--surface-hover)] text-[var(--text)]">
                Cancel
              </button>
              <button type="button" onClick={createGoldGoal} className="px-3 py-2 rounded bg-[var(--accent)] text-white">
                Add Goal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
