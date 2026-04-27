export class ScaleService {
    constructor() {
        this.port = null;
        this.reader = null;
        this.isConnected = false;
        this.readableStreamClosed = null;
        this.simulationInterval = null;
        this.pollingInterval = null;
        this.buffer = '';
        this._isConnecting = false;
        this._failCount = 0;
        this._isReading = false;       // ¿Hay un loop de lectura activo?
        this._skipAutoReconnect = false; // Flag para evitar race condition watchdog/finally

        // Estabilización
        this._lastRawWeight = null;
        this._stableTimer = null;
        this._stableWeight = null;
        this._STABLE_MS = 250;

        // ► PATRÓN SUSCRIPTORES: callbacks registrados para recibir peso
        this._subscribers = new Set();
        this._lastWeight = 0;          // Último peso leído (para nuevos suscriptores)
        this._lastDataTime = null;     // Timestamp del último dato recibido

        // ► AUTO-RECONNECT integrado en el servicio
        this._userDisconnected = false;
        this._reconnectCount = 0;
        this._MAX_RECONNECT = 5;
        this._RECONNECT_DELAY = 2000;
        this._watchdogTimer = null;
        this._WATCHDOG_INTERVAL = 15000;
        this._WATCHDOG_CHECK = 5000;
    }

    get isElectron() {
        return !!(window.electron && window.electron.isElectron);
    }

    // ─── SUSCRIPTORES ─────────────────────────────────────
    /**
     * Registra un callback para recibir lecturas de peso.
     * Si ya hay lectura activa, el suscriptor recibe el último peso inmediatamente.
     */
    subscribe(callback) {
        this._subscribers.add(callback);
        // Enviar último peso conocido inmediatamente
        if (this._lastWeight > 0) {
            try { callback(this._lastWeight); } catch (e) { /* ignorar */ }
        }
        console.log(`📬 Suscriptor registrado. Total: ${this._subscribers.size}`);
    }

    /**
     * Elimina un callback de la lista de suscriptores.
     * NO detiene la lectura — otros suscriptores pueden seguir activos.
     */
    unsubscribe(callback) {
        this._subscribers.delete(callback);
        console.log(`📭 Suscriptor removido. Total: ${this._subscribers.size}`);
    }

    /**
     * Notifica a todos los suscriptores con el nuevo peso.
     */
    _notifySubscribers(weight) {
        this._lastWeight = weight;
        this._lastDataTime = Date.now();
        for (const cb of this._subscribers) {
            try { cb(weight); } catch (e) { /* ignorar errores de suscriptores */ }
        }
    }

    // ─── CONEXIÓN ──────────────────────────────────────────
    async connect(baudRate = 9600) {
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

        if (this.isConnected && this.port) {
            console.log("✅ Ya conectado, no se requiere reconexión.");
            // Si ya estamos conectados pero no leyendo, iniciar lectura
            if (!this._isReading) {
                this._startReadingLoop();
            }
            return true;
        }

        this._isConnecting = true;
        this._userDisconnected = false;

        try {
            await this._forceCleanup();
        } catch (e) {
            console.warn("Limpieza previa:", e);
        }

        try {
            console.log("🔍 Solicitando puerto serial...");
            this.port = await navigator.serial.requestPort();

            if (this.port.readable) {
                console.log("♻️ Puerto ya abierto desde sesión previa. Reutilizando.");
                this.isConnected = true;
                this._failCount = 0;
                this._startReadingLoop();
                this._startWatchdog();
                return true;
            }

            console.log("📌 Puerto obtenido, abriendo a", baudRate, "baudios...");
            await this.port.open({ baudRate });
            this.isConnected = true;
            this._failCount = 0;
            console.log("✅ Báscula conectada exitosamente");
            this._startReadingLoop();
            this._startWatchdog();
            return true;

        } catch (error) {
            console.error("❌ Error al conectar báscula:", error.name, error.message);

            if (error.name === 'InvalidStateError') {
                if (this.port && this.port.readable) {
                    console.warn("⚠️ Puerto ya abierto. Reutilizando conexión existente.");
                    this.isConnected = true;
                    this._failCount = 0;
                    this._startReadingLoop();
                    this._startWatchdog();
                    return true;
                }
            }

            this._failCount++;
            this.isConnected = false;

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

    async checkPreviousConnection(baudRate = 9600) {
        if (!navigator.serial) return false;
        if (this._isConnecting) return false;

        // ► Si ya estamos conectados y leyendo, NO tocar nada
        if (this.isConnected && this._isReading) {
            return true;
        }

        if (this._failCount >= 3) {
            console.warn("🛑 Demasiados fallos consecutivos. Auto-connect deshabilitado.");
            return false;
        }

        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length > 0) {
                this.port = ports[0];

                if (this.port.readable) {
                    console.log("♻️ Puerto previo ya abierto. Reutilizando.");
                    this.isConnected = true;
                    this._startReadingLoop();
                    this._startWatchdog();
                    return true;
                }

                try {
                    await this.port.open({ baudRate });
                    this.isConnected = true;
                    this._failCount = 0;
                    this._startReadingLoop();
                    this._startWatchdog();
                    return true;
                } catch (openError) {
                    if (openError.name === 'InvalidStateError' && this.port.readable) {
                        this.isConnected = true;
                        this._startReadingLoop();
                        this._startWatchdog();
                        return true;
                    }
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

    async connectSimulation() {
        console.log("⚠️ Iniciando Modo Simulación");
        this.isConnected = true;
        this._userDisconnected = false;
        this.simulationInterval = setInterval(() => {
            const randomWeight = (Math.random() * 4.5 + 0.5).toFixed(3);
            const simulatedData = `ST,GS,+  ${randomWeight}kg\r\n`;
            const weight = this.parseWeight(simulatedData);
            if (weight !== null) {
                this._notifySubscribers(weight);
            }
        }, 800);
        return true;
    }

    // ─── LIMPIEZA ──────────────────────────────────────────
    async _forceCleanup() {
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

        if (this.reader) {
            try { await this.reader.cancel(); } catch (e) { /* ignorar */ }
            try { this.reader.releaseLock(); } catch (e) { /* ignorar */ }
            this.reader = null;
        }

        if (this.readableStreamClosed) {
            try { await this.readableStreamClosed; } catch (e) { /* ignorar */ }
            this.readableStreamClosed = null;
        }

        await new Promise(resolve => setTimeout(resolve, 150));

        if (this.port) {
            try {
                if (this.port.readable && !this.port.readable.locked) {
                    await this.port.close();
                    console.log("🔒 Puerto cerrado correctamente.");
                } else if (!this.port.readable) {
                    console.log("🔒 Puerto ya estaba cerrado.");
                } else {
                    console.warn("⚠️ Puerto con stream bloqueado. Esperando liberación...");
                    // Esperar un poco más y reintentar
                    await new Promise(resolve => setTimeout(resolve, 500));
                    if (this.port && this.port.readable && !this.port.readable.locked) {
                        await this.port.close();
                        console.log("🔒 Puerto cerrado tras espera.");
                    }
                }
            } catch (e) {
                console.warn("⚠️ Error al cerrar puerto:", e.message);
            }
            this.port = null;
        }

        this.buffer = '';
        this._isReading = false;
    }

    async disconnect() {
        this._userDisconnected = true;
        this._stopWatchdog();
        await this._forceCleanup();
        this.isConnected = false;
        this._failCount = 0;
        this._reconnectCount = 0;
        console.log("🔌 Báscula desconectada.");
    }

    // ─── POLLING ───────────────────────────────────────────
    async sendWeightRequest() {
        if (!this.port || !this.port.writable || this.port.writable.locked) return;

        try {
            const encoder = new TextEncoder();
            const writer = this.port.writable.getWriter();
            await writer.write(encoder.encode('P\r\n'));
            writer.releaseLock();
        } catch (error) {
            // Silenciar
        }
    }

    // ─── LOOP DE LECTURA (INTERNO) ─────────────────────────
    /**
     * Inicia el loop de lectura SOLO si no hay uno activo.
     * Este método es interno — los consumidores usan subscribe/unsubscribe.
     */
    _startReadingLoop() {
        if (this._isReading) {
            console.log("📖 Lectura ya activa, no se reinicia.");
            return;
        }
        // Lanzar el loop sin bloquear
        this._readLoopAsync();
    }

    async _readLoopAsync() {
        if (this._isReading) return;
        if (!this.port || !this.port.readable) {
            console.warn("⚠️ No se puede iniciar lectura: puerto no disponible.");
            return;
        }

        if (this.port.readable.locked) {
            console.warn("⚠️ Stream de lectura ya bloqueado. Esperando liberación...");
            // Esperar a que se libere
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!this.port || !this.port.readable || this.port.readable.locked) {
                console.warn("⚠️ Stream sigue bloqueado. Abortando.");
                return;
            }
        }

        this._isReading = true;
        console.log("📖 Iniciando loop de lectura...");

        // Iniciar polling
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

                    // Parseo binario
                    const binaryWeight = this.parseBinaryWeight(value);
                    if (binaryWeight !== null) {
                        console.log("⚖️ Peso (binario):", binaryWeight, "kg");
                        this._emitStableWeight(binaryWeight);
                        continue;
                    }

                    // Parseo de texto
                    this.buffer += value;
                    const lines = this.buffer.split(/\r\n|\r|\n/);
                    this.buffer = lines.pop();

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (trimmedLine.length > 0) {
                            const weight = this.parseWeight(trimmedLine);
                            if (weight !== null) {
                                console.log("⚖️ Peso (texto):", weight, "kg");
                                this._emitStableWeight(weight);
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

            const msg = (error.message || '').toLowerCase();
            if (msg.includes('lost') || msg.includes('detach') || msg.includes('disconnect')) {
                console.warn("🔌 Dispositivo perdido físicamente. Limpiando estado...");
                this.isConnected = false;
                this.port = null;
                this.buffer = '';
                this._failCount = 0;
            }
        } finally {
            if (this.reader) {
                try { this.reader.releaseLock(); } catch (e) { }
                this.reader = null;
            }
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
            this._isReading = false;

            // ► AUTO-RECONEXIÓN: solo si NO fue el watchdog quien reinició
            //   y NO fue desconexión del usuario
            if (!this._userDisconnected && !this._skipAutoReconnect) {
                console.log('📡 Lectura terminó. Intentando reconexión automática...');
                this._attemptAutoReconnect();
            } else if (this._skipAutoReconnect) {
                console.log('📡 Lectura terminó (reinicio por watchdog, sin auto-reconnect).');
            }
        }
    }

    // ─── AUTO-RECONEXIÓN ───────────────────────────────────
    async _attemptAutoReconnect() {
        if (this._userDisconnected) return;
        if (this._reconnectCount >= this._MAX_RECONNECT) {
            console.warn(`🛑 Máximo de reconexiones alcanzado (${this._MAX_RECONNECT}).`);
            return;
        }

        this._reconnectCount++;
        console.log(`🔄 Reconexión automática (${this._reconnectCount}/${this._MAX_RECONNECT})...`);

        await new Promise(resolve => setTimeout(resolve, this._RECONNECT_DELAY));

        if (this._userDisconnected) return;

        try {
            // Limpiar estado
            this.isConnected = false;
            this._failCount = 0;
            if (this.port) {
                try {
                    if (this.port.readable && !this.port.readable.locked) {
                        await this.port.close();
                    }
                } catch (e) { /* ignorar */ }
                this.port = null;
            }

            const reconnected = await this.checkPreviousConnection();
            if (reconnected) {
                console.log('✅ Reconexión automática exitosa.');
                this._reconnectCount = 0;
            }
        } catch (err) {
            console.warn('⚠️ Reconexión falló:', err.message);
        }
    }

    // ─── WATCHDOG ──────────────────────────────────────────
    _startWatchdog() {
        this._stopWatchdog();
        this._watchdogTimer = setInterval(() => {
            if (this._userDisconnected) return;
            if (!this.isConnected || !this._isReading) return;

            const now = Date.now();
            if (this._lastDataTime && (now - this._lastDataTime) > this._WATCHDOG_INTERVAL) {
                console.warn(`⏰ Watchdog: Sin datos por ${Math.round((now - this._lastDataTime) / 1000)}s. Reiniciando lectura...`);
                // Reiniciar solo el loop de lectura, sin desconectar el puerto
                this._restartReadingLoop();
            }
        }, this._WATCHDOG_CHECK);
    }

    _stopWatchdog() {
        if (this._watchdogTimer) {
            clearInterval(this._watchdogTimer);
            this._watchdogTimer = null;
        }
    }

    async _restartReadingLoop() {
        // ► Señalar al finally block que NO haga auto-reconnect
        this._skipAutoReconnect = true;

        // Cancelar la lectura actual
        if (this.reader) {
            try { await this.reader.cancel(); } catch (e) { /* ignorar */ }
            try { this.reader.releaseLock(); } catch (e) { /* ignorar */ }
            this.reader = null;
        }
        if (this.readableStreamClosed) {
            try { await this.readableStreamClosed; } catch (e) { /* ignorar */ }
            this.readableStreamClosed = null;
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        // Esperar a que el finally block termine de ejecutarse
        await new Promise(resolve => setTimeout(resolve, 500));

        this._isReading = false;
        this._skipAutoReconnect = false;

        // Refrescar timestamp para evitar watchdog inmediato
        this._lastDataTime = Date.now();

        // Si el puerto sigue disponible, reiniciar lectura
        if (this.port && this.port.readable && !this.port.readable.locked) {
            console.log('🔄 Watchdog: reiniciando loop de lectura...');
            this._startReadingLoop();
        } else {
            console.warn("⚠️ Puerto no disponible para reiniciar lectura. Intentando reconexión...");
            this._attemptAutoReconnect();
        }
    }

    // ─── ESTABILIZACIÓN ────────────────────────────────────
    _emitStableWeight(rawWeight) {
        // SIEMPRE actualizar timestamp para que el watchdog sepa que hay datos
        this._lastDataTime = Date.now();

        if (rawWeight !== this._lastRawWeight) {
            // Peso cambió → esperar estabilización antes de notificar
            this._lastRawWeight = rawWeight;
            if (this._stableTimer) clearTimeout(this._stableTimer);
            this._stableTimer = setTimeout(() => {
                if (this._lastRawWeight === rawWeight) {
                    this._stableWeight = rawWeight;
                    this._notifySubscribers(rawWeight);
                }
            }, this._STABLE_MS);
        } else if (this._stableWeight === rawWeight) {
            // Peso igual y estable → re-notificar periódicamente para mantener UI viva
            // (Sin timer de estabilización, envío directo cada lectura)
            this._notifySubscribers(rawWeight);
        }
    }

    // ─── PARSEO ────────────────────────────────────────────
    parseWeight(data) {
        if (/\blb\b/i.test(data)) {
            console.warn('⚖️ Lectura en libras detectada, ignorando:', data);
            return null;
        }

        const weightMatch = data.match(/([-+]?\s*[0-9]+(?:\.[0-9]+)?)\s*(?:kg)?/i);
        if (weightMatch && weightMatch[1]) {
            const cleanNumber = weightMatch[1].replace(/\s+/g, '');
            const weight = parseFloat(cleanNumber);
            if (!isNaN(weight) && weight >= 0 && weight <= 65) {
                return parseFloat(weight.toFixed(3));
            }
        }
        return null;
    }

    parseBinaryWeight(rawString) {
        try {
            const bytes = [];
            for (let i = 0; i < rawString.length; i++) {
                bytes.push(rawString.charCodeAt(i));
            }

            if (bytes.length < 6) return null;

            const nonZero = bytes.filter(b => b !== 0);
            if (nonZero.length < 2) return null;

            const status = bytes[2];
            const scalingByte = bytes[3];
            const weightRaw = bytes[4] | (bytes[5] << 8);

            if (status !== 0x04 && status !== 0x02 && status !== 0x21) return null;

            let weight;
            if (scalingByte === 0xFF || scalingByte === 0xFE) {
                const divisor = scalingByte === 0xFF ? 10 : 100;
                weight = weightRaw / divisor;
            } else if (scalingByte <= 4) {
                const divisor = Math.pow(10, scalingByte);
                weight = weightRaw / divisor;
            } else {
                weight = weightRaw / 1000;
            }

            if (!isNaN(weight) && weight >= 0 && weight <= 65) {
                return parseFloat(weight.toFixed(3));
            }
        } catch (e) {
            // Silenciar
        }
        return null;
    }

    // ─── COMPATIBILIDAD LEGACY ─────────────────────────────
    /**
     * Método legacy para compatibilidad con código que llame readWeight(callback).
     * Internamente registra el callback como suscriptor y delega al loop.
     */
    async readWeight(onWeightRead) {
        if (onWeightRead) {
            this.subscribe(onWeightRead);
        }
        if (!this._isReading) {
            this._startReadingLoop();
        }
    }
}

export const scaleService = new ScaleService();
