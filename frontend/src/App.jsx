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
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/account" element={<AccountSetupPage />} />
                  <Route path="/simulate" element={<SimulatePage />} />
                  <Route path="/security" element={<SecurityPage />} />
                  <Route path="/advisor" element={<ProtectedRoute><AdvisorPage /></ProtectedRoute>} />
                  <Route path="/achievements" element={<AchievementsPage />} />
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
