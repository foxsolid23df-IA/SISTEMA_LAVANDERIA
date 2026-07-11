import React, { forwardRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatearDinero, formatearFechaHora } from "../../utils";
import "./TicketVenta.css";

// Componente para mostrar el ticket de venta (simple y profesional)
const TicketVenta = forwardRef(({ venta, settings }, ref) => {
  if (!venta) return null;

  const saldoPendiente = venta.total - (venta.paid_amount || 0);
  const hasTax = venta.has_tax || venta.invoice_requested;
  const taxAmount = parseFloat(venta.tax_amount) || 0;
  const subtotal = (parseFloat(venta.total) || 0) - taxAmount;

  return (
    <div
      ref={ref}
      className="ticket-venta"
      data-printer-width={settings?.printer_width || 80}
      style={{
        width: settings?.printer_width ? `${settings.printer_width}mm` : "80mm",
        maxWidth: "100%",
        fontSize: settings?.printer_font_size
          ? `${settings.printer_font_size}px`
          : "12px",
        fontFamily:
          settings?.printer_font_family || "'Courier New', Courier, monospace",
        fontWeight: settings?.printer_is_bold ? "bold" : "normal",
        paddingLeft: settings?.printer_margin
          ? `${settings.printer_margin}px`
          : "2px",
        paddingRight: settings?.printer_margin
          ? `${settings.printer_margin}px`
          : "2px",
        paddingBottom: "30px",
        margin: "0 auto",
        backgroundColor: "white",
        color: "black",
        boxSizing: "border-box",
        overflow: "visible",
        overflowWrap: "break-word",
        wordBreak: "break-word",
        whiteSpace: "pre-wrap",
      }}
    >
      <div
        className="ticket-header"
        style={{ fontSize: "inherit", textAlign: "center", marginBottom: "15px" }}
      >
        {/* Logo del negocio */}
        {settings?.logo_url && (
          <div style={{ marginBottom: "12px" }}>
            <img
              src={settings.logo_url}
              alt="Logo"
              style={{
                maxWidth: "100%",
                maxHeight: "90px",
                objectFit: "contain",
                margin: "0 auto",
                filter: "grayscale(100%)", // Para impresoras térmicas
              }}
            />
          </div>
        )}

        {/* Info del Negocio */}
        {settings?.name && (
          <div
            style={{
              fontSize: "1.3em",
              fontWeight: "900",
              marginBottom: "4px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            {settings.name}
          </div>
        )}

        {(settings?.address || settings?.phone) && (
          <div
            style={{
              fontSize: "0.85em",
              marginBottom: "12px",
              lineHeight: "1.3",
              color: "#333"
            }}
          >
            {settings?.address && <div>{settings.address}</div>}
            {settings?.phone && <div style={{ fontWeight: "bold" }}>Tel: {settings.phone}</div>}
          </div>
        )}

        <div
          className="ticket-title"
          style={{ 
            fontWeight: "bold", 
            fontSize: "1em", 
            marginTop: "8px",
            border: "1.5px solid black",
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: "4px"
          }}
        >
          COMPROBANTE DE RECEPCIÓN
        </div>
        
        <div
          className="ticket-orden"
          style={{ 
            fontWeight: "900", 
            fontSize: "1.4em",
            marginTop: "10px",
            letterSpacing: "1px"
          }}
        >
          ORDEN #
          {venta.folio
            ? venta.folio.toString().padStart(6, "0")
            : (venta.ticket_uuid?.slice(0, 8).toUpperCase() || venta.id.toString().slice(-6).toUpperCase())}
        </div>

        <div
          className="ticket-fecha"
          style={{ fontSize: "0.85em", marginTop: "4px", opacity: 0.8 }}
        >
          {formatearFechaHora(new Date())}
        </div>
      </div>

      <div
        className="ticket-linea"
        style={{ borderBottom: "1px dashed #000", margin: "5px 0" }}
      />

      <div className="ticket-cliente-info" style={{ textAlign: "left" }}>
        <div style={{ fontWeight: "bold", textTransform: "uppercase" }}>
          Cliente: {venta.cliente?.name || "Cliente General"}
        </div>
        {venta.cliente?.phone && <div>Tel: {venta.cliente.phone}</div>}
      </div>

      <div
        className="ticket-linea"
        style={{ borderBottom: "1px dashed #000", margin: "5px 0" }}
      />

      <div className="ticket-productos">
        {venta.productos?.length > 0 ? venta.productos.map((item, idx) => (
          <div
            key={idx}
            className="ticket-producto"
            style={{
              marginBottom: "5px",
              borderBottom: "1px dotted #ccc",
              paddingBottom: "2px",
            }}
          >
            <div
              className="ticket-producto-nombre"
              style={{ fontWeight: "bold", textAlign: "left", width: "100%" }}
            >
              {item.name}
            </div>
            <div
              className="ticket-producto-detalle"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                fontSize: "0.95em",
              }}
            >
              <span style={{ marginRight: "5px" }}>
                {item.quantity} {item.pricing_type === "kg" ? "kg" : "pza"} x{" "}
                {formatearDinero(item.price)}
              </span>
              <span style={{ textAlign: "right", minWidth: "60px" }}>
                {formatearDinero(item.price * item.quantity)}
              </span>
            </div>
          </div>
        ))}
        ) : (
          <div style={{textAlign: "center", fontStyle: "italic", fontSize: "0.9em", padding: "5px 0"}}>
            Sin artículos registrados
          </div>
        )}
      </div>

      <div
        className="ticket-linea"
        style={{ borderBottom: "1px dashed #000", margin: "5px 0" }}
      />

      <div className="ticket-summary">
        {hasTax && (
          <>
            <div
              className="ticket-summary-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.95em",
              }}
            >
              <span>SUBTOTAL:</span>
              <span>{formatearDinero(subtotal)}</span>
            </div>
            <div
              className="ticket-summary-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.95em",
              }}
            >
              <span>IVA ({settings?.tax_percentage !== undefined && settings?.tax_percentage !== null ? settings.tax_percentage : 16}%):</span>
              <span>{formatearDinero(taxAmount)}</span>
            </div>
          </>
        )}
        <div
          className="ticket-summary-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            fontSize: "1.1em",
          }}
        >
          <span>TOTAL:</span>
          <span>{formatearDinero(venta.total)}</span>
        </div>
        <div
          className="ticket-summary-row"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <span>PAGADO:</span>
          <span>{formatearDinero(venta.paid_amount || 0)}</span>
        </div>
        <div
          className="ticket-summary-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.8em",
            textTransform: "uppercase",
            marginTop: "2px",
          }}
        >
          <span>MÉTODO PAGO:</span>
          <span>
            {(venta.metodo_pago || venta.payment_method) === "cash"
              ? "EFECTIVO"
              : (venta.metodo_pago || venta.payment_method) === "card"
                ? "TARJETA"
                : (venta.metodo_pago || venta.payment_method) === "transferencia"
                  ? "TRANSFERENCIA"
                  : (venta.metodo_pago || venta.payment_method) || "N/A"}
          </span>
        </div>
        <div
          className="ticket-summary-row"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: "bold",
            marginTop: "2px",
          }}
        >
          <span>{saldoPendiente > 0.01 ? "PENDIENTE:" : "PAGADO"}</span>
          <span>
            {saldoPendiente > 0.01 ? formatearDinero(saldoPendiente) : "$ 0.00"}
          </span>
        </div>

        {/* Mostrar cambio solo si se ingresó un monto recibido y fue pago en efectivo */}
        {venta.metodo_pago === "cash" && venta.monto_recibido > 0 && (
          <>
            <div
              className="ticket-linea"
              style={{ borderBottom: "1px dotted #000", margin: "5px 0" }}
            />
            {venta.pagos_multimoneda && Object.keys(venta.pagos_multimoneda).length > 0 ? (
               Object.keys(venta.pagos_multimoneda).map(curr => {
                  const val = parseFloat(venta.pagos_multimoneda[curr]);
                  if (val > 0) {
                     return (
                      <div
                        key={curr}
                        className="ticket-summary-row"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.9em",
                        }}
                      >
                        <span>RECIBIDO ({curr}):</span>
                        <span>
                          {curr === 'MXN' ? formatearDinero(val) : val.toFixed(2)}
                        </span>
                      </div>
                     );
                  }
                  return null;
               })
            ) : (
                <div
                  className="ticket-summary-row"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.9em",
                  }}
                >
                  <span>
                    {venta.usar_usd
                      ? `RECIBIDO (U$ ${venta.monto_recibido})`
                      : "RECIBIDO:"}
                  </span>
                  <span>
                    {venta.usar_usd
                      ? formatearDinero(
                          venta.monto_recibido * (venta.exchange_rate || 1),
                        )
                      : formatearDinero(venta.monto_recibido)}
                  </span>
                </div>
            )}
            <div
              className="ticket-summary-row"
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
              }}
            >
              <span>CAMBIO:</span>
              <span>
                {(() => {
                  const recibidoMXN = venta.pagos_multimoneda && Object.keys(venta.pagos_multimoneda).length > 0 
                    ? venta.monto_recibido // It was passed as MXN total in Sales.jsx changes 
                    : venta.usar_usd
                      ? venta.monto_recibido * (venta.exchange_rate || 1)
                      : venta.monto_recibido;
                  const baseCobro =
                    venta.paid_amount > 0 ? venta.paid_amount : venta.total;
                  return formatearDinero(Math.max(0, recibidoMXN - baseCobro));
                })()}
              </span>
            </div>
          </>
        )}
      </div>

      <div
        className="ticket-linea"
        style={{ borderBottom: "1px dashed #000", margin: "5px 0" }}
      />

      <div className="ticket-entrega-section">
        <div style={{ fontWeight: "bold", textAlign: "center" }}>
          FECHA DE ENTREGA
        </div>
        <div
          style={{
            textAlign: "center",
            fontWeight: "bold",
            fontSize: "1.2em",
            margin: "5px 0",
          }}
        >
          {new Date(venta.promised_at).toLocaleDateString(undefined, {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {venta.notes && (
        <>
          <div
            className="ticket-linea"
            style={{ borderBottom: "1px dashed #000", margin: "5px 0" }}
          />
          <div className="ticket-notes" style={{ textAlign: "left" }}>
            {venta.notes.includes("IA INSPECCIÓN") ? (
              <div
                style={{
                  border: "2px solid black",
                  padding: "5px",
                  borderRadius: "4px",
                  marginTop: "5px",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    textAlign: "center",
                    fontSize: "1.1em",
                  }}
                >
                  ⚠️ REPORTE DE DAÑOS
                </div>
                <div
                  style={{
                    fontSize: "0.9em",
                    fontWeight: "bold",
                    marginTop: "4px",
                  }}
                >
                  {venta.notes.replace("IA INSPECCIÓN:", "").trim()}
                </div>
                <div
                  style={{
                    fontSize: "0.7em",
                    fontStyle: "italic",
                    marginTop: "6px",
                    textAlign: "center",
                  }}
                >
                  "Acepto el estado de recepción y los riesgos mencionados."
                  <br />
                  <br />
                  _______________________
                  <br />
                  Firma del Cliente
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontWeight: "bold" }}>NOTAS:</div>
                <div style={{ fontSize: "0.9em", fontStyle: "italic" }}>
                  {venta.notes}
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div
        className="ticket-linea"
        style={{ borderBottom: "1px dashed #000", margin: "5px 0" }}
      />

      {/* SECCIÓN DE FACTURACIÓN PREMIUM CON QR - Solo si está habilitado */}
      {settings?.enable_billing_system && (
      <div
        className="ticket-billing-section"
        style={{
          border: "1.5px solid black",
          padding: "8px 6px",
          marginTop: "15px",
          textAlign: "center",
          borderRadius: "6px",
          backgroundColor: "#f9f9f9",
          boxSizing: "border-box",
          maxWidth: "100%",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        <div style={{ fontWeight: "900", fontSize: "0.95em", marginBottom: "8px" }}>
          🚀 AUTO-FACTURA EN LÍNEA
        </div>
        
        {/* QR Code Container */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          gap: "8px",
          marginBottom: "10px" 
        }}>
          <div style={{ background: "white", padding: "5px", borderRadius: "4px" }}>
            <QRCodeSVG 
              value={`${settings?.billing_url || "https://pos-autofactura.vercel.app/"}?folio=${venta.folio || (venta.ticket_uuid?.slice(0, 8).toUpperCase()) || venta.id}&pin=${venta.pin || venta.pin_facturacion || "0000"}&total=${venta.total}`}
              size={100}
              level="M"
              includeMargin={false}
            />
          </div>
          <div style={{ fontSize: "0.7em", lineHeight: "1.2" }}>
            Escanea para facturar instantáneamente<br/>
            o ingresa a:
          </div>
        </div>

        <div style={{ fontSize: "0.7em", fontWeight: "900", margin: "2px 0", wordBreak: "break-all", overflowWrap: "break-word", maxWidth: "100%" }}>
           {settings?.billing_url || "https://pos-autofactura.vercel.app/"}
        </div>
        
        <div style={{ borderTop: "1px dashed #ccc", margin: "8px 0" }}></div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9em", marginBottom: "2px" }}>
          <span>FOLIO:</span>
          <span style={{ fontWeight: "900" }}>
             {venta.folio || (venta.ticket_uuid?.slice(0, 8).toUpperCase()) || venta.id}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1em" }}>
          <span>PIN DE SEGURIDAD:</span>
          <span style={{ fontWeight: "900", fontSize: "1.1em" }}>{venta.pin || venta.pin_facturacion || "N/A"}</span>
        </div>
        
        <div style={{ 
          fontSize: "0.75em", 
          marginTop: "8px", 
          fontStyle: "italic",
          opacity: 0.8
        }}>
          Válido durante el mes de compra.
        </div>
      </div>
      )}

      {/* SECCIÓN DE ESTANTERÍA - QR DE LOCALIZACIÓN */}
      {settings?.shelving_enabled && venta.shelfAssignment && (
        <div
          className="ticket-shelving-section"
          style={{
            border: "1.5px solid #10b981",
            padding: "8px 6px",
            marginTop: "12px",
            textAlign: "center",
            borderRadius: "6px",
            backgroundColor: "#f0fdf4",
          }}
        >
          <div style={{ fontWeight: "900", fontSize: "0.95em", marginBottom: "6px", color: "#065f46" }}>
            UBICACIÓN DE ROPA
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <div style={{ background: "white", padding: "5px", borderRadius: "4px" }}>
              <QRCodeSVG
                value={`${window.location.origin}${window.location.pathname}#/shelving/scan?orderId=${venta.id}&shelf=${venta.shelfAssignment?.shelf?.label || ''}`}
                size={90}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>

          <div style={{ borderTop: "1px dashed #10b981", margin: "6px 0" }}></div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9em", marginBottom: "2px" }}>
            <span>ESTANTERÍA:</span>
            <span style={{ fontWeight: "900", color: "#065f46", fontSize: "1.1em" }}>
              {venta.shelfAssignment?.shelf?.label || 'N/A'}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8em" }}>
            <span>FILA:</span>
            <span style={{ fontWeight: "700" }}>{venta.shelfAssignment?.shelf?.row_label || 'N/A'}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8em" }}>
            <span>COLUMNA:</span>
            <span style={{ fontWeight: "700" }}>{venta.shelfAssignment?.shelf?.column_number || 'N/A'}</span>
          </div>

          <div style={{ fontSize: "0.7em", marginTop: "6px", color: "#64748b" }}>
            Escanea el QR para localizar la ropa
          </div>
        </div>
      )}

      <div
        className="ticket-footer"
        style={{ textAlign: "center", fontSize: "0.9em", marginTop: "10px", paddingBottom: "20px" }}
      >
        {settings?.ticket_message ? (
          <div style={{ whiteSpace: "pre-wrap" }}>
            {settings.ticket_message}
          </div>
        ) : (
          <>
            ¡Gracias por su confianza!
            <br />
            Favor de traer este ticket para su entrega.
          </>
        )}
      </div>
    </div>
  );
});

export default TicketVenta;
