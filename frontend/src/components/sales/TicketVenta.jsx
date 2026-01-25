import React, { forwardRef } from 'react';
import { formatearDinero, formatearFechaHora } from '../../utils';
import './TicketVenta.css';

// Componente para mostrar el ticket de venta (simple y profesional)
const TicketVenta = forwardRef(({ venta, settings }, ref) => {
    if (!venta) return null;

    const saldoPendiente = venta.total - (venta.paid_amount || 0);

    return (
        <div ref={ref} className="ticket-venta">
            <div className="ticket-header">
                {/* Logo del negocio */}
                {settings?.logo_url && (
                    <div style={{ marginBottom: '10px' }}>
                        <img 
                            src={settings.logo_url} 
                            alt="Logo" 
                            style={{ 
                                maxWidth: '100px', 
                                maxHeight: '80px', 
                                objectFit: 'contain',
                                margin: '0 auto' 
                            }} 
                        />
                    </div>
                )}

                {/* Info del Negocio */}
                {settings?.name && (
                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
                        {settings.name}
                    </div>
                )}
                
                {(settings?.address || settings?.phone) && (
                    <div style={{ fontSize: '11px', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
                        {settings?.address && <div>{settings.address}</div>}
                        {settings?.phone && <div>Tel: {settings.phone}</div>}
                    </div>
                )}

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
                <div className="ticket-summary-row font-bold">
                    <span>TOTAL A PAGAR:</span>
                    <span>{formatearDinero(venta.total)}</span>
                </div>
                <div className="ticket-summary-row">
                    <span>PAGADO (ANTICIPO):</span>
                    <span>{formatearDinero(venta.paid_amount || 0)}</span>
                </div>
                <div className={`ticket-summary-row font-bold ${saldoPendiente > 0 ? 'ticket-pendente' : 'text-emerald-600'}`}>
                    <span>{saldoPendiente > 0 ? 'SALDO PENDIENTE:' : 'ORDEN PAGADA'}</span>
                    <span>{saldoPendiente > 0 ? formatearDinero(Math.max(0, saldoPendiente)) : ''}</span>
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
                {settings?.ticket_message ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>{settings.ticket_message}</div>
                ) : (
                    <>
                        ¡Gracias por su confianza!<br />
                        Favor de traer este ticket para su entrega.
                    </>
                )}
            </div>
        </div>
    );
});

export default TicketVenta;
