import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { ArrowLeft, Printer, Download, Mail, AlertTriangle } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

const fmt = (n: number) =>
  new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

interface TxItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
}

interface Transaction {
  id: string
  transaction_number: string | null
  created_at: string
  total_amount: number
  discount: number
  payment_method: string
  notes: string | null
  shop_id: string
  staff: { full_name: string } | null
  customers: { name: string; phone: string | null; email: string | null } | null
  items: TxItem[]
}


const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Taslimu',
  mpesa: 'M-Pesa',
  airtelmoney: 'Airtel Money',
  tigopesa: 'Tigo Pesa',
  halopesa: 'HaloPesa',
  card: 'Kadi',
  credit: 'Mkopo',
  other: 'Nyingine',
}

function useTransaction(txId: string | undefined, shopId: string | undefined) {
  return useQuery<Transaction>({
    queryKey: ['invoice-tx', txId],
    queryFn: async () => {
      const { data: tx, error } = await supabase
        .from('transactions')
        .select(`
          id, transaction_number, created_at, total_amount, discount, payment_method, notes,
          shop_id,
          staff:staff_id ( full_name ),
          customers:customer_id ( name, phone, email )
        `)
        .eq('id', txId!)
        .eq('shop_id', shopId!)
        .single()
      if (error) throw error

      const { data: items, error: itemErr } = await supabase
        .from('transaction_items')
        .select('id, product_id, product_name, quantity, unit_price, discount, subtotal')
        .eq('transaction_id', txId!)
        .order('product_name')
      if (itemErr) throw itemErr

      return {
        ...tx,
        staff: Array.isArray(tx.staff) ? tx.staff[0] ?? null : tx.staff,
        customers: Array.isArray(tx.customers) ? tx.customers[0] ?? null : tx.customers,
        items: items ?? [],
      } as unknown as Transaction
    },
    enabled: !!txId && !!shopId,
  })
}

export function InvoicePage() {
  const { transactionId } = useParams<{ transactionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const { data: tx, isLoading, error } = useTransaction(transactionId, shop?.id)
  const invoiceRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => window.print()

  const handleDownloadCSV = () => {
    if (!tx) return
    const bom = '﻿'
    const header = 'Bidhaa,Idadi,Bei ya Kitengo,Punguzo,Jumla Ndogo\n'
    const rows = tx.items.map(i =>
      `"${i.product_name}",${i.quantity},${i.unit_price},${i.discount},${i.subtotal}`
    ).join('\n')
    const footer = `\n,,,,${fmt(tx.total_amount)}`
    const csv = bom + header + rows + footer
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invoice-${tx.transaction_number ?? tx.id.slice(0, 8).toUpperCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleEmail = () => {
    if (!tx) return
    const subject = encodeURIComponent(`Invoice #${tx.transaction_number ?? tx.id.slice(0, 8).toUpperCase()} - ${shop?.name}`)
    const body = encodeURIComponent(
      `Habari ${tx.customers?.name ?? ''},\n\nTafadhali angalia ankara yako:\n\nNambari: #${tx.transaction_number ?? tx.id.slice(0, 8).toUpperCase()}\nTarehe: ${format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}\nJumla: ${fmt(tx.total_amount)}\nNjia ya Malipo: ${PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}\n\nAsante kwa kununua!\n${shop?.name}`
    )
    const to = tx.customers?.email ?? ''
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--color-border)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 700ms linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (error || !tx) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
        <AlertTriangle size={32} color="var(--color-danger)" />
        <p style={{ color: 'var(--color-text-secondary)' }}>Ankara haikupatikana.</p>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>Rudi</button>
      </div>
    )
  }

  const subtotal = tx.items.reduce((s, i) => s + i.subtotal, 0)
  const invoiceNum = tx.transaction_number ?? tx.id.slice(0, 8).toUpperCase()

  return (
    <>
      {/* Print styles — hide action bar, show only invoice */}
      <style>{`
        @media print {
          .invoice-actions { display: none !important; }
          body { margin: 0; background: #fff; }
          .invoice-shell { padding: 0 !important; background: #fff !important; }
          .invoice-card { box-shadow: none !important; border: none !important; max-width: 100% !important; }
        }
      `}</style>

      <div className="invoice-shell" style={{ minHeight: '100vh', background: 'var(--color-bg-secondary, #f3f4f6)', padding: '24px 16px' }}>
        {/* Action bar */}
        <div className="invoice-actions" style={{ maxWidth: 720, margin: '0 auto 20px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 14 }}>
            <ArrowLeft size={15} /> Rudi
          </button>
          <div style={{ flex: 1 }} />
          <button onClick={handleEmail} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 14 }}>
            <Mail size={15} /> Tuma Barua Pepe
          </button>
          <button onClick={handleDownloadCSV} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: 14 }}>
            <Download size={15} /> Pakua CSV
          </button>
          <button onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            <Printer size={15} /> Chapisha / PDF
          </button>
        </div>

        {/* Invoice card */}
        <div ref={invoiceRef} className="invoice-card" style={{ maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,.08)', padding: '40px 48px', color: '#111', fontFamily: 'system-ui, sans-serif' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--color-primary, #16a34a)' }}>{shop?.name}</h1>
              {!!shop?.address && <p style={{ margin: '4px 0 0', color: '#555', fontSize: 13 }}>{String(shop.address)}</p>}
              {!!shop?.phone && <p style={{ margin: '2px 0 0', color: '#555', fontSize: 13 }}>Simu: {shop.phone}</p>}
              {!!shop?.tax_pin && <p style={{ margin: '2px 0 0', color: '#555', fontSize: 13 }}>TIN: {String(shop.tax_pin)}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#111' }}>ANKARA</p>
              <p style={{ margin: '4px 0 0', fontSize: 14, color: '#555' }}>#{invoiceNum}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#555' }}>{format(new Date(tx.created_at), 'dd MMMM yyyy, HH:mm')}</p>
            </div>
          </div>

          {/* Bill To */}
          {tx.customers && (
            <div style={{ marginBottom: 32, padding: '16px 20px', background: '#f9fafb', borderRadius: 8, borderLeft: '4px solid var(--color-primary, #16a34a)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#888', margin: '0 0 6px' }}>Muunzi</p>
              <p style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{tx.customers.name}</p>
              {tx.customers.phone && <p style={{ margin: '2px 0 0', color: '#555', fontSize: 13 }}>Simu: {tx.customers.phone}</p>}
              {tx.customers.email && <p style={{ margin: '2px 0 0', color: '#555', fontSize: 13 }}>Barua: {tx.customers.email}</p>}
            </div>
          )}

          {/* Cashier info */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 28, fontSize: 13, color: '#555' }}>
            <span>Cashier: <strong style={{ color: '#111' }}>{(tx.staff as { full_name: string } | null)?.full_name ?? 'Mmiliki'}</strong></span>
            <span>Njia ya Malipo: <strong style={{ color: '#111' }}>{PAYMENT_LABELS[tx.payment_method] ?? tx.payment_method}</strong></span>
            {tx.notes && <span>Kumb: <strong style={{ color: '#111' }}>{tx.notes}</strong></span>}
          </div>

          {/* Items table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28, fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 700, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>#</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bidhaa</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Bei</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Idadi</th>
                <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 700, color: '#555', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Jumla</th>
              </tr>
            </thead>
            <tbody>
              {tx.items.map((item, idx) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '11px 0', color: '#999', fontSize: 13 }}>{idx + 1}</td>
                  <td style={{ padding: '11px 12px' }}>
                    <span style={{ fontWeight: 600 }}>{item.product_name}</span>
                    {item.discount > 0 && (
                      <span style={{ display: 'block', fontSize: 11, color: '#dc2626' }}>Punguzo: -{fmt(item.discount)}</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', padding: '11px 12px', color: '#555' }}>{fmt(item.unit_price)}</td>
                  <td style={{ textAlign: 'right', padding: '11px 12px', color: '#555' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '11px 0', fontWeight: 600 }}>{fmt(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
            <div style={{ width: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: '#555' }}>
                <span>Jumla Ndogo</span>
                <span>{fmt(subtotal)}</span>
              </div>
              {tx.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: '#dc2626' }}>
                  <span>Punguzo</span>
                  <span>-{fmt(tx.discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 17, fontWeight: 800, borderTop: '2px solid #111', marginTop: 4 }}>
                <span>JUMLA KUU</span>
                <span style={{ color: 'var(--color-primary, #16a34a)' }}>{fmt(tx.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Asante kwa kununua! Karibu tena.</p>
            <p style={{ margin: '4px 0 0' }}>Imetolewa na DukaOS &mdash; dukaos.app</p>
          </div>
        </div>
      </div>
    </>
  )
}
