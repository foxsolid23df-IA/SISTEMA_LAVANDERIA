/**
 * Script de prueba para la integración con OpenRouter.
 * Ejecutar con: node test-openrouter.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const aiService = require('./services/aiService');

async function testIntegration() {
    console.log('🚀 Iniciando prueba de OpenRouter...');
    console.log('Model:', process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder:free');

    const messages = [
        {
            role: "user",
            content: "Genera una función JavaScript para calcular total de venta con subtotal, impuestos y descuento"
        }
    ];

    try {
        const response = await aiService.openRouterChat(messages);
        
        console.log('\n✅ Respuesta recibida exitosamente:');
        console.log('--------------------------------------------------');
        console.log(response.content);
        console.log('--------------------------------------------------');
        console.log('Uso de tokens:', response.usage);
        console.log('Modelo utilizado:', response.model);

    } catch (error) {
        console.error('\n❌ Error en la integración:', error.message);
    }
}

testIntegration();
