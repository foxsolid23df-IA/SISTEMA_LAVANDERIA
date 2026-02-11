export class ScaleService {
    constructor() {
        this.port = null;
        this.reader = null;
        this.writer = null;
        this.isConnected = false;
        this.readableStreamClosed = null;
        this.simulationInterval = null;
        this.pollingInterval = null;
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
     */
    async connect(baudRate = 9600) {
        if (!navigator.serial) {
            throw new Error(
                this.isElectron
                    ? "Error interno: Web Serial API no disponible en esta versión de Electron."
                    : "Web Serial API no es compatible con este navegador. Use Chrome o Edge."
            );
        }

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

            if (error.name === 'NotFoundError') {
                throw new Error(this.isElectron ? "No se detectó ninguna báscula conectada." : "No se seleccionó ningún puerto.");
            }
            if (error.name === 'InvalidStateError') throw new Error("El puerto serial ya está en uso.");
            if (error.name === 'NetworkError') throw new Error("Error de comunicación. Verifique el cable USB.");
            if (error.name === 'SecurityError') throw new Error("Permiso denegado.");

            throw new Error(`Error de conexión: ${error.message}`);
        }
    }

    async checkPreviousConnection(baudRate = 9600) {
        if (!navigator.serial) return false;
        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length > 0) {
                this.port = ports[0];
                try {
                    await this.port.open({ baudRate });
                    this.isConnected = true;
                    return true;
                } catch (openError) {
                    if (openError.name === 'InvalidStateError' && this.port.readable) {
                        this.isConnected = true;
                        return true;
                    }
                    throw openError;
                }
            }
        } catch (error) {
            this.isConnected = false;
            this.port = null;
        }
        return false;
    }

    async connectSimulation(onWeightRead) {
        console.log("⚠️ Iniciando Modo Simulación");
        this.isConnected = true;
        this.simulationInterval = setInterval(() => {
            const randomWeight = (Math.random() * 4.5 + 0.5).toFixed(3);
            const simulatedData = `ST,GS,+  ${randomWeight}kg\r\n`;
            const weight = this.parseWeight(simulatedData);
            if (weight !== null) onWeightRead(weight);
        }, 800);
        return true;
    }

    async disconnect() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        if (this.reader) {
            try { await this.reader.cancel(); } catch (e) { }
            this.reader = null;
        }

        if (this.port) {
            try { await this.port.close(); } catch (e) { }
            this.port = null;
        }

        this.isConnected = false;
        this.buffer = '';
    }

    /**
     * Envía el comando de solicitud de peso (P) para básculas Torrey PCP/EQB
     */
    async sendWeightRequest() {
        if (!this.port || !this.port.writable) return;

        try {
            const encoder = new TextEncoder();
            const writer = this.port.writable.getWriter();
            await writer.write(encoder.encode('P'));
            writer.releaseLock();
        } catch (error) {
            console.error("Error enviando trigger 'P' a la báscula:", error);
        }
    }

    async readWeight(onWeightRead) {
        if (this.simulationInterval) return;
        if (!this.port || !this.port.readable) throw new Error("Puerto no conectado");

        // Iniciar POLLING para modelos Torrey PCP-500 (Requieren 'P' para enviar datos)
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => {
            this.sendWeightRequest();
        }, 1000); // Solicitar peso cada segundo

        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();
        this.buffer = '';

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value) {
                    console.log("SCALE_RAW:", JSON.stringify(value));
                    this.buffer += value;
                    const lines = this.buffer.split(/\r\n|\r|\n/);
                    this.buffer = lines.pop();

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.length > 0) {
                            const weight = this.parseWeight(trimmedLine);
                            if (weight !== null) onWeightRead(weight);
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Error leyendo báscula:", error);
            throw error;
        } finally {
            if (this.reader) {
                try { this.reader.releaseLock(); } catch (e) { }
            }
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
        }
    }

    parseWeight(data) {
        // Regex mejorada: busca números con o sin signo y decimales opcionales
        const weightMatch = data.match(/([-+]?\s*[0-9]+(?:\.[0-9]+)?)/);
        if (weightMatch && weightMatch[1]) {
            const cleanNumber = weightMatch[1].replace(/\s+/g, '');
            const weight = parseFloat(cleanNumber);
            if (!isNaN(weight) && weight < 10000) return weight;
        }
        return null;
    }
}

export const scaleService = new ScaleService();

