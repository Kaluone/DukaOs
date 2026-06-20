import { ReactNode, useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingBag, BarChart2, Clock,
  Wallet, FileText, Package, Lock, Menu, X,
  ChevronRight, Store, Sun, Moon, Eye, EyeOff,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useStaffSession, hashPin, isStaffSessionValid } from '@/features/staff/store/staffSessionStore'
import { useShop } from '@/shared/hooks/useShop'
import { useAuth } from '@/shared/hooks/useAuth'
import { supabase } from '@/shared/lib/supabaseClient'

interface EmployeeLayoutProps { children: ReactNode }

const NAV_ITEMS = [
  { to: '/employee',           label: 'My Dashboard',   icon: LayoutDashboard, exact: true },
  { to: '/pos',                label: 'POS — Sell',     icon: ShoppingBag, pos: true },
  { to: '/employee/sales',     label: 'My Sales',       icon: BarChart2 },
  { to: '/employee/shifts',    label: 'My Shifts',      icon: Clock },
  { to: '/employee/expenses',  label: 'Submit Expense', icon: Wallet },
  { to: '/employee/inventory', label: 'Inventory',      icon: Package },
  { to: '/employee/report',    label: 'Daily Report',   icon: FileText },
]

// ─── Exit PIN Modal ──────────────────────────────────────────────────────────

function ExitModal({ shopId, onClose, onExit }: {
  shopId?: string; onClose: () => void; onExit: () => void
}) {
  const [pin, setPin] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: pinData } = useQuery({
    queryKey: ['owner-pin', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase
        .from('shops').select('owner_exit_pin_hash').eq('id', shopId!).single()
      return data
    },
  })

  const hasPin = !!pinData?.owner_exit_pin_hash

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin) { setError('Enter your owner PIN'); return }
    setLoading(true); setError('')
    if (hasPin) {
      const hash = await hashPin(pin)
      if (hash !== pinData?.owner_exit_pin_hash) {
        setError('Incorrect PIN. Try again.')
        setPin(''); setLoading(false); return
      }
    }
    onExit()
    setLoading(false)
  }

  return (
    <div className="exit-overlay">
      <div className="exit-modal">
        <div className="exit-modal__head">
          <div className="exit-modal__icon"><Lock size={18} /></div>
          <div>
            <p className="exit-modal__title">Return to Owner Mode</p>
            <p className="exit-modal__sub">Enter owner PIN to unlock</p>
          </div>
          <button onClick={onClose} className="exit-modal__close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="exit-modal__body">
          <div className="pin-wrap">
            <input
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              maxLength={8}
              autoFocus
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
              placeholder="● ● ● ●"
              className="pin-inp"
            />
            <button type="button" onClick={() => setShow(v => !v)} className="pin-eye">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {error && <p className="pin-error">{error}</p>}
          <div className="exit-modal__foot">
            <button type="button" onClick={onClose} className="exit-cancel">Cancel</button>
            <button type="submit" disabled={loading || !pin} className="exit-confirm">
              <Lock size={14} />
              {loading ? 'Verifying…' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Layout ─────────────────────────────────────────────────────────────

export function EmployeeLayout({ children }: EmployeeLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeStaffName, sessionToken, sessionExpiresAt, exitStaffMode } = useStaffSession()
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [showExit, setShowExit] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Heartbeat: validate session every 5 minutes; force-logout if revoked
  useEffect(() => {
    if (!sessionToken) return
    if (!isStaffSessionValid(sessionExpiresAt)) {
      exitStaffMode(); navigate('/dashboard'); return
    }
    const interval = setInterval(async () => {
      const { data: valid } = await supabase.rpc('rpc_staff_session_heartbeat', {
        p_session_token: sessionToken,
      })
      if (!valid) { exitStaffMode(); navigate('/dashboard') }
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sessionToken, sessionExpiresAt])

  const handleExit = () => {
    exitStaffMode()
    navigate('/dashboard')
  }

  const initials = (activeStaffName ?? 'E')
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="el">
      {sidebarOpen && <div className="el__overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`el-sb ${sidebarOpen ? 'el-sb--open' : ''}`}>
        <div className="el-sb__head">
          <div className="el-sb__logo">
            <div className="el-sb__icon"><Store size={20} /></div>
            <div>
              <span className="el-sb__app">DukaOS</span>
              {shop?.name && <span className="el-sb__shop">{shop.name}</span>}
            </div>
          </div>
          <button className="el-sb__close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="el-badge">
          <div className="el-badge__av">{initials}</div>
          <div className="el-badge__info">
            <span className="el-badge__name">{activeStaffName ?? 'Employee'}</span>
            <span className="el-badge__role">Employee Session</span>
          </div>
          <div className="el-badge__dot" />
        </div>

        <nav className="el-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, pos, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `el-link ${isActive ? 'el-link--active' : ''} ${pos ? 'el-link--pos' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={12} className="el-link__arr" />
            </NavLink>
          ))}
        </nav>

        <div className="el-sb__foot">
          <button className="el-exit" onClick={() => setShowExit(true)}>
            <Lock size={16} />
            <span>Return to Owner Mode</span>
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="el-main">
        <header className="el-bar">
          <button className="el-bar__menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="el-bar__mid">
            <span className="el-bar__greet">Welcome, {activeStaffName ?? 'Employee'}</span>
          </div>
          <div className="el-bar__right">
            <button className="el-bar__theme" onClick={() => setDark(d => !d)}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="el-bar__exitbtn" onClick={() => setShowExit(true)}>
              <Lock size={14} /><span>Owner Mode</span>
            </button>
          </div>
        </header>
        <main className="el-content">{children}</main>
      </div>

      {showExit && (
        <ExitModal
          shopId={shop?.id}
          onClose={() => setShowExit(false)}
          onExit={handleExit}
        />
      )}

      <style>{`
        .el { display:flex; min-height:100vh; background:var(--color-bg); }
        .el__overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:99; }

        /* Sidebar */
        .el-sb {
          position:fixed; top:0; left:0; bottom:0; width:242px;
          background:var(--color-surface); border-right:1px solid var(--color-border);
          display:flex; flex-direction:column; z-index:100;
          transform:translateX(-100%);
          transition:transform 350ms cubic-bezier(.4,0,.2,1);
          box-shadow:var(--shadow-lg);
        }
        .el-sb--open { transform:translateX(0); }
        @media(min-width:1024px){ .el-sb{ transform:translateX(0); box-shadow:none; } }

        .el-sb__head {
          display:flex; align-items:center; justify-content:space-between;
          padding:18px 14px; border-bottom:1px solid var(--color-border);
        }
        .el-sb__logo { display:flex; align-items:center; gap:10px; }
        .el-sb__icon {
          width:36px; height:36px; border-radius:10px;
          background:var(--color-primary); color:#fff;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .el-sb__app { font-weight:800; font-size:.95rem; font-family:var(--font-heading); color:var(--color-text); display:block; }
        .el-sb__shop { font-size:.68rem; color:var(--color-text-muted); display:block; margin-top:1px; }
        .el-sb__close { color:var(--color-text-muted); padding:4px; border-radius:6px; }
        @media(min-width:1024px){ .el-sb__close{ display:none; } }

        .el-badge {
          display:flex; align-items:center; gap:10px;
          padding:12px 14px;
          background:var(--color-primary-light);
          border-bottom:1px solid var(--color-border);
        }
        .el-badge__av {
          width:38px; height:38px; border-radius:50%;
          background:var(--color-primary); color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-weight:800; font-size:.9rem; font-family:var(--font-heading); flex-shrink:0;
        }
        .el-badge__info { flex:1; min-width:0; }
        .el-badge__name { font-weight:700; font-size:.875rem; color:var(--color-text); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .el-badge__role { font-size:.68rem; color:var(--color-text-muted); display:block; }
        .el-badge__dot { width:8px; height:8px; border-radius:50%; background:var(--color-success); box-shadow:0 0 0 2px rgba(22,163,74,.25); flex-shrink:0; }

        .el-nav { flex:1; padding:10px 8px; display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
        .el-link {
          display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px;
          color:var(--color-text-secondary); font-weight:500; font-size:.875rem;
          transition:all 120ms ease; text-decoration:none;
        }
        .el-link:hover { color:var(--color-primary); background:var(--color-primary-light); }
        .el-link--active { color:var(--color-primary); background:var(--color-primary-light); font-weight:600; }
        .el-link__arr { margin-left:auto; opacity:0; transition:opacity 120ms; }
        .el-link:hover .el-link__arr, .el-link--active .el-link__arr { opacity:1; }
        .el-link--pos {
          background:var(--color-primary-light); color:var(--color-primary);
          font-weight:700; border:1.5px solid var(--color-primary); margin-bottom:4px;
        }
        .el-link--pos:hover, .el-link--pos.el-link--active { background:var(--color-primary); color:#fff; }

        .el-sb__foot { padding:10px; border-top:1px solid var(--color-border); }
        .el-exit {
          display:flex; align-items:center; gap:10px; width:100%;
          padding:10px 12px; border-radius:10px;
          color:var(--color-error); font-weight:600; font-size:.875rem;
          transition:background 120ms;
        }
        .el-exit:hover { background:var(--color-error-bg); }

        /* Main */
        .el-main { flex:1; display:flex; flex-direction:column; min-width:0; margin-left:0; }
        @media(min-width:1024px){ .el-main{ margin-left:242px; } }

        .el-bar {
          position:sticky; top:0; height:60px;
          background:var(--color-surface); border-bottom:1px solid var(--color-border);
          display:flex; align-items:center; padding:0 20px; gap:12px; z-index:50;
          box-shadow:var(--shadow-xs);
        }
        .el-bar__menu { color:var(--color-text-secondary); padding:6px; border-radius:8px; }
        @media(min-width:1024px){ .el-bar__menu{ display:none; } }
        .el-bar__mid { flex:1; }
        .el-bar__greet { font-weight:600; font-size:.875rem; color:var(--color-text-secondary); }
        .el-bar__right { display:flex; align-items:center; gap:8px; }
        .el-bar__theme { color:var(--color-text-secondary); padding:6px; border-radius:8px; display:flex; align-items:center; transition:color 120ms; }
        .el-bar__theme:hover { color:var(--color-primary); }
        .el-bar__exitbtn {
          display:flex; align-items:center; gap:6px; padding:6px 12px;
          background:var(--color-error-bg); color:var(--color-error);
          border:1.5px solid var(--color-error); border-radius:8px;
          font-size:.78rem; font-weight:700; transition:all 120ms;
        }
        .el-bar__exitbtn:hover { background:var(--color-error); color:#fff; }
        .el-bar__exitbtn span { display:none; }
        @media(min-width:480px){ .el-bar__exitbtn span { display:inline; } }

        .el-content { flex:1; padding:24px; max-width:1200px; width:100%; margin:0 auto; }
        @media(max-width:640px){ .el-content{ padding:16px; } }

        /* Exit Modal */
        .exit-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.55);
          display:flex; align-items:center; justify-content:center;
          padding:16px; z-index:300;
        }
        .exit-modal {
          background:var(--color-surface); border-radius:20px;
          width:100%; max-width:360px; box-shadow:var(--shadow-lg); overflow:hidden;
        }
        .exit-modal__head {
          display:flex; align-items:center; gap:12px;
          padding:16px 18px; border-bottom:1px solid var(--color-border);
        }
        .exit-modal__icon {
          width:36px; height:36px; border-radius:10px; flex-shrink:0;
          background:var(--color-primary-light); color:var(--color-primary);
          display:flex; align-items:center; justify-content:center;
        }
        .exit-modal__title { font-weight:700; font-size:.95rem; margin:0; color:var(--color-text); }
        .exit-modal__sub { font-size:.75rem; color:var(--color-text-muted); margin:0; }
        .exit-modal__close { margin-left:auto; color:var(--color-text-muted); padding:4px; border-radius:6px; }
        .exit-modal__body { padding:18px; display:flex; flex-direction:column; gap:12px; }
        .exit-modal__foot { display:flex; gap:10px; justify-content:flex-end; }

        .pin-wrap { position:relative; }
        .pin-inp {
          width:100%; padding:12px 44px 12px 16px;
          border:1.5px solid var(--color-border); border-radius:10px;
          background:var(--color-bg); color:var(--color-text);
          font-size:1.5rem; font-weight:700; letter-spacing:8px;
          outline:none; box-sizing:border-box;
          transition:border-color 120ms;
        }
        .pin-inp:focus { border-color:var(--color-primary); }
        .pin-eye { position:absolute; right:12px; top:50%; transform:translateY(-50%); color:var(--color-text-muted); }
        .pin-error {
          background:var(--color-error-bg); color:var(--color-error);
          padding:8px 12px; border-radius:8px; font-size:.82rem; font-weight:500; margin:0;
        }
        .exit-cancel {
          padding:10px 18px; border:1.5px solid var(--color-border); border-radius:10px;
          font-weight:600; font-size:.875rem; color:var(--color-text-secondary);
          transition:all 120ms;
        }
        .exit-cancel:hover { border-color:var(--color-primary); color:var(--color-primary); }
        .exit-confirm {
          padding:10px 20px; background:var(--color-primary); color:#fff;
          border-radius:10px; font-weight:700; font-size:.875rem;
          display:flex; align-items:center; gap:6px; transition:all 120ms;
        }
        .exit-confirm:hover:not(:disabled) { background:var(--color-primary-hover); }
        .exit-confirm:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </div>
  )
}
