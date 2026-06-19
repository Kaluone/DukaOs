import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShoppingCart, X, Trash2, Package, ChevronRight, Paperclip } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT } from '@/shared/i18n/useLanguage'
import { format } from 'date-fns'
import { DocumentAttachments } from '@/shared/components/DocumentAttachments'

interface Supplier { id: string; name: string }
interface Product  { id: string; name: string; buying_price: number }

interface PurchaseRow {
  id: string
  invoice_number: string | null
  total_amount: number
  paid_amount: number
  payment_status: 'unpaid' | 'partial' | 'paid'
  lifecycle_status: string | null
  purchase_date: string
  notes: string | null
  suppliers: { name: string } | null
}

const LIFECYCLE_NEXT: Record<string, { next: string; label: string }> = {
  draft:             { next: 'pending_approval', label: 'Submit' },
  pending_approval:  { next: 'approved',         label: 'Approve' },
  approved:          { next: 'ordered',           label: 'Order' },
  ordered:           { next: 'received',          label: 'Receive' },
  received:          { next: 'closed',            label: 'Close' },
}

const LIFECYCLE_COLOR: Record<string, string> = {
  draft: '#6b7280', pending_approval: '#3b82f6', approved: '#16a34a',
  ordered: '#f59e0b', received: '#7c3aed', closed: '#16a34a', cancelled: '#dc2626',
}

interface LineItem { product_id: string; product_name: string; quantity: number; buying_price: number }

const fmt = (n: number) =>
  new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

const STATUS_COLOR: Record<string, string> = {
  paid:    'badge-success',
  partial: 'badge-warning',
  unpaid:  'badge-error',
}

export function PurchasesPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()
  const qc = useQueryClient()

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const advanceLifecycle = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: string | null }) => {
      const status = current ?? 'draft'
      const transition = LIFECYCLE_NEXT[status]
      if (!transition) return
      await supabase.from('purchases').update({ lifecycle_status: transition.next }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases', shop?.id] }),
  })

  // Form state
  const [supplierId, setSupplierId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [paymentStatus, setPaymentStatus] = useState<'unpaid'|'partial'|'paid'>('unpaid')
  const [paidAmount, setPaidAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [lineQty, setLineQty] = useState('1')
  const [linePrice, setLinePrice] = useState('')

  const { data: purchases = [], isLoading } = useQuery<PurchaseRow[]>({
    queryKey: ['purchases', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, invoice_number, total_amount, paid_amount, payment_status, lifecycle_status, purchase_date, notes, suppliers(name)')
        .eq('shop_id', shop!.id)
        .order('purchase_date', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as unknown as PurchaseRow[]
    },
    enabled: !!shop?.id,
  })

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers-list', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name').eq('shop_id', shop!.id).eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shop?.id,
  })

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products-buy', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name, buying_price').eq('shop_id', shop!.id).eq('active', true).order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shop?.id,
  })

  const addLine = () => {
    const prod = products.find(p => p.id === selectedProduct)
    if (!prod || !lineQty || !linePrice) return
    const existing = lines.findIndex(l => l.product_id === selectedProduct)
    if (existing >= 0) {
      setLines(ls => ls.map((l, i) => i === existing ? { ...l, quantity: l.quantity + Number(lineQty) } : l))
    } else {
      setLines(ls => [...ls, { product_id: prod.id, product_name: prod.name, quantity: Number(lineQty), buying_price: Number(linePrice) }])
    }
    setSelectedProduct(''); setLineQty('1'); setLinePrice('')
  }

  const totalCost = lines.reduce((s, l) => s + l.quantity * l.buying_price, 0)

  const handleSave = async () => {
    if (!shop?.id || lines.length === 0) { setErr(t('addItem') + ' — ' + t('required')); return }
    setSaving(true); setErr('')
    try {
      const { data: purch, error: pErr } = await supabase.from('purchases').insert({
        shop_id: shop.id,
        supplier_id: supplierId || null,
        invoice_number: invoiceNumber || null,
        total_amount: totalCost,
        paid_amount: Number(paidAmount) || 0,
        payment_status: paymentStatus,
        notes: notes || null,
        purchase_date: purchaseDate,
      }).select('id').single()
      if (pErr) throw pErr

      const items = lines.map(l => ({
        purchase_id: purch.id,
        product_id: l.product_id,
        shop_id: shop.id,
        quantity: l.quantity,
        buying_price: l.buying_price,
        subtotal: l.quantity * l.buying_price,
      }))
      const { error: iErr } = await supabase.from('purchase_items').insert(items)
      if (iErr) throw iErr

      qc.invalidateQueries({ queryKey: ['purchases', shop.id] })
      qc.invalidateQueries({ queryKey: ['pos-products', shop.id] })
      setShowModal(false)
      resetForm()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setSupplierId(''); setInvoiceNumber(''); setPurchaseDate(format(new Date(), 'yyyy-MM-dd'))
    setPaymentStatus('unpaid'); setPaidAmount(''); setNotes(''); setLines([])
    setSelectedProduct(''); setLineQty('1'); setLinePrice('')
  }

  const statusLabel: Record<string, string> = {
    paid: t('paid'), partial: t('partial'), unpaid: t('unpaid'),
  }

  return (
    <div className="pg">
      <div className="pg__header">
        <div>
          <h1 className="pg__title">{t('purchasesTitle')}</h1>
          <p className="pg__sub">{t('purchasesSub')}</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
          <Plus size={16} /> {t('addPurchase')}
        </button>
      </div>

      {isLoading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-l)' }} />
      ) : purchases.length === 0 ? (
        <div className="empty-state">
          <ShoppingCart size={40} style={{ color: 'var(--color-text-muted)' }} />
          <p>{t('noPurchases')}</p>
          <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true) }}>
            <Plus size={14} /> {t('addPurchase')}
          </button>
        </div>
      ) : (
        <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('purchaseDate')}</th>
                  <th>{t('supplier')}</th>
                  <th>{t('invoiceNumber')}</th>
                  <th>{t('total')}</th>
                  <th>{t('paidAmount')}</th>
                  <th>{t('paymentStatus')}</th>
                  <th>Lifecycle</th>
                  <th>Files</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => {
                  const lcStatus = p.lifecycle_status ?? 'draft'
                  const lcColor = LIFECYCLE_COLOR[lcStatus] ?? '#6b7280'
                  const transition = LIFECYCLE_NEXT[lcStatus]
                  return (
                    <>
                    <tr key={p.id}>
                      <td>{p.purchase_date}</td>
                      <td>{(p.suppliers as any)?.name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                      <td>{p.invoice_number ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(p.total_amount)}</td>
                      <td>{fmt(p.paid_amount)}</td>
                      <td><span className={`badge ${STATUS_COLOR[p.payment_status]}`}>{statusLabel[p.payment_status]}</span></td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 700, color: lcColor, background: `${lcColor}20`, padding: '2px 8px', borderRadius: 10, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {lcStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'transparent', cursor: 'pointer', fontSize: 11, color: 'var(--color-text-secondary)' }}
                        >
                          <Paperclip size={11} /> Files
                        </button>
                      </td>
                      <td>
                        {transition && lcStatus !== 'closed' && lcStatus !== 'cancelled' && (
                          <button
                            onClick={() => advanceLifecycle.mutate({ id: p.id, current: p.lifecycle_status })}
                            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}
                          >
                            {transition.label} <ChevronRight size={10} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === p.id && shop?.id && (
                      <tr key={`${p.id}-attachments`}>
                        <td colSpan={9} style={{ padding: '12px 16px', background: 'var(--color-bg)' }}>
                          <DocumentAttachments shopId={shop.id} entityType="purchase" entityId={p.id} />
                        </td>
                      </tr>
                    )}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal--wide" onClick={e => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{t('addPurchase')}</h3>
              <button onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              {/* Meta row */}
              <div className="form-row">
                <div className="field">
                  <label className="field__label">{t('supplier')}</label>
                  <select className="field__input" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                    <option value="">{t('noSupplier')}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">{t('purchaseDate')}</label>
                  <input className="field__input" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">{t('invoiceNumber')}</label>
                  <input className="field__input" placeholder="INV-001" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
                </div>
              </div>

              {/* Items section */}
              <div className="section-title">{t('purchaseItems')}</div>
              <div className="form-row form-row--add">
                <div className="field" style={{ flex: 2 }}>
                  <label className="field__label">{t('selectProduct')}</label>
                  <select className="field__input" value={selectedProduct} onChange={e => {
                    setSelectedProduct(e.target.value)
                    const p = products.find(x => x.id === e.target.value)
                    if (p) setLinePrice(String(p.buying_price))
                  }}>
                    <option value="">—</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label">{t('quantity')}</label>
                  <input className="field__input" type="number" min="1" value={lineQty} onChange={e => setLineQty(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label">{t('buyingPrice')} (TZS)</label>
                  <input className="field__input" type="number" min="0" value={linePrice} onChange={e => setLinePrice(e.target.value)} />
                </div>
                <button className="btn-add-line" onClick={addLine} disabled={!selectedProduct || !lineQty || !linePrice}>
                  <Plus size={14} /> {t('addItem')}
                </button>
              </div>

              {lines.length > 0 && (
                <div className="lines-list">
                  {lines.map((l, i) => (
                    <div key={i} className="line-row">
                      <Package size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                      <span className="line-name">{l.product_name}</span>
                      <span className="line-detail">{l.quantity} × {fmt(l.buying_price)}</span>
                      <span className="line-sub">{fmt(l.quantity * l.buying_price)}</span>
                      <button className="line-del" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <div className="line-total">
                    <span>{t('totalCost')}</span>
                    <span>{fmt(totalCost)}</span>
                  </div>
                </div>
              )}

              {/* Payment */}
              <div className="form-row">
                <div className="field">
                  <label className="field__label">{t('paymentStatus')}</label>
                  <select className="field__input" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as any)}>
                    <option value="unpaid">{t('unpaid')}</option>
                    <option value="partial">{t('partial')}</option>
                    <option value="paid">{t('paid')}</option>
                  </select>
                </div>
                {paymentStatus !== 'unpaid' && (
                  <div className="field">
                    <label className="field__label">{t('paidAmount')} (TZS)</label>
                    <input className="field__input" type="number" min="0" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} />
                  </div>
                )}
                <div className="field">
                  <label className="field__label">{t('notes')}</label>
                  <input className="field__input" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>

              {err && <p className="form-err">{err}</p>}
            </div>
            <div className="modal__foot">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>{t('cancel')}</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || lines.length === 0}>
                {saving ? t('saving') : t('save')} {lines.length > 0 && `(${fmt(totalCost)})`}
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

        .empty-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-4); padding: var(--space-16) 0; color: var(--color-text-muted); }
        .empty-state p { font-size: 0.9rem; }

        .btn-primary { display: flex; align-items: center; gap: 6px; padding: var(--space-3) var(--space-5); background: var(--color-primary); color: #fff; border-radius: var(--radius-l); font-weight: 600; font-size: 0.9rem; }
        .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
        .btn-primary:disabled { opacity: .5; cursor: not-allowed; }
        .btn-ghost { padding: var(--space-3) var(--space-5); border: 1.5px solid var(--color-border); color: var(--color-text-secondary); border-radius: var(--radius-l); font-weight: 600; font-size: 0.9rem; }
        .btn-ghost:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; padding: var(--space-4); z-index: 200; overflow-y: auto; }
        .modal { background: var(--color-surface); border-radius: var(--radius-xl); width: 100%; max-width: 520px; box-shadow: var(--shadow-lg); }
        .modal--wide { max-width: 680px; }
        .modal__head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
        .modal__head h3 { font-size: 1rem; font-weight: 700; }
        .modal__head button { color: var(--color-text-muted); padding: 4px; }
        .modal__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); max-height: 70vh; overflow-y: auto; }
        .modal__foot { padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border); display: flex; gap: var(--space-3); justify-content: flex-end; }

        .form-row { display: flex; gap: var(--space-3); flex-wrap: wrap; }
        .form-row .field { flex: 1; min-width: 140px; }
        .form-row--add { align-items: flex-end; }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field__label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); }
        .field__input { padding: 10px var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 0.9rem; outline: none; background: var(--color-surface); color: var(--color-text); }
        .field__input:focus { border-color: var(--color-primary); }

        .section-title { font-size: 0.82rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

        .btn-add-line { display: flex; align-items: center; gap: 5px; padding: 10px var(--space-4); background: var(--color-primary-light); color: var(--color-primary); border: 1.5px solid var(--color-primary); border-radius: var(--radius-m); font-weight: 600; font-size: 0.85rem; white-space: nowrap; align-self: flex-end; }
        .btn-add-line:disabled { opacity: .4; cursor: not-allowed; }

        .lines-list { border: 1px solid var(--color-border); border-radius: var(--radius-m); overflow: hidden; }
        .line-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-border); }
        .line-row:last-child { border-bottom: none; }
        .line-name { flex: 1; font-size: 0.875rem; font-weight: 600; }
        .line-detail { font-size: 0.78rem; color: var(--color-text-muted); white-space: nowrap; }
        .line-sub { font-size: 0.875rem; font-weight: 700; color: var(--color-primary); white-space: nowrap; min-width: 90px; text-align: right; }
        .line-del { color: var(--color-text-muted); padding: 4px; border-radius: var(--radius-s); }
        .line-del:hover { color: var(--color-error); background: var(--color-error-bg); }
        .line-total { display: flex; justify-content: space-between; padding: var(--space-3) var(--space-4); background: var(--color-surface-2); font-weight: 800; font-size: 0.9rem; }

        .form-err { font-size: 0.82rem; color: var(--color-error); background: var(--color-error-bg); padding: var(--space-3); border-radius: var(--radius-m); }

        .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; }
        .badge-success { background: var(--color-success-bg); color: var(--color-success); }
        .badge-warning { background: var(--color-warning-bg); color: var(--color-warning); }
        .badge-error   { background: var(--color-error-bg);   color: var(--color-error); }
      `}</style>
    </div>
  )
}
