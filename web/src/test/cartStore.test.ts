import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore, cartTotals } from '@/features/pos/store/cartStore'

const sampleItem = {
  product_id: 'p1',
  name: 'Unga wa Ugali',
  price: 4500,
  buying_price: 3800,
  photo_url: null,
  category: 'Groceries',
  stock_quantity: 50,
}

const makeItem = (overrides: Partial<{ price: number; buying_price: number; quantity: number }> = {}) => ({
  product_id: 'p1', name: 'A', price: 1000, buying_price: 700,
  photo_url: null, category: null, quantity: 1, item_discount: 0, stock_quantity: 10,
  ...overrides,
})

describe('cartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], held_carts: [], order_discount: 0 })
  })

  it('starts empty', () => {
    const { items } = useCartStore.getState()
    expect(items).toHaveLength(0)
  })

  it('adds item to cart', () => {
    useCartStore.getState().addItem(sampleItem)
    const { items } = useCartStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].product_id).toBe('p1')
    expect(items[0].quantity).toBe(1)
  })

  it('increments quantity when same item added twice', () => {
    useCartStore.getState().addItem(sampleItem)
    useCartStore.getState().addItem(sampleItem)
    const { items } = useCartStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0].quantity).toBe(2)
  })

  it('removes item', () => {
    useCartStore.getState().addItem(sampleItem)
    useCartStore.getState().removeItem('p1')
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('updates quantity via delta', () => {
    useCartStore.getState().addItem(sampleItem)
    useCartStore.getState().updateQty('p1', 4)
    expect(useCartStore.getState().items[0].quantity).toBe(5)
  })

  it('setQty removes item when qty is 0', () => {
    useCartStore.getState().addItem(sampleItem)
    useCartStore.getState().setQty('p1', 0)
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('clears cart', () => {
    useCartStore.getState().addItem(sampleItem)
    useCartStore.getState().clearCart()
    expect(useCartStore.getState().items).toHaveLength(0)
  })
})

describe('cartTotals', () => {
  it('calculates correct subtotal and total with no order discount', () => {
    const items = [makeItem({ price: 1000, quantity: 2 })]
    const totals = cartTotals(items, 0)
    expect(totals.subtotal).toBe(2000)
    expect(totals.total).toBe(2000)
  })

  it('applies order discount (fixed amount)', () => {
    const items = [makeItem({ price: 1000, quantity: 1 })]
    const totals = cartTotals(items, 100)
    expect(totals.total).toBe(900)
  })

  it('calculates gross profit correctly', () => {
    const items = [makeItem({ price: 1000, buying_price: 700, quantity: 2 })]
    const totals = cartTotals(items, 0)
    expect(totals.gross_profit).toBe(600)
  })

  it('returns zero totals for empty cart', () => {
    const totals = cartTotals([], 0)
    expect(totals.total).toBe(0)
    expect(totals.subtotal).toBe(0)
  })

  it('total cannot go below zero', () => {
    const items = [makeItem({ price: 100, quantity: 1 })]
    const totals = cartTotals(items, 9999)
    expect(totals.total).toBe(0)
  })
})
