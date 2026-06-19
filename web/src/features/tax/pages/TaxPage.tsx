import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Percent, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

interface TaxRate {
  id: string
  name: string
  rate: number
  type: 'inclusive' | 'exclusive'
  applies_to: string[]
  is_default: boolean
  is_active: boolean
  description: string | null
}

const BLANK: Omit<TaxRate, 'id'> = {
  name: '', rate: 0, type: 'exclusive', applies_to: [],
  is_default: false, is_active: true, description: '',
}

export function TaxPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<TaxRate | null>(null)
  const [form, setForm] = useState<Omit<TaxRate, 'id'>>(BLANK)
  const [error, setError] = useState('')

  const { data: rates = [], isLoading } = useQuery<TaxRate[]>({
    queryKey: ['tax-rates', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('shop_id', shop!.id)
        .order('is_default', { ascending: false })
        .order('name')
      if (error) throw error
      return (data ?? []).map(r => ({ ...r, applies_to: r.applies_to ?? [] }))
    },
  })

  const openCreate = () => {
    setEditing(null)
    setForm(BLANK)
    setError('')
    setShowModal(true)
  }

  const openEdit = (rate: TaxRate) => {
    setEditing(rate)
    setForm({ name: rate.name, rate: rate.rate, type: rate.type, applies_to: rate.applies_to, is_default: rate.is_default, is_active: rate.is_active, description: rate.description ?? '' })
    setError('')
    setShowModal(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      if (!form.name.trim()) throw new Error('Tax name required')
      if (form.rate < 0 || form.rate > 100) throw new Error('Rate must be between 0 and 100')
      const payload = { ...form, shop_id: shop.id, name: form.name.trim(), description: form.description || null }
      if (form.is_default) {
        await supabase.from('tax_rates').update({ is_default: false }).eq('shop_id', shop.id)
      }
      if (editing) {
        const { error } = await supabase.from('tax_rates').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('tax_rates').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tax-rates', shop?.id] })
      setShowModal(false)
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tax_rates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-rates', shop?.id] }),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from('tax_rates').update({ is_active: active }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tax-rates', shop?.id] }),
  })

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Percent size={22} style={{ color: 'var(--color-primary)' }} /> Tax Rates
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Configure VAT and other taxes applied to sales</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={15} /> Add Tax Rate
        </button>
      </div>

      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Tax rates are automatically applied to products. Inclusive taxes are included in the displayed price; exclusive taxes are added on top at checkout.
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : rates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
          <Percent size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
          <p>No tax rates configured. Tanzania standard VAT is 18%.</p>
          <button onClick={openCreate} style={{ marginTop: 12, padding: '8px 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            Add VAT 18%
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rates.map(rate => (
            <div key={rate.id} style={{ background: 'var(--color-card)', border: `1px solid ${rate.is_default ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: rate.is_active ? 1 : 0.6 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: rate.is_active ? 'var(--color-primary)20' : 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: rate.is_active ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>{rate.rate}%</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{rate.name}</span>
                  {rate.is_default && <span style={{ fontSize: 11, background: 'var(--color-primary)', color: '#fff', padding: '1px 7px', borderRadius: 10, fontWeight: 700 }}>DEFAULT</span>}
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{rate.type}</span>
                </div>
                {rate.description && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{rate.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => toggleActiveMutation.mutate({ id: rate.id, active: !rate.is_active })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: rate.is_active ? '#16a34a' : '#6b7280', padding: 4 }} title={rate.is_active ? 'Deactivate' : 'Activate'}>
                  {rate.is_active ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
                <button onClick={() => openEdit(rate)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
                  <Edit2 size={16} />
                </button>
                {!rate.is_default && (
                  <button onClick={() => { if (confirm('Delete this tax rate?')) deleteMutation.mutate(rate.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 460, margin: '0 16px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--color-text)' }}>{editing ? 'Edit Tax Rate' : 'Add Tax Rate'}</h2>
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Tax Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. VAT, GST" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Rate (%) *</label>
                <input type="number" min={0} max={100} step={0.1} value={form.rate} onChange={e => setForm(p => ({ ...p, rate: parseFloat(e.target.value) || 0 }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as 'inclusive' | 'exclusive' }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                  <option value="exclusive">Exclusive (added on top)</option>
                  <option value="inclusive">Inclusive (in price)</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Description</label>
              <input value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}>
                <input type="checkbox" checked={form.is_default} onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))} style={{ width: 16, height: 16 }} />
                Set as default rate
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: 'var(--color-text)' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ width: 16, height: 16 }} />
                Active
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
