import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Sparkles, Trash2, AlertTriangle, Package, Users, ShoppingCart, TrendingUp } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

const DEMO_PRODUCTS = [
  { name: 'Unga wa Ugali 2kg', price: 4500, category: 'Groceries' },
  { name: 'Sukari 1kg', price: 2800, category: 'Groceries' },
  { name: 'Mafuta ya Alizeti 1L', price: 5500, category: 'Cooking' },
  { name: 'Sabuni ya Kufulia 500g', price: 1800, category: 'Cleaning' },
  { name: 'Chumvi 1kg', price: 800, category: 'Groceries' },
  { name: 'Chai Kibo 100g', price: 2200, category: 'Beverages' },
  { name: 'Mkate wa Sandwichi', price: 3500, category: 'Bakery' },
  { name: 'Maziwa Fresh 1L', price: 2500, category: 'Dairy' },
  { name: 'Mchele Superio 2kg', price: 7500, category: 'Groceries' },
  { name: 'Ndizi (bunch)', price: 4000, category: 'Fresh Produce' },
]

const DEMO_CUSTOMERS = [
  { name: 'Amina Juma', phone: '+255712345678' },
  { name: 'Hassan Makame', phone: '+255787654321' },
  { name: 'Fatuma Said', phone: '+255765432109' },
  { name: 'Omar Rashid', phone: '+255754321098' },
  { name: 'Zainab Ali', phone: '+255743210987' },
]

export function DemoModePage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [log, setLog] = useState<string[]>([])
  const [showConfirmClear, setShowConfirmClear] = useState(false)

  const addLog = (msg: string) => setLog(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev])

  const loadDemoMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      addLog('Starting demo data load…')

      const productIds: string[] = []
      for (const p of DEMO_PRODUCTS) {
        const { data: existing } = await supabase.from('products').select('id').eq('shop_id', shop.id).eq('name', p.name).single()
        if (existing) { productIds.push(existing.id); addLog(`ℹ️ Product already exists: ${p.name}`); continue }
        const { data: prod, error } = await supabase.from('products').insert({ shop_id: shop.id, ...p, active: true }).select('id').single()
        if (error) throw error
        productIds.push(prod.id)
        await supabase.from('stock_levels').insert({ shop_id: shop.id, product_id: prod.id, quantity: Math.floor(Math.random() * 100) + 20, reorder_threshold: 5 })
        addLog(`✅ Created product: ${p.name}`)
      }

      for (const c of DEMO_CUSTOMERS) {
        const { data: existing } = await supabase.from('customers').select('id').eq('shop_id', shop.id).eq('name', c.name).single()
        if (existing) { addLog(`ℹ️ Customer already exists: ${c.name}`); continue }
        await supabase.from('customers').insert({ shop_id: shop.id, ...c, active: true, loyalty_points: Math.floor(Math.random() * 500) })
        addLog(`✅ Created customer: ${c.name}`)
      }

      for (let i = 0; i < 5; i++) {
        const randomProducts = productIds.slice(0, Math.floor(Math.random() * 3) + 1)
        const items = randomProducts.map(pid => {
          const prod = DEMO_PRODUCTS[productIds.indexOf(pid)]
          return { product_id: pid, quantity: Math.floor(Math.random() * 3) + 1, unit_price: prod?.price ?? 1000 }
        })
        const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0)
        const daysAgo = Math.floor(Math.random() * 30)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        const { data: txn } = await supabase.from('transactions').insert({
          shop_id: shop.id,
          payment_method: ['cash', 'mpesa', 'tigopesa'][Math.floor(Math.random() * 3)],
          total_amount: total,
          sync_status: 'synced',
          created_at: date.toISOString(),
        }).select('id').single()
        if (txn) {
          await supabase.from('transaction_items').insert(items.map(it => ({
            transaction_id: txn.id, shop_id: shop.id,
            product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price,
          })))
        }
      }
      addLog('✅ Created 5 demo transactions')

      for (let i = 0; i < 3; i++) {
        const categories = ['Rent', 'Utilities', 'Supplies', 'Salaries']
        const daysAgo = Math.floor(Math.random() * 30)
        const date = new Date()
        date.setDate(date.getDate() - daysAgo)
        await supabase.from('expenses').insert({
          shop_id: shop.id,
          category: categories[Math.floor(Math.random() * categories.length)],
          amount: Math.floor(Math.random() * 100000) + 10000,
          expense_date: date.toISOString().split('T')[0],
          description: `Demo expense ${i + 1}`,
        })
      }
      addLog('✅ Created 3 demo expenses')
      addLog('🎉 Demo data loaded successfully!')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pos-products'] })
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
    onError: (e: Error) => addLog(`❌ Error: ${e.message}`),
  })

  const clearDemoMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      addLog('Clearing demo data…')
      const demoNames = DEMO_PRODUCTS.map(p => p.name)
      const { data: prods } = await supabase.from('products').select('id').eq('shop_id', shop.id).in('name', demoNames)
      if (prods?.length) {
        await supabase.from('stock_levels').delete().in('product_id', prods.map(p => p.id))
        await supabase.from('products').delete().in('id', prods.map(p => p.id))
        addLog(`✅ Removed ${prods.length} demo products`)
      }
      const custNames = DEMO_CUSTOMERS.map(c => c.name)
      await supabase.from('customers').delete().eq('shop_id', shop.id).in('name', custNames)
      addLog('✅ Removed demo customers')
      addLog('🗑️ Demo data cleared')
    },
    onSuccess: () => {
      qc.invalidateQueries()
      setShowConfirmClear(false)
    },
    onError: (e: Error) => addLog(`❌ Error: ${e.message}`),
  })

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <FlaskConical size={22} style={{ color: '#7c3aed' }} /> Demo Mode
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
          Load sample data to explore DukaOS features without affecting real data
        </p>
      </div>

      <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: 13, color: '#92400e' }}>
          Demo mode loads sample products, customers, and transactions. All sample data can be removed using "Clear Demo Data". Your existing data will not be affected.
        </span>
      </div>

      {/* Preview cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Sample Products', count: DEMO_PRODUCTS.length, icon: Package, color: '#3b82f6' },
          { label: 'Sample Customers', count: DEMO_CUSTOMERS.length, icon: Users, color: '#16a34a' },
          { label: 'Sample Transactions', count: 5, icon: ShoppingCart, color: '#f59e0b' },
          { label: 'Sample Expenses', count: 3, icon: TrendingUp, color: '#dc2626' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
            <card.icon size={24} style={{ color: card.color, marginBottom: 6 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.count}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{card.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={() => loadDemoMutation.mutate()} disabled={loadDemoMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          <Sparkles size={16} /> {loadDemoMutation.isPending ? 'Loading…' : 'Load Demo Data'}
        </button>
        <button onClick={() => setShowConfirmClear(true)} disabled={clearDemoMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'transparent', color: '#dc2626', border: '1px solid #dc2626', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          <Trash2 size={16} /> Clear Demo Data
        </button>
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div style={{ background: '#1e1e2e', borderRadius: 10, padding: 14, fontFamily: 'monospace', fontSize: 12 }}>
          <div style={{ color: '#7c3aed', fontWeight: 700, marginBottom: 8 }}>Activity Log</div>
          {log.map((line, i) => (
            <div key={i} style={{ color: line.includes('❌') ? '#f87171' : line.includes('✅') ? '#86efac' : line.includes('🎉') ? '#fbbf24' : '#e2e8f0', marginBottom: 3 }}>{line}</div>
          ))}
        </div>
      )}

      {showConfirmClear && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--color-card)', borderRadius: 12, padding: 24, maxWidth: 420, margin: '0 16px' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Clear Demo Data?</h3>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20 }}>This will remove all sample products and customers created by demo mode. Your real data will not be affected.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowConfirmClear(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => clearDemoMutation.mutate()} disabled={clearDemoMutation.isPending} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                {clearDemoMutation.isPending ? 'Clearing…' : 'Yes, Clear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
