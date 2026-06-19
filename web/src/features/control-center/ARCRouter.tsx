import { Navigate, Route, Routes } from 'react-router-dom'
import { useARCAdmin } from './useARCAuth'
import { ARCLoginPage } from './ARCLoginPage'
import { ARCLayout } from './ARCLayout'
import { ARCGlobalDashboard } from './pages/ARCGlobalDashboard'
import { ARCTenantsPage } from './pages/ARCTenantsPage'
import { ARCRevenuePage } from './pages/ARCRevenuePage'
import { ARCSupportPage } from './pages/ARCSupportPage'
import { ARCAnalyticsPage } from './pages/ARCAnalyticsPage'
import { ARCReportsPage } from './pages/ARCReportsPage'
import { ARCSystemPage } from './pages/ARCSystemPage'
import { ARCBackupPage } from './pages/ARCBackupPage'
import { ARCAuditPage } from './pages/ARCAuditPage'
import { ARCAdminsPage } from './pages/ARCAdminsPage'

function ARCGuard({ children }: { children: React.ReactNode }) {
  const { data: admin, isLoading } = useARCAdmin()

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0f1e, #0d1a35)',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid rgba(59,130,246,0.2)',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!admin) return <Navigate to="/arc/login" replace />

  return (
    <ARCLayout>
      {children}
    </ARCLayout>
  )
}

export function ARCRouter() {
  return (
    <Routes>
      {/* Public ARC login */}
      <Route path="login" element={<ARCLoginPage />} />

      {/* Protected ARC routes */}
      <Route path="dashboard"  element={<ARCGuard><ARCGlobalDashboard /></ARCGuard>} />
      <Route path="tenants"    element={<ARCGuard><ARCTenantsPage /></ARCGuard>} />
      <Route path="revenue"    element={<ARCGuard><ARCRevenuePage /></ARCGuard>} />
      <Route path="support"    element={<ARCGuard><ARCSupportPage /></ARCGuard>} />
      <Route path="analytics"  element={<ARCGuard><ARCAnalyticsPage /></ARCGuard>} />
      <Route path="reports"    element={<ARCGuard><ARCReportsPage /></ARCGuard>} />
      <Route path="system"     element={<ARCGuard><ARCSystemPage /></ARCGuard>} />
      <Route path="backup"     element={<ARCGuard><ARCBackupPage /></ARCGuard>} />
      <Route path="audit"      element={<ARCGuard><ARCAuditPage /></ARCGuard>} />
      <Route path="admins"     element={<ARCGuard><ARCAdminsPage /></ARCGuard>} />

      {/* Default redirect */}
      <Route path=""  element={<Navigate to="/arc/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/arc/dashboard" replace />} />
    </Routes>
  )
}
