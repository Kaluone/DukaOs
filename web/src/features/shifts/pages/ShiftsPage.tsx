import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Play, Square, DollarSign, Users, AlertTriangle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, differenceInMinutes } from 'date-fns'

interface Shift {
  id: string
  shift_type: string
  status: string
  start_time: string
  end_time: string | null
  sales_count: number
  sales_total: number
  expenses_total: number
  cash_handled: number
  variance: number | null
  notes: string | null
  staff: { full_name: string } | null
}

interface RegisterSession {
  id: string
  status: string
  opening_cash: number
  closing_cash: number | null
  cash_in: number
  cash_out: number
  expected_cash: number | null
  actual_cash: number | null
  variance: number | null
  sales_total: number
  transactions_count: number
  opened_at: string
  closed_at: string | null
  staff: { full_name: string } | null
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

export function ShiftsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'shifts' | 'registers'>('registers')
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const { data: sessions = [] } = useQuery<RegisterSession[]>({
    queryKey: ['register-sessions', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('register_sessions')
        .select('*, staff:staff_id(full_name)')
        .eq('shop_id', shop!.id)
        .order('opened_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as unknown as RegisterSession[]
    },
  })

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, staff:staff_id(full_name)')
        .eq('shop_id', shop!.id)
        .order('start_time', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as Shift[]
    },
  })

  const activeSession = sessions.find(s => s.status === 'open')

  const openSessionMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      const cash = parseFloat(openingCash) || 0
      const { error } = await supabase.from('register_sessions').insert({
        shop_id: shop.id, status: 'open', opening_cash: cash, cash_in: 0, cash_out: 0, sales_total: 0, transactions_count: 0,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['register-sessions', shop?.id] }); setOpeningCash('') },
    onError: (e: Error) => setError(e.message),
  })

  const closeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const actual = parseFloat(closingCash)
      if (isNaN(actual)) throw new Error('Enter actual closing cash')
      const session = sessions.find(s => s.id === sessionId)
      if (!session) throw new Error('Session not found')
      const expected = session.opening_cash + session.cash_in - session.cash_out
      const variance = actual - expected
      const { error } = await supabase.from('register_sessions').update({
        status: 'closed', closing_cash: actual, actual_cash: actual, expected_cash: expected,
        variance, closed_at: new Date().toISOString(), notes: notes || null,
      }).eq('id', sessionId)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['register-sessions', shop?.id] }); setClosingCash(''); setNotes('') },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Clock size={22} style={{ color: 'var(--color-primary)' }} /> Shifts & Cash Register
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Manage cash drawer sessions and staff shifts
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--color-bg)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {(['registers', 'shifts'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--color-card)' : 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, fontSize: 14, textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'registers' && (
        <>
          {/* Active session panel */}
          {!activeSession ? (
            <div style={{ background: 'var(--color-card)', border: '2px dashed var(--color-border)', borderRadius: 12, padding: 24, marginBottom: 20, textAlign: 'center' }}>
              <DollarSign size={36} style={{ color: 'var(--color-primary)', marginBottom: 8 }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>No Active Register Session</h3>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  value={openingCash}
                  onChange={e => setOpeningCash(e.target.value)}
                  placeholder="Opening cash (TZS)"
                  style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, width: 200 }}
                />
                <button
                  onClick={() => openSessionMutation.mutate()}
                  disabled={openSessionMutation.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  <Play size={14} /> Open Register
                </button>
              </div>
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            </div>
          ) : (
            <div style={{ background: 'var(--color-card)', border: '2px solid #16a34a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'pulse 2s infinite' }} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>Register Open</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>since {format(new Date(activeSession.opened_at), 'HH:mm')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
                    {[
                      { label: 'Opening Cash', value: fmt(activeSession.opening_cash) },
                      { label: 'Sales', value: fmt(activeSession.sales_total) },
                      { label: 'Transactions', value: activeSession.transactions_count },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{s.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flex: 1, gap: 8, alignItems: 'flex-end', minWidth: 240, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Actual Cash (TZS) *</label>
                    <input type="number" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Count drawer" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 130 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Notes</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional" style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <button
                    onClick={() => closeSessionMutation.mutate(activeSession.id)}
                    disabled={closeSessionMutation.isPending}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    <Square size={14} /> Close Register
                  </button>
                </div>
              </div>
              {error && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</p>}
            </div>
          )}

          {/* Session history */}
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Session History</h3>
          {sessions.filter(s => s.status === 'closed').map(s => {
            const dur = s.closed_at ? differenceInMinutes(new Date(s.closed_at), new Date(s.opened_at)) : 0
            return (
              <div key={s.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                      {format(new Date(s.opened_at), 'dd MMM yyyy')} · {format(new Date(s.opened_at), 'HH:mm')} – {s.closed_at ? format(new Date(s.closed_at), 'HH:mm') : '?'} ({dur}min)
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sales: <strong>{fmt(s.sales_total)}</strong></span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Opening: <strong>{fmt(s.opening_cash)}</strong></span>
                      {s.actual_cash !== null && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Closing: <strong>{fmt(s.actual_cash)}</strong></span>}
                      {s.variance !== null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: s.variance === 0 ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                          {s.variance !== 0 && <AlertTriangle size={11} />}
                          Variance: {s.variance > 0 ? '+' : ''}{fmt(s.variance)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(s.staff as any)?.full_name && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{(s.staff as any).full_name}</span>}
                </div>
              </div>
            )
          })}
        </>
      )}

      {tab === 'shifts' && (
        <>
          {shiftsLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
          ) : shifts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
              <Clock size={36} style={{ opacity: 0.3, marginBottom: 8 }} /><p>No shifts recorded yet</p>
            </div>
          ) : (
            shifts.map(s => (
              <div key={s.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)', textTransform: 'capitalize' }}>{s.shift_type} Shift</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: s.status === 'active' ? '#16a34a' : '#6b7280' }}>{s.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sales: <strong>{fmt(s.sales_total)}</strong></span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Transactions: <strong>{s.sales_count}</strong></span>
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Start: <strong>{format(new Date(s.start_time), 'dd MMM HH:mm')}</strong></span>
                      {s.end_time && <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>End: <strong>{format(new Date(s.end_time), 'HH:mm')}</strong></span>}
                    </div>
                  </div>
                  {(s.staff as any)?.full_name && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} />{(s.staff as any).full_name}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
