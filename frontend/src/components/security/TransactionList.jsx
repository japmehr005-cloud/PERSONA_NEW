import { useEffect, useState } from 'react'
import nodeClient from '../../api/nodeClient'

export default function TransactionList() {
  const [list, setList] = useState([])

  useEffect(() => {
    nodeClient.get('/transactions').then((res) => setList(res.data?.slice(0, 5) ?? [])).catch(() => {})
  }, [])

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
      <h3 className="font-semibold text-[var(--text)] mb-3">Recent transactions</h3>
      {list.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No transactions yet.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((t) => (
            <li
              key={t.id}
              className="flex justify-between text-sm py-1"
            >
              <span className="text-[var(--text)]">{t.label || t.category}</span>
              <span className={t.type === 'credit' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
                {t.type === 'credit' ? '+' : '-'}₹{Math.abs(t.amount).toLocaleString('en-IN')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
