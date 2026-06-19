import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  HeadphonesIcon, Plus, Search, MessageSquare,
  CheckCircle, XCircle, Clock, AlertTriangle, User,
  Monitor, Globe, Send,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format } from 'date-fns'
import { useARCAdmin } from '../useARCAuth'

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low:      { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
  medium:   { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6' },
  high:     { bg: 'rgba(249,115,22,0.12)',  text: '#f97316' },
  critical: { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444' },
}
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open:        { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6' },
  in_progress: { bg: 'rgba(234,179,8,0.12)',   text: '#eab308' },
  waiting:     { bg: 'rgba(168,85,247,0.12)',  text: '#a855f7' },
  resolved:    { bg: 'rgba(34,197,94,0.12)',   text: '#22c55e' },
  closed:      { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
}

function Pill({ value, map }: { value: string; map: typeof STATUS_COLORS }) {
  const c = map[value] ?? { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
    }}>{value.replace('_', ' ')}</span>
  )
}

export function ARCSupportPage() {
  const dark = localStorage.getItem('arc-theme') !== 'light'
  const d = {
    surface: dark ? '#0d1526' : '#ffffff', surface2: dark ? '#111827' : '#f8fafc',
    border: dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
    text: dark ? '#f1f5f9' : '#0f172a', muted: dark ? '#64748b' : '#94a3b8',
    sub: dark ? '#94a3b8' : '#475569',
  }

  const { data: admin } = useARCAdmin()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [activeTicket, setActiveTicket] = useState<any | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newTicket, setNewTicket] = useState({ customer_name: '', customer_email: '', subject: '', description: '', priority: 'medium' })

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['arc-tickets', search, statusFilter, priorityFilter],
    queryFn: async () => {
      let q = supabase.from('support_tickets').select(`
        *, assigned_to_admin:assigned_to(full_name)
      `).order('created_at', { ascending: false })
      if (statusFilter !== 'all') q = q.eq('status', statusFilter)
      if (priorityFilter !== 'all') q = q.eq('priority', priorityFilter)
      const { data } = await q
      if (!data) return []
      if (search) {
        const s = search.toLowerCase()
        return data.filter((t: any) => t.ticket_number?.toLowerCase().includes(s) || t.customer_name?.toLowerCase().includes(s) || t.customer_email?.toLowerCase().includes(s) || t.subject?.toLowerCase().includes(s))
      }
      return data
    },
    refetchInterval: 30_000,
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['arc-ticket-messages', activeTicket?.id],
    queryFn: async () => {
      if (!activeTicket?.id) return []
      const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', activeTicket.id).order('created_at')
      return data ?? []
    },
    enabled: !!activeTicket?.id,
  })

  const updateTicket = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      await supabase.from('support_tickets').update(updates).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-tickets'] }),
  })

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!activeTicket || !newMessage.trim()) return
      await supabase.from('support_messages').insert({
        ticket_id: activeTicket.id, sender_type: 'admin',
        sender_id: admin?.id, message: newMessage.trim(),
      })
      setNewMessage('')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-ticket-messages', activeTicket?.id] }),
  })

  const createTicket = useMutation({
    mutationFn: async () => {
      const num = `TKT-${Date.now().toString().slice(-6)}`
      await supabase.from('support_tickets').insert({ ...newTicket, ticket_number: num, status: 'open', assigned_to: admin?.id })
      setShowCreate(false)
      setNewTicket({ customer_name: '', customer_email: '', subject: '', description: '', priority: 'medium' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['arc-tickets'] }),
  })

  const counts = {
    open: tickets.filter((t: any) => t.status === 'open').length,
    in_progress: tickets.filter((t: any) => t.status === 'in_progress').length,
    resolved: tickets.filter((t: any) => t.status === 'resolved').length,
    critical: tickets.filter((t: any) => t.priority === 'critical').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: d.text, fontSize: 22, fontWeight: 800, margin: 0 }}>Support Center</h1>
          <p style={{ color: d.muted, fontSize: 13, margin: '4px 0 0' }}>Manage customer support tickets and sessions</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none',
          borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
        }}>
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Open Tickets', value: counts.open, icon: MessageSquare, color: '#3b82f6' },
          { label: 'In Progress', value: counts.in_progress, icon: Clock, color: '#eab308' },
          { label: 'Resolved Today', value: counts.resolved, icon: CheckCircle, color: '#22c55e' },
          { label: 'Critical', value: counts.critical, icon: AlertTriangle, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} style={{
            background: d.surface, border: `1px solid ${d.border}`,
            borderRadius: 14, padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: `${s.color}18`, border: `1px solid ${s.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <div style={{ color: d.text, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
              <div style={{ color: d.muted, fontSize: 11 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: d.muted }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…" style={{
            width: '100%', padding: '8px 12px 8px 32px', boxSizing: 'border-box',
            background: d.surface, border: `1px solid ${d.border}`, borderRadius: 10,
            color: d.text, fontSize: 13, outline: 'none',
          }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
          padding: '8px 12px', background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 10, color: d.sub, fontSize: 13, cursor: 'pointer', outline: 'none',
        }}>
          {['all', 'open', 'in_progress', 'waiting', 'resolved', 'closed'].map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{
          padding: '8px 12px', background: d.surface, border: `1px solid ${d.border}`,
          borderRadius: 10, color: d.sub, fontSize: 13, cursor: 'pointer', outline: 'none',
        }}>
          {['all', 'low', 'medium', 'high', 'critical'].map(p => (
            <option key={p} value={p}>{p === 'all' ? 'All Priorities' : p.charAt(0).toUpperCase() + p.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Tickets List */}
      <div style={{
        background: d.surface, border: `1px solid ${d.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 28, height: 28, border: `3px solid ${d.border}`, borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: d.muted }}>
            <HeadphonesIcon size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>No tickets found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: d.surface2, borderBottom: `1px solid ${d.border}` }}>
                {['Ticket ID', 'Customer', 'Subject', 'Priority', 'Status', 'Assigned', 'Created', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: d.muted, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(tickets as any[]).map(t => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${d.border}`, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = d.surface2)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setActiveTicket(t)}>
                  <td style={{ padding: '12px 14px', color: '#3b82f6', fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>{t.ticket_number}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ color: d.text, fontWeight: 600, fontSize: 13 }}>{t.customer_name || '—'}</div>
                    <div style={{ color: d.muted, fontSize: 11 }}>{t.customer_email || ''}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: d.sub, maxWidth: 200 }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</span>
                  </td>
                  <td style={{ padding: '12px 14px' }}><Pill value={t.priority} map={PRIORITY_COLORS} /></td>
                  <td style={{ padding: '12px 14px' }}><Pill value={t.status} map={STATUS_COLORS} /></td>
                  <td style={{ padding: '12px 14px', color: d.muted, fontSize: 12 }}>{t.assigned_to_admin?.full_name || '—'}</td>
                  <td style={{ padding: '12px 14px', color: d.muted, fontSize: 11 }}>{format(new Date(t.created_at), 'dd MMM, HH:mm')}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={e => { e.stopPropagation(); setActiveTicket(t) }} style={{
                        padding: '4px 8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: 7, color: '#3b82f6', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      }}>Open</button>
                      {t.status !== 'resolved' && (
                        <button onClick={e => { e.stopPropagation(); updateTicket.mutate({ id: t.id, updates: { status: 'resolved', resolved_at: new Date().toISOString() } }) }} style={{
                          padding: '4px 8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                          borderRadius: 7, color: '#22c55e', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        }}>Resolve</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ticket Chat Modal */}
      {activeTicket && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setActiveTicket(null)}>
          <div style={{
            background: dark ? '#0d1526' : '#fff', border: `1px solid ${d.border}`,
            borderRadius: 20, maxWidth: 640, width: '100%', maxHeight: '85vh',
            display: 'flex', flexDirection: 'column',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${d.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#3b82f6', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{activeTicket.ticket_number}</span>
                  <Pill value={activeTicket.status} map={STATUS_COLORS} />
                  <Pill value={activeTicket.priority} map={PRIORITY_COLORS} />
                </div>
                <h3 style={{ color: d.text, fontWeight: 700, margin: 0, fontSize: 15 }}>{activeTicket.subject}</h3>
                <p style={{ color: d.muted, fontSize: 12, margin: '4px 0 0' }}>
                  {activeTicket.customer_name} · {activeTicket.customer_email}
                </p>
              </div>
              <button onClick={() => setActiveTicket(null)} style={{ background: 'none', border: 'none', color: d.muted, cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>

            {/* Info Row */}
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${d.border}`, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { icon: User, label: activeTicket.customer_name || '—' },
                { icon: Monitor, label: activeTicket.device || 'Unknown device' },
                { icon: Globe, label: activeTicket.browser || 'Unknown browser' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, color: d.muted, fontSize: 12 }}>
                  <Icon size={13} /> {label}
                </div>
              ))}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeTicket.description && (
                <div style={{
                  padding: '12px 14px', background: d.surface2,
                  borderRadius: 12, borderBottomLeftRadius: 4, border: `1px solid ${d.border}`,
                  fontSize: 13, color: d.sub, maxWidth: '80%',
                }}>
                  <div style={{ color: d.muted, fontSize: 11, marginBottom: 4 }}>Customer</div>
                  {activeTicket.description}
                </div>
              )}
              {(messages as any[]).map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.sender_type === 'admin' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    padding: '10px 14px', maxWidth: '75%', fontSize: 13,
                    background: m.sender_type === 'admin' ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : d.surface2,
                    color: m.sender_type === 'admin' ? '#fff' : d.text,
                    borderRadius: 14,
                    borderBottomRightRadius: m.sender_type === 'admin' ? 4 : 14,
                    borderBottomLeftRadius: m.sender_type === 'admin' ? 14 : 4,
                  }}>
                    <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 4 }}>
                      {m.sender_type === 'admin' ? 'Support Agent' : 'Customer'} · {format(new Date(m.created_at), 'HH:mm')}
                    </div>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions Bar */}
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${d.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {activeTicket.status !== 'resolved' && (
                <button onClick={() => updateTicket.mutate({ id: activeTicket.id, updates: { status: 'resolved', resolved_at: new Date().toISOString() } })} style={{
                  padding: '6px 12px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>
                  <CheckCircle size={12} style={{ marginRight: 4 }} />Resolve
                </button>
              )}
              <button onClick={() => updateTicket.mutate({ id: activeTicket.id, updates: { status: 'in_progress', assigned_to: admin?.id } })} style={{
                padding: '6px 12px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)',
                borderRadius: 8, color: '#eab308', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>Assign to Me</button>
              <button onClick={() => updateTicket.mutate({ id: activeTicket.id, updates: { status: 'closed' } })} style={{
                padding: '6px 12px', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)',
                borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}><XCircle size={12} style={{ marginRight: 4 }} />Close</button>
            </div>

            {/* Reply Box */}
            <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage.mutate()}
                placeholder="Type a reply…" style={{
                  flex: 1, padding: '10px 14px',
                  background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 10,
                  color: d.text, fontSize: 13, outline: 'none',
                }} />
              <button onClick={() => sendMessage.mutate()} disabled={!newMessage.trim()} style={{
                padding: '10px 16px', background: '#3b82f6', border: 'none',
                borderRadius: 10, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Ticket Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowCreate(false)}>
          <div style={{
            background: dark ? '#0d1526' : '#fff', border: `1px solid ${d.border}`,
            borderRadius: 20, maxWidth: 480, width: '100%', padding: 24,
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ color: d.text, fontWeight: 700, margin: '0 0 20px' }}>Create Support Ticket</h3>
            {(['customer_name', 'customer_email', 'subject'] as const).map(field => (
              <div key={field} style={{ marginBottom: 14 }}>
                <label style={{ color: d.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'capitalize' }}>
                  {field.replace('_', ' ')}
                </label>
                <input value={(newTicket as any)[field]} onChange={e => setNewTicket(p => ({ ...p, [field]: e.target.value }))} style={{
                  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                  background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 10,
                  color: d.text, fontSize: 13, outline: 'none',
                }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ color: d.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Priority</label>
              <select value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))} style={{
                width: '100%', padding: '9px 12px', background: d.surface2, border: `1px solid ${d.border}`,
                borderRadius: 10, color: d.text, fontSize: 13, outline: 'none',
              }}>
                {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ color: d.muted, fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
              <textarea value={newTicket.description} onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))} rows={4} style={{
                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                background: d.surface2, border: `1px solid ${d.border}`, borderRadius: 10,
                color: d.text, fontSize: 13, outline: 'none', resize: 'vertical',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCreate(false)} style={{
                flex: 1, padding: '10px', background: d.surface2, border: `1px solid ${d.border}`,
                borderRadius: 10, color: d.sub, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Cancel</button>
              <button onClick={() => createTicket.mutate()} disabled={createTicket.isPending} style={{
                flex: 1, padding: '10px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>{createTicket.isPending ? 'Creating…' : 'Create Ticket'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
