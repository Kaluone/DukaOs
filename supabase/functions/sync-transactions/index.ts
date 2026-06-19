import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface SyncItem {
  offline_id: string
  shop_id: string
  staff_id: string | null
  payment_method: string
  total_amount: number
  created_at: string
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
  }>
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  let body: { transactions: SyncItem[] }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const { transactions } = body
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return new Response(JSON.stringify({ synced: [], failed: [] }), { status: 200 })
  }

  // Verify all transactions belong to this owner's shop
  const { data: shop } = await supabase
    .from('shops')
    .select('id')
    .eq('owner_user_id', user.id)
    .single()

  if (!shop) {
    return new Response(JSON.stringify({ error: 'Shop not found' }), { status: 404 })
  }

  const synced: string[] = []
  const failed: Array<{ offline_id: string; error: string }> = []

  for (const txn of transactions) {
    if (txn.shop_id !== shop.id) {
      failed.push({ offline_id: txn.offline_id, error: 'shop_id mismatch' })
      continue
    }

    // Idempotency: skip if already synced
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('offline_id', txn.offline_id)
      .maybeSingle()

    if (existing) {
      synced.push(txn.offline_id)
      continue
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('transactions')
      .insert({
        shop_id:        txn.shop_id,
        staff_id:       txn.staff_id,
        payment_method: txn.payment_method,
        total_amount:   txn.total_amount,
        sync_status:    'synced',
        offline_id:     txn.offline_id,
        created_at:     txn.created_at,
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      failed.push({ offline_id: txn.offline_id, error: insertErr?.message ?? 'insert failed' })
      continue
    }

    // Insert line items
    const itemRows = txn.items.map(item => ({
      transaction_id: inserted.id,
      product_id:     item.product_id,
      quantity:       item.quantity,
      unit_price:     item.unit_price,
    }))

    const { error: itemErr } = await supabase.from('transaction_items').insert(itemRows)
    if (itemErr) {
      // Roll back transaction row on item failure
      await supabase.from('transactions').delete().eq('id', inserted.id)
      failed.push({ offline_id: txn.offline_id, error: itemErr.message })
      continue
    }

    // Trigger notify-sale edge function asynchronously
    EdgeRuntime.waitUntil(
      fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ transaction_id: inserted.id, shop_id: txn.shop_id }),
      }).catch(() => { /* non-blocking */ })
    )

    synced.push(txn.offline_id)
  }

  return new Response(
    JSON.stringify({ synced, failed, total: transactions.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
