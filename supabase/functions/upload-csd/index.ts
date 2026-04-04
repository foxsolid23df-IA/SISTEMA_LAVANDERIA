import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const facturamaUser = Deno.env.get("FACTURAMA_USER") || "";
    const facturamaPassword = Deno.env.get("FACTURAMA_PASSWORD") || "";
    const encodedCredentials = btoa(`${facturamaUser}:${facturamaPassword}`);
    // Sandbox URL — cambiar a https://api.facturama.mx para producción
    const baseUrl = "https://apisandbox.facturama.mx"; 

    // Obtener Payload del cliente
    const body = await req.json();
    const { 
      rfc, 
      razon_social, 
      regimen_fiscal, 
      codigo_postal, 
      sucursal_nombre,
      cer_base64, 
      key_base64, 
      password 
    } = body;

    if (!rfc || !razon_social || !regimen_fiscal || !codigo_postal || !cer_base64 || !key_base64 || !password) {
      return new Response(
        JSON.stringify({ error: "Faltan datos obligatorios o los archivos CSD no se proporcionaron." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Obtener User del request (para asociar el emisor)
    const authHeader = req.headers.get("Authorization");
    console.log("Authorization Header recibido en function:", authHeader ? "Presente" : "Faltante");
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Auth header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Error validando usuario Supabase Auth:", authError);
      return new Response(JSON.stringify({ 
        error: "Unauthorized Supabase Auth", 
        details: authError,
        tokenReceived: token ? `${token.substring(0, 10)}...` : "none" 
      }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log("Usuario autenticado exitosamente:", user.email, "ID:", user.id);

    // 2. Enviar a Facturama (API Lite -> CSDs)
    const facturamaPayload = {
      Rfc: rfc.toUpperCase(),
      Certificate: cer_base64,
      PrivateKey: key_base64,
      PrivateKeyPassword: password
    };

    console.log(`Enviando CSD a Facturama para RFC: ${facturamaPayload.Rfc}`);

    // POST /api-lite/csds
    const csdRes = await fetch(`${baseUrl}/api-lite/csds`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encodedCredentials}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(facturamaPayload)
    });

    const csdText = await csdRes.text();
    let csdData;
    try {
      csdData = JSON.parse(csdText);
    } catch {
      csdData = { rawText: csdText };
    }

    if (!csdRes.ok) {
        // Si el CSD ya existe para este RFC, lo tratamos como éxito
        const alreadyExists = csdData.Message?.includes("Ya existe") 
          || csdData.Message?.includes("already exists")
          || JSON.stringify(csdData.ModelState || {}).includes("Ya existe");
        
        if (alreadyExists) {
          console.log(`CSD ya registrado en Facturama para RFC ${rfc} — continuando con guardado en BD.`);
        } else {
          let errorMsg = `Error registrando CSD (HTTP ${csdRes.status})`;
          if (csdData.ModelState) {
              errorMsg += ": " + Object.values(csdData.ModelState).flat().join(", ");
          } else if (csdData.Message) {
              errorMsg += ": " + csdData.Message;
          }
          return new Response(JSON.stringify({ success: false, message: errorMsg, raw: csdData }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
    }

    // 3. Crear registro en BD (NO guardamos cer_base64, key_base64 ni password)
    const { data: issuer, error: dbError } = await supabase
      .from("billing_issuers")
      .insert({
        user_id: user.id,
        rfc: rfc.toUpperCase(),
        razon_social: razon_social.toUpperCase(),
        regimen_fiscal: regimen_fiscal,
        codigo_postal: codigo_postal,
        branch_name: sucursal_nombre || null,
        is_csd_loaded: true
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error guardando en Supabase billing_issuers:", dbError);
      return new Response(JSON.stringify({ 
        error: "Sellos cargados en SAT/Facturama pero error guardando en BD local.", 
        details: dbError,
        facturamaResponse: csdData 
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, issuer }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Error inesperado en upload-csd:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
