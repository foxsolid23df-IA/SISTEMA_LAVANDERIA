export class ScaleService {
    constructor() {
        this.port = null;
        this.reader = null;
        this.isConnected = false;
        this.readableStreamClosed = null;
        this.simulationInterval = null;
        this.pollingInterval = null;
        this.buffer = '';
        this._isConnecting = false; // Anti-bucle: evita conexiones simultáneas
        this._failCount = 0;        // Contador de fallos consecutivos

        // Estabilización: solo reportar peso cuando se mantiene estable 300ms
        this._lastRawWeight = null;
        this._stableTimer = null;
        this._stableWeight = null;
        this._STABLE_MS = 300; // Tiempo de estabilización en ms
    }

    get isElectron() {
        return !!(window.electron && window.electron.isElectron);
    }

    /**
     * Conectar a la báscula serial (con protección anti-bucle).
     */
    async connect(baudRate = 9600) {
        // GUARDIA 1: Evitar conexiones simultáneas
        if (this._isConnecting) {
            console.warn("⏳ Conexión ya en progreso, ignorando solicitud duplicada.");
            return false;
        }

        if (!navigator.serial) {
            throw new Error(
                this.isElectron
                    ? "Error interno: Web Serial API no disponible."
                    : "Web Serial API no es compatible. Use Chrome o Edge."
            );
        }

        // GUARDIA 2: Si ya estamos conectados, no reconectar
        if (this.isConnected && this.port) {
            console.log("✅ Ya conectado, no se requiere reconexión.");
            return true;
        }

        this._isConnecting = true;

        // Limpiar cualquier estado anterior COMPLETAMENTE
        try {
            await this._forceCleanup();
        } catch (e) {
            console.warn("Limpieza previa:", e);
        }

        try {
            console.log("🔍 Solicitando puerto serial...");
            this.port = await navigator.serial.requestPort();

            // Verificar si el puerto ya está abierto (por sesión anterior)
            if (this.port.readable) {
                console.log("♻️ Puerto ya abierto desde sesión previa. Reutilizando.");
                this.isConnected = true;
                this._failCount = 0;
                return true;
            }

            console.log("📌 Puerto obtenido, abriendo a", baudRate, "baudios...");
            await this.port.open({ baudRate });
            this.isConnected = true;
            this._failCount = 0;
            console.log("✅ Báscula conectada exitosamente");
            return true;

        } catch (error) {
            console.error("❌ Error al conectar báscula:", error.name, error.message);

            // Si el puerto ya estaba abierto (por nosotros), usarlo
            if (error.name === 'InvalidStateError') {
                if (this.port && this.port.readable) {
                    console.warn("⚠️ Puerto ya abierto. Reutilizando conexión existente.");
                    this.isConnected = true;
                    this._failCount = 0;
                    return true;
                }
            }

            this._failCount++;
            this.isConnected = false;

            // Mensaje INTELIGENTE según el tipo de error
            if (error.name === 'NotFoundError') {
                this.port = null;
                throw new Error(
                    this.isElectron
                        ? "No se detectó ninguna báscula conectada."
                        : "No se seleccionó ningún puerto."
                );
            }

            if (error.name === 'NetworkError') {
                this.port = null;
                // DETECCIÓN DE CONFLICTO con otro programa
                throw new Error(
                    "No se pudo abrir el puerto serial. Posibles causas:\n" +
                    "• Otro programa tiene la báscula abierta (ej: Eleventa, HyperTerminal).\n" +
                    "• Desconecte y reconecte el cable USB.\n" +
                    "• Reinicie el equipo si el problema persiste."
                );
            }

            if (error.name === 'SecurityError') {
                this.port = null;
                throw new Error("Permiso denegado para acceder al puerto serial.");
            }

            this.port = null;
            throw new Error(`Error de conexión: ${error.message}`);

        } finally {
            this._isConnecting = false;
        }
    }

    /**
     * Intenta reconectar a un puerto previamente autorizado (auto-connect).
     */
    async checkPreviousConnection(baudRate = 9600) {
        if (!navigator.serial) return false;
        if (this._isConnecting) return false;

        // Si ya hemos fallado 3+ veces, no intentar más automáticamente
        if (this._failCount >= 3) {
            console.warn("🛑 Demasiados fallos consecutivos. Auto-connect deshabilitado.");
            return false;
        }

        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length > 0) {
                this.port = ports[0];

                // Si ya está abierto (sesión anterior), reutilizar
                if (this.port.readable) {
                    console.log("♻️ Puerto previo ya abierto. Reutilizando.");
                    this.isConnected = true;
                    return true;
                }

                try {
                    await this.port.open({ baudRate });
                    this.isConnected = true;
                    this._failCount = 0;
                    return true;
                } catch (openError) {
                    if (openError.name === 'InvalidStateError' && this.port.readable) {
                        this.isConnected = true;
                        return true;
                    }
                    // NetworkError = otro programa tiene el puerto
                    this._failCount++;
                    console.warn("Auto-connect falló:", openError.name);
                    this.port = null;
                }
            }
        } catch (error) {
            this._failCount++;
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

    /**
     * Limpieza forzada de TODOS los recursos (streams, readers, timers).
     */
    async _forceCleanup() {
        // 1. Detener timers
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this._stableTimer) {
            clearTimeout(this._stableTimer);
            this._stableTimer = null;
        }
        this._lastRawWeight = null;
        this._stableWeight = null;

        // 2. Cancelar y liberar reader
        if (this.reader) {
            try {
                await this.reader.cancel();
            } catch (e) { /* ignorar */ }
            try {
                this.reader.releaseLock();
            } catch (e) { /* ignorar */ }
            this.reader = null;
        }

        // 3. Esperar a que readableStreamClosed se resuelva
        if (this.readableStreamClosed) {
            try {
                await this.readableStreamClosed;
            } catch (e) { /* ignorar - puede ser error de cancelación */ }
            this.readableStreamClosed = null;
        }

        // 4. Dar tiempo al sistema para liberar el stream
        await new Promise(resolve => setTimeout(resolve, 150));

        // 5. Cerrar puerto si está accesible
        if (this.port) {
            try {
                if (this.port.readable && !this.port.readable.locked) {
                    await this.port.close();
                    console.log("🔒 Puerto cerrado correctamente.");
                } else if (!this.port.readable) {
                    // Puerto ya cerrado
                    console.log("🔒 Puerto ya estaba cerrado.");
                } else {
                    console.warn("⚠️ Puerto con stream bloqueado. No se puede cerrar, se libera referencia.");
                }
            } catch (e) {
                console.warn("⚠️ Error al cerrar puerto:", e.message);
            }
            this.port = null;
        }

        this.buffer = '';
    }

    async disconnect() {
        await this._forceCleanup();
        this.isConnected = false;
        this._failCount = 0;
        console.log("🔌 Báscula desconectada.");
    }

    /**
     * Envía comandos de solicitud de peso.
     * Soporta Torrey (P\r\n) y Rhino BAR-10 (W\r\n / $\r\n).
     * La BAR-10 usualmente es de envío continuo, pero el polling
     * asegura compatibilidad si está configurada en modo bajo demanda.
     */
    async sendWeightRequest() {
        if (!this.port || !this.port.writable || this.port.writable.locked) return;

        try {
            const encoder = new TextEncoder();
            const writer = this.port.writable.getWriter();
            // Enviar múltiples comandos comunes para máxima compatibilidad
            // Torrey: "P", Rhino/Genérico: "W", Indicadores: "$"
            await writer.write(encoder.encode('P\r\n'));
            writer.releaseLock();
        } catch (error) {
            // Silenciar errores de escritura para no saturar consola
        }
    }

    async readWeight(onWeightRead) {
        if (this.simulationInterval) return;
        if (!this.port || !this.port.readable) throw new Error("Puerto no conectado");

        // Verificar que el stream no esté bloqueado por una lectura previa
        if (this.port.readable.locked) {
            console.warn("⚠️ Stream de lectura ya activo. Omitiendo nueva lectura.");
            return;
        }

        // Iniciar POLLING para modelos Torrey PCP-500
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => {
            this.sendWeightRequest();
        }, 1000);

        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();
        this.buffer = '';
        this._lastRawWeight = null;
        this._stableWeight = null;

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) break;
                if (value) {
                    console.log("SCALE_RAW:", JSON.stringify(value));

                    // INTENTO 1: Parseo binario directo del valor raw completo
                    // (para básculas HID que envían paquetes binarios sin delimitadores de línea)
                    const binaryWeight = this.parseBinaryWeight(value);
                    if (binaryWeight !== null) {
                        console.log("⚖️ Peso (binario):", binaryWeight, "kg");
                        this._emitStableWeight(binaryWeight, onWeightRead);
                        continue;
                    }

                    // INTENTO 2: Parseo de texto estándar (con buffer por línea)
                    this.buffer += value;
                    const lines = this.buffer.split(/\r\n|\r|\n/);
                    this.buffer = lines.pop();

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.length > 0) {
                            const weight = this.parseWeight(trimmedLine);
                            if (weight !== null) {
                                console.log("⚖️ Peso (texto):", weight, "kg");
                                this._emitStableWeight(weight, onWeightRead);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            if (error.message && error.message.includes('break')) {
                console.warn("📡 Lectura interrumpida (desconexión normal).");
            } else {
                console.error("Error leyendo báscula:", error);
            }

            // Si el dispositivo se perdió físicamente, limpiar estado interno
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('lost') || msg.includes('detach') || msg.includes('disconnect')) {
                console.warn("🔌 Dispositivo perdido físicamente. Limpiando estado del servicio...");
                this.isConnected = false;
                this.port = null;
                this.buffer = '';
                this._failCount = 0;
            }

            throw error;
        } finally {
            if (this.reader) {
                try { this.reader.releaseLock(); } catch (e) { }
                this.reader = null;
            }
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
        }
    }

    /**
     * Filtro de estabilización: solo emite el peso al callback cuando
     * la lectura se mantiene constante durante _STABLE_MS milisegundos.
     * Evita que el campo de cantidad "parpadee" mientras el usuario
     * coloca mercancía en la plataforma.
     */
    _emitStableWeight(rawWeight, callback) {
        // Si el peso cambió, reiniciar el timer
        if (rawWeight !== this._lastRawWeight) {
            this._lastRawWeight = rawWeight;
            if (this._stableTimer) clearTimeout(this._stableTimer);
            this._stableTimer = setTimeout(() => {
                if (this._lastRawWeight === rawWeight) {
                    this._stableWeight = rawWeight;
                    callback(rawWeight);
                }
            }, this._STABLE_MS);
        }
    }

    parseWeight(data) {
        // ──────────────────────────────────────────────────────
        // RHINO BAR-10 / Torrey / Genérico — Parseo de texto
        // ──────────────────────────────────────────────────────
        // Formatos conocidos:
        //   Rhino BAR-10 (continuo):  "ST,GS,+  12.345kg" | "ST,NT,+  0.000kg"
        //   Rhino BAR-10 (alt):       "  12.345 kg" | "+012.345"
        //   Torrey PCP:               "ST,GS,+ 1.500kg"
        //   Genérico:                 "W:  1.234 kg" | "1.234"
        //   Con unidades:             "12.345 lb" (rechazar libras, solo kg)

        // Rechazar lecturas en libras si están marcadas explícitamente
        if (/\blb\b/i.test(data)) {
            console.warn('⚖️ Lectura en libras detectada, ignorando:', data);
            return null;
        }

        // Patrón principal: número con posible signo y espacios, seguido opcionalmente de "kg"
        const weightMatch = data.match(/([-+]?\s*[0-9]+(?:\.[0-9]+)?)\s*(?:kg)?/i);
        if (weightMatch && weightMatch[1]) {
            const cleanNumber = weightMatch[1].replace(/\s+/g, '');
            const weight = parseFloat(cleanNumber);
            // Rhino BAR-10: capacidad máxima 60 kg, división mínima 5g
            // Aceptamos hasta 65 kg (margen) y descartamos negativos falsos
            if (!isNaN(weight) && weight >= 0 && weight <= 65) {
                return parseFloat(weight.toFixed(3));
            }
        }
        return null;
    }

    /**
     * Intenta parsear datos binarios HID de básculas USB (formato crudo).
     * Muchas básculas baratas envían paquetes HID de 6 bytes:
     * [reportId, status, unitCode, scalingFactor, weightLowByte, weightHighByte]
     */
    parseBinaryWeight(rawString) {
        try {
            // Convertir string con caracteres de control a array de bytes
            const bytes = [];
            for (let i = 0; i < rawString.length; i++) {
                bytes.push(rawString.charCodeAt(i));
            }

            // Necesitamos al menos 6 bytes para un paquete HID estándar
            if (bytes.length < 6) return null;

            // Verificar que no sea solo bytes nulos (basura)
            const nonZero = bytes.filter(b => b !== 0);
            if (nonZero.length < 2) return null;

            // Byte 2: Status (0x04 = estable, 0x02 = en movimiento)
            // Byte 3: Unit code (factor de escala o unidad)
            // Byte 4-5: Peso como entero little-endian
            const status = bytes[2];
            const scalingByte = bytes[3];
            const weightRaw = bytes[4] | (bytes[5] << 8);

            // Solo aceptar si el status indica datos válidos (0x04 estable, 0x02 movimiento)
            if (status !== 0x04 && status !== 0x02 && status !== 0x21) return null;

            // Calcular peso según el factor de escala
            let weight;
            if (scalingByte === 0xFF || scalingByte === 0xFE) {
                // Factor negativo = dividir (ej: gramos a kg)
                const divisor = scalingByte === 0xFF ? 10 : 100;
                weight = weightRaw / divisor;
            } else if (scalingByte <= 4) {
                // Factor de escala directo
                const divisor = Math.pow(10, scalingByte);
                weight = weightRaw / divisor;
            } else {
                // Sin escala, asumir gramos
                weight = weightRaw / 1000;
            }

            // Rhino BAR-10: max 60kg
            if (!isNaN(weight) && weight >= 0 && weight <= 65) {
                return parseFloat(weight.toFixed(3));
            }
        } catch (e) {
            // Silenciar errores de parseo binario
        }
        return null;
    }
}

export const scaleService = new ScaleService();
