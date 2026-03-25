import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TicketVenta from '../components/sales/TicketVenta';
import React from 'react';

// Mock muy simple
vi.mock('../../utils', () => ({
    formatearDinero: (val) => `${val}`, // Sin simbolo, para simplificar regex
    formatearFechaHora: () => 'FECHA_MOCK'
}));

describe('<TicketVenta />', () => {
    const mockVenta = {
        id: '123456789',
        total: 100,
        paid_amount: 50,
        metodo_pago: 'cash',
        promised_at: new Date('2026-02-01').toISOString(),
        productos: [
            { name: 'Lavado', quantity: 2, price: 25, pricing_type: 'pza' },
            { name: 'Secado', quantity: 1, price: 50, pricing_type: 'kg' }
        ],
        cliente: { name: 'Juan Perez', phone: '555-1234' },
        notes: 'Urgente'
    };

    const mockSettings = {
        name: 'Lavandería Clean',
        ticket_message: 'Gracias'
    };

    it('Smoke Test: Renderiza sin errores', () => {
        render(<TicketVenta venta={mockVenta} settings={mockSettings} />);
        expect(screen.getByText(/Lavandería Clean/i)).toBeInTheDocument();
        expect(screen.getByText(/Juan Perez/i)).toBeInTheDocument();
    });

    it('Muestra los items de venta', () => {
        render(<TicketVenta venta={mockVenta} settings={mockSettings} />);
        expect(screen.getByText('Lavado')).toBeInTheDocument();
        expect(screen.getByText('Secado')).toBeInTheDocument();
    });

    it('Muestra desglose de IVA si aplica', () => {
        const ventaConIva = {
            ...mockVenta,
            has_tax: true,
            tax_amount: 16,
            total: 116,
        };
        render(<TicketVenta venta={ventaConIva} settings={mockSettings} />);
        expect(screen.getByText('SUBTOTAL:')).toBeInTheDocument();
        expect(screen.getByText('IVA (16%):')).toBeInTheDocument();
    });
});
