import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, ToggleLeft, ToggleRight, Percent, Ticket } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

type Tab = 'promotions' | 'coupons'

interface Promotion {
  id: string
  name: string
  description: string | null
  type: string
  value: number
  min_purchase: number | null
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  usage_count: number
  usage_limit: number | null
}

interface Coupon {
  id: string
  code: string
  description: string | null
  discount_type: 'percentage' | 'fixed'
  discount_value: number
  min_purchase: number | null
  usage_limit: number | null
  usage_count: number
  is_active: boolean
  expires_at: string | null
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

const TYPE_LABELS: Record<string, string> = {
  percentage: 'Percentage', fixed: 'Fixed Amount', buy_x_get_y: 'Buy X Get Y',
  bundle: 'Bundle', category: 'Category', customer: 'Customer Specific',
  happy_hour: 'Happy Hour', weekend: 'Weekend',
}

export function PromotionsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('promotions')
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState<'promotion' | 'coupon'>('promotion')

  // Promotions
  const [promoForm, setPromoForm] = useState({ name: '', type: 'percentage', value: '', min_purchase: '', starts_at: '', ends_at: '' })
  // Coupons
  const [couponForm, setCouponForm] = useState({ code: '', discount_type: 'percentage', discount_value: '', min_purchase: '', usage_limit: '', expires_at: '' })
  const [error, setError] = useState('')

  const { data: promotions = [] } = useQuery<Promotion[]>({
    queryKey: ['promotions', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('promotions').select('*').eq('shop_id', shop!.id).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const { data: coupons = [] } = useQuery<Coupon[]>({
    queryKey: ['coupons', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('coupons').select('*').eq('shop_id', shop!.id).order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const savePromoMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      if (!promoForm.name.trim()) throw new Error('Name required')
      const v = parseFloat(promoForm.value)
      if (!v || v <= 0) throw new Error('Invalid value')
      const { error } = await supabase.from('promotions').insert({
        shop_id: shop.id, name: promoForm.name.trim(), type: promoForm.type, value: v,
        min_purchase: promoForm.min_purchase ? parseFloat(promoForm.min_purchase) : null,
        starts_at: promoForm.starts_at || null, ends_at: promoForm.ends_at || null,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions', shop?.id] }); setShowModal(false); setPromoForm({ name: '', type: 'percentage', value: '', min_purchase: '', starts_at: '', ends_at: '' }) },
    onError: (e: Error) => setError(e.message),
  })

  const saveCouponMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      if (!couponForm.code.trim()) throw new Error('Coupon code required')
      const v = parseFloat(couponForm.discount_value)
      if (!v || v <= 0) throw new Error('Invalid discount value')
      const { error } = await supabase.from('coupons').insert({
        shop_id: shop.id, code: couponForm.code.trim().toUpperCase(), discount_type: couponForm.discount_type,
        discount_value: v, min_purchase: couponForm.min_purchase ? parseFloat(couponForm.min_purchase) : null,
        usage_limit: couponForm.usage_limit ? parseInt(couponForm.usage_limit) : null,
        expires_at: couponForm.expires_at || null,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coupons', shop?.id] }); setShowModal(false); setCouponForm({ code: '', discount_type: 'percentage', discount_value: '', min_purchase: '', usage_limit: '', expires_at: '' }) },
    onError: (e: Error) => setError(e.message),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ table, id, val }: { table: string; id: string; val: boolean }) => {
      const { error } = await supabase.from(table).update({ is_active: val }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['promotions', shop?.id] })
      qc.invalidateQueries({ queryKey: ['coupons', shop?.id] })
    },
  })

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size={22} style={{ color: 'var(--color-primary)' }} /> Promotions & Coupons
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Create discounts and coupon codes</p>
        </div>
        <button
          onClick={() => { setModalType(tab === 'promotions' ? 'promotion' : 'coupon'); setShowModal(true); setError('') }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}
        >
          <Plus size={16} /> {tab === 'promotions' ? 'Add Promotion' : 'Add Coupon'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--color-bg)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {(['promotions', 'coupons'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--color-card)' : 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, fontSize: 14 }}>
            {t === 'promotions' ? <><Percent size={14} style={{ marginRight: 6 }} />Promotions ({promotions.length})</> : <><Ticket size={14} style={{ marginRight: 6 }} />Coupons ({coupons.length})</>}
          </button>
        ))}
      </div>

      {tab === 'promotions' ? (
        promotions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
            <Percent size={36} style={{ opacity: 0.3, marginBottom: 8 }} /><p>No promotions yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {promotions.map(p => (
              <div key={p.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{p.name}</span>
                      <span style={{ fontSize: 11, background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-text-secondary)' }}>{TYPE_LABELS[p.type] ?? p.type}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: p.is_active ? '#16a34a' : '#6b7280' }}>{p.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Value: <strong style={{ color: 'var(--color-text)' }}>{p.type === 'percentage' ? `${p.value}%` : fmt(p.value)}</strong>
                      {p.min_purchase ? ` · Min: ${fmt(p.min_purchase)}` : ''}
                      {p.ends_at ? ` · Expires: ${format(new Date(p.ends_at), 'dd MMM yyyy')}` : ''}
                      {` · Used: ${p.usage_count}${p.usage_limit ? `/${p.usage_limit}` : ''}`}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive.mutate({ table: 'promotions', id: p.id, val: !p.is_active })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.is_active ? '#16a34a' : 'var(--color-text-secondary)' }}
                  >
                    {p.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        coupons.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
            <Ticket size={36} style={{ opacity: 0.3, marginBottom: 8 }} /><p>No coupons yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coupons.map(c => (
              <div key={c.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <code style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: 'var(--color-primary)', background: 'var(--color-bg)', padding: '2px 8px', borderRadius: 4 }}>{c.code}</code>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.is_active ? '#16a34a' : '#6b7280' }}>{c.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Discount: <strong style={{ color: 'var(--color-text)' }}>{c.discount_type === 'percentage' ? `${c.discount_value}%` : fmt(c.discount_value)}</strong>
                      {c.min_purchase ? ` · Min: ${fmt(c.min_purchase)}` : ''}
                      {c.expires_at ? ` · Expires: ${format(new Date(c.expires_at), 'dd MMM yyyy')}` : ''}
                      {` · Used: ${c.usage_count}${c.usage_limit ? `/${c.usage_limit}` : ''}`}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleActive.mutate({ table: 'coupons', id: c.id, val: !c.is_active })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.is_active ? '#16a34a' : 'var(--color-text-secondary)' }}
                  >
                    {c.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, margin: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>
              {modalType === 'promotion' ? 'New Promotion' : 'New Coupon'}
            </h2>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}

            {modalType === 'promotion' ? (
              <>
                {[
                  { key: 'name', label: 'Promotion Name *', placeholder: 'e.g. Weekend Sale' },
                  { key: 'value', label: 'Discount Value *', placeholder: '10 for 10% or 5000 for TZS 5,000', type: 'number' },
                  { key: 'min_purchase', label: 'Minimum Purchase', placeholder: '0', type: 'number' },
                  { key: 'starts_at', label: 'Start Date', type: 'datetime-local' },
                  { key: 'ends_at', label: 'End Date', type: 'datetime-local' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type ?? 'text'} value={promoForm[f.key as keyof typeof promoForm]} onChange={e => setPromoForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Type</label>
                  <select value={promoForm.type} onChange={e => setPromoForm(p => ({ ...p, type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                {[
                  { key: 'code', label: 'Coupon Code *', placeholder: 'e.g. SAVE20' },
                  { key: 'discount_value', label: 'Discount Value *', placeholder: '20 for 20% or 5000 for TZS 5,000', type: 'number' },
                  { key: 'min_purchase', label: 'Minimum Purchase', placeholder: '0', type: 'number' },
                  { key: 'usage_limit', label: 'Usage Limit', placeholder: 'Leave empty for unlimited', type: 'number' },
                  { key: 'expires_at', label: 'Expiry Date', type: 'datetime-local' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type ?? 'text'} value={couponForm[f.key as keyof typeof couponForm]} onChange={e => setCouponForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Discount Type</label>
                  <select value={couponForm.discount_type} onChange={e => setCouponForm(p => ({ ...p, discount_type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (TZS)</option>
                  </select>
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button
                onClick={() => modalType === 'promotion' ? savePromoMutation.mutate() : saveCouponMutation.mutate()}
                disabled={savePromoMutation.isPending || saveCouponMutation.isPending}
                style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                {savePromoMutation.isPending || saveCouponMutation.isPending ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
