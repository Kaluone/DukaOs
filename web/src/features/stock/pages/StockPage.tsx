import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, BarChart2, X, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT } from '@/shared/i18n/useLanguage'
import { format } from 'date-fns'

interface Movement {
  id: string
  movement_type: string
  quantity_before: number
  quantity_change: number
  quantity_after: number
  reason: string | null
  created_at: string
  products: { name: string } | null
  staff: { full_name: string } | null
}

interface Product { id: string; name: string }

const TYPE_COLOR: Record<string, string> = {
  IN: 'success', PURCHASE: 'success', RETURN: 'success',
  OUT: 'error', SALE: 'primary', DAMAGE: 'error',
  ADJUSTMENT: 'warning',
}

const TYPE_ICON: Record<string, React.ElementType> = {
  IN: ArrowUp, PURCHASE: ArrowUp, RETURN: ArrowUp,
  OUT: ArrowDown, SALE: ArrowDown, DAMAGE: AlertTriangle,
  ADJUSTMENT: BarChart2,
}

export function StockPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Adjustment form
  const [productId, setProductId] = useState('')
  const [adjType, setAdjType] = useState<'IN'|'OUT'|'DAMAGE'>('IN')
  const [adjQty, setAdjQty] = useState('1')
  const [adjReason, setAdjReason] = useState('')

  const { data: movements = [], isLoading } = useQuery<Movement[]>({
    queryKey: ['stock-movements', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('id, movement_type, quantity_before, quantity_change, quantity_after, reason, created_at, products:product_id(name), staff:staff_id(full_name)')
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
        .limit(150)
      if (error) throw error
      return (data ?? []) as unknown as Movement[]
    },
    enabled: !!shop?.id,
  })

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-stock', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name').eq('shop_id', shop!.id).eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shop?.id,
  })

  const handleSave = async () => {
    if (!shop?.id || !productId || !adjQty) { setErr(t('required')); return }
    setSaving(true); setErr('')
    try {
      // Get current stock level
      const { data: sl } = await supabase
        .from('stock_levels')
        .select('quantity')
        .eq('product_id', productId)
        .eq('shop_id', shop.id)
        .single()

      const qtyBefore = sl?.quantity ?? 0
      const delta = adjType === 'IN' ? Number(adjQty) : -Number(adjQty)
      const qtyAfter = Math.max(0, qtyBefore + delta)

      // Update stock level
      const { error: ulErr } = await supabase
        .from('stock_levels')
        .update({ quantity: qtyAfter, updated_at: new Date().toISOString() })
        .eq('product_id', productId)
        .eq('shop_id', shop.id)
      if (ulErr) throw ulErr

      // Log movement
      const { error: mvErr } = await supabase.from('stock_movements').insert({
        shop_id: shop.id,
        product_id: productId,
        movement_type: adjType === 'IN' ? 'IN' : adjType === 'DAMAGE' ? 'DAMAGE' : 'OUT',
        quantity_before: qtyBefore,
        quantity_change: delta,
        quantity_after: qtyAfter,
        reason: adjReason || null,
        reference_type: 'adjustment',
      })
      if (mvErr) throw mvErr

      qc.invalidateQueries({ queryKey: ['stock-movements', shop.id] })
      qc.invalidateQueries({ queryKey: ['pos-products', shop.id] })
      qc.invalidateQueries({ queryKey: ['low-stock', shop.id] })
      setShowModal(false)
      setProductId(''); setAdjQty('1'); setAdjReason(''); setAdjType('IN')
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const colorVar = (c: string) => {
    const map: Record<string, string> = {
      success: 'var(--color-success)', error: 'var(--color-error)',
      primary: 'var(--color-primary)', warning: 'var(--color-warning)',
    }
    return map[c] ?? 'var(--color-text-muted)'
  }

  return (
    <div className="pg">
      <div className="pg__header">
        <div>
          <h1 className="pg__title">{t('stockTitle')}</h1>
          <p className="pg__sub">{t('stockSub')}</p>
        </div>
        <button className="btn-primary" onClick={() => { setErr(''); setShowModal(true) }}>
          <Plus size={16} /> {t('addAdjustment')}
        </button>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-l)' }} />
      ) : movements.length === 0 ? (
        <div className="empty-state">
          <BarChart2 size={40} style={{ color: 'var(--color-text-muted)' }} />
          <p>{t('noMovements')}</p>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('name')}</th>
                  <th>{t('movementType')}</th>
                  <th>{t('qtyBefore')}</th>
                  <th>{t('qtyChange')}</th>
                  <th>{t('qtyAfter')}</th>
                  <th>{t('reason')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => {
                  const color = colorVar(TYPE_COLOR[m.movement_type] ?? 'primary')
                  const Icon = TYPE_ICON[m.movement_type] ?? BarChart2
                  return (
                    <tr key={m.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                        {format(new Date(m.created_at), 'dd/MM/yy HH:mm')}
                      </td>
                      <td style={{ fontWeight: 600 }}>{(m.products as any)?.name ?? '—'}</td>
                      <td>
                        <span className="mv-type" style={{ color, borderColor: color + '40', background: color + '10' }}>
                          <Icon size={11} /> {m.movement_type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{m.quantity_before}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color }}>
                        {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{m.quantity_after}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{m.reason ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{t('addAdjustment')}</h3>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <div className="field">
                <label className="field__label">{t('name')} ({t('selectProduct')})</label>
                <select className="field__input" value={productId} onChange={e => setProductId(e.target.value)} autoFocus>
                  <option value="">—</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="field__label">{t('movementType')}</label>
                <div className="adj-btns">
                  {(['IN','OUT','DAMAGE'] as const).map(type => (
                    <button key={type} className={`adj-btn ${adjType === type ? 'adj-btn--active' : ''}`} onClick={() => setAdjType(type)}>
                      {type === 'IN' ? t('adjustmentIn') : type === 'OUT' ? t('adjustmentOut') : t('adjustmentDamage')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="field__label">{t('quantity')}</label>
                <input className="field__input" type="number" min="1" value={adjQty} onChange={e => setAdjQty(e.target.value)} />
              </div>
              <div className="field">
                <label className="field__label">{t('reason')}</label>
                <input className="field__input" placeholder={t('optional')} value={adjReason} onChange={e => setAdjReason(e.target.value)} />
              </div>
              {err && <p className="form-err">{err}</p>}
            </div>
            <div className="modal__foot">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !productId}>
                {saving ? t('saving') : t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .pg { display: flex; flex-direction: column; gap: var(--space-6); }
        .pg__header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
        .pg__title { font-size: 1.6rem; font-weight: 800; }
        .pg__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-5); box-shadow: var(--shadow-xs); }
        .tbl { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .tbl th { text-align: left; padding: var(--space-2) var(--space-3); color: var(--color-text-muted); font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid var(--color-border); }
        .tbl td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tr:hover td { background: var(--color-surface-2); }

        .mv-type { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; border: 1px solid; }

        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: var(--space-16) 0; color: var(--color-text-muted); }
        .empty-state p { font-size: 0.9rem; }

        .btn-primary { display: flex; align-items: center; gap: 6px; padding: var(--space-3) var(--space-5); background: var(--color-primary); color: #fff; border-radius: var(--radius-l); font-weight: 600; font-size: 0.9rem; }
        .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-ghost { padding: var(--space-3) var(--space-5); border: 1.5px solid var(--color-border); color: var(--color-text-secondary); border-radius: var(--radius-l); font-weight: 600; font-size: 0.9rem; }
        .btn-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: var(--space-4); z-index: 200; }
        .modal { background: var(--color-surface); border-radius: var(--radius-xl); width: 100%; max-width: 460px; box-shadow: var(--shadow-lg); }
        .modal__head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
        .modal__head h3 { font-size: 1rem; font-weight: 700; }
        .modal__head button { color: var(--color-text-muted); padding: 4px; }
        .modal__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); }
        .modal__foot { padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border); display: flex; gap: var(--space-3); justify-content: flex-end; }

        .field { display: flex; flex-direction: column; gap: 5px; }
        .field__label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); }
        .field__input { padding: 10px var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.9rem; outline: none; background: var(--color-surface); color: var(--color-text); }
        .field__input:focus { border-color: var(--color-primary); }

        .adj-btns { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .adj-btn { padding: var(--space-2) var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.8rem; font-weight: 600; color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .adj-btn--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

        .form-err { font-size: 0.82rem; color: var(--color-error); background: var(--color-error-bg); padding: var(--space-3); border-radius: var(--radius-m); }
      `}</style>
    </div>
  )
}
