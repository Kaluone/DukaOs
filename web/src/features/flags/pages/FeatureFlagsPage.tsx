import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Utensils, Scissors, ShoppingBag, Pill, Store, Zap } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

interface FeatureFlag {
  id: string
  flag_key: string
  is_enabled: boolean
  metadata: Record<string, unknown>
}

const FLAG_CONFIG: Record<string, { label: string; desc: string; icon: React.FC<any>; color: string; tags: string[] }> = {
  restaurant_mode: { label: 'Restaurant Mode', desc: 'Table management, kitchen orders, and menu categories for restaurants and cafes.', icon: Utensils, color: '#f59e0b', tags: ['Tables', 'Kitchen Display', 'Menu Courses'] },
  salon_mode: { label: 'Salon & Spa Mode', desc: 'Appointment scheduling, service timers, and stylist assignment for salons and spas.', icon: Scissors, color: '#ec4899', tags: ['Appointments', 'Services', 'Staff Schedule'] },
  wholesale_mode: { label: 'Wholesale Mode', desc: 'Tiered pricing, bulk discounts, and minimum order quantities for B2B businesses.', icon: ShoppingBag, color: '#3b82f6', tags: ['Tiered Pricing', 'Bulk Discounts', 'MOQ'] },
  pharmacy_mode: { label: 'Pharmacy Mode', desc: 'Prescription tracking, batch/expiry management, and controlled substance alerts.', icon: Pill, color: '#16a34a', tags: ['Prescriptions', 'Batch Tracking', 'Expiry Alerts'] },
  retail_mode: { label: 'Retail Mode', desc: 'Standard retail POS with barcode scanning, returns, and loyalty — the default configuration.', icon: Store, color: '#7c3aed', tags: ['Barcode', 'Returns', 'Loyalty'] },
  advanced_analytics: { label: 'Advanced Analytics', desc: 'AI-powered insights, predictive reorder, and detailed performance charts.', icon: Zap, color: '#6366f1', tags: ['AI Insights', 'Predictive', 'Charts'] },
}

export function FeatureFlagsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()

  const { data: flags = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['feature-flags', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_flags').select('*').eq('shop_id', shop!.id)
      if (error) throw error
      return (data ?? []) as FeatureFlag[]
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      if (!shop?.id) throw new Error('No shop')
      const existing = flags.find(f => f.flag_key === key)
      if (existing) {
        await supabase.from('feature_flags').update({ is_enabled: enabled }).eq('id', existing.id)
      } else {
        await supabase.from('feature_flags').insert({ shop_id: shop.id, flag_key: key, is_enabled: enabled, metadata: {} })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-flags', shop?.id] }),
  })

  const isEnabled = (key: string) => flags.find(f => f.flag_key === key)?.is_enabled ?? false

  return (
    <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flag size={22} style={{ color: 'var(--color-primary)' }} /> Business Mode & Features
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
          Enable specialized modes and features tailored to your business type
        </p>
      </div>

      <div style={{ background: 'var(--color-card)', border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400e', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Zap size={16} style={{ flexShrink: 0, marginTop: 1, color: '#f59e0b' }} />
        <span>Feature modes customize your POS workflow. You can enable multiple modes simultaneously or switch between them. Changes take effect immediately.</span>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px,1fr))', gap: 14 }}>
          {Object.entries(FLAG_CONFIG).map(([key, config]) => {
            const enabled = isEnabled(key)
            const Icon = config.icon
            return (
              <div key={key} style={{ background: 'var(--color-card)', border: `2px solid ${enabled ? config.color : 'var(--color-border)'}`, borderRadius: 12, padding: 20, transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${config.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} style={{ color: config.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{config.label}</div>
                      <div style={{ fontSize: 11, color: enabled ? config.color : '#6b7280', fontWeight: 700 }}>{enabled ? 'ENABLED' : 'DISABLED'}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleMutation.mutate({ key, enabled: !enabled })}
                    disabled={toggleMutation.isPending}
                    style={{ flexShrink: 0 }}
                  >
                    <div style={{ width: 48, height: 26, borderRadius: 13, background: enabled ? config.color : '#d1d5db', position: 'relative', cursor: 'pointer', border: 'none', padding: 0, transition: 'background 0.2s' }}>
                      <div style={{ position: 'absolute', top: 3, left: enabled ? 24 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </button>
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 10 }}>{config.desc}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {config.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 11, background: enabled ? `${config.color}15` : 'var(--color-bg)', color: enabled ? config.color : 'var(--color-text-secondary)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>{tag}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
