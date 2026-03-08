import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children || <Outlet />}
      </main>
    </div>
  )
}
