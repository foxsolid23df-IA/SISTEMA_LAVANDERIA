import React, { forwardRef } from 'react';
import { formatearDinero, formatearFechaHora } from '../../utils';
import './TicketVenta.css';

// Componente para mostrar el ticket de venta (simple y profesional)
const TicketVenta = forwardRef(({ venta }, ref) => {
    if (!venta) return null;

    const saldoPendiente = venta.total - (venta.paid_amount || 0);

    return (
        <div ref={ref} className="ticket-venta">
            <div className="ticket-header">
                <div className="ticket-title">COMPROBANTE DE RECEPCIÓN</div>
                <div className="ticket-orden">ORDEN #{venta.id.toString().slice(-6).toUpperCase()}</div>
                <div className="ticket-fecha">{formatearFechaHora(new Date())}</div>
            </div>

            <div className="ticket-linea" />
            
            <div className="ticket-cliente-info">
                <div className="font-bold uppercase">Cliente: {venta.cliente?.name || 'Cliente General'}</div>
                {venta.cliente?.phone && <div>Tel: {venta.cliente.phone}</div>}
            </div>

            <div className="ticket-linea" />

            <div className="ticket-productos">
                {venta.productos.map((item, idx) => (
                    <div key={idx} className="ticket-producto">
                        <div className="ticket-producto-nombre">{item.name}</div>
                        <div className="ticket-producto-detalle">
                            <span>{item.quantity} {item.pricing_type === 'kg' ? 'kg' : 'pza'} x {formatearDinero(item.price)}</span>
                            <span>{formatearDinero(item.price * item.quantity)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ticket-linea" />

            <div className="ticket-summary">
                <div className="ticket-summary-row">
                    <span>TOTAL:</span>
                    <span>{formatearDinero(venta.total)}</span>
                </div>
                <div className="ticket-summary-row">
                    <span>PAGADO (ANTICIPO):</span>
                    <span>{formatearDinero(venta.paid_amount || 0)}</span>
                </div>
                <div className={`ticket-summary-row font-bold ${saldoPendiente > 0 ? 'ticket-pendente' : ''}`}>
                    <span>SALDO PENDIENTE:</span>
                    <span>{formatearDinero(Math.max(0, saldoPendiente))}</span>
                </div>
            </div>

            <div className="ticket-linea" />

            <div className="ticket-entrega-section">
                <div className="font-bold text-center">FECHA DE ENTREGA</div>
                <div className="text-center font-bold" style={{ fontSize: '16px', margin: '5px 0' }}>
                    {new Date(venta.promised_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {venta.notes && (
                <>
                    <div className="ticket-linea" />
                    <div className="ticket-notes">
                        <div className="font-bold">NOTAS:</div>
                        <div style={{ fontSize: '11px', fontStyle: 'italic' }}>{venta.notes}</div>
                    </div>
                </>
            )}

            <div className="ticket-linea" />
            <div className="ticket-footer">
                ¡Gracias por su confianza!<br />
                Favor de traer este ticket para su entrega.
            </div>
        </div>
    );
});

export default TicketVenta;
