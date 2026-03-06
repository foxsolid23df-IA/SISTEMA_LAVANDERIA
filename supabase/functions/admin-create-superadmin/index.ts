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
      return new Response(
        JSON.stringify({ success: false, error: 'PIN Maestro incorrecto' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Faltan parámetros requeridos: email y password' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Obtener token del usuario que hace la petición
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
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
      return new Response(
        JSON.stringify({ success: false, error: 'Usuario no autenticado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profileError || profile?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requiere rol super_admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Cliente Admin para hacer bypass a las políticas (inserción y createUser)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Insertar email en la tabla super_admins primero.
    // Con esto evitamos que el Trigger handle_new_user de Supabase le asigne un "Perfil de Tienda"
    const { error: insertError } = await supabaseAdmin
      .from('super_admins')
      .insert([{ email: email.toLowerCase() }])

    if (insertError) {
      // Ignoramos el unique violation si por error ya estaba anotado,
      // pero esto también evita la creación sin querer de un perfil duplicado si se reintenta
      if (insertError.code !== '23505') { 
        console.error('Error insertando super_admin:', insertError)
        return new Response(
          JSON.stringify({ success: false, error: 'Error interno guardando administrador: ' + insertError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }
    }

    // 2. Crear usuario real en Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true // Saltarse el email de confirmación
    })

    if (createError) {
      console.error('Error creando usuario de auth:', createError)
      return new Response(
        JSON.stringify({ success: false, error: createError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // 3. Responder con éxito
    return new Response(
      JSON.stringify({ success: true, message: 'Administrador creado con éxito' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Error interno del servidor' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
