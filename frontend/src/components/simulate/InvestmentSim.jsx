import { useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts'
import pythonClient from '../../api/pythonClient'

const FUND_PRESETS = {
  conservative: 7,
  balanced: 12,
  aggressive: 18,
  custom: null
}

export default function InvestmentSim({ prefillReturn, onSimulationSuccess }) {
  const [monthlyAmount, setMonthlyAmount] = useState('5000')
  const [years, setYears] = useState('10')
  const [returnPct, setReturnPct] = useState('12')
  const [fundType, setFundType] = useState('balanced')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const effectiveReturn = prefillReturn ?? returnPct

  const handleFundTypeChange = (value) => {
    setFundType(value)
    if (FUND_PRESETS[value] != null) {
      setReturnPct(String(FUND_PRESETS[value]))
    }
  }

  const handleRun = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const { data } = await pythonClient.post('/simulate/invest', {
        monthlyAmount: Number(monthlyAmount) || 0,
        years: Number(years) || 10,
        annualReturnPct: Number(effectiveReturn) || 12,
      })
      setResult(data)
      await onSimulationSuccess?.()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = result?.chartData?.map((d) => ({ ...d, name: `Year ${d.year}` })) ?? []

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 mb-6">
      <h3 className="font-semibold text-[var(--text)] mb-3">SIP Calculator</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Project growth with monthly SIP using preset risk profiles or custom return assumptions.
      </p>
      <form onSubmit={handleRun} className="grid md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Monthly (₹)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Years</label>
          <input
            type="number"
            min="1"
            max="30"
            step="1"
            value={years}
            onChange={(e) => setYears(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Fund Type</label>
          <select
            value={fundType}
            onChange={(e) => handleFundTypeChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          >
            <option value="conservative">Conservative (FD/RD): 7%</option>
            <option value="balanced">Balanced (Index Fund): 12%</option>
            <option value="aggressive">Aggressive (Small Cap): 18%</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Return % p.a.</label>
          <input
            type="number"
            min="1"
            max="30"
            step="0.1"
            value={effectiveReturn}
            onChange={(e) => {
              setFundType('custom')
              setReturnPct(e.target.value)
            }}
            disabled={prefillReturn != null}
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="md:col-span-4 px-4 py-2 rounded-lg bg-[var(--accent)] text-white font-medium disabled:opacity-50"
        >
          {loading ? '...' : 'Simulate'}
        </button>
      </form>
      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 text-sm">
            <p className="text-[var(--text-muted)]">Invested: <span className="text-[var(--text)]">₹{result.totalInvested?.toLocaleString('en-IN')}</span></p>
            <p className="text-[var(--text-muted)]">Future value: <span className="text-[var(--success)]">₹{result.futureValue?.toLocaleString('en-IN')}</span></p>
            <p className="text-[var(--text-muted)]">Gain: <span className="text-[var(--accent)]">₹{result.totalGain?.toLocaleString('en-IN')}</span></p>
            <p className="text-[var(--text-muted)]">Multiple: <span className="text-[var(--text)]">{result.returnMultiple}x</span></p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="year" stroke="var(--text-muted)" />
                <YAxis stroke="var(--text-muted)" tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Value']}
                />
                <Line type="monotone" dataKey="invested" stroke="var(--text-muted)" strokeWidth={2} dot={false} name="Amount Invested" />
                <Area type="monotone" dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} name="Portfolio Value" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
