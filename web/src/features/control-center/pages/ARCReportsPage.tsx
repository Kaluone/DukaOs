import { useState } from 'react'
import { FileText, Download, FileSpreadsheet, File, RefreshCw } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format as fmtDate } from 'date-fns'

const REPORTS = [
  { id: 'revenue',       label: 'Revenue Report',        desc: 'Monthly/yearly subscription revenue by plan' },
  { id: 'subscriptions', label: 'Subscriptions Report',  desc: 'Active, trial, expired, cancelled breakdown' },
  { id: 'customers',     label: 'Customers Report',      desc: 'All registered tenants with details' },
  { id: 'products',      label: 'Products Report',       desc: 'Products across all stores' },
  { id: 'sales',         label: 'Sales Report',          desc: 'Transactions across all stores' },
  { id: 'expenses',      label: 'Expenses Report',       desc: 'Expenses logged across all stores' },
  { id: 'payments',      label: 'Payments Report',       desc: 'Billing invoices and payment status' },
  { id: 'active_users',  label: 'Active Users Report',   desc: 'Users with activity in the last 30 days' },
]

function downloadCSV(data: Record<string, string>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(r => headers.map(h => `"${r[h] ?? ''}"`).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${filename}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export function ARCReportsPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [generating, setGenerating] = useState<string | null>(null)

  async function handleGenerate(reportId: string, exportFmt: 'csv' | 'excel' | 'pdf') {
    setGenerating(reportId)
    try {
      let data: Record<string, string>[] = []
      if (reportId === 'subscriptions') {
        const { data: subs } = await supabase.from('shop_subscriptions').select(`
          plan_name, status, billing_cycle, current_period_end,
          shop:shop_id(name, phone, created_at)
        `).order('created_at')
        data = (subs ?? []).map((s: any) => ({
          'Business': s.shop?.name ?? '—',
          'Plan': s.plan_name,
          'Status': s.status,
          'Billing Cycle': s.billing_cycle,
          'Registered': s.shop?.created_at ? fmtDate(new Date(s.shop.created_at), 'dd/MM/yyyy') : '—',
          'Expiry': s.current_period_end ? fmtDate(new Date(s.current_period_end), 'dd/MM/yyyy') : '—',
        }))
      } else if (reportId === 'customers') {
        const { data: shops } = await supabase.from('shops').select('name, phone, address, created_at').order('created_at')
        data = (shops ?? []).map(s => ({
          'Business Name': s.name,
          'Phone': s.phone ?? '—',
          'Address': s.address ?? '—',
          'Registered': fmtDate(new Date(s.created_at), 'dd/MM/yyyy'),
        }))
      }
      if (exportFmt === 'csv' && data.length > 0) {
        downloadCSV(data, `dukaos_${reportId}_${Date.now()}`)
      } else {
        await new Promise(r => setTimeout(r, 800))
        alert(`${exportFmt.toUpperCase()} generation requires server-side processing. CSV is available for Subscriptions and Customers reports.`)
      }
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Reports Center</h1>
        <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Generate and download platform-wide reports</p>
      </div>

      {/* Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {REPORTS.map(report => (
          <div key={report.id} style={{
            background: d.surface, border: `1px solid ${activeReport === report.id ? 'rgba(59,130,246,0.4)' : d.border}`,
            borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: activeReport === report.id ? '0 0 0 2px rgba(59,130,246,0.15)' : 'none',
          }} onClick={() => setActiveReport(report.id === activeReport ? null : report.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: activeReport === report.id ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.1)',
                border: `1px solid ${activeReport === report.id ? 'rgba(59,130,246,0.3)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileText size={18} style={{ color: activeReport === report.id ? '#3b82f6' : d.muted }} />
              </div>
              <div>
                <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>{report.label}</h3>
                <p style={{ color: d.muted, fontSize: 12, margin: '2px 0 0' }}>{report.desc}</p>
              </div>
            </div>

            {activeReport === report.id && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${d.border}` }}>
                {[
                  { exportFmt: 'csv' as const, label: 'CSV', icon: FileSpreadsheet, color: '#22c55e' },
                  { exportFmt: 'excel' as const, label: 'Excel', icon: FileSpreadsheet, color: '#3b82f6' },
                  { exportFmt: 'pdf' as const, label: 'PDF', icon: File, color: '#ef4444' },
                ].map(({ exportFmt, label, icon: Icon, color }) => (
                  <button
                    key={exportFmt}
                    disabled={generating === report.id}
                    onClick={e => { e.stopPropagation(); handleGenerate(report.id, exportFmt) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
                      background: `${color}18`, border: `1px solid ${color}30`,
                      borderRadius: 8, color, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      opacity: generating === report.id ? 0.6 : 1, transition: 'all 0.15s',
                    }}>
                    {generating === report.id ? <RefreshCw size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Icon size={12} />}
                    {label}
                    <Download size={11} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Downloads Table */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}` }}>
          <h3 style={{ color: d.text, fontSize: 14, fontWeight: 700, margin: 0 }}>Recent Report History</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: d.surface2 }}>
              {['Report', 'Generated By', 'Format', 'Date', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { report: 'Subscriptions Report', by: 'Frank F. Kalungura', format: 'CSV', date: 'Today, 09:15', status: 'completed' },
              { report: 'Revenue Report', by: 'Frank F. Kalungura', format: 'PDF', date: 'Yesterday, 14:32', status: 'completed' },
              { report: 'Customers Report', by: 'Frank F. Kalungura', format: 'Excel', date: '17 Jun, 11:00', status: 'completed' },
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${d.border}` }}>
                <td style={{ padding: '12px 16px', color: d.text, fontWeight: 600 }}>{r.report}</td>
                <td style={{ padding: '12px 16px', color: d.sub }}>{r.by}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: r.format === 'CSV' ? 'rgba(34,197,94,0.1)' : r.format === 'PDF' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
                    color: r.format === 'CSV' ? '#22c55e' : r.format === 'PDF' ? '#ef4444' : '#3b82f6',
                  }}>{r.format}</span>
                </td>
                <td style={{ padding: '12px 16px', color: d.muted, fontSize: 12 }}>{r.date}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
