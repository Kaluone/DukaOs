import { ReactNode, useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Users, FileText,
  Settings, LogOut, Menu, X, ChevronRight,
  Store, ShoppingBag, Wallet, UserCheck,
  ShoppingCart, Truck, BarChart2, Activity, CreditCard,
  Bot, Shield, ScrollText, ShieldAlert, GitBranch,
  RotateCcw, CheckSquare, ArrowRightLeft, ClipboardList,
  Tag, Clock, Moon, Sun, BookOpen, Code,
  Star, Percent, Printer, Barcode, Flag, FileBarChart, Heart, Upload,
  Bell, ArrowUpDown,
} from 'lucide-react'
import { signOut } from '@/shared/hooks/useAuth'
import { useT, useLanguageStore } from '@/shared/i18n/useLanguage'
import { OfflineIndicator } from '@/shared/components/OfflineIndicator'
import { NotificationBell } from '@/shared/components/NotificationBell'
import { GlobalSearch } from '@/shared/components/GlobalSearch'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

interface LayoutProps {
  children: ReactNode
  shopName?: string
}

export function DashboardLayout({ children, shopName }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  const navigate = useNavigate()
  const t = useT()
  const { lang, toggleLang } = useLanguageStore()
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)

  const navItems = [
    { to: '/dashboard',  label: t('navDashboard'),  icon: LayoutDashboard },
    { to: '/pos',        label: t('navPOS'),         icon: ShoppingBag, special: true as const },
    { to: '/products',   label: t('navProducts'),    icon: Package },
    { to: '/customers',  label: t('navCustomers'),   icon: UserCheck },
    { to: '/expenses',   label: t('navExpenses'),    icon: Wallet },
    { to: '/purchases',  label: t('navPurchases'),   icon: ShoppingCart },
    { to: '/suppliers',  label: t('navSuppliers'),   icon: Truck },
    { to: '/stock',      label: t('navStock'),       icon: BarChart2 },
    { to: '/refunds',    label: 'Refunds',           icon: RotateCcw },
    { to: '/approvals',  label: 'Approvals',         icon: CheckSquare },
    { to: '/transfers',  label: 'Transfers',         icon: ArrowRightLeft },
    { to: '/stock-count',label: 'Stock Count',       icon: ClipboardList },
    { to: '/promotions', label: 'Promotions',        icon: Tag },
    { to: '/shifts',     label: 'Shifts',            icon: Clock },
    { to: '/eod',        label: 'End of Day',        icon: Moon },
    { to: '/accounting', label: 'Accounting',        icon: BookOpen },
    { to: '/branches',   label: 'Branches',          icon: GitBranch },
    { to: '/roles',      label: 'Roles',             icon: Shield },
    { to: '/staff',      label: t('navStaff'),       icon: Users },
    { to: '/reports',    label: t('navReports'),     icon: FileText },
    { to: '/ai',         label: t('aiTitle'),        icon: Bot },
    { to: '/developer',   label: 'Developer API',     icon: Code },
    { to: '/loyalty',    label: 'Loyalty',           icon: Star },
    { to: '/tax',        label: 'Tax Rates',         icon: Percent },
    { to: '/receipt',    label: 'Receipt Designer',  icon: Printer },
    { to: '/barcodes',   label: 'Barcodes',          icon: Barcode },
    { to: '/credit',     label: 'Credit & Debt',     icon: CreditCard },
    { to: '/features',   label: 'Feature Modes',     icon: Flag },
    { to: '/auto-reports', label: 'Business Reports', icon: FileBarChart },
    { to: '/health',     label: 'System Health',     icon: Heart },
    { to: '/import',        label: 'Import Wizard',      icon: Upload },
    { to: '/demo',          label: 'Demo Mode',          icon: Flag },
    { to: '/notifications', label: 'Push Notifications', icon: Bell },
    { to: '/sync',          label: 'Offline Sync',        icon: ArrowUpDown },
    { to: '/activity',   label: t('activityTitle'),  icon: Activity },
    { to: '/audit',      label: t('auditTitle'),     icon: ScrollText },
    { to: '/billing',    label: t('billingTitle'),   icon: CreditCard },
    { to: '/security',   label: t('securityTitle'),  icon: Shield },
    { to: '/settings',   label: t('navSettings'),    icon: Settings },
  ]

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="layout__overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`} role="navigation" aria-label={t('mainMenu')}>
        <div className="sidebar__header">
          <div className="sidebar__logo">
            <div className="sidebar__logo-icon">
              <Store size={22} />
            </div>
            <div>
              <span className="sidebar__logo-name">DukaOS</span>
              {shopName && <span className="sidebar__shop-name">{shopName}</span>}
            </div>
          </div>
          <button
            className="sidebar__close"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('closeMenu')}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {navItems.map(({ to, label, icon: Icon, special }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'sidebar__link--active' : ''} ${special ? 'sidebar__link--pos' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
              <ChevronRight size={14} className="sidebar__arrow" aria-hidden="true" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <button className="sidebar__signout" onClick={handleSignOut}>
            <LogOut size={18} aria-hidden="true" />
            <span>{t('navSignOut')}</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="main-area">
        {/* Top bar */}
        <header className="topbar">
          <button
            className="topbar__menu"
            onClick={() => setSidebarOpen(true)}
            aria-label={t('openMenu')}
            aria-expanded={sidebarOpen}
          >
            <Menu size={22} />
          </button>

          <div className="topbar__right">
            <GlobalSearch shopId={shop?.id} />
            <OfflineIndicator />
            <div className="topbar__live">
              <span className="live-dot" aria-hidden="true" />
              <span className="topbar__live-text">{t('live')}</span>
            </div>
            <button
              className="topbar__theme"
              onClick={() => setDark(d => !d)}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={dark ? 'Mwanga' : 'Kiza'}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="topbar__lang"
              onClick={toggleLang}
              aria-label={t('language')}
              title={lang === 'sw' ? 'Switch to English' : 'Badilisha kwa Kiswahili'}
            >
              {lang === 'sw' ? 'EN' : 'SW'}
            </button>
            <NotificationBell shopId={shop?.id} />
          </div>
        </header>

        {/* Page content */}
        <main className="main-content page-enter">
          {children}
        </main>
      </div>

      <style>{`
        .layout {
          display: flex;
          min-height: 100vh;
          background: var(--color-bg);
        }

        /* Overlay for mobile */
        .layout__overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          z-index: 99;
        }

        /* ---- Sidebar ---- */
        .sidebar {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: var(--sidebar-width);
          background: var(--color-surface);
          border-right: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transform: translateX(-100%);
          transition: transform var(--transition-slow);
          box-shadow: var(--shadow-lg);
        }

        .sidebar--open, .sidebar:focus-within {
          transform: translateX(0);
        }

        @media (min-width: 1024px) {
          .sidebar {
            transform: translateX(0);
            box-shadow: none;
          }
        }

        .sidebar__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-5) var(--space-5);
          border-bottom: 1px solid var(--color-border);
        }

        .sidebar__logo {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .sidebar__logo-icon {
          width: 40px; height: 40px;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-m);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .sidebar__logo-name {
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 1.1rem;
          color: var(--color-text);
          display: block;
        }

        .sidebar__shop-name {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          display: block;
          margin-top: 1px;
        }

        .sidebar__close {
          color: var(--color-text-muted);
          padding: var(--space-1);
          border-radius: var(--radius-s);
          transition: color var(--transition-fast);
        }
        .sidebar__close:hover { color: var(--color-text); }

        @media (min-width: 1024px) { .sidebar__close { display: none; } }

        .sidebar__nav {
          flex: 1;
          padding: var(--space-4) var(--space-3);
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
        }

        .sidebar__link {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-m);
          color: var(--color-text-secondary);
          font-weight: 500;
          font-size: 0.9rem;
          transition: all var(--transition-fast);
          position: relative;
        }
        .sidebar__link:hover {
          color: var(--color-primary);
          background: var(--color-primary-light);
          text-decoration: none;
        }
        .sidebar__link--active {
          color: var(--color-primary);
          background: var(--color-primary-light);
          font-weight: 600;
        }
        .sidebar__arrow {
          margin-left: auto;
          opacity: 0;
          transition: opacity var(--transition-fast);
        }
        .sidebar__link--active .sidebar__arrow,
        .sidebar__link:hover .sidebar__arrow { opacity: 1; }

        /* POS link — prominent call-to-action style */
        .sidebar__link--pos {
          background: var(--color-primary-light);
          color: var(--color-primary);
          font-weight: 700;
          border: 1.5px solid var(--color-primary);
          margin-bottom: var(--space-1);
        }
        .sidebar__link--pos:hover {
          background: var(--color-primary);
          color: #fff;
        }
        .sidebar__link--pos.sidebar__link--active {
          background: var(--color-primary);
          color: #fff;
        }

        .sidebar__footer {
          padding: var(--space-4);
          border-top: 1px solid var(--color-border);
        }

        .sidebar__signout {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          width: 100%;
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-m);
          color: var(--color-error);
          font-weight: 500;
          font-size: 0.9rem;
          transition: background var(--transition-fast);
        }
        .sidebar__signout:hover { background: var(--color-error-bg); }

        /* ---- Main area ---- */
        .main-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          margin-left: 0;
        }

        @media (min-width: 1024px) {
          .main-area { margin-left: var(--sidebar-width); }
        }

        /* ---- Topbar ---- */
        .topbar {
          position: sticky;
          top: 0;
          height: var(--header-height);
          background: var(--color-surface);
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 var(--space-6);
          z-index: 50;
          box-shadow: var(--shadow-xs);
        }

        .topbar__menu {
          color: var(--color-text-secondary);
          padding: var(--space-2);
          border-radius: var(--radius-s);
          transition: color var(--transition-fast);
        }
        .topbar__menu:hover { color: var(--color-primary); }

        @media (min-width: 1024px) { .topbar__menu { display: none; } }

        .topbar__right {
          display: flex;
          align-items: center;
          gap: var(--space-4);
        }

        .topbar__live {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .topbar__live-text {
          font-size: 0.75rem;
          color: var(--color-success);
          font-weight: 600;
        }

        .topbar__lang {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--color-primary);
          background: var(--color-primary-light);
          border: 1.5px solid var(--color-primary);
          border-radius: var(--radius-s);
          padding: 3px 8px;
          cursor: pointer;
          transition: all var(--transition-fast);
          line-height: 1.4;
        }
        .topbar__lang:hover {
          background: var(--color-primary);
          color: #fff;
        }

        .topbar__theme {
          color: var(--color-text-secondary);
          padding: var(--space-2);
          border-radius: var(--radius-s);
          transition: color var(--transition-fast);
          display: flex;
          align-items: center;
        }
        .topbar__theme:hover { color: var(--color-primary); }

        .topbar__notif {
          color: var(--color-text-secondary);
          padding: var(--space-2);
          border-radius: var(--radius-s);
          transition: color var(--transition-fast);
        }
        .topbar__notif:hover { color: var(--color-primary); }

        /* ---- Dark mode overrides ---- */
        html.dark {
          --color-bg:             #0B1409;
          --color-surface:        #121E0F;
          --color-surface-2:      #192B14;
          --color-border:         #253D1E;
          --color-border-strong:  #355229;
          --color-text:           #E4F0E0;
          --color-text-secondary: #9DB897;
          --color-text-muted:     #5E7A58;
          --color-primary-light:  rgba(11,92,46,0.22);
          --color-accent-light:   rgba(232,164,0,0.16);
          --color-error-bg:       rgba(220,38,38,0.15);
          --color-success-bg:     rgba(22,163,74,0.15);
          --color-warning-bg:     rgba(217,119,6,0.15);
          --color-info-bg:        rgba(3,105,161,0.15);
        }

        /* ---- Main content ---- */
        .main-content {
          flex: 1;
          padding: var(--space-6);
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
        }

        @media (max-width: 640px) {
          .main-content { padding: var(--space-4); }
          .topbar { padding: 0 var(--space-4); }
        }
      `}</style>
    </div>
  )
}
