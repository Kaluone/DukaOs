import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Barcode, Printer, RefreshCw, Search, Plus } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  selling_price: number
  category: string | null
}

function drawBarcode(canvas: HTMLCanvasElement, value: string, label: string, price: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  canvas.width = 200
  canvas.height = 80
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 200, 80)
  const chars = value.split('')
  let x = 10
  ctx.fillStyle = '#000'
  chars.forEach((c, i) => {
    const wide = parseInt(c, 16) % 3 === 0
    const w = wide ? 3 : 2
    if (i % 2 === 0) ctx.fillRect(x, 0, w, 50)
    x += w + 1
  })
  ctx.fillStyle = '#000'
  ctx.font = '7px monospace'
  ctx.textAlign = 'center'
  ctx.fillText(value, 100, 62)
  ctx.font = 'bold 7px sans-serif'
  ctx.fillText(label.slice(0, 24), 100, 72)
  ctx.font = '7px sans-serif'
  ctx.fillText(price, 100, 80)
}

function generateBarcode(productId: string): string {
  const hash = productId.replace(/-/g, '').slice(0, 12)
  const nums = hash.split('').map(c => parseInt(c, 16) % 10).join('').slice(0, 12)
  return nums.padEnd(12, '0')
}

export function BarcodePage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copies, setCopies] = useState(1)
  const printRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['barcode-products', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, barcode, selling_price, category')
        .eq('shop_id', shop!.id)
        .eq('active', true)
        .order('name')
      return (data ?? []) as Product[]
    },
  })

  const assignBarcodeMutation = useMutation({
    mutationFn: async (productId: string) => {
      const barcode = generateBarcode(productId)
      const { error } = await supabase.from('products').update({ barcode }).eq('id', productId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barcode-products', shop?.id] }),
  })

  const assignAllMutation = useMutation({
    mutationFn: async () => {
      const withoutBarcode = products.filter(p => !p.barcode)
      for (const p of withoutBarcode) {
        const barcode = generateBarcode(p.id)
        await supabase.from('products').update({ barcode }).eq('id', p.id)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['barcode-products', shop?.id] }),
  })

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(search.toLowerCase()) || (p.barcode ?? '').includes(search))

  useEffect(() => {
    filtered.forEach(p => {
      if (p.barcode) {
        const canvas = canvasRefs.current.get(p.id)
        if (canvas) {
          drawBarcode(canvas, p.barcode, p.name, `TZS ${p.selling_price.toLocaleString()}`)
        }
      }
    })
  }, [filtered])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) return
    const selectedProducts = products.filter(p => selected.has(p.id) && p.barcode)
    const labels = selectedProducts.flatMap(p => {
      const canvas = canvasRefs.current.get(p.id)
      const dataUrl = canvas?.toDataURL('image/png') ?? ''
      return Array.from({ length: copies }, () => `
        <div class="label">
          <img src="${dataUrl}" width="200" height="80" />
        </div>
      `)
    }).join('')

    printWindow.document.write(`
      <html><head><title>Barcodes</title>
      <style>
        body { margin: 0; padding: 10px; }
        .container { display: flex; flex-wrap: wrap; gap: 8px; }
        .label { border: 1px solid #eee; padding: 4px; page-break-inside: avoid; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="container">${labels}</div>
      <script>window.onload = () => { window.print(); window.close(); }</script>
      </body></html>
    `)
    printWindow.document.close()
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const withoutBarcode = products.filter(p => !p.barcode).length

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Barcode size={22} style={{ color: 'var(--color-primary)' }} /> Barcode Generator
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            Generate and print barcodes for your products
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {withoutBarcode > 0 && (
            <button onClick={() => assignAllMutation.mutate()} disabled={assignAllMutation.isPending} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
              <Plus size={14} /> Auto-assign {withoutBarcode} missing
            </button>
          )}
          <button onClick={handlePrint} disabled={selected.size === 0} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: selected.size > 0 ? 'var(--color-primary)' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, cursor: selected.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 13 }}>
            <Printer size={14} /> Print {selected.size > 0 ? `(${selected.size})` : 'Selected'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Copies:</label>
          <input type="number" min={1} max={20} value={copies} onChange={e => setCopies(parseInt(e.target.value) || 1)} style={{ width: 60, padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, textAlign: 'center' }} />
        </div>
        <button onClick={() => setSelected(new Set(filtered.filter(p => p.barcode).map(p => p.id)))} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>Select All</button>
        <button onClick={() => setSelected(new Set())} style={{ padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>Clear</button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : (
        <div ref={printRef} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {filtered.map(p => (
            <div key={p.id} onClick={() => p.barcode && toggleSelect(p.id)} style={{ background: 'var(--color-card)', border: `2px solid ${selected.has(p.id) ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 10, padding: 12, cursor: p.barcode ? 'pointer' : 'default', position: 'relative' }}>
              {selected.has(p.id) && (
                <div style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>✓</span>
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 8 }}>TZS {p.selling_price.toLocaleString()}</div>
              {p.barcode ? (
                <canvas ref={el => { if (el) { canvasRefs.current.set(p.id, el); drawBarcode(el, p.barcode!, p.name, `TZS ${p.selling_price.toLocaleString()}`) } }} style={{ width: '100%', height: 'auto', display: 'block' }} />
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 6 }}>No barcode assigned</div>
                  <button onClick={e => { e.stopPropagation(); assignBarcodeMutation.mutate(p.id) }} disabled={assignBarcodeMutation.isPending} style={{ padding: '5px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, margin: '0 auto' }}>
                    <RefreshCw size={11} /> Generate
                  </button>
                </div>
              )}
              {p.barcode && <div style={{ fontSize: 10, textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: 4, fontFamily: 'monospace' }}>{p.barcode}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
