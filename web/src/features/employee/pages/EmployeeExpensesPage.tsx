import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet, Plus, CheckCircle2, XCircle, Clock, AlertTriangle,
  Paperclip, X, Image, FileText, ExternalLink, Upload,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useStaffSession } from '@/features/staff/store/staffSessionStore'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

function fmt(n: number) { return 'TZS ' + n.toLocaleString('en-TZ') }

const CATEGORIES = [
  'Transport', 'Food & Drinks', 'Office Supplies', 'Cleaning',
  'Communication', 'Repairs', 'Utilities', 'Other',
]

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,image/heic,application/pdf'

type Expense = {
  id: string; amount: number; category: string; description: string
  notes?: string | null; status: string; created_at: string
  reviewed_at?: string | null; receipt_path?: string | null
}

// ─── Receipt viewer — generates a short-lived signed URL on demand ────────────

function ReceiptLink({ path }: { path: string }) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    try {
      const { data, error } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(path, 60 * 60) // 1 hour
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener')
    } catch {
      alert('Could not open receipt. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isPdf = path.toLowerCase().endsWith('.pdf')
  return (
    <button onClick={open} disabled={loading} className="ex-receipt-link">
      {isPdf ? <FileText size={12} /> : <Image size={12} />}
      {loading ? 'Opening…' : 'View Receipt'}
      <ExternalLink size={10} />
    </button>
  )
}

// ─── File picker / drop zone ──────────────────────────────────────────────────

function FilePicker({
  file, onFile, onClear,
}: { file: File | null; onFile: (f: File) => void; onClear: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [err, setErr] = useState('')

  function validate(f: File): boolean {
    if (f.size > MAX_FILE_BYTES) { setErr('File too large (max 10 MB)'); return false }
    const ok = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
    if (!ok.includes(f.type)) { setErr('Unsupported file type'); return false }
    setErr('')
    return true
  }

  function pick(f: File) { if (validate(f)) onFile(f) }

  const preview = file && file.type.startsWith('image/')
    ? URL.createObjectURL(file) : null

  if (file) {
    return (
      <div className="ex-file-preview">
        {preview
          ? <img src={preview} alt="receipt preview" className="ex-file-img" />
          : <div className="ex-file-pdf"><FileText size={28} /><span>{file.name}</span></div>
        }
        <button onClick={onClear} className="ex-file-clear" title="Remove">
          <X size={14} />
        </button>
        <div className="ex-file-name">{file.name} · {(file.size / 1024).toFixed(0)} KB</div>
      </div>
    )
  }

  return (
    <div
      className={`ex-dropzone ${drag ? 'ex-dropzone--over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f) pick(f)
      }}
    >
      <Upload size={22} className="ex-dropzone__icon" />
      <span className="ex-dropzone__main">Click or drag to attach receipt</span>
      <span className="ex-dropzone__sub">JPG, PNG, WEBP, HEIC or PDF · Max 10 MB</span>
      {err && <span className="ex-dropzone__err">{err}</span>}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) pick(f) }}
      />
    </div>
  )
}

// ─── Submit Modal ─────────────────────────────────────────────────────────────

function SubmitModal({ shopId, staffId, onClose, onSubmitted }: {
  shopId: string; staffId: string; onClose: () => void; onSubmitted: () => void
}) {
  const [amount, setAmount]         = useState('')
  const [category, setCategory]     = useState(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [notes, setNotes]           = useState('')
  const [file, setFile]             = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [error, setError]           = useState('')
  const qc = useQueryClient()

  const submit = useMutation({
    mutationFn: async () => {
      if (!amount || parseFloat(amount) <= 0) throw new Error('Enter a valid amount')
      if (!description.trim()) throw new Error('Description is required')

      let receiptPath: string | null = null

      // 1. Upload file if attached
      if (file) {
        setUploadProgress('Uploading receipt…')
        const ext  = file.name.split('.').pop() ?? 'jpg'
        const path = `${shopId}/${staffId}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('expense-receipts')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        receiptPath = path
        setUploadProgress('Saving expense…')
      }

      // 2. Submit expense via RPC
      const { error } = await supabase.rpc('rpc_submit_expense', {
        p_staff_id:     staffId,
        p_shop_id:      shopId,
        p_amount:       parseFloat(amount),
        p_category:     category,
        p_description:  description.trim(),
        p_notes:        notes.trim() || null,
        p_receipt_path: receiptPath,
      })
      if (error) {
        // Clean up uploaded file on RPC failure
        if (receiptPath) {
          await supabase.storage.from('expense-receipts').remove([receiptPath])
        }
        throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-expense-submissions'] })
      onSubmitted()
    },
    onError: (e: Error) => { setError(e.message); setUploadProgress('') },
  })

  return (
    <div className="ex-overlay">
      <div className="ex-modal">
        <div className="ex-modal__head">
          <Wallet size={18} className="ex-modal__icon" />
          <h2>Submit Expense</h2>
          <button onClick={onClose} className="ex-modal__close"><X size={15} /></button>
        </div>
        <div className="ex-modal__body">
          <div className="ex-info-box">
            <AlertTriangle size={14} />
            <span>Expenses will be reviewed by the owner before being recorded.</span>
          </div>

          <label className="ex-label">
            Amount (TZS) *
            <input type="number" min="0" step="100" value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 5000" className="ex-input" autoFocus />
          </label>

          <label className="ex-label">
            Category *
            <select value={category} onChange={e => setCategory(e.target.value)} className="ex-select">
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>

          <label className="ex-label">
            Description *
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the expense" className="ex-input" maxLength={200} />
          </label>

          <label className="ex-label">
            Additional Notes
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any supporting details or reason…" className="ex-textarea" rows={2} />
          </label>

          {/* Receipt attachment */}
          <div className="ex-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Paperclip size={13} /> Receipt / Proof (optional)
            </span>
            <FilePicker file={file} onFile={setFile} onClear={() => setFile(null)} />
          </div>

          {uploadProgress && (
            <div className="ex-upload-progress">
              <div className="ex-upload-spinner" />
              {uploadProgress}
            </div>
          )}

          {error && <p className="ex-error">{error}</p>}
        </div>
        <div className="ex-modal__foot">
          <button onClick={onClose} className="ex-cancel" disabled={submit.isPending}>Cancel</button>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="ex-submit"
          >
            {submit.isPending
              ? <><div className="ex-btn-spinner" />{uploadProgress || 'Submitting…'}</>
              : <><Plus size={14} />Submit for Approval</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status icons ─────────────────────────────────────────────────────────────

const STATUS_ICON = {
  pending:  <Clock size={14} />,
  approved: <CheckCircle2 size={14} />,
  rejected: <XCircle size={14} />,
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function EmployeeExpensesPage() {
  const { user }                  = useAuth()
  const { data: shop }            = useShop(user?.id)
  const { activeStaffId }         = useStaffSession()
  const shopId                    = shop?.id
  const [showModal, setShowModal] = useState(false)

  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['emp-expense-submissions', activeStaffId],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_expense_submissions')
        .select('id, amount, category, description, notes, status, created_at, reviewed_at, receipt_path')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const pending      = expenses.filter(e => e.status === 'pending')
  const approved     = expenses.filter(e => e.status === 'approved')
  const rejected     = expenses.filter(e => e.status === 'rejected')
  const pendingTotal = pending.reduce((s, e) => s + e.amount, 0)
  const approvedTotal = approved.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="ex-page">
      <div className="ex-head">
        <div>
          <h1 className="ex-title">My Expenses</h1>
          <p className="ex-sub">Submit expenses for owner approval</p>
        </div>
        <button onClick={() => setShowModal(true)} className="ex-new-btn">
          <Plus size={16} /> Submit Expense
        </button>
      </div>

      {/* Summary */}
      <div className="ex-summary">
        <div className="ex-sum-card ex-sum-card--warning">
          <Clock size={18} />
          <div>
            <span className="ex-sum-val">{pending.length}</span>
            <span className="ex-sum-lbl">Pending ({fmt(pendingTotal)})</span>
          </div>
        </div>
        <div className="ex-sum-card ex-sum-card--success">
          <CheckCircle2 size={18} />
          <div>
            <span className="ex-sum-val">{approved.length}</span>
            <span className="ex-sum-lbl">Approved ({fmt(approvedTotal)})</span>
          </div>
        </div>
        <div className="ex-sum-card ex-sum-card--error">
          <XCircle size={18} />
          <div>
            <span className="ex-sum-val">{rejected.length}</span>
            <span className="ex-sum-lbl">Rejected</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="ex-list-card">
        <div className="ex-list-head">
          <h2 className="ex-list-title">All Submissions ({expenses.length})</h2>
        </div>

        {isLoading ? (
          <p className="ex-empty">Loading…</p>
        ) : expenses.length === 0 ? (
          <div className="ex-empty-state">
            <Wallet size={36} />
            <p>No expenses submitted yet</p>
            <span>When you submit expenses, they'll appear here for tracking.</span>
            <button onClick={() => setShowModal(true)} className="ex-new-btn" style={{ marginTop: 12 }}>
              <Plus size={14} /> Submit Your First Expense
            </button>
          </div>
        ) : (
          <div className="ex-rows">
            {expenses.map(e => (
              <div key={e.id} className="ex-row">
                <div className={`ex-row__status ex-row__status--${e.status}`}>
                  {STATUS_ICON[e.status as keyof typeof STATUS_ICON]}
                </div>
                <div className="ex-row__body">
                  <span className="ex-row__desc">{e.description}</span>
                  <span className="ex-row__meta">
                    {e.category} · {new Date(e.created_at).toLocaleDateString('en-TZ', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {e.reviewed_at && ` · Reviewed ${new Date(e.reviewed_at).toLocaleDateString('en-TZ', {
                      day: 'numeric', month: 'short',
                    })}`}
                  </span>
                  {e.notes && <span className="ex-row__notes">{e.notes}</span>}
                  {e.receipt_path && <ReceiptLink path={e.receipt_path} />}
                </div>
                <div className="ex-row__right">
                  <span className="ex-row__amount">{fmt(e.amount)}</span>
                  <span className={`ex-badge ex-badge--${e.status}`}>{e.status}</span>
                </div>
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
        .ex-page { display:flex; flex-direction:column; gap:20px; }
        .ex-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .ex-title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .ex-sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }
        .ex-new-btn { display:flex; align-items:center; gap:8px; padding:10px 18px; background:var(--color-primary); color:#fff; border-radius:10px; font-weight:700; font-size:.875rem; transition:opacity 120ms; flex-shrink:0; }
        .ex-new-btn:hover { opacity:.9; }

        .ex-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        @media(max-width:480px){ .ex-summary{ grid-template-columns:1fr; } }
        .ex-sum-card { display:flex; align-items:center; gap:14px; padding:16px; border-radius:14px; border:1.5px solid; }
        .ex-sum-card--warning { background:var(--color-warning-bg); border-color:rgba(217,119,6,.3); color:var(--color-warning); }
        .ex-sum-card--success { background:var(--color-success-bg); border-color:rgba(22,163,74,.3); color:var(--color-success); }
        .ex-sum-card--error   { background:var(--color-error-bg);   border-color:rgba(220,38,38,.3);  color:var(--color-error); }
        .ex-sum-val { font-size:1.4rem; font-weight:800; font-family:var(--font-heading); display:block; color:var(--color-text); }
        .ex-sum-lbl { font-size:.72rem; display:block; margin-top:1px; color:var(--color-text-secondary); }

        .ex-list-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; overflow:hidden; }
        .ex-list-head { padding:16px 20px; border-bottom:1px solid var(--color-border); }
        .ex-list-title { font-weight:700; font-size:.95rem; margin:0; color:var(--color-text); }
        .ex-empty { padding:32px; text-align:center; color:var(--color-text-muted); font-size:.875rem; margin:0; }
        .ex-empty-state { padding:40px 20px; display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; color:var(--color-text-muted); }
        .ex-empty-state p { font-weight:700; font-size:.95rem; color:var(--color-text); margin:0; }
        .ex-empty-state span { font-size:.82rem; }

        .ex-rows { display:flex; flex-direction:column; }
        .ex-row { display:flex; align-items:flex-start; gap:14px; padding:14px 20px; border-bottom:1px solid var(--color-border); transition:background 120ms; }
        .ex-row:last-child { border-bottom:none; }
        .ex-row:hover { background:var(--color-bg); }
        .ex-row__status { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
        .ex-row__status--pending  { background:var(--color-warning-bg); color:var(--color-warning); }
        .ex-row__status--approved { background:var(--color-success-bg); color:var(--color-success); }
        .ex-row__status--rejected { background:var(--color-error-bg);   color:var(--color-error); }
        .ex-row__body { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
        .ex-row__desc  { font-weight:600; font-size:.875rem; color:var(--color-text); }
        .ex-row__meta  { font-size:.75rem; color:var(--color-text-muted); }
        .ex-row__notes { font-size:.75rem; color:var(--color-text-secondary); font-style:italic; }
        .ex-row__right { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
        .ex-row__amount { font-weight:700; font-size:.95rem; color:var(--color-text); }
        .ex-badge { font-size:.68rem; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase; }
        .ex-badge--pending  { background:var(--color-warning-bg); color:var(--color-warning); }
        .ex-badge--approved { background:var(--color-success-bg); color:var(--color-success); }
        .ex-badge--rejected { background:var(--color-error-bg);   color:var(--color-error); }

        .ex-receipt-link { display:inline-flex; align-items:center; gap:5px; margin-top:4px; padding:3px 9px; border:1px solid var(--color-border); border-radius:6px; font-size:.72rem; font-weight:600; color:var(--color-text-secondary); background:var(--color-bg); cursor:pointer; transition:all 100ms; width:fit-content; }
        .ex-receipt-link:hover { border-color:var(--color-primary); color:var(--color-primary); }
        .ex-receipt-link:disabled { opacity:.6; cursor:wait; }

        /* Modal */
        .ex-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; z-index:300; }
        .ex-modal { background:var(--color-surface); border-radius:20px; width:100%; max-width:500px; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:var(--shadow-lg); }
        .ex-modal__head { display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid var(--color-border); flex-shrink:0; }
        .ex-modal__head h2 { font-size:1rem; font-weight:700; margin:0; color:var(--color-text); flex:1; }
        .ex-modal__icon { color:var(--color-primary); flex-shrink:0; }
        .ex-modal__close { background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; width:28px; height:28px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--color-text-muted); flex-shrink:0; }
        .ex-modal__body { padding:20px; display:flex; flex-direction:column; gap:14px; overflow-y:auto; flex:1; }
        .ex-modal__foot { display:flex; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid var(--color-border); flex-shrink:0; }

        .ex-info-box { display:flex; align-items:center; gap:10px; background:var(--color-warning-bg); color:var(--color-warning); padding:10px 14px; border-radius:10px; font-size:.82rem; }
        .ex-label { display:flex; flex-direction:column; gap:6px; font-size:.82rem; font-weight:600; color:var(--color-text-secondary); }
        .ex-input { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.95rem; outline:none; }
        .ex-input:focus { border-color:var(--color-primary); }
        .ex-select { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; }
        .ex-textarea { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; resize:vertical; }

        /* Drop zone */
        .ex-dropzone { border:2px dashed var(--color-border); border-radius:12px; padding:20px 16px; display:flex; flex-direction:column; align-items:center; gap:6px; cursor:pointer; transition:all 120ms; text-align:center; background:var(--color-bg); }
        .ex-dropzone:hover, .ex-dropzone--over { border-color:var(--color-primary); background:rgba(var(--color-primary-rgb),.04); }
        .ex-dropzone__icon { color:var(--color-text-muted); }
        .ex-dropzone__main { font-size:.875rem; font-weight:600; color:var(--color-text-secondary); }
        .ex-dropzone__sub  { font-size:.72rem; color:var(--color-text-muted); }
        .ex-dropzone__err  { font-size:.75rem; color:var(--color-error); font-weight:600; }

        /* File preview */
        .ex-file-preview { position:relative; border:1.5px solid var(--color-border); border-radius:12px; overflow:hidden; background:var(--color-bg); }
        .ex-file-img { width:100%; max-height:160px; object-fit:cover; display:block; }
        .ex-file-pdf { display:flex; flex-direction:column; align-items:center; gap:8px; padding:20px; color:var(--color-text-muted); }
        .ex-file-pdf span { font-size:.78rem; word-break:break-all; text-align:center; }
        .ex-file-clear { position:absolute; top:8px; right:8px; background:rgba(0,0,0,.6); color:#fff; border:none; border-radius:6px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .ex-file-name { padding:6px 12px; font-size:.72rem; color:var(--color-text-muted); border-top:1px solid var(--color-border); }

        /* Upload progress */
        .ex-upload-progress { display:flex; align-items:center; gap:10px; font-size:.82rem; color:var(--color-text-secondary); padding:8px 12px; background:var(--color-bg); border-radius:8px; border:1px solid var(--color-border); }
        .ex-upload-spinner { width:14px; height:14px; border:2px solid var(--color-border); border-top-color:var(--color-primary); border-radius:50%; animation:spin .7s linear infinite; flex-shrink:0; }
        @keyframes spin { to { transform:rotate(360deg); } }

        .ex-error { background:var(--color-error-bg); color:var(--color-error); padding:8px 12px; border-radius:8px; font-size:.82rem; margin:0; }
        .ex-cancel { padding:10px 18px; border:1.5px solid var(--color-border); border-radius:10px; font-weight:600; color:var(--color-text-secondary); font-size:.875rem; }
        .ex-submit { display:flex; align-items:center; gap:6px; padding:10px 20px; background:var(--color-primary); color:#fff; border-radius:10px; font-weight:700; font-size:.875rem; min-width:160px; justify-content:center; }
        .ex-submit:disabled { opacity:.6; cursor:not-allowed; }
        .ex-btn-spinner { width:13px; height:13px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:spin .7s linear infinite; }
      `}</style>
    </div>
  )
}
