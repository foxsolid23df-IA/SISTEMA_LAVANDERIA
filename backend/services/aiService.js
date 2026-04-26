/**
 * AI Service - Integración con OpenRouter
 * Capa de servicios para centralizar las llamadas a modelos de IA.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Función reutilizable para chatear con modelos de OpenRouter
 * @param {Array} messages - Arreglo de mensajes [{role: 'user', content: '...'}]
 * @param {string} model - Identificador del modelo (opcional, usa env por defecto)
 * @returns {Promise<Object>} - Respuesta del modelo
 */
async function openRouterChat(messages, model = null) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const defaultModel = process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder:free';
    
    if (!apiKey) {
        throw new Error('Configuración incompleta: Falta OPENROUTER_API_KEY en las variables de entorno.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 segundos de timeout

    try {
        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://foxsolid.com', // Requerido por OpenRouter
                'X-Title': 'Sistema Lavanderia POS',
            },
            body: JSON.stringify({
                model: model || defaultModel,
                messages: messages,
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenRouter Error (${response.status}): ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.choices || data.choices.length === 0) {
            throw new Error('Respuesta inesperada de OpenRouter: No se recibieron opciones.');
        }

        return {
            content: data.choices[0].message.content,
            model: data.model,
            usage: data.usage
        };

    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('La petición a OpenRouter excedió el tiempo límite (30s)');
        }
        throw error;
    }
}

module.exports = {
    openRouterChat
};
