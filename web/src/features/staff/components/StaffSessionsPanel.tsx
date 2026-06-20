import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Monitor, Smartphone, LogOut, AlertTriangle, RefreshCw, Clock, Wifi } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { formatDistanceToNow, format } from 'date-fns'

interface Session {
  id: string
  staff_id: string
  session_token: string
  device_id: string | null
  device_label: string | null
  last_seen_at: string
  expires_at: string
  is_revoked: boolean
  created_at: string
  staff: { full_name: string } | null
}

interface Props {
  shopId: string
}

function deviceIcon(label: string | null) {
  if (!label) return <Monitor size={14} />
  const lower = label.toLowerCase()
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) {
    return <Smartphone size={14} />
  }
  return <Monitor size={14} />
}

export function StaffSessionsPanel({ shopId }: Props) {
  const qc = useQueryClient()
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null)

  const { data: sessions = [], isLoading, refetch } = useQuery<Session[]>({
    queryKey: ['staff-sessions', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_sessions')
        .select('*, staff:staff_id(full_name)')
        .eq('shop_id', shopId)
        .eq('is_revoked', false)
        .gt('expires_at', new Date().toISOString())
        .order('last_seen_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Session[]
    },
    refetchInterval: 30_000,
  })

  const revokeOne = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc('rpc_revoke_staff_session', { p_session_id: sessionId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-sessions', shopId] }),
  })

  const revokeAll = useMutation({
    mutationFn: async (staffId: string) => {
      const { error } = await supabase.rpc('rpc_revoke_all_staff_sessions', { p_staff_id: staffId })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-sessions', shopId] }),
  })

  // Group sessions by staff member
  const byStaff = sessions.reduce<Record<string, { name: string; sessions: Session[] }>>((acc, s) => {
    const name = s.staff?.full_name ?? 'Unknown'
    if (!acc[s.staff_id]) acc[s.staff_id] = { name, sessions: [] }
    acc[s.staff_id].sessions.push(s)
    return acc
  }, {})

  const totalActive = sessions.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: totalActive > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.1)',
            border: `1px solid ${totalActive > 0 ? 'rgba(34,197,94,0.25)' : 'var(--color-border)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Wifi size={16} style={{ color: totalActive > 0 ? '#22c55e' : 'var(--color-text-secondary)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Vikao Hai — Active Sessions
            </h3>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
              {totalActive === 0 ? 'Hakuna vikao vya sasa' : `${totalActive} session${totalActive !== 1 ? 's' : ''} active`}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', border: '1px solid var(--color-border)',
            borderRadius: 8, background: 'transparent',
            color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <RefreshCw size={20} style={{ animation: 'spin 0.8s linear infinite' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : Object.keys(byStaff).length === 0 ? (
        <div style={{
          padding: 32, textAlign: 'center',
          background: 'var(--color-surface)', borderRadius: 12,
          border: '1px solid var(--color-border)',
        }}>
          <Monitor size={32} style={{ color: 'var(--color-text-secondary)', opacity: 0.4, marginBottom: 8 }} />
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: 0 }}>
            Hakuna vikao vya sasa. Vikao vitaonekana hapa wakati mfanyakazi akiingia.
          </p>
        </div>
      ) : (
        Object.entries(byStaff).map(([staffId, { name, sessions: staffSessions }]) => (
          <div key={staffId} style={{
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            {/* Staff row header */}
            <div
              onClick={() => setExpandedStaff(expandedStaff === staffId ? null : staffId)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', cursor: 'pointer',
                background: expandedStaff === staffId ? 'var(--color-primary-light)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--color-primary)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      {staffSessions.length} device{staffSessions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={e => { e.stopPropagation(); revokeAll.mutate(staffId) }}
                  disabled={revokeAll.isPending}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 7, color: '#ef4444', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <AlertTriangle size={11} />
                  Force Logout All
                </button>
              </div>
            </div>

            {/* Expanded sessions list */}
            {expandedStaff === staffId && (
              <div style={{ borderTop: '1px solid var(--color-border)' }}>
                {staffSessions.map(session => (
                  <div key={session.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#3b82f6',
                    }}>
                      {deviceIcon(session.device_label)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--color-text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {session.device_label
                          ? session.device_label.substring(0, 60) + (session.device_label.length > 60 ? '…' : '')
                          : 'Unknown device'}
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} />
                          Last seen {formatDistanceToNow(new Date(session.last_seen_at), { addSuffix: true })}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                          Expires {format(new Date(session.expires_at), 'dd MMM HH:mm')}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => revokeOne.mutate(session.id)}
                      disabled={revokeOne.isPending}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: 7, color: '#ef4444', fontSize: 11, fontWeight: 700,
                        cursor: 'pointer', flexShrink: 0,
                      }}
                    >
                      <LogOut size={11} /> Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
