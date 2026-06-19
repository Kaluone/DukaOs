import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Send, CheckCircle, AlertTriangle, Trash2, Users, ShoppingCart, TrendingDown, Package } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

interface PushSubscription {
  id: string
  device_label: string
  endpoint: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

interface NotificationRecord {
  id: string
  title: string
  body: string
  type: string
  sent_at: string
  recipient_count: number
  status: 'sent' | 'failed' | 'partial'
}

type TriggerKey = 'low_stock' | 'new_sale' | 'daily_summary' | 'large_order' | 'new_expense'

interface TriggerConfig {
  label: string
  description: string
  icon: React.ElementType
  color: string
}

const TRIGGER_CONFIG: Record<TriggerKey, TriggerConfig> = {
  low_stock:     { label: 'Low Stock Alert',      description: 'Notify when product stock falls below threshold', icon: Package,      color: '#f59e0b' },
  new_sale:      { label: 'New Sale',              description: 'Notify on every completed POS transaction',       icon: ShoppingCart, color: '#16a34a' },
  daily_summary: { label: 'Daily Summary',         description: 'End-of-day sales & profit summary at 9 PM',      icon: TrendingDown, color: '#3b82f6' },
  large_order:   { label: 'Large Order (>100K)',   description: 'Alert when a single order exceeds TZS 100,000',  icon: Users,        color: '#8b5cf6' },
  new_expense:   { label: 'New Expense Logged',    description: 'Notify when any expense is recorded',            icon: AlertTriangle,color: '#ef4444' },
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, background: on ? 'var(--color-primary)' : '#d1d5db', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  )
}

export function PushNotificationsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [enabledTriggers, setEnabledTriggers] = useState<Record<TriggerKey, boolean>>({
    low_stock: true, new_sale: false, daily_summary: true, large_order: true, new_expense: false,
  })
  const [testTitle, setTestTitle] = useState('DukaOS Test')
  const [testBody, setTestBody] = useState('This is a test push notification from DukaOS.')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; message: string } | null>(null)

  const { data: subscriptions = [] } = useQuery<PushSubscription[]>({
    queryKey: ['push-subscriptions', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
      return (data ?? []) as PushSubscription[]
    },
  })

  const { data: history = [] } = useQuery<NotificationRecord[]>({
    queryKey: ['notification-history', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_history')
        .select('*')
        .eq('shop_id', shop!.id)
        .order('sent_at', { ascending: false })
        .limit(20)
      return (data ?? []) as NotificationRecord[]
    },
  })

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['notification-settings', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('shop_id', shop!.id)
        .single()
      if (data?.triggers) setEnabledTriggers(data.triggers as Record<TriggerKey, boolean>)
      return data
    },
  })

  const saveSettingsMutation = useMutation({
    mutationFn: async (triggers: Record<TriggerKey, boolean>) => {
      if (settings) {
        await supabase.from('notification_settings').update({ triggers, updated_at: new Date().toISOString() }).eq('shop_id', shop!.id)
      } else {
        await supabase.from('notification_settings').insert({ shop_id: shop!.id, triggers })
      }
    },
    onSuccess: () => { refetchSettings() },
  })

  const removeSubscriptionMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('push_subscriptions').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['push-subscriptions', shop?.id] }),
  })

  function handleTriggerToggle(key: TriggerKey) {
    const updated = { ...enabledTriggers, [key]: !enabledTriggers[key] }
    setEnabledTriggers(updated)
    saveSettingsMutation.mutate(updated)
  }

  async function handleSendTest() {
    if (!testTitle.trim() || !testBody.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      await supabase.from('notification_history').insert({
        shop_id: shop!.id,
        title: testTitle,
        body: testBody,
        type: 'test',
        recipient_count: subscriptions.filter(s => s.is_active).length,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      await qc.invalidateQueries({ queryKey: ['notification-history', shop?.id] })
      setSendResult({ ok: true, message: `Test notification queued for ${subscriptions.filter(s => s.is_active).length} active device(s).` })
    } catch {
      setSendResult({ ok: false, message: 'Failed to send test notification. Check your configuration.' })
    } finally {
      setSending(false)
    }
  }

  const activeCount = subscriptions.filter(s => s.is_active).length

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={22} style={{ color: 'var(--color-primary)' }} /> Push Notifications
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
          Manage device subscriptions and automated notification triggers
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Registered Devices', value: subscriptions.length, color: 'var(--color-primary)' },
          { label: 'Active Devices', value: activeCount, color: '#16a34a' },
          { label: 'Notifications Sent', value: history.length, color: '#8b5cf6' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Triggers */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Notification Triggers</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(Object.entries(TRIGGER_CONFIG) as [TriggerKey, TriggerConfig][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <div key={key} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={16} style={{ color: cfg.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{cfg.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{cfg.description}</div>
                  </div>
                  <Toggle on={enabledTriggers[key]} onToggle={() => handleTriggerToggle(key)} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column: test + devices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Test Notification */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Send Test Notification</h2>
            <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Title</label>
                <input value={testTitle} onChange={e => setTestTitle(e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Body</label>
                <textarea value={testBody} onChange={e => setTestBody(e.target.value)} rows={3} style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 7, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <button onClick={handleSendTest} disabled={sending || activeCount === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: activeCount === 0 ? 'not-allowed' : 'pointer', opacity: activeCount === 0 ? 0.5 : 1, fontSize: 13, fontWeight: 600 }}>
                <Send size={14} /> {sending ? 'Sending…' : 'Send Test'}
              </button>
              {activeCount === 0 && <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 6 }}>No active devices registered. Install the DukaOS mobile app to receive notifications.</p>}
              {sendResult && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: sendResult.ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${sendResult.ok ? '#16a34a' : '#dc2626'}` }}>
                  <span style={{ fontSize: 12, color: sendResult.ok ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {sendResult.ok ? <CheckCircle size={13} /> : <AlertTriangle size={13} />} {sendResult.message}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Registered Devices */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Registered Devices</h2>
            {subscriptions.length === 0 ? (
              <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <BellOff size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p style={{ fontSize: 13 }}>No devices registered yet. Install the DukaOS mobile app and enable notifications.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {subscriptions.map(sub => (
                  <div key={sub.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sub.is_active ? '#16a34a' : '#9ca3af', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{sub.device_label || 'Unknown Device'}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        Added {format(new Date(sub.created_at), 'dd MMM yyyy')}
                        {sub.last_used_at && ` · Last used ${format(new Date(sub.last_used_at), 'dd MMM')}`}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: sub.is_active ? '#16a34a' : '#9ca3af', background: sub.is_active ? '#dcfce7' : '#f3f4f6', padding: '2px 8px', borderRadius: 8 }}>
                      {sub.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button onClick={() => removeSubscriptionMutation.mutate(sub.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Recent Notifications</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map(n => (
              <div key={n.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 1 }}>{n.body}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: n.status === 'sent' ? '#16a34a' : n.status === 'partial' ? '#f59e0b' : '#dc2626' }}>
                    {n.status === 'sent' ? `✓ Sent to ${n.recipient_count}` : n.status === 'partial' ? 'Partial' : '✗ Failed'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{format(new Date(n.sent_at), 'dd MMM HH:mm')}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
