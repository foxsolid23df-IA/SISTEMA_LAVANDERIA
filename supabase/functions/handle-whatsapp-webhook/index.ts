import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_VERSION = "chatbot-v4-20260709-phase3-ai";
const TRACKING_BASE_URL = "https://sistema-lavanderia-nu.vercel.app/#/tracking";

// ── OpenRouter AI Configuration ────────────────────────────────
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemma-2-9b-it:free";
const AI_TIMEOUT_MS = 15000;
const AI_MAX_REQUESTS_PER_HOUR = 10;

// ── Message Deduplication (prevent Evolution API retries) ──────
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 30000; // 30 seconds window

function isDuplicateMessage(messageKey: string): boolean {
  const now = Date.now();
  // Clean old entries
  for (const [key, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(key);
  }
  if (processedMessages.has(messageKey)) return true;
  processedMessages.set(messageKey, now);
  return false;
}

// ── AI Rate Limiting (in-memory per phone) ─────────────────────
const aiRequestCounts = new Map<string, { count: number; resetAt: number }>();

function checkAIRateLimit(phone: string): boolean {
  const now = Date.now();
  const record = aiRequestCounts.get(phone);
  if (!record || now > record.resetAt) {
    aiRequestCounts.set(phone, { count: 1, resetAt: now + 3600000 });
    return true;
  }
  if (record.count >= AI_MAX_REQUESTS_PER_HOUR) return false;
  record.count++;
  return true;
}

// ── OpenRouter Chat Function ───────────────────────────────────
async function openRouterChat(
  systemPrompt: string,
  userMessage: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://sistema-lavanderia-nu.vercel.app",
        "X-Title": "Gabino Lavandería Chatbot",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[AI] OpenRouter error: ${res.status}`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    
    // Filtrar respuestas basura del modelo (safety filters, etc.)
    const garbage = /^(user safety|safety|safe|unsafe|error|sorry|i can't|i cannot|as an ai|i'm unable)/i;
    const cleanContent = content.trim();
    if (garbage.test(cleanContent) || cleanContent.length < 10) {
      console.log(`[AI] Filtered garbage response: "${cleanContent.substring(0, 50)}"`);
      return null;
    }
    
    return cleanContent;
  } catch (e: any) {
    console.error("[AI] OpenRouter call failed:", e.message);
    return null;
  }
}

// ── Build AI System Prompt with Store Context ──────────────────
function buildAISystemPrompt(
  storeName: string,
  priceList: string,
  customerName: string,
  currentState: string,
  knowledgeBase: string = "",
  storeInfo: string = "",
  zonesList: string = ""
): string {
  return `Eres un asistente virtual de *${storeName}*, una lavandería con servicio a domicilio.

${storeInfo ? `INFORMACIÓN DEL NEGOCIO:\n${storeInfo}\n` : ""}
${zonesList ? `ZONAS DE COBERTURA:\n${zonesList}\n` : ""}
SERVICIOS Y PRECIOS:
${priceList || "No hay lista de precios disponible"}

${knowledgeBase ? `INFORMACIÓN ADICIONAL (FAQ):\n${knowledgeBase}\n` : ""}
EL CLIENTE SE LLAMA: ${customerName || "Cliente"}
ESTADO ACTUAL: ${currentState}

REGLAS ESTRICTAS:
1. Res SOLO sobre temas de la lavandería (servicios, precios, horarios, recogida, pedidos, pagos, ubicación)
2. NUNCA inventes precios, servicios o información que no esté en esta lista
3. NUNCA crees pedidos directamente, solo sugiere acciones (escribir "1", enviar dirección, etc.)
4. Res SIEMPRE en español, de forma amigable y breve (máximo 2-3 oraciones)
5. Si el usuario quiere hacer algo, redirígete al menú diciéndole qué escribir
6. Si no sabes algo, di "No tengo esa información" y sugiere hablar con un agente (escribir "4")
7. Para quejas o problemas, sugiere hablar con atención al cliente (escribir "4")

COMO RESPONDER A CADA TIPO DE PREGUNTA:
- Horarios → Responde con horario y ofrece iniciar recogida
- Precios → Usa la lista de precios provided
- Servicios → Describe los servicios disponibles
- Ubicación → Da dirección y menciona servicio a domicilio
- Pagos → Explica métodos de pago aceptados
- Tiempo de entrega → Da estimado (24-48h ordinario, 4-6h express)
- Cómo funciona → Explica el proceso paso a paso
- Quejas/problemas → Disculpa y sugiere agente (escribe "4")
- Preguntas no relacionadas → Di que solo puedes ayudar con temas de la lavandería

FORMATO DE RESPUESTA:
Responde SOLO con el mensaje para el usuario. NO incluyas metadata ni JSON.`;
}

// ── Fetch Knowledge Base from DB ───────────────────────────────
async function fetchKnowledgeBase(supabaseClient: any, storeId: string): Promise<string> {
  try {
    const { data, error } = await supabaseClient
      .from("ai_knowledge_base")
      .select("category, question, answer")
      .eq("store_id", storeId)
      .eq("is_active", true);

    if (error || !data || data.length === 0) return "";

    return data.map((item: any) => `• ${item.question} → ${item.answer}`).join("\n");
  } catch (e) {
    console.error("[AI] Error fetching knowledge base:", e);
    return "";
  }
}

// ── Match Knowledge Base directly (sin IA) ─────────────────────
async function matchKnowledgeBaseDirect(supabaseClient: any, storeId: string, userMessage: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseClient
      .from("ai_knowledge_base")
      .select("question, answer")
      .eq("store_id", storeId)
      .eq("is_active", true);

    if (error || !data || data.length === 0) return null;

    const normalized = normalizeText(userMessage);
    
    // Buscar coincidencia por palabras clave
    for (const item of data) {
      const qWords = normalizeText(item.question).split(/\s+/).filter((w: string) => w.length > 3);
      const matchCount = qWords.filter((w: string) => normalized.includes(w)).length;
      const matchRatio = matchCount / qWords.length;
      
      if (matchRatio >= 0.5) {
        console.log(`[KB Direct] Match found: "${item.question}" (ratio: ${matchRatio.toFixed(2)})`);
        return item.answer;
      }
    }
    
    return null;
  } catch (e) {
    console.error("[KB Direct] Error:", e);
    return null;
  }
}

// ── Fetch Store Info for AI ────────────────────────────────────
async function fetchStoreInfoForAI(supabaseClient: any, storeId: string): Promise<string> {
  try {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("store_name, store_phone, store_address, store_email")
      .eq("id", storeId)
      .single();

    if (!profile) return "";

    const lines: string[] = [];
    if (profile.store_name) lines.push(`Nombre: ${profile.store_name}`);
    if (profile.store_phone) lines.push(`Teléfono: ${profile.store_phone}`);
    if (profile.store_address) lines.push(`Dirección: ${profile.store_address}`);
    if (profile.store_email) lines.push(`Email: ${profile.store_email}`);
    lines.push(`Horario: Lunes a Sábado, 8am a 6pm. Domingos cerrados`);

    return lines.join("\n");
  } catch (e) {
    console.error("[AI] Error fetching store info:", e);
    return "";
  }
}

// ── Fetch Zones for AI ─────────────────────────────────────────
async function fetchZonesForAI(supabaseClient: any, storeId: string): Promise<string> {
  try {
    const { data: zones } = await supabaseClient
      .from("pickup_zones")
      .select("zone_name, keywords")
      .eq("user_id", storeId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!zones || zones.length === 0) return "";

    return zones.map((z: any) => `- ${z.zone_name}`).join("\n");
  } catch (e) {
    console.error("[AI] Error fetching zones:", e);
    return "";
  }
}

// ── Parse AI Response for Intent Detection ─────────────────────
function parseAIResponse(response: string): { type: "intent" | "text"; data: string } {
  const lower = response.toLowerCase();

  // Detect common intents from AI response
  if (lower.includes("escribe *1*") || lower.includes("solicitar recogida") || lower.includes("agendar recogida")) {
    return { type: "intent", data: "pickup" };
  }
  if (lower.includes("escribe *2*") || lower.includes("ver lista de precios") || lower.includes("consultar precios")) {
    return { type: "intent", data: "prices" };
  }
  if (lower.includes("escribe *3*") || lower.includes("consultar pedido") || lower.includes("seguir pedido")) {
    return { type: "intent", data: "tracking" };
  }
  if (lower.includes("escribe *4*") || lower.includes("atención al cliente") || lower.includes("hablar con")) {
    return { type: "intent", data: "agent" };
  }

  return { type: "text", data: response };
}

// ── Helpers de mensajes ──────────────────────────────────────────

function getLocationMessage(message: any) {
  if (!message) return null;
  return (
    message.locationMessage ||
    message.liveLocationMessage ||
    getLocationMessage(message.ephemeralMessage?.message) ||
    getLocationMessage(message.viewOnceMessage?.message) ||
    getLocationMessage(message.viewOnceMessageV2?.message) ||
    null
  );
}

function buildAddressFromLocation(location: any) {
  if (!location) return null;
  const latitude = Number(location.degreesLatitude ?? location.latitude);
  const longitude = Number(location.degreesLongitude ?? location.longitude);
  const label = location.address || location.name || "Ubicacion enviada por WhatsApp";
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return `${label} - https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  return label || null;
}

function readTextValue(value: any) {
  if (typeof value === "string") return value.trim();
  if (typeof value?.text === "string") return value.text.trim();
  if (typeof value?.body === "string") return value.body.trim();
  return "";
}

function getIncomingText(message: any): string {
  if (!message) return "";
  const nestedText =
    getIncomingText(message.ephemeralMessage?.message) ||
    getIncomingText(message.viewOnceMessage?.message) ||
    getIncomingText(message.viewOnceMessageV2?.message);
  if (nestedText) return nestedText;

  const candidates = [
    message.conversation,
    message.extendedTextMessage?.text,
    message.imageMessage?.caption,
    message.videoMessage?.caption,
    message.documentMessage?.caption,
    message.textMessage?.text,
    message.text,
    message.buttonsResponseMessage?.selectedDisplayText,
    message.buttonsResponseMessage?.selectedButtonId,
    message.listResponseMessage?.title,
    message.listResponseMessage?.singleSelectReply?.selectedRowId,
  ];

  for (const candidate of candidates) {
    const text = readTextValue(candidate);
    if (text) return text;
  }
  return "";
}

// ── Helpers de teléfono ──────────────────────────────────────────

function getPhoneCandidates(rawPhone: string) {
  const digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return [];
  if (digits.length === 10) return [`521${digits}`, `52${digits}`, digits];
  if (digits.length === 12 && digits.startsWith("52")) return [`521${digits.slice(2)}`, digits, digits.slice(2)];
  if (digits.length === 13 && digits.startsWith("521")) return [digits, `52${digits.slice(3)}`, digits.slice(3)];
  return [digits];
}

function looksWhatsappNumberAvailable(entry: any) {
  return entry?.exists === true || entry?.numberExists === true || entry?.isWhatsapp === true || entry?.jid || entry?.status === "exists";
}

async function resolveEvolutionPhone(baseUrl: string, instance: string, apikey: string | null, candidates: string[]) {
  if (candidates.length <= 1) return candidates[0] || "";
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) headers["apikey"] = apikey;
    const res = await fetch(`${baseUrl}/chat/whatsappNumbers/${instance}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ numbers: candidates }),
    });
    if (!res.ok) return candidates[0];
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data?.numbers || data?.data || [];
    const match = rows.find((row: any) => looksWhatsappNumberAvailable(row));
    return match?.number || match?.remoteJid?.split("@")?.[0] || match?.jid?.split("@")?.[0] || candidates[0];
  } catch {
    return candidates[0];
  }
}

async function sendWhatsAppText(baseUrl: string, instance: string, apikey: string | null, number: string, text: string) {
  try {
    const phoneCandidates = getPhoneCandidates(number);
    if (phoneCandidates.length === 0) return;
    const phone = await resolveEvolutionPhone(baseUrl, instance, apikey, phoneCandidates);
    const url = `${baseUrl}/message/sendText/${instance}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) headers["apikey"] = apikey;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ number: phone, text, delay: 1200 }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Webhook] Error enviando mensaje: ${res.status} - ${errorText}`);
    } else {
      console.log(`[Webhook] Mensaje enviado a ${phone}`);
    }
  } catch (e) {
    console.error("[Webhook] Error de red enviando mensaje:", e);
  }
}

// ── WhatsApp Buttons (Evolution API v2) ──────────────────────────

async function sendWhatsAppButtons(
  baseUrl: string,
  instance: string,
  apikey: string | null,
  number: string,
  text: string,
  buttons: { id: string; text: string }[]
) {
  try {
    const phoneCandidates = getPhoneCandidates(number);
    if (phoneCandidates.length === 0) return;
    const phone = await resolveEvolutionPhone(baseUrl, instance, apikey, phoneCandidates);
    const url = `${baseUrl}/message/sendButtons/${instance}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) headers["apikey"] = apikey;

    const body = {
      number: phone,
      title: "",
      description: text,
      buttons: buttons.map((b) => ({
        type: "reply",
        reply: { id: b.id, title: b.text },
      })),
      delay: 1200,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Fallback: send as text if buttons fail (e.g., non-business account)
      console.warn(`[Webhook] Buttons failed (${res.status}), falling back to text`);
      await sendWhatsAppText(baseUrl, instance, apikey, number, text);
    } else {
      console.log(`[Webhook] Buttons sent to ${phone}`);
    }
  } catch (e) {
    console.error("[Webhook] Error sending buttons, falling back to text:", e);
    await sendWhatsAppText(baseUrl, instance, apikey, number, text);
  }
}

// ── WhatsApp List Menu (Evolution API v2) ────────────────────────

async function sendWhatsAppListMenu(
  baseUrl: string,
  instance: string,
  apikey: string | null,
  number: string,
  title: string,
  description: string,
  buttonText: string,
  sections: { title: string; rows: { title: string; description?: string; rowId: string }[] }[]
) {
  try {
    const phoneCandidates = getPhoneCandidates(number);
    if (phoneCandidates.length === 0) return;
    const phone = await resolveEvolutionPhone(baseUrl, instance, apikey, phoneCandidates);
    const url = `${baseUrl}/message/sendList/${instance}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) headers["apikey"] = apikey;

    const body = {
      number: phone,
      title,
      description,
      buttonText,
      sections,
      delay: 1200,
    };

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.warn(`[Webhook] List menu failed (${res.status}), falling back to text`);
      await sendWhatsAppText(baseUrl, instance, apikey, number, `${title}\n\n${description}`);
    } else {
      console.log(`[Webhook] List menu sent to ${phone}`);
    }
  } catch (e) {
    console.error("[Webhook] Error sending list menu, falling back to text:", e);
    await sendWhatsAppText(baseUrl, instance, apikey, number, `${title}\n\n${description}`);
  }
}

async function sendWhatsAppImage(baseUrl: string, instance: string, apikey: string | null, number: string, imageUrl: string, caption = "") {
  try {
    const phoneCandidates = getPhoneCandidates(number);
    if (phoneCandidates.length === 0) return;
    const phone = await resolveEvolutionPhone(baseUrl, instance, apikey, phoneCandidates);
    const url = `${baseUrl}/message/sendMedia/${instance}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apikey) headers["apikey"] = apikey;

    // Evolution API v2: mediatype/media/caption van al nivel RAÍZ de sendMedia
    const body = {
      number: phone,
      mediatype: "image",
      media: imageUrl,
      caption: caption,
      delay: 1200,
    };

    console.log(`[Webhook] Enviando imagen a ${phone} via ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const resText = await res.text();
    if (!res.ok) {
      console.error(`[Webhook] Error enviando imagen: ${res.status} - ${resText}`);
    } else {
      console.log(`[Webhook] Imagen enviada exitosamente a ${phone}`);
    }
  } catch (e) {
    console.error("[Webhook] Error de red enviando imagen:", e);
  }
}

// ── Helpers de detección de dirección ────────────────────────────

function normalizeText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function looksLikeAddress(text: string) {
  const normalized = normalizeText(text);
  if (normalized.length < 6) return false;

  // Negative patterns: NOT addresses
  const negativePatterns = /^(hola|buenos dias|buenas tardes|buenas noches|info|informacion|precio|precios|menu|men[uú]|opciones|ayuda|agent|agente|no sé|no se|que lleva|que servicios|lista|gracias|ok|si|no|acepto|rechazo|cancelo|pedido|recoger|recogida|lavado|planchado|entrega|pago|cobro|factura|servicio|camisa|pantalon|vestido|falda|saco|abrigo|cobia|sabana|toalla|cortina|edredon|cobertor|chamarra|sueter|playera|blusa|jeans|shorts|boxers|calcetines|ropa|prenda|articulo|artículos|que horas|horario|horarios|abren|cierran|tardan|servicios|ofrecen)$/i;
  if (negativePatterns.test(normalized)) return false;

  // Explicit address patterns
  if (/^(mi\s+)?(direccion|direcci[oó]n|domicilio|ubicacion|ubicaci[oó]n|address)\s*(es|:|-)?\s+.+/i.test(normalized)) return true;
  if (/^(te\s+)?(mando|envio|envío|paso|mando)\s+(mi\s+)?(direccion|direcci[oó]n|ubicacion|ubicaci[oó]n)/i.test(normalized)) return true;

  // Location message patterns
  if (/^(aqui|aqu[ií]|par[aá]|llegue|llegar|mapa|ubicaci[oó]n| google | maps )/i.test(normalized)) return true;

  // Strong address indicators (street patterns)
  const streetPatterns = /(calle|av\.?|avenida|blvd|boulevard|col\.?|colonia|fracc\.?|fraccionamiento|numero|num\.?|#|n[uú]mero|cp|codigo postal|entre calles|esquina|privada|priv\.?|domicilio|interior|inter\.?|exterior|ext\.?|piso|departamento|depto\.?|flat)/i;
  if (streetPatterns.test(normalized)) return true;

  // Numbers with common address context
  if (/\d+\s*(#|num|no\.?|n[.]|-ext|int)/i.test(normalized)) return true;

  // Colonias commonly known (improve detection)
  if (/(colonia|col\.?|fraccionamiento|fracc\.?|urbanizacion|residencial|condominio|condo\.?|ampliacion|ampl\.?)/i.test(normalized)) return true;

  // Google Maps link
  if (/google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl/i.test(normalized)) return true;

  // Long text with numbers that looks like an address (heuristic)
  if (normalized.length > 15 && /\d/.test(normalized) && /(calle|av|avenida|col|colonia|#|num)/i.test(normalized)) return true;

  return false;
}

function extractAddress(payload: any, text: string) {
  // 1. Try location message first (highest priority)
  const locationAddress = buildAddressFromLocation(getLocationMessage(payload.data?.message));
  if (locationAddress) return locationAddress;

  const cleanText = text.trim();

  // 2. Explicit patterns: "mi dirección es...", "mi domicilio es..."
  const explicitPatterns = [
    /(?:mi\s+)?(?:direcci[oó]n|domicilio|ubicacion|ubicaci[oó]n|address)\s*(?:es|:|=|-)\s+(.+)/i,
    /(?:env[ií]o|mando|paso)\s+(?:mi\s+)?(?:direcci[oó]n|ubicacion|ubicaci[oó]n)\s*:?\s*(.+)/i,
    /(?:live\s+en|vivo\s+en|estoy\s+en|soy\s+de)\s+(.+)/i,
    /(?:mi\s+casa\s+es|mi\s+hogar\s+es)\s+(.+)/i,
  ];

  for (const pattern of explicitPatterns) {
    const match = cleanText.match(pattern);
    if (match?.[1]?.trim()) {
      const addr = match[1].trim();
      if (addr.length >= 5) return addr;
    }
  }

  // 3. Google Maps links
  const mapsMatch = cleanText.match(/(https?:\/\/(?:www\.)?(?:google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)[^\s]+)/i);
  if (mapsMatch?.[1]) return mapsMatch[1];

  // 4. Heuristic: looks like an address
  if (looksLikeAddress(cleanText)) return cleanText;

  return null;
}

// ── Detección de mensajes express (recogida inmediata) ────────────

function detectExpressIntent(text: string): boolean {
  const normalized = normalizeText(text);
  return /^(express|rapido|r[aá]pido|ya|ahora|ahorita|enseguida|urgent|urgente|recoger\s+ya|vengan\s+ya|pueden\s+venir|quiero\s+recoger|necesito\s+recoger)/i.test(normalized);
}

// ── Detección de consulta de precios inline ───────────────────────

function detectPriceQuery(text: string): { item: string; qty: number } | null {
  const normalized = normalizeText(text);

  // Pattern: "cuánto cuesta una camisa" or "precio de camisas"
  const pricePatterns = [
    /(?:cu[aá]nto|cuanto|precio|costo|cuesta|vale)\s+(?:cuesta|vale|cobra|sale|costa)?\s*(?:un[ao]?\s+|unas?\s+|el\s+|la\s+|los\s+|las\s+)?(\w+(?:\s+\w+)?)\s*(?:\?|\.|,|$)/i,
    /(?:precio|costo)\s+(?:de|del|por|las?|los?|un[ao]?)\s+(\w+(?:\s+\w+)?)\s*(?:\?|\.|,|$)/i,
    /(?:cu[aá]nto|cuanto)\s+(?:cobran|cobras|vale|cuesta)\s+(?:por\s+)?(\w+(?:\s+\w+)?)\s*(?:\?|\.|,|$)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      const item = match[1].trim();
      // Skip common non-item words
      if (/^(es|la|el|los|las|un|una|uno|por|para|de|del|en|con|sin|que|como|donde|cuando)$/i.test(item)) continue;
      return { item, qty: 1 };
    }
  }

  // Pattern: "5 camisas cuánto" or "camisas precio"
  const qtyPattern = /^(\d+)\s+(\w+(?:\s+\w+)?)\s*(?:cu[aá]nto|precio|cuesta|vale)?/i;
  const qtyMatch = normalized.match(qtyPattern);
  if (qtyMatch?.[1] && qtyMatch?.[2]) {
    return { item: qtyMatch[2].trim(), qty: parseInt(qtyMatch[1]) };
  }

  return null;
}

// ── Template helper ──────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

// ── Chatbot: detectar opción del menú ───────────────────────────

function detectMenuOption(text: string): string | null {
  const normalized = normalizeText(text);

  // Button responses from Evolution API
  if (/^btn_pickup$/i.test(normalized)) return "pickup";
  if (/^btn_prices$/i.test(normalized)) return "prices";
  if (/^btn_tracking$/i.test(normalized)) return "tracking";
  if (/^btn_agent$/i.test(normalized)) return "agent";
  if (/^btn_express$/i.test(normalized)) return "express";

  // Text-based menu options
  if (/^1$|^1[.)\]]|^solicitar|^recogida|^pickup|^recoger/i.test(normalized)) return "pickup";
  if (/^2$|^2[.)\]]|^lista|^precios$|^price$|^costos$|^servicio$|^cuanto$/i.test(normalized)) return "prices";
  if (/^3$|^3[.)\]]|^consultar|^pedido|^tracking|^estatus|^status/i.test(normalized)) return "tracking";
  if (/^4$|^4[.)\]]|^hablar|^agente|^atencion|^ayuda|^help|^agent/i.test(normalized)) return "agent";
  if (/^5$|^5[.)\]]|^express|^rapido|^ahora|^ya|^urgente/i.test(normalized)) return "express";
  if (/^menu$|^men[uú]$|^opciones|^hola$/i.test(normalized)) return "menu";
  return null;
}

function isTrackingToken(text: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text.trim());
}

function isOrderId(text: string): boolean {
  return /^\d+$/.test(text.trim());
}

// ── Chatbot: detectar respuesta de aprobación (SI/NO) ────────────

function detectApprovalResponse(text: string): "approved" | "rejected" | null {
  const normalized = normalizeText(text);
  if (/^(si|s[ií]|ok|acepto|confirmo|de acuerdo|sale|dale|simon)$/i.test(normalized)) return "approved";
  if (/^(no|rechazo|cancelo|para nada|nel|nop)$/i.test(normalized)) return "rejected";
  return null;
}

// ── Chatbot: detectar opción "atrás" / volver al menú ────────────

function detectBackOption(text: string): boolean {
  const normalized = normalizeText(text);
  return /^(atras|atrás|volver|regresar|0|back|menu|menú|opciones)$/i.test(normalized);
}

// ── Chatbot: detectar incertidumbre del cliente ──────────────────

function detectUncertainty(text: string): boolean {
  const normalized = normalizeText(text);
  return /^(no se|no sé|no me acuerdo|no se que|que lleva|que haces|que ofrecen|opciones|help|ayuda)$/i.test(normalized);
}

// ── Chatbot: agendamiento por zonas ──────────────────────────────

async function detectZoneFromAddress(supabaseClient: any, storeId: string, addressText: string) {
  const normalizedAddress = normalizeText(addressText);
  
  const { data: zones } = await supabaseClient
    .from("pickup_zones")
    .select("*")
    .eq("user_id", storeId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (!zones || zones.length === 0) return { matched: null, allZones: [] };

  // 1. Try to find a zone by matching keywords
  for (const zone of zones) {
    if (zone.is_default) continue;
    if (zone.keywords && zone.keywords.length > 0) {
      for (const keyword of zone.keywords) {
        if (normalizedAddress.includes(normalizeText(keyword))) {
          return { matched: zone, allZones: zones };
        }
      }
    }
  }

  // 2. If no keywords match, see if they only have 1 zone total. If so, just use it.
  if (zones.length === 1) {
    return { matched: zones[0], allZones: zones };
  }

  // 3. Otherwise, return null for matched so we can ask the user
  return { matched: null, allZones: zones };
}

function getDayName(dayIndex: number): string {
  const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  return days[dayIndex] || "";
}

function formatPickupDays(days: number[]): string {
  if (!days || days.length === 0) return "";
  let msg = "";
  days.forEach((day, i) => {
    msg += `${i + 1}️⃣ ${getDayName(day)}\n`;
  });
  return msg;
}

function formatZonesList(zones: any[]): string {
  if (!zones || zones.length === 0) return "";
  let msg = "";
  zones.forEach((zone, i) => {
    msg += `${i + 1}️⃣ ${zone.zone_name}\n`;
  });
  return msg;
}

function parseZoneSelection(text: string, zones: any[]): any | null {
  const normalized = normalizeText(text);
  
  // Parse by number
  const numMatch = normalized.match(/^(\d+)/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    if (idx >= 0 && idx < zones.length) {
      return zones[idx];
    }
  }

  // Parse by exact name
  for (const zone of zones) {
    if (normalized.includes(normalizeText(zone.zone_name))) {
      return zone;
    }
  }

  return null;
}

function calculateNextDateString(dayIndex: number): { display: string, iso: string } {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() - 6);
  
  const currentJsDay = now.getUTCDay(); // 0-6 (0 is Sunday)
  const targetJsDay = dayIndex === 7 ? 0 : dayIndex;
  
  let daysToWait = targetJsDay - currentJsDay;
  if (daysToWait < 0) {
    daysToWait += 7;
  }
  
  const targetDate = new Date(now);
  targetDate.setUTCDate(now.getUTCDate() + daysToWait);
  
  const d = targetDate.getUTCDate().toString().padStart(2, '0');
  const m = (targetDate.getUTCMonth() + 1).toString().padStart(2, '0');
  const y = targetDate.getUTCFullYear();
  
  return {
    display: `${d}/${m}/${y}`,
    iso: `${y}-${m}-${d}`
  };
}

function parsePickupDaySelection(text: string, availableDays: number[]): { dayName: string, dateStr: string, isoDate: string } | null {
  const normalized = normalizeText(text);
  let selectedDayIndex: number | null = null;
  
  // Parse by number (1, 2, 3...)
  const numMatch = normalized.match(/^(\d+)/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    if (idx >= 0 && idx < availableDays.length) {
      selectedDayIndex = availableDays[idx];
    }
  }

  // Parse by exact name
  if (!selectedDayIndex) {
    const dayNames = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
    for (const day of dayNames) {
      if (normalized.includes(day)) {
        const idx = dayNames.indexOf(day) + 1;
        // Verify it's in availableDays if we have them
        if (availableDays && availableDays.length > 0 && !availableDays.includes(idx)) {
          return null; // Valid day, but not available in their zone
        }
        selectedDayIndex = idx;
        break;
      }
    }
  }

  if (selectedDayIndex !== null) {
    const dayName = getDayName(selectedDayIndex);
    const dateObj = calculateNextDateString(selectedDayIndex);
    return { dayName, dateStr: dateObj.display, isoDate: dateObj.iso };
  }

  return null;
}

// ── Chatbot: detectar selección numérica de prendas ──────────────

function parseGarmentSelection(text: string): number[] | null {
  const normalized = text.trim();
  // Match patterns like "1, 2, 3" or "1 2 3" or "1,2,3"
  const matches = normalized.match(/\d+/g);
  if (!matches || matches.length === 0) return null;
  const nums = matches.map(Number).filter((n) => n > 0 && n < 100);
  return nums.length > 0 ? nums : null;
}

// ── Chatbot: preferencia de pago ─────────────────────────────────

function detectPaymentPreference(text: string): string | null {
  const normalized = normalizeText(text);
  if (/^1$|^efectivo|^cash|^pago.*chofer|^entregar.*chofer|^al entregar$/i.test(normalized)) return "pay_at_pickup";
  if (/^2$|^cuando.*lista|^cuando.*liste|^pago.*lista|^delivery$/i.test(normalized)) return "pay_on_ready_delivery";
  if (/^3$|^sucursal|^recoger.*sucursal|^pago.*sucursal|^al recoger$/i.test(normalized)) return "pay_at_store_pickup";
  return null;
}

function paymentPreferenceLabel(pref: string): string {
  const labels: Record<string, string> = {
    pay_at_pickup: "Pagar al entregar al chofer",
    pay_on_ready_delivery: "Pagar cuando esté lista la ropa",
    pay_at_store_pickup: "Pagar al recoger en sucursal",
  };
  return labels[pref] || pref;
}

// ── Chatbot: obtener lista de precios ────────────────────────────

async function fetchPriceList(supabaseClient: any, storeId: string) {
  const { data: categories } = await supabaseClient
    .from("service_categories")
    .select("id, name, sort_order")
    .eq("user_id", storeId)
    .order("sort_order", { ascending: true });

  if (!categories || categories.length === 0) return { categories: [], items: [], settings: null };

  const categoryIds = categories.map((c: any) => c.id);

  const { data: items } = await supabaseClient
    .from("service_items")
    .select("id, category_id, name, price, unit, sort_order")
    .in("category_id", categoryIds)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const { data: settings } = await supabaseClient
    .from("store_delivery_settings")
    .select("*")
    .eq("user_id", storeId)
    .single();

  return { categories: categories || [], items: items || [], settings };
}

function formatPriceList(categories: any[], items: any[]): string {
  if (categories.length === 0) return "";

  let msg = "📋 *LISTA DE PRECIOS*\n\n";

  for (const cat of categories) {
    const catItems = items.filter((i) => i.category_id === cat.id);
    if (catItems.length === 0) continue;

    msg += `*${cat.name.toUpperCase()}*\n`;
    for (const item of catItems) {
      const unitLabel = item.unit === "kilo" ? "/kilo" : item.unit === "docena" ? "/pieza" : "";
      msg += `• ${item.name} ........... $${item.price}${unitLabel}\n`;
    }
    msg += "\n";
  }

  return msg.trim();
}

// ── Chatbot: auto-cotizar ────────────────────────────────────────

function matchGarmentsToItems(
  garmentsText: string,
  items: any[]
): { name: string; qty: number; price: number; unit: string }[] {
  const normalizedGarments = normalizeText(garmentsText);
  const results: { name: string; qty: number; price: number; unit: string }[] = [];

  for (const item of items) {
    const itemName = normalizeText(item.name);
    // Check if the item name appears in the garments text
    if (normalizedGarments.includes(itemName)) {
      // Try to find quantity before the item name
      const regex = new RegExp(`(\\d+)\\s*${itemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      const match = garmentsText.match(regex);
      const qty = match ? parseInt(match[1]) : 1;
      results.push({ name: item.name, qty, price: item.price, unit: item.unit });
    }
  }

  return results;
}

function buildAutoQuote(
  matchedItems: { name: string; qty: number; price: number; unit: string }[],
  settings: any
): { serviceTotal: number; deliveryFee: number; total: number; breakdown: string } {
  let serviceTotal = 0;
  let breakdown = "";

  for (const item of matchedItems) {
    const lineTotal = item.qty * item.price;
    serviceTotal += lineTotal;
    const unitLabel = item.unit === "kilo" ? "/kilo" : "";
    breakdown += `• ${item.qty}x ${item.name} ........ $${lineTotal.toFixed(2)}\n`;
  }

  const minFree = settings?.min_free_delivery || 250;
  const deliveryFee = serviceTotal >= minFree ? 0 : (settings?.small_order_fee || 35);
  const total = serviceTotal + deliveryFee;

  return { serviceTotal, deliveryFee, total, breakdown };
}

// ── MAIN ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const storeId = url.searchParams.get("store_id");

    if (!storeId) {
      return new Response(
        JSON.stringify({ error: "Falta el parámetro store_id en la URL." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();

    if (!payload.data || !payload.data.key) {
      return new Response("Ignored invalid payload format", { status: 200 });
    }
    if (payload.data.key.fromMe === true) {
      return new Response("Ignored self message", { status: 200 });
    }

    // ── Deduplicar mensajes (Evolution API retries) ──
    const messageKeyId = payload.data.key.id || `${payload.data.key.remoteJid}_${payload.data.message?.conversation || payload.data.message?.extendedTextMessage?.text || Date.now()}`;
    if (isDuplicateMessage(messageKeyId)) {
      console.log(`[Webhook] Duplicate message ignored: ${messageKeyId}`);
      return new Response("Duplicate message ignored", { status: 200 });
    }

    const customerPhone = payload.data.key.remoteJid.split("@")[0];
    const customerMessage = getIncomingText(payload.data.message);
    const customerPushName = payload.data.pushName || "Cliente WhatsApp";
    const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME") || payload.instance || "default";

    console.log(`[Webhook ${WEBHOOK_VERSION}] Phone: ${customerPhone}, Msg: "${customerMessage}", Name: ${customerPushName}`);

    // ── Supabase client ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Cargar perfil con chatbot config ──
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("store_name, whatsapp_gateway_type, whatsapp_session_token, delivery_enabled, whatsapp_chatbot_enabled, whatsapp_auto_replies")
      .eq("id", storeId)
      .single();

    if (profileError || !profile) {
      console.error(`[Webhook] Perfil no encontrado: ${storeId}`, profileError);
      return new Response(
        JSON.stringify({ error: "Sucursal no encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const storeName = profile.store_name || "FoxSolid Laundry";
    const sessionToken = profile.whatsapp_session_token;
    const deliveryEnabled = profile.delivery_enabled === true;
    const chatbotEnabled = profile.whatsapp_chatbot_enabled === true;
    const autoReplies = profile.whatsapp_auto_replies || {};
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";

    // ── Variables para templates ──
    const templateVars = {
      nombre: customerPushName,
      tienda: storeName,
      telefono: customerPhone,
    };

    // ── Helper para responder ──
    const reply = async (text: string) => {
      await sendWhatsAppText(EVOLUTION_API_URL, instanceName, sessionToken, customerPhone, text);
    };

    // ── Helper para cargar/crear conversación ──
    const getConversation = async () => {
      const { data } = await supabaseClient
        .from("whatsapp_conversations")
        .select("*")
        .eq("user_id", storeId)
        .eq("customer_phone", customerPhone)
        .maybeSingle();
      return data;
    };

    const upsertConversation = async (state: string, context: Record<string, unknown> = {}) => {
      const existing = await getConversation();
      if (existing) {
        await supabaseClient
          .from("whatsapp_conversations")
          .update({
            current_state: state,
            context,
            customer_name: customerPushName,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseClient
          .from("whatsapp_conversations")
          .insert([{
            user_id: storeId,
            customer_phone: customerPhone,
            customer_name: customerPushName,
            current_state: state,
            context,
          }]);
      }
    };

    // ── Helper: welcome menu (with buttons) ──
    const sendWelcomeMenu = async () => {
      const menuText = autoReplies.welcome
        ? renderTemplate(autoReplies.welcome, templateVars)
        : `Hola ${customerPushName}! Bienvenido a *${storeName}*.\n\n¿Qué deseas hacer?\n\n1️⃣ Solicitar recogida de ropa\n2️⃣ Ver lista de precios\n3️⃣ Consultar mi pedido\n4️⃣ Hablar con atención al cliente`;

      await reply(menuText);
    };

    // ══════════════════════════════════════════════════════════════
    //  CASO A: DELIVERY DESACTIVADO
    // ══════════════════════════════════════════════════════════════
    if (!deliveryEnabled) {
      const msg = autoReplies.disabled
        ? renderTemplate(autoReplies.disabled, templateVars)
        : `Hola ${customerPushName}! Por el momento *${storeName}* no tiene activo el servicio de recogida a domicilio por WhatsApp. Por favor contacta directamente a la sucursal.`;
      await reply(msg);
      return new Response(JSON.stringify({ success: true, reason: "delivery_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══════════════════════════════════════════════════════════════
    //  CASO B: CHATBOT HABILITADO — MÁQUINA DE ESTADOS
    // ══════════════════════════════════════════════════════════════
    if (chatbotEnabled) {
      const conversation = await getConversation();
      const currentState = conversation?.current_state || "idle";
      const context = conversation?.context || {};

      console.log(`[Webhook Chatbot] Estado actual: ${currentState}, Contexto:`, JSON.stringify(context));

      // ── Detectar si el usuario escribe "menu" para resetear ──
      const menuOption = detectMenuOption(customerMessage);

      // ── ESTADO: IDLE (sin conversación activa) ──
      if (currentState === "idle") {
        // ── COTIZACIÓN INLINE: preguntar precio sin entrar al flujo completo ──
        // DEBE ir ANTES de detectMenuOption para no ser capturado como "prices"
        const priceQuery = detectPriceQuery(customerMessage);
        if (priceQuery) {
          const { categories, items } = await fetchPriceList(supabaseClient, storeId);
          if (categories.length > 0) {
            const normalizedQuery = normalizeText(priceQuery.item);
            const matchingItems = items.filter((item: any) => {
              const itemName = normalizeText(item.name);
              return itemName.includes(normalizedQuery) || normalizedQuery.includes(itemName);
            });

            if (matchingItems.length > 0) {
              let response = `💰 *Precios de ${priceQuery.item}:*\n\n`;
              for (const item of matchingItems) {
                const unitLabel = item.unit === "kilo" ? "/kilo" : item.unit === "docena" ? "/pieza" : "";
                response += `• ${item.name}: $${item.price}${unitLabel}\n`;
              }
              response += `\n¿Te gustaría agendar una recogida? Escribe *1* o envía tu dirección.\n\n_Oscribe *menu* para ver otras opciones._`;
              await reply(response);
              return new Response(JSON.stringify({ success: true, state: "inline_price_shown" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
          // Si no encontró coincidencias, mostrar menú de bienvenida
          await sendWelcomeMenu();
          return new Response(JSON.stringify({ success: true, state: "idle_menu_sent" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (menuOption === "pickup") {
          const msg = autoReplies.menu_pickup
            ? renderTemplate(autoReplies.menu_pickup, templateVars)
            : `Perfecto ${customerPushName}. Por favor envíanos tu dirección o ubicación por WhatsApp para programar la recogida.\n\n_Escribe *menu* para ver otras opciones._`;
          await reply(msg);
          await upsertConversation("awaiting_address");
          return new Response(JSON.stringify({ success: true, state: "awaiting_address" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // ── FLUJO EXPRESS: recogida inmediata sin agendamiento ──
        if (menuOption === "express") {
          const msg = `🚀 *Recolección Express*\n\nPerfecto ${customerPushName}. Un repartidor pasará por tu domicilio lo antes posible.\n\nPor favor envíanos tu *dirección o ubicación* por WhatsApp.\n\n_Escribe *menu* para ver otras opciones._`;
          await reply(msg);
          await upsertConversation("awaiting_address_express", { is_express: true });
          return new Response(JSON.stringify({ success: true, state: "awaiting_address_express" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (menuOption === "prices") {
          // Mostrar lista de precios
          const { categories, items, settings } = await fetchPriceList(supabaseClient, storeId);
          console.log(`[Webhook PRICES DEBUG] categories=${categories.length}, imageUrl=${settings?.price_list_image_url}, instance=${instanceName}, evoUrl=${EVOLUTION_API_URL}`);
          if (categories.length === 0 && !settings?.price_list_image_url) {
            await reply(`*${storeName}* aún no tiene configurada una lista de precios. Escríbenos y te atenderemos.`);
          } else if (settings?.price_list_image_url) {
            await sendWhatsAppImage(EVOLUTION_API_URL, instanceName, sessionToken, customerPhone, settings.price_list_image_url, `Lista de precios de *${storeName}*`);
            await upsertConversation("awaiting_garments", { ...context, from_price_list: true });
          } else {
            const priceListMsg = formatPriceList(categories, items);
            const followUp = `\n\n¿Te interesa algún servicio? Escribe las prendas que vas a llevar o escribe *menu* para volver.`;
            await reply(priceListMsg + followUp);
            await upsertConversation("awaiting_garments", { ...context, from_price_list: true });
          }
          return new Response(JSON.stringify({ success: true, state: "price_list_sent" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (menuOption === "tracking") {
          const msg = autoReplies.menu_tracking
            ? renderTemplate(autoReplies.menu_tracking, templateVars)
            : `Envía tu número de folio o el enlace de tracking que recibiste por WhatsApp y te diremos el estatus de tu pedido.\n\n_Escribe *menu* para volver al menú principal._`;
          await reply(msg);
          await upsertConversation("awaiting_tracking");
          return new Response(JSON.stringify({ success: true, state: "awaiting_tracking" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (menuOption === "agent") {
          const msg = autoReplies.menu_agent
            ? renderTemplate(autoReplies.menu_agent, templateVars)
            : `Un momento por favor, te comunicamos con atención al cliente. 🕐`;
          await reply(msg);
          await upsertConversation("agent_mode");
          return new Response(JSON.stringify({ success: true, state: "agent_mode" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (menuOption === "menu") {
          await sendWelcomeMenu();
          await upsertConversation("idle");
          return new Response(JSON.stringify({ success: true, state: "idle_menu_sent" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // ── Sin opción válida: detectar dirección directamente (legacy) ──
        const address = extractAddress(payload, customerMessage);
        if (address) {
          const order = await createOrderFromAddress(address, customerPushName, customerPhone, storeId, storeName, supabaseClient, reply, autoReplies, templateVars, EVOLUTION_API_URL);
          return new Response(JSON.stringify({ success: true, order_id: order.id }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Detectar "no sé" u otras preguntas frecuentes
        if (detectUncertainty(customerMessage)) {
          const { categories, items } = await fetchPriceList(supabaseClient, storeId);
          if (categories.length > 0) {
            const priceListMsg = formatPriceList(categories, items);
            const followUp = `\n\nEscribe los números de lo que llevas (ej: 1, 2, 3) o describe tus prendas.\n\n_Escribe *menu* para ver otras opciones._`;
            await reply(priceListMsg + followUp);
            await upsertConversation("awaiting_garments", { ...context, from_price_list: true, price_items: items });
          } else {
            await reply(`¿Qué prendas o servicios necesitas? Por favor descríbelos.\n\nEscribe *menu* para ver otras opciones.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco`);
            await upsertConversation("awaiting_garments", context);
          }
          return new Response(JSON.stringify({ success: true, state: "garment_suggestions_sent" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Mensaje genérico sin dirección → primero buscar en KB directamente (sin IA)
        const kbAnswer = await matchKnowledgeBaseDirect(supabaseClient, storeId, customerMessage);
        if (kbAnswer) {
          await reply(kbAnswer + "\n\n_Escribe *menu* para ver las opciones._");
          await upsertConversation("idle");
          return new Response(JSON.stringify({ success: true, state: "kb_direct_answer" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Si no hay match en KB → intentar IA como fallback
        const rateLimitOk = checkAIRateLimit(customerPhone);
        console.log(`[Webhook] AI rate limit for ${customerPhone}: ${rateLimitOk}`);
        
        if (rateLimitOk) {
          // Obtener toda la información para contexto de IA
          const { categories: aiCategories, items: aiItems } = await fetchPriceList(supabaseClient, storeId);
          const priceListText = aiCategories.length > 0 ? formatPriceList(aiCategories, aiItems) : "No hay precios configurados";
          
          const [knowledgeBase, storeInfo, zonesList] = await Promise.all([
            fetchKnowledgeBase(supabaseClient, storeId),
            fetchStoreInfoForAI(supabaseClient, storeId),
            fetchZonesForAI(supabaseClient, storeId),
          ]);

          console.log(`[Webhook] AI context: KB=${knowledgeBase.length}chars, StoreInfo=${storeInfo.length}chars`);

          const systemPrompt = buildAISystemPrompt(storeName, priceListText, customerPushName, currentState, knowledgeBase, storeInfo, zonesList);
          const aiResponse = await openRouterChat(systemPrompt, customerMessage);

          console.log(`[Webhook] AI response: ${aiResponse ? aiResponse.substring(0, 100) : "NULL"}`);

          if (aiResponse) {
            const parsed = parseAIResponse(aiResponse);
            if (parsed.type === "intent") {
              // La IA sugirió una intención → redirigir al flujo correspondiente
              if (parsed.data === "pickup") {
                await reply(aiResponse);
                await upsertConversation("awaiting_address");
                return new Response(JSON.stringify({ success: true, state: "ai_redirected_pickup" }), {
                  status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
              if (parsed.data === "prices") {
                await sendWelcomeMenu();
                await upsertConversation("idle");
                return new Response(JSON.stringify({ success: true, state: "ai_redirected_prices" }), {
                  status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
              if (parsed.data === "tracking") {
                await reply(aiResponse);
                await upsertConversation("awaiting_tracking");
                return new Response(JSON.stringify({ success: true, state: "ai_redirected_tracking" }), {
                  status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
            // La IA respondió con texto natural → enviar respuesta
            await reply(parsed.data + "\n\n_Escribe *menu* para ver las opciones._");
            await upsertConversation("idle");
            return new Response(JSON.stringify({ success: true, state: "ai_response_sent" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            console.log(`[Webhook] AI returned null for: "${customerMessage}"`);
          }
        }

        // Fallback final: mostrar menú de bienvenida
        console.log(`[Webhook] Falling back to welcome menu for: "${customerMessage}" (rateLimit=${rateLimitOk})`);
        await sendWelcomeMenu();
        await upsertConversation("idle");
        return new Response(JSON.stringify({ success: true, state: "idle_menu_sent" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_ADDRESS ──
      if (currentState === "awaiting_address") {
        // ── Escape universal: si el usuario elige una opción del menú, redirigir ──
        if (menuOption === "prices" || menuOption === "tracking" || menuOption === "agent" || menuOption === "menu") {
          await upsertConversation("idle");
          // Redirigir al menú apropiado
          if (menuOption === "prices") {
            const { categories, items, settings } = await fetchPriceList(supabaseClient, storeId);
            if (categories.length === 0 && !settings?.price_list_image_url) {
              await reply(`*${storeName}* aún no tiene configurada una lista de precios. Escríbenos y te atenderemos.`);
            } else if (settings?.price_list_image_url) {
              await sendWhatsAppImage(EVOLUTION_API_URL, instanceName, sessionToken, customerPhone, settings.price_list_image_url);
              await upsertConversation("awaiting_garments", { from_price_list: true });
            } else {
              const priceListMsg = formatPriceList(categories, items);
              await reply(priceListMsg + `\n\n¿Te interesa algún servicio? Escribe las prendas que vas a llevar o escribe *menu* para volver.`);
              await upsertConversation("awaiting_garments", { from_price_list: true });
            }
            return new Response(JSON.stringify({ success: true, state: "price_list_sent" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (menuOption === "tracking") {
            const msg = autoReplies.menu_tracking
              ? renderTemplate(autoReplies.menu_tracking, templateVars)
              : `Envía tu número de folio o el enlace de tracking que recibiste por WhatsApp y te diremos el estatus de tu pedido.`;
            await reply(msg);
            await upsertConversation("awaiting_tracking");
            return new Response(JSON.stringify({ success: true, state: "awaiting_tracking" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (menuOption === "agent") {
            const msg = autoReplies.menu_agent
              ? renderTemplate(autoReplies.menu_agent, templateVars)
              : `Un momento por favor, te comunicamos con atención al cliente. 🕐`;
            await reply(msg);
            await upsertConversation("agent_mode");
            return new Response(JSON.stringify({ success: true, state: "agent_mode" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // menuOption === "menu"
          await sendWelcomeMenu();
          return new Response(JSON.stringify({ success: true, state: "menu_reset" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (detectBackOption(customerMessage)) {
          await sendWelcomeMenu();
          await upsertConversation("idle");
          return new Response(JSON.stringify({ success: true, state: "back_to_idle" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const address = extractAddress(payload, customerMessage);
        
        // --- Fallback: Si el usuario estaba supuestamente en awaiting_zone pero el estado no se actualizó rápido,
        // o estamos en awaiting_address y mandó un número de zona válido.
        if (!address && context.all_zones && context.all_zones.length > 0) {
          const selectedZone = parseZoneSelection(customerMessage, context.all_zones);
          if (selectedZone) {
            const updatedContext = { ...context, detected_zone: selectedZone.zone_name, available_days: selectedZone.pickup_days };
            if (selectedZone.pickup_days && selectedZone.pickup_days.length > 0) {
              const daysList = formatPickupDays(selectedZone.pickup_days);
              const msg = `📍 Perfecto, estás en *${selectedZone.zone_name}*.\nPara tu zona tenemos recogida los días:\n\n${daysList}\n¿Qué día prefieres? (Escribe el número o el día)\n\n_Escribe *atras* para cambiar tu dirección._`;
              await reply(msg);
              await upsertConversation("awaiting_pickup_day", updatedContext);
              return new Response(JSON.stringify({ success: true, state: "awaiting_pickup_day" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            } else {
              const msg = autoReplies.ask_garments
                ? renderTemplate(autoReplies.ask_garments, templateVars)
                : `Perfecto ${customerPushName}. Ahora dinos:\n\n*¿Qué prendas o servicios necesitas?*\n\nEscribe *atras* si quieres cambiar tu dirección.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco\n- 1 cobertor lavado especial`;
              await reply(msg);
              await upsertConversation("awaiting_garments", updatedContext);
              return new Response(JSON.stringify({ success: true, state: "awaiting_garments" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }

        if (address) {
          const updatedContext = { ...context, pending_address: address };
          
          // Detect zone and available days
          const result = await detectZoneFromAddress(supabaseClient, storeId, address);
          
          // If we have a direct match (or only 1 zone configured)
          if (result && result.matched) {
            const zone = result.matched;
            if (zone.pickup_days && zone.pickup_days.length > 0) {
              updatedContext.detected_zone = zone.zone_name;
              updatedContext.available_days = zone.pickup_days;
              
              const daysList = formatPickupDays(zone.pickup_days);
              const msg = `📍 Detectamos que estás en *${zone.zone_name}*.\nPara tu zona tenemos recogida los días:\n\n${daysList}\n¿Qué día prefieres? (Escribe el número o el día)\n\n_Escribe *atras* para cambiar tu dirección._`;
              
              await reply(msg);
              await upsertConversation("awaiting_pickup_day", updatedContext);
              return new Response(JSON.stringify({ success: true, state: "awaiting_pickup_day" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } else if (result && result.allZones && result.allZones.length > 0) {
            // No direct match, multiple zones available, ask the user
            updatedContext.all_zones = result.allZones;
            const zonesList = formatZonesList(result.allZones);
            const msg = `No pudimos detectar tu colonia exacta con esa dirección.\n\n¿En cuál de estas zonas te encuentras?\n\n${zonesList}\n(Escribe el número o nombre de tu zona)\n\n_Escribe *menu* para volver al menú principal._`;
            
            await reply(msg);
            await upsertConversation("awaiting_zone", updatedContext);
            return new Response(JSON.stringify({ success: true, state: "awaiting_zone" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Fallback if no zones configured or all zones have no pickup days: go directly to garments
          const msg = autoReplies.ask_garments
            ? renderTemplate(autoReplies.ask_garments, templateVars)
            : `Perfecto ${customerPushName}. Ahora dinos:\n\n*¿Qué prendas o servicios necesitas?*\n\nEscribe *atras* si quieres cambiar tu dirección.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco\n- 1 cobertor lavado especial`;
          await reply(msg);
          await upsertConversation("awaiting_garments", updatedContext);
          return new Response(JSON.stringify({ success: true, state: "awaiting_garments" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const msg = autoReplies.no_address
          ? renderTemplate(autoReplies.no_address, templateVars)
          : `Hola ${customerPushName}! No pudimos detectar tu dirección. Por favor envía tu ubicación por WhatsApp o escribe la dirección completa.\n\nEscribe *menu* para volver al menú principal.\n\nEjemplo: *Calle 10 #123, Colonia Centro*`;
        await reply(msg);
        return new Response(JSON.stringify({ success: true, state: "awaiting_address_repeat" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_ADDRESS_EXPRESS (flujo express) ──
      if (currentState === "awaiting_address_express") {
        if (detectBackOption(customerMessage)) {
          await sendWelcomeMenu();
          await upsertConversation("idle");
          return new Response(JSON.stringify({ success: true, state: "back_to_idle" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const address = extractAddress(payload, customerMessage);
        if (address) {
          const updatedContext = { ...context, pending_address: address, is_express: true };

          // Directly ask for garments (no zones, no scheduling for express)
          const garmentsMsg = `📍 *Dirección recibida:* ${address}\n\nAhora dinos:\n\n*¿Qué prendas vas a entregar?*\n\nEscribe *atras* si quieres cambiar tu dirección.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco`;
          await reply(garmentsMsg);
          await upsertConversation("awaiting_garments_express", updatedContext);
          return new Response(JSON.stringify({ success: true, state: "awaiting_garments_express" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const repeatMsg = `No pudimos detectar tu dirección. Por favor envía tu ubicación por WhatsApp o escribe la dirección completa.\n\nEscribe *menu* para volver al menú principal.`;
        await reply(repeatMsg);
        return new Response(JSON.stringify({ success: true, state: "awaiting_address_express_repeat" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_GARMENTS_EXPRESS (prendas para express) ──
      if (currentState === "awaiting_garments_express") {
        if (detectBackOption(customerMessage)) {
          const msg = `Por favor envíanos tu dirección o ubicación por WhatsApp para la recolección express.\n\n_Escribe *menu* para ver otras opciones._`;
          await reply(msg);
          await upsertConversation("awaiting_address_express", { is_express: true });
          return new Response(JSON.stringify({ success: true, state: "back_to_address_express" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const garments = customerMessage.trim();
        if (garments.length < 3) {
          const msg = `Por favor describe qué prendas o servicios necesitas.\n\nEscribe *atras* para cambiar tu dirección.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco`;
          await reply(msg);
          return new Response(JSON.stringify({ success: true, state: "awaiting_garments_express_repeat" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create express order (no scheduled date, immediate pickup)
        const address = context.pending_address as string;
        const order = await createOrderFromAddress(
          address,
          customerPushName,
          customerPhone,
          storeId,
          storeName,
          supabaseClient,
          reply,
          autoReplies,
          templateVars,
          EVOLUTION_API_URL,
          garments,
          false // don't send confirmation yet
        );

        // Try auto-quoting
        const { items: allItems, settings } = await fetchPriceList(supabaseClient, storeId);
        const matchedItems = matchGarmentsToItems(garments, allItems);

        if (matchedItems.length > 0) {
          const quote = buildAutoQuote(matchedItems, settings);
          const quoteMsg = `🚀 *Recolección Express - Cotización*\n\n${quote.breakdown}\n🧺 Servicio: $${quote.serviceTotal.toFixed(2)}\n🚚 Express: $${quote.deliveryFee === 0 ? "Incluido" : "$" + quote.deliveryFee.toFixed(2)}\n💰 *Total estimado: $${quote.total.toFixed(2)} MXN*\n\n¿Aceptas? Responde *SI* o *NO*\nEscribe *atras* para cambiar tus prendas.`;

          await reply(quoteMsg);

          // Save quote to DB
          await supabaseClient
            .from("delivery_orders")
            .update({
              service_cost: quote.serviceTotal,
              delivery_fee: quote.deliveryFee,
              auto_quoted: true,
            })
            .eq("id", order.id)
            .eq("user_id", storeId);

          const approvalContext = {
            pending_address: address,
            pending_order_id: order.id,
            pending_tracking_token: order.tracking_token,
            pending_garments: garments,
            quoted_fee: quote.deliveryFee,
            quoted_service_cost: quote.serviceTotal,
            auto_quoted: true,
            is_express: true,
          };
          await upsertConversation("awaiting_client_approval", approvalContext);
        } else {
          // No auto-quote possible, create order and notify store
          const trackingUrl = `${TRACKING_BASE_URL}/${order.tracking_token}`;
          const confirmMsg = `🚀 *¡Recolección Express Registrada!*\n\nPedido *#${order.id}*\n📍 ${address}\n🧺 ${garments}\n\nUn repartidor pasará por tu domicilio lo antes posible. Sigue tu pedido: ${trackingUrl}\n\n_Escribe *menu* para ver opciones._`;
          await reply(confirmMsg);
          await upsertConversation("idle", {});
        }

        return new Response(JSON.stringify({ success: true, order_id: order.id, state: "express_order_created" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_ZONE ──
      if (currentState === "awaiting_zone") {
        if (detectBackOption(customerMessage)) {
          const msg = `Por favor envíanos tu dirección o ubicación por WhatsApp para programar la recogida.`;
          await reply(msg);
          await upsertConversation("awaiting_address", { pending_address: null });
          return new Response(JSON.stringify({ success: true, state: "back_to_address" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const selectedZone = parseZoneSelection(customerMessage, context.all_zones || []);
        
        if (selectedZone) {
          const updatedContext = { ...context, detected_zone: selectedZone.zone_name, available_days: selectedZone.pickup_days };
          
          if (selectedZone.pickup_days && selectedZone.pickup_days.length > 0) {
            const daysList = formatPickupDays(selectedZone.pickup_days);
            const msg = `📍 Perfecto, estás en *${selectedZone.zone_name}*.\nPara tu zona tenemos recogida los días:\n\n${daysList}\n¿Qué día prefieres? (Escribe el número o el día)\n\n_Escribe *atras* para cambiar tu zona._`;
            await reply(msg);
            await upsertConversation("awaiting_pickup_day", updatedContext);
            return new Response(JSON.stringify({ success: true, state: "awaiting_pickup_day" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            // No days configured for this zone, go to garments
            const msg = autoReplies.ask_garments
              ? renderTemplate(autoReplies.ask_garments, templateVars)
              : `Perfecto ${customerPushName}. Ahora dinos:\n\n*¿Qué prendas o servicios necesitas?*\n\nEscribe *atras* si quieres cambiar tu zona.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco\n- 1 cobertor lavado especial`;
            await reply(msg);
            await upsertConversation("awaiting_garments", updatedContext);
            return new Response(JSON.stringify({ success: true, state: "awaiting_garments" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }

        // Invalid zone selection
        const zonesList = formatZonesList(context.all_zones || []);
        const msg = `No entendimos la zona. Por favor elige una de las zonas:\n\n${zonesList}\n\n_Escribe *menu* para volver al menú principal._`;
        await reply(msg);
        return new Response(JSON.stringify({ success: true, state: "awaiting_zone_repeat" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_PICKUP_DAY ──
      if (currentState === "awaiting_pickup_day") {
        if (detectBackOption(customerMessage)) {
          const msg = `Por favor envíanos tu dirección o ubicación por WhatsApp para programar la recogida.`;
          await reply(msg);
          await upsertConversation("awaiting_address", { pending_address: context.pending_address });
          return new Response(JSON.stringify({ success: true, state: "back_to_address" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const selection = parsePickupDaySelection(customerMessage, context.available_days || []);
        
        if (selection) {
          const finalDayString = `${selection.dayName} ${selection.dateStr}`;
          const updatedContext = { ...context, preferred_pickup_day: finalDayString, scheduled_pickup_date: selection.isoDate };
          
          // Siempre enviar primero la confirmación con la fecha exacta
          await reply(`✅ ¡Perfecto! Tu recogida quedó agendada para el *${finalDayString}*.\n\nAhora dinos:\n\n_Escribe *atras* para cambiar el día._`);
          
          // Luego el mensaje de prendas (de la plantilla o el default)
          const garmentsMsg = autoReplies.ask_garments
            ? renderTemplate(autoReplies.ask_garments, templateVars)
            : `*¿Qué prendas o servicios necesitas?*\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco`;
          await reply(garmentsMsg);
          
          await upsertConversation("awaiting_garments", updatedContext);
          return new Response(JSON.stringify({ success: true, state: "awaiting_garments" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Invalid day selection
        const daysList = formatPickupDays(context.available_days || []);
        const msg = `No entendimos el día. Por favor elige uno de los días disponibles para tu zona:\n\n${daysList}\n\n_Escribe *menu* para volver al menú principal._`;
        await reply(msg);
        return new Response(JSON.stringify({ success: true, state: "awaiting_pickup_day_repeat" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_GARMENTS (prendas/servicio) ──
      if (currentState === "awaiting_garments") {
        // ── Escape universal: si el usuario elige tracking/agente/menu, redirigir ──
        if (menuOption === "tracking" || menuOption === "agent" || menuOption === "menu") {
          await upsertConversation("idle");
          if (menuOption === "tracking") {
            const msg = autoReplies.menu_tracking
              ? renderTemplate(autoReplies.menu_tracking, templateVars)
              : `Envía tu número de folio o el enlace de tracking que recibiste por WhatsApp y te diremos el estatus de tu pedido.`;
            await reply(msg);
            await upsertConversation("awaiting_tracking");
            return new Response(JSON.stringify({ success: true, state: "awaiting_tracking" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (menuOption === "agent") {
            const msg = autoReplies.menu_agent
              ? renderTemplate(autoReplies.menu_agent, templateVars)
              : `Un momento por favor, te comunicamos con atención al cliente. 🕐`;
            await reply(msg);
            await upsertConversation("agent_mode");
            return new Response(JSON.stringify({ success: true, state: "agent_mode" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await sendWelcomeMenu();
          return new Response(JSON.stringify({ success: true, state: "menu_reset" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (detectBackOption(customerMessage)) {
          const msg = `Por favor envíanos tu dirección o ubicación por WhatsApp para programar la recogida.`;
          await reply(msg);
          await upsertConversation("awaiting_address", { pending_address: context.pending_address });
          return new Response(JSON.stringify({ success: true, state: "back_to_address" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Si el cliente dice "no sé" u otra incertidumbre, mostrar lista
        if (detectUncertainty(customerMessage)) {
          const { categories, items, settings } = await fetchPriceList(supabaseClient, storeId);
          if (settings?.price_list_image_url) {
            await sendWhatsAppImage(EVOLUTION_API_URL, instanceName, sessionToken, customerPhone, settings.price_list_image_url);
            await upsertConversation("awaiting_garments", { ...context, from_price_list: true, price_items: items });
          } else if (categories.length > 0) {
            const priceListMsg = formatPriceList(categories, items);
            const followUp = `\n\nEscribe los números de lo que llevas (ej: 1, 2, 3) o describe tus prendas.`;
            await reply(priceListMsg + followUp);
            await upsertConversation("awaiting_garments", { ...context, from_price_list: true, price_items: items });
          } else {
            await reply(`Por favor describe qué prendas o servicios necesitas.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco`);
          }
          return new Response(JSON.stringify({ success: true, state: "garment_suggestions_repeat" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const garments = customerMessage.trim();

        // Si el mensaje parece una pregunta (no una descripción de prendas), usar IA
        if (garments.includes("?") || garments.includes("¿") || /^(que|como|cuando|donde|por que|cuanto|horas|servicio|servicios|precios|tienen|hacen|ofrecen)/i.test(garments)) {
          if (checkAIRateLimit(customerPhone)) {
            const { categories: aiCategories, items: aiItems } = await fetchPriceList(supabaseClient, storeId);
            const priceListText = aiCategories.length > 0 ? formatPriceList(aiCategories, aiItems) : "No hay precios configurados";
            
            const [knowledgeBase, storeInfo, zonesList] = await Promise.all([
              fetchKnowledgeBase(supabaseClient, storeId),
              fetchStoreInfoForAI(supabaseClient, storeId),
              fetchZonesForAI(supabaseClient, storeId),
            ]);

            const systemPrompt = buildAISystemPrompt(storeName, priceListText, customerPushName, currentState, knowledgeBase, storeInfo, zonesList);
            const aiResponse = await openRouterChat(systemPrompt, customerMessage);

            if (aiResponse) {
              const parsed = parseAIResponse(aiResponse);
              if (parsed.type === "intent") {
                if (parsed.data === "pickup") {
                  await reply(aiResponse);
                  await upsertConversation("awaiting_address");
                  return new Response(JSON.stringify({ success: true, state: "ai_redirected_pickup" }), {
                    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
                if (parsed.data === "prices") {
                  await sendWelcomeMenu();
                  await upsertConversation("idle");
                  return new Response(JSON.stringify({ success: true, state: "ai_redirected_prices" }), {
                    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
                  });
                }
              }
              await reply(parsed.data + "\n\n_Escribe *menu* para ver las opciones._");
              return new Response(JSON.stringify({ success: true, state: "ai_response_sent" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }

        // Si viene de la lista de precios y el cliente envía números, parsearlos
        if (context.from_price_list && context.price_items) {
          const selection = parseGarmentSelection(garments);
          if (selection) {
            const priceItems = context.price_items as any[];
            const matchedItems: { name: string; qty: number; price: number; unit: string }[] = [];

            for (const num of selection) {
              // Number corresponds to item index (1-based) in the flat list
              const flatIndex = num - 1;
              if (flatIndex >= 0 && flatIndex < priceItems.length) {
                const item = priceItems[flatIndex];
                // Check if already added
                const existing = matchedItems.find((m) => m.name === item.name);
                if (existing) {
                  existing.qty += 1;
                } else {
                  matchedItems.push({ name: item.name, qty: 1, price: item.price, unit: item.unit });
                }
              }
            }

            if (matchedItems.length > 0) {
              // Fetch settings for auto-quoting
              const { settings } = await fetchPriceList(supabaseClient, storeId);
              const quote = buildAutoQuote(matchedItems, settings);

              // Build garment summary text
              const garmentSummary = matchedItems.map((m) => `${m.qty}x ${m.name}`).join(", ");

              // Create order
              const address = context.pending_address as string;
              if (!address) {
                await reply(`Necesitamos tu dirección. Por favor envía tu ubicación.`);
                await upsertConversation("awaiting_address");
                return new Response(JSON.stringify({ success: true, state: "missing_address" }), {
                  status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }

              const order = await createOrderFromAddress(address, customerPushName, customerPhone, storeId, storeName, supabaseClient, reply, autoReplies, templateVars, EVOLUTION_API_URL, garmentSummary, false);

              // Build auto-quote message
              const quoteMsg = `📦 *Cotización automática*\n\n${quote.breakdown}\n🧺 Servicio: $${quote.serviceTotal.toFixed(2)}\n🚚 Delivery: ${quote.deliveryFee === 0 ? "Gratis" : "$" + quote.deliveryFee.toFixed(2)}\n💰 *Total estimado: $${quote.total.toFixed(2)} MXN*\n\n¿Aceptas? Responde *SI* o *NO*\nEscribe *atras* para cambiar tus prendas.`;

              await reply(quoteMsg);

              // Set state to awaiting_client_approval
              const approvalContext = {
                pending_address: address,
                pending_order_id: order.id,
                pending_tracking_token: order.tracking_token,
                pending_garments: garmentSummary,
                quoted_fee: quote.deliveryFee,
                quoted_service_cost: quote.serviceTotal,
                auto_quoted: true,
              };
              await upsertConversation("awaiting_client_approval", approvalContext);

              return new Response(JSON.stringify({ success: true, order_id: order.id, state: "auto_quoted" }), {
                status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        }

        // Texto libre (sin selección numérica de lista)
        if (garments.length < 3) {
          const msg = `Por favor describe qué prendas o servicios necesitas.\n\nEscribe *atras* para volver a indicar tu dirección.\n\nEjemplo:\n- 5 camisas lavado ordinario\n- 2 pantalones lavado en seco`;
          await reply(msg);
          return new Response(JSON.stringify({ success: true, state: "awaiting_garments_repeat" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Crear orden SIN enviar confirmación
        const address = context.pending_address as string;
        const order = await createOrderFromAddress(
            address, 
            customerPushName, 
            customerPhone, 
            storeId, 
            storeName, 
            supabaseClient, 
            reply, 
            autoReplies, 
            templateVars, 
            EVOLUTION_API_URL, 
            garments, 
            false,
            context.preferred_pickup_day,
            context.detected_zone,
            context.scheduled_pickup_date
        );

        // Intentar auto-cotizar con la lista de precios
        const { items: allItems, settings } = await fetchPriceList(supabaseClient, storeId);
        const matchedItems = matchGarmentsToItems(garments, allItems);

        if (matchedItems.length > 0) {
          const quote = buildAutoQuote(matchedItems, settings);
          const quoteMsg = `📦 *Cotización automática*\n\n${quote.breakdown}\n🧺 Servicio: $${quote.serviceTotal.toFixed(2)}\n🚚 Delivery: ${quote.deliveryFee === 0 ? "Gratis" : "$" + quote.deliveryFee.toFixed(2)}\n💰 *Total estimado: $${quote.total.toFixed(2)} MXN*\n\n¿Aceptas? Responde *SI* o *NO*\nEscribe *atras* para cambiar tus prendas.`;

          await reply(quoteMsg);

          // ─── GUARDAR COTIZACIÓN EN LA BD INMEDIATAMENTE ───
          // Así el admin ve el precio en cuanto llega la orden, sin esperar aprobación del cliente
          await supabaseClient
            .from("delivery_orders")
            .update({
              service_cost: quote.serviceTotal,
              delivery_fee: quote.deliveryFee,
              auto_quoted: true,
            })
            .eq("id", order.id)
            .eq("user_id", storeId);

          const approvalContext = {
            pending_address: address,
            pending_order_id: order.id,
            pending_tracking_token: order.tracking_token,
            pending_garments: garments,
            quoted_fee: quote.deliveryFee,
            quoted_service_cost: quote.serviceTotal,
            auto_quoted: true,
          };
          await upsertConversation("awaiting_client_approval", approvalContext);
        } else {
          // No pudo auto-cotizar → confirmar registro y esperar cotización manual
          const trackingUrl = `${TRACKING_BASE_URL}/${order.tracking_token}`;
          const orderContext = {
            pending_address: address,
            pending_order_id: order.id,
            pending_tracking_token: order.tracking_token,
            pending_garments: garments,
          };
          await upsertConversation("idle", orderContext);

          const confirmMsg = `¡Gracias ${customerPushName}! Tu pedido *#${order.id}* fue registrado.\n\nEn breve recibirás la cotización con el costo de recogida.\n\n_Escribe *menu* para ver opciones._`;
          await reply(confirmMsg);
        }

        return new Response(JSON.stringify({ success: true, order_id: order.id, state: "order_registered" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_CLIENT_APPROVAL (aprobación de cotización) ──
      if (currentState === "awaiting_client_approval") {
        if (detectBackOption(customerMessage)) {
          const orderId = context.pending_approval_order_id || context.pending_order_id;
          const menuMsg = `Tu pedido ${orderId ? `#${orderId}` : ""} ya fue registrado y está pendiente de cotización.\n\n¿Deseas hacer algo más?\n\n1️⃣ Solicitar otra recogida\n2️⃣ Ver lista de precios\n3️⃣ Consultar un pedido\n4️⃣ Hablar con atención al cliente\n\n_Escribe *menu* para volver al menú principal._`;
          await reply(menuMsg);
          await upsertConversation("idle", context);
          return new Response(JSON.stringify({ success: true, state: "back_to_idle" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const approval = detectApprovalResponse(customerMessage);
        const orderId = context.pending_approval_order_id || context.pending_order_id;
        const quotedFee = context.quoted_fee as number;
        const quotedService = context.quoted_service_cost as number;
        const orderAddress = context.pending_address as string;
        const trackingToken = context.pending_tracking_token as string;

        if (approval === "approved") {
          // Guardar costos cotizados en la orden
          if (orderId) {
            const updateFields: Record<string, unknown> = {};
            if (quotedService !== undefined && quotedService !== null) {
              updateFields.service_cost = Number(quotedService) || 0;
            }
            if (quotedFee !== undefined && quotedFee !== null) {
              updateFields.delivery_fee = Number(quotedFee) || 0;
            }
            if (context.auto_quoted) {
              updateFields.auto_quoted = true;
            }
            if (Object.keys(updateFields).length > 0) {
              await supabaseClient
                .from("delivery_orders")
                .update(updateFields)
                .eq("id", orderId)
                .eq("user_id", storeId);
            }
          }

          // Cliente aprueba → pedir preferencia de pago
          const prefMsg = `¡Perfecto ${customerPushName}! ¿Cómo prefieres pagar?\n\n1️⃣ Al entregar al chofer\n2️⃣ Cuando esté lista tu ropa\n3️⃣ Al recoger en sucursal\n\nEscribe el número de tu opción.`;
          await reply(prefMsg);
          await upsertConversation("awaiting_payment_preference", context);
          return new Response(JSON.stringify({ success: true, state: "awaiting_payment_preference" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (approval === "rejected") {
          if (orderId) {
            await supabaseClient
              .from("delivery_orders")
              .update({ status: "cancelled" })
              .eq("id", orderId)
              .eq("user_id", storeId);

            // Notificar al dueño
            const ownerPhone = profile.whatsapp_session_token ? "" : "";
            const ownerMsg = autoReplies.order_rejected
              ? renderTemplate(autoReplies.order_rejected, { ...templateVars, folio: String(orderId) })
              : `${customerPushName} ha rechazado la cotización de su pedido #${orderId}.`;
            await sendWhatsAppText(EVOLUTION_API_URL, instanceName, sessionToken, ownerPhone, ownerMsg);
          }
          const msg = `Entendido ${customerPushName}. Tu pedido #${orderId} ha sido cancelado. Si deseas algo diferente, escribe *menu* para ver opciones.`;
          await reply(msg);
          await upsertConversation("idle", {});
          return new Response(JSON.stringify({ success: true, state: "approval_rejected" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Respuesta no reconocida
        const total = (quotedFee || 0) + (quotedService || 0);
        const msg = `Por favor responde *SI* para aceptar o *NO* para rechazar la cotización de $${total.toFixed(2)} MXN.\n\n_Escribe *menu* para ver otras opciones._`;
        await reply(msg);
        return new Response(JSON.stringify({ success: true, state: "awaiting_client_approval_repeat" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_PAYMENT_PREFERENCE ──
      if (currentState === "awaiting_payment_preference") {
        if (detectBackOption(customerMessage)) {
          const prefMsg = `¿Cómo prefieres pagar?\n\n1️⃣ Al entregar al chofer\n2️⃣ Cuando esté lista tu ropa\n3️⃣ Al recoger en sucursal\n\nEscribe el número de tu opción.\n\n_Escribe *menu* para ver otras opciones._`;
          await reply(prefMsg);
          return new Response(JSON.stringify({ success: true, state: "payment_preference_repeat" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const preference = detectPaymentPreference(customerMessage);

        if (preference) {
          const orderId = context.pending_approval_order_id || context.pending_order_id;
          const trackingToken = context.pending_tracking_token as string;
          const orderAddress = context.pending_address as string;

          // Update order with payment preference
          if (orderId) {
            await supabaseClient
              .from("delivery_orders")
              .update({
                payment_preference: preference,
                payment_preference_confirmed_at: new Date().toISOString(),
                pickup_quote_confirmed_at: new Date().toISOString(),
              })
              .eq("id", orderId)
              .eq("user_id", storeId);
          }

          // Send final confirmation
          const trackingUrl = `${TRACKING_BASE_URL}/${trackingToken}`;
          const total = (context.quoted_fee || 0) + (context.quoted_service_cost || 0);
          const confirmMsg = `¡Perfecto ${customerPushName}! Tu solicitud ha sido confirmada.\n\n📍 Dirección: ${orderAddress || "No especificada"}\n💰 Total estimado: $${total.toFixed(2)} MXN\n💳 Pago: ${paymentPreferenceLabel(preference)}\n🔗 Sigue tu pedido: ${trackingUrl}\n\nPronto nos comunicaremos contigo.`;
          await reply(confirmMsg);

          await upsertConversation("idle", {});
          return new Response(JSON.stringify({ success: true, state: "payment_preference_saved" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Opción no válida
        const msg = `No entendimos tu respuesta. Por favor escribe:\n\n1️⃣ Al entregar al chofer\n2️⃣ Cuando esté lista tu ropa\n3️⃣ Al recoger en sucursal\n\n_Escribe *menu* para ver otras opciones._`;
        await reply(msg);
        return new Response(JSON.stringify({ success: true, state: "awaiting_payment_preference_repeat" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AWAITING_TRACKING ──
      if (currentState === "awaiting_tracking") {
        if (detectBackOption(customerMessage)) {
          await sendWelcomeMenu();
          await upsertConversation("idle");
          return new Response(JSON.stringify({ success: true, state: "back_to_idle" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const trimmedMsg = customerMessage.trim();

        if (isTrackingToken(trimmedMsg)) {
          const { data: order } = await supabaseClient
            .from("delivery_orders")
            .select("id, status, tracking_token")
            .eq("tracking_token", trimmedMsg)
            .eq("user_id", storeId)
            .maybeSingle();

          if (order) {
            const statusLabels: Record<string, string> = {
              requested: "Solicitado",
              assigned: "Asignado a repartidor",
              picked_up: "Recogido por repartidor",
              delivered_to_store: "En sucursal",
              completed: "Completado",
              cancelled: "Cancelado",
            };
            const statusLabel = statusLabels[order.status] || order.status;
            const trackingUrl = `${TRACKING_BASE_URL}/${order.tracking_token}`;

            const msg = autoReplies.tracking_found
              ? renderTemplate(autoReplies.tracking_found, { ...templateVars, folio: String(order.id), estatus: statusLabel, tracking_url: trackingUrl })
              : `*${storeName}*: Tu pedido #${order.id} tiene estatus: *${statusLabel}*.\n\nSigue el detalle en vivo: ${trackingUrl}`;
            await reply(msg);
          } else {
            const msg = autoReplies.tracking_not_found || `No encontramos un pedido con ese enlace. Verifica el número e intenta de nuevo.\n\n_Escribe *menu* para volver al menú principal._`;
            await reply(msg);
          }
          await upsertConversation("idle");
          return new Response(JSON.stringify({ success: true, state: "tracking_resolved" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (isOrderId(trimmedMsg)) {
          const orderIdNum = Number(trimmedMsg);
          const { data: order } = await supabaseClient
            .from("delivery_orders")
            .select("id, status, tracking_token")
            .eq("id", orderIdNum)
            .eq("user_id", storeId)
            .maybeSingle();

          if (order) {
            const statusLabels: Record<string, string> = {
              requested: "Solicitado",
              assigned: "Asignado a repartidor",
              picked_up: "Recogido por repartidor",
              delivered_to_store: "En sucursal",
              completed: "Completado",
              cancelled: "Cancelado",
            };
            const statusLabel = statusLabels[order.status] || order.status;
            const trackingUrl = `${TRACKING_BASE_URL}/${order.tracking_token}`;

            const msg = autoReplies.tracking_found
              ? renderTemplate(autoReplies.tracking_found, { ...templateVars, folio: String(order.id), estatus: statusLabel, tracking_url: trackingUrl })
              : `*${storeName}*: Tu pedido #${order.id} tiene estatus: *${statusLabel}*.\n\nSigue el detalle en vivo: ${trackingUrl}`;
            await reply(msg);
          } else {
            const msg = autoReplies.tracking_not_found || `No encontramos un pedido con ese folio. Verifica el número e intenta de nuevo.\n\n_Escribe *menu* para volver al menú principal._`;
            await reply(msg);
          }
          await upsertConversation("idle");
          return new Response(JSON.stringify({ success: true, state: "tracking_resolved" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const msg = `No entendimos tu solicitud. Por favor envía:\n\n📌 Tu folio (número de pedido)\n🔗 O el enlace de tracking completo\n\n_Escribe *menu* para volver al menú principal._`;
        await reply(msg);
        return new Response(JSON.stringify({ success: true, state: "awaiting_tracking_repeat" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── ESTADO: AGENT_MODE ──
      if (currentState === "agent_mode") {
        if (menuOption === "menu" || menuOption === "pickup" || menuOption === "tracking" || menuOption === "prices") {
          await upsertConversation("idle");
          await sendWelcomeMenu();
          return new Response(JSON.stringify({ success: true, state: "agent_exit" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ success: true, state: "agent_mode_passthrough" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ══════════════════════════════════════════════════════════════
    //  CASO C: SIN CHATBOT — FLUJO LEGACY (compatibilidad)
    // ══════════════════════════════════════════════════════════════
    const address = extractAddress(payload, customerMessage);

    if (address) {
      const order = await createOrderFromAddress(address, customerPushName, customerPhone, storeId, storeName, supabaseClient, reply, autoReplies, templateVars, EVOLUTION_API_URL);
      return new Response(JSON.stringify({ success: true, order_id: order.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msg = autoReplies.no_address
      ? renderTemplate(autoReplies.no_address, templateVars)
      : `Hola ${customerPushName}! Bienvenido a *${storeName}*.\n\nPara solicitar que vayamos a recoger tu ropa a domicilio, puedes enviarnos tu ubicacion por WhatsApp o escribir tu direccion completa con calle, numero y colonia.\n\nEjemplo: *Calle 10 #123, Colonia Centro*`;
    await reply(msg);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Webhook Error]", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Función compartida para crear orden desde dirección ──────────

async function createOrderFromAddress(
  address: string,
  customerPushName: string,
  customerPhone: string,
  storeId: string,
  storeName: string,
  supabaseClient: any,
  reply: (text: string) => Promise<void>,
  autoReplies: Record<string, string>,
  templateVars: Record<string, string>,
  _evolutionApiUrl: string,
  garments?: string,
  sendConfirmation: boolean = true,
  pickupDay?: string,
  zone?: string,
  scheduledPickupDate?: string,
) {
  console.log(`[Webhook] Dirección detectada: "${address}"${garments ? `, Prendas: "${garments}"` : ""}${pickupDay ? `, Día: ${pickupDay}` : ""}${zone ? `, Zona: ${zone}` : ""}`);

  let customerId = null;
  const { data: existingCustomer } = await supabaseClient
    .from("customers")
    .select("id")
    .eq("phone", customerPhone)
    .eq("user_id", storeId)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabaseClient.from("customers").update({ address }).eq("id", customerId);
  } else {
    const { data: newCustomer } = await supabaseClient
      .from("customers")
      .insert([{ user_id: storeId, name: customerPushName, phone: customerPhone, address }])
      .select()
      .single();
    if (newCustomer) customerId = newCustomer.id;
  }

  // Build notes with all available context
  let orderNotes = "Creado automáticamente desde WhatsApp Webhook";
  if (zone) orderNotes += `\nZona: ${zone}`;
  if (pickupDay) orderNotes += `\nRecogida agendada: ${pickupDay}`;

  const { data: order, error: orderError } = await supabaseClient
    .from("delivery_orders")
    .insert([{
      user_id: storeId,
      customer_id: customerId,
      customer_name: customerPushName,
      customer_phone: customerPhone,
      customer_address: address,
      customer_item_description: garments || null,
      garment_summary: garments || null,
      status: "requested",
      notes: orderNotes,
      detected_zone: zone || null,
      scheduled_pickup_date: scheduledPickupDate || null,
    }])
    .select()
    .single();

  if (orderError) throw orderError;

  console.log(`[Webhook] Orden #${order.id} creada. Token: ${order.tracking_token}`);

  if (sendConfirmation) {
    const trackingUrl = `${TRACKING_BASE_URL}/${order.tracking_token}`;
    const garmentsLine = garments ? `\n🧺 Prendas: ${garments}` : "";
    const msg = autoReplies.order_confirmed
      ? renderTemplate(autoReplies.order_confirmed, { ...templateVars, direccion: address, tracking_url: trackingUrl })
      : `¡Gracias ${customerPushName}! Hemos recibido tu solicitud para recoger tu ropa en *${storeName}*.\n\n📍 Dirección: ${address}${garmentsLine}\n🔗 Sigue tu pedido: ${trackingUrl}`;
    await reply(msg);
  }

  return order;
}
