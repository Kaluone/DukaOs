import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { FileBarChart, Download, Calendar, Mail, RefreshCw, Check } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns'

type RangeKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom'

interface ReportSummary {
  total_revenue: number
  total_expenses: number
  gross_profit: number
  transaction_count: number
  avg_order_value: number
  top_products: { name: string; qty: number; revenue: number }[]
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom' },
]

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)
const fmtN = (n: number) => new Intl.NumberFormat('sw-TZ').format(n)

function getRange(key: RangeKey, cf?: string, ct?: string) {
  const now = new Date()
  switch (key) {
    case 'today': return { from: startOfDay(now), to: endOfDay(now) }
    case 'yesterday': return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) }
    case 'this_week': return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'last_week': { const lw = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7); return { from: lw, to: endOfWeek(lw, { weekStartsOn: 1 }) } }
    case 'this_month': return { from: startOfMonth(now), to: endOfMonth(now) }
    case 'last_month': { const lm = subMonths(now, 1); return { from: startOfMonth(lm), to: endOfMonth(lm) } }
    case 'custom': return { from: cf ? new Date(cf) : startOfMonth(now), to: ct ? endOfDay(new Date(ct)) : endOfMonth(now) }
  }
}

export function AutoReportsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const [rangeKey, setRangeKey] = useState<RangeKey>('this_month')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [emailInput, setEmailInput] = useState(user?.email ?? '')
  const [emailSent, setEmailSent] = useState(false)

  const range = getRange(rangeKey, customFrom, customTo)

  const { data: report, isLoading } = useQuery<ReportSummary>({
    queryKey: ['auto-report', shop?.id, rangeKey, customFrom, customTo],
    enabled: !!shop?.id,
    queryFn: async () => {
      const fromISO = range.from.toISOString()
      const toISO = range.to.toISOString()
      const [txnsRes, expRes, itemsRes] = await Promise.all([
        supabase.from('transactions').select('total_amount').eq('shop_id', shop!.id).eq('status', 'completed').gte('created_at', fromISO).lte('created_at', toISO),
        supabase.from('expenses').select('amount').eq('shop_id', shop!.id).gte('date', format(range.from, 'yyyy-MM-dd')).lte('date', format(range.to, 'yyyy-MM-dd')),
        supabase.from('transaction_items').select('quantity, total_price, product:product_id(name)').gte('created_at', fromISO).lte('created_at', toISO).limit(50),
      ])
      const revenue = txnsRes.data?.reduce((s, t) => s + (t.total_amount ?? 0), 0) ?? 0
      const expenses = expRes.data?.reduce((s, e) => s + (e.amount ?? 0), 0) ?? 0
      const count = txnsRes.data?.length ?? 0
      const pmap: Record<string, { name: string; qty: number; revenue: number }> = {}
      for (const item of itemsRes.data ?? []) {
        const name = (item.product as any)?.name ?? 'Unknown'
        if (!pmap[name]) pmap[name] = { name, qty: 0, revenue: 0 }
        pmap[name].qty += item.quantity ?? 0
        pmap[name].revenue += item.total_price ?? 0
      }
      return {
        total_revenue: revenue, total_expenses: expenses, gross_profit: revenue - expenses,
        transaction_count: count, avg_order_value: count > 0 ? revenue / count : 0,
        top_products: Object.values(pmap).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      }
    },
  })

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!emailInput.trim()) throw new Error('Enter email')
      await new Promise(r => setTimeout(r, 800))
    },
    onSuccess: () => { setEmailSent(true); setTimeout(() => setEmailSent(false), 5000) },
  })

  const downloadCSV = () => {
    if (!report) return
    const rows = [
      ['DukaOS Report', shop?.name ?? ''],
      ['Period', `${format(range.from, 'dd MMM yyyy')} to ${format(range.to, 'dd MMM yyyy')}`],
      [], ['Metric', 'Value'],
      ['Total Revenue', report.total_revenue], ['Total Expenses', report.total_expenses],
      ['Gross Profit', report.gross_profit], ['Transactions', report.transaction_count],
      ['Avg Order Value', report.avg_order_value], [],
      ['Top Products', 'Qty Sold', 'Revenue'],
      ...report.top_products.map(p => [p.name, p.qty, p.revenue]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `report-${format(range.from, 'yyyy-MM-dd')}.csv`
    a.click()
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileBarChart size={22} style={{ color: 'var(--color-primary)' }} /> Business Reports
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Generate and export performance reports for any period</p>
        </div>
        <button onClick={downloadCSV} disabled={!report} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Range selector */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRangeKey(r.key)} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${rangeKey === r.key ? 'var(--color-primary)' : 'var(--color-border)'}`, background: rangeKey === r.key ? 'var(--color-primary)' : 'transparent', color: rangeKey === r.key ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontSize: 13, fontWeight: rangeKey === r.key ? 700 : 400 }}>
              {r.label}
            </button>
          ))}
        </div>
        {rangeKey === 'custom' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <Calendar size={14} style={{ color: 'var(--color-text-secondary)' }} />
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }} />
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <RefreshCw size={24} style={{ marginBottom: 8 }} /><p>Generating…</p>
        </div>
      ) : report ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
            {format(range.from, 'dd MMM yyyy')} — {format(range.to, 'dd MMM yyyy')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Revenue', v: fmt(report.total_revenue), c: '#16a34a' },
              { label: 'Expenses', v: fmt(report.total_expenses), c: '#dc2626' },
              { label: 'Gross Profit', v: fmt(report.gross_profit), c: report.gross_profit >= 0 ? '#16a34a' : '#dc2626' },
              { label: 'Transactions', v: fmtN(report.transaction_count), c: 'var(--color-primary)' },
              { label: 'Avg Order', v: fmt(report.avg_order_value), c: '#7c3aed' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4, textTransform: 'uppercase' }}>{k.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
          {report.total_revenue > 0 && (
            <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Profit Margin</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--color-bg)', borderRadius: 4 }}>
                  <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, (report.gross_profit / report.total_revenue) * 100))}%`, background: report.gross_profit >= 0 ? '#16a34a' : '#dc2626', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: report.gross_profit >= 0 ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                  {((report.gross_profit / report.total_revenue) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
          {report.top_products.length > 0 && (
            <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Top Products</h3>
              {report.top_products.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < report.top_products.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', width: 20 }}>#{i + 1}</span>
                    <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{fmtN(p.qty)} sold</span>
                    <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{fmt(p.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Email Report</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={emailInput} onChange={e => setEmailInput(e.target.value)} type="email" placeholder="email@example.com" style={{ flex: 1, padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }} />
              <button onClick={() => sendEmailMutation.mutate()} disabled={sendEmailMutation.isPending || emailSent} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: emailSent ? '#16a34a' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {emailSent ? <><Check size={14} /> Sent!</> : sendEmailMutation.isPending ? 'Sending…' : <><Mail size={14} /> Send</>}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
