import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, masterPin } = await req.json()

    // El PIN Maestro para soporte técnico
    const MASTER_PIN = "2026SOP"

    if (masterPin !== MASTER_PIN) {
      return new Response(
        JSON.stringify({ error: "PIN Maestro incorrecto" }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
          status: 401 
        }
      )
    }

    if (action === 'health') {
      // Intentar conectar con la DB para verificar salud real
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      const { error } = await supabase.from('store_settings').select('count', { count: 'exact', head: true })
      
      return new Response(
        JSON.stringify({ 
          status: 'Operational', 
          database: error ? 'Error' : 'Connected',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: "Acción no reconocida" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
