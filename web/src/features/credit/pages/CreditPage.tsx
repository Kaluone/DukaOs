import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, CheckCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, differenceInDays } from 'date-fns'

interface CreditCustomer {
  id: string
  name: string
  phone: string | null
  credit_limit: number
  credit_balance: number
  overdue_days: number
  last_sale_date: string | null
}

interface CreditTransaction {
  id: string
  type: string
  amount: number
  notes: string | null
  created_at: string
  due_date: string | null
  paid_at: string | null
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

export function CreditPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [error, setError] = useState('')

  const { data: customers = [], isLoading } = useQuery<CreditCustomer[]>({
    queryKey: ['credit-customers', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, credit_limit, credit_balance')
        .eq('shop_id', shop!.id)
        .gt('credit_balance', 0)
        .order('credit_balance', { ascending: false })
      return (data ?? []).map((c: any) => ({
        ...c,
        overdue_days: 0,
        last_sale_date: null,
      })) as CreditCustomer[]
    },
  })

  const { data: txns = [] } = useQuery<CreditTransaction[]>({
    queryKey: ['credit-txns', expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, payment_method, total_amount, notes, created_at, due_date, paid_at')
        .eq('customer_id', expandedId!)
        .eq('payment_method', 'credit')
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []).map((t: any) => ({
        id: t.id, type: 'credit_sale', amount: t.total_amount,
        notes: t.notes, created_at: t.created_at, due_date: t.due_date, paid_at: t.paid_at,
      }))
    },
  })

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id || !showPayment) throw new Error('No customer')
      const amount = parseFloat(payAmount)
      if (!amount || amount <= 0) throw new Error('Enter valid payment amount')
      const customer = customers.find(c => c.id === showPayment)
      if (!customer) throw new Error('Customer not found')
      const newBalance = Math.max(0, customer.credit_balance - amount)
      await supabase.from('customers').update({ credit_balance: newBalance }).eq('id', showPayment)
      await supabase.from('transactions').insert({
        shop_id: shop.id, customer_id: showPayment, type: 'income',
        payment_method: 'cash', total_amount: amount, subtotal: amount, tax_total: 0,
        status: 'completed', notes: payNote ? `Credit payment: ${payNote}` : 'Credit payment',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credit-customers', shop?.id] })
      setShowPayment(null)
      setPayAmount('')
      setPayNote('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search))
  const totalOutstanding = customers.reduce((s, c) => s + c.credit_balance, 0)
  const overdueCount = customers.filter(c => c.overdue_days > 30).length

  const getAgingBucket = (c: CreditCustomer) => {
    if (c.overdue_days > 90) return { label: '90+ days', color: '#dc2626' }
    if (c.overdue_days > 60) return { label: '60-90 days', color: '#f97316' }
    if (c.overdue_days > 30) return { label: '30-60 days', color: '#f59e0b' }
    return { label: 'Current', color: '#16a34a' }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={22} style={{ color: 'var(--color-primary)' }} /> Credit & Debt Management
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Track outstanding customer balances and collect payments</p>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Total Outstanding</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{fmt(totalOutstanding)}</div>
        </div>
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Customers with Credit</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{customers.length}</div>
        </div>
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Overdue (30+ days)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: overdueCount > 0 ? '#f59e0b' : '#16a34a' }}>{overdueCount}</div>
        </div>
        <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Avg. Balance</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{customers.length > 0 ? fmt(totalOutstanding / customers.length) : fmt(0)}</div>
        </div>
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…" style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <CreditCard size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>{customers.length === 0 ? 'No customers with outstanding credit balances.' : 'No customers match your search.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(c => {
            const aging = getAgingBucket(c)
            const isExpanded = expandedId === c.id
            const utilPct = c.credit_limit > 0 ? Math.min(100, (c.credit_balance / c.credit_limit) * 100) : 0
            return (
              <div key={c.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{c.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: aging.color, background: `${aging.color}20`, padding: '1px 7px', borderRadius: 10 }}>{aging.label}</span>
                    </div>
                    {c.phone && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>{c.phone}</div>}
                    {c.credit_limit > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>
                          <span>Balance: {fmt(c.credit_balance)}</span>
                          <span>Limit: {fmt(c.credit_limit)}</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--color-bg)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${utilPct}%`, background: utilPct > 80 ? '#dc2626' : utilPct > 60 ? '#f59e0b' : '#16a34a', borderRadius: 2 }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>{fmt(c.credit_balance)}</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowPayment(c.id); setError('') }} style={{ padding: '5px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Plus size={12} /> Record Payment
                      </button>
                      <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={{ padding: '5px 8px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 16px', background: 'var(--color-bg)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Credit Sales History</div>
                    {txns.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center', padding: 12 }}>No credit transactions found</div>
                    ) : (
                      txns.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
                          <div>
                            <span style={{ color: 'var(--color-text)' }}>{format(new Date(t.created_at), 'dd MMM yyyy')}</span>
                            {t.notes && <span style={{ color: 'var(--color-text-secondary)', marginLeft: 8 }}>— {t.notes}</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {t.due_date && !t.paid_at && (
                              <span style={{ fontSize: 11, color: differenceInDays(new Date(), new Date(t.due_date)) > 0 ? '#dc2626' : '#f59e0b' }}>
                                Due: {format(new Date(t.due_date), 'dd/MM')}
                              </span>
                            )}
                            {t.paid_at && <CheckCircle size={12} style={{ color: '#16a34a' }} />}
                            <span style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(t.amount)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, margin: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: 'var(--color-text)' }}>Record Payment</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20 }}>
              {customers.find(c => c.id === showPayment)?.name} — Balance: {fmt(customers.find(c => c.id === showPayment)?.credit_balance ?? 0)}
            </p>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Amount Paid (TZS) *</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Enter amount" style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 16, fontWeight: 700, boxSizing: 'border-box' }} autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Note</label>
              <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="Optional note" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPayment(null); setPayAmount(''); setPayNote('') }} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => recordPaymentMutation.mutate()} disabled={recordPaymentMutation.isPending} style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {recordPaymentMutation.isPending ? 'Recording…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
