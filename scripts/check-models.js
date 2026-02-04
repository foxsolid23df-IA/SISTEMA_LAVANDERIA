const Groq = require('groq-sdk');
require('dotenv').config({ path: './backend/.env' });

async function checkModels() {
    const groq = new Groq({
        apiKey: process.env.GROQ_API_KEY
    });

    try {
        const models = await groq.models.list();
        console.log('--- MODELOS DISPONIBLES EN GROQ ---');
        models.data.forEach(m => {
            if (m.id.toLowerCase().includes('vision')) {
                console.log(`[VISION] ${m.id}`);
            } else {
                console.log(`[TEXT] ${m.id}`);
            }
        });
        console.log('----------------------------------');
    } catch (error) {
        console.error('Error al obtener modelos:', error.message);
    }
}

checkModels();
