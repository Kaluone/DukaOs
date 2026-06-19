import { Navigate, Route, Routes } from 'react-router-dom'
import { ARCRouter } from '@/features/control-center/ARCRouter'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { DashboardLayout } from '@/shared/layouts/DashboardLayout'
import { LoginPage }        from '@/features/auth/pages/LoginPage'
import { SetupPage }        from '@/features/auth/pages/SetupPage'
import { DashboardPage }    from '@/features/dashboard/pages/DashboardPage'
import { ProductsPage }     from '@/features/products/pages/ProductsPage'
import { StaffPage }        from '@/features/staff/pages/StaffPage'
import { ReportsPage }      from '@/features/reports/pages/ReportsPage'
import { SettingsPage }     from '@/features/settings/pages/SettingsPage'
import { POSPage }          from '@/features/pos/pages/POSPage'
import { ExpensesPage }     from '@/features/expenses/pages/ExpensesPage'
import { CustomersPage }    from '@/features/customers/pages/CustomersPage'
import { TermsPage }        from '@/features/legal/pages/TermsPage'
import { PrivacyPage }      from '@/features/legal/pages/PrivacyPage'
import { PurchasesPage }    from '@/features/purchases/pages/PurchasesPage'
import { SuppliersPage }    from '@/features/suppliers/pages/SuppliersPage'
import { StockPage }        from '@/features/stock/pages/StockPage'
import { AuditPage }        from '@/features/audit/pages/AuditPage'
import { ActivityPage }     from '@/features/activity/pages/ActivityPage'
import { BillingPage }      from '@/features/billing/pages/BillingPage'
import { AIAssistantPage }  from '@/features/ai/pages/AIAssistantPage'
import { SecurityPage }     from '@/features/security/pages/SecurityPage'
// Enterprise features
import { BranchesPage }         from '@/features/branches/pages/BranchesPage'
import { RolesPage }            from '@/features/roles/pages/RolesPage'
import { ApprovalsPage }        from '@/features/approvals/pages/ApprovalsPage'
import { RefundsPage }          from '@/features/refunds/pages/RefundsPage'
import { TransfersPage }        from '@/features/transfers/pages/TransfersPage'
import { StockCountPage }       from '@/features/stockcount/pages/StockCountPage'
import { PromotionsPage }       from '@/features/promotions/pages/PromotionsPage'
import { ShiftsPage }           from '@/features/shifts/pages/ShiftsPage'
import { EODPage }              from '@/features/eod/pages/EODPage'
import { AccountingPage }       from '@/features/accounting/pages/AccountingPage'
import { DeveloperPage }        from '@/features/developer/pages/DeveloperPage'
import { LoyaltyPage }          from '@/features/loyalty/pages/LoyaltyPage'
import { TaxPage }              from '@/features/tax/pages/TaxPage'
import { ReceiptDesignerPage }  from '@/features/receipt/pages/ReceiptDesignerPage'
import { BarcodePage }          from '@/features/barcode/pages/BarcodePage'
import { CreditPage }           from '@/features/credit/pages/CreditPage'
import { FeatureFlagsPage }     from '@/features/flags/pages/FeatureFlagsPage'
import { OnboardingWizard }     from '@/features/onboarding/pages/OnboardingWizard'
import { AutoReportsPage }      from '@/features/reports/pages/AutoReportsPage'
import { ObservabilityPage }    from '@/features/observability/pages/ObservabilityPage'
import { DemoModePage }         from '@/features/demo/pages/DemoModePage'
import { ImportWizardPage }       from '@/features/import/pages/ImportWizardPage'
import { PushNotificationsPage }  from '@/features/notifications/pages/PushNotificationsPage'
import { OfflineSyncPage }        from '@/features/sync/pages/OfflineSyncPage'

function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: 'var(--color-bg)',
    }}>
      <div style={{
        width: 48, height: 48, border: '3px solid var(--color-border)',
        borderTopColor: 'var(--color-primary)', borderRadius: '50%',
        animation: 'spin 800ms linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to="/login" replace />
  return <>{children}</>
}

function ShopGuard({ children, layout = true }: { children: React.ReactNode; layout?: boolean }) {
  const { user, loading: authLoading } = useAuth()
  const { data: shop, isLoading, isFetching, status } = useShop(user?.id)
  if (authLoading || isLoading || isFetching || status === 'pending') return <LoadingScreen />
  if (!shop) return <Navigate to="/setup" replace />
  if (!layout) return <>{children}</>
  return (
    <DashboardLayout shopName={shop.name}>
      {children}
    </DashboardLayout>
  )
}

function G({ children }: { children: React.ReactNode }) {
  return <AuthGuard><ShopGuard>{children}</ShopGuard></AuthGuard>
}

export function AppRouter() {
  return (
    <Routes>
      {/* AutoRevenue Labs Control Center — completely separate from customer app */}
      <Route path="/arc/*" element={<ARCRouter />} />

      {/* Public */}
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/terms"   element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/setup"   element={<AuthGuard><SetupPage /></AuthGuard>} />

      {/* POS — full-screen */}
      <Route path="/pos" element={<AuthGuard><ShopGuard layout={false}><POSPage /></ShopGuard></AuthGuard>} />

      {/* Core dashboard routes */}
      <Route path="/dashboard"  element={<G><DashboardPage /></G>} />
      <Route path="/products"   element={<G><ProductsPage /></G>} />
      <Route path="/customers"  element={<G><CustomersPage /></G>} />
      <Route path="/expenses"   element={<G><ExpensesPage /></G>} />
      <Route path="/staff"      element={<G><StaffPage /></G>} />
      <Route path="/reports"    element={<G><ReportsPage /></G>} />
      <Route path="/settings"   element={<G><SettingsPage /></G>} />
      <Route path="/purchases"  element={<G><PurchasesPage /></G>} />
      <Route path="/suppliers"  element={<G><SuppliersPage /></G>} />
      <Route path="/stock"      element={<G><StockPage /></G>} />
      <Route path="/audit"      element={<G><AuditPage /></G>} />
      <Route path="/activity"   element={<G><ActivityPage /></G>} />
      <Route path="/billing"    element={<G><BillingPage /></G>} />
      <Route path="/ai"         element={<G><AIAssistantPage /></G>} />
      <Route path="/security"   element={<G><SecurityPage /></G>} />

      {/* Enterprise features */}
      <Route path="/branches"   element={<G><BranchesPage /></G>} />
      <Route path="/roles"      element={<G><RolesPage /></G>} />
      <Route path="/approvals"  element={<G><ApprovalsPage /></G>} />
      <Route path="/refunds"    element={<G><RefundsPage /></G>} />
      <Route path="/transfers"  element={<G><TransfersPage /></G>} />
      <Route path="/stock-count" element={<G><StockCountPage /></G>} />
      <Route path="/promotions" element={<G><PromotionsPage /></G>} />
      <Route path="/shifts"     element={<G><ShiftsPage /></G>} />
      <Route path="/eod"        element={<G><EODPage /></G>} />
      <Route path="/accounting" element={<G><AccountingPage /></G>} />
      <Route path="/developer"   element={<G><DeveloperPage /></G>} />
      <Route path="/loyalty"     element={<G><LoyaltyPage /></G>} />
      <Route path="/tax"         element={<G><TaxPage /></G>} />
      <Route path="/receipt"     element={<G><ReceiptDesignerPage /></G>} />
      <Route path="/barcodes"    element={<G><BarcodePage /></G>} />
      <Route path="/credit"      element={<G><CreditPage /></G>} />
      <Route path="/features"    element={<G><FeatureFlagsPage /></G>} />
      <Route path="/auto-reports" element={<G><AutoReportsPage /></G>} />
      <Route path="/health"      element={<G><ObservabilityPage /></G>} />
      <Route path="/onboarding"  element={<AuthGuard><OnboardingWizard /></AuthGuard>} />
      <Route path="/demo"          element={<G><DemoModePage /></G>} />
      <Route path="/import"        element={<G><ImportWizardPage /></G>} />
      <Route path="/notifications" element={<G><PushNotificationsPage /></G>} />
      <Route path="/sync"          element={<G><OfflineSyncPage /></G>} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
