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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id");

    if (!storeId) {
      return jsonResponse({ error: "Falta store_id." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from("service_categories")
      .select("id, name, sort_order")
      .eq("user_id", storeId)
      .order("sort_order", { ascending: true });

    if (catError) {
      console.error("Error fetching categories:", catError);
      return jsonResponse({ error: "Error al obtener categorías." }, 500);
    }

    if (!categories || categories.length === 0) {
      return jsonResponse({ categories: [], items: [], settings: null });
    }

    const categoryIds = categories.map((c) => c.id);

    // Fetch items for all categories
    const { data: items, error: itemError } = await supabase
      .from("service_items")
      .select("id, category_id, name, price, unit, sort_order, active")
      .in("category_id", categoryIds)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    if (itemError) {
      console.error("Error fetching items:", itemError);
      return jsonResponse({ error: "Error al obtener prendas." }, 500);
    }

    // Fetch delivery settings
    const { data: settings } = await supabase
      .from("store_delivery_settings")
      .select("*")
      .eq("user_id", storeId)
      .single();

    return jsonResponse({
      categories: categories || [],
      items: items || [],
      settings: settings || null,
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonResponse({ error: "Error interno del servidor." }, 500);
  }
});
