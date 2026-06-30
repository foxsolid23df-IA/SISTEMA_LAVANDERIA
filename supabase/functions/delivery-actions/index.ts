import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const getAuthUser = async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
};

const validTransition = (current: string, next: string) => {
  const allowed: Record<string, string[]> = {
    requested: ["assigned", "cancelled"],
    assigned: ["picked_up", "cancelled"],
    picked_up: ["delivered_to_store", "cancelled"],
    delivered_to_store: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  return allowed[current]?.includes(next) === true;
};

const paymentStatus = (total: number, paid: number) => {
  if (paid <= 0) return "unpaid";
  if (total > 0 && paid >= total) return "paid";
  return "partial";
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const signPayload = async (payload: string) => {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(signature);
};

const verifyDriverSession = async (storeId: string, driverId: number, token: string) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 4) return false;

  const [tokenStoreId, tokenDriverId, issuedAt, signature] = parts;
  if (tokenStoreId !== storeId || Number(tokenDriverId) !== Number(driverId)) return false;

  const ageMs = Date.now() - Number(issuedAt);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 7 * 24 * 60 * 60 * 1000) return false;

  const payload = `${tokenStoreId}.${tokenDriverId}.${issuedAt}`;
  return await signPayload(payload) === signature;
};

const getStoreFromDriverToken = async (token: string, supabase: any) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 4) return null;

  const [tokenStoreId, tokenDriverId, issuedAt] = parts;
  const driverId = Number(tokenDriverId);
  if (!Number.isFinite(driverId)) return null;

  const ok = await verifyDriverSession(tokenStoreId, driverId, token);
  if (!ok) return null;

  const { data: driver } = await supabase
    .from("staff")
    .select("id, name, role, phone, active")
    .eq("id", driverId)
    .eq("user_id", tokenStoreId)
    .eq("active", true)
    .in("role", ["repartidor", "chofer"])
    .maybeSingle();

  if (!driver) return null;

  return { storeId: tokenStoreId, driver };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo no permitido." }, 405);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "").trim();
    const payload = body?.payload || {};

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Actions that work with driver-only auth (no store JWT needed)
    const DRIVER_ONLY_ACTIONS = ["create_express_pickup", "get_driver_stats"];
    let user: any = null;
    let driverContext: any = null;

    if (DRIVER_ONLY_ACTIONS.includes(action)) {
      const sessionInfo = await getStoreFromDriverToken(payload.driver_session_token, supabase);
      if (!sessionInfo) {
        return jsonResponse({ error: "Sesion de repartidor invalida o expirada." }, 401);
      }
      user = { id: sessionInfo.storeId };
      driverContext = sessionInfo.driver;
    } else {
      user = await getAuthUser(req);
      if (!user) {
        return jsonResponse({ error: "Usuario no autenticado." }, 401);
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("delivery_enabled")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.delivery_enabled !== true) {
      return jsonResponse({ error: "Modulo delivery no disponible para esta tienda." }, 403);
    }

    const getOrder = async (orderId: unknown) => {
      const id = Number(orderId);
      if (!Number.isFinite(id)) {
        throw new Error("ID de pedido invalido.");
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .select("*, delivery_payments(amount, status)")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Pedido no encontrado para esta tienda.");
      return data;
    };

    const assertDriverOwnsOrder = (order: any, driverId: unknown) => {
      const parsedDriverId = Number(driverId);
      if (!Number.isFinite(parsedDriverId)) {
        throw new Error("ID de repartidor invalido.");
      }
      if (Number(order.driver_id) !== parsedDriverId) {
        throw new Error("El pedido no esta asignado a este repartidor.");
      }
      return parsedDriverId;
    };

    const assertDriverSession = async (driverId: number, token: unknown) => {
      const ok = await verifyDriverSession(user.id, driverId, String(token || ""));
      if (!ok) {
        throw new Error("Sesion de repartidor invalida o expirada.");
      }
    };

    if (action === "get_driver_orders") {
      const driverId = Number(payload.driver_id);
      if (!Number.isFinite(driverId)) {
        return jsonResponse({ error: "ID de repartidor invalido." }, 400);
      }
      await assertDriverSession(driverId, payload.driver_session_token);

      const { data, error } = await supabase
        .from("delivery_orders")
        .select("*, customers:customer_id (*), delivery_payments (*)")
        .eq("user_id", user.id)
        .eq("driver_id", driverId)
        .not("status", "in", '("completed","cancelled")')
        .order("created_at", { ascending: true });

      if (error) throw error;
      return jsonResponse({ orders: data || [] });
    }

    if (action === "quote_pickup") {
      const order = await getOrder(payload.order_id);
      const fee = Number(payload.delivery_fee);

      if (!["requested"].includes(order.status)) {
        return jsonResponse({ error: "La tarifa solo puede cotizarse antes de asignar repartidor." }, 409);
      }
      if (!Number.isFinite(fee) || fee < 0) {
        return jsonResponse({ error: "Tarifa de recogida invalida." }, 400);
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .update({
          delivery_fee: fee,
          pickup_quote_confirmed_at: new Date().toISOString(),
          quote_notes: String(payload.quote_notes || "").trim() || null,
        })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ order: data });
    }

    if (action === "assign_driver") {
      const order = await getOrder(payload.order_id);
      const driverId = Number(payload.driver_id);

      if (!validTransition(order.status, "assigned")) {
        return jsonResponse({ error: "El pedido no puede asignarse desde su estado actual." }, 409);
      }
      if (!order.pickup_quote_confirmed_at) {
        return jsonResponse({ error: "Primero captura la tarifa de recogida." }, 409);
      }
      if (!order.payment_preference_confirmed_at) {
        return jsonResponse({ error: "La clienta aun no confirma preferencia de pago." }, 409);
      }
      if (!Number.isFinite(driverId)) {
        return jsonResponse({ error: "Repartidor invalido." }, 400);
      }

      const { data: driver, error: driverError } = await supabase
        .from("staff")
        .select("id, name, role, phone, active, user_id")
        .eq("id", driverId)
        .eq("user_id", user.id)
        .eq("active", true)
        .in("role", ["repartidor", "chofer"])
        .maybeSingle();

      if (driverError) throw driverError;
      if (!driver) {
        return jsonResponse({ error: "Repartidor no disponible para esta tienda." }, 404);
      }
      if (!String(driver.phone || "").trim()) {
        return jsonResponse({ error: "El repartidor no tiene telefono registrado." }, 409);
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .update({
          driver_id: driver.id,
          status: "assigned",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ order: data, driver });
    }

    if (action === "mark_picked_up") {
      const order = await getOrder(payload.order_id);
      const driverId = assertDriverOwnsOrder(order, payload.driver_id);
      await assertDriverSession(driverId, payload.driver_session_token);
      const summary = String(payload.garment_summary || "").trim();
      const evidencePath = payload.pickup_evidence_path ? String(payload.pickup_evidence_path) : null;

      if (!validTransition(order.status, "picked_up")) {
        return jsonResponse({ error: "El pedido no puede marcarse como recogido desde su estado actual." }, 409);
      }
      if (!summary) {
        return jsonResponse({ error: "Describe que recogiste antes de continuar." }, 400);
      }
      if (evidencePath && !evidencePath.startsWith(`${user.id}/${order.id}/`)) {
        return jsonResponse({ error: "Ruta de evidencia invalida para este pedido." }, 400);
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .update({
          status: "picked_up",
          picked_up_at: new Date().toISOString(),
          garment_summary: summary.slice(0, 2000),
          pickup_evidence_path: evidencePath || order.pickup_evidence_path || null,
          driver_id: driverId,
        })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ order: data });
    }

    if (action === "deliver_to_store") {
      const order = await getOrder(payload.order_id);
      if (payload.driver_id !== undefined && payload.driver_id !== null) {
        const driverId = assertDriverOwnsOrder(order, payload.driver_id);
        await assertDriverSession(driverId, payload.driver_session_token);
      }

      if (!validTransition(order.status, "delivered_to_store")) {
        return jsonResponse({ error: "El pedido no puede entregarse en sucursal desde su estado actual." }, 409);
      }

      const updatePayload: Record<string, unknown> = {
        status: "delivered_to_store",
        delivered_to_store_at: new Date().toISOString(),
      };

      if (payload.service_cost !== undefined) {
        const cost = Number(payload.service_cost);
        if (!Number.isFinite(cost) || cost < 0) {
          return jsonResponse({ error: "Costo de servicio invalido." }, 400);
        }
        updatePayload.service_cost = cost;
      }
      if (payload.garment_summary !== undefined) {
        updatePayload.garment_summary = String(payload.garment_summary || "").slice(0, 2000);
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .update(updatePayload)
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ order: data });
    }

    if (action === "complete_order") {
      const order = await getOrder(payload.order_id);
      if (!validTransition(order.status, "completed")) {
        return jsonResponse({ error: "El pedido no puede completarse desde su estado actual." }, 409);
      }

      const total = (Number(order.service_cost) || 0) + (Number(order.delivery_fee) || 0);
      const paid = (order.delivery_payments || [])
        .filter((payment: any) => payment.status !== "voided")
        .reduce((sum: number, payment: any) => sum + (Number(payment.amount) || 0), 0);

      if (total > 0 && paid < total && payload.allow_balance !== true) {
        return jsonResponse({ error: "El pedido tiene saldo pendiente." }, 409);
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_with_balance: payload.allow_balance === true,
          payment_status: paymentStatus(total, paid),
        })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ order: data });
    }

    if (action === "cancel_order") {
      const order = await getOrder(payload.order_id);
      if (["completed", "cancelled"].includes(order.status)) {
        return jsonResponse({ error: "El pedido ya esta cerrado." }, 409);
      }

      const { data, error } = await supabase
        .from("delivery_orders")
        .update({ status: "cancelled" })
        .eq("id", order.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ order: data });
    }

    if (action === "register_driver_payment") {
      const order = await getOrder(payload.order_id);
      const driverId = assertDriverOwnsOrder(order, payload.driver_id);
      await assertDriverSession(driverId, payload.driver_session_token);
      const amount = Number(payload.amount);
      const method = String(payload.payment_method || "").trim();
      const reference = String(payload.reference || "").trim();

      if (["completed", "cancelled"].includes(order.status)) {
        return jsonResponse({ error: "No se pueden registrar pagos en pedidos cerrados." }, 409);
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return jsonResponse({ error: "Monto invalido." }, 400);
      }
      if (!["efectivo", "transferencia", "tarjeta"].includes(method)) {
        return jsonResponse({ error: "Metodo de pago invalido." }, 400);
      }
      if (["transferencia", "tarjeta"].includes(method) && !reference) {
        return jsonResponse({ error: "Referencia obligatoria para transferencia o tarjeta." }, 400);
      }

      const { data: payment, error } = await supabase
        .from("delivery_payments")
        .insert([{
          user_id: user.id,
          delivery_order_id: order.id,
          driver_id: driverId,
          amount,
          payment_method: method,
          reference: reference || null,
          status: "driver_collected",
        }])
        .select()
        .single();

      if (error) throw error;

      const paid = [...(order.delivery_payments || []), payment]
        .filter((row: any) => row.status !== "voided")
        .reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);
      const total = (Number(order.service_cost) || 0) + (Number(order.delivery_fee) || 0);

      await supabase
        .from("delivery_orders")
        .update({ payment_status: paymentStatus(total, paid) })
        .eq("id", order.id)
        .eq("user_id", user.id);

      return jsonResponse({ payment });
    }

    if (action === "reconcile_payment") {
      const paymentId = Number(payload.payment_id);
      if (!Number.isFinite(paymentId)) {
        return jsonResponse({ error: "ID de pago invalido." }, 400);
      }

      const { data: paymentRow, error: fetchPaymentError } = await supabase
        .from("delivery_payments")
        .select("*, delivery_order:delivery_order_id(id, pos_order_id, service_cost, delivery_fee, delivery_payments(amount, status))")
        .eq("id", paymentId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchPaymentError) throw fetchPaymentError;
      if (!paymentRow) {
        return jsonResponse({ error: "Pago no encontrado para esta tienda." }, 404);
      }
      if (paymentRow.status !== "driver_collected") {
        return jsonResponse({ error: "Este pago no esta pendiente de conciliacion." }, 409);
      }

      const { data: payment, error } = await supabase
        .from("delivery_payments")
        .update({
          status: "reconciled",
          reconciled_at: new Date().toISOString(),
        })
        .eq("id", paymentId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      const deliveryOrder = paymentRow.delivery_order;
      const paid = (deliveryOrder?.delivery_payments || [])
        .filter((row: any) => row.status !== "voided")
        .reduce((sum: number, row: any) => sum + (Number(row.amount) || 0), 0);
      const total = (Number(deliveryOrder?.service_cost) || 0) + (Number(deliveryOrder?.delivery_fee) || 0);

      await supabase
        .from("delivery_orders")
        .update({ payment_status: paymentStatus(total, paid) })
        .eq("id", deliveryOrder.id)
        .eq("user_id", user.id);

      if (deliveryOrder?.pos_order_id) {
        await supabase
          .from("orders")
          .update({
            paid_amount: paid,
            payment_status: total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "pending",
          })
          .eq("id", deliveryOrder.pos_order_id)
          .eq("user_id", user.id);
      }

      return jsonResponse({ payment });
    }

    if (action === "create_express_pickup") {
      const driverId = driverContext?.id;
      if (!driverId) {
        return jsonResponse({ error: "Repartidor no válido." }, 400);
      }

      const customerName = String(payload.customer_name || "").trim();
      const customerPhone = String(payload.customer_phone || "").trim();
      const customerAddress = String(payload.customer_address || "").trim();
      const garmentSummary = String(payload.garment_summary || "").trim();
      const notes = String(payload.notes || "").trim();
      const deliveryFee = Number(payload.delivery_fee) || 0;
      const paymentPreferenceRaw = String(payload.payment_preference || "").trim();
      // Solo aceptar valores válidos según la constraint de la BD; cadena vacía → null
      const VALID_PREFERENCES = ["pay_at_pickup", "pay_on_ready_delivery", "pay_at_store_pickup"];
      const paymentPreference = VALID_PREFERENCES.includes(paymentPreferenceRaw) ? paymentPreferenceRaw : null;
      const evidencePath = payload.pickup_evidence_path ? String(payload.pickup_evidence_path) : null;

      if (!customerName || !customerPhone || !customerAddress) {
        return jsonResponse({ error: "Nombre, teléfono y dirección del cliente son obligatorios." }, 400);
      }
      if (!garmentSummary) {
        return jsonResponse({ error: "Describe las prendas que recogiste." }, 400);
      }

      console.log(`[create_express_pickup] storeId=${user.id} driverId=${driverId} phone=${customerPhone}`);

      const now = new Date().toISOString();

      const { data: order, error } = await supabase
        .from("delivery_orders")
        .insert([{
          user_id: user.id,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          notes: notes || null,
          driver_id: driverId,
          status: "picked_up",
          garment_summary: garmentSummary.slice(0, 2000),
          service_cost: 0,
          delivery_fee: Math.max(0, deliveryFee),
          pickup_evidence_path: evidencePath || null,
          payment_preference: paymentPreference,
          picked_up_at: now,
        }])
        .select()
        .single();

      if (error) {
        console.error("[create_express_pickup] Error en insert delivery_orders:", JSON.stringify(error));
        throw error;
      }

      // Optionally create linked POS order
      let posOrder = null;
      if (payload.create_pos_order === true) {
        // Auto-generate folio directly (service_role client bypasses RLS,
        // so next_folio() RPC would fail because auth.uid() is null)
        let folioNum = payload.folio ? Number(payload.folio) : null;
        if (!folioNum || !(Number.isFinite(folioNum) && folioNum > 0)) {
          try {
            const { data: counter, error: cErr } = await supabase
              .from("folio_counters")
              .select("last_folio")
              .eq("user_id", user.id)
              .maybeSingle();
            if (cErr) throw cErr;
            if (counter) {
              folioNum = counter.last_folio + 1;
              const { error: updErr } = await supabase
                .from("folio_counters")
                .update({ last_folio: folioNum, updated_at: new Date().toISOString() })
                .eq("user_id", user.id);
              if (updErr) throw updErr;
            } else {
              const { data: maxOrder } = await supabase
                .from("orders")
                .select("folio")
                .eq("user_id", user.id)
                .order("folio", { ascending: false })
                .limit(1)
                .maybeSingle();
              folioNum = (maxOrder?.folio || 0) + 1;
              const { error: insErr } = await supabase
                .from("folio_counters")
                .insert({ user_id: user.id, last_folio: folioNum, updated_at: new Date().toISOString() });
              if (insErr) throw insErr;
            }
          } catch (e) {
            console.error("[create_express_pickup] Error generando folio:", e);
          }
        }
        if (folioNum && Number.isFinite(folioNum) && folioNum > 0) {
          const posPayload: Record<string, unknown> = {
            user_id: user.id,
            customer_id: null,
            total: deliveryFee,
            paid_amount: 0,
            discount: 0,
            status: "received",
            payment_status: "pending",
            payment_method: "cash",
            notes: `Recolección express #${order.id}: ${garmentSummary.slice(0, 200)}`,
            folio: folioNum,
            has_tax: false,
            tax_amount: 0,
            invoice_requested: false,
          };

          const { data: posResult, error: posError } = await supabase
            .from("orders")
            .insert([posPayload])
            .select()
            .single();

          if (!posError && posResult) {
            posOrder = posResult;

            // Link delivery order to POS order
            await supabase
              .from("delivery_orders")
              .update({ pos_order_id: posOrder.id })
              .eq("id", order.id)
              .eq("user_id", user.id);

            // Create order item for the service
            await supabase
              .from("order_items")
              .insert([{
                order_id: posOrder.id,
                user_id: user.id,
                product_name: `Servicio de lavandería - ${customerName}`,
                quantity: 1,
                price: deliveryFee,
                pricing_type: "service",
                total: deliveryFee,
              }]);

            order.pos_order_id = posOrder.id;
          }
        }
      }

      // Optionally register payment if driver collected
      let payment = null;
      if (payload.register_payment === true && payload.payment_amount) {
        const pAmount = Number(payload.payment_amount);
        const pMethod = String(payload.payment_method || "efectivo").trim();
        const pReference = String(payload.payment_reference || "").trim();

        if (Number.isFinite(pAmount) && pAmount > 0 && ["efectivo", "transferencia", "tarjeta"].includes(pMethod)) {
          if (["transferencia", "tarjeta"].includes(pMethod) && !pReference) {
            return jsonResponse({ error: "Referencia obligatoria para transferencia o tarjeta." }, 400);
          }

          const { data: payResult, error: payError } = await supabase
            .from("delivery_payments")
            .insert([{
              user_id: user.id,
              delivery_order_id: order.id,
              driver_id: driverId,
              amount: pAmount,
              payment_method: pMethod,
              reference: pReference || null,
              status: "driver_collected",
            }])
            .select()
            .single();

          if (!payError && payResult) {
            payment = payResult;

            // Update payment status on delivery order
            const total = (Number(order.service_cost) || 0) + (Number(order.delivery_fee) || 0);
            await supabase
              .from("delivery_orders")
              .update({ payment_status: total > 0 ? "partial" : "paid" })
              .eq("id", order.id);

            // Update POS order paid amount if it was linked
            if (posOrder) {
              await supabase
                .from("orders")
                .update({
                  paid_amount: pAmount,
                  payment_status: pAmount >= total ? "paid" : "partial",
                })
                .eq("id", posOrder.id);
            }
          }
        }
      }

      // Fetch the final order with driver info for response
      const { data: finalOrder } = await supabase
        .from("delivery_orders")
        .select("*, driver:driver_id (id, name, role, phone)")
        .eq("id", order.id)
        .single();

      return jsonResponse({
        order: finalOrder || order,
        pos_order: posOrder,
        payment: payment,
      });
    }

    if (action === "get_driver_stats") {
      const driverId = driverContext?.id;
      if (!driverId) {
        return jsonResponse({ error: "Repartidor no válido." }, 400);
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: todayOrders } = await supabase
        .from("delivery_orders")
        .select("id, status, delivery_fee, service_cost, payment_status, created_at")
        .eq("user_id", user.id)
        .eq("driver_id", driverId)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false });

      const totalToday = (todayOrders || []).length;
      const pickedUp = (todayOrders || []).filter((o: any) =>
        ["picked_up", "delivered_to_store", "completed"].includes(o.status)
      ).length;
      const delivered = (todayOrders || []).filter((o: any) =>
        ["delivered_to_store", "completed"].includes(o.status)
      ).length;
      const totalCollected = (todayOrders || []).reduce((sum: number, o: any) =>
        sum + (Number(o.delivery_fee) || 0) + (Number(o.service_cost) || 0), 0);

      return jsonResponse({
        stats: {
          total_today: totalToday,
          picked_up: pickedUp,
          delivered_to_store: delivered,
          total_collected: totalCollected,
        },
        orders: todayOrders || [],
      });
    }

    if (action === "get_pickup_evidence_url") {
      const order = await getOrder(payload.order_id);
      if (!order.pickup_evidence_path) {
        return jsonResponse({ error: "Este pedido no tiene evidencia." }, 404);
      }
      if (!String(order.pickup_evidence_path).startsWith(`${user.id}/${order.id}/`)) {
        return jsonResponse({ error: "Ruta de evidencia invalida." }, 400);
      }

      const { data, error } = await supabase.storage
        .from("delivery-evidence")
        .createSignedUrl(order.pickup_evidence_path, 60 * 5);

      if (error) throw error;
      return jsonResponse({ signedUrl: data?.signedUrl || null });
    }

    return jsonResponse({ error: "Accion no soportada." }, 400);
  } catch (err: any) {
    // Extraer el mensaje real: PostgREST usa err.message, err.details, err.hint, err.code
    const pgMessage = err?.message || "";
    const pgDetails = err?.details || "";
    const pgHint = err?.hint || "";
    const pgCode = err?.code || "";
    const errorMessage = [
      pgMessage || "Error interno en delivery.",
      pgDetails ? `Detalle: ${pgDetails}` : "",
      pgHint ? `Sugerencia: ${pgHint}` : "",
      pgCode ? `Código: ${pgCode}` : "",
    ].filter(Boolean).join(" | ");
    console.error("[delivery-actions] Unhandled error:", JSON.stringify({ message: pgMessage, details: pgDetails, hint: pgHint, code: pgCode, raw: String(err) }));
    return jsonResponse({ error: errorMessage }, 500);
  }
});
