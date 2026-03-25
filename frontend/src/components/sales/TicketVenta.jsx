import React, { forwardRef } from "react";
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
      style={{
        width: settings?.printer_width ? `${settings.printer_width}mm` : "80mm",
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
        margin: "0 auto",
        backgroundColor: "white",
        color: "black",
        boxSizing: "border-box",
        overflow: "hidden",
        wordWrap: "break-word",
        whiteSpace: "pre-wrap",
      }}
    >
      <div
        className="ticket-header"
        style={{ fontSize: "inherit", textAlign: "center" }}
      >
        {/* Logo del negocio */}
        {settings?.logo_url && (
          <div style={{ marginBottom: "10px" }}>
            <img
              src={settings.logo_url}
              alt="Logo"
              style={{
                maxWidth: "100%",
                maxHeight: "80px",
                objectFit: "contain",
                margin: "0 auto",
              }}
            />
          </div>
        )}

        {/* Info del Negocio */}
        {settings?.name && (
          <div
            style={{
              fontSize: "1.2em",
              fontWeight: "bold",
              marginBottom: "5px",
            }}
          >
            {settings.name}
          </div>
        )}

        {(settings?.address || settings?.phone) && (
          <div
            style={{
              fontSize: "0.9em",
              marginBottom: "10px",
              whiteSpace: "pre-wrap",
            }}
          >
            {settings?.address && <div>{settings.address}</div>}
            {settings?.phone && <div>Tel: {settings.phone}</div>}
          </div>
        )}

        <div
          className="ticket-title"
          style={{ fontWeight: "bold", fontSize: "1.1em", marginTop: "5px" }}
        >
          COMPROBANTE DE RECEPCIÓN
        </div>
        <div
          className="ticket-orden"
          style={{ fontWeight: "bold", fontSize: "1.1em" }}
        >
          ORDEN #
          {venta.folio
            ? venta.folio.toString().padStart(6, "0")
            : venta.id.toString().slice(-6).toUpperCase()}
        </div>
        <div
          className="ticket-fecha"
          style={{ fontSize: "0.9em", marginTop: "2px" }}
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
        {venta.productos.map((item, idx) => (
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
              <span>IVA ({settings?.tax_percentage || 16}%):</span>
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
            {venta.metodo_pago === "cash"
              ? "EFECTIVO"
              : venta.metodo_pago === "card"
                ? "TARJETA"
                : venta.metodo_pago === "transferencia"
                  ? "TRANSFERENCIA"
                  : venta.metodo_pago || "N/A"}
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
                  const recibidoMXN = venta.usar_usd
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
      <div
        className="ticket-footer"
        style={{ textAlign: "center", fontSize: "0.9em" }}
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
