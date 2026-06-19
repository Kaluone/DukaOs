import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Search, Download } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, subDays } from 'date-fns'
import { useT } from '@/shared/i18n/useLanguage'

interface AuditLog {
  id: string
  event_type: string
  table_name: string
  record_id: string
  user_id: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

const EVENT_COLORS: Record<string, string> = {
  INSERT: 'badge-success', UPDATE: 'badge-warning', DELETE: 'badge-error',
  LOGIN: 'badge-primary', LOGOUT: 'badge-default', SALE: 'badge-primary',
}

function DiffView({ old_data, new_data }: { old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null }) {
  if (!old_data && !new_data) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>

  const allKeys = Array.from(new Set([
    ...Object.keys(old_data ?? {}),
    ...Object.keys(new_data ?? {}),
  ])).filter(k => !['updated_at', 'created_at', 'id'].includes(k))

  const changed = allKeys.filter(k => {
    const ov = JSON.stringify((old_data ?? {})[k])
    const nv = JSON.stringify((new_data ?? {})[k])
    return ov !== nv
  })

  if (!changed.length) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>No field changes</span>

  return (
    <div className="diff-view">
      {changed.slice(0, 10).map(k => (
        <div key={k} className="diff-row">
          <span className="diff-key">{k}</span>
          {old_data?.[k] !== undefined && (
            <span className="diff-old">{String(old_data[k] ?? '—')}</span>
          )}
          {new_data?.[k] !== undefined && (
            <span className="diff-new">{String(new_data[k] ?? '—')}</span>
          )}
        </div>
      ))}
      {changed.length > 10 && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>+{changed.length - 10} more fields…</span>}
    </div>
  )
}

export function AuditPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()

  const [search, setSearch]     = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [from, setFrom]         = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]             = useState(format(new Date(), 'yyyy-MM-dd'))
  const [eventFilter, setEventFilter] = useState('all')
  const [page, setPage]         = useState(0)
  const PAGE_SIZE = 50

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', shop?.id, from, to, eventFilter, page],
    queryFn: async () => {
      let q = supabase
        .from('audit_logs')
        .select('*')
        .eq('shop_id', shop!.id)
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      if (eventFilter !== 'all') q = q.eq('event_type', eventFilter)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
    enabled: !!shop?.id,
  })

  const filtered = logs.filter(l =>
    !search || l.event_type.toLowerCase().includes(search.toLowerCase()) ||
    l.table_name.toLowerCase().includes(search.toLowerCase()) ||
    l.record_id?.toLowerCase().includes(search.toLowerCase())
  )

  const handleExport = () => {
    const rows = [
      ['Time', 'Event', 'Table', 'Record ID', 'IP Address'],
      ...filtered.map(l => [
        format(new Date(l.created_at), 'dd/MM/yyyy HH:mm:ss'),
        l.event_type, l.table_name, l.record_id ?? '—', l.ip_address ?? '—',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dukaos-audit-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const EVENT_TYPES = ['all', 'INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SALE']

  return (
    <div className="aud">
      <div className="aud__header">
        <div>
          <h1 className="aud__title">{t('auditTitle')}</h1>
          <p className="aud__sub">{t('auditSub')}</p>
        </div>
        <button className="btn-export" onClick={handleExport} disabled={!filtered.length}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="aud__filters">
        <div className="search-wrap">
          <Search size={15} className="search-icon" />
          <input
            className="search-input" type="search" placeholder={t('search')}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="date-inputs">
          <div className="field">
            <label className="field__label">{t('from')}</label>
            <input className="field__input" type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0) }} />
          </div>
          <div className="field">
            <label className="field__label">{t('to')}</label>
            <input className="field__input" type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0) }} />
          </div>
        </div>
        <div className="filter-chips">
          {EVENT_TYPES.map(ev => (
            <button key={ev} className={`chip ${eventFilter === ev ? 'chip--active' : ''}`}
              onClick={() => { setEventFilter(ev); setPage(0) }}>
              {ev === 'all' ? 'All Events' : ev}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <h3>{t('auditTitle')} <span className="count-badge">{filtered.length}</span></h3>
        </div>
        {isLoading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : !filtered.length ? (
          <div className="empty">{t('noAuditLogs')}</div>
        ) : (
          <div className="aud-table-wrap">
            <table className="aud-table">
              <thead><tr>
                <th>{t('auditTime')}</th>
                <th>{t('auditEvent')}</th>
                <th>{t('auditTable')}</th>
                <th>Record ID</th>
                <th>{t('ipAddress')}</th>
                <th></th>
              </tr></thead>
              <tbody>
                {filtered.map(log => (
                  <>
                    <tr key={log.id} className={expanded === log.id ? 'aud-row aud-row--expanded' : 'aud-row'}>
                      <td className="aud-time">{format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss')}</td>
                      <td><span className={`badge ${EVENT_COLORS[log.event_type] ?? 'badge-default'}`}>{log.event_type}</span></td>
                      <td className="aud-table-name">{log.table_name}</td>
                      <td className="aud-record-id" title={log.record_id}>{log.record_id?.slice(0, 8) ?? '—'}…</td>
                      <td className="aud-ip">{log.ip_address ?? '—'}</td>
                      <td>
                        <button
                          className="expand-btn"
                          onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                          aria-label={t('viewChanges')}
                        >
                          {expanded === log.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </td>
                    </tr>
                    {expanded === log.id && (
                      <tr key={`${log.id}-detail`} className="aud-detail">
                        <td colSpan={6}>
                          <div className="aud-detail-body">
                            <div className="detail-col">
                              <span className="detail-col__title">{t('oldValue')}</span>
                              <pre className="detail-json">{log.old_data ? JSON.stringify(log.old_data, null, 2) : '(none)'}</pre>
                            </div>
                            <div className="detail-col">
                              <span className="detail-col__title">{t('newValue')}</span>
                              <pre className="detail-json">{log.new_data ? JSON.stringify(log.new_data, null, 2) : '(none)'}</pre>
                            </div>
                            <div className="detail-col">
                              <span className="detail-col__title">{t('viewChanges')}</span>
                              <DiffView old_data={log.old_data} new_data={log.new_data} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination">
          <button className="pag-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span className="pag-info">Page {page + 1}</span>
          <button className="pag-btn" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>

      <style>{`
        .aud { display: flex; flex-direction: column; gap: var(--space-5); }
        .aud__header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
        .aud__title { font-size: 1.6rem; font-weight: 800; }
        .aud__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .btn-export { display: flex; align-items: center; gap: 6px; padding: var(--space-2) var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-l); font-size: 0.85rem; font-weight: 600; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .btn-export:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
        .btn-export:disabled { opacity: 0.5; cursor: not-allowed; }

        .aud__filters { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: flex-end; }
        .search-wrap { position: relative; }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
        .search-input { padding: 8px 12px 8px 32px; border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.875rem; outline: none; background: var(--color-surface); color: var(--color-text); width: 220px; }
        .search-input:focus { border-color: var(--color-primary); }

        .date-inputs { display: flex; gap: var(--space-3); }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field__label { font-size: 0.78rem; font-weight: 600; }
        .field__input { padding: 7px 10px; border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.85rem; outline: none; background: var(--color-surface); color: var(--color-text); }
        .field__input:focus { border-color: var(--color-primary); }

        .filter-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
        .chip { padding: 5px 12px; border: 1.5px solid var(--color-border); border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 500; color: var(--color-text-secondary); background: var(--color-surface); cursor: pointer; transition: all var(--transition-fast); }
        .chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .chip--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-5); box-shadow: var(--shadow-xs); }
        .card-header { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
        .card-header h3 { font-size: 0.95rem; font-weight: 700; }
        .count-badge { background: var(--color-primary-light); color: var(--color-primary); padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; }

        .loading { display: flex; justify-content: center; padding: 40px; }
        .spinner { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 700ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty { text-align: center; padding: 40px; color: var(--color-text-muted); font-size: 0.875rem; }

        .aud-table-wrap { overflow-x: auto; }
        .aud-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; min-width: 650px; }
        .aud-table th { text-align: left; padding: var(--space-2) var(--space-3); color: var(--color-text-muted); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid var(--color-border); }
        .aud-row td { padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--color-border); }
        .aud-row:hover td { background: var(--color-surface-2); }
        .aud-row--expanded td { background: var(--color-primary-light); }
        .aud-time { font-size: 0.8rem; color: var(--color-text-muted); white-space: nowrap; }
        .aud-table-name { font-size: 0.8rem; font-family: var(--font-mono, monospace); color: var(--color-accent); }
        .aud-record-id { font-size: 0.78rem; font-family: var(--font-mono, monospace); color: var(--color-text-muted); }
        .aud-ip { font-size: 0.78rem; color: var(--color-text-muted); }
        .expand-btn { padding: 4px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-s); background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); }
        .expand-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .aud-detail td { padding: 0; }
        .aud-detail-body { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-4); padding: var(--space-4); background: var(--color-surface-2); border-bottom: 1px solid var(--color-border); }
        @media (max-width: 768px) { .aud-detail-body { grid-template-columns: 1fr; } }
        .detail-col__title { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; display: block; margin-bottom: var(--space-2); }
        .detail-json { font-size: 0.72rem; font-family: var(--font-mono, monospace); white-space: pre-wrap; word-break: break-all; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-s); padding: var(--space-2); max-height: 180px; overflow-y: auto; margin: 0; }

        .diff-view { display: flex; flex-direction: column; gap: 4px; }
        .diff-row { display: flex; gap: var(--space-2); align-items: baseline; font-size: 0.8rem; }
        .diff-key { font-family: var(--font-mono, monospace); font-size: 0.72rem; color: var(--color-text-muted); min-width: 80px; flex-shrink: 0; }
        .diff-old { text-decoration: line-through; color: var(--color-error); background: var(--color-error-bg, #fee2e2); padding: 1px 4px; border-radius: 3px; word-break: break-all; }
        .diff-new { color: var(--color-success); background: var(--color-success-bg, #dcfce7); padding: 1px 4px; border-radius: 3px; word-break: break-all; }

        .pagination { display: flex; align-items: center; justify-content: center; gap: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-border); margin-top: var(--space-4); }
        .pag-btn { padding: 6px 14px; border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.85rem; font-weight: 500; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .pag-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
        .pag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pag-info { font-size: 0.85rem; color: var(--color-text-muted); }

        .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; }
        .badge-default  { background: var(--color-surface-2); color: var(--color-text-secondary); }
        .badge-success  { background: var(--color-success-bg, #dcfce7); color: var(--color-success); }
        .badge-warning  { background: var(--color-warning-bg, #fef9c3); color: var(--color-warning); }
        .badge-error    { background: var(--color-error-bg, #fee2e2); color: var(--color-error); }
        .badge-primary  { background: var(--color-primary-light); color: var(--color-primary); }
      `}</style>
    </div>
  )
}
