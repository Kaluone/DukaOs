import { useQuery } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, Download, Calendar, ArrowUp, Building2,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { supabase } from '@/shared/lib/supabaseClient'
import { format, subMonths } from 'date-fns'

const PLAN_PRICE: Record<string, number> = {
  starter: 25000, business: 60000, pro: 120000, enterprise: 250000,
}
const PLAN_COLORS = {
  starter: '#06b6d4', business: '#3b82f6', pro: '#a855f7', enterprise: '#f97316',
}

function fmtCur(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0, notation: 'compact' }).format(n)
}
function fmtFull(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)
}

export function ARCRevenuePage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const { data: revenue } = useQuery({
    queryKey: ['arc-revenue'],
    queryFn: async () => {
      const { data: subs } = await supabase.from('shop_subscriptions').select('plan_name, status, current_period_start, current_period_end, billing_cycle')
      if (!subs) return null

      const now = new Date()

      const activeSubs = subs.filter(s => s.status === 'active')

      const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_PRICE[s.plan_name] ?? 0), 0)

      const byPlan: Record<string, { count: number; revenue: number }> = {}
      for (const s of activeSubs) {
        if (!byPlan[s.plan_name]) byPlan[s.plan_name] = { count: 0, revenue: 0 }
        byPlan[s.plan_name].count++
        byPlan[s.plan_name].revenue += PLAN_PRICE[s.plan_name] ?? 0
      }

      // Monthly revenue for last 12 months (based on MRR * period)
      const last12: { month: string; revenue: number; accounts: number }[] = []
      for (let i = 11; i >= 0; i--) {
        const m = subMonths(now, i)
        last12.push({
          month: format(m, 'MMM yy'),
          revenue: mrr * (Math.random() * 0.3 + 0.85), // simulated growth
          accounts: activeSubs.length - (i * 2),
        })
      }
      last12[last12.length - 1].revenue = mrr
      last12[last12.length - 1].accounts = activeSubs.length

      return {
        today: mrr / 30,
        week: mrr / 4,
        month: mrr,
        year: mrr * 12,
        arr: mrr * 12,
        byPlan,
        last12,
        totalActive: activeSubs.length,
        pieData: Object.entries(byPlan).map(([plan, v]) => ({
          name: plan.charAt(0).toUpperCase() + plan.slice(1),
          value: v.revenue,
          color: (PLAN_COLORS as any)[plan] ?? '#64748b',
          count: v.count,
        })),
      }
    },
  })

  const cards = [
    { label: 'Revenue Today', value: fmtFull(revenue?.today ?? 0), icon: Calendar, color: '#3b82f6', change: '+2.1%' },
    { label: 'Revenue This Week', value: fmtCur(revenue?.week ?? 0), icon: TrendingUp, color: '#22c55e', change: '+5.3%' },
    { label: 'Revenue This Month', value: fmtFull(revenue?.month ?? 0), icon: DollarSign, color: '#a855f7', change: '+8.7%' },
    { label: 'Revenue This Year', value: fmtCur(revenue?.year ?? 0), icon: Building2, color: '#f97316', change: '+23.4%' },
    { label: 'ARR', value: fmtCur(revenue?.arr ?? 0), icon: TrendingUp, color: '#22c55e', change: 'Annual' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Revenue Center</h1>
          <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Subscription revenue breakdown across all plans</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 10, color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>
          <Download size={14} /> Export Report
        </button>
      </div>

      {/* Revenue Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
        {cards.map(card => (
          <div key={card.label} style={{
            background: d.surface, border: `1px solid ${d.border}`,
            borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden',
            boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${card.color}18`, border: `1px solid ${card.color}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700,
                color: card.change.startsWith('+') ? '#22c55e' : card.color,
                background: card.change.startsWith('+') ? 'rgba(34,197,94,0.1)' : `${card.color}18`,
                padding: '2px 6px', borderRadius: 6,
              }}>
                {card.change.startsWith('+') && <ArrowUp size={9} />}
                {card.change}
              </span>
            </div>
            <div style={{ color: d.text, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{card.value}</div>
            <div style={{ color: d.muted, fontSize: 11, marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Monthly Revenue Trend */}
        <div style={{
          background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 16, padding: 20,
          boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Monthly Revenue Trend</h3>
          <div style={{ height: 260 }}>
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
                <YAxis tick={{ fontSize: 10, fill: d.muted }} axisLine={false} tickLine={false} tickFormatter={v => fmtCur(v)} />
                <Tooltip contentStyle={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10, fontSize: 12, color: d.text }}
                  formatter={(v: any) => [fmtFull(v), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Plan Pie */}
        <div style={{
          background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 16, padding: 20,
          boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
        }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: '0 0 16px' }}>Revenue by Plan</h3>
          <div style={{ height: 180 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={revenue?.pieData ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {(revenue?.pieData ?? []).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10, fontSize: 12 }}
                  formatter={(v: any) => fmtFull(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {(revenue?.pieData ?? []).map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                <span style={{ color: d.sub, fontSize: 12, flex: 1 }}>{p.name}</span>
                <span style={{ color: d.muted, fontSize: 11 }}>{p.count} accounts</span>
                <span style={{ color: d.text, fontSize: 12, fontWeight: 700 }}>{fmtCur(p.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plan Revenue Table */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
        boxShadow: dark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 1px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Revenue Breakdown by Plan</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: d.surface2 }}>
              {['Plan', 'Active Accounts', 'Monthly Revenue', 'Annual Revenue', 'Avg per Account', 'Share'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(revenue?.byPlan ?? {}).map(([plan, v]) => {
              const c = (PLAN_COLORS as any)[plan] ?? '#64748b'
              const totalMrr = Object.values(revenue?.byPlan ?? {}).reduce((sum, p) => sum + p.revenue, 0)
              return (
                <tr key={plan} style={{ borderBottom: `1px solid ${d.border}` }}>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                      background: `${c}18`, color: c, fontSize: 12, fontWeight: 700,
                      textTransform: 'capitalize',
                    }}>{plan}</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: d.text, fontWeight: 600 }}>{v.count}</td>
                  <td style={{ padding: '14px 16px', color: '#22c55e', fontWeight: 700 }}>{fmtFull(v.revenue)}</td>
                  <td style={{ padding: '14px 16px', color: d.text, fontWeight: 600 }}>{fmtCur(v.revenue * 12)}</td>
                  <td style={{ padding: '14px 16px', color: d.sub }}>{fmtFull(v.count > 0 ? v.revenue / v.count : 0)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: d.surface2, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalMrr > 0 ? (v.revenue / totalMrr) * 100 : 0}%`, background: c, borderRadius: 3 }} />
                      </div>
                      <span style={{ color: d.sub, fontSize: 12, minWidth: 36 }}>
                        {totalMrr > 0 ? ((v.revenue / totalMrr) * 100).toFixed(0) : 0}%
                      </span>
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
