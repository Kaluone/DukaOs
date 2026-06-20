import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
import { ScrollText, Search, RefreshCw, Shield, Download } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format } from 'date-fns'

const ACTION_COLORS: Record<string, { bg: string; text: string }> = {
  login:            { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e' },
  logout:           { bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' },
  tenant_suspend:   { bg: 'rgba(249,115,22,0.1)',  text: '#f97316' },
  tenant_activate:  { bg: 'rgba(34,197,94,0.1)',   text: '#22c55e' },
  tenant_delete:    { bg: 'rgba(239,68,68,0.1)',   text: '#ef4444' },
  impersonation:    { bg: 'rgba(168,85,247,0.1)',  text: '#a855f7' },
  subscription_change: { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' },
}

const ROLE_COLOR: Record<string, string> = {
  founder: '#f97316', chief_admin: '#3b82f6', support_agent: '#22c55e',
  finance_admin: '#a855f7', technical_admin: '#06b6d4',
}

export function ARCAuditPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 30

  const { data: logs = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['arc-audit-logs', search, actionFilter, page],
    queryFn: async () => {
      let q = supabase.from('arc_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (actionFilter !== 'all') q = q.eq('action', actionFilter)

      const { data } = await q
      if (!data) return []
      if (search) {
        const s = search.toLowerCase()
        return data.filter((l: any) =>
          l.admin_email?.toLowerCase().includes(s) ||
          l.action?.toLowerCase().includes(s) ||
          l.resource_name?.toLowerCase().includes(s)
        )
      }
      return data
    },
    refetchInterval: 30_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['arc-audit-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('arc_audit_logs').select('action')
      if (!data) return {}
      const counts: Record<string, number> = {}
      for (const l of data) counts[l.action] = (counts[l.action] ?? 0) + 1
      return counts
    },
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Audit Logs</h1>
          <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Immutable record of all admin actions on the platform</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => refetch()} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10,
            color: d.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}><RefreshCw size={13} style={{ animation: isFetching ? 'arc-spin 0.8s linear infinite' : 'none' }} /> Refresh</button>
          <button onClick={() => {
            const rows = logs.map((l: any) => [
              l.created_at ? new Date(l.created_at).toLocaleString() : '',
              l.admin_email ?? '', l.admin_role ?? '', l.action ?? '',
              l.resource_type ?? '', l.resource_name ?? '',
              l.ip_address ?? '',
            ])
            downloadCSV(`audit-logs-${new Date().toISOString().slice(0,10)}.csv`,
              ['Date/Time', 'Admin Email', 'Role', 'Action', 'Resource Type', 'Resource Name', 'IP Address'], rows)
          }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10,
            color: '#22c55e', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}><Download size={13} /> Export</button>
          <style>{`@keyframes arc-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>

      {/* Immutability Notice */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
        background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 12,
      }}>
        <Shield size={16} style={{ color: '#a855f7', flexShrink: 0 }} />
        <p style={{ color: '#a855f7', fontSize: 12, margin: 0, fontWeight: 500 }}>
          Audit logs are <strong>immutable</strong> — they cannot be edited or deleted. Every admin action is permanently recorded with timestamp and IP address.
        </p>
      </div>

      {/* Action Summary */}
      {stats && Object.keys(stats).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(stats).map(([action, count]) => {
            const c = ACTION_COLORS[action] ?? { bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' }
            return (
              <button key={action} onClick={() => setActionFilter(actionFilter === action ? 'all' : action)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                background: actionFilter === action ? c.bg : d.surface2,
                border: actionFilter === action ? `1px solid ${c.text}30` : `1px solid ${d.border}`,
                borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <span style={{ color: actionFilter === action ? c.text : d.muted, fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>
                  {action.replace('_', ' ')}
                </span>
                <span style={{ color: c.text, fontSize: 11, fontWeight: 800, background: c.bg, padding: '1px 5px', borderRadius: 4 }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: d.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by admin, action, resource…" style={{
            width: '100%', padding: '8px 12px 8px 32px', boxSizing: 'border-box',
            background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10,
            color: d.text, fontSize: 13, outline: 'none',
          }} />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{
          padding: '8px 12px', background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 10, color: d.sub, fontSize: 13, cursor: 'pointer', outline: 'none',
        }}>
          <option value="all">All Actions</option>
          {Object.keys(ACTION_COLORS).map(a => (
            <option key={a} value={a}>{a.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${d.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: d.muted }}>
            <ScrollText size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>No audit logs found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: d.surface2, borderBottom: `2px solid ${d.border}` }}>
                {['Timestamp', 'Admin', 'Role', 'Action', 'Resource', 'Details'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(logs as any[]).map(log => {
                const c = ACTION_COLORS[log.action] ?? { bg: 'rgba(100,116,139,0.1)', text: '#94a3b8' }
                const rc = ROLE_COLOR[log.admin_role] ?? '#64748b'
                return (
                  <tr key={log.id} style={{ borderBottom: `1px solid ${d.border}` }}>
                    <td style={{ padding: '10px 14px', color: d.muted, fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      {log.created_at ? format(new Date(log.created_at), 'dd MMM HH:mm:ss') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: d.text, fontWeight: 600, fontSize: 12 }}>{log.admin_email}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                        background: `${rc}18`, color: rc,
                      }}>{log.admin_role?.replace('_', ' ')}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
                        background: c.bg, color: c.text, whiteSpace: 'nowrap',
                      }}>{log.action?.replace('_', ' ')}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: d.sub, fontSize: 12 }}>{log.resource_type && <span style={{ color: d.muted, fontSize: 11 }}>{log.resource_type}: </span>}{log.resource_name ?? '—'}</div>
                    </td>
                    <td style={{ padding: '10px 14px', color: d.muted, fontSize: 11, maxWidth: 200 }}>
                      {log.details ? <span title={JSON.stringify(log.details)} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {typeof log.details === 'object' ? JSON.stringify(log.details) : log.details}
                      </span> : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px', borderTop: `1px solid ${d.border}` }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{
            padding: '6px 14px', background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 8,
            color: page === 0 ? d.muted : d.sub, cursor: page === 0 ? 'not-allowed' : 'pointer',
            fontSize: 12, opacity: page === 0 ? 0.5 : 1,
          }}>← Prev</button>
          <span style={{ color: d.muted, fontSize: 12 }}>Page {page + 1}</span>
          <button disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)} style={{
            padding: '6px 14px', background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 8,
            color: logs.length < PAGE_SIZE ? d.muted : d.sub, cursor: logs.length < PAGE_SIZE ? 'not-allowed' : 'pointer',
            fontSize: 12, opacity: logs.length < PAGE_SIZE ? 0.5 : 1,
          }}>Next →</button>
        </div>
      </div>
    </div>
  )
}
