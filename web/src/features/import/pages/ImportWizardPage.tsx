import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, AlertTriangle, ChevronRight, RotateCcw, Download } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

type ImportType = 'products' | 'customers' | 'suppliers'
type Step = 'upload' | 'map' | 'preview' | 'done'

interface RowPreview {
  row: number
  data: Record<string, string>
  status: 'new' | 'duplicate' | 'error'
  error?: string
}

const TEMPLATES: Record<ImportType, { headers: string[]; example: string[] }> = {
  products: {
    headers: ['name', 'selling_price', 'buying_price', 'category', 'sku', 'barcode', 'stock_quantity'],
    example: ['Unga wa Ugali', '4500', '3800', 'Groceries', 'UG001', '', '50'],
  },
  customers: {
    headers: ['name', 'phone', 'email', 'address'],
    example: ['Amina Juma', '+255712345678', 'amina@example.com', 'Dar es Salaam'],
  },
  suppliers: {
    headers: ['name', 'phone', 'email', 'address', 'contact_person'],
    example: ['Karibu Wholesalers', '+255754321098', 'info@karibu.co.tz', 'Kariakoo, Dar', 'John'],
  },
}

function parseCSV(text: string): string[][] {
  return text.trim().split('\n').map(line =>
    line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
  )
}

export function ImportWizardPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [importType, setImportType] = useState<ImportType>('products')
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<RowPreview[]>([])
  const [error, setError] = useState('')
  const [importedCount, setImportedCount] = useState(0)

  const template = TEMPLATES[importType]

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      if (rows.length < 2) { setError('File must have a header row and at least one data row'); return }
      setHeaders(rows[0])
      setRawRows(rows.slice(1))
      const autoMap: Record<string, string> = {}
      for (const field of template.headers) {
        const match = rows[0].find(h => h.toLowerCase() === field.toLowerCase() || h.toLowerCase().replace(/\s+/g, '_') === field)
        if (match) autoMap[field] = match
      }
      setMapping(autoMap)
      setError('')
      setStep('map')
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const buildPreview = () => {
    const rows: RowPreview[] = rawRows.slice(0, 20).map((row, i) => {
      const data: Record<string, string> = {}
      for (const [field, col] of Object.entries(mapping)) {
        const idx = headers.indexOf(col)
        data[field] = idx >= 0 ? (row[idx] ?? '') : ''
      }
      if (importType === 'products' && !data.name) return { row: i + 2, data, status: 'error' as const, error: 'Name required' }
      if (importType === 'products' && !data.selling_price) return { row: i + 2, data, status: 'error' as const, error: 'Price required' }
      if (importType === 'customers' && !data.name) return { row: i + 2, data, status: 'error' as const, error: 'Name required' }
      if (importType === 'suppliers' && !data.name) return { row: i + 2, data, status: 'error' as const, error: 'Name required' }
      return { row: i + 2, data, status: 'new' as const }
    })
    setPreview(rows)
    setStep('preview')
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      const validRows = preview.filter(r => r.status === 'new')
      let count = 0
      if (importType === 'products') {
        for (const row of validRows) {
          const { data: prod, error: pe } = await supabase.from('products').insert({
            shop_id: shop.id,
            name: row.data.name, selling_price: parseFloat(row.data.selling_price) || 0,
            buying_price: parseFloat(row.data.buying_price) || 0,
            category: row.data.category || null, sku: row.data.sku || null,
            barcode: row.data.barcode || null, active: true, type: 'physical',
          }).select('id').single()
          if (!pe && prod) {
            await supabase.from('stock_levels').insert({ shop_id: shop.id, product_id: prod.id, quantity: parseInt(row.data.stock_quantity) || 0, low_stock_threshold: 5 })
            count++
          }
        }
        qc.invalidateQueries({ queryKey: ['pos-products', shop.id] })
      } else if (importType === 'customers') {
        for (const row of validRows) {
          await supabase.from('customers').insert({ shop_id: shop.id, name: row.data.name, phone: row.data.phone || null, email: row.data.email || null, address: row.data.address || null, active: true, loyalty_points: 0 })
          count++
        }
        qc.invalidateQueries({ queryKey: ['customers', shop.id] })
      } else {
        for (const row of validRows) {
          await supabase.from('suppliers').insert({ shop_id: shop.id, name: row.data.name, phone: row.data.phone || null, email: row.data.email || null, address: row.data.address || null, contact_person: row.data.contact_person || null, active: true })
          count++
        }
        qc.invalidateQueries({ queryKey: ['suppliers-list', shop.id] })
      }
      setImportedCount(count)
    },
    onSuccess: () => setStep('done'),
    onError: (e: Error) => setError(e.message),
  })

  const downloadTemplate = () => {
    const csv = [template.headers.join(','), template.example.join(',')].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${importType}-template.csv`
    a.click()
  }

  const reset = () => {
    setStep('upload'); setRawRows([]); setHeaders([]); setMapping({}); setPreview([]); setError(''); setImportedCount(0)
  }

  return (
    <div style={{ padding: '24px', maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Upload size={22} style={{ color: 'var(--color-primary)' }} /> Import Wizard
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Import products, customers, and suppliers from CSV files</p>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, overflow: 'hidden', borderRadius: 10 }}>
        {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => (
          <div key={s} style={{ flex: 1, padding: '10px 0', textAlign: 'center', background: step === s ? 'var(--color-primary)' : i < ['upload', 'map', 'preview', 'done'].indexOf(step) ? `${getComputedStyle(document.documentElement).getPropertyValue('--color-primary') || '#6366f1'}40` : 'var(--color-card)', color: step === s ? '#fff' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: step === s ? 700 : 400, borderRight: i < 3 ? '1px solid var(--color-border)' : 'none', textTransform: 'capitalize' }}>
            {s}
          </div>
        ))}
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}

      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['products', 'customers', 'suppliers'] as ImportType[]).map(t => (
              <button key={t} onClick={() => setImportType(t)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `2px solid ${importType === t ? 'var(--color-primary)' : 'var(--color-border)'}`, background: importType === t ? 'var(--color-primary)10' : 'transparent', color: importType === t ? 'var(--color-primary)' : 'var(--color-text)', cursor: 'pointer', fontWeight: importType === t ? 700 : 400, textTransform: 'capitalize', fontSize: 14 }}>
                {t}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
              <Download size={14} /> Download {importType} template
            </button>
          </div>
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--color-border)', borderRadius: 12, padding: 48, textAlign: 'center', cursor: 'pointer', background: 'var(--color-card)' }}>
            <FileText size={36} style={{ color: 'var(--color-primary)', marginBottom: 12 }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Drop CSV file here or click to browse</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Supports .csv files · Max 10,000 rows</p>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {step === 'map' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Map CSV columns to {importType} fields</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {template.headers.map(field => (
              <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 160, fontSize: 13, fontWeight: 600, color: 'var(--color-text)', textTransform: 'capitalize' }}>{field.replace(/_/g, ' ')}</span>
                <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} />
                <select value={mapping[field] ?? ''} onChange={e => setMapping(p => ({ ...p, [field]: e.target.value }))} style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14 }}>
                  <option value="">— skip —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={{ padding: '9px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Back</button>
            <button onClick={buildPreview} style={{ padding: '9px 20px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Preview Import</button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>{preview.filter(r => r.status === 'new').length} valid rows</span>
            <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{preview.filter(r => r.status === 'error').length} errors</span>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>(showing first 20)</span>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid var(--color-border)', borderRadius: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 700 }}>Row</th>
                  {template.headers.slice(0, 4).map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'capitalize' }}>{h.replace(/_/g, ' ')}</th>
                  ))}
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 700 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.map(row => (
                  <tr key={row.row} style={{ borderTop: '1px solid var(--color-border)', background: row.status === 'error' ? '#fee2e210' : 'transparent' }}>
                    <td style={{ padding: '7px 12px', fontSize: 12, color: 'var(--color-text-secondary)' }}>{row.row}</td>
                    {template.headers.slice(0, 4).map(h => (
                      <td key={h} style={{ padding: '7px 12px', fontSize: 13, color: 'var(--color-text)' }}>{row.data[h] || '—'}</td>
                    ))}
                    <td style={{ padding: '7px 12px' }}>
                      {row.status === 'error' ? (
                        <span style={{ fontSize: 11, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}><AlertTriangle size={11} /> {row.error}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}><CheckCircle size={11} /> Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setStep('map')} style={{ padding: '9px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Back</button>
            <button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || preview.filter(r => r.status === 'new').length === 0} style={{ padding: '9px 24px', background: preview.filter(r => r.status === 'new').length > 0 ? 'var(--color-primary)' : '#ccc', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              {importMutation.isPending ? 'Importing…' : `Import ${preview.filter(r => r.status === 'new').length} Records`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={36} style={{ color: '#16a34a' }} />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>Import Complete!</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 15, marginBottom: 24 }}>
            Successfully imported {importedCount} {importType}.
          </p>
          <button onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, margin: '0 auto' }}>
            <RotateCcw size={15} /> Import More
          </button>
        </div>
      )}
    </div>
  )
}
