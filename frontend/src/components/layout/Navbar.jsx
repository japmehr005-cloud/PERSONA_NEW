import { Link, useLocation } from 'react-router-dom'
import { useStore } from '../../store/useStore'

export default function Navbar() {
  const location = useLocation()
  const logout = useStore((s) => s.logout)

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/account', label: 'Account' },
    { path: '/simulate', label: 'Simulate' },
    { path: '/security', label: 'Security' },
    { path: '/advisor', label: 'Advisor' },
    { path: '/achievements', label: 'Achievements' },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link to="/dashboard" className="font-bold text-lg text-[var(--accent)]">
          PERSONA
        </Link>
        <div className="flex items-center gap-6">
          {navItems.map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className={`text-sm font-medium transition ${
                location.pathname === path
                  ? 'text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={() => logout()}
            className="text-sm text-[var(--text-muted)] hover:text-[var(--danger)]"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
