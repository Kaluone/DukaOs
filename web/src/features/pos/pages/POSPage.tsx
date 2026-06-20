import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Search, X, Plus, Minus, Trash2,
  Pause, Clock, Printer, CheckCircle, ShoppingCart,
  AlertTriangle, Camera, Lock, Eye, EyeOff, BarChart2,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { useT } from '@/shared/i18n/useLanguage'
import { useCartStore, cartTotals, type CartItem } from '../store/cartStore'
import { useStaffSession, hashPin } from '@/features/staff/store/staffSessionStore'
import { format } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────
interface POSProduct {
  id: string
  name: string
  price: number
  buying_price: number
  photo_url: string | null
  category: string | null
  barcode: string | null
  stock_quantity: number
}

interface StaffMember { id: string; full_name: string }

interface SaleResult {
  transaction_id: string
  items: CartItem[]
  total: number
  payment_method: string
  cash_received: number
  change: number
  shop_name: string
  cashier: string
  timestamp: string
}

const PAYMENT_METHODS = [
  { id: 'cash',        label: 'Taslimu',    color: '#16a34a' },
  { id: 'mpesa',       label: 'M-Pesa',     color: '#00a650' },
  { id: 'airtelmoney', label: 'Airtel',     color: '#e00' },
  { id: 'tigopesa',    label: 'Tigo Pesa',  color: '#009' },
  { id: 'halopesa',    label: 'HaloPesa',   color: '#e67e00' },
  { id: 'card',        label: 'Kadi',       color: '#0369a1' },
  { id: 'credit',      label: 'Mkopo',      color: '#7c3aed' },
  { id: 'other',       label: 'Nyingine',   color: '#6b7280' },
]

const fmt = (n: number) =>
  new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

interface Customer { id: string; name: string; phone: string | null; credit_balance: number }

// ─── Hooks ───────────────────────────────────────────────────────────────────
function usePOSProducts(shopId?: string) {
  return useQuery<POSProduct[]>({
    queryKey: ['pos-products', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price, buying_price, photo_url, category, barcode, stock_levels(quantity)')
        .eq('shop_id', shopId!)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        buying_price: (p.buying_price as number) ?? 0,
        photo_url: p.photo_url,
        category: p.category,
        barcode: (p.barcode as string | null) ?? null,
        stock_quantity:
          (p.stock_levels as unknown as { quantity: number }[] | null)?.[0]?.quantity ?? -1,
      }))
    },
    enabled: !!shopId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}

function useCustomers(shopId?: string) {
  return useQuery<Customer[]>({
    queryKey: ['pos-customers', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, credit_balance')
        .eq('shop_id', shopId!)
        .eq('active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  })
}

function useStaffList(shopId?: string) {
  return useQuery<StaffMember[]>({
    queryKey: ['pos-staff', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('shop_id', shopId!)
        .eq('active', true)
        .order('full_name')
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  })
}

// ─── Product tile ─────────────────────────────────────────────────────────────
function ProductTile({ product, onAdd, inCart }: {
  product: POSProduct
  onAdd: (p: POSProduct) => void
  inCart: number
}) {
  const t = useT()
  const outOfStock = product.stock_quantity === 0
  return (
    <button
      className={`pos-tile ${outOfStock ? 'pos-tile--oos' : ''} ${inCart ? 'pos-tile--incart' : ''}`}
      onClick={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      title={outOfStock ? t('outOfStock') : product.name}
    >
      <div className="pos-tile__img">
        {product.photo_url ? (
          <img src={product.photo_url} alt={product.name} loading="lazy" />
        ) : (
          <span className="pos-tile__emoji">📦</span>
        )}
        {inCart > 0 && <span className="pos-tile__badge">{inCart}</span>}
        {outOfStock && <span className="pos-tile__oos-label">{t('outOfStock')}</span>}
      </div>
      <div className="pos-tile__body">
        <span className="pos-tile__name">{product.name}</span>
        <span className="pos-tile__price">{fmt(product.price)}</span>
        <span className={`pos-tile__stock ${product.stock_quantity >= 0 && product.stock_quantity <= 3 && !outOfStock ? 'pos-tile__stock--low' : ''}`}>
          {t('stockLabel')} {product.stock_quantity < 0 ? '∞' : product.stock_quantity}
        </span>
      </div>
    </button>
  )
}

// ─── Cart row ─────────────────────────────────────────────────────────────────
function CartRow({ item, onUpdateQty, onRemove, onDiscount }: {
  item: CartItem
  onUpdateQty: (delta: number) => void
  onRemove: () => void
  onDiscount: (d: number) => void
}) {
  const t = useT()
  const subtotal = item.price * item.quantity - item.item_discount
  const [editDiscount, setEditDiscount] = useState(false)
  return (
    <div className="cart-row">
      <div className="cart-row__info">
        <span className="cart-row__name">{item.name}</span>
        <span className="cart-row__price">{fmt(item.price)} × {item.quantity}</span>
        {item.item_discount > 0 && (
          <span className="cart-row__disc">-{fmt(item.item_discount)}</span>
        )}
      </div>
      <div className="cart-row__controls">
        <div className="qty-ctrl">
          <button onClick={() => onUpdateQty(-1)} className="qty-btn"><Minus size={12} /></button>
          <span className="qty-val">{item.quantity}</span>
          <button onClick={() => onUpdateQty(1)} className="qty-btn"><Plus size={12} /></button>
        </div>
        <span className="cart-row__subtotal">{fmt(subtotal)}</span>
        <button
          className="cart-row__disc-btn"
          title="Punguzo"
          onClick={() => setEditDiscount((v) => !v)}
        >%</button>
        <button className="cart-row__del" onClick={onRemove}><Trash2 size={13} /></button>
      </div>
      {editDiscount && (
        <div className="cart-row__disc-input">
          <span>{t('discount')} (TZS):</span>
          <input
            type="number" min="0" max={item.price * item.quantity}
            value={item.item_discount || ''}
            onChange={(e) => onDiscount(Number(e.target.value))}
            autoFocus
            className="disc-inp"
          />
        </div>
      )}
    </div>
  )
}

// ─── Receipt component (also target for window.print) ────────────────────────
function Receipt({ sale }: { sale: SaleResult }) {
  return (
    <div id="pos-receipt-print" className="receipt">
      <div className="receipt__head">
        <strong>{sale.shop_name}</strong>
        <span>DukaOS POS</span>
      </div>
      <div className="receipt__meta">
        <span>{sale.timestamp}</span>
        <span>Cashier: {sale.cashier}</span>
        <span>Nambari: #{sale.transaction_id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div className="receipt__divider">{'─'.repeat(32)}</div>
      <table className="receipt__items">
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.product_id}>
              <td className="receipt__item-name">{item.name}</td>
              <td className="receipt__item-qty">{item.quantity}x</td>
              <td className="receipt__item-amt">{fmt(item.price * item.quantity - item.item_discount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="receipt__divider">{'─'.repeat(32)}</div>
      <div className="receipt__totals">
        <div><span>JUMLA:</span><span>{fmt(sale.total)}</span></div>
        {sale.payment_method === 'cash' && sale.cash_received > 0 && (
          <>
            <div><span>Malipo:</span><span>{fmt(sale.cash_received)}</span></div>
            <div className="receipt__change"><span>Chenji:</span><span>{fmt(sale.change)}</span></div>
          </>
        )}
        <div><span>Njia ya malipo:</span><span>{PAYMENT_METHODS.find(m=>m.id===sale.payment_method)?.label ?? sale.payment_method}</span></div>
      </div>
      <div className="receipt__divider">{'─'.repeat(32)}</div>
      <p className="receipt__footer">Asante kwa kununua! Karibu tena.</p>
    </div>
  )
}

// ─── PIN input helper ─────────────────────────────────────────────────────────
function PinInput({ label, value, onChange, onEnter, autoFocus, style }: {
  label: string; value: string; onChange: (v: string) => void
  onEnter?: () => void; autoFocus?: boolean; style?: React.CSSProperties
}) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative', ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          inputMode="numeric"
          maxLength={8}
          value={value}
          autoFocus={autoFocus}
          onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && onEnter?.()}
          style={{
            width: '100%', padding: '11px 40px 11px 14px',
            border: '1.5px solid var(--color-border)', borderRadius: 10,
            background: 'var(--color-bg)', color: 'var(--color-text)',
            fontSize: 22, fontWeight: 700, letterSpacing: 8,
            boxSizing: 'border-box', outline: 'none',
          }}
        />
        <button type="button" onClick={() => setShow(v => !v)} style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--color-text-secondary)',
        }}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  )
}

// ─── Main POS Page ────────────────────────────────────────────────────────────
export function POSPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()
  const { isStaffMode, activeStaffId, activeStaffName, exitStaffMode } = useStaffSession()
  const { data: products = [], isLoading } = usePOSProducts(shop?.id)
  const { data: staffList = [] } = useStaffList(shop?.id)
  const { data: customers = [] } = useCustomers(shop?.id)

  // All sales for this staff member (only fetched in staff mode)
  const { data: todaySales = [], refetch: refetchSales } = useQuery({
    queryKey: ['staff-all-sales', activeStaffId],
    enabled: isStaffMode && !!activeStaffId && !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id, total_amount, payment_method, created_at,
          transaction_items ( quantity, unit_price, product:products(name) )
        `)
        .eq('shop_id', shop!.id)
        .eq('staff_id', activeStaffId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data ?? []
    },
  })

  const {
    items, order_discount, held_carts,
    addItem, removeItem, updateQty, setItemDiscount,
    setOrderDiscount, clearCart, holdCart, resumeCart, deleteHeldCart,
  } = useCartStore()

  const { subtotal, total } = cartTotals(items, order_discount)

  // UI state
  const [search, setSearch] = useState('')
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [showPayment, setShowPayment] = useState(false)
  const [showHeld, setShowHeld] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [activeTab, setActiveTab] = useState<'products' | 'cart' | 'sales'>('products')

  // Payment state
  const [payMethod, setPayMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [payRef, setPayRef] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')
  const [lastSale, setLastSale] = useState<SaleResult | null>(null)
  const [creditCustomerId, setCreditCustomerId] = useState('')
  const [creditCustomerSearch, setCreditCustomerSearch] = useState('')

  // Exit staff mode — uses owner PIN (works for Google & email logins)
  const [showExitModal, setShowExitModal] = useState(false)
  const [exitPin, setExitPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [exitError, setExitError] = useState('')
  const [exitLoading, setExitLoading] = useState(false)
  const [settingPin, setSettingPin] = useState(false)

  // Fetch the stored owner PIN hash for this shop
  const { data: shopPinData, refetch: refetchPin } = useQuery({
    queryKey: ['owner-pin', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('shops')
        .select('owner_exit_pin_hash')
        .eq('id', shop!.id)
        .single()
      return data
    },
  })
  const hasPin = !!shopPinData?.owner_exit_pin_hash

  const handleExitStaffMode = async () => {
    if (!exitPin) { setExitError('Weka PIN yako'); return }
    setExitLoading(true); setExitError('')
    const hash = await hashPin(exitPin)
    if (hash !== shopPinData?.owner_exit_pin_hash) {
      setExitError('PIN si sahihi. Jaribu tena.')
      setExitPin('')
      setExitLoading(false)
      return
    }
    exitStaffMode()
    setShowExitModal(false)
    setExitPin('')
    navigate('/dashboard')
    setExitLoading(false)
  }

  const handleSaveNewPin = async () => {
    if (newPin.length < 4) { setExitError('PIN lazima iwe nambari 4 au zaidi'); return }
    if (newPin !== newPinConfirm) { setExitError('PIN hazifanani. Jaribu tena.'); return }
    setExitLoading(true); setExitError('')
    const hash = await hashPin(newPin)
    const { error } = await supabase
      .from('shops')
      .update({ owner_exit_pin_hash: hash })
      .eq('id', shop!.id)
    if (error) { setExitError('Hitilafu. Jaribu tena.'); setExitLoading(false); return }
    await refetchPin()
    setSettingPin(false)
    setNewPin(''); setNewPinConfirm('')
    setExitLoading(false)
  }

  // Clock
  const [clock, setClock] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Phase 42: Keyboard-first POS shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F2') { e.preventDefault(); setActiveTab('cart') }
      if (e.key === 'Escape') { e.preventDefault(); setShowPayment(false); setShowHeld(false); setShowReceipt(false) }
      if (e.key === 'F4') { e.preventDefault(); if (items.length > 0) setShowPayment(s => !s) }
      if (!inInput && e.key === 'Delete') { e.preventDefault(); clearCart() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [clearCart, items])

  // Barcode scan via USB: on Enter in search field with exact barcode match
  const searchRef = useRef<HTMLInputElement>(null)
  const handleSearchKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const term = search.trim()
      const match = products.find(
        (p) => p.barcode === term || p.name.toLowerCase() === term.toLowerCase()
      )
      if (match) {
        addItem({
          product_id: match.id,
          name: match.name,
          price: match.price,
          buying_price: match.buying_price,
          photo_url: match.photo_url,
          category: match.category,
          stock_quantity: match.stock_quantity,
        })
        setSearch('')
        setActiveTab('cart')
      }
    },
    [products, addItem, search]
  )

  const filtered = products.filter((p) => {
    const t = search.toLowerCase()
    if (!t) return true
    return (
      p.name.toLowerCase().includes(t) ||
      (p.barcode?.toLowerCase().includes(t) ?? false) ||
      (p.category?.toLowerCase().includes(t) ?? false)
    )
  })

  const cartMap: Record<string, number> = {}
  for (const i of items) cartMap[i.product_id] = i.quantity

  const cashChange = Math.max(0, Number(cashReceived) - total)

  const handleAddToCart = (p: POSProduct) => {
    addItem({
      product_id: p.id,
      name: p.name,
      price: p.price,
      buying_price: p.buying_price,
      photo_url: p.photo_url,
      category: p.category,
      stock_quantity: p.stock_quantity,
    })
    setActiveTab('cart')
  }

  const openPayment = () => {
    if (!items.length) return
    setCashReceived(String(total))
    setPayRef('')
    setPayError('')
    setShowPayment(true)
  }

  const handleConfirmSale = async () => {
    if (!shop?.id || !items.length) return
    if (payMethod === 'cash' && Number(cashReceived) < total) {
      setPayError(t('cashShortError'))
      return
    }
    if (payMethod === 'credit' && !creditCustomerId) {
      setPayError(t('selectCreditCustomer'))
      return
    }
    setPaying(true)
    setPayError('')

    const staffMember = staffList.find((s) => s.id === selectedStaffId)
    const cashierName = staffMember?.full_name ?? 'Mmiliki'

    const saleItems = items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.price,
      buying_price: i.buying_price,
      item_discount: i.item_discount,
      subtotal: i.price * i.quantity - i.item_discount,
    }))

    const { data, error } = await supabase.rpc('process_sale', {
      p_shop_id: shop.id,
      p_staff_id: isStaffMode ? (activeStaffId || null) : (selectedStaffId || null),
      p_payment_method: payMethod,
      p_total_amount: total,
      p_discount: order_discount,
      p_notes: payRef || null,
      p_items: saleItems,
    })

    if (error) {
      setPayError(t('error') + ': ' + error.message)
      setPaying(false)
      return
    }

    const result = data as { success: boolean; transaction_id: string }
    setLastSale({
      transaction_id: result.transaction_id,
      items: [...items],
      total,
      payment_method: payMethod,
      cash_received: Number(cashReceived),
      change: cashChange,
      shop_name: shop.name,
      cashier: cashierName,
      timestamp: format(new Date(), 'dd/MM/yyyy HH:mm'),
    })

    // For credit sales, add to customer's credit_balance
    if (payMethod === 'credit' && creditCustomerId) {
      const customer = customers.find(c => c.id === creditCustomerId)
      if (customer) {
        await supabase
          .from('customers')
          .update({ credit_balance: customer.credit_balance + total })
          .eq('id', creditCustomerId)
      }
    }

    clearCart()
    setPaying(false)
    setShowPayment(false)
    setCreditCustomerId('')
    setCreditCustomerSearch('')
    setShowReceipt(true)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleNewSale = () => {
    setShowReceipt(false)
    setLastSale(null)
    setActiveTab('products')
    if (isStaffMode) refetchSales()
    searchRef.current?.focus()
  }

  return (
    <div className="pos">
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <header className="pos-bar">
        {isStaffMode ? (
          <button className="pos-bar__back pos-bar__exit-staff" onClick={() => setShowExitModal(true)} title="Rudi kwa Mmiliki">
            <Lock size={16} />
            <span className="pos-bar__back-label">Rudi kwa Mmiliki</span>
          </button>
        ) : (
          <button className="pos-bar__back" onClick={() => navigate('/dashboard')} title={t('back')}>
            <ArrowLeft size={18} />
            <span className="pos-bar__back-label">{t('back')}</span>
          </button>
        )}

        <div className="pos-bar__center">
          <span className="pos-bar__shop">{shop?.name ?? 'DukaOS'}</span>
          <span className="pos-bar__clock">{format(clock, 'HH:mm:ss')}</span>
        </div>

        <div className="pos-bar__right">
          {isStaffMode ? (
            <span className="pos-bar__staff-badge">
              <span className="pos-bar__staff-dot" />
              {activeStaffName}
            </span>
          ) : staffList.length > 0 && (
            <select
              className="pos-staff-sel"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              <option value="">Mmiliki</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.full_name}</option>
              ))}
            </select>
          )}
          {held_carts.length > 0 && (
            <button className="pos-bar__held" onClick={() => setShowHeld(true)}>
              <Clock size={16} />
              <span>{held_carts.length}</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Mobile tab switcher ─────────────────────────────────────── */}
      <div className="pos-tabs">
        <button
          className={`pos-tab ${activeTab === 'products' ? 'pos-tab--active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          {t('productsTab')} {isLoading ? '' : `(${filtered.length})`}
        </button>
        <button
          className={`pos-tab ${activeTab === 'cart' ? 'pos-tab--active' : ''}`}
          onClick={() => setActiveTab('cart')}
        >
          {t('cartTab')}
          {items.length > 0 && <span className="pos-tab__badge">{items.length}</span>}
        </button>
        {isStaffMode && (
          <button
            className={`pos-tab ${activeTab === 'sales' ? 'pos-tab--active' : ''}`}
            onClick={() => { setActiveTab('sales'); refetchSales() }}
          >
            <BarChart2 size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
            Mauzo Yangu
            {todaySales.length > 0 && <span className="pos-tab__badge">{todaySales.length}</span>}
          </button>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <div className="pos-body">
        {/* Products panel */}
        <section className={`pos-products ${activeTab === 'products' ? 'pos-panel--show' : 'pos-panel--hide'}`}>
          <div className="pos-search">
            <Search size={16} className="pos-search__icon" />
            <input
              ref={searchRef}
              type="search"
              className="pos-search__input"
              placeholder={t('searchProducts')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKey}
              autoFocus
            />
            {search && (
              <button className="pos-search__clear" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
            <Camera size={15} className="pos-search__cam" aria-label="Barcode scanner" />
          </div>

          {isLoading ? (
            <div className="pos-grid">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 130, borderRadius: 'var(--radius-l)' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="pos-empty">
              <AlertTriangle size={32} />
              <p>{search ? `${t('noProductsSearch')} "${search}"` : t('noProducts')}</p>
            </div>
          ) : (
            <div className="pos-grid">
              {filtered.map((p) => (
                <ProductTile
                  key={p.id}
                  product={p}
                  onAdd={handleAddToCart}
                  inCart={cartMap[p.id] ?? 0}
                />
              ))}
            </div>
          )}
        </section>

        {/* Cart panel */}
        <section className={`pos-cart ${activeTab === 'cart' ? 'pos-panel--show' : 'pos-panel--hide'}`}>
          <div className="pos-cart__header">
            <ShoppingCart size={18} />
            <span>{t('cartHeader')}</span>
            {items.length > 0 && (
              <button className="pos-cart__clear" onClick={clearCart} title={t('clearCart')}>
                <Trash2 size={14} />
              </button>
            )}
          </div>

          <div className="pos-cart__items">
            {items.length === 0 ? (
              <div className="pos-cart__empty">
                <ShoppingCart size={36} />
                <p>{t('cartEmptySub')}</p>
              </div>
            ) : (
              items.map((item) => (
                <CartRow
                  key={item.product_id}
                  item={item}
                  onUpdateQty={(d) => updateQty(item.product_id, d)}
                  onRemove={() => removeItem(item.product_id)}
                  onDiscount={(d) => setItemDiscount(item.product_id, d)}
                />
              ))
            )}
          </div>

          {/* Totals */}
          {items.length > 0 && (
            <div className="pos-cart__footer">
              <div className="pos-totals">
                <div className="pos-total-row">
                  <span>{t('subtotal')}</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="pos-total-row pos-total-row--disc">
                  <label>{t('orderDiscount')}</label>
                  <input
                    type="number" min="0" max={subtotal}
                    className="disc-whole"
                    value={order_discount || ''}
                    placeholder="0"
                    onChange={(e) => setOrderDiscount(Number(e.target.value))}
                  />
                </div>
                <div className="pos-total-row pos-total-row--total">
                  <span>{t('totalAmount')}</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>

              <div className="pos-actions">
                <button className="pos-act pos-act--hold" onClick={holdCart} title={t('holdCart')}>
                  <Pause size={15} /><span>{t('holdCart')}</span>
                </button>
                <button
                  className="pos-act pos-act--pay"
                  onClick={openPayment}
                  disabled={!items.length}
                >
                  <span>{t('processPayment')}</span>
                  <span className="pos-act__amt">{fmt(total)}</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Today's Sales panel (staff mode only) ─────────────────── */}
        {isStaffMode && (
          <section className={`pos-sales-panel ${activeTab === 'sales' ? 'pos-panel--show' : 'pos-panel--hide'}`}>
            {/* Summary header */}
            <div className="pos-sales-panel__header">
              <div className="pos-sales-stat">
                <span className="pos-sales-stat__label">Mauzo Yangu</span>
                <span className="pos-sales-stat__count">{todaySales.length} mauzo</span>
              </div>
              <div className="pos-sales-stat pos-sales-stat--total">
                <span className="pos-sales-stat__label">Jumla</span>
                <span className="pos-sales-stat__amount">
                  {fmt(todaySales.reduce((s, tx) => s + Number(tx.total_amount), 0))}
                </span>
              </div>
            </div>

            {/* Sales list */}
            <div className="pos-sales-panel__list">
              {todaySales.length === 0 ? (
                <div className="pos-sales-empty">
                  <BarChart2 size={40} style={{ color: 'var(--color-text-muted)', marginBottom: 10 }} />
                  <p>Bado hujafanya mauzo yoyote</p>
                  <span>Rekodi zitaonekana hapa baada ya kuuza</span>
                </div>
              ) : (
                todaySales.map((tx: any, idx: number) => (
                  <div key={tx.id} className="pos-sale-card">
                    <div className="pos-sale-card__head">
                      <span className="pos-sale-card__num">#{todaySales.length - idx}</span>
                      <span className="pos-sale-card__time">
                        {format(new Date(tx.created_at), 'dd/MM HH:mm')}
                      </span>
                      <span className={`pos-sale-card__method pos-sale-card__method--${tx.payment_method}`}>
                        {tx.payment_method === 'cash' ? 'Pesa Taslimu'
                          : tx.payment_method === 'mpesa' ? 'M-Pesa'
                          : tx.payment_method === 'tigopesa' ? 'Tigo Pesa'
                          : tx.payment_method === 'airtelmoney' ? 'Airtel'
                          : tx.payment_method === 'halopesa' ? 'HaloPesa'
                          : tx.payment_method}
                      </span>
                      <span className="pos-sale-card__total">{fmt(tx.total_amount)}</span>
                    </div>
                    <div className="pos-sale-card__items">
                      {(tx.transaction_items as any[]).map((item: any, i: number) => (
                        <span key={i} className="pos-sale-card__item">
                          {item.product?.name ?? 'Bidhaa'} × {item.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {/* ── Held Carts Modal ────────────────────────────────────────── */}
      {showHeld && (
        <div className="pos-modal-overlay" onClick={() => setShowHeld(false)}>
          <div className="pos-modal animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="pos-modal__head">
              <Clock size={18} />
              <h3>{t('heldCarts')} ({held_carts.length})</h3>
              <button onClick={() => setShowHeld(false)}><X size={18} /></button>
            </div>
            <div className="pos-modal__body">
              {held_carts.map((hc) => (
                <div key={hc.id} className="held-card">
                  <div className="held-card__info">
                    <span className="held-card__time">
                      {format(new Date(hc.held_at), 'HH:mm')}
                    </span>
                    <span className="held-card__items">
                      {hc.items.length} {t('productsTab')} — {fmt(cartTotals(hc.items, hc.order_discount).total)}
                    </span>
                    <span className="held-card__list">
                      {hc.items.slice(0, 3).map((i) => i.name).join(', ')}
                      {hc.items.length > 3 ? '...' : ''}
                    </span>
                  </div>
                  <div className="held-card__actions">
                    <button
                      className="held-btn held-btn--resume"
                      onClick={() => { resumeCart(hc.id); setShowHeld(false); setActiveTab('cart') }}
                    >
                      {t('resumeCart')}
                    </button>
                    <button
                      className="held-btn held-btn--del"
                      onClick={() => deleteHeldCart(hc.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ────────────────────────────────────────────── */}
      {showPayment && (
        <div className="pos-modal-overlay">
          <div className="pos-modal pos-modal--pay animate-scale-in">
            <div className="pos-modal__head">
              <h3>{t('paymentTitle')}</h3>
              <button onClick={() => setShowPayment(false)}><X size={18} /></button>
            </div>
            <div className="pos-modal__body">
              <div className="pay-total">{fmt(total)}</div>

              {/* Payment method tabs */}
              <div className="pay-methods">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.id}
                    className={`pay-method ${payMethod === m.id ? 'pay-method--active' : ''}`}
                    style={payMethod === m.id ? { borderColor: m.color, color: m.color, background: m.color + '12' } : {}}
                    onClick={() => setPayMethod(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {payMethod === 'cash' && (
                <div className="pay-field">
                  <label>{t('cashTendered')}</label>
                  <input
                    type="number"
                    className="pay-input"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    autoFocus
                    min={total}
                  />
                  {Number(cashReceived) >= total && (
                    <div className="pay-change">
                      {t('change')}: <strong>{fmt(cashChange)}</strong>
                    </div>
                  )}
                </div>
              )}

              {payMethod === 'credit' && (
                <div className="pay-field">
                  <label>{t('creditCustomerLabel')}</label>
                  <input
                    type="search"
                    className="pay-input"
                    placeholder={t('searchCustomer')}
                    value={creditCustomerSearch}
                    onChange={e => { setCreditCustomerSearch(e.target.value); setCreditCustomerId('') }}
                  />
                  {creditCustomerSearch && !creditCustomerId && (
                    <div className="credit-cust-list">
                      {customers
                        .filter(c =>
                          c.name.toLowerCase().includes(creditCustomerSearch.toLowerCase()) ||
                          (c.phone ?? '').includes(creditCustomerSearch)
                        )
                        .slice(0, 5)
                        .map(c => (
                          <button
                            key={c.id}
                            className="credit-cust-row"
                            onClick={() => { setCreditCustomerId(c.id); setCreditCustomerSearch(c.name) }}
                          >
                            <span className="credit-cust-name">{c.name}</span>
                            <span className="credit-cust-phone">{c.phone ?? ''}</span>
                            <span className="credit-cust-bal">{t('creditBalance')}: {fmt(c.credit_balance)}</span>
                          </button>
                        ))
                      }
                      {customers.filter(c =>
                        c.name.toLowerCase().includes(creditCustomerSearch.toLowerCase()) ||
                        (c.phone ?? '').includes(creditCustomerSearch)
                      ).length === 0 && (
                        <p style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('noCustomerFound')}</p>
                      )}
                    </div>
                  )}
                  {creditCustomerId && (
                    <div className="credit-selected">
                      ✓ {customers.find(c => c.id === creditCustomerId)?.name} — {t('currentCredit')}: {fmt(customers.find(c => c.id === creditCustomerId)?.credit_balance ?? 0)}
                    </div>
                  )}
                </div>
              )}
              {payMethod !== 'cash' && payMethod !== 'other' && payMethod !== 'credit' && (
                <div className="pay-field">
                  <label>{t('refNumberOpt')}</label>
                  <input
                    type="text"
                    className="pay-input"
                    placeholder="mfano: MPesaRef123"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                  />
                </div>
              )}

              {payError && <p className="pay-error">{payError}</p>}
            </div>
            <div className="pos-modal__foot">
              <button className="pay-btn-cancel" onClick={() => setShowPayment(false)}>{t('cancel')}</button>
              <button
                className="pay-btn-confirm"
                disabled={paying || !items.length}
                onClick={handleConfirmSale}
              >
                {paying
                  ? <span className="pay-spinner" />
                  : <CheckCircle size={16} />}
                {paying ? t('saving') : t('completeSale')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Receipt Modal ────────────────────────────────────────────── */}
      {showReceipt && lastSale && (
        <div className="pos-modal-overlay">
          <div className="pos-modal pos-modal--receipt animate-scale-in">
            <div className="pos-modal__head pos-modal__head--success">
              <CheckCircle size={22} style={{ color: 'var(--color-success)' }} />
              <h3>{t('saleSuccess')}</h3>
            </div>
            <div className="pos-modal__body pos-modal__body--receipt">
              <Receipt sale={lastSale} />
            </div>
            <div className="pos-modal__foot">
              <button className="pay-btn-print" onClick={handlePrint}>
                <Printer size={15} /> {t('print')}
              </button>
              <button className="pay-btn-print" onClick={() => navigate(`/invoice/${lastSale.transaction_id}`)} style={{ background: 'var(--color-bg)', color: 'var(--color-primary)', border: '1.5px solid var(--color-primary)' }}>
                <BarChart2 size={15} /> Ankara
              </button>
              <button className="pay-btn-newsale" onClick={handleNewSale}>
                {t('newSale')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exit Staff Mode Modal ───────────────────────────────────── */}
      {showExitModal && (
        <div className="pos-modal-overlay" onClick={() => {
          setShowExitModal(false); setExitPin(''); setNewPin(''); setNewPinConfirm('')
          setExitError(''); setSettingPin(false)
        }}>
          <div className="pos-modal animate-scale-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="pos-modal__head">
              <Lock size={20} style={{ color: 'var(--color-primary)' }} />
              <h3>{!hasPin || settingPin ? 'Weka PIN ya Mmiliki' : 'Rudi kwa Mmiliki'}</h3>
            </div>

            {/* ── First time: set a PIN ── */}
            {(!hasPin || settingPin) ? (
              <div className="pos-modal__body" style={{ padding: '16px 20px' }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
                  {settingPin
                    ? 'Badilisha PIN yako ya kufungua mfumo.'
                    : 'Umeingia kwa Google. Weka PIN ya nambari 4-6 utakayoitumia kufungua mfumo badala ya nenosiri.'}
                </p>
                <PinInput label="PIN Mpya" value={newPin} onChange={v => { setNewPin(v); setExitError('') }} />
                <PinInput label="Thibitisha PIN" value={newPinConfirm} onChange={v => { setNewPinConfirm(v); setExitError('') }} style={{ marginTop: 10 }} />
                {exitError && <div className="exit-pin-error">{exitError}</div>}
                <div className="pos-modal__foot" style={{ marginTop: 16, padding: 0 }}>
                  <button className="pay-btn-cancel" onClick={() => {
                    setSettingPin(false); setNewPin(''); setNewPinConfirm(''); setExitError('')
                  }}>Ghairi</button>
                  <button className="pay-btn-confirm" disabled={exitLoading || newPin.length < 4} onClick={handleSaveNewPin}>
                    {exitLoading ? <span className="pay-spinner" /> : <Lock size={14} />}
                    {exitLoading ? 'Inahifadhi…' : 'Hifadhi PIN'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Normal: enter PIN ── */
              <div className="pos-modal__body" style={{ padding: '16px 20px' }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 14 }}>
                  Weka PIN yako ya mmiliki kufungua mfumo kamili.
                </p>
                <PinInput
                  label="PIN ya Mmiliki"
                  value={exitPin}
                  onChange={v => { setExitPin(v); setExitError('') }}
                  onEnter={handleExitStaffMode}
                  autoFocus
                />
                {exitError && <div className="exit-pin-error">{exitError}</div>}
                <button
                  type="button"
                  onClick={() => { setSettingPin(true); setExitPin(''); setExitError('') }}
                  style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10, textDecoration: 'underline' }}
                >
                  Umesahau PIN? Weka PIN mpya
                </button>
                <div className="pos-modal__foot" style={{ marginTop: 16, padding: 0 }}>
                  <button className="pay-btn-cancel" onClick={() => {
                    setShowExitModal(false); setExitPin(''); setExitError('')
                  }}>Ghairi</button>
                  <button className="pay-btn-confirm" disabled={exitLoading || !exitPin} onClick={handleExitStaffMode}>
                    {exitLoading ? <span className="pay-spinner" /> : <Lock size={14} />}
                    {exitLoading ? 'Inathibitisha…' : 'Ingia kama Mmiliki'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Discount order shortcut icon ─────────────────────────────── */}
      {items.length > 0 && (
        <button
          className="pos-fab"
          onClick={() => setActiveTab('cart')}
          title="Angalia mkoba"
        >
          <ShoppingCart size={20} />
          <span className="pos-fab__count">{items.reduce((s, i) => s + i.quantity, 0)}</span>
        </button>
      )}

      {/* ── Styles ────────────────────────────────────────────────────── */}
      <style>{`
        /* ── Layout ── */
        .pos {
          display: flex; flex-direction: column;
          height: 100vh; height: 100dvh;
          background: var(--color-bg); overflow: hidden;
        }

        /* ── Top bar ── */
        .pos-bar {
          display: flex; align-items: center; justify-content: space-between;
          height: 52px; background: var(--color-primary); color: #fff;
          padding: 0 var(--space-4); gap: var(--space-3); flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,.25);
        }
        .pos-bar__back {
          display: flex; align-items: center; gap: 5px;
          color: rgba(255,255,255,.85); font-size: 0.85rem; font-weight: 600;
          transition: color var(--transition-fast);
        }
        .pos-bar__back:hover { color: #fff; }
        .pos-bar__back-label { display: none; }
        @media (min-width: 640px) { .pos-bar__back-label { display: inline; } }
        .pos-bar__exit-staff { background: rgba(255,255,255,.18); border-radius: 8px; padding: 5px 10px; }
        .pos-bar__exit-staff:hover { background: rgba(255,255,255,.3); color: #fff; }
        .exit-pin-error {
          background: #fee2e2; color: #dc2626;
          padding: 8px 12px; border-radius: 8px; font-size: 12px;
          font-weight: 500; margin-top: 10px;
        }
        .pos-bar__staff-badge {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,.18); border-radius: 8px;
          padding: 4px 10px; font-size: 0.82rem; font-weight: 700; color: #fff;
        }
        .pos-bar__staff-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #4ade80; flex-shrink: 0;
          box-shadow: 0 0 0 2px rgba(74,222,128,.3);
        }

        .pos-bar__center { display: flex; flex-direction: column; align-items: center; flex: 1; }
        .pos-bar__shop { font-weight: 800; font-size: 0.95rem; font-family: var(--font-heading); }
        .pos-bar__clock { font-size: 0.72rem; opacity: .75; font-family: monospace; }

        .pos-bar__right { display: flex; align-items: center; gap: var(--space-2); }
        .pos-staff-sel {
          background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.3);
          color: #fff; border-radius: var(--radius-m);
          padding: 4px 8px; font-size: 0.78rem; cursor: pointer;
          max-width: 140px;
        }
        .pos-staff-sel option { background: var(--color-primary); color: #fff; }
        .pos-bar__held {
          display: flex; align-items: center; gap: 4px;
          background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.3);
          color: #fff; border-radius: var(--radius-m); padding: 5px 8px; font-size: 0.78rem;
          font-weight: 700; cursor: pointer;
        }
        .pos-bar__held:hover { background: rgba(255,255,255,.25); }

        /* ── Mobile tabs ── */
        .pos-tabs {
          display: flex; background: var(--color-surface);
          border-bottom: 2px solid var(--color-border); flex-shrink: 0;
        }
        @media (min-width: 900px) { .pos-tabs { display: none; } }
        .pos-tab {
          flex: 1; padding: var(--space-3); font-size: 0.85rem; font-weight: 600;
          color: var(--color-text-muted); position: relative; transition: color var(--transition-fast);
        }
        .pos-tab--active { color: var(--color-primary); border-bottom: 2px solid var(--color-primary); }
        .pos-tab__badge {
          position: absolute; top: 4px; right: calc(50% - 24px);
          background: var(--color-error); color: #fff; border-radius: var(--radius-full);
          font-size: 0.65rem; font-weight: 800; padding: 1px 5px; min-width: 18px; text-align: center;
        }

        /* ── Body split ── */
        .pos-body {
          display: flex; flex: 1; overflow: hidden;
        }
        @media (max-width: 899px) {
          .pos-panel--hide { display: none; }
          .pos-panel--show { flex: 1; display: flex; flex-direction: column; }
        }

        /* ── Products panel ── */
        .pos-products {
          flex: 1; display: flex; flex-direction: column;
          background: var(--color-bg); overflow: hidden;
        }
        @media (min-width: 900px) { .pos-products { display: flex !important; } }

        .pos-search {
          display: flex; align-items: center; gap: var(--space-2);
          margin: var(--space-3); padding: 0 var(--space-3);
          background: var(--color-surface); border: 1.5px solid var(--color-border);
          border-radius: var(--radius-l); transition: border-color var(--transition-fast);
          flex-shrink: 0;
        }
        .pos-search:focus-within { border-color: var(--color-primary); }
        .pos-search__icon { color: var(--color-text-muted); flex-shrink: 0; }
        .pos-search__input {
          flex: 1; padding: var(--space-3) 0; border: none; outline: none;
          background: none; font-size: 0.9rem; color: var(--color-text);
        }
        .pos-search__clear { color: var(--color-text-muted); padding: 4px; }
        .pos-search__cam { color: var(--color-text-muted); flex-shrink: 0; }

        .pos-grid {
          flex: 1; overflow-y: auto; padding: 0 var(--space-3) var(--space-3);
          display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: var(--space-3);
          align-content: start;
        }
        @media (min-width: 1200px) {
          .pos-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        }

        .pos-empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: var(--space-3);
          color: var(--color-text-muted); font-size: 0.875rem; text-align: center;
        }

        /* Product tile */
        .pos-tile {
          background: var(--color-surface); border: 1.5px solid var(--color-border);
          border-radius: var(--radius-l); overflow: hidden; cursor: pointer;
          transition: all var(--transition-fast); text-align: left;
          display: flex; flex-direction: column;
        }
        .pos-tile:hover:not(:disabled) { border-color: var(--color-primary); box-shadow: var(--shadow-md); transform: translateY(-2px); }
        .pos-tile--incart { border-color: var(--color-primary); background: var(--color-primary-light); }
        .pos-tile--oos { opacity: .55; cursor: not-allowed; }
        .pos-tile__img {
          height: 80px; display: flex; align-items: center; justify-content: center;
          background: var(--color-surface-2); position: relative; overflow: hidden;
        }
        .pos-tile__img img { width: 100%; height: 100%; object-fit: cover; }
        .pos-tile__emoji { font-size: 2.2rem; }
        .pos-tile__badge {
          position: absolute; top: 4px; right: 4px;
          background: var(--color-primary); color: #fff; font-size: 0.65rem; font-weight: 800;
          border-radius: var(--radius-full); padding: 1px 5px; min-width: 18px; text-align: center;
        }
        .pos-tile__oos-label {
          position: absolute; bottom: 0; left: 0; right: 0;
          background: rgba(220,38,38,.85); color: #fff; font-size: 0.68rem; font-weight: 700;
          text-align: center; padding: 2px;
        }
        .pos-tile__body { padding: 6px 8px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .pos-tile__name { font-size: 0.78rem; font-weight: 600; line-height: 1.25; }
        .pos-tile__price { font-size: 0.8rem; font-weight: 800; color: var(--color-primary); }
        .pos-tile__stock { font-size: 0.68rem; color: var(--color-text-muted); }
        .pos-tile__stock--low { color: var(--color-warning); font-weight: 600; }

        /* ── Today's Sales panel ── */
        .pos-sales-panel {
          width: 340px; flex-shrink: 0;
          background: var(--color-surface); border-left: 1px solid var(--color-border);
          display: flex; flex-direction: column; overflow: hidden;
        }
        @media (min-width: 900px) { .pos-sales-panel { display: flex !important; } }
        @media (max-width: 899px) { .pos-sales-panel { width: 100%; border-left: none; } }

        .pos-sales-panel__header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 16px; border-bottom: 1px solid var(--color-border);
          background: var(--color-bg); flex-shrink: 0;
        }
        .pos-sales-stat { display: flex; flex-direction: column; gap: 2px; }
        .pos-sales-stat__label { font-size: 0.7rem; color: var(--color-text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
        .pos-sales-stat__count { font-size: 0.9rem; font-weight: 700; color: var(--color-text); }
        .pos-sales-stat--total { text-align: right; }
        .pos-sales-stat__amount { font-size: 1.05rem; font-weight: 800; color: var(--color-primary); }

        .pos-sales-panel__list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }

        .pos-sales-empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          flex: 1; text-align: center; color: var(--color-text-muted); padding: 40px 20px;
        }
        .pos-sales-empty p { font-size: 0.9rem; font-weight: 600; margin: 0 0 4px; }
        .pos-sales-empty span { font-size: 0.75rem; }

        .pos-sale-card {
          background: var(--color-card); border: 1px solid var(--color-border);
          border-radius: 10px; padding: 10px 12px;
        }
        .pos-sale-card__head {
          display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
        }
        .pos-sale-card__num { font-weight: 800; font-size: 0.78rem; color: var(--color-text-muted); min-width: 24px; }
        .pos-sale-card__time { font-size: 0.75rem; color: var(--color-text-muted); font-family: monospace; }
        .pos-sale-card__method {
          font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;
          background: var(--color-primary-light); color: var(--color-primary);
        }
        .pos-sale-card__method--cash { background: #dcfce7; color: #16a34a; }
        .pos-sale-card__method--mpesa { background: #f0fdf4; color: #15803d; }
        .pos-sale-card__method--tigopesa { background: #fef9c3; color: #854d0e; }
        .pos-sale-card__method--airtelmoney { background: #fee2e2; color: #dc2626; }
        .pos-sale-card__method--halopesa { background: #ede9fe; color: #7c3aed; }
        .pos-sale-card__total { margin-left: auto; font-weight: 800; font-size: 0.9rem; color: var(--color-text); }
        .pos-sale-card__items { display: flex; flex-wrap: wrap; gap: 4px; }
        .pos-sale-card__item {
          font-size: 0.7rem; background: var(--color-bg); border: 1px solid var(--color-border);
          border-radius: 4px; padding: 2px 6px; color: var(--color-text-secondary);
        }

        /* ── Cart panel ── */
        .pos-cart {
          width: 340px; flex-shrink: 0;
          background: var(--color-surface); border-left: 1px solid var(--color-border);
          display: flex; flex-direction: column; overflow: hidden;
        }
        @media (min-width: 900px) { .pos-cart { display: flex !important; } }
        @media (max-width: 899px) { .pos-cart { width: 100%; border-left: none; } }

        .pos-cart__header {
          display: flex; align-items: center; gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--color-border);
          font-weight: 700; font-size: 0.9rem; flex-shrink: 0;
        }
        .pos-cart__clear { margin-left: auto; color: var(--color-text-muted); padding: 4px; border-radius: var(--radius-s); }
        .pos-cart__clear:hover { color: var(--color-error); background: var(--color-error-bg); }

        .pos-cart__items { flex: 1; overflow-y: auto; padding: var(--space-2) var(--space-3); }

        .pos-cart__empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 200px; gap: var(--space-3); color: var(--color-text-muted); font-size: 0.875rem;
        }

        /* Cart row */
        .cart-row {
          padding: var(--space-2) 0;
          border-bottom: 1px solid var(--color-border);
        }
        .cart-row:last-child { border-bottom: none; }
        .cart-row__info { margin-bottom: 5px; }
        .cart-row__name { font-size: 0.82rem; font-weight: 600; display: block; }
        .cart-row__price { font-size: 0.72rem; color: var(--color-text-muted); }
        .cart-row__disc { font-size: 0.72rem; color: var(--color-error); margin-left: 6px; }
        .cart-row__controls { display: flex; align-items: center; gap: var(--space-2); }
        .qty-ctrl { display: flex; align-items: center; border: 1px solid var(--color-border); border-radius: var(--radius-m); overflow: hidden; }
        .qty-btn { padding: 4px 8px; color: var(--color-text-secondary); font-size: 0.75rem; transition: background var(--transition-fast); }
        .qty-btn:hover { background: var(--color-primary-light); color: var(--color-primary); }
        .qty-val { padding: 4px 8px; font-size: 0.8rem; font-weight: 700; min-width: 28px; text-align: center; }
        .cart-row__subtotal { margin-left: auto; font-weight: 700; font-size: 0.85rem; color: var(--color-primary); }
        .cart-row__disc-btn { font-size: 0.72rem; color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: var(--radius-s); padding: 3px 6px; }
        .cart-row__disc-btn:hover { color: var(--color-warning); border-color: var(--color-warning); }
        .cart-row__del { color: var(--color-text-muted); padding: 4px; border-radius: var(--radius-s); }
        .cart-row__del:hover { color: var(--color-error); background: var(--color-error-bg); }
        .cart-row__disc-input { display: flex; align-items: center; gap: var(--space-2); padding: 4px 0; font-size: 0.78rem; color: var(--color-text-secondary); }
        .disc-inp { flex: 1; padding: 4px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-s); font-size: 0.8rem; outline: none; }
        .disc-inp:focus { border-color: var(--color-primary); }

        /* Cart footer */
        .pos-cart__footer { border-top: 1px solid var(--color-border); padding: var(--space-3); flex-shrink: 0; }
        .pos-totals { display: flex; flex-direction: column; gap: 6px; margin-bottom: var(--space-3); }
        .pos-total-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; }
        .pos-total-row--disc { gap: var(--space-2); }
        .pos-total-row--disc label { font-size: 0.75rem; color: var(--color-text-muted); white-space: nowrap; }
        .disc-whole { width: 100px; padding: 4px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-s); text-align: right; font-size: 0.8rem; outline: none; }
        .disc-whole:focus { border-color: var(--color-primary); }
        .pos-total-row--total { font-size: 1rem; font-weight: 800; color: var(--color-primary); }

        .pos-actions { display: flex; gap: var(--space-2); }
        .pos-act { display: flex; align-items: center; justify-content: center; gap: 6px; padding: var(--space-3); border-radius: var(--radius-l); font-weight: 700; transition: all var(--transition-fast); font-size: 0.85rem; }
        .pos-act--hold { border: 1.5px solid var(--color-border); color: var(--color-text-secondary); background: var(--color-surface); flex: 0 0 auto; }
        .pos-act--hold:hover { border-color: var(--color-warning); color: var(--color-warning); background: var(--color-warning-bg); }
        .pos-act--pay { flex: 1; background: var(--color-primary); color: #fff; flex-direction: column; gap: 0; }
        .pos-act--pay:hover:not(:disabled) { background: var(--color-primary-hover); box-shadow: var(--shadow-md); }
        .pos-act--pay:disabled { opacity: .5; cursor: not-allowed; }
        .pos-act__amt { font-size: 0.75rem; font-weight: 500; opacity: .85; }

        /* ── FAB (mobile) ── */
        .pos-fab {
          position: fixed; bottom: var(--space-5); right: var(--space-5);
          background: var(--color-primary); color: #fff; border-radius: var(--radius-full);
          width: 52px; height: 52px; display: flex; align-items: center; justify-content: center;
          box-shadow: var(--shadow-lg); z-index: 50;
        }
        @media (min-width: 900px) { .pos-fab { display: none; } }
        .pos-fab__count {
          position: absolute; top: -2px; right: -2px;
          background: var(--color-error); color: #fff; border-radius: var(--radius-full);
          font-size: 0.65rem; font-weight: 800; min-width: 18px; height: 18px;
          display: flex; align-items: center; justify-content: center; border: 2px solid #fff;
        }

        /* ── Modals ── */
        .pos-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.55);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-4); z-index: 200; overflow-y: auto;
        }
        .pos-modal {
          background: var(--color-surface); border-radius: var(--radius-xl);
          width: 100%; max-width: 440px; box-shadow: var(--shadow-lg); display: flex; flex-direction: column;
        }
        .pos-modal--pay { max-width: 400px; }
        .pos-modal--receipt { max-width: 400px; }
        .pos-modal__head {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border);
        }
        .pos-modal__head h3 { flex: 1; font-size: 1rem; font-weight: 700; }
        .pos-modal__head button { color: var(--color-text-muted); padding: 4px; border-radius: var(--radius-s); }
        .pos-modal__head--success { background: var(--color-success-bg); }
        .pos-modal__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); flex: 1; overflow-y: auto; }
        .pos-modal__body--receipt { padding: var(--space-4); background: #fff; }
        .pos-modal__foot {
          padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border);
          display: flex; gap: var(--space-3); justify-content: flex-end;
        }

        /* Payment modal */
        .pay-total { font-size: 2rem; font-weight: 900; color: var(--color-primary); text-align: center; font-family: var(--font-heading); }
        .pay-methods { display: flex; flex-wrap: wrap; gap: var(--space-2); }
        .pay-method { padding: 6px 14px; border: 1.5px solid var(--color-border); border-radius: var(--radius-l); font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all var(--transition-fast); color: var(--color-text-secondary); }
        .pay-method:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .pay-field { display: flex; flex-direction: column; gap: 5px; }
        .pay-field label { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); }
        .pay-input { padding: 10px var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-size: 1rem; outline: none; }
        .pay-input:focus { border-color: var(--color-primary); box-shadow: var(--shadow-focus); }
        .pay-change { font-size: 0.85rem; color: var(--color-success); font-weight: 600; margin-top: 4px; }
        .pay-error { font-size: 0.82rem; color: var(--color-error); background: var(--color-error-bg); padding: var(--space-3); border-radius: var(--radius-m); }
        .pay-btn-cancel { padding: var(--space-3) var(--space-5); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-weight: 600; font-size: 0.9rem; color: var(--color-text-secondary); }
        .pay-btn-cancel:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .pay-btn-confirm { padding: var(--space-3) var(--space-6); background: var(--color-primary); color: #fff; border-radius: var(--radius-m); font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 8px; }
        .pay-btn-confirm:hover:not(:disabled) { background: var(--color-primary-hover); }
        .pay-btn-confirm:disabled { opacity: .6; cursor: not-allowed; }
        .pay-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
        .credit-cust-list { border: 1.5px solid var(--color-border); border-radius: var(--radius-m); overflow: hidden; margin-top: 4px; }
        .credit-cust-row { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--color-border); transition: background var(--transition-fast); }
        .credit-cust-row:last-child { border-bottom: none; }
        .credit-cust-row:hover { background: var(--color-primary-light); }
        .credit-cust-name { font-weight: 600; font-size: 0.85rem; }
        .credit-cust-phone { font-size: 0.75rem; color: var(--color-text-muted); }
        .credit-cust-bal { font-size: 0.72rem; color: var(--color-error); font-weight: 600; }
        .credit-selected { font-size: 0.82rem; color: var(--color-success); background: var(--color-success-bg); padding: 8px 12px; border-radius: var(--radius-m); margin-top: 4px; font-weight: 600; }
        .pay-btn-print { padding: var(--space-3) var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-m); font-weight: 600; font-size: 0.85rem; display: flex; align-items: center; gap: 6px; color: var(--color-text-secondary); }
        .pay-btn-print:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .pay-btn-newsale { flex: 1; padding: var(--space-3) var(--space-5); background: var(--color-primary); color: #fff; border-radius: var(--radius-m); font-weight: 700; font-size: 0.95rem; }
        .pay-btn-newsale:hover { background: var(--color-primary-hover); }

        /* Held carts */
        .held-card { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-l); }
        .held-card__info { flex: 1; min-width: 0; }
        .held-card__time { font-weight: 700; font-size: 0.85rem; display: block; }
        .held-card__items { font-size: 0.78rem; color: var(--color-primary); font-weight: 600; }
        .held-card__list { font-size: 0.72rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; max-width: 200px; }
        .held-card__actions { display: flex; gap: var(--space-2); }
        .held-btn { padding: 6px 14px; border-radius: var(--radius-m); font-size: 0.8rem; font-weight: 600; }
        .held-btn--resume { background: var(--color-primary); color: #fff; }
        .held-btn--resume:hover { background: var(--color-primary-hover); }
        .held-btn--del { border: 1px solid var(--color-border); color: var(--color-text-muted); }
        .held-btn--del:hover { border-color: var(--color-error); color: var(--color-error); }

        /* ── Receipt (also print target) ── */
        .receipt { font-family: 'Courier New', monospace; font-size: 0.82rem; color: #000; background: #fff; padding: var(--space-3); }
        .receipt__head { text-align: center; margin-bottom: var(--space-2); }
        .receipt__head strong { display: block; font-size: 1rem; }
        .receipt__meta { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 0.72rem; color: #555; margin-bottom: var(--space-2); }
        .receipt__divider { color: #888; font-size: 0.72rem; overflow: hidden; margin: var(--space-2) 0; }
        .receipt__items { width: 100%; border-collapse: collapse; }
        .receipt__item-name { padding: 2px 0; max-width: 160px; }
        .receipt__item-qty { text-align: center; padding: 2px 4px; white-space: nowrap; }
        .receipt__item-amt { text-align: right; padding: 2px 0; font-weight: 700; white-space: nowrap; }
        .receipt__totals { display: flex; flex-direction: column; gap: 4px; font-size: 0.82rem; }
        .receipt__totals div { display: flex; justify-content: space-between; }
        .receipt__change { font-weight: 700; }
        .receipt__footer { text-align: center; font-size: 0.78rem; color: #555; margin-top: var(--space-2); }

        /* Print styles */
        @media print {
          body > *:not(#pos-receipt-print) { display: none !important; }
          #pos-receipt-print { display: block !important; font-size: 11pt; }
          .pos { display: none !important; }
        }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes animate-scale-in { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: animate-scale-in 180ms ease-out; }
        .skeleton { background: var(--color-surface-2); animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>
    </div>
  )
}
