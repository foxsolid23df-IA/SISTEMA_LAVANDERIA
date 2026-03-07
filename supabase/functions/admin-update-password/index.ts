// Edge Function: admin-update-password
// Permite a Super Admins cambiar contraseñas de usuarios directamente
// usando el Admin API de Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EXPECTED_PIN = '2026SOP'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Obtener datos del body
    const { user_id, new_password, master_pin } = await req.json()

    // Validar PIN Maestro
    if (!master_pin || master_pin !== EXPECTED_PIN) {
      return new Response(
        JSON.stringify({ success: false, error: 'PIN Maestro incorrecto' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Validar parámetros
    if (!user_id || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan parámetros requeridos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Obtener token del usuario que hace la petición
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Crear cliente con token del usuario para verificar su rol
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Verificar que el caller es super_admin
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !caller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Usar Admin API para cambiar la contraseña y verificar rol
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar rol del caller en la tabla super_admins
    const { data: superAdminRecord, error: saError } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('email', caller.email)
      .single()

    if (saError || !superAdminRecord) {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere estar registrado como super_admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Contraseña actualizada exitosamente' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Error interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
