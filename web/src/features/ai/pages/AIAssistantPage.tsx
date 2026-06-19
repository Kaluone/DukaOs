import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Send, Bot, User, Sparkles, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/shared/lib/supabaseClient'
import { useAuth } from '@/shared/hooks/useAuth'
import { useShop } from '@/shared/hooks/useShop'
import { format, subDays } from 'date-fns'
import { useT } from '@/shared/i18n/useLanguage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface BusinessContext {
  revenue_today: number
  revenue_week: number
  revenue_month: number
  expenses_month: number
  profit_month: number
  top_products: { name: string; qty: number; revenue: number }[]
  low_stock: { name: string; qty: number; threshold: number }[]
  staff_count: number
  customer_count: number
  total_transactions: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('sw-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(n ?? 0)
}

function getHealthScore(ctx: BusinessContext): { score: number; label: string; color: string; reasons: string[] } {
  const reasons: string[] = []
  let score = 50

  if (ctx.profit_month > 0) { score += 20; reasons.push('Positive profit this month') }
  else { score -= 20; reasons.push('Negative profit this month') }

  if (ctx.revenue_month > ctx.revenue_week * 4) { score += 10; reasons.push('Consistent monthly revenue') }

  if (ctx.low_stock.length === 0) { score += 10; reasons.push('Stock levels healthy') }
  else { score -= ctx.low_stock.length * 3; reasons.push(`${ctx.low_stock.length} products need restocking`) }

  if (ctx.customer_count > 10) { score += 5; reasons.push('Good customer base') }
  if (ctx.total_transactions > 50) { score += 5; reasons.push('Active sales activity') }

  const margin = ctx.revenue_month > 0 ? ctx.profit_month / ctx.revenue_month : 0
  if (margin > 0.3) { score += 10; reasons.push(`Healthy ${(margin * 100).toFixed(0)}% profit margin`) }
  else if (margin < 0.1) { score -= 10; reasons.push('Low profit margin') }

  score = Math.max(0, Math.min(100, score))
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#ef4444'
  return { score, label, color, reasons }
}

// ─── AI Response Engine ───────────────────────────────────────────────────────
// Analyzes business data to answer questions without external API calls

function generateAIResponse(question: string, ctx: BusinessContext, shopName: string): string {
  const q = question.toLowerCase()

  // Revenue queries
  if (q.includes('revenue') || q.includes('mapato') || q.includes('sales') || q.includes('mauzo')) {
    if (q.includes('today') || q.includes('leo')) {
      return `Today's revenue for ${shopName} is **${fmt(ctx.revenue_today)}**. ${ctx.revenue_today > 0 ? `You've made ${ctx.total_transactions} transactions so far today. Keep it up!` : `No sales recorded yet today. Consider running a promotion or checking if the POS is active.`}`
    }
    if (q.includes('week') || q.includes('wiki')) {
      return `This week's revenue is **${fmt(ctx.revenue_week)}**. Your average daily revenue this week is **${fmt(ctx.revenue_week / 7)}**. ${ctx.revenue_week > ctx.revenue_month / 4 ? '📈 You\'re trending above your monthly average!' : '📉 Revenue is below the monthly average rate.'}`
    }
    return `Here's your revenue summary:\n- **Today**: ${fmt(ctx.revenue_today)}\n- **This week**: ${fmt(ctx.revenue_week)}\n- **This month**: ${fmt(ctx.revenue_month)}\n\nYour profit margin this month is approximately **${ctx.revenue_month > 0 ? ((ctx.profit_month / ctx.revenue_month) * 100).toFixed(1) : 0}%**.`
  }

  // Profit queries
  if (q.includes('profit') || q.includes('faida') || q.includes('decrease') || q.includes('pungu')) {
    const margin = ctx.revenue_month > 0 ? (ctx.profit_month / ctx.revenue_month) * 100 : 0
    if (ctx.profit_month < 0) {
      return `⚠️ Your profit is currently **negative** this month (${fmt(ctx.profit_month)}). Here's why this might be happening:\n\n1. **High expenses**: Your expenses (${fmt(ctx.expenses_month)}) are exceeding your gross profit\n2. **Low margins**: Check buying prices vs selling prices for your top products\n3. **Discounts**: Too many discounts may be cutting into margins\n\n**Recommended actions:**\n- Review your expense categories to find areas to cut\n- Audit products with the lowest margins\n- Consider a small price increase on slow-moving items`
    }
    return `Your profit this month is **${fmt(ctx.profit_month)}** (margin: ${margin.toFixed(1)}%). ${margin > 20 ? '✅ This is a healthy margin for retail.' : '⚠️ Your margin is below the recommended 20% for retail.'}  \n\nExpenses this month: ${fmt(ctx.expenses_month)}. ${ctx.expenses_month > ctx.profit_month * 0.5 ? '\n\n💡 Tip: Expenses are more than 50% of your gross profit. Review your expense categories in the Expenses Report.' : ''}`
  }

  // Stock / reorder queries
  if (q.includes('stock') || q.includes('stok') || q.includes('reorder') || q.includes('agiza') || q.includes('restock')) {
    if (ctx.low_stock.length === 0) {
      return `✅ Great news! All your products are currently above their reorder thresholds. No immediate restocking needed.`
    }
    const urgent = ctx.low_stock.filter(p => p.qty === 0)
    const low = ctx.low_stock.filter(p => p.qty > 0)
    let response = `You need to restock **${ctx.low_stock.length} products**:\n\n`
    if (urgent.length > 0) {
      response += `**🔴 OUT OF STOCK (reorder immediately):**\n${urgent.slice(0, 5).map(p => `- ${p.name}`).join('\n')}\n\n`
    }
    if (low.length > 0) {
      response += `**🟡 LOW STOCK (reorder soon):**\n${low.slice(0, 5).map(p => `- ${p.name}: ${p.qty} units left (reorder at ${p.threshold})`).join('\n')}\n\n`
    }
    response += `\n💡 *Go to Stock Ledger → Add Adjustment to update quantities, or create a Purchase Order to restock from suppliers.*`
    return response
  }

  // Best/top products
  if (q.includes('best') || q.includes('top') || q.includes('sell') || q.includes('uza') || q.includes('popular')) {
    if (ctx.top_products.length === 0) {
      return `No sales data available yet. Start making sales and I'll show you your best-performing products!`
    }
    return `Your **top selling products** this period:\n\n${ctx.top_products.slice(0, 5).map((p, i) => `${i + 1}. **${p.name}** — ${p.qty} units sold, ${fmt(p.revenue)} revenue`).join('\n')}\n\n💡 *Consider keeping these always in stock and possibly bundling them for higher basket sizes.*`
  }

  // Staff performance
  if (q.includes('staff') || q.includes('wafanyakazi') || q.includes('cashier') || q.includes('kashe')) {
    return `You have **${ctx.staff_count} staff members** registered. To see detailed performance metrics, go to **Reports → Staff Performance** where you can see each staff member's transaction count, total revenue, and average sale value.`
  }

  // Expenses
  if (q.includes('expense') || q.includes('gharama') || q.includes('cost')) {
    return `Your total expenses this month are **${fmt(ctx.expenses_month)}**. ${ctx.expenses_month > ctx.revenue_month * 0.3 ? '⚠️ Expenses are more than 30% of revenue — consider reviewing your cost structure.' : '✅ Expenses are within a healthy range.'}\n\nFor a detailed breakdown by category, go to **Reports → Expenses Report**.`
  }

  // Customer queries
  if (q.includes('customer') || q.includes('mteja') || q.includes('client')) {
    return `You have **${ctx.customer_count} registered customers**. \n\n💡 Tips to grow customer loyalty:\n- Use the loyalty points system to reward repeat buyers\n- Follow up on customers with outstanding credit\n- Run promotions for top customers\n\nView your full customer analysis in **Reports → Customer Summary**.`
  }

  // Health score
  if (q.includes('health') || q.includes('score') || q.includes('afya') || q.includes('how am i doing') || q.includes('overview')) {
    const health = getHealthScore(ctx)
    return `Your **Business Health Score** is **${health.score}/100** — ${health.label}\n\n**Key factors:**\n${health.reasons.map(r => `- ${r}`).join('\n')}\n\n**Quick summary:**\n- Revenue this month: ${fmt(ctx.revenue_month)}\n- Profit this month: ${fmt(ctx.profit_month)}\n- Low stock items: ${ctx.low_stock.length}\n- Active customers: ${ctx.customer_count}\n\n${health.score >= 60 ? '✅ Overall your business is performing well. Keep monitoring your margins and stock levels.' : '⚠️ There are areas that need attention. Focus on improving profit margins and restocking critical items.'}`
  }

  // Forecast / prediction
  if (q.includes('forecast') || q.includes('predict') || q.includes('next') || q.includes('future') || q.includes('tabiri')) {
    const dailyAvg = ctx.revenue_week / 7
    const projectedMonth = dailyAvg * 30
    return `Based on your recent performance:\n\n📊 **Revenue Forecast:**\n- Daily average: **${fmt(dailyAvg)}**\n- Projected monthly revenue: **~${fmt(projectedMonth)}**\n- Projected monthly profit (at current margins): **~${fmt(projectedMonth * (ctx.revenue_month > 0 ? ctx.profit_month / ctx.revenue_month : 0))}**\n\n⚠️ *These are estimates based on your recent 7-day trend. Actual results may vary based on seasonality and business conditions.*\n\n💡 To increase revenue: restock low-stock items, promote best sellers, and consider new customer acquisition campaigns.`
  }

  // Default helpful response
  return `I analyzed your business data for **${shopName}**. Here's a quick overview:\n\n- **Revenue today**: ${fmt(ctx.revenue_today)}\n- **Revenue this month**: ${fmt(ctx.revenue_month)}\n- **Profit this month**: ${fmt(ctx.profit_month)}\n- **Low stock items**: ${ctx.low_stock.length}\n- **Customers**: ${ctx.customer_count}\n\n**You can ask me:**\n- "Why did my profit decrease?"\n- "Which products sell best?"\n- "What stock should I reorder?"\n- "How is my business doing?"\n- "Forecast my next month revenue"\n- "How are my staff performing?"`
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useBusinessContext(shopId?: string) {
  return useQuery<BusinessContext>({
    queryKey: ['ai-context', shopId],
    queryFn: async () => {
      const since7 = subDays(new Date(), 7).toISOString()
      const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const today = new Date().toISOString().slice(0, 10)

      const [txnsToday, txnsWeek, txnsMonth, expenses, lowStock, staffCount, customers] = await Promise.all([
        supabase.from('transactions').select('total_amount').eq('shop_id', shopId!).eq('sync_status', 'synced').gte('created_at', today + 'T00:00:00'),
        supabase.from('transactions').select('total_amount').eq('shop_id', shopId!).eq('sync_status', 'synced').gte('created_at', since7),
        supabase.from('transactions').select('id, total_amount, transaction_items(quantity, unit_price, buying_price, item_discount, product:product_id(name))').eq('shop_id', shopId!).eq('sync_status', 'synced').gte('created_at', startMonth),
        supabase.from('expenses').select('amount').eq('shop_id', shopId!).gte('expense_date', today.slice(0, 7) + '-01'),
        supabase.from('v_low_stock').select('product_name, quantity, reorder_threshold').eq('shop_id', shopId!).limit(20),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('shop_id', shopId!).eq('active', true),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('shop_id', shopId!).eq('active', true),
      ])

      const revenue_today = (txnsToday.data ?? []).reduce((s: number, t: any) => s + t.total_amount, 0)
      const revenue_week  = (txnsWeek.data ?? []).reduce((s: number, t: any) => s + t.total_amount, 0)
      const revenue_month = (txnsMonth.data ?? []).reduce((s: number, t: any) => s + t.total_amount, 0)
      const expenses_month = (expenses.data ?? []).reduce((s: number, e: any) => s + e.amount, 0)

      // Calc profit from transaction items
      let cogs = 0
      for (const t of txnsMonth.data ?? []) {
        for (const item of (t as any).transaction_items ?? []) {
          cogs += item.buying_price * item.quantity
        }
      }
      const profit_month = revenue_month - cogs - expenses_month

      // Top products
      const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
      for (const t of txnsMonth.data ?? []) {
        for (const item of (t as any).transaction_items ?? []) {
          const name = item.product?.name ?? 'Unknown'
          if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 }
          productMap[name].qty += item.quantity
          productMap[name].revenue += item.unit_price * item.quantity - (item.item_discount ?? 0)
        }
      }
      const top_products = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 10)

      return {
        revenue_today,
        revenue_week,
        revenue_month,
        expenses_month,
        profit_month,
        top_products,
        low_stock: (lowStock.data ?? []).map((s: any) => ({ name: s.product_name, qty: s.quantity, threshold: s.reorder_threshold })),
        staff_count: staffCount.count ?? 0,
        customer_count: customers.count ?? 0,
        total_transactions: txnsToday.data?.length ?? 0,
      }
    },
    enabled: !!shopId,
    staleTime: 5 * 60_000,
  })
}

// ─── Markdown renderer (simple) ───────────────────────────────────────────────

function renderMarkdown(text: string) {
  return text
    .split('\n')
    .map((line, i) => {
      let el = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')

      if (line.startsWith('- ') || line.startsWith('• ')) {
        return `<li key="${i}">${el.replace(/^[-•]\s+/, '')}</li>`
      }
      if (line === '') return `<br key="${i}" />`
      return `<p key="${i}" style="margin:0 0 4px">${el}</p>`
    })
    .join('')
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AIAssistantPage() {
  const { user } = useAuth()
  const { data: shop } = useShop(user?.id)
  const t = useT()
  const { data: ctx, isLoading: ctxLoading } = useBusinessContext(shop?.id)

  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: t('aiWelcome'),
    timestamp: new Date(),
  }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async (text?: string) => {
    const q = (text ?? input).trim()
    if (!q || thinking || !ctx) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q, timestamp: new Date() }])
    setThinking(true)

    // Small delay to simulate "thinking"
    await new Promise(r => setTimeout(r, 600 + Math.random() * 400))

    const response = generateAIResponse(q, ctx, shop?.name ?? 'your shop')
    setMessages(prev => [...prev, { role: 'assistant', content: response, timestamp: new Date() }])
    setThinking(false)
  }

  const health = ctx ? getHealthScore(ctx) : null

  return (
    <div className="ai">
      <div className="ai__header">
        <div>
          <h1 className="ai__title">{t('aiTitle')}</h1>
          <p className="ai__sub">{t('aiSub')}</p>
        </div>
      </div>

      <div className="ai__layout">
        {/* Chat panel */}
        <div className="ai__chat-panel">
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`msg msg--${msg.role}`}>
                <div className="msg__icon">
                  {msg.role === 'assistant'
                    ? <Bot size={16} />
                    : <User size={16} />}
                </div>
                <div className="msg__bubble">
                  <div
                    className="msg__text"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                  />
                  <span className="msg__time">{format(msg.timestamp, 'HH:mm')}</span>
                </div>
              </div>
            ))}

            {thinking && (
              <div className="msg msg--assistant">
                <div className="msg__icon"><Bot size={16} /></div>
                <div className="msg__bubble">
                  <div className="thinking-dots">
                    <span /><span /><span />
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 2 && (
            <div className="suggestions">
              {[t('aiSuggestion1'), t('aiSuggestion2'), t('aiSuggestion3'), t('aiSuggestion4')].map(s => (
                <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>
                  <Sparkles size={12} /> {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            className="chat-input-row"
            onSubmit={e => { e.preventDefault(); sendMessage() }}
          >
            <input
              className="chat-input"
              placeholder={ctxLoading ? 'Loading business data…' : t('aiPlaceholder')}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={thinking || ctxLoading}
            />
            <button
              type="submit"
              className="chat-send"
              disabled={!input.trim() || thinking || ctxLoading}
              aria-label={t('aiSend')}
            >
              {thinking ? <span className="spinner-sm-white" /> : <Send size={16} />}
            </button>
          </form>
        </div>

        {/* Side panel — Business Health Score + Quick Stats */}
        <div className="ai__side-panel">
          {health && (
            <div className="health-card">
              <h3>{t('healthScore')}</h3>
              <div className="health-score-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={health.color} strokeWidth="10"
                    strokeDasharray={`${(health.score / 100) * 314} 314`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dasharray 0.8s ease' }}
                  />
                  <text x="60" y="60" textAnchor="middle" dy="0.35em" fontSize="22" fontWeight="800" fill={health.color}>{health.score}</text>
                </svg>
              </div>
              <span className="health-label" style={{ color: health.color }}>{health.label}</span>
              <ul className="health-reasons">
                {health.reasons.slice(0, 4).map((r, i) => (
                  <li key={i} className="health-reason">
                    {r.startsWith('Negative') || r.includes('Low') || r.includes('need')
                      ? <TrendingDown size={12} style={{ color: 'var(--color-error)', flexShrink: 0 }} />
                      : <TrendingUp size={12} style={{ color: 'var(--color-success)', flexShrink: 0 }} />}
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ctx && !ctxLoading && (
            <div className="quick-stats">
              <h4>Quick Stats</h4>
              <div className="qs-item"><span>Revenue Today</span><strong style={{ color: 'var(--color-primary)' }}>{fmt(ctx.revenue_today)}</strong></div>
              <div className="qs-item"><span>Revenue Month</span><strong>{fmt(ctx.revenue_month)}</strong></div>
              <div className="qs-item"><span>Profit Month</span><strong style={{ color: ctx.profit_month >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{fmt(ctx.profit_month)}</strong></div>
              <div className="qs-item"><span>Expenses Month</span><strong style={{ color: 'var(--color-error)' }}>{fmt(ctx.expenses_month)}</strong></div>
              <div className="qs-item"><span>Low Stock Items</span>
                <strong style={{ color: ctx.low_stock.length > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {ctx.low_stock.length === 0 ? '✓ Healthy' : ctx.low_stock.length}
                </strong>
              </div>
              <div className="qs-item"><span>Customers</span><strong>{ctx.customer_count}</strong></div>
            </div>
          )}

          {ctxLoading && (
            <div className="side-loading">
              <div className="spinner" />
              <span>Loading business data…</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .ai { display: flex; flex-direction: column; gap: var(--space-5); height: calc(100vh - var(--header-height) - 48px); min-height: 500px; }
        .ai__header { flex-shrink: 0; }
        .ai__title { font-size: 1.6rem; font-weight: 800; }
        .ai__sub { color: var(--color-text-muted); font-size: 0.85rem; }

        .ai__layout { display: grid; grid-template-columns: 1fr 280px; gap: var(--space-5); flex: 1; min-height: 0; }
        @media (max-width: 900px) { .ai__layout { grid-template-columns: 1fr; } }

        .ai__chat-panel { display: flex; flex-direction: column; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); overflow: hidden; box-shadow: var(--shadow-xs); min-height: 0; }

        .chat-messages { flex: 1; overflow-y: auto; padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); min-height: 0; }

        .msg { display: flex; gap: var(--space-3); align-items: flex-start; }
        .msg--user { flex-direction: row-reverse; }
        .msg__icon { width: 32px; height: 32px; border-radius: var(--radius-m); background: var(--color-surface-2); color: var(--color-text-secondary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
        .msg--assistant .msg__icon { background: var(--color-primary); color: #fff; }
        .msg__bubble { max-width: 75%; display: flex; flex-direction: column; gap: 4px; }
        .msg--user .msg__bubble { align-items: flex-end; }
        .msg__text { background: var(--color-surface-2); padding: var(--space-3) var(--space-4); border-radius: var(--radius-l); border-bottom-left-radius: var(--radius-s); font-size: 0.875rem; line-height: 1.5; color: var(--color-text); }
        .msg--user .msg__text { background: var(--color-primary); color: #fff; border-bottom-left-radius: var(--radius-l); border-bottom-right-radius: var(--radius-s); }
        .msg--user .msg__text strong { color: #fff; }
        .msg__text strong { color: var(--color-text); }
        .msg__text code { background: rgba(0,0,0,0.1); padding: 1px 4px; border-radius: 3px; font-size: 0.8em; }
        .msg__text li { margin-left: 16px; list-style: disc; }
        .msg__time { font-size: 0.68rem; color: var(--color-text-muted); }
        .msg--user .msg__time { text-align: right; }

        .thinking-dots { display: flex; gap: 4px; align-items: center; padding: var(--space-2) 0; }
        .thinking-dots span { width: 7px; height: 7px; background: var(--color-text-muted); border-radius: 50%; animation: bounce 1.2s infinite; }
        .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
        .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-8px); } }

        .suggestions { padding: var(--space-3) var(--space-5); display: flex; flex-wrap: wrap; gap: var(--space-2); border-top: 1px solid var(--color-border); }
        .suggestion-chip { display: flex; align-items: center; gap: 4px; padding: 5px 12px; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .suggestion-chip:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-light); }

        .chat-input-row { display: flex; gap: var(--space-2); padding: var(--space-3) var(--space-5) var(--space-4); border-top: 1px solid var(--color-border); flex-shrink: 0; }
        .chat-input { flex: 1; padding: 10px var(--space-4); border: 1.5px solid var(--color-border); border-radius: var(--radius-l); font-size: 0.9rem; outline: none; background: var(--color-surface); color: var(--color-text); }
        .chat-input:focus { border-color: var(--color-primary); }
        .chat-input:disabled { opacity: 0.6; }
        .chat-send { width: 42px; height: 42px; background: var(--color-primary); color: #fff; border-radius: var(--radius-l); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all var(--transition-fast); flex-shrink: 0; }
        .chat-send:hover:not(:disabled) { background: var(--color-primary-hover); }
        .chat-send:disabled { opacity: 0.5; cursor: not-allowed; }

        .ai__side-panel { display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto; }
        @media (max-width: 900px) { .ai__side-panel { display: none; } }

        .health-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-4); box-shadow: var(--shadow-xs); display: flex; flex-direction: column; align-items: center; gap: var(--space-3); }
        .health-card h3 { font-size: 0.875rem; font-weight: 700; align-self: flex-start; }
        .health-score-ring { }
        .health-label { font-size: 1rem; font-weight: 800; }
        .health-reasons { list-style: none; width: 100%; display: flex; flex-direction: column; gap: 5px; }
        .health-reason { display: flex; align-items: flex-start; gap: 6px; font-size: 0.78rem; color: var(--color-text-secondary); }

        .quick-stats { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-l); padding: var(--space-4); box-shadow: var(--shadow-xs); }
        .quick-stats h4 { font-size: 0.82rem; font-weight: 700; margin-bottom: var(--space-3); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .qs-item { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid var(--color-border); font-size: 0.8rem; }
        .qs-item:last-child { border-bottom: none; }
        .qs-item span { color: var(--color-text-muted); }
        .qs-item strong { font-weight: 700; font-size: 0.82rem; }

        .side-loading { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-6); color: var(--color-text-muted); font-size: 0.8rem; }
        .spinner { width: 28px; height: 28px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 700ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .spinner-sm-white { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 700ms linear infinite; display: inline-block; }
      `}</style>
    </div>
  )
}
