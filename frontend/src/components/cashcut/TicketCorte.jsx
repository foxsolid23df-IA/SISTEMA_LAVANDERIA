import React, { forwardRef } from 'react';
import { formatearDinero, formatearFechaHora } from '../../utils';

const TicketCorte = forwardRef(({ cutResult, settings, cutType }, ref) => {
    if (!cutResult) return null;

    const isDayCut = cutType === 'dia';
    const storeName = settings?.name || 'MI TIENDA';

    return (
        <div 
            ref={ref} 
            className="ticket-corte"
            style={{ 
                width: settings?.printer_width ? `${settings.printer_width}mm` : '80mm',
                fontSize: settings?.printer_font_size ? `${settings.printer_font_size}px` : '12px',
                paddingLeft: settings?.printer_margin ? `${settings.printer_margin}px` : '0px',
                paddingRight: settings?.printer_margin ? `${settings.printer_margin}px` : '0px',
                margin: '0 auto',
                backgroundColor: 'white',
                color: 'black',
                fontFamily: "'Courier New', Courier, monospace"
            }}
        >
            <div className="ticket-header" style={{ textAlign: 'center', marginBottom: '10px' }}>
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
                <div style={{ fontSize: '1.2em', fontWeight: 'bold', uppercase: 'true' }}>{storeName}</div>
                <div style={{ fontSize: '0.9em', fontWeight: 'bold' }}>
                    {isDayCut ? 'CIERRE FINAL DEL DÍA' : 'CORTE DE TURNO'}
                </div>
                <div style={{ fontSize: '0.8em', marginTop: '5px' }}>{formatearFechaHora(new Date())}</div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            <div className="ticket-info" style={{ fontSize: '0.9em' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Operador:</span>
                    <span style={{ fontWeight: 'bold' }}>{cutResult.staffName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Terminal:</span>
                    <span style={{ fontWeight: 'bold' }}>{cutResult.terminal_id?.slice(-8) || 'Caja Principal'}</span>
                </div>
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            <div className="ticket-totals" style={{ spaceY: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>FONDO INICIAL:</span>
                    <span style={{ fontWeight: 'bold' }}>{formatearDinero(cutResult.opening_fund || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>VENTAS ({cutResult.salesCount}):</span>
                    <span style={{ fontWeight: 'bold' }}>{formatearDinero(cutResult.salesTotal)}</span>
                </div>
                
                {cutResult.cardTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>TARJETA:</span>
                        <span style={{ fontWeight: 'bold' }}>{formatearDinero(cutResult.cardTotal)}</span>
                    </div>
                )}
                
                {cutResult.transferTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>TRANSFERENCIA:</span>
                        <span style={{ fontWeight: 'bold' }}>{formatearDinero(cutResult.transferTotal)}</span>
                    </div>
                )}

                <div style={{ borderBottom: '1px dotted #000', margin: '5px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', fontWeight: 'bold' }}>
                    <span>ESPERADO MXN:</span>
                    <span>{formatearDinero(cutResult.expectedCash)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1em', fontWeight: 'bold' }}>
                    <span>CONTADO MXN:</span>
                    <span>{formatearDinero(cutResult.actualCash)}</span>
                </div>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '1.1em', 
                    fontWeight: 'bold',
                    color: cutResult.difference === 0 ? 'black' : cutResult.difference > 0 ? 'blue' : 'red'
                }}>
                    <span>DIFERENCIA:</span>
                    <span>{cutResult.difference === 0 ? 'CORRECTO' : formatearDinero(cutResult.difference)}</span>
                </div>

                {cutResult.expectedUSD > 0 && (
                    <>
                        <div style={{ borderBottom: '1px dotted #000', margin: '5px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>ESPERADO USD:</span>
                            <span style={{ fontWeight: 'bold' }}>{formatearDinero(cutResult.expectedUSD, 'USD')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>CONTADO USD:</span>
                            <span style={{ fontWeight: 'bold' }}>{formatearDinero(cutResult.actualUSD, 'USD')}</span>
                        </div>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontWeight: 'bold',
                            color: cutResult.differenceUSD === 0 ? 'black' : cutResult.differenceUSD > 0 ? 'blue' : 'red' 
                        }}>
                            <span>DIFERENCIA USD:</span>
                            <span>{cutResult.differenceUSD === 0 ? 'CORRECTO' : formatearDinero(cutResult.differenceUSD, 'USD')}</span>
                        </div>
                    </>
                )}
            </div>

            <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />

            {cutResult.notes && (
                <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.8em' }}>OBSERVACIONES:</div>
                    <div style={{ fontSize: '0.8em', fontStyle: 'italic' }}>{cutResult.notes}</div>
                    <div style={{ borderBottom: '1px dashed #000', margin: '5px 0' }} />
                </div>
            )}

            <div style={{ textAlign: 'center', fontSize: '0.8em', marginTop: '10px' }}>
                SISTEMA LAVANDERIA PRO 2026<br />
                Reporte de Auditoría de Caja
            </div>
        </div>
    );
});

export default TicketCorte;
