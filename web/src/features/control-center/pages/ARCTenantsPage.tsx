import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
import {
  Search, Eye, Ban, CheckCircle, Trash2,
  RefreshCw, Download, ChevronLeft, ChevronRight,
  Building2, Users, DollarSign,
  ArrowUpDown, LogIn, Shield,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format } from 'date-fns'
import { useARCAdmin, useARCAuditLog } from '../useARCAuth'

const PLANS = ['all', 'starter', 'business', 'pro', 'enterprise'] as const
const STATUSES = ['all', 'active', 'trial', 'grace', 'expired', 'suspended', 'cancelled'] as const
const PAGE_SIZE = 25

const PLAN_COLORS: Record<string, string> = {
  starter: '#06b6d4', business: '#3b82f6', pro: '#a855f7', enterprise: '#f97316', free: '#64748b',
}
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: 'rgba(34,197,94,0.12)',   text: '#22c55e' },
  trial:     { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6' },
  grace:     { bg: 'rgba(234,179,8,0.12)',   text: '#eab308' },
  expired:   { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },
  suspended: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },
  cancelled: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
}

function Pill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.cancelled
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, background: c.bg, color: c.text,
      textTransform: 'capitalize',
    }}>{status}</span>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const c = PLAN_COLORS[plan] ?? '#64748b'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700,
      background: `${c}18`, color: c, textTransform: 'capitalize',
      border: `1px solid ${c}30`,
    }}>{plan}</span>
  )
}

export function ARCTenantsPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    bg: dark ? '#070d1a' : '#f1f5f9', surface: dark ? '#0d1526' : '#ffffff',
    surface2: dark ? '#111827' : '#f8fafc', border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const { data: admin } = useARCAdmin()
  const auditLog = useARCAuditLog()
  const qc = useQueryClient()

  const [planFilter, setPlanFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'plan'>('created')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<any | null>(null)
  const [confirm, setConfirm] = useState<{ tenant: any; action: string } | null>(null)
  const [impersonating, setImpersonating] = useState<any | null>(null)

  const { data: tenants = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['arc-tenants', planFilter, statusFilter, search, page, sortBy, sortDir],
    queryFn: async () => {
      let q = supabase
        .from('shop_subscriptions')
        .select(`
          plan_name, status, trial_ends_at, current_period_end, billing_cycle, created_at,
          shop:shop_id(id, name, phone, address, created_at, owner_user_id)
        `)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (planFilter !== 'all') q = q.eq('plan_name', planFilter)
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)

      const { data, error } = await q
      if (error) throw error

      let rows = (data ?? []).map((s: any) => ({
        id: s.shop?.id,
        name: s.shop?.name ?? 'Unknown',
        phone: s.shop?.phone ?? '—',
        owner_id: s.shop?.owner_user_id,
        created_at: s.shop?.created_at,
        plan_name: s.plan_name,
        status: s.status,
        trial_ends_at: s.trial_ends_at,
        current_period_end: s.current_period_end,
        billing_cycle: s.billing_cycle,
      }))

      if (search) {
        const q = search.toLowerCase()
        rows = rows.filter(r =>
          r.name?.toLowerCase().includes(q) ||
          r.phone?.toLowerCase().includes(q) ||
          r.id?.toLowerCase().includes(q)
        )
      }

      if (sortBy === 'name') rows.sort((a, b) => sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
      if (sortBy === 'created') rows.sort((a, b) => sortDir === 'asc'
        ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      return rows
    },
  })

  const { data: planStats } = useQuery({
    queryKey: ['arc-plan-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('shop_subscriptions').select('plan_name, status')
      if (!data) return {}
      const result: Record<string, Record<string, number>> = {}
      for (const s of data) {
        if (!result[s.plan_name]) result[s.plan_name] = { total: 0, active: 0, trial: 0, expired: 0, revenue: 0 }
        result[s.plan_name].total++
        if (s.status === 'active') result[s.plan_name].active++
        if (s.status === 'trial') result[s.plan_name].trial++
        if (s.status === 'expired' || s.status === 'cancelled') result[s.plan_name].expired++
      }
      const PRICE: Record<string, number> = { starter: 25000, business: 60000, pro: 120000, enterprise: 250000 }
      for (const plan in result) result[plan].revenue = result[plan].active * (PRICE[plan] ?? 0)
      return result
    },
  })

  const actionMutation = useMutation({
    mutationFn: async ({ tenantId, tenantName, action }: { tenantId: string; tenantName: string; action: string }) => {
      if (action === 'suspend') {
        await supabase.from('shop_subscriptions').update({ status: 'suspended', suspended_at: new Date().toISOString() }).eq('shop_id', tenantId)
      } else if (action === 'activate') {
        await supabase.from('shop_subscriptions').update({ status: 'active', suspended_at: null }).eq('shop_id', tenantId)
      } else if (action === 'delete') {
        await supabase.from('shops').delete().eq('id', tenantId)
      }
      if (admin) await auditLog.mutateAsync({ admin, action: `tenant_${action}`, resource_type: 'tenant', resource_id: tenantId, resource_name: tenantName })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['arc-tenants'] }); setConfirm(null) },
  })

  function toggleSort(col: typeof sortBy) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const fmtCur = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0, notation: 'compact' }).format(n)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Tenant Management</h1>
          <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Manage all registered businesses on DukaOS</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10,
            color: d.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <RefreshCw size={13} style={{ animation: isFetching ? 'arc-spin 0.8s linear infinite' : 'none' }} /> Refresh
          </button>
          <button onClick={() => {
            const rows = tenants.map((t: any) => [
              t.shop?.name ?? '', t.plan_name ?? '', t.status ?? '',
              t.shop?.phone ?? '', t.billing_cycle ?? '',
              t.shop?.created_at ? new Date(t.shop.created_at).toLocaleDateString() : '',
            ])
            downloadCSV(`tenants-${new Date().toISOString().slice(0,10)}.csv`,
              ['Business Name', 'Plan', 'Status', 'Phone', 'Billing Cycle', 'Joined'], rows)
          }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10,
            color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            <Download size={13} /> Export
          </button>
          <style>{`@keyframes arc-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>

      {/* Plan Tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {PLANS.map(p => {
          const stats = planStats?.[p]
          const c = PLAN_COLORS[p] ?? '#64748b'
          const isActive = planFilter === p
          return (
            <button key={p} onClick={() => { setPlanFilter(p); setPage(0) }} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '10px 16px', borderRadius: 12,
              background: isActive ? `${c}18` : d.surface,
              border: isActive ? `2px solid ${c}40` : `1px solid ${d.border}`,
              cursor: 'pointer', transition: 'all 0.15s', minWidth: 120,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: isActive ? c : d.muted,
              }}>{p === 'all' ? 'All Accounts' : `${p} Plan`}</span>
              {p !== 'all' && stats && (
                <span style={{ color: d.text, fontSize: 18, fontWeight: 800, marginTop: 2 }}>{stats.total ?? 0}</span>
              )}
              {p !== 'all' && stats && (
                <span style={{ color: d.muted, fontSize: 10, marginTop: 1 }}>
                  {stats.active} active · {fmtCur(stats.revenue)}/mo
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Per-plan Summary */}
      {planFilter !== 'all' && planStats?.[planFilter] && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12,
          padding: 16, background: d.surface, borderRadius: 14, border: `1px solid ${d.border}`,
        }}>
          {[
            { label: `${planFilter} Accounts`, value: planStats[planFilter].total, icon: Building2, color: PLAN_COLORS[planFilter] },
            { label: 'Active', value: planStats[planFilter].active, icon: CheckCircle, color: '#22c55e' },
            { label: 'Trial', value: planStats[planFilter].trial, icon: Users, color: '#3b82f6' },
            { label: 'Expired', value: planStats[planFilter].expired, icon: Ban, color: '#ef4444' },
            { label: 'Monthly Revenue', value: fmtCur(planStats[planFilter].revenue), icon: DollarSign, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, background: d.surface2, borderRadius: 10, border: `1px solid ${d.border}` }}>
              <s.icon size={16} style={{ color: s.color }} />
              <span style={{ color: d.text, fontSize: 18, fontWeight: 800 }}>{s.value}</span>
              <span style={{ color: d.muted, fontSize: 11 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: d.muted }} />
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Search by name, phone, ID…"
            style={{
              width: '100%', padding: '9px 12px 9px 36px', boxSizing: 'border-box',
              background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10,
              color: d.text, fontSize: 13, outline: 'none',
            }}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }} style={{
          padding: '9px 12px', background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 10, color: d.sub, fontSize: 13, cursor: 'pointer', outline: 'none',
        }}>
          {STATUSES.map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${d.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${d.border}` }}>
                  {[
                    { label: 'Business Name', col: 'name' as const },
                    { label: 'Plan', col: null },
                    { label: 'Status', col: null },
                    { label: 'Registered', col: 'created' as const },
                    { label: 'Expiry', col: null },
                    { label: 'Actions', col: null },
                  ].map(h => (
                    <th key={h.label} onClick={h.col ? () => toggleSort(h.col!) : undefined} style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                      color: d.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: d.surface2, cursor: h.col ? 'pointer' : 'default',
                      userSelect: 'none', whiteSpace: 'nowrap',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {h.label} {h.col && <ArrowUpDown size={11} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: d.muted }}>No tenants found</td></tr>
                ) : tenants.map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${d.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = d.surface2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: `${PLAN_COLORS[t.plan_name] ?? '#64748b'}20`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: PLAN_COLORS[t.plan_name] ?? '#64748b', fontWeight: 800, fontSize: 13,
                          flexShrink: 0,
                        }}>
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: d.text, fontWeight: 600 }}>{t.name}</div>
                          <div style={{ color: d.muted, fontSize: 11 }}>{t.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><PlanBadge plan={t.plan_name} /></td>
                    <td style={{ padding: '12px 16px' }}><Pill status={t.status} /></td>
                    <td style={{ padding: '12px 16px', color: d.sub, fontSize: 12 }}>
                      {t.created_at ? format(new Date(t.created_at), 'dd MMM yyyy') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: d.sub, fontSize: 12 }}>
                      {t.current_period_end ? format(new Date(t.current_period_end), 'dd MMM yyyy') : t.trial_ends_at ? format(new Date(t.trial_ends_at), 'dd MMM yyyy') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[
                          { icon: Eye, title: 'View Details', color: d.muted, hoverColor: '#3b82f6', action: () => setSelected(t) },
                          { icon: t.status !== 'suspended' ? Ban : CheckCircle,
                            title: t.status !== 'suspended' ? 'Suspend' : 'Activate',
                            color: d.muted, hoverColor: t.status !== 'suspended' ? '#f97316' : '#22c55e',
                            action: () => setConfirm({ tenant: t, action: t.status !== 'suspended' ? 'suspend' : 'activate' }) },
                          ...(admin?.role === 'founder' ? [
                            { icon: LogIn, title: 'Login As', color: d.muted, hoverColor: '#a855f7', action: () => setImpersonating(t) },
                          ] : []),
                          ...(admin?.role === 'founder' || admin?.role === 'chief_admin' ? [
                            { icon: Trash2, title: 'Delete', color: d.muted, hoverColor: '#ef4444', action: () => setConfirm({ tenant: t, action: 'delete' }) },
                          ] : []),
                        ].map((btn, i) => (
                          <button key={i} title={btn.title} onClick={btn.action} style={{
                            padding: '5px 7px', background: 'none',
                            border: `1px solid ${d.border}`, borderRadius: 7,
                            color: btn.color, cursor: 'pointer', transition: 'all 0.15s',
                          }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = btn.hoverColor; (e.currentTarget as HTMLElement).style.borderColor = btn.hoverColor }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = btn.color; (e.currentTarget as HTMLElement).style.borderColor = d.border }}>
                            <btn.icon size={13} />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderTop: `1px solid ${d.border}`,
        }}>
          <span style={{ color: d.muted, fontSize: 12 }}>
            Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + tenants.length} results
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 8,
              color: page === 0 ? d.muted : d.sub, cursor: page === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12, opacity: page === 0 ? 0.5 : 1,
            }}>
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{
              padding: '6px 12px', background: '#3b82f618', border: '1px solid #3b82f630',
              borderRadius: 8, color: '#3b82f6', fontSize: 12, fontWeight: 700,
            }}>Page {page + 1}</span>
            <button disabled={tenants.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
              background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 8,
              color: tenants.length < PAGE_SIZE ? d.muted : d.sub,
              cursor: tenants.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
              fontSize: 12, opacity: tenants.length < PAGE_SIZE ? 0.5 : 1,
            }}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelected(null)}>
          <div style={{
            background: dark ? '#0d1526' : '#fff',
            border: `1px solid ${d.border}`,
            borderRadius: 20, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${d.border}` }}>
              <h3 style={{ color: d.text, fontWeight: 700, margin: 0 }}>Tenant Details</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: d.muted, cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>
            <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                ['Business Name', selected.name],
                ['Tenant ID', selected.id],
                ['Phone', selected.phone || '—'],
                ['Plan', selected.plan_name],
                ['Status', selected.status],
                ['Billing Cycle', selected.billing_cycle],
                ['Registered', selected.created_at ? format(new Date(selected.created_at), 'dd MMM yyyy') : '—'],
                ['Expiry Date', selected.current_period_end ? format(new Date(selected.current_period_end), 'dd MMM yyyy') : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ color: d.muted, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
                  <span style={{ color: d.text, fontWeight: 600, fontFamily: label === 'Tenant ID' ? 'monospace' : 'inherit', fontSize: label === 'Tenant ID' ? 11 : 14 }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => { setConfirm({ tenant: selected, action: selected.status !== 'suspended' ? 'suspend' : 'activate' }); setSelected(null) }} style={{
                flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316',
              }}>
                {selected.status !== 'suspended' ? 'Suspend' : 'Activate'}
              </button>
              {admin?.role === 'founder' && (
                <button onClick={() => { setImpersonating(selected); setSelected(null) }} style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7',
                }}>
                  Login As Customer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setConfirm(null)}>
          <div style={{
            background: dark ? '#0d1526' : '#fff', border: `1px solid ${d.border}`,
            borderRadius: 20, maxWidth: 400, width: '100%', padding: 24,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: d.text, fontWeight: 700, margin: '0 0 8px' }}>
              {confirm.action === 'delete' ? '⚠ Delete Tenant' : confirm.action === 'suspend' ? 'Suspend Tenant' : 'Activate Tenant'}
            </h3>
            <p style={{ color: d.sub, fontSize: 13, margin: '0 0 20px' }}>
              {confirm.action === 'delete'
                ? `This will permanently delete "${confirm.tenant.name}" and all their data. This action CANNOT be undone.`
                : `Are you sure you want to ${confirm.action} "${confirm.tenant.name}"?`}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirm(null)} style={{
                flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: d.surface2, border: `1px solid ${d.border}`, color: d.sub,
              }}>Cancel</button>
              <button
                onClick={() => actionMutation.mutate({ tenantId: confirm.tenant.id, tenantName: confirm.tenant.name, action: confirm.action })}
                disabled={actionMutation.isPending}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  background: confirm.action === 'delete' ? '#ef4444' : confirm.action === 'suspend' ? '#f97316' : '#22c55e',
                  border: 'none', color: '#fff',
                }}>
                {actionMutation.isPending ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impersonation Banner */}
      {impersonating && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
          background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
          padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', fontSize: 13, fontWeight: 600 }}>
            <Shield size={16} />
            You are accessing "{impersonating.name}" as AutoRevenue Labs Support. All actions are logged.
          </div>
          <button onClick={() => setImpersonating(null)} style={{
            background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 8, color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>
            End Session
          </button>
        </div>
      )}
    </div>
  )
}
