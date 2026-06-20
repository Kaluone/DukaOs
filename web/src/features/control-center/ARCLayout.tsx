import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, DollarSign, HeadphonesIcon,
  FileText, Monitor, BarChart2, HardDrive, Users,
  LogOut, Menu, Moon, Sun,
  ChevronRight, ScrollText, Radio,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useARCAdmin, ROLE_LABEL, hasPerm } from './useARCAuth'
import { ARCLogo } from './ARCLogo'

const NAV = [
  { to: '/arc/dashboard',  label: 'Global Dashboard',  icon: LayoutDashboard, perm: 'dashboard' },
  { to: '/arc/tenants',    label: 'Tenant Management', icon: Building2,        perm: 'tenants' },
  { to: '/arc/revenue',    label: 'Revenue Center',    icon: DollarSign,       perm: 'revenue' },
  { to: '/arc/support',    label: 'Support Center',    icon: HeadphonesIcon,   perm: 'support' },
  { to: '/arc/analytics',  label: 'Landing Analytics', icon: BarChart2,        perm: 'analytics' },
  { to: '/arc/reports',    label: 'Reports Center',    icon: FileText,         perm: 'reports' },
  { to: '/arc/system',     label: 'System Monitor',    icon: Monitor,          perm: 'system' },
  { to: '/arc/backup',     label: 'Backup & Recovery', icon: HardDrive,        perm: 'backup' },
  { to: '/arc/audit',      label: 'Audit Logs',        icon: ScrollText,       perm: 'audit' },
  { to: '/arc/admins',     label: 'Admin Management',  icon: Users,            perm: 'admins' },
  { to: '/arc/broadcast',  label: 'Broadcast Center',  icon: Radio,            perm: 'broadcast' },
]

interface ARCLayoutProps { children: ReactNode }

export function ARCLayout({ children }: ARCLayoutProps) {
  const { data: admin } = useARCAdmin()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('arc-theme') !== 'light')
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleTheme() {
    setDark(d => {
      const next = !d
      document.documentElement.setAttribute('data-arc-theme', next ? 'dark' : 'light')
      localStorage.setItem('arc-theme', next ? 'dark' : 'light')
      return next
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/arc/login', { replace: true })
  }

  const role = admin?.role ?? 'support_agent'
  const visibleNav = NAV.filter(n => hasPerm(role, n.perm))

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 12px' : '20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: collapsed ? 'center' : 'space-between',
      }}>
        {collapsed
          ? <ARCLogo size={28} showText={false} />
          : <ARCLogo size={28} showText={true} collapsed={false} />
        }
        <button onClick={() => setCollapsed(c => !c)} style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: 6, cursor: 'pointer', color: '#64748b',
          display: 'flex', alignItems: 'center',
        }}>
          {collapsed ? <ChevronRight size={14} /> : <Menu size={14} />}
        </button>
      </div>

      {/* Admin info */}
      {!collapsed && admin && (
        <div style={{
          margin: '12px 12px 0', padding: '10px 12px',
          background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10,
        }}>
          <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700 }}>{admin.full_name}</div>
          <div style={{ color: '#3b82f6', fontSize: 11, marginTop: 2 }}>{ROLE_LABEL(admin.role)}</div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {visibleNav.map(item => (
          <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 10px' : '9px 12px',
              borderRadius: 10, marginBottom: 2,
              justifyContent: collapsed ? 'center' : 'flex-start',
              textDecoration: 'none',
              background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              color: isActive ? '#60a5fa' : '#94a3b8',
              transition: 'all 0.15s',
            })}
          >
            {({ isActive }) => (
              <>
                <item.icon size={16} style={{ flexShrink: 0, color: isActive ? '#60a5fa' : '#64748b' }} />
                {!collapsed && (
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={toggleTheme} style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10, padding: collapsed ? '10px' : '9px 12px',
          background: 'none', border: '1px solid transparent',
          borderRadius: 10, color: '#64748b', cursor: 'pointer',
          fontSize: 13, transition: 'all 0.15s', marginBottom: 2,
        }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && <span>Toggle Theme</span>}
        </button>
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10, padding: collapsed ? '10px' : '9px 12px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 10, color: '#f87171', cursor: 'pointer',
          fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
        }}>
          <LogOut size={16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  )

  const sidebarW = collapsed ? 64 : 220

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: dark ? '#070d1a' : '#f1f5f9',
      color: dark ? '#e2e8f0' : '#1e293b',
      fontFamily: "'Inter', system-ui, sans-serif",
    }} data-arc-theme={dark ? 'dark' : 'light'}>
      {/* Desktop Sidebar */}
      <aside style={{
        width: sidebarW, flexShrink: 0,
        background: dark ? '#0d1526' : '#0f172a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        height: '100vh', position: 'sticky', top: 0,
        transition: 'width 0.2s', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        }} onClick={() => setMobileOpen(false)}>
          <aside style={{
            width: 240, height: '100%',
            background: '#0d1526', borderRight: '1px solid rgba(255,255,255,0.06)',
          }} onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 56, display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 12,
          background: dark ? 'rgba(13,21,38,0.95)' : '#fff',
          borderBottom: dark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
          backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40,
        }}>
          <button onClick={() => setMobileOpen(true)} style={{
            display: 'none', background: 'none', border: 'none',
            cursor: 'pointer', color: '#64748b', padding: 4,
          }} className="arc-mobile-menu">
            <Menu size={20} />
          </button>

          <div style={{ flex: 1 }}>
            <span style={{
              fontSize: 11, color: '#3b82f6', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              AutoRevenue Labs
            </span>
            <span style={{ color: '#475569', fontSize: 11, marginLeft: 8 }}>Control Center</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 20,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
              <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>LIVE</span>
            </div>
            {admin && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px',
                background: dark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
                border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                borderRadius: 20, fontSize: 12,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                }}>
                  {admin.full_name.charAt(0).toUpperCase()}
                </div>
                <span style={{ color: dark ? '#94a3b8' : '#64748b' }}>{admin.full_name.split(' ')[0]}</span>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .arc-mobile-menu { display: flex !important; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }
      `}</style>
    </div>
  )
}
