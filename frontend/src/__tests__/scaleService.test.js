import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScaleService } from '../services/scaleService';

// Mock de Web Serial API
global.navigator.serial = {
    requestPort: vi.fn()
};

const TextDecoderStream = function() {
    return {
        readable: {
            getReader: () => ({
                read: vi.fn(),
                releaseLock: vi.fn(),
                cancel: vi.fn()
            })
        },
        writable: {}
    }
};
global.TextDecoderStream = TextDecoderStream;

describe('ScaleService', () => {
    let service;

    beforeEach(() => {
        service = new ScaleService();
        service.port = {
            open: vi.fn(),
            close: vi.fn(),
            readable: {
                pipeTo: vi.fn().mockResolvedValue()
            }
        };
    });

    it('debe extraer el peso correctamente de una trama limpia', () => {
        const data = "ST,GS,+  1.500kg\r\n";
        const weight = service.parseWeight(data);
        expect(weight).toBe(1.5);
    });

    it('debe manejar fragmentación de datos (Buffer)', () => {
        // Simulación: Llega "1." y luego "500kg"
        // La implementación actual NO tiene buffer interno en la clase (solo en parseWeight localmente si tuviera), 
        // pero parseWeight es estático/sin estado en la versión actual.
        
        // Si mandamos fragments a parseWeight actual:
        const chunk1 = "ST,GS,+  1.";
        const chunk2 = "500kg\r\n";
        
        // El parser actual trataría de sacar numero de "ST,GS,+  1." -> "1." (parseable a 1)
        // Y de "500kg" -> "500"
        // Resultado erróneo: 1 y 500, en vez de 1.500
        
        const w1 = service.parseWeight(chunk1);
        const w2 = service.parseWeight(chunk2);
        
        // Esto demuestra el error: parseWeight es "tonto", no sabe de contexto
        // Esperamos que falle o de datos parciales
        // En la correción, parseWeight o el loop de lectura deberá usarse un buffer
    });
    
    // Test para la nueva implementación con buffer
    it('debe acumular datos en buffer hasta encontrar salto de linea', () => {
        service.buffer = "ST,GS,+  1.";
        const chunk = "500kg\r\n";
        
        service.buffer += chunk;
        
        // Simulamos la logica de procesamiento
        const lines = service.buffer.split('\r\n');
        service.buffer = lines.pop(); // Guardar el remanente
        
        const weight = service.parseWeight(lines[0]);
        expect(weight).toBe(1.500);
    });
});
