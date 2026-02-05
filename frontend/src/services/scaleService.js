export class ScaleService {
    constructor() {
        this.port = null;
        this.reader = null;
        this.isConnected = false;
        this.readableStreamClosed = null;
        this.simulationInterval = null; // Para modo simulación
        this.buffer = '';
    }

    async connect(baudRate = 9600) {
        if (!navigator.serial) {
            throw new Error("Web Serial API not supported in this browser.");
        }

        try {
            this.port = await navigator.serial.requestPort();
            await this.port.open({ baudRate });
            this.isConnected = true;
            return true;
        } catch (error) {
            console.error("Error connecting to scale:", error);
            this.isConnected = false;
            throw error;
        }
    }

    // --- MODO SIMULACIÓN ---
    async connectSimulation(onWeightRead) {
        console.log("⚠️ Iniciando Modo Simulación de Báscula");
        this.isConnected = true;

        // Simular lecturas cada 500ms
        this.simulationInterval = setInterval(() => {
            // Generar peso aleatorio entre 0.5kg y 5.0kg
            // Variar ligeramente para parecer real
            const randomWeight = (Math.random() * 4.5 + 0.5).toFixed(3);

            // Simular formato Torrey (p.ej. "ST,GS,+  1.250kg")
            // A veces enviamos basura o fragmentos si quisiéramos probar robustez,
            // pero para esta prueba básica enviaremos tramas limpias.
            const simulatedData = `ST,GS,+  ${randomWeight}kg\r\n`;

            // Usar el mismo parser
            const weight = this.parseWeight(simulatedData);
            if (weight !== null) {
                onWeightRead(weight);
            }
        }, 800);

        return true;
    }

    async disconnect() {
        // Limpiar simulación si existe
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }

        if (this.reader) {
            await this.reader.cancel();
            await this.readableStreamClosed.catch(() => { /* Ignore the error */ });
            this.reader = null;
        }

        if (this.port) {
            await this.port.close();
            this.port = null;
        }

        this.isConnected = false;
    }

    async readWeight(onWeightRead) {
        // Si estamos en simulación, no necesitamos leer del puerto real
        if (this.simulationInterval) return;

        if (!this.port || !this.port.readable) {
            throw new Error("Port not connected or not readable");
        }

        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        this.buffer = ''; // Reiniciar buffer al comenzar lectura

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) {
                    break;
                }
                if (value) {
                    this.buffer += value;

                    // Procesar líneas completas
                    // Las básculas suelen enviar \r, \n o \r\n
                    // Usamos una regex que cubra ambos casos
                    const lines = this.buffer.split(/\r\n|\r|\n/);

                    // El último elemento es el remanente (puede ser cadena vacía o incompleta)
                    this.buffer = lines.pop();

                    for (const line of lines) {
                        if (line.trim().length > 0) {
                            const weight = this.parseWeight(line);
                            if (weight !== null) {
                                onWeightRead(weight);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error reading from scale:", error);
            throw error;
        } finally {
            if (this.reader) this.reader.releaseLock();
        }
    }


    parseWeight(data) {
        // Torrey scales typically send data in a format like:
        // "ST,GS,+  1.500kg" 
        // "ST,GS,-  0.500kg" (Negative weight)

        // Expresión regular mejorada:
        // [-+]?  -> Signo opcional (+ o -)
        // \s*    -> Espacios opcionales
        // \d+    -> Digitos enteros
        // \.     -> Punto decimal
        // \d+    -> Decimales
        const weightMatch = data.match(/([-+]?\s*[0-9]+\.[0-9]+)/);

        if (weightMatch && weightMatch[1]) {
            // Eliminar espacios intermedios (ej: "-  0.500" -> "-0.500") para que parseFloat funcione bien
            const cleanNumber = weightMatch[1].replace(/\s+/g, '');
            const weight = parseFloat(cleanNumber);

            // Opcional: Ignorar pesos negativos si el negocio lo requiere, 
            // pero por defecto devolvemos lo que dice la báscula.
            return weight;
        }
        return null;
    }
}

export const scaleService = new ScaleService();
