import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

interface StockCount {
  id: string
  count_date: string
  status: string
  notes: string | null
  total_variance: number
  created_at: string
  counted_by_staff: { full_name: string } | null
  items_count?: number
}

interface Product { id: string; name: string; category: string | null; quantity: number }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_progress:      { label: 'In Progress', color: '#3b82f6' },
  pending_approval: { label: 'Pending Approval', color: '#f59e0b' },
  approved:         { label: 'Approved', color: '#16a34a' },
  rejected:         { label: 'Rejected', color: '#dc2626' },
  applied:          { label: 'Applied', color: '#7c3aed' },
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ').format(n)

export function StockCountPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()

  const { data: counts = [], isLoading } = useQuery<StockCount[]>({
    queryKey: ['stock-counts', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_counts')
        .select(`id, count_date, status, notes, total_variance, created_at, counted_by_staff:counted_by(full_name)`)
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as StockCount[]
    },
  })

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-with-stock', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, category, stock_levels(quantity)')
        .eq('shop_id', shop!.id)
        .eq('active', true)
        .order('name')
      return (data ?? []).map((p: any) => ({ id: p.id, name: p.name, category: p.category, quantity: p.stock_levels?.[0]?.quantity ?? 0 }))
    },
  })

  const [showNew, setShowNew] = useState(false)
  const [countItems, setCountItems] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [selectedCount, setSelectedCount] = useState<StockCount | null>(null)

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      const { data: count, error: ce } = await supabase
        .from('stock_counts')
        .insert({ shop_id: shop.id, status: 'in_progress', notes: notes || null })
        .select('id').single()
      if (ce || !count) throw ce ?? new Error('Failed to create count')
      const items = products.map(p => ({
        stock_count_id: count.id,
        product_id: p.id,
        system_quantity: p.quantity,
        physical_quantity: countItems[p.id] !== undefined ? countItems[p.id] : p.quantity,
        variance_value: 0,
      }))
      if (items.length > 0) {
        const { error: ie } = await supabase.from('stock_count_items').insert(items)
        if (ie) throw ie
      }
      // Update total_variance
      const totalVar = items.reduce((s, i) => s + (i.physical_quantity - i.system_quantity), 0)
      await supabase.from('stock_counts').update({ status: 'pending_approval', total_variance: totalVar }).eq('id', count.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-counts', shop?.id] })
      setShowNew(false)
      setCountItems({})
      setNotes('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const applyMutation = useMutation({
    mutationFn: async (countId: string) => {
      const { data: items } = await supabase
        .from('stock_count_items')
        .select('product_id, physical_quantity')
        .eq('stock_count_id', countId)
      if (!items) return
      for (const item of items) {
        await supabase.from('stock_levels')
          .update({ quantity: item.physical_quantity, updated_at: new Date().toISOString() })
          .eq('product_id', item.product_id).eq('shop_id', shop!.id)
      }
      await supabase.from('stock_counts').update({ status: 'applied' }).eq('id', countId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-counts', shop?.id] }),
  })

  const changedProducts = products.filter(p => countItems[p.id] !== undefined && countItems[p.id] !== p.quantity)

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={22} style={{ color: 'var(--color-primary)' }} /> Stock Count & Reconciliation
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            Perform physical inventory counts and reconcile variances
          </p>
        </div>
        <button
          onClick={() => { setShowNew(true); setError(''); setCountItems({}) }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={16} /> New Count
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : counts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <ClipboardList size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>No stock counts yet. Start your first count to reconcile inventory.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {counts.map(c => {
            const sc = STATUS_CONFIG[c.status] ?? { label: c.status, color: '#6b7280' }
            return (
              <div key={c.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16, cursor: 'pointer' }}
                onClick={() => setSelectedCount(selectedCount?.id === c.id ? null : c)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                        Count — {format(new Date(c.count_date), 'dd MMM yyyy')}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: sc.color }}>{sc.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {(c.counted_by_staff as any)?.full_name && <span>By: {(c.counted_by_staff as any).full_name}</span>}
                      <span>Variance: <strong style={{ color: c.total_variance === 0 ? '#16a34a' : '#dc2626' }}>{c.total_variance > 0 ? '+' : ''}{fmt(c.total_variance)}</strong></span>
                    </div>
                  </div>
                  {c.status === 'pending_approval' && (
                    <button
                      onClick={e => { e.stopPropagation(); applyMutation.mutate(c.id) }}
                      style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      Apply to Stock
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* New Count Modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 700, margin: '0 16px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>New Stock Count</h2>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {changedProducts.length} adjustment{changedProducts.length !== 1 ? 's' : ''} entered
              </span>
            </div>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}

            <div style={{ overflowY: 'auto', flex: 1, marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 80px 80px 80px', gap: '4px 8px', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', padding: '4px 0' }}>PRODUCT</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'center' }}>SYSTEM</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'center' }}>COUNTED</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textAlign: 'center' }}>DIFF</span>
              </div>
              {products.map(p => {
                const counted = countItems[p.id] !== undefined ? countItems[p.id] : p.quantity
                const diff = counted - p.quantity
                return (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: 'auto 80px 80px 80px', gap: '4px 8px', alignItems: 'center', borderBottom: '1px solid var(--color-border)', padding: '6px 0' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>{p.name}</div>
                      {p.category && <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{p.category}</div>}
                    </div>
                    <div style={{ fontSize: 13, textAlign: 'center', color: 'var(--color-text-secondary)' }}>{fmt(p.quantity)}</div>
                    <input
                      type="number"
                      min={0}
                      value={countItems[p.id] !== undefined ? countItems[p.id] : p.quantity}
                      onChange={e => setCountItems(prev => ({ ...prev, [p.id]: parseInt(e.target.value) || 0 }))}
                      style={{ padding: '4px 6px', border: `2px solid ${diff !== 0 ? (diff > 0 ? '#16a34a' : '#dc2626') : 'var(--color-border)'}`, borderRadius: 6, textAlign: 'center', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ fontSize: 13, textAlign: 'center', color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : 'var(--color-text-secondary)', fontWeight: diff !== 0 ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                      {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : null}
                      {diff > 0 ? `+${diff}` : diff}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes about this count" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNew(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {createMutation.isPending ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
