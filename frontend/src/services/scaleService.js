export class ScaleService {
    constructor() {
        this.port = null;
        this.reader = null;
        this.isConnected = false;
        this.readableStreamClosed = null;
        this.simulationInterval = null;
        this.buffer = '';
    }

    /**
     * Detecta si estamos corriendo dentro de Electron
     */
    get isElectron() {
        return !!(window.electron && window.electron.isElectron);
    }

    /**
     * Conectar a la báscula serial.
     * En Web (Chrome/Edge): muestra popup nativo de selección de puerto.
     * En Electron (.exe): la selección es automática vía select-serial-port handler.
     */
    async connect(baudRate = 9600) {
        // Verificar soporte de Web Serial API
        if (!navigator.serial) {
            throw new Error(
                this.isElectron
                    ? "Error interno: Web Serial API no disponible en esta versión de Electron."
                    : "Web Serial API no es compatible con este navegador. Use Chrome o Edge."
            );
        }

        // Si ya estamos conectados, desconectar primero para evitar conflictos
        if (this.isConnected || this.port) {
            console.log("⚠️ Puerto previo detectado, desconectando antes de reconectar...");
            try {
                await this.disconnect();
            } catch (e) {
                console.warn("Advertencia al desconectar puerto previo:", e);
            }
        }

        try {
            console.log("🔍 Solicitando puerto serial...");
            this.port = await navigator.serial.requestPort();
            console.log("📌 Puerto obtenido, abriendo a", baudRate, "baudios...");
            await this.port.open({ baudRate });
            this.isConnected = true;
            console.log("✅ Báscula conectada exitosamente");
            return true;
        } catch (error) {
            console.error("❌ Error al conectar báscula:", error.name, error.message);
            this.isConnected = false;
            this.port = null;

            // Errores específicos con mensajes claros
            if (error.name === 'NotFoundError') {
                if (this.isElectron) {
                    throw new Error("No se detectó ninguna báscula conectada. Verifique que el cable USB esté bien conectado y reintente.");
                }
                throw new Error("No se seleccionó ningún puerto. Haga clic en 'Conectar Báscula' e intente de nuevo.");
            }

            if (error.name === 'InvalidStateError') {
                throw new Error("El puerto serial ya está en uso. Cierre otras aplicaciones que usen la báscula y reintente.");
            }

            if (error.name === 'NetworkError') {
                throw new Error("Error de comunicación con el puerto serial. Desconecte y reconecte el cable USB.");
            }

            if (error.name === 'SecurityError') {
                throw new Error("Permiso denegado para acceder al puerto serial.");
            }

            throw new Error(`Error de conexión: ${error.message}`);
        }
    }

    /**
     * Intenta conectar automáticamente a un puerto previamente autorizado.
     * Esto funciona cuando el usuario ya otorgó permiso en una sesión anterior.
     */
    async checkPreviousConnection(baudRate = 9600) {
        if (!navigator.serial) return false;

        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length > 0) {
                console.log("📍 Puertos previos detectados:", ports.length, "- intentando conexión automática...");

                // Usar el primer puerto previamente autorizado
                this.port = ports[0];

                try {
                    await this.port.open({ baudRate });
                    this.isConnected = true;
                    console.log("✅ Auto-conexión exitosa con puerto previo");
                    return true;
                } catch (openError) {
                    // Si el puerto ya está abierto (InvalidStateError), intentar usarlo directamente
                    if (openError.name === 'InvalidStateError') {
                        console.log("ℹ️ Puerto ya estaba abierto, verificando si es usable...");
                        if (this.port.readable) {
                            this.isConnected = true;
                            return true;
                        }
                    }
                    throw openError;
                }
            }
        } catch (error) {
            console.warn("⚠️ Auto-conexión falló:", error.message);
            this.isConnected = false;
            this.port = null;
        }
        return false;
    }

    // --- MODO SIMULACIÓN ---
    async connectSimulation(onWeightRead) {
        console.log("⚠️ Iniciando Modo Simulación de Báscula");
        this.isConnected = true;

        this.simulationInterval = setInterval(() => {
            const randomWeight = (Math.random() * 4.5 + 0.5).toFixed(3);
            const simulatedData = `ST,GS,+  ${randomWeight}kg\r\n`;
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

        // Cerrar reader primero
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) { /* ignorar */ }
            try {
                if (this.readableStreamClosed) {
                    await this.readableStreamClosed.catch(() => { });
                }
            } catch (e) { /* ignorar */ }
            this.reader = null;
            this.readableStreamClosed = null;
        }

        // Cerrar puerto
        if (this.port) {
            try {
                await this.port.close();
            } catch (e) {
                console.warn("Advertencia al cerrar puerto:", e.message);
            }
            this.port = null;
        }

        this.isConnected = false;
        this.buffer = '';
    }

    async readWeight(onWeightRead) {
        if (this.simulationInterval) return;

        if (!this.port || !this.port.readable) {
            throw new Error("Puerto no conectado o no legible");
        }

        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        this.buffer = '';

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;

                if (value) {
                    // LOG DE RAW DATA para diagnóstico
                    console.log("SCALE_RAW:", JSON.stringify(value));

                    this.buffer += value;
                    const lines = this.buffer.split(/\r\n|\r|\n/);
                    this.buffer = lines.pop(); // Guardar remanente incompleto

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.length > 0) {
                            console.log("SCALE_LINE_RECEIVED:", trimmedLine); // Ver qué llega exactamente
                            const weight = this.parseWeight(trimmedLine);

                            if (weight !== null) {
                                onWeightRead(weight);
                            } else {
                                console.warn("SCALE_PARSE_FAIL:", trimmedLine);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error leyendo báscula:", error);
            throw error;
        } finally {
            if (this.reader) {
                try { this.reader.releaseLock(); } catch (e) { /* ignorar */ }
            }
        }
    }

    parseWeight(data) {
        // INTENTO 1: Formato Torrey Estándar "ST,GS,+  1.500kg"
        // INTENTO 2: Solo números "1.500" o "1500"
        // INTENTO 3: Formato CAS/Otros "1.500 kg"

        // Busca cualquier secuencia de digitos (con o sin decimales)
        // Mejorado para aceptar: "1.500", "1500", "+ 1.5", etc.
        const weightMatch = data.match(/([-+]?\s*[0-9]+(?:\.[0-9]+)?)/);

        if (weightMatch && weightMatch[1]) {
            const cleanNumber = weightMatch[1].replace(/\s+/g, '');
            const weight = parseFloat(cleanNumber);

            // Filtro de ruido: Si es NaN o número absurdo, ignorar
            if (!isNaN(weight) && weight < 10000) {
                return weight;
            }
        }
        return null;
    }
}

export const scaleService = new ScaleService();

