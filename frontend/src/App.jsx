import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AccountSetupPage from './pages/AccountSetupPage'
import SimulatePage from './pages/SimulatePage'
import SecurityPage from './pages/SecurityPage'
import AchievementsPage from './pages/AchievementsPage'
import AdvisorPage from './pages/AdvisorPage'
import XPToast from './components/layout/XPToast'
import RiskInterceptModal from './components/security/RiskInterceptModal'
import ErrorBoundary from './components/shared/ErrorBoundary'

function ProtectedRoute({ children }) {
  const accessToken = useStore((s) => s.accessToken)
  if (!accessToken) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const xpToast = useStore((s) => s.xpToast)
  const pendingAction = useStore((s) => s.pendingAction)
  const clearPendingAction = useStore((s) => s.clearPendingAction)

  return (
    <>
      {pendingAction && (
        <RiskInterceptModal
          riskData={pendingAction.riskData}
          onConfirm={pendingAction.onConfirm}
          onCancel={() => { pendingAction.onCancel?.(); clearPendingAction(); }}
        />
      )}
      <Routes>
        <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<ErrorBoundary><Navigate to="/dashboard" replace /></ErrorBoundary>} />
                  <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
                  <Route path="/account" element={<ErrorBoundary><AccountSetupPage /></ErrorBoundary>} />
                  <Route path="/simulate" element={<ErrorBoundary><SimulatePage /></ErrorBoundary>} />
                  <Route path="/security" element={<ErrorBoundary><SecurityPage /></ErrorBoundary>} />
                  <Route path="/advisor" element={<ErrorBoundary><ProtectedRoute><AdvisorPage /></ProtectedRoute></ErrorBoundary>} />
                  <Route path="/achievements" element={<ErrorBoundary><AchievementsPage /></ErrorBoundary>} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
      {xpToast && (
        <XPToast
          title={xpToast.title}
          subtitle={xpToast.subtitle}
          amount={xpToast.amount}
        />
      )}
    </>
  )
}
