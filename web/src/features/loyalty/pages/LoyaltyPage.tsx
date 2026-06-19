import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, Gift, TrendingUp, Users, Plus, Crown } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

interface LoyaltyTier {
  id: string
  name: string
  min_points: number
  points_per_100: number
  discount_pct: number
  color: string
  benefits: string[]
}

interface LoyaltyTxn {
  id: string
  type: 'earn' | 'redeem' | 'adjust' | 'expire'
  points: number
  balance_after: number
  notes: string | null
  created_at: string
  customer: { name: string } | null
}

interface CustomerLoyalty {
  id: string
  name: string
  phone: string | null
  loyalty_points: number
  tier?: string
}

const TIER_COLORS = ['#cd7f32', '#c0c0c0', '#ffd700', '#e5e4e2']

export function LoyaltyPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [tab, setTab] = useState<'overview' | 'tiers' | 'history'>('overview')
  const [showTierModal, setShowTierModal] = useState(false)
  const [tierForm, setTierForm] = useState({ name: '', min_points: '', points_per_100: '1', discount_pct: '0', color: '#cd7f32', benefits: '' })
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustForm, setAdjustForm] = useState({ customer_id: '', points: '', notes: '' })
  const [error, setError] = useState('')

  const { data: tiers = [] } = useQuery<LoyaltyTier[]>({
    queryKey: ['loyalty-tiers', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase.from('loyalty_tiers').select('*').eq('shop_id', shop!.id).order('min_points')
      return (data ?? []).map(t => ({ ...t, benefits: t.benefits ?? [] }))
    },
  })

  const { data: transactions = [] } = useQuery<LoyaltyTxn[]>({
    queryKey: ['loyalty-txns', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_transactions')
        .select('id, type, points, balance_after, notes, created_at, customer:customer_id(name)')
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
        .limit(100)
      return (data ?? []) as unknown as LoyaltyTxn[]
    },
  })

  const { data: topCustomers = [] } = useQuery<CustomerLoyalty[]>({
    queryKey: ['customers-loyalty', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, name, phone, loyalty_points')
        .eq('shop_id', shop!.id)
        .eq('active', true)
        .gt('loyalty_points', 0)
        .order('loyalty_points', { ascending: false })
        .limit(20)
      return (data ?? []) as CustomerLoyalty[]
    },
  })

  const { data: allCustomers = [] } = useQuery<CustomerLoyalty[]>({
    queryKey: ['customers-all', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, name, phone').eq('shop_id', shop!.id).eq('active', true).order('name')
      return (data ?? []) as CustomerLoyalty[]
    },
  })

  const saveTierMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      if (!tierForm.name.trim()) throw new Error('Tier name required')
      const benefits = tierForm.benefits.split('\n').map(b => b.trim()).filter(Boolean)
      const { error } = await supabase.from('loyalty_tiers').insert({
        shop_id: shop.id,
        name: tierForm.name.trim(),
        min_points: parseInt(tierForm.min_points) || 0,
        points_per_100: parseInt(tierForm.points_per_100) || 1,
        discount_pct: parseFloat(tierForm.discount_pct) || 0,
        color: tierForm.color,
        benefits,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-tiers', shop?.id] })
      setShowTierModal(false)
      setTierForm({ name: '', min_points: '', points_per_100: '1', discount_pct: '0', color: '#cd7f32', benefits: '' })
    },
    onError: (e: Error) => setError(e.message),
  })

  const adjustPointsMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      if (!adjustForm.customer_id) throw new Error('Select a customer')
      const pts = parseInt(adjustForm.points)
      if (!pts) throw new Error('Enter points amount')
      const { data: cust } = await supabase.from('customers').select('loyalty_points').eq('id', adjustForm.customer_id).single()
      const before = cust?.loyalty_points ?? 0
      const after = Math.max(0, before + pts)
      await supabase.from('customers').update({ loyalty_points: after }).eq('id', adjustForm.customer_id)
      await supabase.from('loyalty_transactions').insert({
        shop_id: shop.id, customer_id: adjustForm.customer_id,
        type: 'adjust', points: pts, balance_before: before, balance_after: after,
        notes: adjustForm.notes || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-txns', shop?.id] })
      qc.invalidateQueries({ queryKey: ['customers-loyalty', shop?.id] })
      setShowAdjust(false)
      setAdjustForm({ customer_id: '', points: '', notes: '' })
    },
    onError: (e: Error) => setError(e.message),
  })

  const totalPoints = topCustomers.reduce((s, c) => s + (c.loyalty_points ?? 0), 0)
  const earnTxns = transactions.filter(t => t.type === 'earn').length
  const redeemTxns = transactions.filter(t => t.type === 'redeem').length

  const getTierForPoints = (pts: number) => {
    const sorted = [...tiers].sort((a, b) => b.min_points - a.min_points)
    return sorted.find(t => pts >= t.min_points)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={22} style={{ color: '#f59e0b' }} /> Customer Loyalty
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            Manage loyalty tiers, points, and rewards
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowAdjust(true); setError('') }} style={{ padding: '7px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
            Adjust Points
          </button>
          <button onClick={() => { setShowTierModal(true); setError('') }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            <Plus size={15} /> Add Tier
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Points', value: totalPoints.toLocaleString(), icon: Star, color: '#f59e0b' },
          { label: 'Active Members', value: topCustomers.length, icon: Users, color: '#16a34a' },
          { label: 'Points Earned', value: earnTxns, icon: TrendingUp, color: '#3b82f6' },
          { label: 'Redemptions', value: redeemTxns, icon: Gift, color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14 }}>
            <s.icon size={18} style={{ color: s.color, marginBottom: 6 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--color-bg)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {(['overview', 'tiers', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--color-card)' : 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, fontSize: 14, textTransform: 'capitalize' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Top Loyalty Members</h3>
          {topCustomers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
              <Star size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p>No loyalty members yet. Points are earned automatically on purchases.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topCustomers.map((c, i) => {
                const tier = getTierForPoints(c.loyalty_points ?? 0)
                return (
                  <div key={c.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: i < 3 ? TIER_COLORS[i] : 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: i < 3 ? '#fff' : 'var(--color-text)' }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{c.phone}</div>}
                    </div>
                    {tier && (
                      <span style={{ fontSize: 11, background: `${tier.color}30`, color: tier.color, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                        {tier.name}
                      </span>
                    )}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>{(c.loyalty_points ?? 0).toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>points</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'tiers' && (
        <div>
          {tiers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
              <Crown size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p>No loyalty tiers yet. Add tiers like Bronze, Silver, Gold, Platinum.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14 }}>
              {tiers.map(tier => (
                <div key={tier.id} style={{ background: 'var(--color-card)', border: `2px solid ${tier.color}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: tier.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Crown size={16} color="#fff" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>{tier.name}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    Minimum: <strong style={{ color: 'var(--color-text)' }}>{tier.min_points.toLocaleString()} pts</strong>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                    Earn rate: <strong>{tier.points_per_100} pt / TSh 100</strong>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                    Discount: <strong style={{ color: tier.color }}>{tier.discount_pct}%</strong>
                  </div>
                  {tier.benefits.length > 0 && (
                    <div>
                      {tier.benefits.slice(0, 3).map((b, i) => (
                        <div key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                          <span style={{ color: tier.color }}>✓</span> {b}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {transactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>No loyalty transactions yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transactions.map(t => {
                const typeColors: Record<string, string> = { earn: '#16a34a', redeem: '#7c3aed', adjust: '#3b82f6', expire: '#dc2626' }
                const color = typeColors[t.type] ?? '#6b7280'
                return (
                  <div key={t.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: 'capitalize' }}>{t.type}</span>
                        {(t.customer as any)?.name && <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{(t.customer as any).name}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {t.notes ?? format(new Date(t.created_at), 'dd MMM yyyy HH:mm')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color }}>{t.points > 0 ? '+' : ''}{t.points.toLocaleString()} pts</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Balance: {t.balance_after.toLocaleString()}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Tier Modal */}
      {showTierModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, margin: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>Add Loyalty Tier</h2>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
            {[
              { key: 'name', label: 'Tier Name *', placeholder: 'e.g. Gold' },
              { key: 'min_points', label: 'Minimum Points', placeholder: '0', type: 'number' },
              { key: 'points_per_100', label: 'Points per TSh 100 spent', placeholder: '1', type: 'number' },
              { key: 'discount_pct', label: 'Discount % on purchases', placeholder: '0', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type ?? 'text'} value={tierForm[f.key as keyof typeof tierForm]} onChange={e => setTierForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
            ))}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Tier Color</label>
              <input type="color" value={tierForm.color} onChange={e => setTierForm(p => ({ ...p, color: e.target.value }))} style={{ width: 48, height: 36, border: 'none', cursor: 'pointer', borderRadius: 6 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Benefits (one per line)</label>
              <textarea value={tierForm.benefits} onChange={e => setTierForm(p => ({ ...p, benefits: e.target.value }))} rows={3} placeholder="Free delivery&#10;Priority support&#10;Birthday bonus" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTierModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => saveTierMutation.mutate()} disabled={saveTierMutation.isPending} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {saveTierMutation.isPending ? 'Saving…' : 'Create Tier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Points Modal */}
      {showAdjust && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420, margin: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>Adjust Points</h2>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Customer *</label>
              <select value={adjustForm.customer_id} onChange={e => setAdjustForm(p => ({ ...p, customer_id: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                <option value="">Select customer</option>
                {allCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Points (use negative to deduct) *</label>
              <input type="number" value={adjustForm.points} onChange={e => setAdjustForm(p => ({ ...p, points: e.target.value }))} placeholder="e.g. 100 or -50" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Reason</label>
              <input value={adjustForm.notes} onChange={e => setAdjustForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional reason" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAdjust(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => adjustPointsMutation.mutate()} disabled={adjustPointsMutation.isPending} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {adjustPointsMutation.isPending ? 'Saving…' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
