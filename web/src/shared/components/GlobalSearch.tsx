import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package, Users, Truck, ShoppingBag, DollarSign, X, ArrowRight } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'

interface SearchResult {
  id: string
  type: 'product' | 'customer' | 'supplier' | 'sale' | 'expense'
  title: string
  subtitle: string
  url: string
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

const TYPE_META: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  product:  { label: 'Product',  color: '#3b82f6', icon: Package },
  customer: { label: 'Customer', color: '#16a34a', icon: Users },
  supplier: { label: 'Supplier', color: '#7c3aed', icon: Truck },
  sale:     { label: 'Sale',     color: '#f59e0b', icon: ShoppingBag },
  expense:  { label: 'Expense',  color: '#dc2626', icon: DollarSign },
}

interface Props {
  shopId?: string
}

export function GlobalSearch({ shopId }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim() || !shopId) { setResults([]); return }
    setLoading(true)
    try {
      const [products, customers, suppliers] = await Promise.all([
        supabase.from('products').select('id, name, category, price').eq('shop_id', shopId).ilike('name', `%${q}%`).limit(5),
        supabase.from('customers').select('id, name, phone, email').eq('shop_id', shopId).or(`name.ilike.%${q}%,phone.ilike.%${q}%`).limit(5),
        supabase.from('suppliers').select('id, name, phone').eq('shop_id', shopId).ilike('name', `%${q}%`).limit(3),
      ])
      const res: SearchResult[] = []
      for (const p of products.data ?? []) {
        res.push({ id: p.id, type: 'product', title: p.name, subtitle: `${p.category ?? 'Uncategorized'} · ${fmt(p.price)}`, url: '/products' })
      }
      for (const c of customers.data ?? []) {
        res.push({ id: c.id, type: 'customer', title: c.name, subtitle: c.phone ?? c.email ?? 'No contact', url: '/customers' })
      }
      for (const s of suppliers.data ?? []) {
        res.push({ id: s.id, type: 'supplier', title: s.name, subtitle: s.phone ?? 'No phone', url: '/suppliers' })
      }
      setResults(res)
      setSelected(0)
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 300)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) {
      navigate(results[selected].url)
      setOpen(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', border: '1px solid var(--color-border)',
          borderRadius: 8, background: 'var(--color-bg)', color: 'var(--color-text-secondary)',
          cursor: 'pointer', fontSize: 13,
        }}
        title="Search (Ctrl+K)"
      >
        <Search size={15} />
        <span>Search…</span>
        <kbd style={{ fontSize: 10, background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 4, padding: '1px 4px' }}>⌘K</kbd>
      </button>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }}
      onClick={() => setOpen(false)}>
      <div style={{ width: '100%', maxWidth: 560, margin: '0 16px', background: 'var(--color-card)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
          <Search size={18} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search products, customers, suppliers…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 16, color: 'var(--color-text)' }}
          />
          {loading && <div style={{ width: 16, height: 16, border: '2px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 600ms linear infinite', flexShrink: 0 }} />}
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        {results.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
            {results.map((r, i) => {
              const meta = TYPE_META[r.type]
              const Icon = meta.icon
              return (
                <div
                  key={r.id}
                  onClick={() => { navigate(r.url); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                    background: i === selected ? 'var(--color-bg)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setSelected(i)}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: `${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: meta.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{r.subtitle}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, color: meta.color, background: `${meta.color}20`, padding: '2px 6px', borderRadius: 4 }}>{meta.label}</span>
                    <ArrowRight size={13} style={{ color: 'var(--color-text-secondary)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {query && !loading && results.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
            No results for "{query}"
          </div>
        )}

        {!query && (
          <div style={{ padding: '12px 16px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 8 }}>QUICK ACCESS</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Products', url: '/products' }, { label: 'Customers', url: '/customers' },
                { label: 'Sales', url: '/pos' }, { label: 'Reports', url: '/reports' },
              ].map(item => (
                <button
                  key={item.url}
                  onClick={() => { navigate(item.url); setOpen(false) }}
                  style={{ padding: '5px 12px', border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
