import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, TrendingUp, Wallet, Download, Table, Users,
  Package, ShoppingCart, BarChart2, ArrowUpRight, ArrowDownRight,
  Printer, FileSpreadsheet, ChevronDown,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfDay, endOfDay, subDays,
} from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import * as XLSX from 'xlsx'
import { useT } from '@/shared/i18n/useLanguage'

// ─── Types ───────────────────────────────────────────────────────────────────

type DateRange = 'today' | 'week' | 'month' | 'custom'

type ReportTab =
  | 'pnl' | 'daily' | 'weekly' | 'monthly'
  | 'expenses' | 'purchases' | 'inventory'
  | 'bestsellers' | 'worstsellers' | 'staff' | 'customers' | 'stockmove'

interface PnlSummary {
  revenue: number
  cogs: number
  gross_profit: number
  expenses: number
  net_profit: number
  gross_margin: number
  net_margin: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', {
    style: 'currency', currency: 'TZS', maximumFractionDigits: 0,
  }).format(n ?? 0)
}

function fmtPct(n: number) { return `${(n ?? 0).toFixed(1)}%` }

function getRange(range: DateRange, customFrom: string, customTo: string) {
  const now = new Date()
  switch (range) {
    case 'today':  return { from: format(startOfDay(now), 'yyyy-MM-dd'), to: format(endOfDay(now), 'yyyy-MM-dd') }
    case 'week':   return { from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd') }
    case 'month':  return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
    default:       return { from: customFrom, to: customTo }
  }
}

// ─── Sub-component: Report selector tab ──────────────────────────────────────

function ReportTab({ label, icon: Icon, active, onClick }: {
  id?: ReportTab; label: string; icon: React.ElementType; active: boolean; onClick: () => void
}) {
  return (
    <button
      className={`rtab ${active ? 'rtab--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  )
}

// ─── Sub-component: Stat card ─────────────────────────────────────────────────

function StatCard({
  label, value, sub, color = 'primary', trend,
}: { label: string; value: string; sub?: string; color?: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className={`stat-card__value stat-card__value--${color}`}>{value}</span>
      {sub && (
        <span className="stat-card__sub">
          {trend === 'up'   && <ArrowUpRight size={12} style={{ color: 'var(--color-success)' }} />}
          {trend === 'down' && <ArrowDownRight size={12} style={{ color: 'var(--color-error)' }} />}
          {sub}
        </span>
      )}
    </div>
  )
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function usePnl(shopId?: string, from?: string, to?: string) {
  return useQuery<PnlSummary>({
    queryKey: ['pnl', shopId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_pnl_summary', { p_shop_id: shopId!, p_from: from, p_to: to })
      if (error) throw error
      return data as PnlSummary
    },
    enabled: !!shopId && !!from && !!to,
  })
}

function useTransactions(shopId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['report-txns-full', shopId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, total_amount, discount, payment_method, created_at, staff:staff_id(full_name), customer:customer_id(name)')
        .eq('shop_id', shopId!)
        .eq('sync_status', 'synced')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId && !!from && !!to,
  })
}

function useExpenses(shopId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['report-expenses', shopId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, category, amount, description, expense_date, staff:staff_id(full_name)')
        .eq('shop_id', shopId!)
        .gte('expense_date', from!)
        .lte('expense_date', to!)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId && !!from && !!to,
  })
}

function usePurchases(shopId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['report-purchases', shopId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchases')
        .select('id, invoice_number, total_amount, paid_amount, payment_status, purchase_date, supplier:supplier_id(name)')
        .eq('shop_id', shopId!)
        .gte('purchase_date', from!)
        .lte('purchase_date', to!)
        .order('purchase_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId && !!from && !!to,
  })
}

function useInventory(shopId?: string) {
  return useQuery({
    queryKey: ['report-inventory', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_inventory_value')
        .select('*')
        .eq('shop_id', shopId!)
        .order('stock_cost_value', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId,
  })
}

function useBestSellers(shopId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['report-bestsellers', shopId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_items')
        .select(`
          product_id,
          quantity, unit_price, buying_price, item_discount, subtotal,
          product:product_id(name, category, photo_url),
          transaction:transaction_id(created_at, shop_id, sync_status)
        `)
        .eq('shop_id', shopId!)
      if (error) throw error

      // Filter by date range and synced only, then aggregate
      const filtered = (data ?? []).filter((item: any) =>
        item.transaction?.sync_status === 'synced' &&
        item.transaction?.created_at >= (from! + 'T00:00:00') &&
        item.transaction?.created_at <= (to! + 'T23:59:59')
      )

      const agg: Record<string, { product_id: string; name: string; category: string; photo_url: string | null; total_qty: number; total_revenue: number; total_profit: number }> = {}
      for (const item of filtered as any[]) {
        const pid = item.product_id
        if (!agg[pid]) {
          agg[pid] = {
            product_id: pid,
            name: item.product?.name ?? 'Unknown',
            category: item.product?.category ?? '',
            photo_url: item.product?.photo_url ?? null,
            total_qty: 0, total_revenue: 0, total_profit: 0,
          }
        }
        agg[pid].total_qty     += item.quantity
        agg[pid].total_revenue += item.subtotal ?? (item.unit_price * item.quantity - item.item_discount)
        agg[pid].total_profit  += (item.unit_price - item.buying_price) * item.quantity - item.item_discount
      }

      return Object.values(agg).sort((a, b) => b.total_qty - a.total_qty)
    },
    enabled: !!shopId && !!from && !!to,
  })
}

function useStaffPerf(shopId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['report-staff', shopId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('staff_id, total_amount, created_at, staff:staff_id(full_name)')
        .eq('shop_id', shopId!)
        .eq('sync_status', 'synced')
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
      if (error) throw error

      const agg: Record<string, { staff_id: string | null; name: string; count: number; revenue: number; last: string }> = {}
      for (const t of data ?? []) {
        const key = t.staff_id ?? '__owner__'
        if (!agg[key]) {
          agg[key] = {
            staff_id: t.staff_id,
            name: (t.staff as any)?.full_name ?? 'Owner',
            count: 0, revenue: 0, last: t.created_at,
          }
        }
        agg[key].count   += 1
        agg[key].revenue += t.total_amount
        if (t.created_at > agg[key].last) agg[key].last = t.created_at
      }
      return Object.values(agg).sort((a, b) => b.revenue - a.revenue)
    },
    enabled: !!shopId && !!from && !!to,
  })
}

function useStockMovements(shopId?: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['report-stockmove', shopId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*, product:product_id(name, category), staff:staff_id(full_name)')
        .eq('shop_id', shopId!)
        .gte('created_at', from + 'T00:00:00')
        .lte('created_at', to + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return data ?? []
    },
    enabled: !!shopId && !!from && !!to,
  })
}

function useCustomerSummary(shopId?: string) {
  return useQuery({
    queryKey: ['report-customers', shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select(`
          id, name, phone, loyalty_points, credit_balance,
          transactions(id, total_amount, created_at)
        `)
        .eq('shop_id', shopId!)
        .eq('active', true)
      if (error) throw error

      return (data ?? []).map((c: any) => {
        const txns = (c.transactions ?? []).filter((t: any) => t.total_amount)
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          loyalty_points: c.loyalty_points,
          credit_balance: c.credit_balance,
          purchase_count: txns.length,
          total_spent: txns.reduce((s: number, t: any) => s + t.total_amount, 0),
          last_purchase: txns.reduce((latest: string, t: any) => t.created_at > latest ? t.created_at : latest, ''),
        }
      }).sort((a: any, b: any) => b.total_spent - a.total_spent)
    },
    enabled: !!shopId,
  })
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportCSV(rows: (string | number)[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function exportExcel(rows: (string | number)[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, filename)
}

function handlePrint() { window.print() }

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()

  const [activeTab, setActiveTab] = useState<ReportTab>('pnl')
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [customFrom, setCustomFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [customTo,   setCustomTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [exportMenu, setExportMenu] = useState(false)

  const { from, to } = getRange(dateRange, customFrom, customTo)

  const { data: pnl,         isLoading: pnlLoading }   = usePnl(shop?.id, from, to)
  const { data: transactions, isLoading: txnLoading }   = useTransactions(shop?.id, from, to)
  const { data: expenses,    isLoading: expLoading }    = useExpenses(shop?.id, from, to)
  const { data: purchases,   isLoading: purLoading }    = usePurchases(shop?.id, from, to)
  const { data: inventory,   isLoading: invLoading }    = useInventory(shop?.id)
  const { data: bestSellers, isLoading: bestLoading }   = useBestSellers(shop?.id, from, to)
  const { data: staffPerf,   isLoading: staffLoading }  = useStaffPerf(shop?.id, from, to)
  const { data: stockMoves,  isLoading: moveLoading }   = useStockMovements(shop?.id, from, to)
  const { data: customers,   isLoading: custLoading }   = useCustomerSummary(shop?.id)

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  // Group transactions by day for daily chart
  const txnsByDay = (transactions ?? []).reduce((acc: Record<string, number>, tx: any) => {
    const day = format(new Date(tx.created_at), 'dd/MM')
    acc[day] = (acc[day] ?? 0) + tx.total_amount
    return acc
  }, {})
  const dailyChartData = Object.entries(txnsByDay)
    .map(([day, amount]) => ({ day, amount }))
    .slice(0, 30)

  // Group expenses by category for pie chart
  const expByCategory = (expenses ?? []).reduce((acc: Record<string, number>, e: any) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})
  const expCatData = Object.entries(expByCategory).map(([name, value]) => ({ name, value }))

  // Monthly grouping
  const txnsByMonth = (transactions ?? []).reduce((acc: Record<string, number>, tx: any) => {
    const month = format(new Date(tx.created_at), 'MMM yy')
    acc[month] = (acc[month] ?? 0) + tx.total_amount
    return acc
  }, {})
  const monthlyChartData = Object.entries(txnsByMonth).map(([month, amount]) => ({ month, amount }))

  // Worst sellers = reverse of best sellers
  const worstSellers = [...(bestSellers ?? [])].sort((a, b) => a.total_qty - b.total_qty).slice(0, 20)

  const isLoading = pnlLoading || txnLoading || expLoading || purLoading ||
    invLoading || bestLoading || staffLoading || moveLoading || custLoading

  // ─── Export handlers ────────────────────────────────────────────────────────

  const handleExportCSV = useCallback(() => {
    setExportMenu(false)
    switch (activeTab) {
      case 'pnl':
        exportCSV([
          ['Item', 'Amount (TZS)', 'Margin'],
          ['Revenue', pnl?.revenue ?? 0, ''],
          ['Cost of Goods Sold', pnl?.cogs ?? 0, ''],
          ['Gross Profit', pnl?.gross_profit ?? 0, fmtPct(pnl?.gross_margin ?? 0)],
          ['Operating Expenses', pnl?.expenses ?? 0, ''],
          ['Net Profit', pnl?.net_profit ?? 0, fmtPct(pnl?.net_margin ?? 0)],
        ], `dukaos-pnl-${from}-${to}.csv`)
        break

      case 'daily': case 'weekly': case 'monthly':
        exportCSV([
          ['Date', 'Time', 'Cashier', 'Customer', 'Payment Method', 'Amount (TZS)', 'Discount (TZS)'],
          ...(transactions ?? []).map((tx: any) => [
            format(new Date(tx.created_at), 'dd/MM/yyyy'),
            format(new Date(tx.created_at), 'HH:mm'),
            tx.staff?.full_name ?? 'Owner',
            tx.customer?.name ?? '—',
            tx.payment_method,
            tx.total_amount,
            tx.discount ?? 0,
          ]),
        ], `dukaos-sales-${from}-${to}.csv`)
        break

      case 'expenses':
        exportCSV([
          ['Date', 'Category', 'Description', 'Amount (TZS)', 'Recorded By'],
          ...(expenses ?? []).map((e: any) => [
            e.expense_date, e.category, e.description ?? '', e.amount, e.staff?.full_name ?? 'Owner',
          ]),
        ], `dukaos-expenses-${from}-${to}.csv`)
        break

      case 'purchases':
        exportCSV([
          ['Date', 'Invoice #', 'Supplier', 'Total (TZS)', 'Paid (TZS)', 'Balance (TZS)', 'Status'],
          ...(purchases ?? []).map((p: any) => [
            p.purchase_date, p.invoice_number ?? '—', p.supplier?.name ?? '—',
            p.total_amount, p.paid_amount, p.total_amount - p.paid_amount, p.payment_status,
          ]),
        ], `dukaos-purchases-${from}-${to}.csv`)
        break

      case 'inventory':
        exportCSV([
          ['Product', 'Category', 'Qty', 'Reorder Level', 'Buying Price', 'Selling Price', 'Cost Value (TZS)', 'Retail Value (TZS)', 'Potential Profit (TZS)'],
          ...(inventory ?? []).map((i: any) => [
            i.product_name, i.category, i.quantity, i.reorder_threshold,
            i.buying_price, i.selling_price, i.stock_cost_value, i.stock_retail_value, i.potential_profit,
          ]),
        ], `dukaos-inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`)
        break

      case 'bestsellers': case 'worstsellers': {
        const sellers = activeTab === 'bestsellers' ? (bestSellers ?? []) : worstSellers
        exportCSV([
          ['Product', 'Category', 'Qty Sold', 'Revenue (TZS)', 'Profit (TZS)'],
          ...sellers.map((s: any) => [s.name, s.category, s.total_qty, s.total_revenue, s.total_profit]),
        ], `dukaos-${activeTab}-${from}-${to}.csv`)
        break
      }

      case 'staff':
        exportCSV([
          ['Staff Name', 'Transactions', 'Total Revenue (TZS)', 'Avg Transaction (TZS)', 'Last Sale'],
          ...(staffPerf ?? []).map((s: any) => [
            s.name, s.count, s.revenue,
            s.count > 0 ? Math.round(s.revenue / s.count) : 0,
            s.last ? format(new Date(s.last), 'dd/MM/yyyy HH:mm') : '—',
          ]),
        ], `dukaos-staff-${from}-${to}.csv`)
        break

      case 'customers':
        exportCSV([
          ['Customer', 'Phone', 'Purchases', 'Total Spent (TZS)', 'Credit Balance (TZS)', 'Loyalty Points', 'Last Purchase'],
          ...(customers ?? []).map((c: any) => [
            c.name, c.phone ?? '—', c.purchase_count, c.total_spent,
            c.credit_balance, c.loyalty_points,
            c.last_purchase ? format(new Date(c.last_purchase), 'dd/MM/yyyy') : '—',
          ]),
        ], `dukaos-customers-${format(new Date(), 'yyyy-MM-dd')}.csv`)
        break

      case 'stockmove':
        exportCSV([
          ['Date', 'Product', 'Category', 'Type', 'Before', 'Change', 'After', 'Reference', 'Staff', 'Reason'],
          ...(stockMoves ?? []).map((m: any) => [
            format(new Date(m.created_at), 'dd/MM/yyyy HH:mm'),
            m.product?.name ?? '—', m.product?.category ?? '—',
            m.movement_type, m.quantity_before, m.quantity_change, m.quantity_after,
            m.reference_type ?? '—', m.staff?.full_name ?? '—', m.reason ?? '—',
          ]),
        ], `dukaos-stock-movements-${from}-${to}.csv`)
        break
    }
  }, [activeTab, pnl, transactions, expenses, purchases, inventory, bestSellers, worstSellers, staffPerf, customers, stockMoves, from, to])

  const handleExportExcel = useCallback(() => {
    setExportMenu(false)
    // Reuse same data arrays as CSV but use xlsx
    switch (activeTab) {
      case 'pnl':
        exportExcel([
          ['Item', 'Amount (TZS)', 'Margin'],
          ['Revenue', pnl?.revenue ?? 0, ''],
          ['Cost of Goods Sold', pnl?.cogs ?? 0, ''],
          ['Gross Profit', pnl?.gross_profit ?? 0, fmtPct(pnl?.gross_margin ?? 0)],
          ['Operating Expenses', pnl?.expenses ?? 0, ''],
          ['Net Profit', pnl?.net_profit ?? 0, fmtPct(pnl?.net_margin ?? 0)],
        ], `dukaos-pnl-${from}-${to}.xlsx`)
        break
      default:
        handleExportCSV() // fallback to CSV first then re-trigger excel
    }
  }, [activeTab, pnl, from, to, handleExportCSV])

  const tabs: { id: ReportTab; label: string; icon: React.ElementType }[] = [
    { id: 'pnl',          label: t('reportPL'),          icon: TrendingUp },
    { id: 'daily',        label: t('reportDaily'),        icon: BarChart2 },
    { id: 'weekly',       label: t('reportWeekly'),       icon: BarChart2 },
    { id: 'monthly',      label: t('reportMonthly'),      icon: BarChart2 },
    { id: 'expenses',     label: t('reportExpenses'),     icon: Wallet },
    { id: 'purchases',    label: t('reportPurchases'),    icon: ShoppingCart },
    { id: 'inventory',    label: t('reportInventory'),    icon: Package },
    { id: 'bestsellers',  label: t('reportBestSellers'),  icon: ArrowUpRight },
    { id: 'worstsellers', label: t('reportWorstSellers'), icon: ArrowDownRight },
    { id: 'staff',        label: t('reportStaffPerf'),    icon: Users },
    { id: 'customers',    label: t('reportCustomers'),    icon: Users },
    { id: 'stockmove',    label: t('reportStockMove'),    icon: Table },
  ]

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function renderPnL() {
    if (!pnl) return <div className="empty-msg">{t('noReportData')}</div>
    const items = [
      { label: t('totalRevenue'), value: fmt(pnl.revenue), color: 'primary' },
      { label: t('cogs'),         value: fmt(pnl.cogs),    color: 'warning' },
      { label: t('grossProfit'),  value: fmt(pnl.gross_profit), color: pnl.gross_profit >= 0 ? 'success' : 'error', sub: fmtPct(pnl.gross_margin) + ' margin' },
      { label: t('reportExpenses'), value: fmt(pnl.expenses), color: 'error' },
      { label: t('netProfit'),    value: fmt(pnl.net_profit), color: pnl.net_profit >= 0 ? 'success' : 'error', sub: fmtPct(pnl.net_margin) + ' margin' },
    ]

    const pieData = [
      { name: 'COGS', value: pnl.cogs },
      { name: 'Expenses', value: pnl.expenses },
      { name: 'Net Profit', value: Math.max(0, pnl.net_profit) },
    ]

    return (
      <div className="report-content">
        <div className="stat-grid">
          {items.map(item => (
            <StatCard key={item.label} label={item.label} value={item.value}
              sub={item.sub} color={item.color} />
          ))}
        </div>
        <div className="chart-row">
          <div className="card">
            <div className="card-header"><h3>Revenue Breakdown</h3></div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card pnl-table-card">
            <div className="card-header"><h3>Profit & Loss Statement</h3></div>
            <table className="rpt-table">
              <tbody>
                <tr className="rpt-row rpt-row--revenue">
                  <td>Revenue</td><td className="rpt-amount">{fmt(pnl.revenue)}</td>
                </tr>
                <tr className="rpt-row">
                  <td>Less: Cost of Goods Sold</td><td className="rpt-amount rpt-neg">({fmt(pnl.cogs)})</td>
                </tr>
                <tr className="rpt-row rpt-row--subtotal">
                  <td>Gross Profit <span className="rpt-margin">({fmtPct(pnl.gross_margin)})</span></td>
                  <td className={`rpt-amount ${pnl.gross_profit >= 0 ? 'rpt-pos' : 'rpt-neg'}`}>{fmt(pnl.gross_profit)}</td>
                </tr>
                <tr className="rpt-row">
                  <td>Less: Operating Expenses</td><td className="rpt-amount rpt-neg">({fmt(pnl.expenses)})</td>
                </tr>
                <tr className="rpt-row rpt-row--total">
                  <td><strong>Net Profit <span className="rpt-margin">({fmtPct(pnl.net_margin)})</span></strong></td>
                  <td className={`rpt-amount ${pnl.net_profit >= 0 ? 'rpt-pos' : 'rpt-neg'}`}><strong>{fmt(pnl.net_profit)}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderSales(groupBy: 'day' | 'week' | 'month') {
    const txns = transactions ?? []
    if (!txns.length) return <div className="empty-msg">{t('noReportData')}</div>

    const total = txns.reduce((s: number, t: any) => s + t.total_amount, 0)
    const chartData = groupBy === 'day' ? dailyChartData
      : groupBy === 'week' ? dailyChartData // simplified; full week grouping would need date-fns
      : monthlyChartData

    return (
      <div className="report-content">
        <div className="stat-grid">
          <StatCard label={t('totalRevenue')}  value={fmt(total)} color="primary" />
          <StatCard label={t('totalSales')}    value={String(txns.length)} color="accent" />
          <StatCard label={t('avgTransaction')} value={fmt(txns.length ? total / txns.length : 0)} color="success" />
        </div>
        {chartData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3>{t('chartSales')}</h3></div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey={groupBy === 'month' ? 'month' : 'day'} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} formatter={(v: number) => [fmt(v), 'Revenue']} />
                  <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-header"><h3>Transactions</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>{t('date')}</th><th>Time</th><th>{t('cashier')}</th>
                <th>Customer</th><th>Method</th><th style={{ textAlign: 'right' }}>{t('total')}</th>
              </tr></thead>
              <tbody>
                {txns.slice(0, 100).map((tx: any) => (
                  <tr key={tx.id}>
                    <td>{format(new Date(tx.created_at), 'dd/MM/yyyy')}</td>
                    <td>{format(new Date(tx.created_at), 'HH:mm')}</td>
                    <td>{tx.staff?.full_name ?? 'Owner'}</td>
                    <td>{tx.customer?.name ?? '—'}</td>
                    <td><span className="badge badge-default">{tx.payment_method}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-primary)' }}>{fmt(tx.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txns.length > 100 && <p className="table-note">Showing first 100 of {txns.length} records. Export for full data.</p>}
          </div>
        </div>
      </div>
    )
  }

  function renderExpenses() {
    const exps = expenses ?? []
    if (!exps.length) return <div className="empty-msg">{t('noReportData')}</div>
    const total = exps.reduce((s: number, e: any) => s + e.amount, 0)

    return (
      <div className="report-content">
        <div className="stat-grid">
          <StatCard label="Total Expenses" value={fmt(total)} color="error" />
          <StatCard label="No. of Expenses" value={String(exps.length)} color="accent" />
        </div>
        {expCatData.length > 0 && (
          <div className="card">
            <div className="card-header"><h3>Expenses by Category</h3></div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={expCatData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {expCatData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-header"><h3>Expense Details</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>{t('date')}</th><th>{t('category')}</th><th>{t('description')}</th>
                <th>Recorded By</th><th style={{ textAlign: 'right' }}>{t('amount')}</th>
              </tr></thead>
              <tbody>
                {exps.map((e: any) => (
                  <tr key={e.id}>
                    <td>{e.expense_date}</td>
                    <td><span className="badge badge-default">{e.category}</span></td>
                    <td>{e.description ?? '—'}</td>
                    <td>{e.staff?.full_name ?? 'Owner'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-error)' }}>{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderPurchases() {
    const purs = purchases ?? []
    if (!purs.length) return <div className="empty-msg">{t('noReportData')}</div>
    const totalAmount = purs.reduce((s: number, p: any) => s + p.total_amount, 0)
    const totalPaid   = purs.reduce((s: number, p: any) => s + p.paid_amount, 0)

    return (
      <div className="report-content">
        <div className="stat-grid">
          <StatCard label="Total Purchases" value={fmt(totalAmount)} color="warning" />
          <StatCard label="Amount Paid"     value={fmt(totalPaid)} color="success" />
          <StatCard label="Outstanding"     value={fmt(totalAmount - totalPaid)} color="error" />
          <StatCard label="Purchase Count"  value={String(purs.length)} color="accent" />
        </div>
        <div className="card">
          <div className="card-header"><h3>Purchase Orders</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>{t('date')}</th><th>Invoice #</th><th>Supplier</th>
                <th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Paid</th>
                <th style={{ textAlign: 'right' }}>Balance</th><th>Status</th>
              </tr></thead>
              <tbody>
                {purs.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.purchase_date}</td>
                    <td>{p.invoice_number ?? '—'}</td>
                    <td>{p.supplier?.name ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(p.total_amount)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>{fmt(p.paid_amount)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-error)' }}>{fmt(p.total_amount - p.paid_amount)}</td>
                    <td>
                      <span className={`badge ${p.payment_status === 'paid' ? 'badge-success' : p.payment_status === 'partial' ? 'badge-warning' : 'badge-error'}`}>
                        {p.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderInventory() {
    const inv = inventory ?? []
    if (!inv.length) return <div className="empty-msg">{t('noReportData')}</div>
    const totalCost   = inv.reduce((s: number, i: any) => s + (i.stock_cost_value ?? 0), 0)
    const totalRetail = inv.reduce((s: number, i: any) => s + (i.stock_retail_value ?? 0), 0)
    const totalProfit = inv.reduce((s: number, i: any) => s + (i.potential_profit ?? 0), 0)

    return (
      <div className="report-content">
        <div className="stat-grid">
          <StatCard label="Total SKUs"      value={String(inv.length)} color="accent" />
          <StatCard label="Cost Value"      value={fmt(totalCost)} color="warning" />
          <StatCard label="Retail Value"    value={fmt(totalRetail)} color="primary" />
          <StatCard label="Potential Profit" value={fmt(totalProfit)} color="success" />
        </div>
        <div className="card">
          <div className="card-header"><h3>Inventory Valuation</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>Product</th><th>Category</th><th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Reorder</th>
                <th style={{ textAlign: 'right' }}>Buy Price</th><th style={{ textAlign: 'right' }}>Sell Price</th>
                <th style={{ textAlign: 'right' }}>Cost Value</th><th style={{ textAlign: 'right' }}>Retail Value</th>
              </tr></thead>
              <tbody>
                {inv.map((i: any) => (
                  <tr key={i.product_id} style={{ background: i.quantity <= i.reorder_threshold ? 'var(--color-warning-bg)' : undefined }}>
                    <td style={{ fontWeight: 500 }}>{i.product_name}</td>
                    <td>{i.category}</td>
                    <td style={{ textAlign: 'right', color: i.quantity <= i.reorder_threshold ? 'var(--color-warning)' : undefined, fontWeight: i.quantity === 0 ? 700 : 400 }}>{i.quantity}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{i.reorder_threshold}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(i.buying_price)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(i.selling_price)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(i.stock_cost_value)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-primary)', fontWeight: 600 }}>{fmt(i.stock_retail_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderSellers(data: typeof bestSellers, title: string) {
    const items = data ?? []
    if (!items.length) return <div className="empty-msg">{t('noReportData')}</div>
    const top10 = items.slice(0, 10)

    return (
      <div className="report-content">
        <div className="card">
          <div className="card-header"><h3>{title} — Top 10</h3></div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={top10} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} />
                <Bar dataKey="total_qty" name="Qty Sold" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>All Products</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>#</th><th>Product</th><th>Category</th>
                <th style={{ textAlign: 'right' }}>Qty Sold</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Profit</th>
              </tr></thead>
              <tbody>
                {items.map((s: any, idx: number) => (
                  <tr key={s.product_id}>
                    <td style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td>{s.category}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.total_qty}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>{fmt(s.total_revenue)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>{fmt(s.total_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderStaff() {
    const staff = staffPerf ?? []
    if (!staff.length) return <div className="empty-msg">{t('noReportData')}</div>

    return (
      <div className="report-content">
        <div className="card">
          <div className="card-header"><h3>Staff Revenue Comparison</h3></div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={staff.map((s: any) => ({ name: s.name, revenue: s.revenue, count: s.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }} formatter={(v: number, name: string) => name === 'revenue' ? [fmt(v), 'Revenue'] : [v, 'Sales']} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="count"   name="Sales"   fill="var(--color-accent)"  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Staff Performance Details</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>Staff</th><th style={{ textAlign: 'right' }}>Sales</th>
                <th style={{ textAlign: 'right' }}>Total Revenue</th>
                <th style={{ textAlign: 'right' }}>Avg / Sale</th>
                <th>Last Sale</th>
              </tr></thead>
              <tbody>
                {staff.map((s: any) => (
                  <tr key={s.staff_id ?? 'owner'}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ textAlign: 'right' }}>{s.count}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>{fmt(s.revenue)}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(s.count ? s.revenue / s.count : 0)}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{s.last ? format(new Date(s.last), 'dd/MM/yyyy HH:mm') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderCustomers() {
    const custs = customers ?? []
    if (!custs.length) return <div className="empty-msg">{t('noReportData')}</div>

    return (
      <div className="report-content">
        <div className="stat-grid">
          <StatCard label="Total Customers" value={String(custs.length)} color="accent" />
          <StatCard label="Total Spent"     value={fmt(custs.reduce((s: number, c: any) => s + c.total_spent, 0))} color="primary" />
          <StatCard label="Outstanding Credit" value={fmt(custs.reduce((s: number, c: any) => s + c.credit_balance, 0))} color="error" />
        </div>
        <div className="card">
          <div className="card-header"><h3>Customer Purchase Summary</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>#</th><th>Customer</th><th>Phone</th>
                <th style={{ textAlign: 'right' }}>Purchases</th>
                <th style={{ textAlign: 'right' }}>Total Spent</th>
                <th style={{ textAlign: 'right' }}>Credit</th>
                <th style={{ textAlign: 'right' }}>Points</th>
                <th>Last Purchase</th>
              </tr></thead>
              <tbody>
                {custs.map((c: any, idx: number) => (
                  <tr key={c.id}>
                    <td style={{ color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td>{c.phone ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{c.purchase_count}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-primary)', fontWeight: 600 }}>{fmt(c.total_spent)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-error)' }}>{fmt(c.credit_balance)}</td>
                    <td style={{ textAlign: 'right' }}>{c.loyalty_points}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{c.last_purchase ? format(new Date(c.last_purchase), 'dd/MM/yyyy') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderStockMovements() {
    const moves = stockMoves ?? []
    if (!moves.length) return <div className="empty-msg">{t('noReportData')}</div>

    const typeColors: Record<string, string> = {
      SALE: 'badge-error', PURCHASE: 'badge-success', IN: 'badge-success',
      OUT: 'badge-error', ADJUSTMENT: 'badge-warning', DAMAGE: 'badge-error', RETURN: 'badge-warning',
    }

    return (
      <div className="report-content">
        <div className="stat-grid">
          <StatCard label="Total Movements" value={String(moves.length)} color="accent" />
          <StatCard label="Stock In"  value={String(moves.filter((m: any) => m.quantity_change > 0).length)} color="success" />
          <StatCard label="Stock Out" value={String(moves.filter((m: any) => m.quantity_change < 0).length)} color="error" />
        </div>
        <div className="card">
          <div className="card-header"><h3>Stock Movement Log</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="rpt-table full-table">
              <thead><tr>
                <th>Date</th><th>Product</th><th>Type</th>
                <th style={{ textAlign: 'right' }}>Before</th>
                <th style={{ textAlign: 'right' }}>Change</th>
                <th style={{ textAlign: 'right' }}>After</th>
                <th>Reference</th><th>Staff</th>
              </tr></thead>
              <tbody>
                {moves.slice(0, 200).map((m: any) => (
                  <tr key={m.id}>
                    <td>{format(new Date(m.created_at), 'dd/MM/yy HH:mm')}</td>
                    <td style={{ fontWeight: 500 }}>{m.product?.name ?? '—'}</td>
                    <td><span className={`badge ${typeColors[m.movement_type] ?? 'badge-default'}`}>{m.movement_type}</span></td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{m.quantity_before}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: m.quantity_change > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {m.quantity_change > 0 ? '+' : ''}{m.quantity_change}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{m.quantity_after}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{m.reference_type ?? '—'}</td>
                    <td>{m.staff?.full_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  function renderActiveTab() {
    if (isLoading) return <div className="loading-state"><div className="spinner" /></div>
    switch (activeTab) {
      case 'pnl':          return renderPnL()
      case 'daily':        return renderSales('day')
      case 'weekly':       return renderSales('week')
      case 'monthly':      return renderSales('month')
      case 'expenses':     return renderExpenses()
      case 'purchases':    return renderPurchases()
      case 'inventory':    return renderInventory()
      case 'bestsellers':  return renderSellers(bestSellers, t('reportBestSellers'))
      case 'worstsellers': return renderSellers(worstSellers as typeof bestSellers, t('reportWorstSellers'))
      case 'staff':        return renderStaff()
      case 'customers':    return renderCustomers()
      case 'stockmove':    return renderStockMovements()
    }
  }

  return (
    <div className="rpts">
      {/* Header */}
      <div className="rpts__header">
        <div>
          <h1 className="rpts__title">{t('reportsTitle')}</h1>
          <p className="rpts__sub">{t('reportsSub')}</p>
        </div>
        <div className="rpts__actions">
          <div className="export-wrap">
            <button className="btn-action" onClick={() => setExportMenu(v => !v)}>
              <Download size={15} /> Export <ChevronDown size={13} />
            </button>
            {exportMenu && (
              <div className="export-menu">
                <button className="export-item" onClick={handleExportCSV}><FileText size={14} /> CSV</button>
                <button className="export-item" onClick={handleExportExcel}><FileSpreadsheet size={14} /> Excel</button>
                <button className="export-item" onClick={() => { setExportMenu(false); handlePrint() }}><Printer size={14} /> Print</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Date range */}
      <div className="rpts__filters">
        <div className="range-tabs">
          {(['today', 'week', 'month', 'custom'] as DateRange[]).map(r => (
            <button key={r} className={`range-tab ${dateRange === r ? 'range-tab--active' : ''}`} onClick={() => setDateRange(r)}>
              {r === 'today' ? 'Today' : r === 'week' ? t('thisWeek') : r === 'month' ? t('thisMonth') : t('custom')}
            </button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div className="date-inputs">
            <div className="field">
              <label className="field__label">{t('from')}</label>
              <input className="field__input" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div className="field">
              <label className="field__label">{t('to')}</label>
              <input className="field__input" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Report tabs */}
      <div className="rtabs-scroll">
        <div className="rtabs">
          {tabs.map(tab => (
            <ReportTab key={tab.id} id={tab.id} label={tab.label} icon={tab.icon}
              active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="rpts__content">
        {renderActiveTab()}
      </div>

      <style>{`
        @media print {
          .rpts__header .rpts__actions, .rtabs-scroll, .rpts__filters { display: none !important; }
          .rpts { padding: 0 !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }

        .rpts { display: flex; flex-direction: column; gap: var(--space-5); }
        .rpts__header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
        .rpts__title { font-size: 1.6rem; font-weight: 800; }
        .rpts__sub { color: var(--color-text-muted); font-size: 0.85rem; }
        .rpts__actions { display: flex; gap: var(--space-3); align-items: center; }

        .export-wrap { position: relative; }
        .btn-action {
          display: flex; align-items: center; gap: 6px;
          padding: var(--space-2) var(--space-4); border: 1.5px solid var(--color-border);
          border-radius: var(--radius-l); font-size: 0.85rem; font-weight: 600;
          background: var(--color-surface); color: var(--color-text-secondary);
          cursor: pointer; transition: all var(--transition-fast);
        }
        .btn-action:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .export-menu {
          position: absolute; right: 0; top: calc(100% + 6px);
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-l); padding: var(--space-2);
          box-shadow: var(--shadow-lg); z-index: 100; min-width: 140px;
        }
        .export-item {
          display: flex; align-items: center; gap: var(--space-2);
          width: 100%; padding: var(--space-2) var(--space-3);
          border-radius: var(--radius-m); font-size: 0.875rem; font-weight: 500;
          color: var(--color-text); cursor: pointer; transition: background var(--transition-fast);
        }
        .export-item:hover { background: var(--color-surface-2); }

        .rpts__filters { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: flex-end; }
        .range-tabs { display: flex; gap: var(--space-2); flex-wrap: wrap; }
        .range-tab {
          padding: var(--space-2) var(--space-4); border-radius: var(--radius-full);
          border: 1.5px solid var(--color-border); font-size: 0.85rem; font-weight: 500;
          color: var(--color-text-secondary); background: var(--color-surface); cursor: pointer;
          transition: all var(--transition-fast);
        }
        .range-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .range-tab--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

        .date-inputs { display: flex; gap: var(--space-3); flex-wrap: wrap; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field__label { font-size: 0.8rem; font-weight: 600; }
        .field__input {
          padding: 8px var(--space-3); border: 1.5px solid var(--color-border);
          border-radius: var(--radius-m); font-size: 0.875rem; outline: none;
          background: var(--color-surface); color: var(--color-text);
          transition: border-color var(--transition-fast);
        }
        .field__input:focus { border-color: var(--color-primary); }

        .rtabs-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .rtabs { display: flex; gap: var(--space-2); padding-bottom: 4px; white-space: nowrap; min-width: max-content; }
        .rtab {
          display: flex; align-items: center; gap: 6px;
          padding: var(--space-2) var(--space-4); border-radius: var(--radius-full);
          border: 1.5px solid var(--color-border); font-size: 0.82rem; font-weight: 500;
          color: var(--color-text-secondary); background: var(--color-surface); cursor: pointer;
          transition: all var(--transition-fast); white-space: nowrap;
        }
        .rtab:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .rtab--active { background: var(--color-primary); color: #fff; border-color: var(--color-primary); }

        .rpts__content { min-height: 300px; }

        .report-content { display: flex; flex-direction: column; gap: var(--space-5); }

        .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-4); }
        .stat-card {
          background: var(--color-surface); border: 1px solid var(--color-border);
          border-radius: var(--radius-l); padding: var(--space-4); box-shadow: var(--shadow-xs);
          display: flex; flex-direction: column; gap: 4px;
        }
        .stat-card__label { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 500; }
        .stat-card__value { font-size: 1.3rem; font-weight: 800; font-family: var(--font-heading); }
        .stat-card__value--primary { color: var(--color-primary); }
        .stat-card__value--success { color: var(--color-success); }
        .stat-card__value--error   { color: var(--color-error); }
        .stat-card__value--warning { color: var(--color-warning); }
        .stat-card__value--accent  { color: var(--color-accent); }
        .stat-card__sub { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 2px; }

        .chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
        @media (max-width: 768px) { .chart-row { grid-template-columns: 1fr; } }

        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-5); box-shadow: var(--shadow-xs); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
        .card-header h3 { font-size: 0.95rem; font-weight: 700; }

        .rpt-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .rpt-table th {
          text-align: left; padding: var(--space-2) var(--space-3);
          color: var(--color-text-muted); font-size: 0.75rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em;
          border-bottom: 2px solid var(--color-border);
        }
        .rpt-table td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); }
        .rpt-table tr:last-child td { border-bottom: none; }
        .rpt-table tr:hover td { background: var(--color-surface-2); }
        .full-table { min-width: 600px; }

        .rpt-row td { padding: var(--space-3) var(--space-3); border-bottom: 1px solid var(--color-border); font-size: 0.9rem; }
        .rpt-row--revenue td { font-weight: 600; border-top: 2px solid var(--color-border); }
        .rpt-row--subtotal td { background: var(--color-surface-2); font-weight: 600; }
        .rpt-row--total td { background: var(--color-primary-light); font-size: 1rem; border-top: 2px solid var(--color-primary); }
        .rpt-amount { text-align: right; font-family: var(--font-heading); }
        .rpt-pos { color: var(--color-success) !important; }
        .rpt-neg { color: var(--color-error) !important; }
        .rpt-margin { font-size: 0.75rem; color: var(--color-text-muted); font-weight: 400; }

        .pnl-table-card { overflow-x: auto; }

        .table-note { font-size: 0.75rem; color: var(--color-text-muted); padding: var(--space-3) 0 0; text-align: center; }

        .empty-msg { text-align: center; padding: 60px 0; color: var(--color-text-muted); font-size: 0.875rem; }

        .loading-state { display: flex; justify-content: center; padding: 60px 0; }
        .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 700ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 600; }
        .badge-default { background: var(--color-surface-2); color: var(--color-text-secondary); }
        .badge-success { background: var(--color-success-bg, #dcfce7); color: var(--color-success); }
        .badge-warning { background: var(--color-warning-bg, #fef9c3); color: var(--color-warning); }
        .badge-error   { background: var(--color-error-bg, #fee2e2); color: var(--color-error); }
      `}</style>
    </div>
  )
}
