// DukaOS — vfd-submit Edge Function
// Submits a completed transaction to the TRA-approved VFD provider.
// Only called when shop.vfd_enabled = true.
// Failed submissions are retried by the worker; the sale is NEVER blocked.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VFD_API_URL = Deno.env.get("VFD_API_URL")!;
const VFD_API_KEY = Deno.env.get("VFD_API_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const body = await req.json();
  const { transaction_id, shop_id } = body;

  // Create pending VFD receipt row immediately (sale is never blocked)
  const { data: receipt, error: insertErr } = await supabase
    .from("vfd_receipts")
    .insert({ transaction_id, shop_id, status: "pending" })
    .select()
    .single();

  if (insertErr || !receipt) {
    return new Response(JSON.stringify({ error: "Could not create receipt row" }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // Fetch transaction with items for the VFD payload
  const { data: txn } = await supabase
    .from("transactions")
    .select("*, transaction_items(*, products(name, price))")
    .eq("id", transaction_id)
    .single();

  if (!txn) {
    return new Response(JSON.stringify({ receipt_id: receipt.id, status: "pending" }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const vfdPayload = {
      merchant_reference: transaction_id,
      total_amount: txn.total_amount,
      payment_method: txn.payment_method,
      items: txn.transaction_items?.map((i: any) => ({
        description: i.products?.name ?? "Bidhaa",
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price,
        tax_code: "A", // Standard VAT — adjust per TRA provider docs
      })),
    };

    const vfdRes = await fetch(`${VFD_API_URL}/receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VFD_API_KEY}`,
      },
      body: JSON.stringify(vfdPayload),
    });

    if (vfdRes.ok) {
      const vfdData = await vfdRes.json();
      await supabase
        .from("vfd_receipts")
        .update({
          status: "submitted",
          provider_reference: vfdData.reference,
          qr_code_url: vfdData.qr_code_url,
          submitted_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);

      return new Response(JSON.stringify({ receipt_id: receipt.id, status: "submitted", reference: vfdData.reference }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    } else {
      const errText = await vfdRes.text();
      await supabase
        .from("vfd_receipts")
        .update({ status: "failed", error_message: errText, retry_count: 1 })
        .eq("id", receipt.id);

      // Still return 200 — sale was recorded, VFD will be retried
      return new Response(JSON.stringify({ receipt_id: receipt.id, status: "failed", will_retry: true }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    await supabase
      .from("vfd_receipts")
      .update({ status: "failed", error_message: String(err), retry_count: 1 })
      .eq("id", receipt.id);

    return new Response(JSON.stringify({ receipt_id: receipt.id, status: "failed", will_retry: true }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
