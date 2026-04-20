import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import useIntentCheck from '../../hooks/useIntentCheck'
import IntentConfirmationModal from '../security/IntentConfirmationModal'

export default function AppLayout({ children }) {
  const { intentCheckActive, intentData, confirmAndRetry, cancelIntent } = useIntentCheck()

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children || <Outlet />}
      </main>
      {intentCheckActive && (
        <IntentConfirmationModal
          data={intentData}
          onConfirm={confirmAndRetry}
          onCancel={cancelIntent}
        />
      )}
    </div>
  )
}
