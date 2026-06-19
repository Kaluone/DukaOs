import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, TrendingUp, TrendingDown, DollarSign, ArrowRightLeft } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format } from 'date-fns'

interface Account {
  id: string
  code: string
  name: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  sub_type: string | null
  balance: number
  is_active: boolean
}

interface JournalEntry {
  id: string
  entry_date: string
  reference: string | null
  description: string | null
  source: string | null
  is_posted: boolean
  created_at: string
  lines: { account: { code: string; name: string } | null; debit: number; credit: number }[]
}

type Tab = 'accounts' | 'journal'

const TYPE_COLORS: Record<string, string> = {
  asset: '#16a34a', liability: '#dc2626', equity: '#7c3aed', revenue: '#3b82f6', expense: '#f59e0b',
}

const fmt = (n: number) => new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)

export function AccountingPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('accounts')

  const { data: accounts = [], isLoading: acctLoading } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, type, sub_type, balance, is_active')
        .eq('shop_id', shop!.id)
        .eq('is_active', true)
        .order('code')
      if (error) throw error
      return (data ?? []) as Account[]
    },
  })

  const { data: entries = [], isLoading: entriesLoading } = useQuery<JournalEntry[]>({
    queryKey: ['journal-entries', shop?.id],
    enabled: !!shop?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('journal_entries')
        .select(`id, entry_date, reference, description, source, is_posted, created_at,
          lines:journal_lines(debit, credit, account:account_id(code, name))`)
        .eq('shop_id', shop!.id)
        .order('entry_date', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as JournalEntry[]
    },
  })

  const initCOA = useMutation({
    mutationFn: async () => {
      if (!shop?.id) throw new Error('No shop')
      const { error } = await supabase.rpc('create_default_coa', { p_shop_id: shop.id })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chart-of-accounts', shop?.id] }),
  })

  const acctByType = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {})

  const totalAssets = (acctByType.asset ?? []).reduce((s, a) => s + a.balance, 0)
  const totalLiab = (acctByType.liability ?? []).reduce((s, a) => s + a.balance, 0)
  const totalRevenue = (acctByType.revenue ?? []).reduce((s, a) => s + a.balance, 0)
  const totalExpenses = (acctByType.expense ?? []).reduce((s, a) => s + a.balance, 0)

  return (
    <div style={{ padding: '24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOpen size={22} style={{ color: 'var(--color-primary)' }} /> Accounting
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Chart of accounts and journal entries</p>
        </div>
        {accounts.length === 0 && (
          <button onClick={() => initCOA.mutate()} disabled={initCOA.isPending} style={{ padding: '8px 16px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
            {initCOA.isPending ? 'Initializing…' : 'Initialize Chart of Accounts'}
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Assets', value: fmt(totalAssets), icon: TrendingUp, color: '#16a34a' },
          { label: 'Total Liabilities', value: fmt(totalLiab), icon: TrendingDown, color: '#dc2626' },
          { label: 'Revenue', value: fmt(totalRevenue), icon: DollarSign, color: '#3b82f6' },
          { label: 'Expenses', value: fmt(totalExpenses), icon: ArrowRightLeft, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 16px' }}>
            <s.icon size={18} style={{ color: s.color, marginBottom: 6 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, background: 'var(--color-bg)', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {(['accounts', 'journal'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 20px', borderRadius: 8, border: 'none', background: tab === t ? 'var(--color-card)' : 'transparent', color: 'var(--color-text)', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, fontSize: 14, textTransform: 'capitalize' }}>
            {t === 'accounts' ? 'Chart of Accounts' : 'Journal'}
          </button>
        ))}
      </div>

      {tab === 'accounts' && (
        acctLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
        ) : accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
            <BookOpen size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p>No accounts yet. Initialize the chart of accounts to get started.</p>
          </div>
        ) : (
          (['asset', 'liability', 'equity', 'revenue', 'expense'] as const).map(type => {
            const typeAccts = acctByType[type]
            if (!typeAccts?.length) return null
            return (
              <div key={type} style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: TYPE_COLORS[type], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[type], display: 'inline-block' }} />
                  {type} accounts
                </h3>
                <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                  {typeAccts.map((a, i) => (
                    <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 14px', borderBottom: i < typeAccts.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                      <code style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{a.code}</code>
                      <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{a.name}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: a.balance >= 0 ? 'var(--color-text)' : '#dc2626', textAlign: 'right' }}>{fmt(a.balance)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )
      )}

      {tab === 'journal' && (
        entriesLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>
            <ArrowRightLeft size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p>No journal entries yet</p>
          </div>
        ) : (
          entries.map(e => (
            <div key={e.id} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{e.description ?? e.reference ?? 'Journal Entry'}</span>
                  {e.source && <span style={{ fontSize: 11, background: 'var(--color-bg)', padding: '2px 6px', borderRadius: 4, marginLeft: 6, color: 'var(--color-text-secondary)' }}>{e.source}</span>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{format(new Date(e.entry_date), 'dd MMM yyyy')}</div>
                  <span style={{ fontSize: 11, color: e.is_posted ? '#16a34a' : '#f59e0b' }}>{e.is_posted ? 'Posted' : 'Draft'}</span>
                </div>
              </div>
              {e.lines?.length > 0 && (
                <div style={{ fontSize: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: 4 }}>
                    <span>Account</span><span>Debit</span><span>Credit</span>
                  </div>
                  {e.lines.map((l, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, color: 'var(--color-text)', padding: '2px 0' }}>
                      <span>{(l.account as any)?.name ?? '?'}</span>
                      <span style={{ color: l.debit > 0 ? '#16a34a' : 'var(--color-text-secondary)' }}>{l.debit > 0 ? fmt(l.debit) : '—'}</span>
                      <span style={{ color: l.credit > 0 ? '#dc2626' : 'var(--color-text-secondary)' }}>{l.credit > 0 ? fmt(l.credit) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )
      )}
    </div>
  )
}
