import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckSquare, Clock, CheckCircle, XCircle, AlertTriangle, MessageSquare } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

interface ApprovalRequest {
  id: string
  request_type: string
  status: string
  reason: string | null
  notes: string | null
  amount: number | null
  payload: Record<string, unknown>
  requested_at: string
  reviewed_at: string | null
  requester: { full_name: string } | null
  approver: { full_name: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  refund: 'Refund',
  expense_approval: 'Expense Approval',
  purchase_approval: 'Purchase Approval',
  price_change: 'Price Change',
  stock_adjustment: 'Stock Adjustment',
  product_deletion: 'Product Deletion',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  draft:    { label: 'Draft',    color: '#6b7280', icon: Clock },
  pending:  { label: 'Pending',  color: '#f59e0b', icon: Clock },
  approved: { label: 'Approved', color: '#16a34a', icon: CheckCircle },
  rejected: { label: 'Rejected', color: '#dc2626', icon: XCircle },
  executed: { label: 'Executed', color: '#7c3aed', icon: CheckSquare },
  cancelled:{ label: 'Cancelled',color: '#6b7280', icon: XCircle },
}

function useApprovals(shopId?: string) {
  return useQuery<ApprovalRequest[]>({
    queryKey: ['approvals', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('approval_requests')
        .select(`
          id, request_type, status, reason, notes, amount, payload,
          requested_at, reviewed_at,
          requester:requester_id(full_name),
          approver:approver_id(full_name)
        `)
        .eq('shop_id', shopId!)
        .order('requested_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as ApprovalRequest[]
    },
  })
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

export function ApprovalsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const { data: requests = [], isLoading } = useApprovals(shop?.id)

  const [filter, setFilter] = useState<string>('pending')
  const [reviewing, setReviewing] = useState<ApprovalRequest | null>(null)
  const [reviewNote, setReviewNote] = useState('')

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('approval_requests')
        .update({ status: decision, reviewed_at: new Date().toISOString(), notes: reviewNote || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals', shop?.id] })
      setReviewing(null)
      setReviewNote('')
    },
  })

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <CheckSquare size={22} style={{ color: 'var(--color-primary)' }} /> Approval Requests
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>
        Review and manage pending approval workflows
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pending', value: counts.pending, color: '#f59e0b' },
          { label: 'Approved', value: counts.approved, color: '#16a34a' },
          { label: 'Rejected', value: counts.rejected, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'rejected', 'executed', 'cancelled'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '1px solid var(--color-border)',
              background: filter === f ? 'var(--color-primary)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'pending' && counts.pending > 0 && (
              <span style={{ marginLeft: 5, background: '#f59e0b', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <CheckSquare size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>No {filter === 'all' ? '' : filter} requests found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(req => {
            const sc = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending
            const StatusIcon = sc.icon
            return (
              <div key={req.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>{TYPE_LABELS[req.request_type] ?? req.request_type}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: sc.color }}>
                        <StatusIcon size={12} /> {sc.label}
                      </span>
                    </div>
                    {req.reason && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0' }}>{req.reason}</p>}
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                      {req.amount != null && (
                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Amount: <strong style={{ color: 'var(--color-text)' }}>{fmt(req.amount)}</strong></span>
                      )}
                      {req.requester && (
                        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>By: <strong style={{ color: 'var(--color-text)' }}>{(req.requester as any).full_name}</strong></span>
                      )}
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{format(new Date(req.requested_at), 'dd MMM yyyy HH:mm')}</span>
                    </div>
                    {req.notes && (
                      <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                        <MessageSquare size={12} style={{ marginRight: 4 }} />{req.notes}
                      </div>
                    )}
                  </div>
                  {req.status === 'pending' && (
                    <button
                      onClick={() => { setReviewing(req); setReviewNote('') }}
                      style={{ marginLeft: 12, padding: '6px 14px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Review modal */}
      {reviewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, margin: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>Review Request</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              {TYPE_LABELS[reviewing.request_type]}{reviewing.amount != null ? ` · ${fmt(reviewing.amount)}` : ''}
            </p>
            {reviewing.reason && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                <AlertTriangle size={13} style={{ marginRight: 4, color: '#f59e0b' }} />{reviewing.reason}
              </div>
            )}
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Note (optional)</label>
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              rows={3}
              placeholder="Add a note for your decision…"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setReviewing(null)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => reviewMutation.mutate({ id: reviewing.id, decision: 'rejected' })}
                disabled={reviewMutation.isPending}
                style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Reject
              </button>
              <button
                onClick={() => reviewMutation.mutate({ id: reviewing.id, decision: 'approved' })}
                disabled={reviewMutation.isPending}
                style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
