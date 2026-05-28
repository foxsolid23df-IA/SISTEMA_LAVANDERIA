import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseToken = async (req: Request) => {
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken.trim();

  if (req.method !== "POST") return "";

  try {
    const body = await req.json();
    return String(body?.token || "").trim();
  } catch (_err) {
    return "";
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = await parseToken(req);
    if (!token) {
      return jsonResponse({ error: "Falta token de seguimiento." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error } = await supabase
      .from("delivery_orders")
      .select(`
        id,
        user_id,
        driver_id,
        customer_name,
        customer_address,
        notes,
        status,
        garment_summary,
        customer_item_description,
        payment_preference,
        payment_preference_confirmed_at,
        payment_status,
        service_cost,
        delivery_fee,
        pickup_quote_confirmed_at,
        quote_notes,
        tracking_token,
        created_at,
        accepted_at,
        picked_up_at,
        delivered_to_store_at,
        completed_at
      `)
      .eq("tracking_token", token)
      .maybeSingle();

    if (error) {
      console.error("[get-delivery-tracking] Error consultando pedido:", error);
      return jsonResponse({ error: "No se pudo consultar el seguimiento." }, 500);
    }

    if (!order) {
      return jsonResponse({ error: "Pedido no encontrado." }, 404);
    }

    const [{ data: profile }, { data: driver }] = await Promise.all([
      supabase
        .from("profiles")
        .select("store_name, delivery_enabled")
        .eq("id", order.user_id)
        .maybeSingle(),
      order.driver_id
        ? supabase
            .from("staff")
            .select("name")
            .eq("id", order.driver_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (profile?.delivery_enabled !== true) {
      return jsonResponse({ error: "Pedido no encontrado." }, 404);
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("delivery_payments")
      .select("amount, payment_method, reference, status, receipt_token, created_at, reconciled_at")
      .eq("delivery_order_id", order.id)
      .neq("status", "voided")
      .order("created_at", { ascending: true });

    if (paymentsError) {
      console.error("[get-delivery-tracking] Error consultando pagos:", paymentsError);
    }

    const serviceCost = Number(order.service_cost) || 0;
    const deliveryFee = Number(order.delivery_fee) || 0;
    const totalCost = serviceCost + deliveryFee;
    const paidAmount = (payments || []).reduce((sum: number, payment: any) => {
      return sum + (Number(payment.amount) || 0);
    }, 0);

    return jsonResponse({
      order: {
        id: order.id,
        customer_name: order.customer_name,
        customer_address: order.customer_address,
        notes: order.notes,
        status: order.status,
        garment_summary: order.garment_summary,
        customer_item_description: order.customer_item_description,
        payment_preference: order.payment_preference,
        payment_preference_confirmed_at: order.payment_preference_confirmed_at,
        payment_status: order.payment_status,
        service_cost: order.service_cost,
        delivery_fee: order.delivery_fee,
        pickup_quote_confirmed_at: order.pickup_quote_confirmed_at,
        quote_notes: order.quote_notes,
        total_cost: totalCost,
        paid_amount: paidAmount,
        balance_due: Math.max(0, totalCost - paidAmount),
        payments: (payments || []).map((payment: any) => ({
          amount: payment.amount,
          payment_method: payment.payment_method,
          reference: payment.reference,
          status: payment.status,
          receipt_token: payment.receipt_token,
          created_at: payment.created_at,
          reconciled_at: payment.reconciled_at,
        })),
        tracking_token: order.tracking_token,
        created_at: order.created_at,
        accepted_at: order.accepted_at,
        picked_up_at: order.picked_up_at,
        delivered_to_store_at: order.delivered_to_store_at,
        completed_at: order.completed_at,
        store_name: profile?.store_name || "Lavanderia",
        driver_name: driver?.name || null,
      },
    });
  } catch (err) {
    console.error("[get-delivery-tracking] Error inesperado:", err);
    return jsonResponse({ error: "Error interno consultando seguimiento." }, 500);
  }
});
