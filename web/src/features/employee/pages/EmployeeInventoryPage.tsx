import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, Search, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'

type Product = {
  id: string; name: string; barcode?: string | null; sku?: string | null
  price: number; unit?: string | null; category_id?: string | null
  category?: { name: string }[] | { name: string } | null
  stock_levels?: { quantity: number; reorder_point?: number | null }[] | null
}

function fmt(n: number) { return 'TZS ' + n.toLocaleString('en-TZ') }

function getCatName(cat: Product['category']): string | undefined {
  if (!cat) return undefined
  if (Array.isArray(cat)) return cat[0]?.name
  return cat.name
}

function StockBadge({ qty, reorder }: { qty: number; reorder?: number | null }) {
  if (qty === 0) return <span className="inv-badge inv-badge--out">Out of Stock</span>
  if (reorder && qty <= reorder) return <span className="inv-badge inv-badge--low">Low Stock</span>
  return <span className="inv-badge inv-badge--ok">In Stock</span>
}

export function EmployeeInventoryPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const shopId = shop?.id
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['emp-inventory', shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, name, barcode, sku, price, unit, category_id,
          category:categories(name),
          stock_levels(quantity, reorder_point)
        `)
        .eq('shop_id', shopId!)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as unknown as Product[]
    },
    staleTime: 60_000,
  })

  const categories = Array.from(new Set(products.map(p => getCatName(p.category)).filter(Boolean))) as string[]

  const filtered = products.filter(p => {
    const qty = p.stock_levels?.[0]?.quantity ?? 0
    const reorder = p.stock_levels?.[0]?.reorder_point
    if (stockFilter === 'out' && qty > 0) return false
    if (stockFilter === 'low' && (qty === 0 || !reorder || qty > reorder)) return false
    if (catFilter !== 'all' && getCatName(p.category) !== catFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    }
    return true
  })

  const outOfStock = products.filter(p => (p.stock_levels?.[0]?.quantity ?? 0) === 0).length
  const lowStock = products.filter(p => {
    const qty = p.stock_levels?.[0]?.quantity ?? 0
    const r = p.stock_levels?.[0]?.reorder_point
    return qty > 0 && r && qty <= r
  }).length

  return (
    <div className="inv-page">
      <div className="inv-head">
        <h1 className="inv-title">Inventory</h1>
        <p className="inv-sub">View-only access — {products.length} products</p>
      </div>

      {(outOfStock > 0 || lowStock > 0) && (
        <div className="inv-alerts">
          {outOfStock > 0 && (
            <div className="inv-alert inv-alert--out">
              <AlertTriangle size={16} />
              <span><strong>{outOfStock}</strong> product{outOfStock !== 1 ? 's' : ''} out of stock</span>
            </div>
          )}
          {lowStock > 0 && (
            <div className="inv-alert inv-alert--low">
              <AlertTriangle size={16} />
              <span><strong>{lowStock}</strong> product{lowStock !== 1 ? 's' : ''} running low</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="inv-filters">
        <div className="inv-search">
          <Search size={15} />
          <input
            placeholder="Search by name, barcode, or SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="inv-search-inp"
          />
        </div>
        <div className="inv-filter-group">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} className="inv-select">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <div className="inv-stock-btns">
            {(['all', 'low', 'out'] as const).map(f => (
              <button key={f} onClick={() => setStockFilter(f)} className={`inv-stock-btn ${stockFilter === f ? 'inv-stock-btn--active' : ''}`}>
                {f === 'all' ? 'All' : f === 'low' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="inv-info-note">
        <CheckCircle2 size={13} />
        <span>This is a view-only inventory. Contact your manager to make stock changes.</span>
      </div>

      {isLoading ? (
        <div className="inv-loading">Loading inventory…</div>
      ) : filtered.length === 0 ? (
        <div className="inv-empty">
          <Package size={40} />
          <p>No products found</p>
          {search && <span>Try a different search term</span>}
        </div>
      ) : (
        <div className="inv-table-card">
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Unit</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const qty = p.stock_levels?.[0]?.quantity ?? 0
                  const reorder = p.stock_levels?.[0]?.reorder_point
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="inv-prod-name">{p.name}</span>
                        {p.barcode && <span className="inv-prod-meta">{p.barcode}</span>}
                        {p.sku && <span className="inv-prod-meta">SKU: {p.sku}</span>}
                      </td>
                      <td><span className="inv-cat">{getCatName(p.category) ?? '—'}</span></td>
                      <td><span className="inv-price">{fmt(p.price)}</span></td>
                      <td><span className="inv-unit">{p.unit ?? 'pcs'}</span></td>
                      <td>
                        <span className={`inv-qty ${qty === 0 ? 'inv-qty--zero' : reorder && qty <= reorder ? 'inv-qty--low' : ''}`}>
                          {qty}
                        </span>
                      </td>
                      <td><StockBadge qty={qty} reorder={reorder} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="inv-table-foot">
            Showing {filtered.length} of {products.length} products
          </div>
        </div>
      )}

      <style>{`
        .inv-page { display:flex; flex-direction:column; gap:20px; }
        .inv-head { }
        .inv-title { font-size:1.6rem; font-weight:800; font-family:var(--font-heading); color:var(--color-text); margin:0; }
        .inv-sub { color:var(--color-text-muted); font-size:.875rem; margin:4px 0 0; }

        .inv-alerts { display:flex; flex-direction:column; gap:8px; }
        .inv-alert { display:flex; align-items:center; gap:10px; padding:10px 16px; border-radius:10px; font-size:.875rem; font-weight:500; }
        .inv-alert--out { background:var(--color-error-bg); color:var(--color-error); }
        .inv-alert--low { background:var(--color-warning-bg); color:var(--color-warning); }

        .inv-filters { display:flex; flex-wrap:wrap; gap:12px; }
        .inv-search { display:flex; align-items:center; gap:8px; background:var(--color-surface); border:1.5px solid var(--color-border); border-radius:10px; padding:8px 14px; flex:1; min-width:200px; }
        .inv-search-inp { flex:1; background:none; border:none; outline:none; color:var(--color-text); font-size:.875rem; }
        .inv-filter-group { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .inv-select { padding:8px 12px; border:1.5px solid var(--color-border); border-radius:10px; background:var(--color-surface); color:var(--color-text); font-size:.82rem; outline:none; }
        .inv-stock-btns { display:flex; gap:4px; background:var(--color-bg); border:1px solid var(--color-border); border-radius:8px; padding:3px; }
        .inv-stock-btn { padding:6px 12px; border-radius:6px; font-size:.78rem; font-weight:600; color:var(--color-text-secondary); transition:all 120ms; }
        .inv-stock-btn--active { background:var(--color-primary); color:#fff; }

        .inv-info-note { display:flex; align-items:center; gap:8px; font-size:.78rem; color:var(--color-text-muted); background:var(--color-surface); border:1px solid var(--color-border); padding:8px 14px; border-radius:8px; }

        .inv-loading,.inv-empty { padding:48px; text-align:center; color:var(--color-text-muted); display:flex; flex-direction:column; align-items:center; gap:12px; }
        .inv-empty p { font-weight:700; font-size:.95rem; color:var(--color-text); margin:0; }
        .inv-empty span { font-size:.82rem; }

        .inv-table-card { background:var(--color-surface); border:1px solid var(--color-border); border-radius:16px; overflow:hidden; }
        .inv-table-wrap { overflow-x:auto; }
        .inv-table { width:100%; border-collapse:collapse; }
        .inv-table thead tr { background:var(--color-bg); }
        .inv-table th { padding:10px 14px; text-align:left; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--color-text-muted); border-bottom:1px solid var(--color-border); white-space:nowrap; }
        .inv-table td { padding:12px 14px; border-bottom:1px solid var(--color-border); vertical-align:middle; }
        .inv-table tr:last-child td { border-bottom:none; }
        .inv-table tr:hover td { background:var(--color-bg); }
        .inv-table-foot { padding:12px 16px; font-size:.78rem; color:var(--color-text-muted); border-top:1px solid var(--color-border); }

        .inv-prod-name { display:block; font-weight:600; font-size:.875rem; color:var(--color-text); }
        .inv-prod-meta { display:block; font-size:.72rem; color:var(--color-text-muted); }
        .inv-cat { font-size:.8rem; color:var(--color-text-secondary); }
        .inv-price { font-weight:700; font-size:.875rem; color:var(--color-text); }
        .inv-unit { font-size:.8rem; color:var(--color-text-secondary); }
        .inv-qty { font-weight:700; font-size:.95rem; color:var(--color-text); }
        .inv-qty--zero { color:var(--color-error); }
        .inv-qty--low { color:var(--color-warning); }

        .inv-badge { font-size:.68rem; font-weight:700; padding:3px 9px; border-radius:999px; text-transform:uppercase; letter-spacing:.03em; }
        .inv-badge--ok { background:var(--color-success-bg); color:var(--color-success); }
        .inv-badge--low { background:var(--color-warning-bg); color:var(--color-warning); }
        .inv-badge--out { background:var(--color-error-bg); color:var(--color-error); }
      `}</style>
    </div>
  )
}
