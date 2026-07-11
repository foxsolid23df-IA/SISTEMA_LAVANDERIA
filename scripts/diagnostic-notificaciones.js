require('dotenv').config({ path: './frontend/.env' });
const { createClient } = require('@supabase/supabase-js');

// ── parsear argumentos ──────────────────────────────────────────────
const args = require('process').argv.slice(2);
let input = null;       // email, user-id, o folio directo
let orderFolio = null;
let serviceKey = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--user-id' || args[i] === '-u') {
    input = args[++i];
  } else if (args[i] === '--email' || args[i] === '-e') {
    input = args[++i];
  } else if (args[i] === '--folio' || args[i] === '-f') {
    orderFolio = args[++i];
  } else if (args[i] === '--service-key' || args[i] === '-k') {
    serviceKey = args[++i];
  } else if (!args[i].startsWith('--')) {
    if (!input) input = args[i];
    else if (!orderFolio) orderFolio = args[i];
  }
}

if (!input) {
  console.error('Uso: node scripts/diagnostic-notificaciones.js <userId|email> [--folio 011161] [--service-key <key>]');
  console.error('');
  console.error('Opciones:');
  console.error('  --user-id, -u <uuid>   ID del usuario (recomendado, evita RLS)');
  console.error('  --email,  -e <email>   Email del usuario');
  console.error('  --folio,  -f <folio>   Folio de la orden a revisar');
  console.error('  --service-key, -k <k>  Service role key para bypass RLS');
  console.error('');
  console.error('Ejemplos:');
  console.error('  node scripts/diagnostic-notificaciones.js abc123-def456 -f 011161 -k eyJ...');
  console.error('  node scripts/diagnostic-notificaciones.js foxsolid22df@gmail.com -f 011161 -k eyJ...');
  process.exit(1);
}

const isEmail = input.includes('@');
const isUuid  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);

// ── cliente supabase ────────────────────────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || null;

if (!supabaseUrl || !supabaseAnon) {
  console.error('Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en frontend/.env');
  process.exit(1);
}

// Usar service key si esta disponible
const clientKey = supabaseServiceKey || supabaseAnon;
const supabase = createClient(supabaseUrl, clientKey);

if (!supabaseServiceKey) {
  console.log('AVISO: Usando anon key (sin service key). Algunas consultas pueden fallar por RLS.');
  console.log('       Para diagnostico completo, agrega --service-key <key>\n');
}

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const WARN = '\x1b[33mWARN\x1b[0m';

// ── helpers ─────────────────────────────────────────────────────────
async function check(step, label, fn) {
  process.stdout.write(`[${String(step).padStart(2, '0')}] ${label} ... `);
  try {
    const result = await fn();
    if (result === true || result?.pass) {
      console.log(PASS + (result?.detail ? ` (${result.detail})` : ''));
      return { ok: true, ...(typeof result === 'object' ? result : {}) };
    } else {
      console.log(FAIL);
      console.log(`     -> ${result?.reason || 'Fallo desconocido'}`);
      return { ok: false, ...(result || {}) };
    }
  } catch (err) {
    console.log(FAIL);
    console.log(`     -> Error: ${err.message}`);
    return { ok: false, reason: err.message };
  }
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
  console.log('\n==================== DIAGNOSTICO DE NOTIFICACIONES LISTO ====================');
  console.log(`Entrada: ${input} (${isEmail ? 'email' : isUuid ? 'UUID' : 'otro'})`);
  if (orderFolio) console.log(`Folio orden: #${orderFolio}`);
  console.log(`Cliente:   ${supabaseServiceKey ? 'Service Role (RLS bypass)' : 'Anon Key (RLS activo)'}`);
  console.log('==============================================================================\n');

  const results = {};

  // ── 1. Resolver user_id ──────────────────────────────────────────
  let userId = null;

  if (isUuid) {
    userId = input;
    results.user = await check(1, 'Verificar perfil por UUID', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, store_name, email, whatsapp_gateway_type, whatsapp_session_token, whatsapp_chatbot_enabled')
        .eq('id', userId)
        .maybeSingle();
      if (error) return { reason: error.message };
      if (!data) return { reason: `No se encontro perfil con ID "${userId}". Verifica el UUID.` };
      results.profileData = data;
      return { pass: true, detail: `${data.email || '(sin email)'} | ${data.store_name || '(sin nombre)'}` };
    });
  } else if (isEmail) {
    results.user = await check(1, 'Buscar usuario por email', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, store_name, email, whatsapp_gateway_type, whatsapp_session_token, whatsapp_chatbot_enabled')
        .eq('email', input)
        .maybeSingle();
      if (error) return { reason: `Error DB: ${error.message}. Si es RLS, usa --user-id en vez de --email.` };
      if (!data) return {
        reason: `No se encontro perfil con email "${input}".\n` +
          `       Posibles causas:\n` +
          `       - El email no coincide con ningun registro en public.profiles\n` +
          `       - RLS bloquea la lectura (usa --user-id <UUID> en su lugar)\n` +
          `       - La cuenta de prueba usa otro email\n` +
          `       - Prueba con --service-key para bypass RLS`
      };
      userId = data.id;
      results.profileData = data;
      return { pass: true, detail: `ID: ${data.id} | ${data.store_name || '(sin nombre)'}` };
    });
  } else {
    // Intentar como user_id sin formato UUID (algunos IDs pueden no tener guiones)
    userId = input;
    results.user = await check(1, 'Verificar perfil por ID', async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, store_name, email, whatsapp_gateway_type, whatsapp_session_token, whatsapp_chatbot_enabled')
        .eq('id', userId)
        .maybeSingle();
      if (error) return { reason: error.message };
      if (!data) return { reason: `No se encontro perfil con ID "${userId}"` };
      results.profileData = data;
      return { pass: true, detail: `${data.email || '(sin email)'} | ${data.store_name || '(sin nombre)'}` };
    });
  }

  if (!results.user.ok) {
    // Si fallo, intentar listar todos los perfiles (solo funciona con service key)
    if (supabaseServiceKey) {
      console.log('\nIntentando listar perfiles disponibles con service key...');
      const { data: allProfiles } = await supabase.from('profiles').select('id, email, store_name').limit(20);
      if (allProfiles && allProfiles.length > 0) {
        console.log(`Se encontraron ${allProfiles.length} perfiles:`);
        allProfiles.forEach(p => console.log(`  ${p.id} | ${p.email || '(sin email)'} | ${p.store_name || '(sin nombre)'}`));
      }
    }
    printResumen(results);
    return;
  }

  userId = userId || results.profileData?.id;
  results.userId = userId;

  // ── 2. Toggle ─────────────────────────────────────────────────────
  results.toggle = await check(2, 'Toggle "ready_notifications_enabled"', async () => {
    const { data, error } = await supabase
      .from('business_settings')
      .select('ready_notifications_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { reason: error.message };
    if (!data) return { reason: 'No hay registro en business_settings para esta tienda' };
    if (!data.ready_notifications_enabled) return {
      reason: 'Toggle DESACTIVADO. Ir a Admin Panel > Notificaciones Listo y activarlo.'
    };
    return { pass: true, detail: 'Activado' };
  });

  // ── 3. Gateway ────────────────────────────────────────────────────
  results.gateway = await check(3, 'Gateway WhatsApp configurado', async () => {
    const p = results.profileData;
    const type = p.whatsapp_gateway_type || 'central_saas';
    if (type === 'qr_linked') {
      if (!p.whatsapp_session_token) return {
        reason: 'Gateway "qr_linked" requiere whatsapp_session_token. Configurar en Delivery Dashboard > Mensajeria.'
      };
      return { pass: true, detail: 'qr_linked (token presente)' };
    }
    if (type === 'central_saas') return { pass: true, detail: 'central_saas (Twilio env vars required)' };
    if (type === 'sms_only') return { pass: true, detail: 'sms_only (Twilio SMS)' };
    return { pass: true, detail: type };
  });

  // ── 4. Orden + Cliente con telefono ───────────────────────────────
  let orderId = null;
  results.orderCustomer = await check(4, 'Orden encontrada + cliente con telefono', async () => {
    let query = supabase.from('orders')
      .select('id, folio, status, customer_id, ready_reminder_stage, ready_at, last_ready_reminder_at')
      .eq('user_id', userId);

    if (orderFolio) {
      const numericFolio = parseInt(orderFolio, 10);
      query = query.eq('folio', isNaN(numericFolio) ? orderFolio : numericFolio);
    } else {
      query = query.eq('status', 'ready').order('updated_at', { ascending: false }).limit(10);
    }

    const { data: orders, error } = await query;
    if (error) return { reason: error.message };
    if (!orders || orders.length === 0) return {
      reason: orderFolio
        ? `No se encontro orden #${orderFolio} para esta tienda. Verifica el folio.`
        : 'No hay ordenes en estado "ready" para esta tienda.'
    };

    const order = orders[0];
    orderId = order.id;
    results.orderData = order;

    if (!order.customer_id) return {
      reason: `Orden #${order.folio || order.id}: customer_id es NULL (no tiene cliente asignado)`
    };

    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('name, phone')
      .eq('id', order.customer_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (custErr) return { reason: custErr.message };
    if (!customer) return { reason: `Cliente ID ${order.customer_id} no encontrado en customers` };
    if (!customer.phone) return {
      reason: `Cliente "${customer.name}" NO tiene telefono. Editar ficha del cliente en el sistema.`
    };

    results.customerPhone = customer.phone;
    return {
      pass: true,
      detail: `Orden #${order.folio || order.id} (status: ${order.status}) | ${customer.name} | ${customer.phone}`
    };
  });

  // ── 5. Stage ──────────────────────────────────────────────────────
  if (orderId) {
    results.stage = await check(5, 'Estado de recordatorio (ready_reminder_stage)', async () => {
      const o = results.orderData;
      const stage = o.ready_reminder_stage;
      if (stage === 'first' || stage === 'second' || stage === 'third') {
        const readyAt = o.ready_at ? new Date(o.ready_at).toLocaleString() : '?';
        const lastAt  = o.last_ready_reminder_at ? new Date(o.last_ready_reminder_at).toLocaleString() : 'nunca';
        return {
          reason: `Stage actual: "${stage}" (ready_at: ${readyAt}, last reminder: ${lastAt}).\n` +
            `       El mensaje inmediato ya fue enviado. Solo el cron ejecutara el siguiente recordatorio.`
        };
      }
      return { pass: true, detail: 'null (listo para enviar notificacion inmediata)' };
    });
  } else {
    results.stage = { ok: false, reason: 'Sin orden para verificar' };
  }

  // ── 6. Logs ───────────────────────────────────────────────────────
  results.logs = await check(6, 'Logs de notificaciones recientes', async () => {
    const { data, error } = await supabase
      .from('delivery_notification_logs')
      .select('event_type, success, gateway, error, recipient_phone, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) return { reason: error.message };
    if (!data || data.length === 0) return {
      pass: true,
      detail: 'Sin logs (ningun intento de notificacion registrado)'
    };
    const fails = data.filter(l => !l.success);
    const oks   = data.filter(l => l.success);
    const details = data.map(l =>
      `[${l.success ? 'OK' : 'FAIL'}] ${l.event_type} | ${l.gateway} | ${l.recipient_phone || '?'} | ${new Date(l.created_at).toLocaleString()}`
    );
    console.log('');
    details.forEach(d => console.log(`     ${d}`));
    return {
      pass: fails.length === 0,
      reason: fails.length > 0 ? `${fails.length} fallo(s) encontrado(s)` : undefined,
      detail: ``
    };
  });

  // ── 7. Edge Function status ───────────────────────────────────────
  const { execSync } = require('child_process');
  results.edgeFn = await check(7, 'Edge Function "send-ready-reminders" desplegada', async () => {
    try {
      const output = execSync('npx supabase functions list', { encoding: 'utf8', timeout: 15000 });
      if (output.includes('send-ready-reminders')) {
        const line = output.split('\n').find(l => l.includes('send-ready-reminders'));
        return { pass: true, detail: line ? line.trim().replace(/\s+/g, ' ') : 'desplegada' };
      }
      return { reason: 'NO desplegada. Ejecuta: npx supabase functions deploy send-ready-reminders' };
    } catch (e) {
      return { reason: `No se pudo verificar (${e.message}). Verifica manualmente.` };
    }
  });

  // ── Resumen ───────────────────────────────────────────────────────
  printResumen(results);
}

function printResumen(results) {
  const checks = [
    results.user, results.toggle, results.gateway,
    results.orderCustomer, results.stage, results.logs, results.edgeFn
  ];
  const passed = checks.filter(c => c?.ok).length;
  const failed = checks.filter(c => !c?.ok).length;
  const total  = checks.filter(c => c !== undefined).length;

  console.log('\n==============================================================================');
  console.log('RESUMEN');
  console.log('==============================================================================');
  console.log(`  ${passed}/${total} checks OK  |  ${failed} fallaron`);

  if (failed === 0) {
    console.log('\n  Todo en orden. Al marcar una orden como "Listo" se enviara WhatsApp automaticamente.');
    console.log('  Recuerda que los recordatorios de 24h y 72h requieren un cron job.');
  } else {
    const fixes = [];
    if (!results.edgeFn?.ok) fixes.push('Desplegar: npx supabase functions deploy send-ready-reminders');
    if (!results.toggle?.ok) fixes.push('Activar toggle en: Admin Panel > Notificaciones Listo');
    if (!results.gateway?.ok) fixes.push('Configurar gateway en: Delivery Dashboard > Mensajeria');
    if (!results.orderCustomer?.ok) fixes.push('Registrar telefono en la ficha del cliente');
    if (fixes.length > 0) {
      console.log('\n  ACCIONES:');
      fixes.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
    }
  }
  console.log('==============================================================================\n');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
