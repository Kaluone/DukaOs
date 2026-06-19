import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Plus, Package, Truck } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

interface Branch { id: string; name: string }
interface Product { id: string; name: string; stock_quantity: number }

interface Transfer {
  id: string
  from_branch_id: string
  to_branch_id: string
  status: string
  reference_number: string | null
  notes: string | null
  sent_at: string | null
  received_at: string | null
  created_at: string
  from_branch: { name: string } | null
  to_branch: { name: string } | null
  items: { id: string; product: { name: string } | null; quantity_sent: number; quantity_received: number }[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:      { label: 'Draft',       color: '#6b7280' },
  sent:       { label: 'Sent',        color: '#3b82f6' },
  in_transit: { label: 'In Transit',  color: '#f59e0b' },
  received:   { label: 'Received',    color: '#8b5cf6' },
  completed:  { label: 'Completed',   color: '#16a34a' },
  cancelled:  { label: 'Cancelled',   color: '#dc2626' },
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'decimal' }).format(n)

export function TransfersPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name').eq('shop_id', shop!.id).eq('is_active', true)
      return data ?? []
    },
  })

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['pos-products', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, stock_levels(quantity)')
        .eq('shop_id', shop!.id)
        .eq('active', true)
        .order('name')
      return (data ?? []).map((p: any) => ({ id: p.id, name: p.name, stock_quantity: p.stock_levels?.[0]?.quantity ?? 0 }))
    },
  })

  const { data: transfers = [], isLoading } = useQuery<Transfer[]>({
    queryKey: ['transfers', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transfers')
        .select(`id, from_branch_id, to_branch_id, status, reference_number, notes, sent_at, received_at, created_at,
          from_branch:from_branch_id(name), to_branch:to_branch_id(name),
          items:inventory_transfer_items(id, quantity_sent, quantity_received, product:product_id(name))`)
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as Transfer[]
    },
  })

  const [showNew, setShowNew] = useState(false)
  const [fromBranch, setFromBranch] = useState('')
  const [toBranch, setToBranch] = useState('')
  const [transferItems, setTransferItems] = useState<{ product_id: string; quantity: number }[]>([{ product_id: '', quantity: 1 }])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      if (!fromBranch || !toBranch) throw new Error('Select both branches')
      if (fromBranch === toBranch) throw new Error('From and To branches must differ')
      const validItems = transferItems.filter(i => i.product_id && i.quantity > 0)
      if (validItems.length === 0) throw new Error('Add at least one product')
      const refNum = `TRF-${Date.now().toString().slice(-6)}`
      const { data: transfer, error: te } = await supabase
        .from('inventory_transfers')
        .insert({ shop_id: shop.id, from_branch_id: fromBranch, to_branch_id: toBranch, status: 'draft', reference_number: refNum, notes: notes || null })
        .select('id').single()
      if (te || !transfer) throw te ?? new Error('Failed to create transfer')
      const { error: ie } = await supabase
        .from('inventory_transfer_items')
        .insert(validItems.map(i => ({ transfer_id: transfer.id, product_id: i.product_id, quantity_sent: i.quantity })))
      if (ie) throw ie
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfers', shop?.id] })
      setShowNew(false)
      setTransferItems([{ product_id: '', quantity: 1 }])
      setNotes('')
      setFromBranch('')
      setToBranch('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const advanceStatus = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string }) => {
      const next: Record<string, string> = { draft: 'sent', sent: 'in_transit', in_transit: 'received', received: 'completed' }
      if (!next[current]) return
      const extra: Record<string, unknown> = {}
      if (next[current] === 'sent') extra.sent_at = new Date().toISOString()
      if (next[current] === 'completed') extra.received_at = new Date().toISOString()
      const { error } = await supabase.from('inventory_transfers').update({ status: next[current], ...extra }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transfers', shop?.id] }),
  })

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowRightLeft size={22} style={{ color: 'var(--color-primary)' }} /> Inventory Transfers
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Move stock between branches</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={16} /> New Transfer
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : transfers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <ArrowRightLeft size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>No transfers yet. Create one to move stock between branches.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {transfers.map(t => {
            const sc = STATUS_CONFIG[t.status] ?? { label: t.status, color: '#6b7280' }
            const nextActions: Record<string, string> = { draft: 'Mark Sent', sent: 'Mark In Transit', in_transit: 'Mark Received', received: 'Complete' }
            return (
              <div key={t.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{t.reference_number ?? t.id.slice(0, 8)}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sc.color, background: `${sc.color}20`, padding: '2px 8px', borderRadius: 10 }}>{sc.label}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                      <span>{(t.from_branch as any)?.name ?? '?'}</span>
                      <Truck size={13} />
                      <span>{(t.to_branch as any)?.name ?? '?'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {t.items.length} item(s) · {format(new Date(t.created_at), 'dd MMM yyyy')}
                    </div>
                    {t.notes && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, fontStyle: 'italic' }}>{t.notes}</div>}
                  </div>
                  {nextActions[t.status] && (
                    <button
                      onClick={() => advanceStatus.mutate({ id: t.id, current: t.status })}
                      style={{ padding: '6px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {nextActions[t.status]}
                    </button>
                  )}
                </div>
                {t.items.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {t.items.slice(0, 4).map(item => (
                      <span key={item.id} style={{ fontSize: 11, background: 'var(--color-bg)', padding: '3px 8px', borderRadius: 6, color: 'var(--color-text-secondary)' }}>
                        <Package size={10} style={{ marginRight: 3 }} />{(item.product as any)?.name} × {item.quantity_sent}
                      </span>
                    ))}
                    {t.items.length > 4 && <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>+{t.items.length - 4} more</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, margin: '0 16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>New Stock Transfer</h2>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'From Branch', val: fromBranch, setter: setFromBranch },
                { label: 'To Branch', val: toBranch, setter: setToBranch },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <select
                    value={f.val}
                    onChange={e => f.setter(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}
                  >
                    <option value="">Select branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 8 }}>Products to Transfer</label>
            {transferItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select
                  value={item.product_id}
                  onChange={e => setTransferItems(prev => prev.map((p, i) => i === idx ? { ...p, product_id: e.target.value } : p))}
                  style={{ flex: 2, padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13 }}
                >
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {fmt(p.stock_quantity)})</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => setTransferItems(prev => prev.map((p, i) => i === idx ? { ...p, quantity: parseInt(e.target.value) || 1 } : p))}
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13 }}
                />
                {transferItems.length > 1 && (
                  <button onClick={() => setTransferItems(prev => prev.filter((_, i) => i !== idx))} style={{ padding: '0 10px', background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#dc2626' }}>×</button>
                )}
              </div>
            ))}
            <button onClick={() => setTransferItems(p => [...p, { product_id: '', quantity: 1 }])} style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14 }}>
              <Plus size={13} style={{ marginRight: 4 }} />Add Product
            </button>

            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional notes" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', marginBottom: 20 }} />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {createMutation.isPending ? 'Creating…' : 'Create Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
