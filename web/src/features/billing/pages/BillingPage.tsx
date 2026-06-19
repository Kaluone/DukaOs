import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check, AlertTriangle, Clock,
  Download, Zap, Shield, Building2,
} from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, differenceInDays } from 'date-fns'
import { useT } from '@/shared/i18n/useLanguage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionPlan {
  id: string
  name: string
  display_name: string
  price_monthly: number
  price_yearly: number
  max_products: number
  max_staff: number
  max_branches: number
  storage_gb: number
  features: string[]
  sort_order: number
}

interface ShopSubscription {
  id: string
  shop_id: string
  plan_name: string
  billing_cycle: string
  status: string
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  grace_ends_at: string | null
  auto_renew: boolean
}

interface BillingInvoice {
  id: string
  invoice_number: string
  plan_name: string
  billing_cycle: string
  amount: number
  currency: string
  status: string
  period_start: string
  period_end: string
  paid_at: string | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    trial:     { label: 'Trial',     cls: 'badge-primary' },
    active:    { label: 'Active',    cls: 'badge-success' },
    grace:     { label: 'Grace',     cls: 'badge-warning' },
    expired:   { label: 'Expired',   cls: 'badge-error' },
    cancelled: { label: 'Cancelled', cls: 'badge-default' },
    suspended: { label: 'Suspended', cls: 'badge-error' },
    paid:      { label: 'Paid',      cls: 'badge-success' },
    pending:   { label: 'Pending',   cls: 'badge-warning' },
    overdue:   { label: 'Overdue',   cls: 'badge-error' },
    void:      { label: 'Void',      cls: 'badge-default' },
  }
  const cfg = map[status] ?? { label: status, cls: 'badge-default' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  free: Zap, starter: Zap, business: Shield, enterprise: Building2,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BillingPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()
  const qc = useQueryClient()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [upgrading, setUpgrading] = useState<string | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []).map((p: any) => ({ ...p, features: p.features ?? [] }))
    },
  })

  const { data: subscription } = useQuery<ShopSubscription>({
    queryKey: ['subscription', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_subscriptions')
        .select('*')
        .eq('shop_id', shop!.id)
        .single()
      if (error) throw error
      return data as ShopSubscription
    },
    enabled: !!shop?.id,
  })

  const { data: invoices = [] } = useQuery<BillingInvoice[]>({
    queryKey: ['billing-invoices', shop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_invoices')
        .select('*')
        .eq('shop_id', shop!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!shop?.id,
  })

  // ── Mutation: change plan ────────────────────────────────────────────────
  const changePlanMutation = useMutation({
    mutationFn: async ({ planName, cycle }: { planName: string; cycle: string }) => {
      const periodEnd = new Date()
      periodEnd.setMonth(periodEnd.getMonth() + (cycle === 'yearly' ? 12 : 1))

      const { error } = await supabase
        .from('shop_subscriptions')
        .update({
          plan_name: planName,
          billing_cycle: cycle,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_ends_at: null,
          grace_ends_at: null,
        })
        .eq('shop_id', shop!.id)
      if (error) throw error

      // Create invoice record
      const plan = plans.find(p => p.name === planName)
      if (plan) {
        const amount = cycle === 'yearly' ? plan.price_yearly : plan.price_monthly
        const invoiceNum = `INV-${Date.now()}`
        await supabase.from('billing_invoices').insert({
          shop_id: shop!.id,
          invoice_number: invoiceNum,
          plan_name: planName,
          billing_cycle: cycle,
          amount,
          currency: 'TZS',
          status: 'paid',
          period_start: new Date().toISOString(),
          period_end: periodEnd.toISOString(),
          paid_at: new Date().toISOString(),
          payment_method: 'manual',
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription', shop?.id] })
      qc.invalidateQueries({ queryKey: ['billing-invoices', shop?.id] })
      setUpgrading(null)
    },
  })

  const handleChoosePlan = async (planName: string) => {
    if (!shop?.id || planName === subscription?.plan_name) return
    setUpgrading(planName)
    await changePlanMutation.mutateAsync({ planName, cycle: billingCycle })
  }

  // ── Download invoice ──────────────────────────────────────────────────────
  const downloadInvoice = (inv: BillingInvoice) => {
    const content = [
      'DukaOS Invoice',
      '='.repeat(40),
      `Invoice #: ${inv.invoice_number}`,
      `Date: ${format(new Date(inv.created_at), 'dd/MM/yyyy')}`,
      `Shop: ${shop?.name}`,
      '',
      `Plan: ${inv.plan_name} (${inv.billing_cycle})`,
      `Period: ${format(new Date(inv.period_start), 'dd/MM/yyyy')} — ${format(new Date(inv.period_end), 'dd/MM/yyyy')}`,
      '',
      `Amount: ${fmt(inv.amount)} ${inv.currency}`,
      `Status: ${inv.status.toUpperCase()}`,
      inv.paid_at ? `Paid: ${format(new Date(inv.paid_at), 'dd/MM/yyyy')}` : '',
      '',
      'Thank you for using DukaOS.',
      'AutoRevenue Labs',
    ].join('\n')
    const blob = new Blob([content], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${inv.invoice_number}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── Status banner ─────────────────────────────────────────────────────────
  const renderBanner = () => {
    if (!subscription) return null
    const { status, trial_ends_at, grace_ends_at } = subscription

    if (status === 'trial' && trial_ends_at) {
      const days = differenceInDays(new Date(trial_ends_at), new Date())
      return (
        <div className="banner banner--info">
          <Clock size={16} />
          <span>{t('trialBanner')} <strong>{Math.max(0, days)} {t('trialDaysLeft')}</strong></span>
        </div>
      )
    }
    if (status === 'grace' && grace_ends_at) {
      const days = differenceInDays(new Date(grace_ends_at), new Date())
      return (
        <div className="banner banner--warning">
          <AlertTriangle size={16} />
          <span>{t('graceBanner')} <strong>{Math.max(0, days)} days left</strong></span>
        </div>
      )
    }
    if (status === 'expired' || status === 'suspended') {
      return (
        <div className="banner banner--error">
          <AlertTriangle size={16} />
          <span>{t('expiredBanner')}</span>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bll">
      <div className="bll__header">
        <div>
          <h1 className="bll__title">{t('billingTitle')}</h1>
          <p className="bll__sub">{t('billingSub')}</p>
        </div>
      </div>

      {renderBanner()}

      {/* Current subscription */}
      {subscription && (
        <div className="card current-plan-card">
          <div className="card-header">
            <h3>{t('currentPlan')}</h3>
            <StatusBadge status={subscription.status} />
          </div>
          <div className="current-plan-body">
            <div className="current-plan-info">
              <span className="plan-display-name">{subscription.plan_name.charAt(0).toUpperCase() + subscription.plan_name.slice(1)}</span>
              <span className="plan-cycle">{subscription.billing_cycle}</span>
              {subscription.current_period_end && (
                <span className="plan-renews">
                  {subscription.status === 'trial' ? t('trialEnds') : t('renewsOn')}: {format(new Date(subscription.current_period_end), 'dd MMMM yyyy')}
                </span>
              )}
            </div>
            <div className="current-plan-actions">
              <label className="auto-renew-row">
                <input
                  type="checkbox"
                  checked={subscription.auto_renew}
                  onChange={async e => {
                    await supabase.from('shop_subscriptions').update({ auto_renew: e.target.checked }).eq('shop_id', shop!.id)
                    qc.invalidateQueries({ queryKey: ['subscription', shop?.id] })
                  }}
                />
                <span>Auto-renew</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className="cycle-toggle">
        <button
          className={`cycle-btn ${billingCycle === 'monthly' ? 'cycle-btn--active' : ''}`}
          onClick={() => setBillingCycle('monthly')}
        >
          {t('monthly')}
        </button>
        <button
          className={`cycle-btn ${billingCycle === 'yearly' ? 'cycle-btn--active' : ''}`}
          onClick={() => setBillingCycle('yearly')}
        >
          {t('yearly')} <span className="save-badge">Save 17%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="plans-grid">
        {plans.map(plan => {
          const isCurrent = subscription?.plan_name === plan.name
          const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly
          const PlanIcon = PLAN_ICONS[plan.name] ?? Zap
          const isPopular = plan.name === 'business'

          return (
            <div key={plan.id} className={`plan-card ${isCurrent ? 'plan-card--current' : ''} ${isPopular ? 'plan-card--popular' : ''}`}>
              {isPopular && <div className="popular-badge">Most Popular</div>}
              {isCurrent && <div className="current-badge">{t('currentPlanBadge')}</div>}

              <div className="plan-card__header">
                <div className="plan-icon">
                  <PlanIcon size={20} />
                </div>
                <div>
                  <h3 className="plan-name">{plan.display_name}</h3>
                  <div className="plan-price">
                    {price === 0
                      ? <span className="plan-price__amount">Free</span>
                      : <>
                          <span className="plan-price__amount">{fmt(price)}</span>
                          <span className="plan-price__period">{billingCycle === 'monthly' ? t('perMonth') : t('perYear')}</span>
                        </>
                    }
                  </div>
                </div>
              </div>

              <div className="plan-limits">
                <div className="limit-item"><span>{t('maxProducts')}</span><strong>{plan.max_products === 999999 ? 'Unlimited' : plan.max_products}</strong></div>
                <div className="limit-item"><span>{t('maxStaff')}</span><strong>{plan.max_staff === 999 ? 'Unlimited' : plan.max_staff}</strong></div>
                <div className="limit-item"><span>{t('maxBranches')}</span><strong>{plan.max_branches === 999 ? 'Unlimited' : plan.max_branches}</strong></div>
                <div className="limit-item"><span>{t('storageLimit')}</span><strong>{plan.storage_gb >= 100 ? 'Unlimited' : `${plan.storage_gb} GB`}</strong></div>
              </div>

              <ul className="plan-features">
                {plan.features.slice(0, 6).map((f: string) => (
                  <li key={f} className="plan-feature">
                    <Check size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {plan.name === 'enterprise' ? (
                <a href="mailto:sales@autorevenue.co.tz" className="btn-contact">{t('contactSales')}</a>
              ) : (
                <button
                  className={`btn-choose ${isCurrent ? 'btn-choose--current' : ''}`}
                  disabled={isCurrent || upgrading === plan.name}
                  onClick={() => handleChoosePlan(plan.name)}
                >
                  {upgrading === plan.name ? <><span className="spinner-sm" /> Processing…</> : isCurrent ? t('currentPlanBadge') : t('choosePlan')}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Billing history */}
      <div className="card">
        <div className="card-header">
          <h3>{t('billingHistory')}</h3>
        </div>
        {!invoices.length ? (
          <div className="empty">{t('noBillingHistory')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="inv-table">
              <thead><tr>
                <th>{t('invoiceNum')}</th>
                <th>{t('date')}</th>
                <th>{t('planName')}</th>
                <th>{t('billingCycle')}</th>
                <th>Period</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>{t('status')}</th>
                <th></th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="inv-num">{inv.invoice_number}</td>
                    <td>{format(new Date(inv.created_at), 'dd/MM/yyyy')}</td>
                    <td style={{ textTransform: 'capitalize' }}>{inv.plan_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{inv.billing_cycle}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      {format(new Date(inv.period_start), 'dd/MM/yy')} — {format(new Date(inv.period_end), 'dd/MM/yy')}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(inv.amount)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>
                      <button className="dl-btn" onClick={() => downloadInvoice(inv)} title="Download invoice">
                        <Download size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .bll { display: flex; flex-direction: column; gap: var(--space-5); }
        .bll__header { }
        .bll__title { font-size: 1.6rem; font-weight: 800; }
        .bll__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .banner { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-l); font-size: 0.875rem; font-weight: 500; }
        .banner--info    { background: var(--color-primary-light); color: var(--color-primary); border: 1px solid var(--color-primary); }
        .banner--warning { background: var(--color-warning-bg, #fef9c3); color: var(--color-warning); border: 1px solid var(--color-warning); }
        .banner--error   { background: var(--color-error-bg, #fee2e2); color: var(--color-error); border: 1px solid var(--color-error); }

        .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-5); box-shadow: var(--shadow-xs); }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
        .card-header h3 { font-size: 0.95rem; font-weight: 700; }

        .current-plan-body { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); }
        .current-plan-info { display: flex; flex-direction: column; gap: 4px; }
        .plan-display-name { font-size: 1.2rem; font-weight: 800; text-transform: capitalize; }
        .plan-cycle { font-size: 0.82rem; color: var(--color-text-muted); text-transform: capitalize; }
        .plan-renews { font-size: 0.82rem; color: var(--color-text-secondary); }
        .current-plan-actions { }
        .auto-renew-row { display: flex; align-items: center; gap: var(--space-2); font-size: 0.875rem; cursor: pointer; user-select: none; }
        .auto-renew-row input { width: 16px; height: 16px; accent-color: var(--color-primary); cursor: pointer; }

        .cycle-toggle { display: flex; gap: 0; border: 1.5px solid var(--color-border); border-radius: var(--radius-l); width: fit-content; overflow: hidden; }
        .cycle-btn { padding: var(--space-2) var(--space-5); font-size: 0.875rem; font-weight: 600; color: var(--color-text-secondary); background: var(--color-surface); cursor: pointer; transition: all var(--transition-fast); display: flex; align-items: center; gap: var(--space-2); }
        .cycle-btn--active { background: var(--color-primary); color: #fff; }
        .save-badge { background: var(--color-success); color: #fff; font-size: 0.65rem; font-weight: 700; padding: 2px 6px; border-radius: var(--radius-full); }

        .plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-4); }
        .plan-card { background: var(--color-surface); border: 2px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-5); position: relative; display: flex; flex-direction: column; gap: var(--space-4); transition: box-shadow var(--transition-fast); }
        .plan-card:hover { box-shadow: var(--shadow-md); }
        .plan-card--current { border-color: var(--color-primary); }
        .plan-card--popular { border-color: var(--color-success); }
        .popular-badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--color-success); color: #fff; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: var(--radius-full); white-space: nowrap; }
        .current-badge { position: absolute; top: -12px; right: var(--space-4); background: var(--color-primary); color: #fff; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: var(--radius-full); }

        .plan-card__header { display: flex; align-items: flex-start; gap: var(--space-3); }
        .plan-icon { width: 40px; height: 40px; border-radius: var(--radius-m); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .plan-name { font-size: 1rem; font-weight: 800; margin-bottom: 2px; }
        .plan-price { display: flex; align-items: baseline; gap: 4px; }
        .plan-price__amount { font-size: 1.1rem; font-weight: 800; font-family: var(--font-heading); }
        .plan-price__period { font-size: 0.75rem; color: var(--color-text-muted); }

        .plan-limits { display: flex; flex-direction: column; gap: 6px; background: var(--color-surface-2); border-radius: var(--radius-m); padding: var(--space-3); }
        .limit-item { display: flex; justify-content: space-between; font-size: 0.8rem; }
        .limit-item span { color: var(--color-text-muted); }
        .limit-item strong { font-weight: 700; }

        .plan-features { list-style: none; display: flex; flex-direction: column; gap: 5px; flex: 1; }
        .plan-feature { display: flex; align-items: flex-start; gap: 6px; font-size: 0.8rem; }

        .btn-choose { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: var(--space-3); background: var(--color-primary); color: #fff; border-radius: var(--radius-m); font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: all var(--transition-fast); margin-top: auto; }
        .btn-choose:hover:not(:disabled) { background: var(--color-primary-hover); }
        .btn-choose:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-choose--current { background: var(--color-surface-2); color: var(--color-text-secondary); }
        .btn-contact { display: flex; align-items: center; justify-content: center; width: 100%; padding: var(--space-3); border: 2px solid var(--color-primary); color: var(--color-primary); border-radius: var(--radius-m); font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: all var(--transition-fast); text-decoration: none; margin-top: auto; }
        .btn-contact:hover { background: var(--color-primary); color: #fff; }

        .inv-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; min-width: 650px; }
        .inv-table th { text-align: left; padding: var(--space-2) var(--space-3); color: var(--color-text-muted); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid var(--color-border); }
        .inv-table td { padding: var(--space-3); border-bottom: 1px solid var(--color-border); }
        .inv-table tr:last-child td { border-bottom: none; }
        .inv-table tr:hover td { background: var(--color-surface-2); }
        .inv-num { font-family: var(--font-mono, monospace); font-size: 0.8rem; color: var(--color-primary); }
        .dl-btn { padding: 4px 8px; border: 1px solid var(--color-border); border-radius: var(--radius-s); background: var(--color-surface); color: var(--color-text-muted); cursor: pointer; transition: all var(--transition-fast); }
        .dl-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .empty { text-align: center; padding: 40px; color: var(--color-text-muted); font-size: 0.875rem; }

        .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 700; }
        .badge-default  { background: var(--color-surface-2); color: var(--color-text-secondary); }
        .badge-success  { background: var(--color-success-bg, #dcfce7); color: var(--color-success); }
        .badge-warning  { background: var(--color-warning-bg, #fef9c3); color: var(--color-warning); }
        .badge-error    { background: var(--color-error-bg, #fee2e2); color: var(--color-error); }
        .badge-primary  { background: var(--color-primary-light); color: var(--color-primary); }

        .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
