import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertTriangle, Clock, Trash2, Database, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { formatDistanceToNow, format } from 'date-fns'

interface SyncLog {
  id: string
  entity_type: string
  entity_id: string
  operation: 'insert' | 'update' | 'delete'
  status: 'pending' | 'synced' | 'conflict' | 'error'
  payload: Record<string, unknown>
  error_message: string | null
  created_at: string
  synced_at: string | null
  version: number
}

const STATUS_CONFIG = {
  synced:   { label: 'Synced',    color: '#16a34a', icon: CheckCircle },
  pending:  { label: 'Pending',   color: '#f59e0b', icon: Clock },
  conflict: { label: 'Conflict',  color: '#f97316', icon: AlertTriangle },
  error:    { label: 'Error',     color: '#dc2626', icon: AlertTriangle },
}

const OP_COLOR = { insert: '#16a34a', update: '#3b82f6', delete: '#dc2626' }

export function OfflineSyncPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastPing, setLastPing] = useState<Date | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'conflict' | 'error'>('all')
  const [expanding, setExpanding] = useState<string | null>(null)

  useEffect(() => {
    const up = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  const pingMutation = useMutation({
    mutationFn: async () => {
      const start = Date.now()
      await supabase.from('shops').select('id').eq('id', shop!.id).single()
      return Date.now() - start
    },
    onSuccess: () => setLastPing(new Date()),
  })

  const { data: logs = [], isLoading } = useQuery<SyncLog[]>({
    queryKey: ['sync-logs', shop?.id],
    enabled: !!shop?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('sync_log')
        .select('*')
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      return (data ?? []) as SyncLog[]
    },
  })

  const retryMutation = useMutation({
    mutationFn: async (log: SyncLog) => {
      await supabase.from('sync_log').update({ status: 'pending', error_message: null }).eq('id', log.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-logs', shop?.id] }),
  })

  const clearSyncedMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('sync_log').delete().eq('shop_id', shop!.id).eq('status', 'synced')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-logs', shop?.id] }),
  })

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter)

  const counts = {
    total: logs.length,
    pending: logs.filter(l => l.status === 'pending').length,
    conflict: logs.filter(l => l.status === 'conflict').length,
    error: logs.filter(l => l.status === 'error').length,
    synced: logs.filter(l => l.status === 'synced').length,
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpDown size={22} style={{ color: 'var(--color-primary)' }} /> Offline Sync
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            Monitor data synchronization status and resolve conflicts
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => pingMutation.mutate()} disabled={pingMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
            <RefreshCw size={14} style={{ animation: pingMutation.isPending ? 'spin 1s linear infinite' : 'none' }} />
            Ping DB
          </button>
          {counts.synced > 0 && (
            <button onClick={() => clearSyncedMutation.mutate()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13 }}>
              <Trash2 size={14} /> Clear synced
            </button>
          )}
        </div>
      </div>

      {/* Connection banner */}
      <div style={{ background: isOnline ? '#dcfce7' : '#fee2e2', border: `1px solid ${isOnline ? '#16a34a' : '#dc2626'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        {isOnline ? <Wifi size={18} style={{ color: '#16a34a' }} /> : <WifiOff size={18} style={{ color: '#dc2626' }} />}
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: isOnline ? '#166534' : '#991b1b' }}>
            {isOnline ? 'Online — Connected to Supabase' : 'Offline — Changes will sync when reconnected'}
          </span>
          {lastPing && <span style={{ fontSize: 12, color: isOnline ? '#166534' : '#991b1b', marginLeft: 12 }}>Last ping: {formatDistanceToNow(lastPing, { addSuffix: true })}</span>}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'all', label: 'Total', value: counts.total, color: 'var(--color-text)' },
          { key: 'synced', label: 'Synced', value: counts.synced, color: '#16a34a' },
          { key: 'pending', label: 'Pending', value: counts.pending, color: '#f59e0b' },
          { key: 'conflict', label: 'Conflicts', value: counts.conflict, color: '#f97316' },
          { key: 'error', label: 'Errors', value: counts.error, color: '#dc2626' },
        ].map(s => (
          <div key={s.key} onClick={() => setFilter(s.key as typeof filter)} style={{ background: filter === s.key ? `${s.color}15` : 'var(--color-card)', border: `2px solid ${filter === s.key ? s.color : 'var(--color-border)'}`, borderRadius: 10, padding: '12px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading sync logs…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <Database size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>{filter === 'all' ? 'No sync log entries yet. Activity will appear here when offline changes occur.' : `No ${filter} entries.`}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(log => {
            const sc = STATUS_CONFIG[log.status]
            const Icon = sc.icon
            const isExpanded = expanding === log.id
            return (
              <div key={log.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setExpanding(isExpanded ? null : log.id)} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <Icon size={16} style={{ color: sc.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', textTransform: 'capitalize' }}>
                        {log.entity_type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: OP_COLOR[log.operation], background: `${OP_COLOR[log.operation]}15`, padding: '1px 7px', borderRadius: 8, textTransform: 'uppercase' }}>
                        {log.operation}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: sc.color, background: `${sc.color}15`, padding: '1px 7px', borderRadius: 8 }}>
                        {sc.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss')} · ID: {log.entity_id.slice(0, 8)}…
                      {log.synced_at && ` · Synced ${formatDistanceToNow(new Date(log.synced_at), { addSuffix: true })}`}
                    </div>
                    {log.error_message && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>⚠ {log.error_message}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>v{log.version}</span>
                  {(log.status === 'error' || log.status === 'conflict') && (
                    <button onClick={e => { e.stopPropagation(); retryMutation.mutate(log) }} style={{ padding: '4px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                      Retry
                    </button>
                  )}
                </div>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: 14, background: 'var(--color-bg)' }}>
                    <pre style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0, overflow: 'auto', maxHeight: 200, fontFamily: 'monospace' }}>
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
