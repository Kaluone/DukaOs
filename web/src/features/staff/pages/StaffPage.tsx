import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus, Users, X, Eye, EyeOff, Edit2, Shield,
  AlertCircle, CheckCircle2, Clock, MoreVertical,
  RefreshCw, Slash, RotateCcw,
  Phone, Mail, GitBranch, UserCheck, Activity,
  Wallet, FileText,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { hashPin } from '@/features/staff/store/staffSessionStore'
import { StaffSessionsPanel } from '../components/StaffSessionsPanel'

const ROLES = [
  { value: 'cashier', label: 'Cashier' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'manager', label: 'Manager' },
  { value: 'custom', label: 'Custom' },
]

const ALL_PERMISSIONS = [
  { code: 'view_dashboard',   label: 'View Dashboard' },
  { code: 'make_sale',        label: 'Make Sales (POS)' },
  { code: 'view_profit',      label: 'View Profit Data' },
  { code: 'view_reports',     label: 'View Reports' },
  { code: 'view_customers',   label: 'View Customers' },
  { code: 'manage_products',  label: 'Manage Products' },
  { code: 'manage_stock',     label: 'Manage Stock' },
  { code: 'record_expense',   label: 'Submit Expenses' },
  { code: 'view_expenses',    label: 'View Expenses' },
  { code: 'refund_sale',      label: 'Issue Refunds' },
  { code: 'discount_sale',    label: 'Apply Discounts' },
  { code: 'cancel_sale',      label: 'Cancel Sales' },
  { code: 'manage_staff',     label: 'Manage Staff' },
  { code: 'manage_branches',  label: 'Manage Branches' },
  { code: 'change_price',     label: 'Change Prices' },
  { code: 'export_data',      label: 'Export Data' },
]

type StaffMember = {
  id: string; full_name: string; active: boolean; suspended: boolean
  phone?: string | null; email?: string | null; role?: string | null
  branch_id?: string | null; created_at: string; last_login_at?: string | null
  login_count?: number
}

type Branch = { id: string; name: string }

function fmt(d: string | null | undefined) {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Add / Edit Modal ────────────────────────────────────────────────────────

function StaffModal({
  shopId, branches, existing, onClose, onSaved,
}: {
  shopId: string
  branches: Branch[]
  existing?: StaffMember
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(existing?.full_name ?? '')
  const [phone, setPhone] = useState(existing?.phone ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [role, setRole] = useState(existing?.role ?? 'cashier')
  const [branchId, setBranchId] = useState(existing?.branch_id ?? '')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Full name is required')
      if (!existing && pin.length < 4) throw new Error('PIN must be 4–8 digits')
      if (!existing && !/^\d{4,8}$/.test(pin)) throw new Error('PIN must be digits only (4–8)')

      const payload: Record<string, unknown> = {
        full_name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        role,
        branch_id: branchId || null,
      }

      if (existing) {
        if (pin) {
          if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN must be digits only (4–8)')
          payload.pin_hash = await hashPin(pin)
        }
        const { error } = await supabase.from('staff').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        payload.shop_id = shopId
        payload.pin_hash = await hashPin(pin)
        payload.active = true
        const { error } = await supabase.from('staff').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-full', shopId] })
      onSaved()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="sm-overlay">
      <div className="sm-modal">
        <div className="sm-modal__head">
          <UserPlus size={18} className="sm-modal__icon" />
          <h2>{existing ? 'Edit Staff Member' : 'Add New Staff'}</h2>
          <button onClick={onClose} className="sm-modal__close"><X size={18} /></button>
        </div>
        <div className="sm-modal__body">
          <div className="sm-grid2">
            <label className="sm-label">
              Full Name *
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amina Juma" className="sm-input" autoFocus />
            </label>
            <label className="sm-label">
              Role *
              <select value={role} onChange={e => setRole(e.target.value)} className="sm-select">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className="sm-label">
              Phone
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+255 7xx xxx xxx" className="sm-input" type="tel" />
            </label>
            <label className="sm-label">
              Email
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@example.com" className="sm-input" type="email" />
            </label>
            <label className="sm-label">
              Branch Assignment
              <select value={branchId} onChange={e => setBranchId(e.target.value)} className="sm-select">
                <option value="">— No branch assigned —</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="sm-label">
              PIN {existing ? '(leave blank to keep)' : '*'}
              <div className="sm-pin-wrap">
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder={existing ? 'New PIN (optional)' : '4–8 digit PIN'}
                  className="sm-input sm-input--pin"
                />
                <button type="button" onClick={() => setShowPin(v => !v)} className="sm-pin-eye">
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>
          </div>
          {error && <p className="sm-error">{error}</p>}
        </div>
        <div className="sm-modal__foot">
          <button onClick={onClose} className="sm-cancel">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="sm-save">
            {save.isPending ? 'Saving…' : existing ? 'Save Changes' : 'Add Staff Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Permissions Modal ────────────────────────────────────────────────────────

function PermissionsModal({ staff, shopId, onClose }: {
  staff: StaffMember; shopId: string; onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: existing = [] } = useQuery({
    queryKey: ['staff-perms', staff.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_permissions')
        .select('code, granted')
        .eq('staff_id', staff.id)
      return data ?? []
    },
  })

  const grantedSet = new Set(existing.filter(p => p.granted).map(p => p.code))
  const [perms, setPerms] = useState<Set<string>>(grantedSet)
  const [saving, setSaving] = useState(false)

  const toggle = (code: string) => {
    setPerms(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    const rows = ALL_PERMISSIONS.map(p => ({
      staff_id: staff.id,
      shop_id: shopId,
      code: p.code,
      granted: perms.has(p.code),
    }))
    await supabase.from('staff_permissions').upsert(rows, { onConflict: 'staff_id,code' })
    qc.invalidateQueries({ queryKey: ['staff-perms', staff.id] })
    setSaving(false)
    onClose()
  }

  return (
    <div className="sm-overlay">
      <div className="sm-modal sm-modal--wide">
        <div className="sm-modal__head">
          <Shield size={18} className="sm-modal__icon" />
          <h2>Permissions — {staff.full_name}</h2>
          <button onClick={onClose} className="sm-modal__close"><X size={18} /></button>
        </div>
        <div className="sm-modal__body">
          <p className="sm-perm-hint">Toggle individual permissions for this staff member. Changes take effect immediately.</p>
          <div className="sm-perms-grid">
            {ALL_PERMISSIONS.map(p => (
              <label key={p.code} className={`sm-perm-item ${perms.has(p.code) ? 'sm-perm-item--on' : ''}`}>
                <input
                  type="checkbox"
                  checked={perms.has(p.code)}
                  onChange={() => toggle(p.code)}
                  className="sm-perm-check"
                />
                <span>{p.label}</span>
                {perms.has(p.code) && <CheckCircle2 size={14} className="sm-perm-ok" />}
              </label>
            ))}
          </div>
        </div>
        <div className="sm-modal__foot">
          <button onClick={onClose} className="sm-cancel">Cancel</button>
          <button onClick={save} disabled={saving} className="sm-save">
            <Shield size={14} />
            {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Activity Panel ───────────────────────────────────────────────────────────

function ActivityPanel({ staff, shopId, onClose }: {
  staff: StaffMember; shopId: string; onClose: () => void
}) {
  const { data: activity = [] } = useQuery({
    queryKey: ['staff-activity', staff.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('staff_activity_log')
        .select('id, action, details, created_at, branch_id, ip_address, device')
        .eq('shop_id', shopId)
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return data ?? []
    },
  })

  const { data: shifts = [] } = useQuery({
    queryKey: ['staff-shifts-history', staff.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_shifts')
        .select('id, shift_date, started_at, ended_at, total_sales, transactions_count, status')
        .eq('staff_id', staff.id)
        .order('shift_date', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })

  const { data: reports = [] } = useQuery({
    queryKey: ['staff-reports', staff.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_daily_reports')
        .select('id, title, category, severity, status, created_at')
        .eq('staff_id', staff.id)
        .order('created_at', { ascending: false })
        .limit(5)
      return data ?? []
    },
  })

  return (
    <div className="sm-overlay">
      <div className="sm-modal sm-modal--xl">
        <div className="sm-modal__head">
          <Activity size={18} className="sm-modal__icon" />
          <h2>Activity — {staff.full_name}</h2>
          <button onClick={onClose} className="sm-modal__close"><X size={18} /></button>
        </div>
        <div className="sm-modal__body sm-modal__body--scroll">
          <div className="sm-act-stats">
            <div className="sm-act-stat"><span>{staff.login_count ?? 0}</span><small>Total Logins</small></div>
            <div className="sm-act-stat"><span>{shifts.length}</span><small>Shifts Worked</small></div>
            <div className="sm-act-stat"><span>{reports.length}</span><small>Reports Filed</small></div>
            <div className="sm-act-stat"><span>{fmt(staff.last_login_at)}</span><small>Last Login</small></div>
          </div>

          {shifts.length > 0 && (
            <div className="sm-act-section">
              <h3 className="sm-act-section__title">Recent Shifts</h3>
              {shifts.map(s => (
                <div key={s.id} className="sm-act-row">
                  <Clock size={13} />
                  <span>{new Date(s.shift_date).toLocaleDateString('en-TZ', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="sm-act-row__detail">{s.transactions_count} txns</span>
                  <span className="sm-act-row__amount">TZS {(s.total_sales ?? 0).toLocaleString()}</span>
                  <span className={`sm-badge sm-badge--${s.status}`}>{s.status}</span>
                </div>
              ))}
            </div>
          )}

          {reports.length > 0 && (
            <div className="sm-act-section">
              <h3 className="sm-act-section__title">Recent Reports</h3>
              {reports.map(r => (
                <div key={r.id} className="sm-act-row">
                  <FileText size={13} />
                  <span className="sm-act-row__main">{r.title}</span>
                  <span className={`sm-badge sm-badge--${r.severity}`}>{r.severity}</span>
                  <span className={`sm-badge sm-badge--${r.status}`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}

          {activity.length > 0 && (
            <div className="sm-act-section">
              <h3 className="sm-act-section__title">Action Log ({activity.length})</h3>
              {activity.map(a => (
                <div key={a.id} className="sm-act-row">
                  <Activity size={13} />
                  <span className="sm-act-row__main">{a.action}</span>
                  {a.ip_address && <span className="sm-act-row__detail">{a.ip_address}</span>}
                  <span className="sm-act-row__time">{new Date(a.created_at).toLocaleString('en-TZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}

          {activity.length === 0 && shifts.length === 0 && (
            <p className="sm-empty-text">No activity recorded yet for this staff member.</p>
          )}
        </div>
        <div className="sm-modal__foot">
          <button onClick={onClose} className="sm-save">Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Staff Card ───────────────────────────────────────────────────────────────

function StaffCard({ member, shopId, branches, onEdit, onPermissions, onActivity, onStatusChange }: {
  member: StaffMember
  shopId: string
  branches: Branch[]
  onEdit: () => void
  onPermissions: () => void
  onActivity: () => void
  onStatusChange: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const qc = useQueryClient()

  const suspend = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('staff')
        .update({ suspended: true, suspended_at: new Date().toISOString(), active: false })
        .eq('id', member.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-full', shopId] }); onStatusChange() },
  })

  const reactivate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('staff')
        .update({ suspended: false, suspended_at: null, suspended_by: null, active: true })
        .eq('id', member.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['staff-full', shopId] }); onStatusChange() },
  })

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('staff').update({ active: false }).eq('id', member.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-full', shopId] }),
  })

  const initials = member.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const branch = branches.find(b => b.id === member.branch_id)

  const status = member.suspended ? 'suspended' : member.active ? 'active' : 'inactive'

  return (
    <div className={`scard scard--${status}`}>
      <div className="scard__av">{initials}</div>
      <div className="scard__info">
        <div className="scard__top">
          <span className="scard__name">{member.full_name}</span>
          <span className={`scard__badge scard__badge--${status}`}>
            {status === 'active' ? <><UserCheck size={11} /> Active</> :
             status === 'suspended' ? <><Slash size={11} /> Suspended</> :
             <><AlertCircle size={11} /> Inactive</>}
          </span>
        </div>
        <div className="scard__meta">
          {member.role && <span className="scard__tag"><Shield size={11} />{member.role}</span>}
          {branch && <span className="scard__tag"><GitBranch size={11} />{branch.name}</span>}
          {member.phone && <span className="scard__tag"><Phone size={11} />{member.phone}</span>}
          {member.email && <span className="scard__tag"><Mail size={11} />{member.email}</span>}
          <span className="scard__tag"><Clock size={11} />Last login: {fmt(member.last_login_at)}</span>
        </div>
      </div>
      <div className="scard__actions">
        <button onClick={onEdit} className="scard__btn" title="Edit"><Edit2 size={15} /></button>
        <button onClick={onPermissions} className="scard__btn" title="Permissions"><Shield size={15} /></button>
        <button onClick={onActivity} className="scard__btn" title="View Activity"><Activity size={15} /></button>
        <div className="scard__menu-wrap">
          <button onClick={() => setMenuOpen(v => !v)} className="scard__btn"><MoreVertical size={15} /></button>
          {menuOpen && (
            <>
              <div className="scard__menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="scard__menu">
                {status === 'active' ? (
                  <button onClick={() => { suspend.mutate(); setMenuOpen(false) }} className="scard__menu-item scard__menu-item--danger">
                    <Slash size={14} /> Suspend
                  </button>
                ) : (
                  <button onClick={() => { reactivate.mutate(); setMenuOpen(false) }} className="scard__menu-item">
                    <RotateCcw size={14} /> Reactivate
                  </button>
                )}
                <button onClick={() => { if (confirm(`Remove "${member.full_name}" permanently?`)) remove.mutate(); setMenuOpen(false) }} className="scard__menu-item scard__menu-item--danger">
                  <X size={14} /> Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Pending Reviews ──────────────────────────────────────────────────────────

function PendingReviews({ shopId }: { shopId: string }) {
  const qc = useQueryClient()

  const { data: pendingExpenses = [] } = useQuery({
    queryKey: ['owner-pending-expenses', shopId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_expense_submissions')
        .select('id, amount, category, description, status, created_at, staff:staff_id(full_name)')
        .eq('shop_id', shopId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const { data: pendingReports = [] } = useQuery({
    queryKey: ['owner-pending-reports', shopId],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_daily_reports')
        .select('id, title, category, severity, status, created_at, staff:staff_id(full_name)')
        .eq('shop_id', shopId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  const approveExpense = async (id: string) => {
    await supabase.from('employee_expense_submissions')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['owner-pending-expenses'] })
  }

  const rejectExpense = async (id: string) => {
    await supabase.from('employee_expense_submissions')
      .update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['owner-pending-expenses'] })
  }

  const markReportRead = async (id: string) => {
    await supabase.from('employee_daily_reports')
      .update({ status: 'read', reviewed_at: new Date().toISOString() }).eq('id', id)
    qc.invalidateQueries({ queryKey: ['owner-pending-reports'] })
  }

  return (
    <div className="pr-wrap">
      {/* Pending Expenses */}
      <div className="pr-section">
        <h2 className="pr-title">
          <Wallet size={16} /> Expense Approval Requests
          {pendingExpenses.length > 0 && <span className="pr-badge">{pendingExpenses.length}</span>}
        </h2>
        {pendingExpenses.length === 0 ? (
          <div className="pr-empty"><CheckCircle2 size={20} /><span>No pending expenses</span></div>
        ) : (
          <div className="pr-list">
            {pendingExpenses.map((e: any) => (
              <div key={e.id} className="pr-item">
                <div className="pr-item__left">
                  <span className="pr-item__who">{(e.staff as any)?.full_name ?? 'Staff'}</span>
                  <span className="pr-item__desc">{e.description}</span>
                  <span className="pr-item__meta">{e.category} · {new Date(e.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}</span>
                </div>
                <span className="pr-item__amount">TZS {(e.amount ?? 0).toLocaleString()}</span>
                <div className="pr-item__actions">
                  <button onClick={() => approveExpense(e.id)} className="pr-approve"><CheckCircle2 size={14} /> Approve</button>
                  <button onClick={() => rejectExpense(e.id)} className="pr-reject"><X size={14} /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Reports */}
      <div className="pr-section">
        <h2 className="pr-title">
          <FileText size={16} /> Employee Reports to Review
          {pendingReports.length > 0 && <span className="pr-badge">{pendingReports.length}</span>}
        </h2>
        {pendingReports.length === 0 ? (
          <div className="pr-empty"><CheckCircle2 size={20} /><span>No pending reports</span></div>
        ) : (
          <div className="pr-list">
            {pendingReports.map((r: any) => (
              <div key={r.id} className={`pr-item pr-item--${r.severity}`}>
                <div className="pr-item__left">
                  <span className="pr-item__who">{(r.staff as any)?.full_name ?? 'Staff'}</span>
                  <span className="pr-item__desc">{r.title}</span>
                  <span className="pr-item__meta">{r.category} · {new Date(r.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}</span>
                </div>
                <span className={`pr-sev pr-sev--${r.severity}`}>{r.severity}</span>
                <div className="pr-item__actions">
                  <button onClick={() => markReportRead(r.id)} className="pr-approve"><CheckCircle2 size={14} /> Mark Read</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function StaffPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const shopId = shop?.id

  const [tab, setTab] = useState<'staff' | 'pending' | 'sessions'>('staff')
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [permTarget, setPermTarget] = useState<StaffMember | null>(null)
  const [actTarget, setActTarget] = useState<StaffMember | null>(null)

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ['staff-full', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, active, suspended, phone, email, role, branch_id, created_at, last_login_at, login_count')
        .eq('shop_id', shopId!)
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').eq('shop_id', shopId!)
      return data ?? []
    },
  })

  const { data: pendingCount = 0 } = useQuery<number>({
    queryKey: ['pending-count', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const [exp, rep] = await Promise.all([
        supabase.from('employee_expense_submissions').select('id', { count: 'exact', head: true }).eq('shop_id', shopId!).eq('status', 'pending'),
        supabase.from('employee_daily_reports').select('id', { count: 'exact', head: true }).eq('shop_id', shopId!).eq('status', 'pending'),
      ])
      return (exp.count ?? 0) + (rep.count ?? 0)
    },
    refetchInterval: 60_000,
  })

  const filtered = staff.filter(s => {
    if (filter === 'active' && (s.suspended || !s.active)) return false
    if (filter === 'suspended' && !s.suspended) return false
    if (search) {
      const q = search.toLowerCase()
      return s.full_name.toLowerCase().includes(q) || s.phone?.includes(q) || s.email?.toLowerCase().includes(q)
    }
    return true
  })

  const activeCount = staff.filter(s => s.active && !s.suspended).length
  const suspendedCount = staff.filter(s => s.suspended).length

  return (
    <div className="sp-page">
      <div className="sp-head">
        <div>
          <h1 className="sp-title">Staff Management</h1>
          <p className="sp-sub">{activeCount} active · {suspendedCount} suspended · {staff.length} total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="sp-add-btn">
          <UserPlus size={16} /> Add Staff Member
        </button>
      </div>

      {/* Tabs */}
      <div className="sp-tabs">
        <button onClick={() => setTab('staff')} className={`sp-tab ${tab === 'staff' ? 'sp-tab--active' : ''}`}>
          <Users size={15} /> Staff Members ({staff.length})
        </button>
        <button onClick={() => setTab('pending')} className={`sp-tab ${tab === 'pending' ? 'sp-tab--active' : ''}`}>
          <RefreshCw size={15} /> Pending Reviews
          {pendingCount > 0 && <span className="sp-tab-badge">{pendingCount}</span>}
        </button>
        <button onClick={() => setTab('sessions')} className={`sp-tab ${tab === 'sessions' ? 'sp-tab--active' : ''}`}>
          <Activity size={15} /> Active Sessions
        </button>
      </div>

      {tab === 'staff' && (
        <>
          {/* Filter bar */}
          <div className="sp-filter-bar">
            <div className="sp-filter-btns">
              {(['all', 'active', 'suspended'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`sp-filter-btn ${filter === f ? 'sp-filter-btn--active' : ''}`}>
                  {f === 'all' ? `All (${staff.length})` : f === 'active' ? `Active (${activeCount})` : `Suspended (${suspendedCount})`}
                </button>
              ))}
            </div>
            <input
              placeholder="Search by name, phone, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="sp-search"
            />
          </div>

          {isLoading ? (
            <div className="sp-loading">Loading staff…</div>
          ) : filtered.length === 0 ? (
            <div className="sp-empty">
              <Users size={40} />
              <p>{search ? 'No staff match your search' : 'No staff members yet'}</p>
              {!search && <button onClick={() => setShowAdd(true)} className="sp-add-btn" style={{marginTop:12}}>Add Your First Staff Member</button>}
            </div>
          ) : (
            <div className="sp-list">
              {filtered.map(s => (
                <StaffCard
                  key={s.id}
                  member={s}
                  shopId={shopId!}
                  branches={branches}
                  onEdit={() => setEditing(s)}
                  onPermissions={() => setPermTarget(s)}
                  onActivity={() => setActTarget(s)}
                  onStatusChange={() => {}}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'pending' && shopId && <PendingReviews shopId={shopId} />}

      {tab === 'sessions' && shopId && <StaffSessionsPanel shopId={shopId} />}

      {/* Modals */}
      {(showAdd || editing) && shopId && (
        <StaffModal
          shopId={shopId}
          branches={branches}
          existing={editing ?? undefined}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={() => { setShowAdd(false); setEditing(null) }}
        />
      )}
      {permTarget && shopId && (
        <PermissionsModal staff={permTarget} shopId={shopId} onClose={() => setPermTarget(null)} />
      )}
      {actTarget && shopId && (
        <ActivityPanel staff={actTarget} shopId={shopId} onClose={() => setActTarget(null)} />
      )}

      <style>{`
        .sp-page { display:flex; flex-direction:column; gap:20px; }
        .sp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .sp-title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .sp-sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }
        .sp-add-btn {
          display:flex; align-items:center; gap:8px; padding:10px 18px;
          background:var(--color-primary); color:#fff; border-radius:12px;
          font-weight:700; font-size:.875rem; transition:opacity 120ms; flex-shrink:0;
        }
        .sp-add-btn:hover { opacity:.9; }

        .sp-tabs { display:flex; gap:4px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:12px; padding:4px; width:fit-content; }
        .sp-tab { display:flex; align-items:center; gap:8px; padding:8px 16px; border-radius:9px; font-size:.875rem; font-weight:600; color:var(--color-text-secondary); transition:all 120ms; position:relative; }
        .sp-tab--active { background:var(--color-surface); color:var(--color-primary); box-shadow:var(--shadow-xs); }
        .sp-tab-badge { background:var(--color-error); color:#fff; border-radius:999px; font-size:.65rem; font-weight:800; padding:1px 6px; }

        .sp-filter-bar { display:flex; flex-wrap:wrap; align-items:center; gap:12px; }
        .sp-filter-btns { display:flex; gap:4px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:10px; padding:3px; }
        .sp-filter-btn { padding:7px 12px; border-radius:8px; font-size:.8rem; font-weight:600; color:var(--color-text-secondary); transition:all 120ms; }
        .sp-filter-btn--active { background:var(--color-primary); color:#fff; }
        .sp-search { flex:1; max-width:280px; padding:8px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-surface); color:var(--color-text); font-size:.875rem; outline:none; }
        .sp-search:focus { border-color:var(--color-primary); }

        .sp-loading,.sp-empty { padding:40px; text-align:center; color:var(--color-text-muted); display:flex; flex-direction:column; align-items:center; gap:12px; }
        .sp-empty p { font-weight:700; font-size:.95rem; color:var(--color-text); margin:0; }

        .sp-list { display:flex; flex-direction:column; gap:10px; }

        /* Staff card */
        .scard {
          display:flex; align-items:center; gap:14px; padding:14px 18px;
          background:var(--color-surface); border:1px solid var(--color-border);
          border-radius:14px; transition:box-shadow 120ms;
        }
        .scard:hover { box-shadow:var(--shadow-m); }
        .scard--suspended { opacity:.75; border-style:dashed; }
        .scard__av {
          width:42px; height:42px; border-radius:50%; background:var(--color-primary); color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-weight:800; font-size:.9rem; font-family:var(--font-heading); flex-shrink:0;
        }
        .scard--suspended .scard__av { background:var(--color-text-muted); }
        .scard__info { flex:1; min-width:0; }
        .scard__top { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .scard__name { font-weight:700; font-size:.95rem; color:var(--color-text); }
        .scard__badge { display:flex; align-items:center; gap:4px; font-size:.68rem; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase; }
        .scard__badge--active { background:var(--color-success-bg); color:var(--color-success); }
        .scard__badge--suspended { background:var(--color-error-bg); color:var(--color-error); }
        .scard__badge--inactive { background:var(--color-border); color:var(--color-text-muted); }
        .scard__meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:5px; }
        .scard__tag { display:flex; align-items:center; gap:4px; font-size:.72rem; color:var(--color-text-muted); background:var(--color-bg); padding:2px 8px; border-radius:6px; }
        .scard__actions { display:flex; align-items:center; gap:4px; flex-shrink:0; }
        .scard__btn { padding:6px; border-radius:8px; color:var(--color-text-secondary); transition:all 120ms; }
        .scard__btn:hover { color:var(--color-primary); background:var(--color-primary-light); }
        .scard__menu-wrap { position:relative; }
        .scard__menu-backdrop { position:fixed; inset:0; z-index:10; }
        .scard__menu { position:absolute; right:0; top:36px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; box-shadow:var(--shadow-lg); overflow:hidden; z-index:20; min-width:160px; }
        .scard__menu-item { display:flex; align-items:center; gap:8px; width:100%; padding:10px 14px; font-size:.875rem; font-weight:500; color:var(--color-text); transition:background 120ms; }
        .scard__menu-item:hover { background:var(--color-bg); }
        .scard__menu-item--danger { color:var(--color-error); }
        .scard__menu-item--danger:hover { background:var(--color-error-bg); }

        /* Pending reviews */
        .pr-wrap { display:flex; flex-direction:column; gap:24px; }
        .pr-section { background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; overflow:hidden; }
        .pr-title { display:flex; align-items:center; gap:8px; font-size:.95rem; font-weight:700; color:var(--color-text); padding:16px 20px; border-bottom:1px solid var(--color-border); margin:0; }
        .pr-badge { background:var(--color-error); color:#fff; border-radius:999px; font-size:.65rem; font-weight:800; padding:1px 7px; margin-left:4px; }
        .pr-empty { display:flex; align-items:center; gap:10px; padding:20px; color:var(--color-success); font-size:.875rem; }
        .pr-list { display:flex; flex-direction:column; }
        .pr-item { display:flex; align-items:center; gap:12px; padding:14px 20px; border-bottom:1px solid var(--color-border); transition:background 120ms; }
        .pr-item:last-child { border-bottom:none; }
        .pr-item:hover { background:var(--color-bg); }
        .pr-item--urgent { border-left:3px solid var(--color-error); }
        .pr-item--high { border-left:3px solid var(--color-warning); }
        .pr-item__left { flex:1; min-width:0; }
        .pr-item__who { display:block; font-weight:700; font-size:.875rem; color:var(--color-text); }
        .pr-item__desc { display:block; font-size:.82rem; color:var(--color-text-secondary); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .pr-item__meta { display:block; font-size:.72rem; color:var(--color-text-muted); margin-top:2px; }
        .pr-item__amount { font-weight:800; font-size:.95rem; color:var(--color-text); flex-shrink:0; }
        .pr-item__actions { display:flex; gap:6px; flex-shrink:0; }
        .pr-approve { display:flex; align-items:center; gap:5px; padding:6px 12px; background:var(--color-success-bg); color:var(--color-success); border-radius:8px; font-size:.78rem; font-weight:700; transition:all 120ms; }
        .pr-approve:hover { background:var(--color-success); color:#fff; }
        .pr-reject { display:flex; align-items:center; gap:5px; padding:6px 12px; background:var(--color-error-bg); color:var(--color-error); border-radius:8px; font-size:.78rem; font-weight:700; transition:all 120ms; }
        .pr-reject:hover { background:var(--color-error); color:#fff; }
        .pr-sev { font-size:.68rem; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase; flex-shrink:0; }
        .pr-sev--low { background:var(--color-success-bg); color:var(--color-success); }
        .pr-sev--medium { background:var(--color-warning-bg); color:var(--color-warning); }
        .pr-sev--high { background:var(--color-error-bg); color:var(--color-error); }
        .pr-sev--urgent { background:#7c3aed22; color:#7c3aed; }

        /* Staff Modal */
        .sm-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; z-index:300; }
        .sm-modal { background:var(--color-surface); border-radius:20px; width:100%; max-width:540px; box-shadow:var(--shadow-lg); overflow:hidden; }
        .sm-modal--wide { max-width:680px; }
        .sm-modal--xl { max-width:760px; }
        .sm-modal__head { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--color-border); }
        .sm-modal__head h2 { font-size:1rem; font-weight:700; margin:0; color:var(--color-text); flex:1; }
        .sm-modal__icon { color:var(--color-primary); flex-shrink:0; }
        .sm-modal__close { margin-left:auto; color:var(--color-text-muted); padding:4px; border-radius:6px; flex-shrink:0; }
        .sm-modal__body { padding:20px; display:flex; flex-direction:column; gap:14px; max-height:70vh; overflow-y:auto; }
        .sm-modal__body--scroll { overflow-y:auto; }
        .sm-modal__foot { display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--color-border); }
        .sm-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media(max-width:480px){ .sm-grid2{ grid-template-columns:1fr; } }
        .sm-label { display:flex; flex-direction:column; gap:6px; font-size:.82rem; font-weight:600; color:var(--color-text-secondary); }
        .sm-input { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; }
        .sm-input:focus { border-color:var(--color-primary); }
        .sm-input--pin { padding-right:40px; }
        .sm-select { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; }
        .sm-pin-wrap { position:relative; }
        .sm-pin-eye { position:absolute; right:12px; top:50%; transform:translateY(-50%); color:var(--color-text-muted); }
        .sm-error { background:var(--color-error-bg); color:var(--color-error); padding:8px 12px; border-radius:8px; font-size:.82rem; margin:0; }
        .sm-cancel { padding:10px 18px; border:1.5px solid var(--color-border); border-radius:10px; font-weight:600; color:var(--color-text-secondary); font-size:.875rem; }
        .sm-save { display:flex; align-items:center; gap:6px; padding:10px 20px; background:var(--color-primary); color:#fff; border-radius:10px; font-weight:700; font-size:.875rem; }
        .sm-save:disabled { opacity:.6; cursor:not-allowed; }
        .sm-perm-hint { font-size:.82rem; color:var(--color-text-muted); margin:0; }
        .sm-perms-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:8px; }
        .sm-perm-item { display:flex; align-items:center; gap:10px; padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; cursor:pointer; font-size:.82rem; font-weight:500; color:var(--color-text-secondary); transition:all 120ms; }
        .sm-perm-item:hover { border-color:var(--color-primary); color:var(--color-text); }
        .sm-perm-item--on { border-color:var(--color-primary); background:var(--color-primary-light); color:var(--color-primary); }
        .sm-perm-check { accent-color:var(--color-primary); }
        .sm-perm-ok { margin-left:auto; color:var(--color-success); }
        .sm-empty-text { color:var(--color-text-muted); font-size:.875rem; text-align:center; padding:24px; }

        /* Activity panel */
        .sm-act-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
        @media(max-width:480px){ .sm-act-stats{ grid-template-columns:repeat(2,1fr); } }
        .sm-act-stat { background:var(--color-bg); border-radius:12px; padding:14px; text-align:center; }
        .sm-act-stat span { display:block; font-size:1.1rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); }
        .sm-act-stat small { display:block; font-size:.7rem; color:var(--color-text-muted); margin-top:3px; }
        .sm-act-section { margin-bottom:16px; }
        .sm-act-section__title { font-size:.82rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--color-text-muted); margin:0 0 8px; }
        .sm-act-row { display:flex; align-items:center; gap:10px; padding:9px 12px; background:var(--color-bg); border-radius:8px; font-size:.82rem; margin-bottom:4px; }
        .sm-act-row__main { flex:1; color:var(--color-text); font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .sm-act-row__detail { color:var(--color-text-muted); font-size:.75rem; }
        .sm-act-row__amount { font-weight:700; color:var(--color-text); margin-left:auto; }
        .sm-act-row__time { font-size:.72rem; color:var(--color-text-muted); }
        .sm-badge { font-size:.65rem; font-weight:700; padding:2px 7px; border-radius:999px; text-transform:uppercase; flex-shrink:0; }
        .sm-badge--open { background:var(--color-success-bg); color:var(--color-success); }
        .sm-badge--closed { background:var(--color-border); color:var(--color-text-secondary); }
        .sm-badge--reviewed { background:var(--color-info-bg); color:var(--color-info); }
        .sm-badge--low { background:var(--color-success-bg); color:var(--color-success); }
        .sm-badge--medium { background:var(--color-warning-bg); color:var(--color-warning); }
        .sm-badge--high,.sm-badge--urgent { background:var(--color-error-bg); color:var(--color-error); }
        .sm-badge--pending { background:var(--color-warning-bg); color:var(--color-warning); }
        .sm-badge--read,.sm-badge--resolved { background:var(--color-success-bg); color:var(--color-success); }
      `}</style>
    </div>
  )
}
