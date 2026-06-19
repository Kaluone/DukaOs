// DukaOS — notify-sale Edge Function
// Triggered after a transaction is written; evaluates thresholds and dispatches
// notifications via WhatsApp / SMS through the Hetzner worker.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_URL = Deno.env.get("WORKER_URL")!;
const WORKER_SECRET = Deno.env.get("WORKER_SECRET")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const body = await req.json();
  const { transaction_id, shop_id } = body;

  if (!transaction_id || !shop_id) {
    return new Response(JSON.stringify({ error: "Missing transaction_id or shop_id" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch transaction with items
  const { data: txn, error: txnErr } = await supabase
    .from("transactions")
    .select("*, transaction_items(*, products(name))")
    .eq("id", transaction_id)
    .single();

  if (txnErr || !txn) {
    return new Response(JSON.stringify({ error: "Transaction not found" }), {
      status: 404,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch notification preferences
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("shop_id", shop_id)
    .single();

  if (!prefs) {
    return new Response(JSON.stringify({ skipped: "no prefs" }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const notifications: NotificationJob[] = [];

  // Alert if transaction exceeds threshold
  if (txn.total_amount >= prefs.sale_alert_threshold) {
    if (prefs.whatsapp_enabled && prefs.whatsapp_number) {
      notifications.push({
        type: "sale_alert",
        channel: "whatsapp",
        shop_id,
        recipient: prefs.whatsapp_number,
        data: {
          amount: txn.total_amount,
          payment_method: txn.payment_method,
          items: txn.transaction_items?.map((i: any) => ({
            name: i.products?.name,
            qty: i.quantity,
          })),
        },
      });
    }
  }

  // Check low stock for all items sold
  for (const item of txn.transaction_items ?? []) {
    const { data: stock } = await supabase
      .from("stock_levels")
      .select("quantity, reorder_threshold, products(name)")
      .eq("product_id", item.product_id)
      .single();

    if (stock && stock.quantity <= stock.reorder_threshold) {
      if (prefs.whatsapp_enabled && prefs.whatsapp_number) {
        notifications.push({
          type: "low_stock",
          channel: "whatsapp",
          shop_id,
          recipient: prefs.whatsapp_number,
          data: {
            product_name: (stock.products as any)?.name,
            quantity: stock.quantity,
            threshold: stock.reorder_threshold,
          },
        });
      }
    }
  }

  if (notifications.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Dispatch to Hetzner worker
  const workerRes = await fetch(`${WORKER_URL}/dispatch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Worker-Secret": WORKER_SECRET,
    },
    body: JSON.stringify({ notifications }),
  });

  // Log notifications
  const logEntries = notifications.map((n) => ({
    shop_id,
    type: n.type,
    channel: n.channel,
    payload: n.data,
    status: workerRes.ok ? "sent" : "failed",
    sent_at: workerRes.ok ? new Date().toISOString() : null,
  }));

  await supabase.from("notifications_log").insert(logEntries);

  return new Response(JSON.stringify({ sent: notifications.length }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

interface NotificationJob {
  type: string;
  channel: string;
  shop_id: string;
  recipient: string;
  data: Record<string, unknown>;
}
