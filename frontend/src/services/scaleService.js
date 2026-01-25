export class ScaleService {
    constructor() {
        this.port = null;
        this.reader = null;
        this.isConnected = false;
        this.readableStreamClosed = null;
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

    async disconnect() {
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
        if (!this.port || !this.port.readable) {
             throw new Error("Port not connected or not readable");
        }

        const textDecoder = new TextDecoderStream();
        this.readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
        this.reader = textDecoder.readable.getReader();

        try {
            while (true) {
                const { value, done } = await this.reader.read();
                if (done) {
                    break;
                }
                if (value) {
                    const weight = this.parseWeight(value);
                    if (weight !== null) {
                        onWeightRead(weight);
                    }
                }
            }
        } catch (error) {
            console.error("Error reading from scale:", error);
            throw error;
        } finally {
            this.reader.releaseLock();
        }
    }


    parseWeight(data) {
        // Torrey scales typically send data in a format like:
        // "ST,GS,+  1.500kg" or similar depending on the model and settings.
        // We are looking for numeric patterns.
        // Clean the string
        
        // This regex looks for a number potentially followed by kg or lb
        // It handles spaces and signs
        const weightMatch = data.match(/([0-9]+\.[0-9]+)/);
        
        if (weightMatch && weightMatch[1]) {
            return parseFloat(weightMatch[1]);
        }
        return null;
    }
}

export const scaleService = new ScaleService();
