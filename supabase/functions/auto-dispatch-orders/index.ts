import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AUTO_DISPATCH_VERSION = "auto-dispatch-v2-20260709";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Get today's date in YYYY-MM-DD (Mexico City timezone)
    const today = new Date();
    today.setUTCHours(today.getUTCHours() - 6);
    const todayStr = today.toISOString().split('T')[0];

    console.log(`[AutoDispatch ${AUTO_DISPATCH_VERSION}] Starting for date: ${todayStr}`);

    // 2. Find orders scheduled for today that are still 'requested'
    const { data: orders, error: ordersError } = await supabase
      .from("delivery_orders")
      .select(`
        id,
        user_id,
        customer_name,
        customer_address,
        customer_phone,
        garment_summary,
        detected_zone,
        profiles:user_id (store_name, whatsapp_session_token, whatsapp_gateway_type)
      `)
      .eq("status", "requested")
      .eq("scheduled_pickup_date", todayStr);

    if (ordersError) {
      console.error("Error fetching scheduled orders:", ordersError);
      return new Response(JSON.stringify({ error: "DB error" }), { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No orders to auto-dispatch today" }));
    }

    console.log(`[AutoDispatch] Found ${orders.length} orders to dispatch.`);

    // 3. Pre-load active drivers per store with their current load
    // Key: storeId -> Array of { driverId, name, phone, activeOrders }
    const storeDriversCache: Record<string, { id: number; name: string; phone: string; activeOrders: number }[]> = {};

    const getStoreDrivers = async (storeId: string) => {
      if (storeDriversCache[storeId]) return storeDriversCache[storeId];

      // Get all active drivers for this store
      const { data: drivers } = await supabase
        .from("staff")
        .select("id, name, phone")
        .eq("user_id", storeId)
        .eq("active", true)
        .in("role", ["repartidor", "chofer"])
        .not("phone", "is", null);

      if (!drivers || drivers.length === 0) {
        storeDriversCache[storeId] = [];
        return [];
      }

      // Count active orders for each driver today
      const enrichedDrivers = await Promise.all(
        drivers.map(async (d) => {
          const { count } = await supabase
            .from("delivery_orders")
            .select("id", { count: "exact", head: true })
            .eq("driver_id", d.id)
            .in("status", ["assigned", "accepted", "picked_up"])
            .gte("created_at", `${todayStr}T00:00:00`);

          return {
            id: d.id,
            name: d.name,
            phone: d.phone,
            activeOrders: count || 0,
          };
        })
      );

      // Sort by active orders ascending (least busy first)
      enrichedDrivers.sort((a, b) => a.activeOrders - b.activeOrders);

      storeDriversCache[storeId] = enrichedDrivers;
      return enrichedDrivers;
    };

    // 4. Get default driver for a zone (with fallback to least busy)
    const resolveDriver = async (storeId: string, zoneName: string | null): Promise<{ id: number; name: string; phone: string } | null> => {
      const drivers = await getStoreDrivers(storeId);
      if (drivers.length === 0) return null;

      // Try to find the default driver for this zone
      if (zoneName) {
        const { data: zone } = await supabase
          .from("pickup_zones")
          .select("default_driver_id")
          .eq("user_id", storeId)
          .eq("zone_name", zoneName)
          .maybeSingle();

        if (zone?.default_driver_id) {
          const defaultDriver = drivers.find(d => d.id === zone.default_driver_id);
          if (defaultDriver) {
            // If default driver has fewer than 8 active orders, use them
            // Otherwise fall back to least busy
            if (defaultDriver.activeOrders < 8) {
              return defaultDriver;
            }
            console.log(`[AutoDispatch] Default driver ${defaultDriver.name} has ${defaultDriver.activeOrders} active orders, finding least busy alternative.`);
          }
        }
      }

      // Return the least busy driver with fewer than 8 active orders
      const available = drivers.find(d => d.activeOrders < 8);
      return available || drivers[0] || null;
    };

    let processed = 0;
    let skipped = 0;
    const driverSummaries: Record<number, { storeId: string; phone: string; instanceName: string; messages: string[] }> = {};

    for (const order of orders) {
      try {
        const driver = await resolveDriver(order.user_id, order.detected_zone);

        if (!driver) {
          console.warn(`[AutoDispatch] Order ${order.id}: No available drivers for store ${order.user_id}`);
          skipped++;
          continue;
        }

        // Update order status to assigned
        const { error: updateError } = await supabase
          .from("delivery_orders")
          .update({
            status: "assigned",
            driver_id: driver.id,
            accepted_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "requested");

        if (updateError) {
          console.error(`[AutoDispatch] Error updating order ${order.id}:`, updateError);
          skipped++;
          continue;
        }

        processed++;
        console.log(`[AutoDispatch] Order ${order.id} assigned to ${driver.name} (${driver.activeOrders + 1} active orders today)`);

        // Accumulate for summary message
        const profile = order.profiles as any;
        if (profile?.whatsapp_session_token) {
          if (!driverSummaries[driver.id]) {
            driverSummaries[driver.id] = {
              storeId: order.user_id,
              phone: driver.phone,
              instanceName: profile.whatsapp_session_token,
              messages: [],
            };
          }

          driverSummaries[driver.id].messages.push(
            `*Orden #${order.id}*\nCliente: ${order.customer_name}\nDirección: ${order.customer_address}\nPrendas: ${order.garment_summary || 'Pendiente'}`
          );
        }
      } catch (err) {
        console.error(`[AutoDispatch] Error processing order ${order.id}:`, err);
        skipped++;
      }
    }

    // 5. Send WhatsApp summary to each driver
    const evoUrl = Deno.env.get("EVOLUTION_API_URL") || "";
    const apiKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    for (const dId of Object.keys(driverSummaries)) {
      const summary = driverSummaries[Number(dId)];
      const text = `🚚 *Nuevas recogidas agendadas para HOY asignadas a ti:*\n\n${summary.messages.join("\n\n")}\n\nRevisa el portal de repartidor para más detalles.`;

      try {
        await fetch(`${evoUrl}/message/sendText/${summary.instanceName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": apiKey,
          },
          body: JSON.stringify({
            number: summary.phone,
            text: text,
          }),
        });
      } catch (err) {
        console.error(`[AutoDispatch] Error sending WA to driver ${dId}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        version: AUTO_DISPATCH_VERSION,
        processed,
        skipped,
        message: `Successfully dispatched ${processed} orders (${skipped} skipped)`,
      })
    );
  } catch (err) {
    console.error("[AutoDispatch] Internal error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
