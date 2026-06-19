import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Save, Eye, EyeOff, QrCode } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

interface ReceiptTemplate {
  id: string
  name: string
  is_default: boolean
  header_text: string | null
  footer_text: string | null
  show_logo: boolean
  show_qr: boolean
  show_barcode: boolean
  paper_width: number
  font_size: number
  show_tax_breakdown: boolean
  show_discount: boolean
  show_cashier: boolean
  custom_css: string | null
}

const DEFAULT_TEMPLATE: Omit<ReceiptTemplate, 'id'> = {
  name: 'Default Receipt',
  is_default: true,
  header_text: '',
  footer_text: 'Thank you for your business!',
  show_logo: true,
  show_qr: false,
  show_barcode: false,
  paper_width: 80,
  font_size: 12,
  show_tax_breakdown: true,
  show_discount: true,
  show_cashier: true,
  custom_css: null,
}

export function ReceiptDesignerPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [showPreview, setShowPreview] = useState(true)
  const [form, setForm] = useState<Omit<ReceiptTemplate, 'id'>>(DEFAULT_TEMPLATE)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const { data: template } = useQuery<ReceiptTemplate | null>({
    queryKey: ['receipt-template', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('receipt_templates')
        .select('*')
        .eq('shop_id', shop!.id)
        .eq('is_default', true)
        .single()
      return data as ReceiptTemplate | null
    },
  })

  useEffect(() => {
    if (template) {
      setForm({ name: template.name, is_default: template.is_default, header_text: template.header_text ?? '', footer_text: template.footer_text ?? '', show_logo: template.show_logo, show_qr: template.show_qr, show_barcode: template.show_barcode, paper_width: template.paper_width, font_size: template.font_size, show_tax_breakdown: template.show_tax_breakdown, show_discount: template.show_discount, show_cashier: template.show_cashier, custom_css: template.custom_css })
    }
  }, [template])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      const payload = { ...form, shop_id: shop.id, header_text: form.header_text || null, footer_text: form.footer_text || null }
      if (template?.id) {
        const { error } = await supabase.from('receipt_templates').update(payload).eq('id', template.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('receipt_templates').insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipt-template', shop?.id] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (e: Error) => setError(e.message),
  })

  const toggle = (key: keyof typeof form) => setForm(p => ({ ...p, [key]: !p[key] }))

  const previewWidth = Math.min(form.paper_width * 2.5, 280)

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileText size={22} style={{ color: 'var(--color-primary)' }} /> Receipt Designer
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Customize your printed and digital receipts</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowPreview(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
            {showPreview ? <EyeOff size={15} /> : <Eye size={15} />} {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button onClick={() => { setError(''); saveMutation.mutate() }} disabled={saveMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: saved ? '#16a34a' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            <Save size={15} /> {saved ? 'Saved!' : saveMutation.isPending ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr auto' : '1fr', gap: 20, alignItems: 'start' }}>
        {/* Settings Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header/Footer */}
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>Content</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Header Text</label>
              <textarea value={form.header_text ?? ''} onChange={e => setForm(p => ({ ...p, header_text: e.target.value }))} rows={2} placeholder="Business tagline, address, phone..." style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Footer Text</label>
              <textarea value={form.footer_text ?? ''} onChange={e => setForm(p => ({ ...p, footer_text: e.target.value }))} rows={2} placeholder="Thank you message, return policy..." style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Layout */}
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>Layout</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Paper Width (mm)</label>
                <select value={form.paper_width} onChange={e => setForm(p => ({ ...p, paper_width: parseInt(e.target.value) }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                  <option value={58}>58mm (narrow)</option>
                  <option value={80}>80mm (standard)</option>
                  <option value={110}>110mm (wide)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Font Size</label>
                <select value={form.font_size} onChange={e => setForm(p => ({ ...p, font_size: parseInt(e.target.value) }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                  <option value={10}>Small (10px)</option>
                  <option value={12}>Medium (12px)</option>
                  <option value={14}>Large (14px)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>Sections</h3>
            {[
              { key: 'show_logo', label: 'Show business logo', desc: 'Prints your logo at the top' },
              { key: 'show_qr', label: 'Show QR code', desc: 'Encodes transaction ID for verification' },
              { key: 'show_barcode', label: 'Show barcode', desc: 'Prints receipt barcode' },
              { key: 'show_tax_breakdown', label: 'Show tax breakdown', desc: 'Line showing tax amount' },
              { key: 'show_discount', label: 'Show discounts', desc: 'Line showing discount applied' },
              { key: 'show_cashier', label: 'Show cashier name', desc: 'Prints who processed the sale' },
            ].map(opt => (
              <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{opt.desc}</div>
                </div>
                <button onClick={() => toggle(opt.key as keyof typeof form)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: form[opt.key as keyof typeof form] ? '#16a34a' : '#6b7280' }}>
                  {form[opt.key as keyof typeof form] ? (
                    <div style={{ width: 44, height: 24, borderRadius: 12, background: '#16a34a', position: 'relative' }}>
                      <div style={{ position: 'absolute', right: 2, top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  ) : (
                    <div style={{ width: 44, height: 24, borderRadius: 12, background: '#d1d5db', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 2, top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div style={{ width: previewWidth + 40, flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Preview — {form.paper_width}mm
            </div>
            <div style={{ width: previewWidth, margin: '0 auto', background: '#fff', color: '#000', fontFamily: 'monospace', fontSize: form.font_size, padding: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', borderRadius: 4, userSelect: 'none' }}>
              {form.show_logo && <div style={{ textAlign: 'center', marginBottom: 6, fontSize: form.font_size + 2, fontWeight: 700 }}>[LOGO]</div>}
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: form.font_size + 4, marginBottom: 2 }}>{shop?.name ?? 'Your Business'}</div>
              {form.header_text && <div style={{ textAlign: 'center', fontSize: form.font_size - 1, color: '#666', marginBottom: 6, whiteSpace: 'pre-wrap' }}>{form.header_text}</div>}
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: form.font_size - 1 }}>
                <span>Date:</span><span>18/06/2026</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: form.font_size - 1 }}>
                <span>Ref:</span><span>#00001</span>
              </div>
              {form.show_cashier && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: form.font_size - 1 }}><span>Cashier:</span><span>John</span></div>}
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Bread 2kg</span><span>TSh 4,000</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sugar 1kg</span><span>TSh 2,500</span></div>
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              {form.show_discount && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: form.font_size - 1 }}><span>Discount</span><span>-TSh 500</span></div>}
              {form.show_tax_breakdown && <div style={{ display: 'flex', justifyContent: 'space-between', color: '#666', fontSize: form.font_size - 1 }}><span>VAT 18%</span><span>TSh 1,080</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: form.font_size + 2, marginTop: 4 }}><span>TOTAL</span><span>TSh 7,080</span></div>
              <div style={{ borderTop: '1px dashed #ccc', margin: '6px 0' }} />
              {form.show_qr && <div style={{ textAlign: 'center', margin: '8px 0' }}><QrCode size={40} style={{ display: 'inline-block' }} /></div>}
              {form.footer_text && <div style={{ textAlign: 'center', fontSize: form.font_size - 1, color: '#666', marginTop: 6, whiteSpace: 'pre-wrap' }}>{form.footer_text}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
