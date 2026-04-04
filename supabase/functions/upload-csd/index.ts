import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Manejo de pre-vuelo CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("--- INICIANDO PROCESO UPLOAD-CSD ---");

  try {
    // 1. Obtener variables de entorno
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("CRÍTICO: Faltan variables de entorno de Supabase.");
      throw new Error("Configuración de Supabase incompleta en el servidor.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. Validar sesión del usuario
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Error: Petición sin header de Authorization.");
      return new Response(JSON.stringify({ error: "Falta encabezado de autorización" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Error validando token JWT:", authError?.message);
      return new Response(JSON.stringify({ error: "Token inválido o sesión expirada" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`Usuario autenticado: ${user.email} (ID: ${user.id})`);

    // 3. Parsear Body
    const body = await req.json();
    const { 
      rfc, razon_social, regimen_fiscal, codigo_postal, 
      sucursal_nombre, cer_base64, key_base64, password 
    } = body;

    console.log(`Datos recibidos para RFC: ${rfc}`);

    if (!rfc || !cer_base64 || !key_base64 || !password) {
      console.warn("Validación fallida: Faltan archivos CSD o RFC.");
      return new Response(JSON.stringify({ error: "El RFC y los archivos .cer / .key son obligatorios." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 4. Preparar credenciales de Facturama
    const fUser = Deno.env.get("FACTURAMA_USER") || "Nexum_Pos";
    const fPass = Deno.env.get("FACTURAMA_PASSWORD") || "Nexum_Pos";
    const authFacturama = btoa(`${fUser}:${fPass}`);

    console.log("Enviando petición a Facturama...");
    
    const facturamaPayload = {
      Rfc: rfc.toUpperCase(),
      Certificate: cer_base64,
      PrivateKey: key_base64,
      PrivateKeyPassword: password
    };

    const facturamaRes = await fetch("https://apisandbox.facturama.mx/api-lite/csds", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authFacturama}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(facturamaPayload)
    });

    const resultText = await facturamaRes.text();
    let resultData;
    try {
      resultData = JSON.parse(resultText);
    } catch {
      resultData = { message: resultText };
    }

    console.log(`Respuesta de Facturama (HTTP ${facturamaRes.status})`);

    // Manejar errores de Facturama (exceptuando si ya existe el CSD)
    if (!facturamaRes.ok) {
      const alreadyExists = JSON.stringify(resultData).includes("Ya existe") || JSON.stringify(resultData).includes("already exists");
      
      if (!alreadyExists) {
        console.error("Facturama rechazó los certificados:", resultData);
        return new Response(JSON.stringify({ 
          error: "Error en Facturama", 
          details: resultData.Message || resultData.message || "Error desconocido en la validación del SAT"
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.log("El CSD ya estaba registrado en Facturama. Continuando...");
    }

    // 5. Guardar en Base de Datos Supabase
    console.log("Guardando emisor en tabla billing_issuers...");
    const { data: issuer, error: dbError } = await supabase
      .from("billing_issuers")
      .insert({
        user_id: user.id,
        rfc: rfc.toUpperCase(),
        razon_social: razon_social.toUpperCase(),
        regimen_fiscal: regimen_fiscal,
        codigo_postal: codigo_postal,
        sucursal_nombre: sucursal_nombre || null,
        is_csd_loaded: true
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error guardando en BD:", dbError.message);
      return new Response(JSON.stringify({ error: "Cargado en Facturama pero falló el guardado local.", details: dbError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log("--- PROCESO COMPLETADO EXITOSAMENTE ---");
    return new Response(JSON.stringify({ success: true, issuer }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("CRASH EN FUNCIÓN:", error.message);
    return new Response(JSON.stringify({ error: "Error interno del servidor (Función Edge)", message: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
