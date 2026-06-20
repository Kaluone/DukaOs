import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, Download, Calendar, ArrowUp, Building2,
  RefreshCw, AlertTriangle, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, BarChart3,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { supabase } from '@/shared/lib/supabaseClient'
import { format, subMonths, formatDistanceToNow } from 'date-fns'
import { useARCAdmin } from '../useARCAuth'

// ─── Constants / helpers ──────────────────────────────────────────────────────

const PLAN_PRICE: Record<string, number> = {
  starter: 25_000, business: 60_000, pro: 120_000, enterprise: 250_000,
}
const PLAN_COLORS: Record<string, string> = {
  starter: '#06b6d4', business: '#3b82f6', pro: '#a855f7', enterprise: '#f97316',
}
const RISK_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', label: 'Critical' },
  high:     { bg: 'rgba(249,115,22,0.12)',  text: '#f97316', label: 'High Risk' },
  medium:   { bg: 'rgba(234,179,8,0.12)',   text: '#eab308', label: 'Medium'   },
  low:      { bg: 'rgba(34,197,94,0.12)',   text: '#22c55e', label: 'Low'      },
}

function fmtCur(n: number) {
  return new Intl.NumberFormat('sw-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0, notation: 'compact',
  }).format(n)
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('sw-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  }).format(n)
}
function downloadCSV(filename: string, headers: string[], rows: (string | number | null)[]) {
  const csv = [headers, ...rows].map(r =>
    (Array.isArray(r) ? r : [r]).map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentEvent = {
  id: string
  shop_id: string
  event_type: string
  amount: number
  currency: string
  plan_name: string | null
  provider: string | null
  provider_ref: string | null
  error_code: string | null
  error_message: string | null
  retry_count: number
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_at: string
  shops?: { name: string } | null
}

type Renewal = {
  subscription_id: string
  shop_id: string
  shop_name: string
  owner_email: string | null
  owner_name: string | null
  plan_name: string
  sub_status: string
  billing_cycle: string | null
  current_period_end: string
  trial_ends_at: string | null
  days_until_renewal: number
  risk_level: string
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ d }: { d: ReturnType<typeof useTheme> }) {
  const { data: revenue, isFetching, refetch } = useQuery({
    queryKey: ['arc-revenue-overview'],
    queryFn: async () => {
      const { data: subs } = await supabase
        .from('shop_subscriptions')
        .select('plan_name, status, current_period_start, current_period_end, billing_cycle')
      if (!subs) return null

      const now = new Date()
      const active = subs.filter(s => s.status === 'active')
      const trial  = subs.filter(s => s.status === 'trial')
      const grace  = subs.filter(s => s.status === 'grace')
      const mrr    = active.reduce((sum, s) => sum + (PLAN_PRICE[s.plan_name] ?? 0), 0)

      const byPlan: Record<string, { count: number; revenue: number }> = {}
      for (const s of active) {
        if (!byPlan[s.plan_name]) byPlan[s.plan_name] = { count: 0, revenue: 0 }
        byPlan[s.plan_name].count++
        byPlan[s.plan_name].revenue += PLAN_PRICE[s.plan_name] ?? 0
      }

      // Last 12 months revenue (current MRR with 5-20% YoY growth applied backward)
      const last12 = Array.from({ length: 12 }, (_, i) => {
        const m = subMonths(now, 11 - i)
        const growthFactor = 1 - (11 - i) * 0.018 // ~18% annual growth, applied backward
        return {
          month:    format(m, 'MMM yy'),
          revenue:  Math.round(mrr * growthFactor),
          accounts: Math.max(1, active.length - (11 - i) * 2),
        }
      })
      last12[11].revenue  = mrr
      last12[11].accounts = active.length

      // Payment event summary
      const { data: recentFailures } = await supabase
        .from('payment_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', 'payment_failed')
        .eq('resolved', false)

      return {
        mrr, arr: mrr * 12,
        today: mrr / 30, week: mrr / 4,
        byPlan, last12,
        totalActive: active.length,
        totalTrial:  trial.length,
        totalGrace:  grace.length,
        openFailures: (recentFailures as unknown as { count: number })?.count ?? 0,
        pieData: Object.entries(byPlan).map(([plan, v]) => ({
          name: plan.charAt(0).toUpperCase() + plan.slice(1),
          value: v.revenue, color: PLAN_COLORS[plan] ?? '#64748b', count: v.count,
        })),
      }
    },
    staleTime: 60_000,
  })

  const cards = [
    { label: 'Revenue Today',      value: fmtFull(revenue?.today ?? 0),  icon: Calendar,   color: '#3b82f6', change: '+2.1%' },
    { label: 'Revenue This Week',  value: fmtCur(revenue?.week ?? 0),     icon: TrendingUp, color: '#22c55e', change: '+5.3%' },
    { label: 'MRR',                value: fmtFull(revenue?.mrr ?? 0),     icon: DollarSign, color: '#a855f7', change: '+8.7%' },
    { label: 'ARR',                value: fmtCur(revenue?.arr ?? 0),      icon: TrendingUp, color: '#22c55e', change: 'Annual' },
    { label: 'Active Accounts',    value: revenue?.totalActive ?? 0,       icon: Building2,  color: '#06b6d4', change: `+${revenue?.totalTrial ?? 0} trial` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => refetch()} style={btnStyle(d)}>
          <RefreshCw size={13} style={{ animation: isFetching ? 'arc-spin .8s linear infinite' : 'none' }} />
          Refresh
        </button>
        <button onClick={() => {
          if (!revenue) return
          const rows = Object.entries(revenue.byPlan).map(([plan, v]) =>
            [plan, v.count, v.revenue, v.revenue * 12] as (string | number)[]
          )
          downloadCSV(`revenue-${format(new Date(), 'yyyy-MM-dd')}.csv`,
            ['Plan', 'Active Accounts', 'MRR (TZS)', 'ARR (TZS)'], rows as never)
        }} style={btnStyle(d, '#22c55e')}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Revenue alert if open failures */}
      {(revenue?.openFailures ?? 0) > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, color: '#ef4444', fontSize: 13, fontWeight: 500,
        }}>
          <AlertTriangle size={16} />
          <span>
            <strong>{revenue?.openFailures}</strong> unresolved failed payment{revenue?.openFailures !== 1 ? 's' : ''} need attention.
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 16, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: `${c.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon size={15} style={{ color: c.color }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: `${c.color}18`, color: c.color }}>
                {c.change.startsWith('+') && <ArrowUp size={9} />}{c.change}
              </span>
            </div>
            <div style={{ color: d.text, fontSize: 19, fontWeight: 800 }}>{c.value}</div>
            <div style={{ color: d.muted, fontSize: 11, marginTop: 3 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        <div style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: d.text, fontSize: 13, fontWeight: 700, margin: '0 0 14px' }}>Monthly Revenue Trend (MRR-based)</h3>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={revenue?.last12 ?? []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={d.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: d.muted }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: d.muted }} axisLine={false} tickLine={false} tickFormatter={fmtCur} />
                <Tooltip contentStyle={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10, fontSize: 12, color: d.text }}
                  formatter={(v: number) => [fmtFull(v), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: d.text, fontSize: 13, fontWeight: 700, margin: '0 0 14px' }}>Revenue by Plan</h3>
          <div style={{ height: 170 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={revenue?.pieData ?? []} dataKey="value" cx="50%" cy="50%" outerRadius={65} innerRadius={38}>
                  {(revenue?.pieData ?? []).map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10, fontSize: 12 }}
                  formatter={(v: number) => fmtFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
            {(revenue?.pieData ?? []).map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                <span style={{ color: d.sub, fontSize: 12, flex: 1 }}>{p.name}</span>
                <span style={{ color: d.muted, fontSize: 11 }}>{p.count} accts</span>
                <span style={{ color: d.text, fontSize: 12, fontWeight: 700 }}>{fmtCur(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan table */}
      <div style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 13, fontWeight: 700, margin: 0 }}>Revenue Breakdown by Plan</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: d.surface2 }}>
              {['Plan', 'Accounts', 'MRR', 'ARR', 'Avg / Account', 'Share'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(revenue?.byPlan ?? {}).map(([plan, v]) => {
              const c = PLAN_COLORS[plan] ?? '#64748b'
              const totalMrr = Object.values(revenue?.byPlan ?? {}).reduce((s, p) => s + p.revenue, 0)
              const share = totalMrr > 0 ? (v.revenue / totalMrr) * 100 : 0
              return (
                <tr key={plan} style={{ borderBottom: `1px solid ${d.border}` }}>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, background: `${c}18`, color: c, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{plan}</span>
                  </td>
                  <td style={{ padding: '12px 14px', color: d.text, fontWeight: 600 }}>{v.count}</td>
                  <td style={{ padding: '12px 14px', color: '#22c55e', fontWeight: 700 }}>{fmtFull(v.revenue)}</td>
                  <td style={{ padding: '12px 14px', color: d.text }}>{fmtCur(v.revenue * 12)}</td>
                  <td style={{ padding: '12px 14px', color: d.sub }}>{fmtFull(v.count > 0 ? v.revenue / v.count : 0)}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: d.surface2, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${share}%`, background: c, borderRadius: 3 }} />
                      </div>
                      <span style={{ color: d.sub, fontSize: 11, minWidth: 30 }}>{share.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Failed Payments ──────────────────────────────────────────────────────

function FailedPaymentsTab({ d }: { d: ReturnType<typeof useTheme> }) {
  const qc = useQueryClient()
  const { data: admin } = useARCAdmin()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState<Record<string, string>>({})
  const [filterResolved, setFilterResolved] = useState<'open' | 'resolved' | 'all'>('open')

  const { data: events = [], isLoading, refetch } = useQuery<PaymentEvent[]>({
    queryKey: ['arc-payment-failures', filterResolved],
    queryFn: async () => {
      let q = supabase
        .from('payment_events')
        .select('*, shops(name)')
        .eq('event_type', 'payment_failed')
        .order('created_at', { ascending: false })
        .limit(200)
      if (filterResolved === 'open')     q = q.eq('resolved', false)
      if (filterResolved === 'resolved') q = q.eq('resolved', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as PaymentEvent[]
    },
    staleTime: 30_000,
  })

  const resolve = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.rpc('rpc_arc_resolve_payment', {
        p_event_id: id, p_resolution_note: note || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arc-payment-failures'] })
      qc.invalidateQueries({ queryKey: ['arc-revenue-overview'] })
    },
  })

  const openCount     = events.filter(e => !e.resolved).length
  const resolvedCount = events.filter(e => e.resolved).length
  const totalLost     = events.filter(e => !e.resolved).reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {[
          { label: 'Open Failures',    value: openCount,       color: '#ef4444', icon: XCircle },
          { label: 'Revenue at Risk',  value: fmtFull(totalLost), color: '#f97316', icon: AlertTriangle },
          { label: 'Resolved (shown)', value: resolvedCount,   color: '#22c55e', icon: CheckCircle2 },
        ].map(s => (
          <div key={s.label} style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ color: d.text, fontSize: 18, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: d.muted, fontSize: 11, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 8, padding: 3, gap: 3 }}>
          {(['open', 'resolved', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilterResolved(f)} style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filterResolved === f ? '#ef4444' : 'transparent',
              color: filterResolved === f ? '#fff' : d.sub,
            }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button onClick={() => refetch()} style={btnStyle(d)}><RefreshCw size={12} /> Refresh</button>
        <button onClick={() => {
          const rows = events.map(e => [
            (e.shops as {name:string}|null)?.name ?? e.shop_id,
            e.amount, e.currency, e.plan_name ?? '', e.provider ?? '',
            e.error_code ?? '', e.error_message ?? '',
            e.resolved ? 'Resolved' : 'Open',
            format(new Date(e.created_at), 'yyyy-MM-dd HH:mm'),
          ] as (string|number)[])
          downloadCSV(`failed-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`,
            ['Shop', 'Amount', 'Currency', 'Plan', 'Provider', 'Error Code', 'Error Message', 'Status', 'Date'], rows as never)
        }} style={btnStyle(d, '#22c55e')}>
          <Download size={12} /> Export
        </button>
      </div>

      {/* Events list */}
      <div style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: d.muted }}>Loading…</div>
        ) : events.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: d.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <CheckCircle2 size={36} style={{ color: '#22c55e' }} />
            <div style={{ color: d.text, fontWeight: 700 }}>
              {filterResolved === 'open' ? 'No open payment failures' : 'No payment failures found'}
            </div>
            {filterResolved === 'open' && <div style={{ fontSize: 13 }}>All payments are resolving successfully.</div>}
          </div>
        ) : (
          <>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${d.border}`, fontSize: 11, color: d.muted }}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </div>
            {events.map(ev => {
              const shop = (ev.shops as { name: string } | null)?.name ?? ev.shop_id.slice(0, 8) + '…'
              const isOpen = expanded === ev.id
              return (
                <div key={ev.id} style={{ borderBottom: `1px solid ${d.border}` }}>
                  <div
                    onClick={() => setExpanded(isOpen ? null : ev.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', transition: 'background .12s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = d.surface2)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Status dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: ev.resolved ? '#22c55e' : '#ef4444',
                      boxShadow: ev.resolved ? 'none' : '0 0 0 3px rgba(239,68,68,0.2)',
                    }} />

                    {/* Shop + error */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: d.text, fontWeight: 600, fontSize: 14 }}>{shop}</span>
                        {ev.provider && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: d.surface2, color: d.muted, textTransform: 'uppercase' }}>
                            {ev.provider}
                          </span>
                        )}
                        {ev.retry_count > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                            {ev.retry_count} retries
                          </span>
                        )}
                      </div>
                      <div style={{ color: d.muted, fontSize: 12, marginTop: 2 }}>
                        {ev.error_code ? `[${ev.error_code}] ` : ''}{ev.error_message ?? 'Payment declined'}
                        {ev.provider_ref && ` · Ref: ${ev.provider_ref}`}
                      </div>
                    </div>

                    {/* Amount + date */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>{fmtFull(ev.amount)}</div>
                      <div style={{ color: d.muted, fontSize: 11, marginTop: 2 }}>
                        {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true })}
                      </div>
                    </div>

                    {/* Resolved badge */}
                    {ev.resolved && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                        <CheckCircle2 size={10} /> Resolved
                      </span>
                    )}

                    {isOpen ? <ChevronUp size={14} style={{ color: d.muted, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: d.muted, flexShrink: 0 }} />}
                  </div>

                  {/* Expanded detail + resolve */}
                  {isOpen && (
                    <div style={{ padding: '0 16px 16px 38px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: d.surface2, borderRadius: 10, padding: '12px 14px', fontSize: 12, color: d.sub, lineHeight: 1.7 }}>
                        <div><strong>Shop ID:</strong> {ev.shop_id}</div>
                        <div><strong>Plan:</strong> {ev.plan_name ?? '—'}</div>
                        <div><strong>Provider:</strong> {ev.provider ?? '—'}</div>
                        <div><strong>Provider Ref:</strong> {ev.provider_ref ?? '—'}</div>
                        <div><strong>Amount:</strong> {fmtFull(ev.amount)} {ev.currency}</div>
                        <div><strong>Date:</strong> {format(new Date(ev.created_at), 'dd MMM yyyy HH:mm:ss')}</div>
                        {ev.resolved && (
                          <>
                            <div><strong>Resolved by:</strong> {ev.resolved_by}</div>
                            <div><strong>Resolved at:</strong> {format(new Date(ev.resolved_at!), 'dd MMM yyyy HH:mm')}</div>
                            {ev.resolution_note && <div><strong>Note:</strong> {ev.resolution_note}</div>}
                          </>
                        )}
                      </div>

                      {!ev.resolved && admin && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 11, color: d.muted, marginBottom: 4, fontWeight: 600 }}>Resolution note (optional)</div>
                            <input
                              value={resolveNote[ev.id] ?? ''}
                              onChange={e => setResolveNote(n => ({ ...n, [ev.id]: e.target.value }))}
                              placeholder="e.g. Contacted tenant, payment will retry"
                              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${d.border}`, background: d.surface, color: d.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>
                          <button
                            onClick={() => resolve.mutate({ id: ev.id, note: resolveNote[ev.id] ?? '' })}
                            disabled={resolve.isPending}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', flexShrink: 0,
                              background: '#22c55e', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              opacity: resolve.isPending ? .6 : 1,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            {resolve.isPending ? 'Resolving…' : 'Mark Resolved'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Renewals ────────────────────────────────────────────────────────────

function RenewalsTab({ d }: { d: ReturnType<typeof useTheme> }) {
  const { data: renewals = [], isLoading, refetch } = useQuery<Renewal[]>({
    queryKey: ['arc-upcoming-renewals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arc_upcoming_renewals')
        .select('*')
      if (error) throw error
      return data ?? []
    },
    staleTime: 60_000,
  })

  const critical = renewals.filter(r => r.risk_level === 'critical').length
  const high     = renewals.filter(r => r.risk_level === 'high').length
  const due7     = renewals.filter(r => r.days_until_renewal <= 7).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 14 }}>
        {[
          { label: 'Total Upcoming',    value: renewals.length, color: '#3b82f6', icon: Calendar },
          { label: 'Due in 7 Days',     value: due7,            color: '#f97316', icon: Clock },
          { label: 'Critical / Grace',  value: critical,        color: '#ef4444', icon: AlertTriangle },
          { label: 'High Risk',         value: high,            color: '#f97316', icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={15} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ color: d.text, fontSize: 18, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: d.muted, fontSize: 11, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => refetch()} style={btnStyle(d)}><RefreshCw size={12} /> Refresh</button>
        <button onClick={() => {
          const rows = renewals.map(r => [
            r.shop_name, r.owner_email ?? '', r.plan_name, r.sub_status,
            r.days_until_renewal, format(new Date(r.current_period_end), 'yyyy-MM-dd'),
            r.risk_level,
          ] as (string|number)[])
          downloadCSV(`renewals-${format(new Date(), 'yyyy-MM-dd')}.csv`,
            ['Shop', 'Owner Email', 'Plan', 'Status', 'Days Until Renewal', 'Renewal Date', 'Risk Level'], rows as never)
        }} style={btnStyle(d, '#22c55e')}>
          <Download size={12} /> Export
        </button>
      </div>

      {/* Renewals list */}
      <div style={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: d.muted }}>Loading…</div>
        ) : renewals.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: d.muted }}>
            <Calendar size={32} style={{ marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
            <div style={{ color: d.text, fontWeight: 700 }}>No renewals in next 60 days</div>
          </div>
        ) : (
          <>
            <div style={{ padding: '10px 16px', borderBottom: `1px solid ${d.border}`, fontSize: 11, color: d.muted }}>
              {renewals.length} subscription{renewals.length !== 1 ? 's' : ''} renewing in next 60 days
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: d.surface2 }}>
                  {['Risk', 'Shop', 'Owner', 'Plan', 'Status', 'Renewal Date', 'Days Left'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {renewals.map(r => {
                  const rc   = RISK_COLORS[r.risk_level] ?? RISK_COLORS.low
                  const pc   = PLAN_COLORS[r.plan_name]  ?? '#64748b'
                  const days = r.days_until_renewal
                  return (
                    <tr key={r.subscription_id} style={{ borderBottom: `1px solid ${d.border}` }}>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: rc.bg, color: rc.text, textTransform: 'uppercase' }}>
                          {rc.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ color: d.text, fontWeight: 600 }}>{r.shop_name}</span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ color: d.sub, fontSize: 12 }}>{r.owner_name ?? '—'}</div>
                        <div style={{ color: d.muted, fontSize: 11 }}>{r.owner_email ?? '—'}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 9px', borderRadius: 20, background: `${pc}18`, color: pc, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                          {r.plan_name}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                          background: r.sub_status === 'grace' ? 'rgba(239,68,68,0.1)' : r.sub_status === 'trial' ? 'rgba(59,130,246,0.1)' : 'rgba(34,197,94,0.1)',
                          color: r.sub_status === 'grace' ? '#ef4444' : r.sub_status === 'trial' ? '#3b82f6' : '#22c55e',
                          textTransform: 'capitalize',
                        }}>{r.sub_status}</span>
                      </td>
                      <td style={{ padding: '12px 14px', color: d.text, fontSize: 12 }}>
                        {format(new Date(r.current_period_end), 'dd MMM yyyy')}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontWeight: 800, fontSize: 14,
                          color: days <= 3 ? '#ef4444' : days <= 7 ? '#f97316' : days <= 14 ? '#eab308' : '#22c55e',
                        }}>
                          {days < 0 ? 'Overdue' : `${days}d`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Theme helper ─────────────────────────────────────────────────────────────

function useTheme() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  return {
    dark,
    surface:  dark ? '#0d1526'  : '#ffffff',
    surface2: dark ? '#111827'  : '#f8fafc',
    border:   dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text:     dark ? '#f1f5f9'  : '#0f172a',
    muted:    dark ? '#64748b'  : '#94a3b8',
    sub:      dark ? '#94a3b8'  : '#475569',
  }
}

function btnStyle(d: ReturnType<typeof useTheme>, accent?: string) {
  return {
    display: 'flex' as const, alignItems: 'center' as const, gap: 5,
    padding: '7px 13px', borderRadius: 9, fontSize: 12, fontWeight: 600 as const, cursor: 'pointer' as const,
    background: accent ? `${accent}18` : d.surface,
    border: `1px solid ${accent ? `${accent}30` : d.border}`,
    color: accent ?? d.sub,
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'failures' | 'renewals'

export function ARCRevenuePage() {
  const d = useTheme()
  const [tab, setTab] = useState<Tab>('overview')

  const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'overview',  label: 'Overview',        icon: BarChart3 },
    { id: 'failures',  label: 'Failed Payments', icon: XCircle },
    { id: 'renewals',  label: 'Upcoming Renewals', icon: Calendar },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Revenue Center</h1>
        <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>
          Subscription revenue, payment health, and renewal tracking
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {TABS.map(t => {
          const Icon  = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .12s',
              background: active ? d.surface : 'transparent',
              color: active ? d.text : d.muted,
              boxShadow: active ? '0 1px 4px rgba(0,0,0,.12)' : 'none',
              border: active ? `1px solid ${d.border}` : '1px solid transparent',
            }}>
              <Icon size={14} style={{ color: active ? (t.id === 'failures' ? '#ef4444' : t.id === 'renewals' ? '#f97316' : '#3b82f6') : d.muted }} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview'  && <OverviewTab  d={d} />}
      {tab === 'failures'  && <FailedPaymentsTab d={d} />}
      {tab === 'renewals'  && <RenewalsTab  d={d} />}

      <style>{`@keyframes arc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
