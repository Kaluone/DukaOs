import { Request, Response } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { sendWhatsAppText, sendSMSFallback } from '../lib/whatsapp'
import { isAlreadyProcessed, markProcessed, rateLimitCheck } from '../lib/upstash'

const DispatchSchema = z.object({
  idempotencyKey: z.string().min(1),
  shopId: z.string().uuid(),
  type: z.enum(['sale_alert', 'low_stock', 'daily_digest', 'weekly_digest', 'reconciliation_variance']),
  payload: z.record(z.unknown()),
})

type DispatchBody = z.infer<typeof DispatchSchema>

function buildSaleAlertMessage(payload: Record<string, unknown>): string {
  const amount = (payload.total_amount as number)?.toLocaleString('sw-TZ') ?? '0'
  const method = payload.payment_method as string ?? 'Taslimu'
  const staff = payload.staff_name as string ?? 'Mfanyakazi'
  const items = payload.items_count as number ?? 1
  return `DukaOS Arifa\n\nMuamala mpya umerekodiwa:\n  Jumla: TZS ${amount}\n  Njia: ${method}\n  Bidhaa: ${items}\n  Mfanyakazi: ${staff}\n\nAngalia dashibodi kwa maelezo.`
}

function buildLowStockMessage(payload: Record<string, unknown>): string {
  const product = payload.product_name as string ?? 'Bidhaa'
  const qty = payload.quantity as number ?? 0
  const threshold = payload.reorder_threshold as number ?? 0
  return `DukaOS Arifa ya Stok\n\n${product} ina kiasi kidogo:\n  Zilizobaki: ${qty}\n  Kiwango cha arifa: ${threshold}\n\nTafadhali ongeza stok haraka.`
}

function buildReconciliationMessage(payload: Record<string, unknown>): string {
  const variance = payload.variance as number ?? 0
  const staff = payload.staff_name as string ?? 'Mfanyakazi'
  const sign = variance > 0 ? '+' : ''
  return `DukaOS Usahihishaji wa Pesa\n\nTofauti imeonekana:\n  Mfanyakazi: ${staff}\n  Tofauti: TZS ${sign}${variance.toLocaleString('sw-TZ')}\n\nAngalia dashibodi kwa maelezo kamili.`
}

function buildDailyDigestMessage(payload: Record<string, unknown>): string {
  const total = (payload.total_sales as number)?.toLocaleString('sw-TZ') ?? '0'
  const txns = payload.transaction_count as number ?? 0
  const lowStock = payload.low_stock_count as number ?? 0
  const date = payload.date as string ?? new Date().toLocaleDateString('sw-TZ')
  return `DukaOS Muhtasari wa Leo (${date})\n\n  Mauzo: TZS ${total}\n  Miamala: ${txns}\n  Bidhaa zilizo chini: ${lowStock}\n\nAsante kwa kutumia DukaOS!`
}

function buildMessage(type: DispatchBody['type'], payload: Record<string, unknown>): string {
  switch (type) {
    case 'sale_alert':           return buildSaleAlertMessage(payload)
    case 'low_stock':            return buildLowStockMessage(payload)
    case 'reconciliation_variance': return buildReconciliationMessage(payload)
    case 'daily_digest':         return buildDailyDigestMessage(payload)
    case 'weekly_digest':        return buildDailyDigestMessage({ ...payload, date: `Wiki ya ${payload.week ?? ''}` })
    default:                     return 'DukaOS arifa mpya — angalia app yako.'
  }
}

export async function handleDispatch(req: Request, res: Response): Promise<void> {
  const parsed = DispatchSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    return
  }

  const { idempotencyKey, shopId, type, payload } = parsed.data

  if (await isAlreadyProcessed(idempotencyKey)) {
    res.json({ status: 'skipped', reason: 'already_processed' })
    return
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('id, name')
    .eq('id', shopId)
    .single()

  if (!shop) {
    res.status(404).json({ error: 'Shop not found' })
    return
  }

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('whatsapp_enabled, whatsapp_number, sms_enabled, sms_number, sale_threshold, low_stock_alerts, daily_digest_enabled')
    .eq('shop_id', shopId)
    .single()

  if (!prefs) {
    res.status(404).json({ error: 'Notification preferences not found' })
    return
  }

  const message = buildMessage(type, payload as Record<string, unknown>)
  const dispatched: string[] = []
  const errors: string[] = []

  // WhatsApp channel
  if (prefs.whatsapp_enabled && prefs.whatsapp_number) {
    const allowed = await rateLimitCheck(shopId, 'whatsapp')
    if (allowed) {
      try {
        await sendWhatsAppText({ to: prefs.whatsapp_number, text: message })
        dispatched.push('whatsapp')
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`whatsapp: ${msg}`)
        // SMS fallback
        if (prefs.sms_enabled && prefs.sms_number) {
          try {
            await sendSMSFallback(prefs.sms_number, message)
            dispatched.push('sms_fallback')
          } catch (smsErr: unknown) {
            const smsMsg = smsErr instanceof Error ? smsErr.message : String(smsErr)
            errors.push(`sms_fallback: ${smsMsg}`)
          }
        }
      }
    }
  } else if (prefs.sms_enabled && prefs.sms_number) {
    try {
      await sendSMSFallback(prefs.sms_number, message)
      dispatched.push('sms')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`sms: ${msg}`)
    }
  }

  await supabase.from('notifications_log').insert({
    shop_id: shopId,
    type,
    channel: dispatched.join(',') || 'none',
    status: dispatched.length > 0 ? 'sent' : 'failed',
  })

  await markProcessed(idempotencyKey)

  res.json({
    status: dispatched.length > 0 ? 'sent' : 'failed',
    dispatched,
    errors: errors.length ? errors : undefined,
  })
}
