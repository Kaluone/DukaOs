import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, Table2, ChevronRight, Check, X, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Papa from 'papaparse'
import { supabase } from '@/shared/lib/supabaseClient'
import { useT } from '@/shared/i18n/useLanguage'
import type { TranslationKey } from '@/shared/i18n/translations'

// ── Column alias map (Swahili + English) ─────────────────────────────────────
const ALIASES: Record<string, string> = {
  // name
  name:'name', jina:'name', 'product name':'name', 'item name':'name',
  bidhaa:'name', item:'name', 'jina la bidhaa':'name', product:'name',
  product_name:'name', maelezo:'name', description:'name',
  'item description':'name', 'product description':'name', title:'name',
  // price
  price:'price', bei:'price', cost:'price', 'unit price':'price',
  unit_price:'price', 'selling price':'price', 'bei ya kuuza':'price',
  thamani:'price', rate:'price', 'price (tzs)':'price', 'bei (tzs)':'price',
  amount:'price', value:'price',
  // category
  category:'category', aina:'category', type:'category',
  'aina ya bidhaa':'category', kikundi:'category', group:'category',
  cat:'category', department:'category', section:'category', category_name:'category',
  // quantity
  quantity:'quantity', qty:'quantity', stock:'quantity',
  idadi:'quantity', stok:'quantity', units:'quantity',
  'stock quantity':'quantity', stock_quantity:'quantity', remaining:'quantity',
  'kiasi cha stok':'quantity', 'opening stock':'quantity',
  // barcode
  barcode:'barcode', sku:'barcode', code:'barcode',
  'product code':'barcode', 'item code':'barcode', upc:'barcode',
  ean:'barcode', msimbo:'barcode', 'barcode/sku':'barcode',
}

type FieldKey = 'name' | 'price' | 'category' | 'quantity' | 'barcode'
type ColMap = Record<FieldKey, string>

const FIELD_META: { key: FieldKey; tKey: TranslationKey; required?: boolean }[] = [
  { key: 'name',     tKey: 'productName',  required: true },
  { key: 'price',    tKey: 'sellingPrice', required: true },
  { key: 'category', tKey: 'category' },
  { key: 'quantity', tKey: 'stock' },
  { key: 'barcode',  tKey: 'barcode' },
]

function detectColMap(headers: string[]): ColMap {
  const map: ColMap = { name:'', price:'', category:'', quantity:'', barcode:'' }
  for (const h of headers) {
    const key = ALIASES[h.toLowerCase().trim()]
    if (key && key in map && !map[key as FieldKey]) {
      map[key as FieldKey] = h
    }
  }
  return map
}

function safeNum(v: string | undefined): number {
  if (!v) return 0
  return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0
}

interface Props { shopId: string; onSuccess: () => void; onClose: () => void }

type Step = 'upload' | 'map' | 'importing' | 'done'

export function BulkImport({ shopId, onSuccess, onClose }: Props) {
  const t = useT()
  const [step, setStep] = useState<Step>('upload')
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [colMap, setColMap] = useState<ColMap>({ name:'', price:'', category:'', quantity:'', barcode:'' })
  const [parseErr, setParseErr] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState({ ok: 0, fail: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setParseErr('')
    setFileName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()

    try {
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: ({ meta, data, errors }) => {
            if (errors.length && !data.length) { setParseErr(t('error') + ' CSV: ' + errors[0].message); return }
            const hdrs = meta.fields ?? []
            const dataRows = data as Record<string, string>[]
            setHeaders(hdrs); setRows(dataRows); setColMap(detectColMap(hdrs)); setStep('map')
          },
        })
      } else if (ext === 'xlsx' || ext === 'xls') {
        const XLSX = await import('xlsx')
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '', raw: false })
        const hdrs = json.length > 0 ? Object.keys(json[0]) : []
        if (!hdrs.length) { setParseErr(t('biExcelError')); return }
        setHeaders(hdrs); setRows(json); setColMap(detectColMap(hdrs)); setStep('map')
      } else {
        setParseErr(t('biFileTypeError'))
      }
    } catch (e) {
      setParseErr(t('biReadError') + ' ' + String(e))
    }
  }, [])

  const doImport = async () => {
    if (!colMap.name) return
    setStep('importing')
    const validRows = rows.filter(r => r[colMap.name]?.trim())
    setProgress({ done: 0, total: validRows.length })
    let ok = 0, fail = 0
    const BATCH = 50

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH)
      const inserts = batch.map(row => ({
        shop_id: shopId,
        name: row[colMap.name].trim(),
        price: safeNum(colMap.price ? row[colMap.price] : '0'),
        category: colMap.category ? (row[colMap.category]?.trim() || null) : null,
        barcode: colMap.barcode ? (row[colMap.barcode]?.trim() || null) : null,
        active: true,
      }))

      const { data: inserted, error } = await supabase
        .from('products')
        .insert(inserts)
        .select('id')

      if (error) { fail += inserts.length; setProgress(p => ({ ...p, done: p.done + inserts.length })); continue }

      // Insert stock_levels alongside
      if (inserted?.length) {
        const stockRows = inserted.map((p, idx) => ({
          product_id: p.id,
          shop_id: shopId,
          quantity: safeNum(colMap.quantity ? batch[idx]?.[colMap.quantity] : '0'),
          reorder_threshold: 2,
        }))
        await supabase.from('stock_levels').insert(stockRows)
      }

      ok += inserted?.length ?? 0
      setProgress(p => ({ ...p, done: p.done + inserts.length }))
    }

    setResult({ ok, fail })
    setStep('done')
    if (ok > 0) onSuccess()
  }

  const canImport = !!colMap.name
  const validCount = rows.filter(r => r[colMap.name ?? '']?.trim()).length

  // ── Step: UPLOAD ────────────────────────────────────────────────────────────
  if (step === 'upload') return (
    <div className="bi">
      <div
        className="bi__drop"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />
        <FileSpreadsheet size={36} className="bi__drop-icon" />
        <p className="bi__drop-title">{t('biDropTitle')}</p>
        <p className="bi__drop-sub">{t('biDropSub')}</p>
        <div className="bi__drop-hints">
          <span>{t('biHint1')}</span>
          <span>{t('biHint2')}</span>
          <span>{t('biHint3')}</span>
        </div>
      </div>

      {parseErr && <p className="bi__err"><AlertCircle size={13}/> {parseErr}</p>}

      <div className="bi__template-hint">
        <p>{t('biTemplateNote')} <code>Jina | Bei | Aina | Stok | Barcode</code></p>
        <p style={{ fontSize:'0.75rem', color:'var(--color-text-muted)', marginTop:4 }}>
          {t('biAutoDetect')}
        </p>
      </div>

      <BIStyles />
    </div>
  )

  // ── Step: MAP ───────────────────────────────────────────────────────────────
  if (step === 'map') {
    const preview = rows.slice(0, 5)
    const unmappedRequired = FIELD_META.filter(f => f.required && !colMap[f.key])

    return (
      <div className="bi">
        {/* File info */}
        <div className="bi__file-tag">
          <FileSpreadsheet size={15} />
          <span>{fileName}</span>
          <span className="bi__badge">{rows.length.toLocaleString()} {t('biRows')}</span>
          <button type="button" className="bi__refile" onClick={() => { setStep('upload'); setRows([]); setHeaders([]) }}>
            <ArrowLeft size={13} /> {t('biChangeFile')}
          </button>
        </div>

        {/* Column mapping */}
        <div className="bi__section">
          <p className="bi__section-title"><Table2 size={13}/> {t('biColMapping')}</p>
          <div className="bi__map-grid">
            {FIELD_META.map(({ key, tKey, required }) => (
              <div key={key} className="bi__map-row">
                <span className="bi__map-label">
                  {t(tKey)}
                  {required && <span className="bi__req">*</span>}
                </span>
                <ChevronRight size={12} style={{ color:'var(--color-text-muted)', flexShrink:0 }} />
                <select
                  className={`bi__map-sel ${colMap[key] ? 'bi__map-sel--ok' : ''}`}
                  value={colMap[key]}
                  onChange={e => setColMap(prev => ({ ...prev, [key]: e.target.value }))}
                >
                  <option value="">{t('biNotMapped')}</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
                {colMap[key] && <Check size={13} style={{ color:'var(--color-success)', flexShrink:0 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Preview table */}
        <div className="bi__section">
          <p className="bi__section-title">{t('biPreview')}</p>
          <div className="bi__table-wrap">
            <table className="bi__table">
              <thead>
                <tr>
                  {FIELD_META.filter(f => colMap[f.key]).map(f => (
                    <th key={f.key}>{t(f.tKey)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i}>
                    {FIELD_META.filter(f => colMap[f.key]).map(f => (
                      <td key={f.key}>{row[colMap[f.key]] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {unmappedRequired.length > 0 && (
          <p className="bi__warn">
            <AlertCircle size={13}/> {t('biUnmapped')} {unmappedRequired.map(f => `"${t(f.tKey)}"`).join(', ')}
          </p>
        )}

        <div className="bi__footer">
          <button type="button" className="bi__btn-cancel" onClick={onClose}>{t('cancel')}</button>
          <button type="button" className="bi__btn-go" disabled={!canImport} onClick={doImport}>
            <Upload size={15} />
            {t('biImportBtn')} {validCount.toLocaleString()} →
          </button>
        </div>

        <BIStyles />
      </div>
    )
  }

  // ── Step: IMPORTING ─────────────────────────────────────────────────────────
  if (step === 'importing') {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
    return (
      <div className="bi bi--center">
        <Loader2 size={38} className="bi__spin" />
        <h4>{t('biImporting')}</h4>
        <div className="bi__progress-bar">
          <div className="bi__progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="bi__prog-text">{progress.done} / {progress.total} {t('productsTitle')} ({pct}%)</p>
        <p className="bi__muted">{t('biDontClose')}</p>
        <BIStyles />
      </div>
    )
  }

  // ── Step: DONE ──────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div className="bi bi--center">
      <div className="bi__done-icon">{result.fail === 0 ? '🎉' : '⚠️'}</div>
      <h4>{result.fail === 0 ? t('biAllDone') : t('biDoneWithErr')}</h4>
      <div className="bi__result-stats">
        <div className="bi__stat bi__stat--ok">
          <Check size={16}/> {result.ok.toLocaleString()} {t('biImported')}
        </div>
        {result.fail > 0 && (
          <div className="bi__stat bi__stat--fail">
            <X size={16}/> {result.fail.toLocaleString()} {t('biFailed')}
          </div>
        )}
      </div>
      <div className="bi__done-actions">
        <button type="button" className="bi__btn-cancel" onClick={() => { setStep('upload'); setRows([]); setHeaders([]) }}>
          {t('biUploadAnother')}
        </button>
        <button type="button" className="bi__btn-go" onClick={onClose}>{t('close')}</button>
      </div>
      <BIStyles />
    </div>
  )

  return null
}

function BIStyles() {
  return <style>{`
    .bi { display:flex; flex-direction:column; gap:var(--space-5); }
    .bi--center { align-items:center; text-align:center; padding:var(--space-8, 48px) var(--space-4); }
    .bi--center h4 { font-size:1.1rem; font-weight:700; color:var(--color-text); }

    /* Drop zone */
    .bi__drop {
      display:flex; flex-direction:column; align-items:center; gap:var(--space-2);
      padding:var(--space-8, 44px) var(--space-5);
      border:2px dashed var(--color-border);
      border-radius:var(--radius-l);
      cursor:pointer; color:var(--color-text-muted); text-align:center;
      transition:all 150ms;
    }
    .bi__drop:hover { border-color:var(--color-primary); background:var(--color-primary-light); color:var(--color-primary); }
    .bi__drop-icon { transition:transform 200ms; }
    .bi__drop:hover .bi__drop-icon { transform:translateY(-4px); }
    .bi__drop-title { font-size:0.95rem; font-weight:700; color:var(--color-text); }
    .bi__drop-sub { font-size:0.82rem; }
    .bi__drop-hints { display:flex; flex-direction:column; gap:3px; font-size:0.76rem; color:var(--color-success); margin-top:var(--space-2); }

    .bi__template-hint {
      padding:var(--space-3) var(--space-4);
      background:var(--color-bg);
      border-left:3px solid var(--color-primary);
      border-radius:0 var(--radius-m) var(--radius-m) 0;
      font-size:0.8rem; color:var(--color-text-secondary);
    }
    .bi__template-hint code { background:var(--color-border); padding:1px 5px; border-radius:3px; font-size:0.78rem; }

    /* File tag */
    .bi__file-tag {
      display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap;
      font-size:0.85rem; font-weight:600;
      padding:var(--space-3) var(--space-4);
      background:var(--color-bg); border:1px solid var(--color-border); border-radius:var(--radius-m);
    }
    .bi__badge { margin-left:auto; font-size:0.72rem; background:var(--color-primary); color:#fff; padding:2px 9px; border-radius:var(--radius-full); font-weight:700; }
    .bi__refile { display:flex; align-items:center; gap:4px; font-size:0.78rem; color:var(--color-text-muted); font-weight:400; margin-left:var(--space-2); }
    .bi__refile:hover { color:var(--color-primary); }

    /* Sections */
    .bi__section { display:flex; flex-direction:column; gap:var(--space-3); }
    .bi__section-title { display:flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:700; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.06em; }

    /* Mapping */
    .bi__map-grid { display:flex; flex-direction:column; gap:var(--space-2); }
    .bi__map-row { display:flex; align-items:center; gap:var(--space-2); }
    .bi__map-label { font-size:0.82rem; font-weight:600; min-width:148px; color:var(--color-text); }
    .bi__req { color:var(--color-error); margin-left:2px; }
    .bi__map-sel {
      flex:1; padding:7px var(--space-3);
      border:1.5px solid var(--color-border); border-radius:var(--radius-m);
      font-size:0.82rem; background:var(--color-surface); color:var(--color-text); outline:none;
      transition:border-color 150ms;
    }
    .bi__map-sel:focus { border-color:var(--color-primary); }
    .bi__map-sel--ok { border-color:var(--color-success); }

    /* Preview table */
    .bi__table-wrap { overflow-x:auto; border-radius:var(--radius-m); border:1px solid var(--color-border); }
    .bi__table { width:100%; border-collapse:collapse; font-size:0.78rem; }
    .bi__table th { padding:8px 12px; background:var(--color-bg); font-weight:700; text-align:left; border-bottom:1.5px solid var(--color-border); color:var(--color-text-secondary); white-space:nowrap; }
    .bi__table td { padding:7px 12px; border-bottom:1px solid var(--color-border); color:var(--color-text); max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .bi__table tr:last-child td { border-bottom:none; }
    .bi__table tr:hover td { background:var(--color-bg); }

    /* Warnings */
    .bi__warn { display:flex; align-items:center; gap:6px; font-size:0.82rem; color:#92400e; background:#fffbeb; border:1px solid #fcd34d; padding:var(--space-3) var(--space-4); border-radius:var(--radius-m); }
    .bi__err { display:flex; align-items:center; gap:6px; font-size:0.82rem; color:var(--color-error); background:var(--color-error-bg); padding:var(--space-3) var(--space-4); border-radius:var(--radius-m); }

    /* Footer buttons */
    .bi__footer { display:flex; justify-content:flex-end; gap:var(--space-3); padding-top:var(--space-4); border-top:1px solid var(--color-border); }
    .bi__btn-cancel { padding:var(--space-3) var(--space-5); border-radius:var(--radius-m); font-weight:600; font-size:0.88rem; border:1.5px solid var(--color-border); color:var(--color-text-secondary); background:var(--color-surface); transition:all 150ms; }
    .bi__btn-cancel:hover { border-color:var(--color-primary); color:var(--color-text); }
    .bi__btn-go { display:flex; align-items:center; gap:6px; padding:var(--space-3) var(--space-5); border-radius:var(--radius-m); font-weight:700; font-size:0.88rem; background:var(--color-primary); color:#fff; transition:background 150ms; }
    .bi__btn-go:hover:not(:disabled) { background:var(--color-primary-hover); }
    .bi__btn-go:disabled { opacity:.45; cursor:not-allowed; }

    /* Progress */
    .bi__progress-bar { width:100%; max-width:300px; height:8px; background:var(--color-border); border-radius:var(--radius-full); overflow:hidden; }
    .bi__progress-fill { height:100%; background:var(--color-primary); border-radius:var(--radius-full); transition:width 300ms; }
    .bi__prog-text { font-size:0.85rem; font-weight:600; color:var(--color-primary); }
    .bi__muted { font-size:0.78rem; color:var(--color-text-muted); }
    @keyframes bi-spin { to { transform:rotate(360deg); } }
    .bi__spin { animation:bi-spin 700ms linear infinite; color:var(--color-primary); }

    /* Result */
    .bi__done-icon { font-size:3.5rem; line-height:1; }
    .bi__result-stats { display:flex; flex-direction:column; gap:var(--space-2); width:100%; max-width:260px; }
    .bi__stat { display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3) var(--space-4); border-radius:var(--radius-m); font-weight:600; font-size:0.88rem; }
    .bi__stat--ok { background:#d1fae5; color:#065f46; }
    .bi__stat--fail { background:#fef2f2; color:#991b1b; }
    .bi__done-actions { display:flex; gap:var(--space-3); flex-wrap:wrap; justify-content:center; }
  `}</style>
}
