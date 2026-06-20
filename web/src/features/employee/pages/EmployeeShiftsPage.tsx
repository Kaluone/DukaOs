import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlayCircle, StopCircle, AlertTriangle,
  ChevronDown, ChevronUp, Plus,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useStaffSession } from '@/features/staff/store/staffSessionStore'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

function fmt(n: number) { return 'TZS ' + n.toLocaleString('en-TZ') }

function elapsed(from: string) {
  const mins = Math.floor((Date.now() - new Date(from).getTime()) / 60000)
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h}h ${m}m`
}

type Shift = {
  id: string; started_at: string; ended_at?: string | null
  opening_cash: number; counted_cash?: number | null
  cash_difference?: number | null; total_sales: number
  total_expenses: number; transactions_count: number
  status: string; closing_notes?: string | null; incidents?: string | null
  shift_date: string
}

function StartShiftModal({ shopId, staffId, onClose, onStarted }: {
  shopId: string; staffId: string; onClose: () => void; onStarted: () => void
}) {
  const [openingCash, setOpeningCash] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const start = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rpc_start_shift', {
        p_staff_id:     staffId,
        p_shop_id:      shopId,
        p_opening_cash: parseFloat(openingCash) || 0,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-active-shift'] })
      qc.invalidateQueries({ queryKey: ['emp-shifts'] })
      onStarted()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="sh-overlay">
      <div className="sh-modal">
        <div className="sh-modal__head">
          <PlayCircle size={20} className="sh-modal__icon" />
          <h2>Start New Shift</h2>
        </div>
        <div className="sh-modal__body">
          <label className="sh-label">
            Opening Cash (TZS)
            <input
              type="number" min="0" step="500"
              value={openingCash}
              onChange={e => setOpeningCash(e.target.value)}
              placeholder="e.g. 50000"
              className="sh-input"
              autoFocus
            />
          </label>
          <p className="sh-hint">Enter the cash float you counted at the start of your shift.</p>
          {error && <p className="sh-error">{error}</p>}
        </div>
        <div className="sh-modal__foot">
          <button onClick={onClose} className="sh-cancel">Cancel</button>
          <button
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="sh-confirm"
          >
            <PlayCircle size={15} />
            {start.isPending ? 'Starting…' : 'Start Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EndShiftModal({ shift, shopId, staffId, onClose, onEnded }: {
  shift: Shift; shopId: string; staffId: string; onClose: () => void; onEnded: () => void
}) {
  const [countedCash, setCountedCash] = useState('')
  const [notes, setNotes] = useState('')
  const [incidents, setIncidents] = useState('')
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const counted = parseFloat(countedCash) || 0
  const diff = counted - shift.opening_cash - shift.total_sales + shift.total_expenses

  const end = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('rpc_end_shift', {
        p_staff_id:      staffId,
        p_shop_id:       shopId,
        p_shift_id:      shift.id,
        p_counted_cash:  counted || null,
        p_closing_notes: notes || null,
        p_incidents:     incidents || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emp-active-shift'] })
      qc.invalidateQueries({ queryKey: ['emp-shifts'] })
      onEnded()
    },
    onError: (e: Error) => setError(e.message),
  })

  const expectedCash = shift.opening_cash + shift.total_sales - shift.total_expenses

  return (
    <div className="sh-overlay">
      <div className="sh-modal sh-modal--wide">
        <div className="sh-modal__head">
          <StopCircle size={20} className="sh-modal__icon sh-modal__icon--end" />
          <h2>End Shift — Closing Report</h2>
        </div>
        <div className="sh-modal__body">
          <div className="sh-summary">
            <div className="sh-summary-row"><span>Opening Cash</span><strong>{fmt(shift.opening_cash)}</strong></div>
            <div className="sh-summary-row"><span>Sales ({shift.transactions_count} txns)</span><strong style={{color:'var(--color-success)'}}>{fmt(shift.total_sales)}</strong></div>
            <div className="sh-summary-row"><span>Expenses</span><strong style={{color:'var(--color-error)'}}>{fmt(shift.total_expenses)}</strong></div>
            <div className="sh-summary-row sh-summary-row--expected"><span>Expected Cash</span><strong>{fmt(expectedCash)}</strong></div>
          </div>
          <label className="sh-label">
            Counted Cash (TZS) *
            <input
              type="number" min="0" step="500"
              value={countedCash}
              onChange={e => setCountedCash(e.target.value)}
              placeholder="Count all cash and enter total"
              className="sh-input"
              autoFocus
            />
          </label>
          {countedCash && (
            <div className={`sh-diff ${diff < 0 ? 'sh-diff--short' : diff > 0 ? 'sh-diff--over' : 'sh-diff--match'}`}>
              <span>Difference:</span>
              <strong>{diff >= 0 ? '+' : ''}{fmt(diff)}</strong>
              <span>{diff === 0 ? '✓ Exact match' : diff < 0 ? 'Short' : 'Over'}</span>
            </div>
          )}
          <label className="sh-label">
            Closing Notes
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any notes for the owner about this shift…"
              className="sh-textarea"
              rows={2}
            />
          </label>
          <label className="sh-label">
            Incidents (if any)
            <textarea
              value={incidents}
              onChange={e => setIncidents(e.target.value)}
              placeholder="Any issues, disputes, or incidents during this shift…"
              className="sh-textarea"
              rows={2}
            />
          </label>
          {error && <p className="sh-error">{error}</p>}
        </div>
        <div className="sh-modal__foot">
          <button onClick={onClose} className="sh-cancel">Cancel</button>
          <button
            onClick={() => end.mutate()}
            disabled={end.isPending || !countedCash}
            className="sh-confirm sh-confirm--end"
          >
            <StopCircle size={15} />
            {end.isPending ? 'Closing…' : 'Close Shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShiftRow({ shift }: { shift: Shift }) {
  const [expanded, setExpanded] = useState(false)
  const dur = shift.ended_at
    ? Math.floor((new Date(shift.ended_at).getTime() - new Date(shift.started_at).getTime()) / 60000)
    : null
  const h = dur !== null ? Math.floor(dur / 60) : null
  const m = dur !== null ? dur % 60 : null

  return (
    <div className="sh-row">
      <div className="sh-row__main" onClick={() => setExpanded(v => !v)}>
        <div className="sh-row__left">
          <span className={`sh-status sh-status--${shift.status}`}>{shift.status}</span>
          <span className="sh-row__date">{new Date(shift.shift_date).toLocaleDateString('en-TZ', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
        <div className="sh-row__right">
          {h !== null && <span className="sh-row__dur">{h}h {m}m</span>}
          <span className="sh-row__sales">{fmt(shift.total_sales)}</span>
          <button className="sh-row__expand">{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
        </div>
      </div>
      {expanded && (
        <div className="sh-row__detail">
          <div className="sh-detail-grid">
            <div className="sh-detail-item"><span>Started</span><strong>{new Date(shift.started_at).toLocaleTimeString('en-TZ', {hour:'2-digit',minute:'2-digit'})}</strong></div>
            {shift.ended_at && <div className="sh-detail-item"><span>Ended</span><strong>{new Date(shift.ended_at).toLocaleTimeString('en-TZ', {hour:'2-digit',minute:'2-digit'})}</strong></div>}
            <div className="sh-detail-item"><span>Opening Cash</span><strong>{fmt(shift.opening_cash)}</strong></div>
            {shift.counted_cash != null && <div className="sh-detail-item"><span>Counted</span><strong>{fmt(shift.counted_cash)}</strong></div>}
            {shift.cash_difference != null && (
              <div className="sh-detail-item">
                <span>Difference</span>
                <strong style={{color: shift.cash_difference < 0 ? 'var(--color-error)' : 'var(--color-success)'}}>
                  {shift.cash_difference >= 0 ? '+' : ''}{fmt(shift.cash_difference)}
                </strong>
              </div>
            )}
            <div className="sh-detail-item"><span>Transactions</span><strong>{shift.transactions_count}</strong></div>
            <div className="sh-detail-item"><span>Expenses</span><strong>{fmt(shift.total_expenses)}</strong></div>
          </div>
          {shift.closing_notes && <p className="sh-notes"><strong>Notes:</strong> {shift.closing_notes}</p>}
          {shift.incidents && <p className="sh-notes sh-notes--incident"><strong>Incidents:</strong> {shift.incidents}</p>}
        </div>
      )}
    </div>
  )
}

export function EmployeeShiftsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const { activeStaffId } = useStaffSession()
  const shopId = shop?.id
  const [showStart, setShowStart] = useState(false)
  const [showEnd, setShowEnd] = useState(false)

  const { data: activeShift } = useQuery<Shift | null>({
    queryKey: ['emp-active-shift', activeStaffId],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_shifts')
        .select('*')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .eq('status', 'open')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data
    },
    refetchInterval: 30_000,
  })

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['emp-shifts', activeStaffId],
    enabled: !!shopId && !!activeStaffId,
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_shifts')
        .select('*')
        .eq('shop_id', shopId!)
        .eq('staff_id', activeStaffId!)
        .order('started_at', { ascending: false })
        .limit(30)
      return data ?? []
    },
  })

  return (
    <div className="sh-page">
      <div className="sh-head">
        <h1 className="sh-title">My Shifts</h1>
        <p className="sh-sub">Manage your work sessions and closing reports</p>
      </div>

      {/* Active Shift Card */}
      {activeShift ? (
        <div className="sh-active-card">
          <div className="sh-active-card__left">
            <div className="sh-pulse"><PlayCircle size={22} /></div>
            <div>
              <p className="sh-active-card__label">Active Shift</p>
              <p className="sh-active-card__time">Started at {new Date(activeShift.started_at).toLocaleTimeString('en-TZ', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <div className="sh-active-stats">
            <div className="sh-mini-stat"><span>Duration</span><strong>{elapsed(activeShift.started_at)}</strong></div>
            <div className="sh-mini-stat"><span>Sales</span><strong>{fmt(activeShift.total_sales)}</strong></div>
            <div className="sh-mini-stat"><span>Txns</span><strong>{activeShift.transactions_count}</strong></div>
          </div>
          <button onClick={() => setShowEnd(true)} className="sh-end-btn">
            <StopCircle size={16} /> End Shift
          </button>
        </div>
      ) : (
        <div className="sh-no-shift">
          <AlertTriangle size={32} />
          <div>
            <p>No active shift</p>
            <span>Start a shift before making sales so your work is tracked correctly.</span>
          </div>
          <button onClick={() => setShowStart(true)} className="sh-start-btn">
            <Plus size={16} /> Start Shift
          </button>
        </div>
      )}

      {/* History */}
      <div className="sh-history">
        <h2 className="sh-history__title">Shift History</h2>
        {shifts.length === 0 ? (
          <p className="sh-empty">No shifts recorded yet.</p>
        ) : (
          <div className="sh-rows">
            {shifts.map(s => <ShiftRow key={s.id} shift={s} />)}
          </div>
        )}
      </div>

      {showStart && shopId && activeStaffId && (
        <StartShiftModal
          shopId={shopId} staffId={activeStaffId}
          onClose={() => setShowStart(false)}
          onStarted={() => setShowStart(false)}
        />
      )}
      {showEnd && activeShift && shopId && activeStaffId && (
        <EndShiftModal
          shift={activeShift} shopId={shopId} staffId={activeStaffId}
          onClose={() => setShowEnd(false)}
          onEnded={() => setShowEnd(false)}
        />
      )}

      <style>{`
        .sh-page { display:flex; flex-direction:column; gap:24px; }
        .sh-head { }
        .sh-title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .sh-sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }

        .sh-active-card {
          display:flex; align-items:center; gap:16px; flex-wrap:wrap;
          background:rgba(22,163,74,.08); border:1.5px solid rgba(22,163,74,.3);
          border-radius:16px; padding:18px 20px;
        }
        .sh-active-card__left { display:flex; align-items:center; gap:14px; flex:1; min-width:200px; }
        .sh-pulse { color:var(--color-success); animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.5} }
        .sh-active-card__label { font-weight:700; font-size:.95rem; color:var(--color-text); margin:0; }
        .sh-active-card__time { font-size:.78rem; color:var(--color-text-muted); margin:2px 0 0; }
        .sh-active-stats { display:flex; gap:20px; }
        .sh-mini-stat { text-align:center; }
        .sh-mini-stat span { display:block; font-size:.72rem; color:var(--color-text-muted); }
        .sh-mini-stat strong { font-size:.95rem; font-weight:700; color:var(--color-text); }
        .sh-end-btn {
          display:flex; align-items:center; gap:8px; padding:10px 18px;
          background:var(--color-error); color:#fff; border-radius:10px;
          font-weight:700; font-size:.875rem; transition:opacity 120ms;
        }
        .sh-end-btn:hover { opacity:.85; }

        .sh-no-shift {
          display:flex; align-items:center; gap:16px; flex-wrap:wrap;
          background:var(--color-warning-bg); border:1.5px solid rgba(217,119,6,.3);
          border-radius:16px; padding:18px 20px; color:var(--color-warning);
        }
        .sh-no-shift p { font-weight:700; font-size:.95rem; margin:0; color:var(--color-text); }
        .sh-no-shift span { font-size:.82rem; color:var(--color-text-muted); }
        .sh-start-btn {
          display:flex; align-items:center; gap:8px; padding:10px 18px; margin-left:auto;
          background:var(--color-primary); color:#fff; border-radius:10px;
          font-weight:700; font-size:.875rem; transition:opacity 120ms;
        }
        .sh-start-btn:hover { opacity:.9; }

        .sh-history { display:flex; flex-direction:column; gap:12px; }
        .sh-history__title { font-size:1rem; font-weight:700; color:var(--color-text); margin:0; }
        .sh-empty { color:var(--color-text-muted); font-size:.875rem; padding:24px; text-align:center; }
        .sh-rows { display:flex; flex-direction:column; gap:8px; }

        .sh-row {
          background:var(--color-surface); border:1px solid var(--color-border);
          border-radius:12px; overflow:hidden;
        }
        .sh-row__main {
          display:flex; align-items:center; justify-content:space-between;
          padding:14px 16px; cursor:pointer; transition:background 120ms;
        }
        .sh-row__main:hover { background:var(--color-bg); }
        .sh-row__left,.sh-row__right { display:flex; align-items:center; gap:10px; }
        .sh-row__date { font-size:.875rem; color:var(--color-text); font-weight:500; }
        .sh-row__dur { font-size:.8rem; color:var(--color-text-muted); }
        .sh-row__sales { font-weight:700; color:var(--color-text); font-size:.9rem; }
        .sh-row__expand { color:var(--color-text-muted); }
        .sh-status { font-size:.68rem; font-weight:700; padding:2px 8px; border-radius:999px; text-transform:uppercase; }
        .sh-status--open { background:rgba(22,163,74,.1); color:var(--color-success); }
        .sh-status--closed { background:var(--color-border); color:var(--color-text-secondary); }
        .sh-status--reviewed { background:var(--color-info-bg); color:var(--color-info); }

        .sh-row__detail { padding:14px 16px; border-top:1px solid var(--color-border); background:var(--color-bg); }
        .sh-detail-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:12px; margin-bottom:10px; }
        .sh-detail-item span { display:block; font-size:.72rem; color:var(--color-text-muted); }
        .sh-detail-item strong { font-size:.9rem; font-weight:700; color:var(--color-text); }
        .sh-notes { font-size:.82rem; color:var(--color-text-secondary); margin:4px 0 0; }
        .sh-notes--incident { color:var(--color-warning); }

        /* Overlay / Modal */
        .sh-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; z-index:300; }
        .sh-modal { background:var(--color-surface); border-radius:20px; width:100%; max-width:440px; overflow:hidden; box-shadow:var(--shadow-lg); }
        .sh-modal--wide { max-width:560px; }
        .sh-modal__head { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--color-border); }
        .sh-modal__head h2 { font-size:1rem; font-weight:700; margin:0; color:var(--color-text); }
        .sh-modal__icon { color:var(--color-success); }
        .sh-modal__icon--end { color:var(--color-error); }
        .sh-modal__body { padding:20px; display:flex; flex-direction:column; gap:14px; }
        .sh-modal__foot { display:flex; justify-content:flex-end; gap:10px; padding:16px 20px; border-top:1px solid var(--color-border); }

        .sh-label { display:flex; flex-direction:column; gap:6px; font-size:.82rem; font-weight:600; color:var(--color-text-secondary); }
        .sh-input { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.95rem; outline:none; }
        .sh-input:focus { border-color:var(--color-primary); }
        .sh-textarea { padding:10px 14px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text); font-size:.875rem; outline:none; resize:vertical; }
        .sh-textarea:focus { border-color:var(--color-primary); }
        .sh-hint { font-size:.78rem; color:var(--color-text-muted); margin:0; }
        .sh-error { background:var(--color-error-bg); color:var(--color-error); padding:8px 12px; border-radius:8px; font-size:.82rem; margin:0; }

        .sh-summary { background:var(--color-bg); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:8px; }
        .sh-summary-row { display:flex; justify-content:space-between; font-size:.875rem; }
        .sh-summary-row span { color:var(--color-text-secondary); }
        .sh-summary-row strong { font-weight:700; color:var(--color-text); }
        .sh-summary-row--expected { padding-top:8px; border-top:1px solid var(--color-border); }

        .sh-diff { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; font-size:.875rem; font-weight:600; }
        .sh-diff--match { background:var(--color-success-bg); color:var(--color-success); }
        .sh-diff--short { background:var(--color-error-bg); color:var(--color-error); }
        .sh-diff--over { background:var(--color-warning-bg); color:var(--color-warning); }

        .sh-cancel { padding:10px 18px; border:1.5px solid var(--color-border); border-radius:10px; font-weight:600; color:var(--color-text-secondary); font-size:.875rem; }
        .sh-confirm { display:flex; align-items:center; gap:6px; padding:10px 20px; background:var(--color-primary); color:#fff; border-radius:10px; font-weight:700; font-size:.875rem; }
        .sh-confirm:disabled { opacity:.6; cursor:not-allowed; }
        .sh-confirm--end { background:var(--color-error); }
      `}</style>
    </div>
  )
}
