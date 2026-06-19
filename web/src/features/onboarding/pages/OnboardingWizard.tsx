import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Building2, MapPin, Package, Users, CreditCard, CheckCircle, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

type Step = 'business' | 'branch' | 'products' | 'staff' | 'payments' | 'complete'

const STEPS: { id: Step; label: string; icon: React.FC<any> }[] = [
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'branch', label: 'Branch', icon: MapPin },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'complete', label: 'Complete', icon: CheckCircle },
]

interface BusinessInfo { name: string; phone: string; address: string; business_type: string }
interface BranchInfo { name: string; address: string; phone: string }
interface ProductInfo { name: string; selling_price: string; stock_quantity: string; category: string }
interface StaffInfo { full_name: string; email: string; role: string }

export function OnboardingWizard() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('business')
  const [error, setError] = useState('')

  const [business, setBusiness] = useState<BusinessInfo>({ name: shop?.name ?? '', phone: '', address: '', business_type: 'retail' })
  const [branch, setBranch] = useState<BranchInfo>({ name: 'Main Branch', address: '', phone: '' })
  const [products, setProducts] = useState<ProductInfo[]>([{ name: '', selling_price: '', stock_quantity: '0', category: '' }])
  const [staff, setStaff] = useState<StaffInfo[]>([])
  const [payments, setPayments] = useState({ cash: true, mobile_money: true, card: false, credit: false })

  const currentIndex = STEPS.findIndex(s => s.id === step)

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id || !user?.id) throw new Error('Not authenticated')

      if (step === 'business') {
        await supabase.from('shops').update({ name: business.name.trim(), phone: business.phone || null, address: business.address || null }).eq('id', shop.id)
      }

      if (step === 'branch') {
        const existing = await supabase.from('branches').select('id').eq('shop_id', shop.id).eq('is_main', true).single()
        if (existing.data) {
          await supabase.from('branches').update({ name: branch.name, address: branch.address || null, phone: branch.phone || null }).eq('id', existing.data.id)
        } else {
          await supabase.from('branches').insert({ shop_id: shop.id, name: branch.name, address: branch.address || null, phone: branch.phone || null, is_main: true, is_active: true })
        }
      }

      if (step === 'products') {
        const validProducts = products.filter(p => p.name.trim() && parseFloat(p.selling_price) > 0)
        for (const p of validProducts) {
          const { data: product } = await supabase.from('products').insert({
            shop_id: shop.id, name: p.name.trim(), selling_price: parseFloat(p.selling_price),
            category: p.category || null, active: true, type: 'physical',
          }).select('id').single()
          if (product) {
            await supabase.from('stock_levels').insert({ shop_id: shop.id, product_id: product.id, quantity: parseInt(p.stock_quantity) || 0, low_stock_threshold: 5 })
          }
        }
      }

      if (step === 'staff') {
        for (const s of staff.filter(s => s.full_name.trim() && s.email.trim())) {
          await supabase.from('staff').insert({ shop_id: shop.id, full_name: s.full_name.trim(), email: s.email.trim(), role: s.role, is_active: true })
        }
      }

      if (step === 'payments') {
        const methods = Object.entries(payments).filter(([, v]) => v).map(([k]) => k)
        await supabase.from('shops').update({ payment_methods: methods }).eq('id', shop.id)
        await supabase.from('shops').update({ onboarding_completed: true }).eq('id', shop.id)
      }
    },
    onSuccess: () => {
      const nextIndex = currentIndex + 1
      if (nextIndex < STEPS.length) {
        setStep(STEPS[nextIndex].id)
        setError('')
      }
    },
    onError: (e: Error) => setError(e.message),
  })

  const handleNext = () => {
    if (step === 'business' && !business.name.trim()) { setError('Business name is required'); return }
    setError('')
    saveMutation.mutate()
  }

  const handleBack = () => {
    const prev = STEPS[currentIndex - 1]
    if (prev) setStep(prev.id)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Progress */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          {STEPS.map((s, i) => {
            const done = i < currentIndex
            const active = s.id === step
            const Icon = s.icon
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: done ? 'var(--color-primary)' : active ? 'var(--color-primary)20' : 'var(--color-card)', border: `2px solid ${active || done ? 'var(--color-primary)' : 'var(--color-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {done ? <CheckCircle size={18} style={{ color: 'var(--color-primary)' }} fill="white" /> : <Icon size={16} style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />}
                  </div>
                  <span style={{ fontSize: 10, color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: active ? 700 : 400, display: 'none' }}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ width: 40, height: 2, background: i < currentIndex ? 'var(--color-primary)' : 'var(--color-border)', margin: '0 4px', marginBottom: 4 }} />}
              </div>
            )
          })}
        </div>

        <div style={{ background: 'var(--color-card)', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

          {step === 'business' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Tell us about your business</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>This information appears on your receipts and reports.</p>
              {[{ key: 'name', label: 'Business Name *', placeholder: 'e.g. Mama Pima Store' }, { key: 'phone', label: 'Phone', placeholder: '+255 7XX XXX XXX' }, { key: 'address', label: 'Address', placeholder: 'Street, City' }].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input value={business[f.key as keyof BusinessInfo]} onChange={e => setBusiness(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Business Type</label>
                <select value={business.business_type} onChange={e => setBusiness(p => ({ ...p, business_type: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                  <option value="retail">Retail Shop</option>
                  <option value="restaurant">Restaurant / Cafe</option>
                  <option value="salon">Salon / Spa</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="wholesale">Wholesale</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {step === 'branch' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Set up your main location</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>You can add more branches later from the Branches section.</p>
              {[{ key: 'name', label: 'Branch Name *', placeholder: 'e.g. Main Branch, Downtown Store' }, { key: 'address', label: 'Address', placeholder: 'Location address' }, { key: 'phone', label: 'Branch Phone', placeholder: '+255 7XX XXX XXX' }].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input value={branch[f.key as keyof BranchInfo]} onChange={e => setBranch(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
          )}

          {step === 'products' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Add your first products</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>Add a few products to get started. You can import more later via the Bulk Import feature.</p>
              {products.map((p, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input value={p.name} onChange={e => setProducts(prev => prev.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} placeholder="Product name" style={{ padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  <input type="number" value={p.selling_price} onChange={e => setProducts(prev => prev.map((r, j) => j === i ? { ...r, selling_price: e.target.value } : r))} placeholder="Price (TZS)" style={{ padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  <input type="number" value={p.stock_quantity} onChange={e => setProducts(prev => prev.map((r, j) => j === i ? { ...r, stock_quantity: e.target.value } : r))} placeholder="Stock qty" style={{ padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              ))}
              <button onClick={() => setProducts(p => [...p, { name: '', selling_price: '', stock_quantity: '0', category: '' }])} style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>+ Add another product</button>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 8 }}>You can skip this step and add products later.</p>
            </div>
          )}

          {step === 'staff' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Add your team</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>Staff will receive an invitation email. This step is optional.</p>
              {staff.map((s, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <input value={s.full_name} onChange={e => setStaff(prev => prev.map((r, j) => j === i ? { ...r, full_name: e.target.value } : r))} placeholder="Full name" style={{ padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  <input value={s.email} onChange={e => setStaff(prev => prev.map((r, j) => j === i ? { ...r, email: e.target.value } : r))} placeholder="Email" style={{ padding: '9px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
                  <button onClick={() => setStaff(prev => prev.filter((_, j) => j !== i))} style={{ padding: '0 12px', background: '#fee2e2', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#dc2626', fontSize: 18 }}>×</button>
                </div>
              ))}
              <button onClick={() => setStaff(p => [...p, { full_name: '', email: '', role: 'cashier' }])} style={{ fontSize: 13, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4 }}>+ Add staff member</button>
            </div>
          )}

          {step === 'payments' && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>Payment methods</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>Choose the payment methods you accept at your business.</p>
              {[{ key: 'cash', label: 'Cash', desc: 'Physical cash payments' }, { key: 'mobile_money', label: 'Mobile Money', desc: 'M-Pesa, Airtel Money, Halopesa, TigoPesa' }, { key: 'card', label: 'Card', desc: 'Visa, Mastercard via POS terminal' }, { key: 'credit', label: 'Credit / Buy on Account', desc: 'Allow customers to pay later' }].map(m => (
                <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--color-bg)', borderRadius: 10, marginBottom: 8, cursor: 'pointer' }} onClick={() => setPayments(p => ({ ...p, [m.key]: !p[m.key as keyof typeof payments] }))}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{m.desc}</div>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${payments[m.key as keyof typeof payments] ? 'var(--color-primary)' : 'var(--color-border)'}`, background: payments[m.key as keyof typeof payments] ? 'var(--color-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {payments[m.key as keyof typeof payments] && <CheckCircle size={14} color="#fff" />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 'complete' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Sparkles size={36} style={{ color: '#16a34a' }} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>You're all set!</h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginBottom: 28 }}>
                Your DukaOS is ready. Start selling with the POS, manage inventory, and grow your business.
              </p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => navigate('/pos')} style={{ padding: '10px 24px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                  Open POS
                </button>
                <button onClick={() => navigate('/dashboard')} style={{ padding: '10px 24px', background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 15 }}>
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}

          {step !== 'complete' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28 }}>
              {currentIndex > 0 ? (
                <button onClick={handleBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: 600 }}>
                  <ChevronLeft size={16} /> Back
                </button>
              ) : <div />}
              <div style={{ display: 'flex', gap: 8 }}>
                {(step === 'products' || step === 'staff') && (
                  <button onClick={() => { const next = STEPS[currentIndex + 1]; if (next) setStep(next.id) }} style={{ padding: '10px 20px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>
                    Skip
                  </button>
                )}
                <button onClick={handleNext} disabled={saveMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                  {saveMutation.isPending ? 'Saving…' : step === 'payments' ? 'Finish Setup' : 'Continue'}
                  {!saveMutation.isPending && <ChevronRight size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Step {currentIndex + 1} of {STEPS.length}
        </div>
      </div>
    </div>
  )
}
