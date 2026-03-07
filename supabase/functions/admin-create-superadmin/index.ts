// Edge Function: admin-create-superadmin
// Permite a Super Admins crear nuevas cuentas de SuperAdmin
// sin crear perfiles de clientes y sin alterar su sesión actual

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EXPECTED_PIN = '2026SOP'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, master_pin } = await req.json()

    // Validar PIN Maestro
    if (!master_pin || master_pin !== EXPECTED_PIN) {
      console.log('Error: PIN Maestro incorrecto');
      return new Response(
        JSON.stringify({ success: false, error: 'PIN Maestro incorrecto' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (!email || !password) {
      console.log('Error: Faltan email o password');
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan parámetros requeridos: email y password' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (password.length < 6) {
      console.log('Error: Password muy corto');
      return new Response(
        JSON.stringify({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Obtener token del usuario que hace la petición
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.log('Error: No Authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Crear cliente con token del usuario (caller) para verificar su rol
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user: caller }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !caller) {
      console.log('Error: Usuario no autenticado (token inválido o expirado)', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Para más seguridad, leemos con service key sabiendo que el caller autenticado es dueño del token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { data: superAdminRecord, error: saError } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('email', caller.email)
      .single()

    if (saError || !superAdminRecord) {
      console.log('Error: Caller no está en la tabla super_admins', saError);
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere estar registrado como super_admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 1. Insertar email en la tabla super_admins primero.
    const { error: insertError } = await supabaseAdmin
      .from('super_admins')
      .insert([{ email: email.toLowerCase() }])

    if (insertError && insertError.code !== '23505') {
      console.error('Error insertando super_admin:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: 'Error interno guardando administrador: ' + insertError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. Crear usuario real en Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true
    })

    if (createError) {
      console.error('Error creando usuario de auth:', createError)
      
      // Rollback: delete from super_admins if auth creation failed
      await supabaseAdmin.from('super_admins').delete().eq('email', email.toLowerCase())

      return new Response(
        JSON.stringify({ success: false, error: 'Error Auth de Supabase: ' + createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 3. Responder con éxito
    return new Response(
      JSON.stringify({ success: true, message: 'Administrador creado con éxito' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Error interno del servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
