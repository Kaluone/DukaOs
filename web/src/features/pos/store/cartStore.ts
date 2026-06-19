import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  product_id: string
  name: string
  price: number
  buying_price: number
  quantity: number
  item_discount: number
  photo_url: string | null
  category: string | null
  stock_quantity: number
}

export interface HeldCart {
  id: string
  items: CartItem[]
  order_discount: number
  held_at: number
}

interface CartStore {
  items: CartItem[]
  order_discount: number
  held_carts: HeldCart[]

  addItem: (product: Omit<CartItem, 'quantity' | 'item_discount'>) => void
  removeItem: (product_id: string) => void
  updateQty: (product_id: string, delta: number) => void
  setQty: (product_id: string, qty: number) => void
  setItemDiscount: (product_id: string, discount: number) => void
  setOrderDiscount: (d: number) => void
  clearCart: () => void
  holdCart: () => void
  resumeCart: (id: string) => void
  deleteHeldCart: (id: string) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      order_discount: 0,
      held_carts: [],

      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.product_id === product.product_id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product_id === product.product_id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            }
          }
          return {
            items: [...state.items, { ...product, quantity: 1, item_discount: 0 }],
          }
        }),

      removeItem: (product_id) =>
        set((state) => ({
          items: state.items.filter((i) => i.product_id !== product_id),
        })),

      updateQty: (product_id, delta) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product_id === product_id
              ? { ...i, quantity: Math.max(1, i.quantity + delta) }
              : i
          ),
        })),

      setQty: (product_id, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((i) => i.product_id !== product_id)
              : state.items.map((i) =>
                  i.product_id === product_id ? { ...i, quantity: qty } : i
                ),
        })),

      setItemDiscount: (product_id, discount) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.product_id === product_id
              ? { ...i, item_discount: Math.max(0, discount) }
              : i
          ),
        })),

      setOrderDiscount: (d) => set({ order_discount: Math.max(0, d) }),

      clearCart: () => set({ items: [], order_discount: 0 }),

      holdCart: () =>
        set((state) => {
          if (!state.items.length) return state
          const held: HeldCart = {
            id: crypto.randomUUID(),
            items: [...state.items],
            order_discount: state.order_discount,
            held_at: Date.now(),
          }
          return {
            items: [],
            order_discount: 0,
            held_carts: [held, ...state.held_carts].slice(0, 5),
          }
        }),

      resumeCart: (id) =>
        set((state) => {
          const held = state.held_carts.find((h) => h.id === id)
          if (!held) return state
          return {
            items: held.items,
            order_discount: held.order_discount,
            held_carts: state.held_carts.filter((h) => h.id !== id),
          }
        }),

      deleteHeldCart: (id) =>
        set((state) => ({
          held_carts: state.held_carts.filter((h) => h.id !== id),
        })),
    }),
    {
      name: 'dukaos-cart',
      // Only persist held carts; active cart resets on page refresh intentionally
      partialize: (state) => ({ held_carts: state.held_carts }),
    }
  )
)

export function cartTotals(items: CartItem[], order_discount: number) {
  const subtotal = items.reduce(
    (sum, i) => sum + i.price * i.quantity - i.item_discount,
    0
  )
  const total = Math.max(0, subtotal - order_discount)
  const gross_profit = items.reduce(
    (sum, i) => sum + (i.price - i.buying_price) * i.quantity - i.item_discount,
    0
  )
  return { subtotal, total, gross_profit }
}
