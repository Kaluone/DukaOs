import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Moon, Sun, TrendingUp, TrendingDown, DollarSign, ShoppingBag, RotateCcw, Printer } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, startOfDay, endOfDay } from 'date-fns'

interface EODSummary {
  total_sales: number
  total_refunds: number
  total_expenses: number
  total_purchases: number
  gross_profit: number
  net_profit: number
  cash_balance: number
  transactions_count: number
}

interface EODRecord {
  id: string
  closing_date: string
  total_sales: number
  total_refunds: number
  total_expenses: number
  gross_profit: number
  net_profit: number
  cash_balance: number
  transactions_count: number
  created_at: string
  closed_by_staff: { full_name: string } | null
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

export function EODPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [closing, setClosing] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const today = format(new Date(), 'yyyy-MM-dd')

  const { data: todaySummary, isLoading: summaryLoading } = useQuery<EODSummary>({
    queryKey: ['eod-summary-today', shop?.id],
    enabled: !!shop?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const dayStart = startOfDay(new Date()).toISOString()
      const dayEnd = endOfDay(new Date()).toISOString()

      const [salesRes, expensesRes, refundsRes] = await Promise.all([
        supabase.from('transactions')
          .select('total_amount, transaction_items(buying_price, quantity, subtotal)')
          .eq('shop_id', shop!.id).gte('created_at', dayStart).lte('created_at', dayEnd),
        supabase.from('expenses')
          .select('amount').eq('shop_id', shop!.id).gte('created_at', dayStart).lte('created_at', dayEnd),
        supabase.from('refunds')
          .select('total_amount').eq('shop_id', shop!.id).eq('status', 'completed')
          .gte('created_at', dayStart).lte('created_at', dayEnd),
      ])

      const totalSales = (salesRes.data ?? []).reduce((s, t) => s + (t.total_amount ?? 0), 0)
      const totalExpenses = (expensesRes.data ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
      const totalRefunds = (refundsRes.data ?? []).reduce((s, r) => s + (r.total_amount ?? 0), 0)
      const cogs = (salesRes.data ?? []).reduce((s, t) => {
        return s + ((t.transaction_items as any[]) ?? []).reduce((ss: number, i: any) => ss + ((i.buying_price ?? 0) * (i.quantity ?? 0)), 0)
      }, 0)
      const grossProfit = totalSales - cogs - totalRefunds
      const netProfit = grossProfit - totalExpenses

      return {
        total_sales: totalSales,
        total_refunds: totalRefunds,
        total_expenses: totalExpenses,
        total_purchases: 0,
        gross_profit: grossProfit,
        net_profit: netProfit,
        cash_balance: totalSales - totalRefunds,
        transactions_count: salesRes.data?.length ?? 0,
      }
    },
  })

  const { data: closings = [] } = useQuery<EODRecord[]>({
    queryKey: ['eod-closings', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eod_closings')
        .select('*, closed_by_staff:closed_by(full_name)')
        .eq('shop_id', shop!.id)
        .order('closing_date', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as unknown as EODRecord[]
    },
  })

  const alreadyClosed = closings.some(c => c.closing_date === today)

  const closeDayMutation = useMutation({
    mutationFn: async () => {
      if (!shop?.id || !todaySummary) throw new Error('No data')
      const { error } = await supabase.from('eod_closings').insert({
        shop_id: shop.id,
        closing_date: today,
        total_sales: todaySummary.total_sales,
        total_refunds: todaySummary.total_refunds,
        total_expenses: todaySummary.total_expenses,
        total_purchases: todaySummary.total_purchases,
        gross_profit: todaySummary.gross_profit,
        net_profit: todaySummary.net_profit,
        cash_balance: todaySummary.cash_balance,
        transactions_count: todaySummary.transactions_count,
        notes: notes || null,
        summary_data: todaySummary,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eod-closings', shop?.id] })
      setClosing(false)
      setNotes('')
    },
    onError: (e: Error) => setError(e.message),
  })

  const printReport = () => {
    window.print()
  }

  return (
    <div style={{ padding: '24px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Moon size={22} style={{ color: 'var(--color-primary)' }} /> End of Day Closing
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>
            {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={printReport} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontSize: 13 }}>
            <Printer size={14} /> Print
          </button>
          {!alreadyClosed && (
            <button
              onClick={() => setClosing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              <Moon size={15} /> Close Day
            </button>
          )}
        </div>
      </div>

      {/* Today's Summary */}
      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Today's Summary</h3>
          {alreadyClosed && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '3px 10px', borderRadius: 10 }}>Day Closed</span>
          )}
        </div>
        {summaryLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-secondary)' }}>Computing…</div>
        ) : todaySummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {[
              { label: 'Total Sales', value: fmt(todaySummary.total_sales), icon: ShoppingBag, color: '#16a34a' },
              { label: 'Total Refunds', value: fmt(todaySummary.total_refunds), icon: RotateCcw, color: '#dc2626' },
              { label: 'Total Expenses', value: fmt(todaySummary.total_expenses), icon: DollarSign, color: '#f59e0b' },
              { label: 'Gross Profit', value: fmt(todaySummary.gross_profit), icon: TrendingUp, color: '#7c3aed' },
              { label: 'Net Profit', value: fmt(todaySummary.net_profit), icon: todaySummary.net_profit >= 0 ? TrendingUp : TrendingDown, color: todaySummary.net_profit >= 0 ? '#16a34a' : '#dc2626' },
              { label: 'Transactions', value: todaySummary.transactions_count.toString(), icon: Sun, color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--color-bg)', borderRadius: 10, padding: 14 }}>
                <s.icon size={18} style={{ color: s.color, marginBottom: 6 }} />
                <div style={{ fontSize: s.label === 'Transactions' ? 22 : 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close Day Confirmation */}
      {closing && !alreadyClosed && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#92400e', marginBottom: 12 }}>Confirm Day Closure</h3>
          <p style={{ fontSize: 14, color: '#92400e', marginBottom: 12 }}>
            This will record today's business summary. This action cannot be undone.
          </p>
          {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 14 }}>{error}</div>}
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes for this closing (optional)"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #fed7aa', borderRadius: 8, background: '#fff', color: '#1a1a2e', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setClosing(false)} style={{ padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={() => closeDayMutation.mutate()}
              disabled={closeDayMutation.isPending}
              style={{ padding: '8px 16px', background: '#92400e', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              {closeDayMutation.isPending ? 'Closing…' : 'Confirm & Close Day'}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>Closing History</h3>
      {closings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>No closings recorded yet</div>
      ) : (
        closings.map(c => (
          <div key={c.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{format(new Date(c.closing_date), 'dd MMM yyyy')}</span>
                <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sales: <strong style={{ color: '#16a34a' }}>{fmt(c.total_sales)}</strong></span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Net Profit: <strong style={{ color: c.net_profit >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(c.net_profit)}</strong></span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Transactions: <strong>{c.transactions_count}</strong></span>
                </div>
              </div>
              {(c.closed_by_staff as any)?.full_name && (
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{(c.closed_by_staff as any).full_name}</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
