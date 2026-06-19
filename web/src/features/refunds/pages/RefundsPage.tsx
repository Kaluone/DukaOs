import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Plus, Receipt, CheckCircle, XCircle, Clock, Search } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

interface Refund {
  id: string
  transaction_id: string
  refund_type: 'full' | 'partial' | 'item'
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  total_amount: number
  reason: string | null
  receipt_number: string | null
  stock_restored: boolean
  created_at: string
  transaction: { total_amount: number; created_at: string } | null
  processed_by_staff: { full_name: string } | null
}

interface TransactionSearch {
  id: string
  total_amount: number
  payment_method: string
  created_at: string
  items: { product: { name: string } | null; quantity: number; unit_price: number }[]
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

function useRefunds(shopId?: string) {
  return useQuery<Refund[]>({
    queryKey: ['refunds', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('refunds')
        .select(`
          id, transaction_id, refund_type, status, total_amount, reason,
          receipt_number, stock_restored, created_at,
          transaction:transaction_id(total_amount, created_at),
          processed_by_staff:processed_by(full_name)
        `)
        .eq('shop_id', shopId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as Refund[]
    },
  })
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#f59e0b', icon: Clock },
  approved:  { label: 'Approved',  color: '#16a34a', icon: CheckCircle },
  rejected:  { label: 'Rejected',  color: '#dc2626', icon: XCircle },
  completed: { label: 'Completed', color: '#7c3aed', icon: CheckCircle },
}

export function RefundsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const { data: refunds = [], isLoading } = useRefunds(shop?.id)

  const [showNew, setShowNew] = useState(false)
  const [txnSearch, setTxnSearch] = useState('')
  const [foundTxn, setFoundTxn] = useState<TransactionSearch | null>(null)
  const [searching, setSearching] = useState(false)
  const [refundType, setRefundType] = useState<'full' | 'partial' | 'item'>('full')
  const [partialAmount, setPartialAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const searchTransaction = async () => {
    if (!txnSearch.trim() || !shop?.id) return
    setSearching(true)
    setError('')
    try {
      const { data, error: e } = await supabase
        .from('transactions')
        .select(`id, total_amount, payment_method, created_at,
          items:transaction_items(quantity, unit_price, product:product_id(name))`)
        .eq('shop_id', shop.id)
        .or(`id.eq.${txnSearch},offline_id.eq.${txnSearch}`)
        .single()
      if (e || !data) { setError('Transaction not found'); setFoundTxn(null) }
      else setFoundTxn(data as unknown as TransactionSearch)
    } finally {
      setSearching(false)
    }
  }

  const createRefundMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id || !foundTxn) throw new Error('No transaction selected')
      const amount = refundType === 'full'
        ? foundTxn.total_amount
        : refundType === 'partial'
        ? parseFloat(partialAmount)
        : parseFloat(partialAmount)
      if (!amount || amount <= 0) throw new Error('Invalid refund amount')
      if (amount > foundTxn.total_amount) throw new Error('Refund exceeds original amount')
      if (!reason.trim()) throw new Error('Reason is required')

      const recNum = `RF-${Date.now().toString().slice(-6)}`
      const { error } = await supabase.from('refunds').insert({
        shop_id: shop.id,
        transaction_id: foundTxn.id,
        refund_type: refundType,
        status: 'pending',
        total_amount: amount,
        reason: reason.trim(),
        receipt_number: recNum,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['refunds', shop?.id] })
      setShowNew(false)
      setFoundTxn(null)
      setTxnSearch('')
      setReason('')
      setPartialAmount('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('refunds').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      if (status === 'completed') {
        // Mark stock_restored
        await supabase.from('refunds').update({ stock_restored: true }).eq('id', id)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['refunds', shop?.id] }),
  })

  const totalRefunded = refunds.filter(r => r.status === 'completed').reduce((s, r) => s + r.total_amount, 0)

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={22} style={{ color: 'var(--color-primary)' }} /> Refund Management
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            Process and track customer refunds
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={16} /> New Refund
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Refunded', value: fmt(totalRefunded), color: '#dc2626' },
          { label: 'Pending', value: refunds.filter(r => r.status === 'pending').length, color: '#f59e0b' },
          { label: 'Completed', value: refunds.filter(r => r.status === 'completed').length, color: '#16a34a' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: typeof s.value === 'number' ? 24 : 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : refunds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <RotateCcw size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>No refunds found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {refunds.map(r => {
            const sc = STATUS_CONFIG[r.status]
            const StatusIcon = sc.icon
            return (
              <div key={r.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Receipt size={14} style={{ color: 'var(--color-primary)' }} />
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{r.receipt_number ?? 'N/A'}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: sc.color }}>
                        <StatusIcon size={12} /> {sc.label}
                      </span>
                      <span style={{ fontSize: 12, background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-secondary)' }}>
                        {r.refund_type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Amount: <strong style={{ color: '#dc2626' }}>{fmt(r.total_amount)}</strong></span>
                      {r.reason && <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Reason: {r.reason}</span>}
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{format(new Date(r.created_at), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                  {r.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'completed' })}
                        style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >Approve</button>
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: r.id, status: 'rejected' })}
                        style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >Reject</button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Refund Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 520, margin: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>Process Refund</h2>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}

            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Search Transaction ID</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={txnSearch}
                onChange={e => setTxnSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchTransaction()}
                placeholder="Transaction ID or offline ID"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}
              />
              <button onClick={searchTransaction} disabled={searching} style={{ padding: '8px 14px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
                {searching ? '…' : <Search size={16} />}
              </button>
            </div>

            {foundTxn && (
              <div style={{ background: 'var(--color-bg)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Transaction Found</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Amount: <strong>{fmt(foundTxn.total_amount)}</strong></div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Date: {format(new Date(foundTxn.created_at), 'dd MMM yyyy HH:mm')}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Payment: {foundTxn.payment_method}</div>
              </div>
            )}

            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 6 }}>Refund Type</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['full', 'partial', 'item'] as const).map(t => (
                <button key={t} onClick={() => setRefundType(t)} style={{ flex: 1, padding: '8px', border: `2px solid ${refundType === t ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 8, background: refundType === t ? 'var(--color-primary)' : 'transparent', color: refundType === t ? '#fff' : 'var(--color-text)', cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize', fontSize: 13 }}>
                  {t}
                </button>
              ))}
            </div>

            {(refundType === 'partial' || refundType === 'item') && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Refund Amount (TZS)</label>
                <input
                  type="number"
                  value={partialAmount}
                  onChange={e => setPartialAmount(e.target.value)}
                  placeholder="0"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Reason *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="Why is this refund being processed?"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => createRefundMutation.mutate()}
                disabled={createRefundMutation.isPending || !foundTxn}
                style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                {createRefundMutation.isPending ? 'Processing…' : 'Submit Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
