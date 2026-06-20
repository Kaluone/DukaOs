import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Plus, AlertTriangle, Info, CheckCircle2,
  XCircle, Clock, MessageSquare,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useStaffSession } from '@/features/staff/store/staffSessionStore'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

type Report = {
  id: string; title: string; description: string; category: string
  severity: string; status: string; review_notes?: string | null
  reviewed_at?: string | null; created_at: string; report_date: string
}

const CATEGORIES = [
  { value: 'general', label: 'General Observation' },
  { value: 'observation', label: 'Workplace Observation' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'incident', label: 'Incident / Problem' },
  { value: 'lost_receipt', label: 'Lost Receipt' },
  { value: 'stock_issue', label: 'Stock Issue' },
  { value: 'other', label: 'Other' },
]

const SEVERITIES = [
  { value: 'low', label: 'Low', desc: 'Minor, informational' },
  { value: 'medium', label: 'Medium', desc: 'Needs attention soon' },
  { value: 'high', label: 'High', desc: 'Urgent, needs quick action' },
  { value: 'urgent', label: 'Urgent', desc: 'Critical, immediate action required' },
]

function SubmitModal({ shopId, staffId, onClose, onSubmitted }: {
  shopId: string; staffId: string; onClose: () => void; onSubmitted: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [severity, setSeverity] = useState('low')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const submit = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title is required')
      if (!description.trim()) throw new Error('Description is required')
      const { error } = await supabase.rpc('rpc_submit_report', {
        p_staff_id:    staffId,
        p_shop_id:     shopId,
        p_title:       title.trim(),
        p_description: description.trim(),
        p_category:    category,
        p_severity:    severity,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-daily-reports'] })
      onSubmitted()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="rp-overlay">
      <div className="rp-modal">
        <div className="rp-modal__head">
          <FileText size={18} className="rp-modal__icon" />
          <h2>Write Daily Report</h2>
        </div>
        <div className="rp-modal__body">
          <div className="rp-info">
            <Info size={14} />
            <span>Reports are reviewed by the owner. Use this to share observations, complaints, or incidents.</span>
          </div>
          <label className="rp-label">
            Report Title *
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Brief title for your report" className="rp-input" maxLength={120} autoFocus />
          </label>
          <div className="rp-row2">
            <label className="rp-label">
              Category *
              <select value={category} onChange={e => setCategory(e.target.value)} className="rp-select">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="rp-label">
              Severity *
              <select value={severity} onChange={e => setSeverity(e.target.value)} className={`rp-select rp-select--sev rp-select--${severity}`}>
                {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label} — {s.desc}</option>)}
              </select>
            </label>
          </div>
          <label className="rp-label">
            Description *
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Describe the situation in detail. Include time, location, people involved, and what happened…"
              className="rp-textarea" rows={5} maxLength={2000} />
            <span className="rp-char">{description.length}/2000</span>
          </label>
          {error && <p className="rp-error">{error}</p>}
        </div>
        <div className="rp-modal__foot">
          <button onClick={onClose} className="rp-cancel">Cancel</button>
          <button onClick={() => submit.mutate()} disabled={submit.isPending} className="rp-submit">
            <Plus size={14} />
            {submit.isPending ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_ICON = {
  pending: <Clock size={14} />,
  read: <CheckCircle2 size={14} />,
  resolved: <CheckCircle2 size={14} />,
  dismissed: <XCircle size={14} />,
}
const SEV_COLORS: Record<string, string> = {
  low: 'var(--color-success)', medium: 'var(--color-warning)',
  high: 'var(--color-error)', urgent: '#7c3aed',
}

export function EmployeeReportPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const { activeStaffId } = useStaffSession()
  const shopId = shop?.id
  const [showModal, setShowModal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ['emp-daily-reports', activeStaffId],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_daily_reports')
        .select('id, title, description, category, severity, status, review_notes, reviewed_at, created_at, report_date')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const pending = reports.filter(r => r.status === 'pending').length
  const resolved = reports.filter(r => r.status === 'resolved').length

  return (
    <div className="rp-page">
      <div className="rp-head">
        <div>
          <h1 className="rp-title">Daily Reports</h1>
          <p className="rp-sub">Share observations, incidents, and complaints with your manager</p>
        </div>
        <button onClick={() => setShowModal(true)} className="rp-new-btn">
          <Plus size={16} /> Write Report
        </button>
      </div>

      <div className="rp-summary">
        <div className="rp-sum-item"><span className="rp-sum-val">{reports.length}</span><span className="rp-sum-lbl">Total</span></div>
        <div className="rp-sum-item rp-sum-item--warning"><span className="rp-sum-val">{pending}</span><span className="rp-sum-lbl">Pending</span></div>
        <div className="rp-sum-item rp-sum-item--success"><span className="rp-sum-val">{resolved}</span><span className="rp-sum-lbl">Resolved</span></div>
      </div>

      <div className="rp-list-card">
        <div className="rp-list-head">
          <h2 className="rp-list-title">My Reports ({reports.length})</h2>
        </div>
        {isLoading ? (
          <p className="rp-empty">Loading…</p>
        ) : reports.length === 0 ? (
          <div className="rp-empty-state">
            <MessageSquare size={36} />
            <p>No reports submitted yet</p>
            <span>Use reports to inform your manager about observations, issues, or incidents.</span>
            <button onClick={() => setShowModal(true)} className="rp-new-btn" style={{marginTop:12}}>
              <Plus size={14} /> Write Your First Report
            </button>
          </div>
        ) : (
          <div className="rp-rows">
            {reports.map(r => (
              <div key={r.id} className="rp-row">
                <div className="rp-row__main" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div className="rp-row__sev" style={{ background: SEV_COLORS[r.severity] + '20', color: SEV_COLORS[r.severity] }}>
                    <AlertTriangle size={13} />
                    <span>{r.severity}</span>
                  </div>
                  <div className="rp-row__body">
                    <span className="rp-row__title">{r.title}</span>
                    <span className="rp-row__meta">
                      {CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}
                      {' · '}{new Date(r.created_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className={`rp-row__status rp-row__status--${r.status}`}>
                    {STATUS_ICON[r.status as keyof typeof STATUS_ICON]}
                    <span>{r.status}</span>
                  </div>
                </div>
                {expanded === r.id && (
                  <div className="rp-row__detail">
                    <p className="rp-row__desc">{r.description}</p>
                    {r.review_notes && (
                      <div className="rp-review-note">
                        <strong>Manager's Response:</strong>
                        <p>{r.review_notes}</p>
                        {r.reviewed_at && <span className="rp-review-date">Reviewed on {new Date(r.reviewed_at).toLocaleDateString('en-TZ', { day: 'numeric', month: 'short' })}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && shopId && activeStaffId && (
        <SubmitModal
          shopId={shopId} staffId={activeStaffId}
          onClose={() => setShowModal(false)}
          onSubmitted={() => setShowModal(false)}
        />
      )}

      <style>{`
        .rp-page { display:flex; flex-direction:column; gap:20px; }
        .rp-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .rp-title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .rp-sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }
        .rp-new-btn {
          display:flex; align-items:center; gap:8px; padding:10px 18px;
          background:var(--color-primary); color:#fff; border-radius:10px;
          font-weight:700; font-size:.875rem; transition:opacity 120ms; flex-shrink:0;
        }
        .rp-new-btn:hover { opacity:.9; }

        .rp-summary { display:flex; gap:20px; background:var(--color-surface); border:1px solid var(--color-border); border-radius:14px; padding:18px 24px; }
        .rp-sum-item { text-align:center; flex:1; }
        .rp-sum-item--warning .rp-sum-val { color:var(--color-warning); }
        .rp-sum-item--success .rp-sum-val { color:var(--color-success); }
        .rp-sum-val { display:block; font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); }
        .rp-sum-lbl { display:block; font-size:.75rem; color:var(--color-text-muted); margin-top:2px; }

        .rp-list-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; overflow:hidden; }
        .rp-list-head { padding:16px 20px; border-bottom:1px solid var(--color-border); }
        .rp-list-title { font-weight:700; font-size:.95rem; margin:0; color:var(--color-text); }
        .rp-empty { padding:32px; text-align:center; color:var(--color-text-muted); font-size:.875rem; margin:0; }
        .rp-empty-state { padding:40px 20px; display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; color:var(--color-text-muted); }
        .rp-empty-state p { font-weight:700; font-size:.95rem; color:var(--color-text); margin:0; }
        .rp-empty-state span { font-size:.82rem; }

        .rp-rows { display:flex; flex-direction:column; }
        .rp-row { border-bottom:1px solid var(--color-border); }
        .rp-row:last-child { border-bottom:none; }
        .rp-row__main { display:flex; align-items:center; gap:12px; padding:14px 20px; cursor:pointer; transition:background 120ms; }
        .rp-row__main:hover { background:var(--color-bg); }
        .rp-row__sev { display:flex; align-items:center; gap:5px; padding:4px 10px; border-radius:8px; font-size:.72rem; font-weight:700; text-transform:uppercase; flex-shrink:0; }
        .rp-row__body { flex:1; min-width:0; }
        .rp-row__title { display:block; font-weight:600; font-size:.875rem; color:var(--color-text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .rp-row__meta { display:block; font-size:.75rem; color:var(--color-text-muted); margin-top:2px; }
        .rp-row__status { display:flex; align-items:center; gap:5px; font-size:.72rem; font-weight:600; text-transform:uppercase; flex-shrink:0; }
        .rp-row__status--pending { color:var(--color-warning); }
        .rp-row__status--read { color:var(--color-info); }
        .rp-row__status--resolved { color:var(--color-success); }
        .rp-row__status--dismissed { color:var(--color-text-muted); }

        .rp-row__detail { padding:14px 20px; background:var(--color-bg); border-top:1px solid var(--color-border); }
        .rp-row__desc { font-size:.875rem; color:var(--color-text-secondary); margin:0 0 12px; white-space:pre-wrap; }
        .rp-review-note { background:var(--color-primary-light); border:1px solid var(--color-primary); border-radius:10px; padding:12px 14px; font-size:.82rem; }
        .rp-review-note strong { color:var(--color-primary); display:block; margin-bottom:6px; }
        .rp-review-note p { color:var(--color-text); margin:0; }
        .rp-review-date { display:block; font-size:.72rem; color:var(--color-text-muted); margin-top:6px; }

        /* Modal */
        .rp-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; z-index:300; }
        .rp-modal { background:var(--color-surface); border-radius:20px; width:100%; max-width:560px; overflow:hidden; box-shadow:var(--shadow-lg); max-height:90vh; overflow-y:auto; }
        .rp-modal__head { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--color-border); position:sticky; top:0; background:var(--color-surface); z-index:1; }
        .rp-modal__head h2 { font-size:1rem; font-weight:700; margin:0; color:var(--color-text); }
        .rp-modal__icon { color:var(--color-primary); }
        .rp-modal__body { padding:20px; display:flex; flex-direction:column; gap:14px; }
        .rp-modal__foot { display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--color-border); position:sticky; bottom:0; background:var(--color-surface); }

        .rp-info { display:flex; align-items:center; gap:10px; background:var(--color-info-bg); color:var(--color-info); padding:10px 14px; border-radius:10px; font-size:.82rem; }
        .rp-label { display:flex; flex-direction:column; gap:6px; font-size:.82rem; font-weight:600; color:var(--color-text-secondary); position:relative; }
        .rp-row2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        @media(max-width:480px){ .rp-row2{ grid-template-columns:1fr; } }
        .rp-input { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; }
        .rp-input:focus { border-color:var(--color-primary); }
        .rp-select { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.82rem; outline:none; }
        .rp-textarea { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; resize:vertical; }
        .rp-textarea:focus { border-color:var(--color-primary); }
        .rp-char { position:absolute; right:0; bottom:-18px; font-size:.68rem; color:var(--color-text-muted); }
        .rp-error { background:var(--color-error-bg); color:var(--color-error); padding:8px 12px; border-radius:8px; font-size:.82rem; margin:0; }
        .rp-cancel { padding:10px 18px; border:1.5px solid var(--color-border); border-radius:10px; font-weight:600; color:var(--color-text-secondary); font-size:.875rem; }
        .rp-submit { display:flex; align-items:center; gap:6px; padding:10px 20px; background:var(--color-primary); color:#fff; border-radius:10px; font-weight:700; font-size:.875rem; }
        .rp-submit:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </div>
  )
}
