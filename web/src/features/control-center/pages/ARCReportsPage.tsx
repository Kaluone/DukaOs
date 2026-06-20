import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Download, FileSpreadsheet, RefreshCw, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format as fmtDate } from 'date-fns'
import { useARCAdmin } from '../useARCAuth'

const REPORTS = [
  { id: 'subscriptions', label: 'Subscriptions Report',  desc: 'All tenant subscriptions with plan, status, and expiry' },
  { id: 'customers',     label: 'Customers Report',      desc: 'All registered shops / business owners' },
  { id: 'revenue',       label: 'Revenue Report',        desc: 'Transaction totals aggregated by shop and month' },
  { id: 'products',      label: 'Products Report',       desc: 'All products across all stores' },
  { id: 'sales',         label: 'Sales Report',          desc: 'All transactions — amounts, dates, and status' },
  { id: 'expenses',      label: 'Expenses Report',       desc: 'Staff expenses across all stores' },
  { id: 'payments',      label: 'Payment Events Report', desc: 'Payment provider events including failures' },
  { id: 'active_users',  label: 'Active Users Report',   desc: 'Shops with at least one sale in the last 30 days' },
]

function downloadCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))
  const csv = '﻿' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}

async function fetchReportData(reportId: string): Promise<Record<string, any>[]> {
  switch (reportId) {
    case 'subscriptions': {
      const { data } = await supabase.from('shop_subscriptions').select(`
        plan_name, status, billing_cycle, current_period_end, trial_ends_at,
        shop:shop_id(name, phone, created_at)
      `).order('created_at', { ascending: false })
      return (data ?? []).map((s: any) => ({
        'Business':       s.shop?.name ?? '—',
        'Phone':          s.shop?.phone ?? '—',
        'Plan':           s.plan_name,
        'Status':         s.status,
        'Billing Cycle':  s.billing_cycle ?? '—',
        'Registered':     s.shop?.created_at ? fmtDate(new Date(s.shop.created_at), 'dd/MM/yyyy') : '—',
        'Expiry':         s.current_period_end ? fmtDate(new Date(s.current_period_end), 'dd/MM/yyyy') : '—',
        'Trial Ends':     s.trial_ends_at ? fmtDate(new Date(s.trial_ends_at), 'dd/MM/yyyy') : '—',
      }))
    }
    case 'customers': {
      const { data } = await supabase.from('shops').select('name, phone, address, created_at').order('created_at', { ascending: false })
      return (data ?? []).map((s: any) => ({
        'Business Name': s.name,
        'Phone':         s.phone ?? '—',
        'Address':       s.address ?? '—',
        'Registered':    fmtDate(new Date(s.created_at), 'dd/MM/yyyy'),
      }))
    }
    case 'revenue': {
      const { data } = await supabase.from('transactions')
        .select('shop_id, total_amount, created_at, shops:shop_id(name)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(5000)
      const byShopMonth: Record<string, { business: string; month: string; total: number; count: number }> = {}
      for (const tx of data ?? []) {
        const key = `${tx.shop_id}_${fmtDate(new Date(tx.created_at), 'yyyy-MM')}`
        if (!byShopMonth[key]) byShopMonth[key] = {
          business: (tx.shops as any)?.name ?? '—',
          month: fmtDate(new Date(tx.created_at), 'MMMM yyyy'),
          total: 0, count: 0,
        }
        byShopMonth[key].total += tx.total_amount ?? 0
        byShopMonth[key].count++
      }
      return Object.values(byShopMonth).map(r => ({
        'Business':     r.business,
        'Month':        r.month,
        'Transactions': r.count,
        'Total (TZS)':  r.total.toFixed(2),
      }))
    }
    case 'products': {
      const { data } = await supabase.from('products')
        .select('name, sku, price, quantity, category, active, shops:shop_id(name)')
        .order('created_at', { ascending: false })
        .limit(5000)
      return (data ?? []).map((p: any) => ({
        'Business':  (p.shops as any)?.name ?? '—',
        'Product':   p.name,
        'SKU':       p.sku ?? '—',
        'Price':     p.price ?? 0,
        'Stock':     p.quantity ?? 0,
        'Category':  p.category ?? '—',
        'Active':    p.active ? 'Yes' : 'No',
      }))
    }
    case 'sales': {
      const { data } = await supabase.from('transactions')
        .select('total_amount, status, payment_method, created_at, shops:shop_id(name)')
        .order('created_at', { ascending: false })
        .limit(5000)
      return (data ?? []).map((t: any) => ({
        'Business':       (t.shops as any)?.name ?? '—',
        'Amount (TZS)':   t.total_amount ?? 0,
        'Status':         t.status,
        'Payment Method': t.payment_method ?? '—',
        'Date':           fmtDate(new Date(t.created_at), 'dd/MM/yyyy HH:mm'),
      }))
    }
    case 'expenses': {
      const { data } = await supabase.from('expenses')
        .select('amount, category, description, created_at, shops:shop_id(name)')
        .order('created_at', { ascending: false })
        .limit(5000)
      return (data ?? []).map((e: any) => ({
        'Business':    (e.shops as any)?.name ?? '—',
        'Amount':      e.amount ?? 0,
        'Category':    e.category ?? '—',
        'Description': e.description ?? '—',
        'Date':        fmtDate(new Date(e.created_at), 'dd/MM/yyyy'),
      }))
    }
    case 'payments': {
      const { data } = await supabase.from('payment_events')
        .select('event_type, amount, currency, plan_name, provider, error_message, resolved, created_at, shops:shop_id(name)')
        .order('created_at', { ascending: false })
        .limit(2000)
      return (data ?? []).map((p: any) => ({
        'Business':    (p.shops as any)?.name ?? '—',
        'Event':       p.event_type,
        'Amount':      p.amount ?? 0,
        'Currency':    p.currency ?? 'TZS',
        'Plan':        p.plan_name ?? '—',
        'Provider':    p.provider ?? '—',
        'Error':       p.error_message ?? '—',
        'Resolved':    p.resolved ? 'Yes' : 'No',
        'Date':        fmtDate(new Date(p.created_at), 'dd/MM/yyyy HH:mm'),
      }))
    }
    case 'active_users': {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const { data: activeTx } = await supabase.from('transactions')
        .select('shop_id')
        .gte('created_at', cutoff)
        .eq('status', 'completed')
      const activeIds = [...new Set((activeTx ?? []).map((t: any) => t.shop_id))]
      if (!activeIds.length) return []
      const { data: shops } = await supabase.from('shops')
        .select('name, phone, created_at')
        .in('id', activeIds)
      return (shops ?? []).map((s: any) => ({
        'Business':   s.name,
        'Phone':      s.phone ?? '—',
        'Registered': fmtDate(new Date(s.created_at), 'dd/MM/yyyy'),
        'Active':     'Yes (last 30 days)',
      }))
    }
    default: return []
  }
}

export function ARCReportsPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const { data: admin } = useARCAdmin()
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)
  const [lastDownloads, setLastDownloads] = useState<{ report: string; format: string; rows: number; at: Date }[]>([])

  const { data: reportLog = [] } = useQuery({
    queryKey: ['arc-report-log'],
    queryFn: async () => {
      const { data } = await supabase.from('arc_report_log')
        .select('*, generated_by_admin:generated_by(full_name)')
        .order('created_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })

  async function handleGenerate(reportId: string, exportFmt: 'csv') {
    setGenerating(reportId)
    try {
      const data = await fetchReportData(reportId)
      if (data.length === 0) {
        alert('Hakuna data ya kudownload kwa ripoti hii.')
        return
      }
      const report = REPORTS.find(r => r.id === reportId)
      const filename = `dukaos_${reportId}_${fmtDate(new Date(), 'yyyyMMdd_HHmm')}`
      downloadCSV(data, filename)

      // Log it
      await supabase.from('arc_report_log').insert({
        report_id: reportId, format: exportFmt, row_count: data.length,
        generated_by: admin?.id,
      })

      setLastDownloads(prev => [
        { report: report?.label ?? reportId, format: exportFmt.toUpperCase(), rows: data.length, at: new Date() },
        ...prev.slice(0, 4),
      ])
    } catch (err: any) {
      alert(`Hitilafu: ${err.message}`)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Reports Center</h1>
        <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Generate and download platform-wide reports as CSV</p>
      </div>

      {/* Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {REPORTS.map(report => {
          const isActive = activeReport === report.id
          const isGen = generating === report.id
          return (
            <div key={report.id} style={{
              background: d.surface, border: `1.5px solid ${isActive ? 'rgba(59,130,246,0.45)' : d.border}`,
              borderRadius: 16, padding: 18, cursor: 'pointer', transition: 'all 0.18s',
              boxShadow: isActive ? '0 0 0 3px rgba(59,130,246,0.10)' : 'none',
            }} onClick={() => setActiveReport(isActive ? null : report.id)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: isActive ? 14 : 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.08)',
                  border: `1px solid ${isActive ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileText size={17} style={{ color: isActive ? '#3b82f6' : d.muted }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: d.text, fontSize: 13, fontWeight: 700, margin: 0 }}>{report.label}</h3>
                  <p style={{ color: d.muted, fontSize: 11, margin: '3px 0 0', lineHeight: 1.4 }}>{report.desc}</p>
                </div>
              </div>

              {isActive && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    disabled={isGen}
                    onClick={e => { e.stopPropagation(); handleGenerate(report.id, 'csv') }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '9px 0', borderRadius: 9, cursor: isGen ? 'not-allowed' : 'pointer',
                      background: isGen ? 'rgba(34,197,94,0.4)' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 700,
                      opacity: isGen ? 0.7 : 1, transition: 'all 0.15s',
                    }}
                  >
                    {isGen
                      ? <><RefreshCw size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Inaandaa…</>
                      : <><FileSpreadsheet size={13} /><Download size={12} /> Download CSV</>
                    }
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Session downloads + DB log */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Report Download History</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: d.surface2 }}>
              {['Report', 'Generated By', 'Rows', 'Format', 'Date', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Session downloads (instant feedback) */}
            {lastDownloads.map((dl, i) => (
              <tr key={`local-${i}`} style={{ borderTop: `1px solid ${d.border}`, background: 'rgba(34,197,94,0.03)' }}>
                <td style={{ padding: '11px 16px', color: d.text, fontWeight: 600 }}>{dl.report}</td>
                <td style={{ padding: '11px 16px', color: d.sub }}>{admin?.full_name ?? '—'}</td>
                <td style={{ padding: '11px 16px', color: d.sub }}>{dl.rows.toLocaleString()}</td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    {dl.format}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', color: d.muted, fontSize: 11 }}>{fmtDate(dl.at, 'dd MMM, HH:mm')}</td>
                <td style={{ padding: '11px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#22c55e', fontSize: 12, fontWeight: 600 }}>
                    <CheckCircle2 size={12} /> Downloaded
                  </div>
                </td>
              </tr>
            ))}
            {/* DB log */}
            {(reportLog as any[]).map((r: any) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${d.border}` }}>
                <td style={{ padding: '11px 16px', color: d.text, fontWeight: 600 }}>
                  {REPORTS.find(x => x.id === r.report_id)?.label ?? r.report_id}
                </td>
                <td style={{ padding: '11px 16px', color: d.sub }}>
                  {(r.generated_by_admin as any)?.full_name ?? '—'}
                </td>
                <td style={{ padding: '11px 16px', color: d.sub }}>
                  {r.row_count?.toLocaleString() ?? '—'}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: 'rgba(59,130,246,0.08)', color: '#3b82f6',
                  }}>{r.format?.toUpperCase()}</span>
                </td>
                <td style={{ padding: '11px 16px', color: d.muted, fontSize: 11 }}>
                  {fmtDate(new Date(r.created_at), 'dd MMM yyyy, HH:mm')}
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    Completed
                  </span>
                </td>
              </tr>
            ))}
            {reportLog.length === 0 && lastDownloads.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: d.muted, fontSize: 13 }}>
                  Hakuna ripoti zilizodownloadwa bado. Bonyeza ripoti yoyote hapo juu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
