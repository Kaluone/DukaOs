import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, Package, CreditCard, AlertTriangle, Info, CheckCircle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { formatDistanceToNow } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  is_read: boolean
  action_url: string | null
  created_at: string
}

const TYPE_ICONS: Record<string, React.FC<any>> = {
  low_stock: Package,
  subscription_alert: CreditCard,
  payment_failure: AlertTriangle,
  system_update: Info,
  approval_request: CheckCircle,
  approval_decision: CheckCircle,
  sale_alert: CheckCircle,
  eod_reminder: AlertTriangle,
  shift_start: CheckCircle,
  shift_end: CheckCircle,
  transfer_received: Package,
  refund_processed: CheckCircle,
}

const TYPE_COLORS: Record<string, string> = {
  low_stock: '#f59e0b',
  subscription_alert: '#7c3aed',
  payment_failure: '#dc2626',
  approval_request: '#3b82f6',
  sale_alert: '#16a34a',
  refund_processed: '#dc2626',
}

interface Props {
  shopId?: string
}

export function NotificationBell({ shopId }: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', shopId],
    enabled: !!shopId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, is_read, action_url, created_at')
        .eq('shop_id', shopId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('shop_id', shopId!)
        .eq('is_read', false)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', shopId] }),
  })

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', shopId] }),
  })

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', padding: '6px', borderRadius: 8,
          display: 'flex', alignItems: 'center',
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: unreadCount > 9 ? 18 : 14, height: 14,
            background: '#dc2626', borderRadius: 10,
            fontSize: 10, fontWeight: 700, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)',
          width: 360, maxWidth: 'calc(100vw - 32px)',
          background: 'var(--color-card)', border: '1px solid var(--color-border)',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          zIndex: 9999, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
              Notifications {unreadCount > 0 && <span style={{ fontSize: 12, background: '#dc2626', color: '#fff', borderRadius: 10, padding: '1px 6px', marginLeft: 4 }}>{unreadCount}</span>}
            </span>
            {unreadCount > 0 && (
              <button onClick={() => markAllRead.mutate()} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600 }}>
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <Bell size={28} style={{ opacity: 0.3, marginBottom: 6 }} />
                <p style={{ fontSize: 13 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = TYPE_ICONS[n.type] ?? Info
                const color = TYPE_COLORS[n.type] ?? 'var(--color-primary)'
                return (
                  <div
                    key={n.id}
                    onClick={() => { if (!n.is_read) markOneRead.mutate(n.id) }}
                    style={{
                      display: 'flex', gap: 10, padding: '12px 16px',
                      background: n.is_read ? 'transparent' : `${color}08`,
                      borderBottom: '1px solid var(--color-border)',
                      cursor: n.is_read ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={15} style={{ color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700, color: 'var(--color-text)', flex: 1 }}>{n.title}</span>
                        {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3, marginLeft: 6 }} />}
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0', lineHeight: 1.4 }}>{n.body}</p>
                      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4, display: 'block' }}>
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
