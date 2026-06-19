import { Request, Response } from 'express'
import { z } from 'zod'
import axios from 'axios'
import { supabase } from '../lib/supabase'
import { isAlreadyProcessed, markProcessed } from '../lib/upstash'

const VFDRetrySchema = z.object({
  receiptId: z.string().uuid(),
  transactionId: z.string().uuid(),
  shopId: z.string().uuid(),
  attempt: z.number().int().min(1).max(5),
})

const MAX_RETRIES = 5
const VFD_API_URL = process.env.VFD_API_URL ?? 'https://vfd.provider.co.tz/api/v1'
const VFD_API_KEY = process.env.VFD_API_KEY ?? ''

async function submitToVFD(transactionId: string, shopId: string): Promise<{ reference: string; qrCodeUrl: string }> {
  const { data: txn } = await supabase
    .from('transactions')
    .select(`
      id, total_amount, payment_method, created_at,
      transaction_items (quantity, unit_price, products (name))
    `)
    .eq('id', transactionId)
    .single()

  if (!txn) throw new Error(`Transaction ${transactionId} not found`)

  const { data: shop } = await supabase
    .from('shops')
    .select('vfd_provider_config')
    .eq('id', shopId)
    .single()

  const providerConfig = shop?.vfd_provider_config ? JSON.parse(shop.vfd_provider_config as string) : {}

  const res = await axios.post(
    `${VFD_API_URL}/submit`,
    {
      tin: providerConfig.tin,
      vrn: providerConfig.vrn,
      serial: providerConfig.device_serial,
      dc: providerConfig.department_code ?? '1',
      gc: providerConfig.gc ?? 1,
      z: new Date(txn.created_at).toISOString().substring(0, 10).replace(/-/g, ''),
      rc: '0',
      pmt: txn.payment_method === 'cash' ? 'CASH' : 'EMONEY',
      totaltaxexcl: String(Number(txn.total_amount) / 1.18),
      totaltaxincl: String(txn.total_amount),
      discount: '0',
      items: (txn as { transaction_items: { quantity: number; unit_price: number; products: { name: string } | null }[] }).transaction_items.map(
        (item: { quantity: number; unit_price: number; products: { name: string } | null }) => ({
          desc: item.products?.name ?? 'Bidhaa',
          qty: item.quantity,
          taxcode: 'A',
          amt: item.quantity * item.unit_price,
        })
      ),
    },
    {
      headers: { 'X-API-Key': VFD_API_KEY, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  )

  return {
    reference: res.data.rctnum ?? res.data.reference,
    qrCodeUrl: res.data.qrcode_url ?? res.data.qr_url ?? '',
  }
}

export async function handleVFDRetry(req: Request, res: Response): Promise<void> {
  const parsed = VFDRetrySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() })
    return
  }

  const { receiptId, transactionId, shopId, attempt } = parsed.data
  const idemKey = `vfd:${receiptId}:${attempt}`

  if (await isAlreadyProcessed(idemKey)) {
    res.json({ status: 'skipped', reason: 'already_processed' })
    return
  }

  try {
    const { reference, qrCodeUrl } = await submitToVFD(transactionId, shopId)

    await supabase
      .from('vfd_receipts')
      .update({ status: 'submitted', provider_reference: reference, qr_code_url: qrCodeUrl })
      .eq('id', receiptId)

    await markProcessed(idemKey)
    res.json({ status: 'submitted', reference, qrCodeUrl })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const nextAttempt = attempt + 1
    const isFinal = nextAttempt > MAX_RETRIES

    await supabase
      .from('vfd_receipts')
      .update({
        status: isFinal ? 'failed' : 'pending',
        retry_count: attempt,
      })
      .eq('id', receiptId)

    res.status(502).json({
      status: 'failed',
      error: msg,
      will_retry: !isFinal,
      next_attempt: isFinal ? null : nextAttempt,
    })
  }
}

export async function retryPendingVFD(): Promise<void> {
  const { data: pending } = await supabase
    .from('vfd_receipts')
    .select('id, transaction_id, retry_count, transactions (shop_id)')
    .eq('status', 'pending')
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(20)

  if (!pending?.length) return

  for (const receipt of pending) {
    const shopId = (receipt as { transactions: { shop_id: string } | null }).transactions?.shop_id
    if (!shopId) continue
    try {
      const { reference, qrCodeUrl } = await submitToVFD(receipt.transaction_id, shopId)
      await supabase
        .from('vfd_receipts')
        .update({ status: 'submitted', provider_reference: reference, qr_code_url: qrCodeUrl })
        .eq('id', receipt.id)
    } catch {
      await supabase
        .from('vfd_receipts')
        .update({ retry_count: (receipt.retry_count ?? 0) + 1 })
        .eq('id', receipt.id)
    }
  }
}
