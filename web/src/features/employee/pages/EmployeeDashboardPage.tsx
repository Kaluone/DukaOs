import { useQuery } from '@tanstack/react-query'
import {
  ShoppingBag, TrendingUp, Wallet, FileText, Clock, Package,
  ArrowRight, AlertTriangle, CheckCircle2, PlayCircle, BarChart2,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { supabase } from '@/shared/lib/supabaseClient'
import { useStaffSession } from '@/features/staff/store/staffSessionStore'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

function fmt(n: number) {
  return 'TZS ' + n.toLocaleString('en-TZ', { minimumFractionDigits: 0 })
}

function StatCard({
  label, value, sub, icon: Icon, color = 'primary', trend,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  trend?: string
}) {
  return (
    <div className={`emp-stat emp-stat--${color}`}>
      <div className="emp-stat__icon"><Icon size={20} /></div>
      <div className="emp-stat__body">
        <span className="emp-stat__value">{value}</span>
        <span className="emp-stat__label">{label}</span>
        {sub && <span className="emp-stat__sub">{sub}</span>}
        {trend && <span className="emp-stat__trend">{trend}</span>}
      </div>
    </div>
  )
}

export function EmployeeDashboardPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const { activeStaffId, activeStaffName } = useStaffSession()
  const shopId = shop?.id

  // Today's sales by this staff member
  const today = new Date().toISOString().split('T')[0]
  const { data: todaySales } = useQuery({
    queryKey: ['emp-today-sales', activeStaffId, today],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, total, created_at')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .gte('created_at', today + 'T00:00:00')
        .lte('created_at', today + 'T23:59:59')
        .eq('status', 'completed')
      if (error) throw error
      return data ?? []
    },
    refetchInterval: 30_000,
  })

  // This week
  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split('T')[0]
  })()
  const { data: weekSales } = useQuery({
    queryKey: ['emp-week-sales', activeStaffId, weekStart],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, total')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .gte('created_at', weekStart + 'T00:00:00')
        .eq('status', 'completed')
      if (error) throw error
      return data ?? []
    },
  })

  // Active shift
  const { data: activeShift } = useQuery({
    queryKey: ['emp-active-shift', activeStaffId],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_shifts')
        .select('*')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
  })

  // Pending expenses
  const { data: pendingExpenses } = useQuery({
    queryKey: ['emp-pending-expenses', activeStaffId],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_expense_submissions')
        .select('id, amount, status, created_at')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  // Recent daily reports
  const { data: recentReports } = useQuery({
    queryKey: ['emp-recent-reports', activeStaffId],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_daily_reports')
        .select('id, title, category, severity, status, created_at')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  const todayTotal = todaySales?.reduce((s, t) => s + (t.total ?? 0), 0) ?? 0
  const todayCount = todaySales?.length ?? 0
  const weekTotal = weekSales?.reduce((s, t) => s + (t.total ?? 0), 0) ?? 0
  const pendingCount = pendingExpenses?.filter(e => e.status === 'pending').length ?? 0

  const shiftDuration = activeShift ? (() => {
    const mins = Math.floor((Date.now() - new Date(activeShift.started_at).getTime()) / 60000)
    const h = Math.floor(mins / 60), m = mins % 60
    return `${h}h ${m}m`
  })() : null

  return (
    <div className="emp-dash">
      <div className="emp-dash__head">
        <div>
          <h1 className="emp-dash__title">My Dashboard</h1>
          <p className="emp-dash__sub">Welcome back, {activeStaffName} — {new Date().toLocaleDateString('en-TZ', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <NavLink to="/pos" className="emp-dash__pos-btn">
          <ShoppingBag size={16} /><span>Open POS</span>
        </NavLink>
      </div>

      {/* Shift status banner */}
      {activeShift ? (
        <div className="emp-shift-banner emp-shift-banner--active">
          <PlayCircle size={18} />
          <span>Shift Active — <strong>{shiftDuration}</strong> elapsed</span>
          <NavLink to="/employee/shifts" className="emp-shift-banner__link">Manage Shift <ArrowRight size={13} /></NavLink>
        </div>
      ) : (
        <div className="emp-shift-banner emp-shift-banner--idle">
          <AlertTriangle size={18} />
          <span>No active shift. Start your shift before selling.</span>
          <NavLink to="/employee/shifts" className="emp-shift-banner__link">Start Shift <ArrowRight size={13} /></NavLink>
        </div>
      )}

      {/* Stats */}
      <div className="emp-stats">
        <StatCard label="Sales Today" value={todayCount} sub={fmt(todayTotal)} icon={ShoppingBag} color="primary" />
        <StatCard label="Revenue Today" value={fmt(todayTotal)} sub={`${todayCount} transactions`} icon={TrendingUp} color="success" />
        <StatCard label="This Week" value={fmt(weekTotal)} sub={`${weekSales?.length ?? 0} transactions`} icon={BarChart2} color="info" />
        <StatCard label="Pending Expenses" value={pendingCount} sub="awaiting approval" icon={Wallet} color={pendingCount > 0 ? 'warning' : 'primary'} />
      </div>

      {/* Quick Actions */}
      <div className="emp-section">
        <h2 className="emp-section__title">Quick Actions</h2>
        <div className="emp-actions">
          {[
            { to: '/pos', label: 'Make a Sale', icon: ShoppingBag, primary: true },
            { to: '/employee/shifts', label: activeShift ? 'End Shift' : 'Start Shift', icon: Clock, primary: false },
            { to: '/employee/expenses', label: 'Submit Expense', icon: Wallet, primary: false },
            { to: '/employee/report', label: 'Write Report', icon: FileText, primary: false },
            { to: '/employee/sales', label: 'My Sales History', icon: TrendingUp, primary: false },
            { to: '/employee/inventory', label: 'Check Inventory', icon: Package, primary: false },
          ].map(({ to, label, icon: Icon, primary }) => (
            <NavLink key={to} to={to} className={`emp-action ${primary ? 'emp-action--primary' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
              <ArrowRight size={13} className="emp-action__arr" />
            </NavLink>
          ))}
        </div>
      </div>

      <div className="emp-bottom">
        {/* Recent Expenses */}
        <div className="emp-list-card">
          <div className="emp-list-card__head">
            <h2 className="emp-list-card__title">My Expenses</h2>
            <NavLink to="/employee/expenses" className="emp-list-card__more">View all <ArrowRight size={12} /></NavLink>
          </div>
          {!pendingExpenses?.length ? (
            <p className="emp-empty">No expenses submitted yet.</p>
          ) : (
            <div className="emp-list">
              {pendingExpenses.map(e => (
                <div key={e.id} className="emp-list-row">
                  <Wallet size={14} className="emp-list-row__icon" />
                  <span className="emp-list-row__main">Expense</span>
                  <span className="emp-list-row__amount">{fmt(e.amount)}</span>
                  <span className={`emp-badge emp-badge--${e.status}`}>{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Reports */}
        <div className="emp-list-card">
          <div className="emp-list-card__head">
            <h2 className="emp-list-card__title">My Reports</h2>
            <NavLink to="/employee/report" className="emp-list-card__more">Write report <ArrowRight size={12} /></NavLink>
          </div>
          {!recentReports?.length ? (
            <p className="emp-empty">No reports submitted yet.</p>
          ) : (
            <div className="emp-list">
              {recentReports.map(r => (
                <div key={r.id} className="emp-list-row">
                  <FileText size={14} className="emp-list-row__icon" />
                  <span className="emp-list-row__main">{r.title}</span>
                  <span className={`emp-badge emp-badge--${r.severity}`}>{r.severity}</span>
                  <span className={`emp-badge emp-badge--${r.status}`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Transactions today */}
      <div className="emp-list-card" style={{ marginTop: 20 }}>
        <div className="emp-list-card__head">
          <h2 className="emp-list-card__title">Today's Transactions</h2>
          <NavLink to="/employee/sales" className="emp-list-card__more">See all <ArrowRight size={12} /></NavLink>
        </div>
        {!todaySales?.length ? (
          <p className="emp-empty">No sales recorded yet today.</p>
        ) : (
          <div className="emp-list">
            {todaySales.slice(0, 8).map(t => (
              <div key={t.id} className="emp-list-row">
                <CheckCircle2 size={14} className="emp-list-row__icon" style={{ color: 'var(--color-success)' }} />
                <span className="emp-list-row__main">{new Date(t.created_at).toLocaleTimeString('en-TZ', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="emp-list-row__amount">{fmt(t.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .emp-dash { display:flex; flex-direction:column; gap:20px; }
        .emp-dash__head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .emp-dash__title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .emp-dash__sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }
        .emp-dash__pos-btn {
          display:flex; align-items:center; gap:8px; padding:10px 20px;
          background:var(--color-primary); color:#fff; border-radius:12px;
          font-weight:700; font-size:.9rem; transition:all 120ms; text-decoration:none;
          flex-shrink:0;
        }
        .emp-dash__pos-btn:hover { opacity:.9; transform:translateY(-1px); }

        .emp-shift-banner {
          display:flex; align-items:center; gap:10px; padding:12px 18px;
          border-radius:14px; font-size:.875rem; font-weight:500;
        }
        .emp-shift-banner--active { background:rgba(22,163,74,.1); color:var(--color-success); border:1.5px solid rgba(22,163,74,.25); }
        .emp-shift-banner--idle { background:var(--color-warning-bg); color:var(--color-warning); border:1.5px solid rgba(217,119,6,.25); }
        .emp-shift-banner__link { margin-left:auto; display:flex; align-items:center; gap:4px; font-weight:700; text-decoration:none; color:inherit; }

        .emp-stats { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
        @media(min-width:768px){ .emp-stats{ grid-template-columns:repeat(4,1fr); } }

        .emp-stat {
          background:var(--color-surface); border:1px solid var(--color-border);
          border-radius:14px; padding:18px; display:flex; gap:14px; align-items:flex-start;
          transition:box-shadow 120ms;
        }
        .emp-stat:hover { box-shadow:var(--shadow-m); }
        .emp-stat__icon {
          width:42px; height:42px; border-radius:12px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
        }
        .emp-stat--primary .emp-stat__icon { background:var(--color-primary-light); color:var(--color-primary); }
        .emp-stat--success .emp-stat__icon { background:var(--color-success-bg); color:var(--color-success); }
        .emp-stat--warning .emp-stat__icon { background:var(--color-warning-bg); color:var(--color-warning); }
        .emp-stat--error .emp-stat__icon { background:var(--color-error-bg); color:var(--color-error); }
        .emp-stat--info .emp-stat__icon { background:var(--color-info-bg); color:var(--color-info); }
        .emp-stat__body { flex:1; min-width:0; }
        .emp-stat__value { font-size:1.3rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); display:block; }
        .emp-stat__label { font-size:.78rem; color:var(--color-text-muted); display:block; margin-top:2px; }
        .emp-stat__sub { font-size:.75rem; color:var(--color-text-secondary); display:block; }

        .emp-section { display:flex; flex-direction:column; gap:10px; }
        .emp-section__title { font-size:1rem; font-weight:700; color:var(--color-text); margin:0; }

        .emp-actions { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        @media(min-width:640px){ .emp-actions{ grid-template-columns:repeat(3,1fr); } }

        .emp-action {
          display:flex; align-items:center; gap:10px; padding:14px 16px;
          background:var(--color-surface); border:1.5px solid var(--color-border);
          border-radius:12px; font-weight:600; font-size:.875rem; color:var(--color-text);
          text-decoration:none; transition:all 120ms;
        }
        .emp-action:hover { border-color:var(--color-primary); color:var(--color-primary); background:var(--color-primary-light); }
        .emp-action--primary { background:var(--color-primary); color:#fff; border-color:var(--color-primary); }
        .emp-action--primary:hover { opacity:.9; }
        .emp-action__arr { margin-left:auto; }

        .emp-bottom { display:grid; grid-template-columns:1fr; gap:20px; }
        @media(min-width:768px){ .emp-bottom{ grid-template-columns:1fr 1fr; } }

        .emp-list-card {
          background:var(--color-surface); border:1px solid var(--color-border);
          border-radius:16px; overflow:hidden;
        }
        .emp-list-card__head { display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid var(--color-border); }
        .emp-list-card__title { font-weight:700; font-size:.95rem; margin:0; color:var(--color-text); }
        .emp-list-card__more { display:flex; align-items:center; gap:4px; font-size:.78rem; font-weight:600; color:var(--color-primary); text-decoration:none; }

        .emp-list { display:flex; flex-direction:column; }
        .emp-list-row {
          display:flex; align-items:center; gap:10px; padding:12px 18px;
          border-bottom:1px solid var(--color-border); font-size:.875rem;
        }
        .emp-list-row:last-child { border-bottom:none; }
        .emp-list-row__icon { color:var(--color-text-muted); flex-shrink:0; }
        .emp-list-row__main { flex:1; color:var(--color-text); font-weight:500; }
        .emp-list-row__amount { font-weight:700; color:var(--color-text); }

        .emp-empty { padding:24px 18px; color:var(--color-text-muted); font-size:.875rem; text-align:center; margin:0; }

        .emp-badge { font-size:.68rem; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase; letter-spacing:.04em; }
        .emp-badge--pending { background:var(--color-warning-bg); color:var(--color-warning); }
        .emp-badge--approved { background:var(--color-success-bg); color:var(--color-success); }
        .emp-badge--rejected { background:var(--color-error-bg); color:var(--color-error); }
        .emp-badge--read { background:var(--color-info-bg); color:var(--color-info); }
        .emp-badge--resolved { background:var(--color-success-bg); color:var(--color-success); }
        .emp-badge--low { background:var(--color-success-bg); color:var(--color-success); }
        .emp-badge--medium { background:var(--color-warning-bg); color:var(--color-warning); }
        .emp-badge--high { background:var(--color-error-bg); color:var(--color-error); }
        .emp-badge--urgent { background:#7c3aed22; color:#7c3aed; }
      `}</style>
    </div>
  )
}

