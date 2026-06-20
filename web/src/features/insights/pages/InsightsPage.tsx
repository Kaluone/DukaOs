import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, AlertTriangle, Package, Users, Zap,
  BarChart3, Clock, ShoppingBag, ArrowUp, ArrowDown,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { subDays, format, startOfDay, endOfDay, startOfMonth } from 'date-fns'

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString('sw-TZ')
}

function fmtCur(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)
}

function PctBadge({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 8, fontSize: 11, fontWeight: 700,
      background: up ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
      color: up ? '#22c55e' : '#ef4444',
    }}>
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function InsightsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const shopId = shop?.id

  const today = new Date()
  const todayStart = startOfDay(today).toISOString()
  const todayEnd = endOfDay(today).toISOString()
  const weekAgo = subDays(today, 7).toISOString()
  const monthAgo = subDays(today, 30).toISOString()
  const monthStart = startOfMonth(today).toISOString()
  const prevWeekStart = subDays(today, 14).toISOString()
  const prevMonthStart = subDays(today, 60).toISOString()

  // ─── Revenue KPIs ───────────────────────────────────────────────────────────

  const { data: kpis } = useQuery({
    queryKey: ['insights-kpis', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const [
        { data: today_d },
        { data: week_d },
        { data: month_d },
        { data: prev_week_d },
        { data: prev_month_d },
        { data: exp_d },
      ] = await Promise.all([
        supabase.from('transactions').select('total_amount').eq('shop_id', shopId!).gte('created_at', todayStart).lte('created_at', todayEnd).eq('status', 'completed'),
        supabase.from('transactions').select('total_amount').eq('shop_id', shopId!).gte('created_at', weekAgo).eq('status', 'completed'),
        supabase.from('transactions').select('total_amount').eq('shop_id', shopId!).gte('created_at', monthStart).eq('status', 'completed'),
        supabase.from('transactions').select('total_amount').eq('shop_id', shopId!).gte('created_at', prevWeekStart).lt('created_at', weekAgo).eq('status', 'completed'),
        supabase.from('transactions').select('total_amount').eq('shop_id', shopId!).gte('created_at', prevMonthStart).lt('created_at', monthStart).eq('status', 'completed'),
        supabase.from('expenses').select('amount').eq('shop_id', shopId!).gte('created_at', monthStart),
      ])
      const sum = (arr: any[]) => (arr ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0)
      const revToday = sum(today_d ?? [])
      const revWeek  = sum(week_d ?? [])
      const revMonth = sum(month_d ?? [])
      const prevWeek  = sum(prev_week_d ?? [])
      const prevMonth = sum(prev_month_d ?? [])
      const expenses  = (exp_d ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
      const weekPct  = prevWeek > 0 ? ((revWeek - prevWeek) / prevWeek) * 100 : 0
      const monthPct = prevMonth > 0 ? ((revMonth - prevMonth) / prevMonth) * 100 : 0
      return { revToday, revWeek, revMonth, weekPct, monthPct, profit: revMonth - expenses, expenses }
    },
  })

  // ─── Daily Sales Trend (last 14 days) ────────────────────────────────────────

  const { data: trend = [] } = useQuery({
    queryKey: ['insights-trend', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('created_at, total_amount')
        .eq('shop_id', shopId!)
        .eq('status', 'completed')
        .gte('created_at', subDays(today, 14).toISOString())
        .order('created_at')
      const byDay: Record<string, number> = {}
      for (let i = 13; i >= 0; i--) {
        byDay[format(subDays(today, i), 'dd/MM')] = 0
      }
      for (const tx of data ?? []) {
        const key = format(new Date(tx.created_at), 'dd/MM')
        if (key in byDay) byDay[key] += tx.total_amount ?? 0
      }
      return Object.entries(byDay).map(([date, amount]) => ({ date, amount }))
    },
  })

  // ─── Top Selling Products ─────────────────────────────────────────────────

  const { data: topSellers = [] } = useQuery({
    queryKey: ['insights-top', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase
        .from('transaction_items')
        .select('product_id, quantity, price, products:product_id(name)')
        .eq('shop_id', shopId!)
        .gte('created_at', monthAgo)
      const byProduct: Record<string, { name: string; qty: number; revenue: number }> = {}
      for (const item of data ?? []) {
        const pid = item.product_id
        if (!pid) continue
        if (!byProduct[pid]) byProduct[pid] = { name: (item.products as any)?.name ?? '—', qty: 0, revenue: 0 }
        byProduct[pid].qty += item.quantity ?? 0
        byProduct[pid].revenue += (item.quantity ?? 0) * (item.price ?? 0)
      }
      return Object.entries(byProduct)
        .map(([, v]) => v)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)
    },
  })

  // ─── Slow Movers (no sales in 30 days) ───────────────────────────────────

  const { data: slowMovers = [] } = useQuery({
    queryKey: ['insights-slow', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const [{ data: allProducts }, { data: soldItems }] = await Promise.all([
        supabase.from('products').select('id, name, quantity').eq('shop_id', shopId!).eq('active', true),
        supabase.from('transaction_items').select('product_id').eq('shop_id', shopId!).gte('created_at', monthAgo),
      ])
      const soldIds = new Set((soldItems ?? []).map((i: any) => i.product_id))
      return (allProducts ?? [])
        .filter((p: any) => !soldIds.has(p.id))
        .slice(0, 10)
    },
  })

  // ─── Low Stock ────────────────────────────────────────────────────────────

  const { data: lowStock = [] } = useQuery({
    queryKey: ['insights-lowstock', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, quantity, reorder_point')
        .eq('shop_id', shopId!)
        .eq('active', true)
        .lt('quantity', 10)
        .order('quantity')
        .limit(10)
      return data ?? []
    },
  })

  // ─── Hourly Sales Pattern ─────────────────────────────────────────────────

  const { data: hourly = [] } = useQuery({
    queryKey: ['insights-hourly', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('created_at, total_amount')
        .eq('shop_id', shopId!)
        .eq('status', 'completed')
        .gte('created_at', weekAgo)
      const byHour: Record<number, number> = {}
      for (let h = 0; h < 24; h++) byHour[h] = 0
      for (const tx of data ?? []) {
        const h = new Date(tx.created_at).getHours()
        byHour[h] += tx.total_amount ?? 0
      }
      return Object.entries(byHour).map(([h, amount]) => ({
        hour: `${String(h).padStart(2, '0')}:00`,
        amount,
      }))
    },
  })

  // ─── Top Customers ────────────────────────────────────────────────────────

  const { data: topCustomers = [] } = useQuery({
    queryKey: ['insights-customers', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('customer_id, total_amount, customers:customer_id(name, phone)')
        .eq('shop_id', shopId!)
        .eq('status', 'completed')
        .gte('created_at', monthAgo)
        .not('customer_id', 'is', null)
      const byCustomer: Record<string, { name: string; phone: string; total: number; visits: number }> = {}
      for (const tx of data ?? []) {
        const cid = tx.customer_id
        if (!cid) continue
        const c = tx.customers as any
        if (!byCustomer[cid]) byCustomer[cid] = { name: c?.name ?? '—', phone: c?.phone ?? '', total: 0, visits: 0 }
        byCustomer[cid].total += tx.total_amount ?? 0
        byCustomer[cid].visits++
      }
      return Object.values(byCustomer).sort((a, b) => b.total - a.total).slice(0, 5)
    },
  })

  const dark = document.documentElement.classList.contains('dark')
  const chartColor = dark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'
  const textColor = dark ? '#94a3b8' : '#64748b'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
          Business Insights
        </h1>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          Data halisi ya biashara yako — mauzo, bidhaa, na wateja
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {[
          { label: 'Leo', value: fmtCur(kpis?.revToday ?? 0), icon: Zap, color: '#3b82f6', pct: null },
          { label: 'Wiki Hii', value: fmtCur(kpis?.revWeek ?? 0), icon: TrendingUp, color: '#22c55e', pct: kpis?.weekPct ?? 0 },
          { label: 'Mwezi Huu', value: fmtCur(kpis?.revMonth ?? 0), icon: BarChart3, color: '#a855f7', pct: kpis?.monthPct ?? 0 },
          { label: 'Faida Mwezi', value: fmtCur(kpis?.profit ?? 0), icon: TrendingUp, color: kpis?.profit && kpis.profit >= 0 ? '#22c55e' : '#ef4444', pct: null },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 16, padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${k.color}15`, border: `1px solid ${k.color}25`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <k.icon size={16} style={{ color: k.color }} />
              </div>
              {k.pct !== null && <PctBadge value={k.pct} />}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)', marginBottom: 2 }}>
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Sales Trend Chart */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 16, padding: 20,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 16px' }}>
          Mauzo — Siku 14 Zilizopita
        </h3>
        <div style={{ height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColor} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => `${fmt(v)}`} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }}
                formatter={(v: any) => [fmtCur(v), 'Mauzo']}
              />
              <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Sellers + Slow Movers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top Sellers */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} style={{ color: '#22c55e' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Top Bidhaa (Siku 30)
            </h3>
          </div>
          {topSellers.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, textAlign: 'center', padding: 20 }}>Hakuna data ya mauzo bado</p>
          ) : (
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <BarChart data={topSellers} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 9, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any) => [fmtCur(v), 'Mapato']}
                  />
                  <Bar dataKey="revenue" fill="#22c55e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Slow Movers */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingDown size={16} style={{ color: '#f97316' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Haziuzwi (Siku 30)
            </h3>
          </div>
          {slowMovers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                background: 'rgba(34,197,94,0.1)', borderRadius: 10, color: '#22c55e', fontSize: 13, fontWeight: 600,
              }}>
                ✓ Bidhaa zote zinauza vizuri
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {(slowMovers as any[]).map((p: any) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'rgba(249,115,22,0.06)',
                  border: '1px solid rgba(249,115,22,0.15)', borderRadius: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Stock: {p.quantity ?? 0}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700 }}>Slow</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low Stock + Hourly Pattern */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Low Stock */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Stock Ndogo — Haraka Agiza
            </h3>
          </div>
          {lowStock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
              ✓ Stock zote ziko sawa
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {(lowStock as any[]).map((p: any) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: (p.quantity ?? 0) <= 3 ? 'rgba(239,68,68,0.06)' : 'rgba(234,179,8,0.06)',
                  border: `1px solid ${(p.quantity ?? 0) <= 3 ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)'}`,
                  borderRadius: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{p.name}</div>
                    {p.reorder_point && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Reorder at: {p.reorder_point}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 800,
                    color: (p.quantity ?? 0) <= 3 ? '#ef4444' : '#eab308',
                  }}>
                    {p.quantity ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hourly Pattern */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 16, padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Clock size={16} style={{ color: '#a855f7' }} />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Mauzo kwa Saa (Wiki Hii)
            </h3>
          </div>
          <div style={{ height: 170 }}>
            <ResponsiveContainer>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColor} vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 8, fill: textColor }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 9, fill: textColor }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: any) => [fmtCur(v), 'Mauzo']}
                />
                <Bar dataKey="amount" fill="#a855f7" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Customers */}
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} style={{ color: '#3b82f6' }} />
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
            Wateja Wakubwa — Siku 30
          </h3>
        </div>
        {topCustomers.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
            Hakuna wateja wa kuandikisha katika mauzo yako
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)' }}>
                {['#', 'Jina', 'Simu', 'Ziara', 'Jumla'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', fontWeight: 700 }}>#{i + 1}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-text)' }}>{c.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ShoppingBag size={13} style={{ color: '#3b82f6' }} />
                      <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{c.visits}x</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#22c55e', fontSize: 14 }}>
                    {fmtCur(c.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Stock Summary Footer */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap',
        padding: '14px 18px', background: 'rgba(59,130,246,0.05)',
        border: '1px solid rgba(59,130,246,0.12)', borderRadius: 12,
        fontSize: 12, color: 'var(--color-text-secondary)',
      }}>
        <Package size={14} style={{ color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />
        <span>
          Data zote zinatoka kwenye database ya biashara yako moja kwa moja.
          Insights zinasasishwa kila ukiingia ukurasa.
        </span>
      </div>
    </div>
  )
}
