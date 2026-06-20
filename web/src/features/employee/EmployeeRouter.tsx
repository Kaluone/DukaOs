import { Navigate, Route, Routes } from 'react-router-dom'
import { useStaffSession } from '@/features/staff/store/staffSessionStore'
import { EmployeeLayout } from './EmployeeLayout'
import { EmployeeDashboardPage } from './pages/EmployeeDashboardPage'
import { EmployeeSalesPage } from './pages/EmployeeSalesPage'
import { EmployeeShiftsPage } from './pages/EmployeeShiftsPage'
import { EmployeeExpensesPage } from './pages/EmployeeExpensesPage'
import { EmployeeInventoryPage } from './pages/EmployeeInventoryPage'
import { EmployeeReportPage } from './pages/EmployeeReportPage'

function EmployeeGuard({ children }: { children: React.ReactNode }) {
  const { isStaffMode } = useStaffSession()
  if (!isStaffMode) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export function EmployeeRouter() {
  return (
    <EmployeeGuard>
      <EmployeeLayout>
        <Routes>
          <Route index element={<EmployeeDashboardPage />} />
          <Route path="sales"     element={<EmployeeSalesPage />} />
          <Route path="shifts"    element={<EmployeeShiftsPage />} />
          <Route path="expenses"  element={<EmployeeExpensesPage />} />
          <Route path="inventory" element={<EmployeeInventoryPage />} />
          <Route path="report"    element={<EmployeeReportPage />} />
          <Route path="*"         element={<Navigate to="/employee" replace />} />
        </Routes>
      </EmployeeLayout>
    </EmployeeGuard>
  )
}
