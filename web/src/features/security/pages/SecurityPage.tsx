import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Monitor, Smartphone, Globe, Trash2, ShieldCheck, Clock } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT } from '@/shared/i18n/useLanguage'
import { format, formatDistanceToNow } from 'date-fns'

interface SessionRow {
  id: string
  device_name: string
  ip_address: string
  user_agent: string
  created_at: string
  last_seen_at: string
  is_current: boolean
}

function deviceIcon(ua: string) {
  const u = (ua ?? '').toLowerCase()
  if (u.includes('mobile') || u.includes('android') || u.includes('iphone')) return <Smartphone size={18} />
  return <Monitor size={18} />
}

function useActiveSessions(shopId?: string) {
  return useQuery<SessionRow[]>({
    queryKey: ['sessions', shopId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('shop_id', shopId!)
        .eq('user_id', user!.id)
        .order('last_seen_at', { ascending: false })
      if (error) throw error
      // Mark the "current" session by a flag we set on login, or fall back to most recent
      return (data ?? []).map((s, i) => ({ ...s, is_current: i === 0 }))
    },
    enabled: !!shopId,
  })
}

export function SecurityPage() {
  const t = useT()
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()

  const { data: sessions = [], isLoading } = useActiveSessions(shop?.id)
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.from('user_sessions').delete().eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setRevokeTarget(null)
    },
  })

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const currentId = sessions.find(s => s.is_current)?.id
      let query = supabase.from('user_sessions').delete().eq('shop_id', shop!.id)
      if (currentId) query = query.neq('id', currentId)
      const { error } = await query
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const otherSessions = sessions.filter(s => !s.is_current)

  return (
    <div className="sec">
      <div className="sec__header">
        <ShieldCheck size={28} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h1 className="sec__title">{t('securityTitle')}</h1>
          <p className="sec__sub">{t('activeSessions')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="sec-loading"><div className="spinner" /></div>
      ) : !sessions.length ? (
        <div className="sec-empty">
          <Globe size={40} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
          <p>{t('noSessions')}</p>
        </div>
      ) : (
        <div className="sec__sessions">
          {sessions.map(session => (
            <div key={session.id} className={`session-card ${session.is_current ? 'session-card--current' : ''}`}>
              <div className="session-card__icon">
                {deviceIcon(session.user_agent)}
              </div>
              <div className="session-card__body">
                <div className="session-card__name">
                  {session.device_name || 'Unknown device'}
                  {session.is_current && (
                    <span className="current-badge">{t('currentSession')}</span>
                  )}
                </div>
                <div className="session-card__meta">
                  <span>
                    <Globe size={11} style={{ display: 'inline', marginRight: 3 }} />
                    {session.ip_address || '—'}
                  </span>
                  <span>
                    <Clock size={11} style={{ display: 'inline', marginRight: 3 }} />
                    {t('lastSeen')}: {session.last_seen_at
                      ? formatDistanceToNow(new Date(session.last_seen_at), { addSuffix: true })
                      : '—'}
                  </span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                    {session.created_at ? format(new Date(session.created_at), 'dd/MM/yyyy HH:mm') : ''}
                  </span>
                </div>
              </div>
              {!session.is_current && (
                <button
                  className="session-card__revoke"
                  onClick={() => setRevokeTarget(session.id)}
                  title={t('revokeSession')}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {otherSessions.length > 0 && (
        <button
          className="btn-revoke-all"
          onClick={() => revokeAllMutation.mutate()}
          disabled={revokeAllMutation.isPending}
        >
          {revokeAllMutation.isPending ? 'Revoking…' : t('revokeAllOthers')}
        </button>
      )}

      {/* Confirm revoke modal */}
      {revokeTarget && (
        <div className="modal-overlay" onClick={() => setRevokeTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>{t('revokeSession')}</h3>
              <button onClick={() => setRevokeTarget(null)} className="modal__close">×</button>
            </div>
            <div className="modal__body">
              <p>Revoke this session? The device will be signed out immediately.</p>
              <div className="modal__actions">
                <button className="btn-cancel" onClick={() => setRevokeTarget(null)}>Cancel</button>
                <button
                  className="btn-danger"
                  onClick={() => revokeMutation.mutate(revokeTarget)}
                  disabled={revokeMutation.isPending}
                >
                  {revokeMutation.isPending ? 'Revoking…' : 'Revoke'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sec { display: flex; flex-direction: column; gap: var(--space-5); max-width: 680px; }
        .sec__header { display: flex; align-items: center; gap: var(--space-4); }
        .sec__title { font-size: 1.5rem; font-weight: 800; }
        .sec__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .sec__sessions { display: flex; flex-direction: column; gap: var(--space-3); }
        .session-card { display: flex; align-items: flex-start; gap: var(--space-4); padding: var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); transition: border-color var(--transition-fast); }
        .session-card--current { border-color: var(--color-primary); }
        .session-card__icon { width: 40px; height: 40px; background: var(--color-surface-2); border-radius: var(--radius-m); display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); flex-shrink: 0; }
        .session-card--current .session-card__icon { background: var(--color-primary-light); color: var(--color-primary); }
        .session-card__body { flex: 1; min-width: 0; }
        .session-card__name { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
        .current-badge { font-size: 0.7rem; font-weight: 700; background: var(--color-primary); color: #fff; padding: 2px 7px; border-radius: var(--radius-full); }
        .session-card__meta { display: flex; flex-wrap: wrap; gap: var(--space-4); margin-top: 4px; font-size: 0.8rem; color: var(--color-text-secondary); }
        .session-card__revoke { padding: 6px; border: 1.5px solid var(--color-border); border-radius: var(--radius-m); background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0; }
        .session-card__revoke:hover { border-color: var(--color-error); color: var(--color-error); }

        .btn-revoke-all { padding: var(--space-3) var(--space-5); border: 1.5px solid var(--color-error); border-radius: var(--radius-m); color: var(--color-error); background: var(--color-surface); font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all var(--transition-fast); align-self: flex-start; }
        .btn-revoke-all:hover { background: var(--color-error); color: #fff; }
        .btn-revoke-all:disabled { opacity: 0.6; cursor: not-allowed; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 200; display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
        .modal { background: var(--color-surface); border-radius: var(--radius-l); max-width: 380px; width: 100%; box-shadow: var(--shadow-xl, 0 20px 60px rgba(0,0,0,0.3)); }
        .modal__header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5); border-bottom: 1px solid var(--color-border); }
        .modal__header h3 { font-weight: 700; }
        .modal__close { font-size: 1.4rem; color: var(--color-text-muted); cursor: pointer; background: none; border: none; line-height: 1; }
        .modal__body { padding: var(--space-5); }
        .modal__body p { color: var(--color-text-secondary); font-size: 0.9rem; }
        .modal__actions { display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-5); }
        .btn-cancel { padding: var(--space-2) var(--space-5); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.875rem; font-weight: 600; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; }
        .btn-danger { padding: var(--space-2) var(--space-5); border-radius: var(--radius-m); font-size: 0.875rem; font-weight: 600; background: var(--color-error); color: #fff; cursor: pointer; }
        .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

        .sec-loading { display: flex; justify-content: center; padding: 40px; }
        .spinner { width: 32px; height: 32px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 700ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .sec-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; color: var(--color-text-muted); }
      `}</style>
    </div>
  )
}
