import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL  as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anon) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
})

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string; name: string; owner_user_id: string
          vfd_enabled: boolean; vfd_provider_config: Json | null
          phone: string | null; address: string | null
          currency: string; timezone: string; language: string
          created_at: string; updated_at: string
        }
      }
      products: {
        Row: {
          id: string; shop_id: string; name: string
          photo_url: string | null; price: number
          category: string | null; active: boolean
          created_at: string; updated_at: string
        }
      }
      stock_levels: {
        Row: {
          id: string; product_id: string; shop_id: string
          quantity: number; reorder_threshold: number; updated_at: string
        }
      }
      transactions: {
        Row: {
          id: string; shop_id: string; staff_id: string | null
          payment_method: string; total_amount: number
          sync_status: string; offline_id: string | null
          notes: string | null; created_at: string
        }
      }
      staff: {
        Row: {
          id: string; shop_id: string; full_name: string
          pin_hash: string; active: boolean
          created_at: string; updated_at: string
        }
      }
      cash_reconciliations: {
        Row: {
          id: string; shop_id: string; staff_id: string | null
          shift_date: string; expected_cash: number
          actual_cash: number; variance: number
          notes: string | null; created_at: string
        }
      }
      notifications_log: {
        Row: {
          id: string; shop_id: string; type: string
          channel: string; payload: Json | null
          status: string; sent_at: string | null; created_at: string
        }
      }
    }
    Views: {
      v_dashboard_today: {
        Row: {
          shop_id: string; shop_name: string
          revenue_today: number; transactions_today: number
          active_staff_today: number; low_stock_count: number
          variance_alerts_today: number
        }
      }
      v_low_stock: {
        Row: {
          shop_id: string; product_id: string; product_name: string
          photo_url: string | null; category: string | null
          quantity: number; reorder_threshold: number
        }
      }
    }
  }
}
