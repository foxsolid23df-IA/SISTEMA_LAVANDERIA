const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');

// Inicializar Groq con precaución para evitar crasheos si falta la llave en el .env
const groqApiKey = process.env.GROQ_API_KEY || 'no-key-provided';
const groq = new Groq({
    apiKey: groqApiKey
});

router.post('/analyze-cloth', async (req, res) => {
    try {
        const { image } = req.body; // Base64 image

        if (!process.env.GROQ_API_KEY) {
            return res.json({
                success: true,
                isMock: true,
                analysis: {
                    prenda: "Camisa (Modo Demo)",
                    color: "Color detectado (Modo Demo)",
                    estado: "Sin API Key de Groq",
                    sugerencia: "Por favor, agrega tu GROQ_API_KEY en el archivo .env del backend para activar la IA real."
                }
            });
        }

        // Extraer solo la parte base64 si viene con el prefijo data:image/jpeg;base64,
        const base64Image = image.split(',')[1] || image;

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Actúa como un experto en recepción de lavandería. Analiza la imagen y responde ÚNICAMENTE en formato JSON con la siguiente estructura: { \"prenda\": \"nombre de prenda\", \"color\": \"color dominante\", \"estado\": \"estado visible o manchas\", \"sugerencia\": \"instrucción corta de lavado\" }. Responde solo el JSON, sin texto adicional."
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(chatCompletion.choices[0].message.content);

        res.json({
            success: true,
            analysis: result
        });

    } catch (error) {
        console.error('❌ Error detallado en AI Analysis:', error);

        // Si el error viene de la API de Groq, devolver su mensaje
        const errorMessage = error.response?.data?.error?.message || error.message || 'Error desconocido en el servidor de IA';

        res.status(500).json({
            success: false,
            error: errorMessage,
            details: error.stack
        });
    }
});

module.exports = router;
