import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Megaphone, Plus, Send, Clock, FileText, Users, Radio,
  ChevronDown, ChevronUp, X, AlertTriangle, Wrench,
  CreditCard, Sparkles, Bell, Eye, CheckCircle2,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { format } from 'date-fns'
import { useARCAdmin, useARCAuditLog } from '../useARCAuth'

// ─── Types ───────────────────────────────────────────────────────────────────

type Broadcast = {
  id: string
  subject: string
  body: string
  type: string
  recipient_type: string
  recipient_plans: string[] | null
  channels: string[]
  status: string
  sent_at: string | null
  scheduled_at: string | null
  recipient_count: number
  created_at: string
  arc_admins?: { email: string } | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MSG_TYPES = [
  { value: 'announcement', label: 'Announcement',  icon: Megaphone,     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  { value: 'maintenance',  label: 'Maintenance',   icon: Wrench,        color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'billing',      label: 'Billing',       icon: CreditCard,    color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  { value: 'feature',      label: 'New Feature',   icon: Sparkles,      color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  { value: 'alert',        label: 'Alert',         icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
] as const

const PLANS = ['starter', 'business', 'pro', 'enterprise']

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  sent:      { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e' },
  draft:     { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
  scheduled: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
}

function typeInfo(type: string) {
  return MSG_TYPES.find(t => t.value === type) ?? MSG_TYPES[0]
}

// ─── Compose Modal ────────────────────────────────────────────────────────────

function ComposeModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { data: admin } = useARCAdmin()
  const auditLog = useARCAuditLog()
  const qc = useQueryClient()

  const [subject, setSubject]   = useState('')
  const [body, setBody]         = useState('')
  const [type, setType]         = useState<string>('announcement')
  const [recipientType, setRecipientType] = useState<string>('all')
  const [selectedPlans, setSelectedPlans] = useState<string[]>([])
  const [channels, setChannels] = useState<string[]>(['in_app'])
  const [preview, setPreview]   = useState(false)
  const [error, setError]       = useState('')

  const send = useMutation({
    mutationFn: async () => {
      if (!subject.trim()) throw new Error('Subject is required')
      if (!body.trim())    throw new Error('Message body is required')
      if (recipientType === 'by_plan' && selectedPlans.length === 0)
        throw new Error('Select at least one plan')

      const { data, error } = await supabase.rpc('rpc_arc_send_broadcast', {
        p_subject:         subject.trim(),
        p_body:            body.trim(),
        p_type:            type,
        p_recipient_type:  recipientType,
        p_recipient_plans: recipientType === 'by_plan' ? selectedPlans : null,
        p_recipient_ids:   null,
        p_channels:        channels,
      })
      if (error) throw error

      if (admin) {
        auditLog.mutate({
          admin,
          action: 'broadcast.send',
          details: { subject, type, recipient_type: recipientType, recipient_count: (data as Broadcast)?.recipient_count ?? 0 },
        })
      }
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['arc-broadcasts'] })
      onSent()
    },
    onError: (e: Error) => setError(e.message),
  })

  const ti = typeInfo(type)
  const TypeIcon = ti.icon

  function togglePlan(p: string) {
    setSelectedPlans(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  function toggleChannel(ch: string) {
    setChannels(prev => prev.includes(ch) ? prev.filter(x => x !== ch) : [...prev, ch])
  }

  return (
    <div className="bc-overlay">
      <div className="bc-compose">
        {/* Header */}
        <div className="bc-compose__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={18} color="#3b82f6" />
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
              Broadcast to Tenants
            </h2>
          </div>
          <button onClick={onClose} className="bc-close"><X size={16} /></button>
        </div>

        <div className="bc-compose__body">
          {/* Type selector */}
          <div className="bc-field">
            <label className="bc-label">Message Type</label>
            <div className="bc-type-grid">
              {MSG_TYPES.map(t => {
                const Icon = t.icon
                const active = type === t.value
                return (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`bc-type-btn ${active ? 'bc-type-btn--active' : ''}`}
                    style={active ? { borderColor: t.color, background: t.bg } : undefined}
                  >
                    <Icon size={15} style={{ color: active ? t.color : undefined }} />
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subject */}
          <div className="bc-field">
            <label className="bc-label">Subject *</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Scheduled maintenance on Saturday 2am–4am"
              className="bc-input"
              maxLength={200}
            />
            <span className="bc-char">{subject.length}/200</span>
          </div>

          {/* Body */}
          <div className="bc-field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="bc-label">Message Body *</label>
              <button
                onClick={() => setPreview(!preview)}
                className="bc-preview-toggle"
              >
                <Eye size={12} />
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div className="bc-preview-box" dangerouslySetInnerHTML={{
                __html: body.replace(/\n/g, '<br/>'),
              }} />
            ) : (
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Write the message that tenants will see in their dashboard…"
                className="bc-textarea"
                rows={7}
                maxLength={5000}
              />
            )}
            <span className="bc-char">{body.length}/5000</span>
          </div>

          {/* Recipients */}
          <div className="bc-field">
            <label className="bc-label">Recipients</label>
            <div className="bc-recipient-tabs">
              {[
                { value: 'all',      label: 'All Tenants' },
                { value: 'by_plan',  label: 'By Plan' },
                { value: 'by_status', label: 'By Status' },
              ].map(r => (
                <button
                  key={r.value}
                  onClick={() => setRecipientType(r.value)}
                  className={`bc-rtab ${recipientType === r.value ? 'bc-rtab--active' : ''}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {recipientType === 'by_plan' && (
              <div className="bc-plan-chips">
                {PLANS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePlan(p)}
                    className={`bc-chip ${selectedPlans.includes(p) ? 'bc-chip--active' : ''}`}
                  >
                    {selectedPlans.includes(p) && <CheckCircle2 size={11} />}
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            )}
            {recipientType === 'by_status' && (
              <div className="bc-plan-chips">
                {['active', 'trial', 'grace', 'expired'].map(s => (
                  <button
                    key={s}
                    onClick={() => togglePlan(s)}
                    className={`bc-chip ${selectedPlans.includes(s) ? 'bc-chip--active' : ''}`}
                  >
                    {selectedPlans.includes(s) && <CheckCircle2 size={11} />}
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Channels */}
          <div className="bc-field">
            <label className="bc-label">Delivery Channels</label>
            <div className="bc-plan-chips">
              {[
                { value: 'in_app', label: 'In-App', note: '' },
                { value: 'email',  label: 'Email',  note: '(plug-in your provider)' },
                { value: 'sms',    label: 'SMS',    note: '(plug-in your provider)' },
              ].map(ch => (
                <button
                  key={ch.value}
                  onClick={() => toggleChannel(ch.value)}
                  className={`bc-chip ${channels.includes(ch.value) ? 'bc-chip--active' : ''}`}
                >
                  {channels.includes(ch.value) && <CheckCircle2 size={11} />}
                  {ch.label}
                  {ch.note && <span className="bc-chip-note">{ch.note}</span>}
                </button>
              ))}
            </div>
            {(channels.includes('email') || channels.includes('sms')) && (
              <div className="bc-channel-hint">
                <Bell size={12} />
                Email / SMS delivery requires a provider integration. Add your webhook in Settings → Developer.
              </div>
            )}
          </div>

          {error && <p className="bc-error">{error}</p>}
        </div>

        <div className="bc-compose__foot">
          <button onClick={onClose} className="bc-cancel">Cancel</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="bc-send-meta">
              <TypeIcon size={13} style={{ color: ti.color }} />
              <span>{ti.label}</span>
              <span>·</span>
              <span>
                {recipientType === 'all' ? 'All Tenants'
                  : recipientType === 'by_plan' ? `Plans: ${selectedPlans.join(', ') || '—'}`
                  : `Status: ${selectedPlans.join(', ') || '—'}`}
              </span>
            </div>
            <button
              onClick={() => send.mutate()}
              disabled={send.isPending || !subject.trim() || !body.trim()}
              className="bc-send-btn"
            >
              <Send size={14} />
              {send.isPending ? 'Sending…' : 'Send Broadcast'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Broadcast Row ────────────────────────────────────────────────────────────

function BroadcastRow({ b }: { b: Broadcast }) {
  const [expanded, setExpanded] = useState(false)
  const ti = typeInfo(b.type)
  const TypeIcon = ti.icon
  const sc = STATUS_COLORS[b.status] ?? STATUS_COLORS.draft

  return (
    <div className="bc-row">
      <div className="bc-row__main" onClick={() => setExpanded(e => !e)}>
        {/* Type icon */}
        <div className="bc-row__icon" style={{ background: ti.bg }}>
          <TypeIcon size={15} style={{ color: ti.color }} />
        </div>

        {/* Content */}
        <div className="bc-row__content">
          <div className="bc-row__subject">{b.subject}</div>
          <div className="bc-row__meta">
            <span style={{ color: ti.color, fontSize: '.72rem', fontWeight: 600 }}>
              {ti.label}
            </span>
            <span className="bc-dot">·</span>
            <Users size={11} />
            <span>{b.recipient_count.toLocaleString()} recipients</span>
            <span className="bc-dot">·</span>
            <span>{b.channels.join(' + ')}</span>
          </div>
        </div>

        {/* Status + date */}
        <div className="bc-row__right">
          <span className="bc-status-badge" style={{ background: sc.bg, color: sc.text }}>
            {b.status === 'sent' ? <Send size={10} />
              : b.status === 'scheduled' ? <Clock size={10} />
              : <FileText size={10} />}
            {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
          </span>
          <span className="bc-row__date">
            {b.sent_at
              ? format(new Date(b.sent_at), 'MMM d, yyyy HH:mm')
              : format(new Date(b.created_at), 'MMM d, yyyy')}
          </span>
          {expanded ? <ChevronUp size={14} className="bc-chevron" /> : <ChevronDown size={14} className="bc-chevron" />}
        </div>
      </div>

      {expanded && (
        <div className="bc-row__body">
          <div className="bc-row__body-text">{b.body}</div>
          <div className="bc-row__body-meta">
            <span>Recipients: <strong>
              {b.recipient_type === 'all' ? 'All Tenants'
                : b.recipient_type === 'by_plan' ? `Plans: ${b.recipient_plans?.join(', ')}`
                : b.recipient_type}
            </strong></span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ARCBroadcastPage() {
  const [showCompose, setShowCompose] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [sent, setSent] = useState(false)

  const { data: broadcasts = [], isLoading } = useQuery<Broadcast[]>({
    queryKey: ['arc-broadcasts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('arc_broadcasts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
  })

  const filtered = broadcasts.filter(b => {
    if (filterType   !== 'all' && b.type   !== filterType)   return false
    if (filterStatus !== 'all' && b.status !== filterStatus) return false
    return true
  })

  const totalReached  = broadcasts.filter(b => b.status === 'sent').reduce((s, b) => s + b.recipient_count, 0)
  const thisMonthSent = broadcasts.filter(b => {
    return b.status === 'sent' && new Date(b.sent_at!).getMonth() === new Date().getMonth()
  }).length

  return (
    <div className="bc-page">
      {/* Header */}
      <div className="bc-header">
        <div>
          <h1 className="bc-title">Broadcast Center</h1>
          <p className="bc-sub">Send announcements and alerts to all tenants or specific segments</p>
        </div>
        <button onClick={() => { setShowCompose(true); setSent(false) }} className="bc-compose-btn">
          <Plus size={15} />
          New Broadcast
        </button>
      </div>

      {/* Success banner */}
      {sent && (
        <div className="bc-success-banner">
          <CheckCircle2 size={16} />
          Broadcast sent successfully! Tenants can now see it in their dashboard.
          <button onClick={() => setSent(false)} className="bc-success-close"><X size={13} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="bc-stats">
        {[
          { label: 'Total Broadcasts', value: broadcasts.length,                              icon: Radio },
          { label: 'Sent This Month',  value: thisMonthSent,                                  icon: Send },
          { label: 'Total Reached',    value: totalReached.toLocaleString(), icon: Users },
          { label: 'Drafts',           value: broadcasts.filter(b => b.status === 'draft').length, icon: FileText },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bc-stat">
              <div className="bc-stat__icon"><Icon size={16} /></div>
              <div>
                <div className="bc-stat__val">{s.value}</div>
                <div className="bc-stat__label">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="bc-filters">
        <div className="bc-filter-group">
          <span className="bc-filter-label">Type:</span>
          <div className="bc-filter-tabs">
            {['all', ...MSG_TYPES.map(t => t.value)].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`bc-ftab ${filterType === t ? 'bc-ftab--active' : ''}`}
              >
                {t === 'all' ? 'All' : MSG_TYPES.find(m => m.value === t)?.label ?? t}
              </button>
            ))}
          </div>
        </div>
        <div className="bc-filter-group">
          <span className="bc-filter-label">Status:</span>
          <div className="bc-filter-tabs">
            {['all', 'sent', 'draft', 'scheduled'].map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`bc-ftab ${filterStatus === s ? 'bc-ftab--active' : ''}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Broadcast list */}
      <div className="bc-list-card">
        {isLoading ? (
          <div className="bc-empty">
            <div className="bc-spinner" />
            <p>Loading broadcasts…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bc-empty">
            <Megaphone size={40} strokeWidth={1.2} />
            <p>{broadcasts.length === 0 ? 'No broadcasts yet' : 'No broadcasts match filters'}</p>
            {broadcasts.length === 0 && (
              <button onClick={() => setShowCompose(true)} className="bc-empty-cta">
                <Plus size={14} /> Send your first broadcast
              </button>
            )}
          </div>
        ) : (
          <div className="bc-list">
            <div className="bc-list__head">
              <span>{filtered.length} broadcast{filtered.length !== 1 ? 's' : ''}</span>
            </div>
            {filtered.map(b => <BroadcastRow key={b.id} b={b} />)}
          </div>
        )}
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={() => { setShowCompose(false); setSent(true) }}
        />
      )}

      <style>{`
        .bc-page { display:flex; flex-direction:column; gap:20px; }
        .bc-header { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; }
        .bc-title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .bc-sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }
        .bc-compose-btn { display:flex; align-items:center; gap:7px; background:var(--color-primary); color:#fff; border:none; border-radius:10px; padding:10px 18px; font-weight:700; font-size:.875rem; cursor:pointer; transition:opacity 120ms; white-space:nowrap; }
        .bc-compose-btn:hover { opacity:.88; }

        .bc-success-banner { display:flex; align-items:center; gap:10px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.25); color:#22c55e; padding:12px 16px; border-radius:10px; font-size:.875rem; font-weight:500; }
        .bc-success-close { margin-left:auto; background:none; border:none; cursor:pointer; color:#22c55e; display:flex; }

        .bc-stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:14px; }
        .bc-stat { background:var(--color-surface); border:1px solid var(--color-border); border-radius:14px; padding:16px; display:flex; align-items:center; gap:12px; }
        .bc-stat__icon { width:38px; height:38px; border-radius:10px; background:var(--color-bg); display:flex; align-items:center; justify-content:center; color:var(--color-primary); flex-shrink:0; }
        .bc-stat__val { font-size:1.35rem; font-weight:800; color:var(--color-text); font-family:var(--font-heading); }
        .bc-stat__label { font-size:.72rem; color:var(--color-text-muted); font-weight:500; margin-top:2px; }

        .bc-filters { display:flex; flex-wrap:wrap; gap:16px; }
        .bc-filter-group { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .bc-filter-label { font-size:.72rem; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; }
        .bc-filter-tabs { display:flex; gap:4px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; padding:3px; }
        .bc-ftab { padding:5px 11px; border-radius:6px; font-size:.75rem; font-weight:600; color:var(--color-text-secondary); transition:all 100ms; white-space:nowrap; }
        .bc-ftab--active { background:var(--color-primary); color:#fff; }

        .bc-list-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; overflow:hidden; min-height:200px; }
        .bc-list__head { padding:12px 16px; font-size:.78rem; color:var(--color-text-muted); border-bottom:1px solid var(--color-border); }
        .bc-list { }
        .bc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:64px 24px; color:var(--color-text-muted); }
        .bc-empty p { font-size:.95rem; font-weight:600; color:var(--color-text); margin:0; }
        .bc-empty-cta { display:flex; align-items:center; gap:6px; background:var(--color-primary); color:#fff; border:none; border-radius:8px; padding:9px 16px; font-weight:700; font-size:.82rem; cursor:pointer; margin-top:4px; }
        .bc-spinner { width:32px; height:32px; border:3px solid var(--color-border); border-top-color:var(--color-primary); border-radius:50%; animation:spin .8s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }

        /* Broadcast row */
        .bc-row { border-bottom:1px solid var(--color-border); }
        .bc-row:last-child { border-bottom:none; }
        .bc-row__main { display:flex; align-items:center; gap:14px; padding:14px 16px; cursor:pointer; transition:background 120ms; }
        .bc-row__main:hover { background:var(--color-bg); }
        .bc-row__icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .bc-row__content { flex:1; min-width:0; }
        .bc-row__subject { font-weight:600; font-size:.9rem; color:var(--color-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .bc-row__meta { display:flex; align-items:center; gap:6px; margin-top:3px; color:var(--color-text-muted); font-size:.75rem; }
        .bc-dot { opacity:.4; }
        .bc-row__right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .bc-row__date { font-size:.75rem; color:var(--color-text-muted); white-space:nowrap; }
        .bc-status-badge { display:inline-flex; align-items:center; gap:5px; font-size:.68rem; font-weight:700; padding:3px 9px; border-radius:999px; text-transform:uppercase; letter-spacing:.03em; white-space:nowrap; }
        .bc-chevron { color:var(--color-text-muted); }
        .bc-row__body { padding:0 16px 16px 66px; }
        .bc-row__body-text { font-size:.875rem; color:var(--color-text); line-height:1.6; white-space:pre-wrap; background:var(--color-bg); border-radius:10px; padding:14px; border:1px solid var(--color-border); margin-bottom:10px; }
        .bc-row__body-meta { font-size:.75rem; color:var(--color-text-muted); }

        /* Compose modal */
        .bc-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:200; display:flex; align-items:center; justify-content:center; padding:16px; }
        .bc-compose { background:var(--color-surface); border-radius:20px; border:1px solid var(--color-border); width:100%; max-width:640px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,.35); }
        .bc-compose__head { display:flex; align-items:center; justify-content:space-between; padding:18px 20px; border-bottom:1px solid var(--color-border); flex-shrink:0; }
        .bc-close { background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; width:30px; height:30px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--color-text-muted); }
        .bc-compose__body { flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:18px; }
        .bc-compose__foot { padding:16px 20px; border-top:1px solid var(--color-border); display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; flex-shrink:0; }

        .bc-field { display:flex; flex-direction:column; gap:7px; }
        .bc-label { font-size:.78rem; font-weight:700; color:var(--color-text-secondary); }
        .bc-input { padding:9px 12px; border:1.5px solid var(--color-border); border-radius:9px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; }
        .bc-input:focus { border-color:var(--color-primary); }
        .bc-textarea { padding:10px 12px; border:1.5px solid var(--color-border); border-radius:9px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; resize:vertical; font-family:inherit; line-height:1.5; }
        .bc-textarea:focus { border-color:var(--color-primary); }
        .bc-char { font-size:.68rem; color:var(--color-text-muted); text-align:right; }
        .bc-preview-box { background:var(--color-bg); border:1px solid var(--color-border); border-radius:9px; padding:12px 14px; font-size:.875rem; color:var(--color-text); line-height:1.6; min-height:120px; }
        .bc-preview-toggle { display:flex; align-items:center; gap:5px; background:none; border:1px solid var(--color-border); border-radius:6px; padding:4px 10px; font-size:.72rem; font-weight:600; color:var(--color-text-muted); cursor:pointer; }

        .bc-type-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(110px,1fr)); gap:8px; }
        .bc-type-btn { display:flex; align-items:center; gap:7px; padding:9px 12px; border:1.5px solid var(--color-border); border-radius:9px; background:var(--color-bg); color:var(--color-text-secondary); font-size:.8rem; font-weight:600; cursor:pointer; transition:all 120ms; }
        .bc-type-btn--active { color:var(--color-text); }

        .bc-recipient-tabs { display:flex; gap:4px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; padding:3px; }
        .bc-rtab { flex:1; padding:7px 10px; border-radius:6px; font-size:.78rem; font-weight:600; color:var(--color-text-secondary); text-align:center; cursor:pointer; transition:all 100ms; }
        .bc-rtab--active { background:var(--color-primary); color:#fff; }

        .bc-plan-chips { display:flex; flex-wrap:wrap; gap:7px; margin-top:4px; }
        .bc-chip { display:flex; align-items:center; gap:5px; padding:6px 13px; border:1.5px solid var(--color-border); border-radius:999px; font-size:.78rem; font-weight:600; color:var(--color-text-secondary); cursor:pointer; transition:all 100ms; }
        .bc-chip--active { border-color:var(--color-primary); background:rgba(var(--color-primary-rgb),0.1); color:var(--color-primary); }
        .bc-chip-note { font-size:.65rem; font-weight:400; color:var(--color-text-muted); }

        .bc-channel-hint { display:flex; align-items:center; gap:7px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; padding:8px 12px; font-size:.75rem; color:var(--color-text-muted); margin-top:4px; }

        .bc-send-meta { display:flex; align-items:center; gap:6px; font-size:.75rem; color:var(--color-text-muted); }
        .bc-send-btn { display:flex; align-items:center; gap:7px; background:var(--color-primary); color:#fff; border:none; border-radius:9px; padding:10px 18px; font-weight:700; font-size:.875rem; cursor:pointer; transition:opacity 120ms; }
        .bc-send-btn:disabled { opacity:.5; cursor:not-allowed; }
        .bc-cancel { background:var(--color-bg); border:1px solid var(--color-border); border-radius:9px; padding:10px 16px; font-size:.875rem; font-weight:600; color:var(--color-text-secondary); cursor:pointer; }
        .bc-error { font-size:.82rem; color:var(--color-error); background:var(--color-error-bg); padding:8px 12px; border-radius:8px; margin:0; }
      `}</style>
    </div>
  )
}
