import React, { forwardRef } from 'react';
import { formatearDinero, formatearFechaHora } from '../../utils';
import './TicketVenta.css';

// Componente para mostrar el ticket de venta (simple y profesional)
const TicketVenta = forwardRef(({ venta, settings }, ref) => {
    if (!venta) return null;

    const saldoPendiente = venta.total - (venta.paid_amount || 0);

    return (
        <div 
            ref={ref} 
            className="ticket-venta"
            style={{ 
                width: settings?.printer_width ? `${settings.printer_width}mm` : '80mm',
                fontSize: settings?.printer_font_size ? `${settings.printer_font_size}px` : '12px',
                paddingLeft: settings?.printer_margin ? `${settings.printer_margin}px` : '0px',
                paddingRight: settings?.printer_margin ? `${settings.printer_margin}px` : '0px',
                margin: '0 auto',
                backgroundColor: 'white',
                color: 'black'
            }}
        >
            <div className="ticket-header" style={{ fontSize: 'inherit' }}>
                {/* Logo del negocio */}
                {settings?.logo_url && (
                    <div style={{ marginBottom: '10px' }}>
                        <img 
                            src={settings.logo_url} 
                            alt="Logo" 
                            style={{ 
                                maxWidth: '100%', 
                                maxHeight: '80px', 
                                objectFit: 'contain',
                                margin: '0 auto' 
                            }} 
                        />
                    </div>
                )}

                {/* Info del Negocio */}
                {settings?.name && (
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '5px' }}>
                        {settings.name}
                    </div>
                )}
                
                {(settings?.address || settings?.phone) && (
                    <div style={{ fontSize: '0.9em', marginBottom: '10px', whiteSpace: 'pre-wrap' }}>
                        {settings?.address && <div>{settings.address}</div>}
                        {settings?.phone && <div>Tel: {settings.phone}</div>}
                    </div>
                )}

                <div className="ticket-title" style={{ fontWeight: 'bold' }}>COMPROBANTE DE RECEPCIÓN</div>
                <div className="ticket-orden" style={{ fontWeight: 'bold' }}>ORDEN #{venta.id.toString().slice(-6).toUpperCase()}</div>
                <div className="ticket-fecha">{formatearFechaHora(new Date())}</div>
            </div>

            <div className="ticket-linea" style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />
            
            <div className="ticket-cliente-info" style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Cliente: {venta.cliente?.name || 'Cliente General'}</div>
                {venta.cliente?.phone && <div>Tel: {venta.cliente.phone}</div>}
            </div>

            <div className="ticket-linea" style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            <div className="ticket-productos">
                {venta.productos.map((item, idx) => (
                    <div key={idx} className="ticket-producto" style={{ marginBottom: '5px' }}>
                        <div className="ticket-producto-nombre" style={{ fontWeight: 'bold', textAlign: 'left' }}>{item.name}</div>
                        <div className="ticket-producto-detalle" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{item.quantity} {item.pricing_type === 'kg' ? 'kg' : 'pza'} x {formatearDinero(item.price)}</span>
                            <span>{formatearDinero(item.price * item.quantity)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="ticket-linea" style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            <div className="ticket-summary">
                <div className="ticket-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>TOTAL A PAGAR:</span>
                    <span>{formatearDinero(venta.total)}</span>
                </div>
                <div className="ticket-summary-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>PAGADO (ANTICIPO):</span>
                    <span>{formatearDinero(venta.paid_amount || 0)}</span>
                </div>
                <div className="ticket-summary-row" style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>{saldoPendiente > 0 ? 'SALDO PENDIENTE:' : 'ORDEN PAGADA'}</span>
                    <span>{saldoPendiente > 0 ? formatearDinero(saldoPendiente) : '$ 0.00'}</span>
                </div>
            </div>

            <div className="ticket-linea" style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            <div className="ticket-entrega-section">
                <div style={{ fontWeight: 'bold', textAlign: 'center' }}>FECHA DE ENTREGA</div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2em', margin: '5px 0' }}>
                    {new Date(venta.promised_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {venta.notes && (
                <>
                    <div className="ticket-linea" style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />
                    <div className="ticket-notes" style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: 'bold' }}>NOTAS:</div>
                        <div style={{ fontSize: '0.9em', fontStyle: 'italic' }}>{venta.notes}</div>
                    </div>
                </>
            )}

            <div className="ticket-linea" style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />
            <div className="ticket-footer" style={{ textAlign: 'center', fontSize: '0.9em' }}>
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
