import React, { forwardRef } from "react";
import { formatearDinero, formatearFechaHora } from "../../utils";

const CHECKBOX_LABELS = [
  "Lavado de Ropa",
  "Lavado",
  "Planchado",
  "Planchado x Docena",
  "Lavado y Planchado x pieza",
  "Servicio de Tintorería",
  "Lavado de Tenis",
  "Lavado de Edredón",
];

const CATEGORY_TO_LABEL = {
  "lavado": "Lavado",
  "planchado": "Planchado",
  "tintorería": "Servicio de Tintorería",
  "tintoreria": "Servicio de Tintorería",
  "lavado y planchado": "Lavado y Planchado x pieza",
  "planchado x docena": "Planchado x Docena",
  "lavado de tenis": "Lavado de Tenis",
  "lavado de edredón": "Lavado de Edredón",
  "lavado de ropa": "Lavado de Ropa",
};

function getServiceCheckboxes(productos) {
  const matches = new Set();
  if (!productos || !productos.length) {
    return CHECKBOX_LABELS.map(label => ({ label, checked: false }));
  }

  productos.forEach(p => {
    const cat = (p.category || "").toLowerCase().trim();
    if (cat && CATEGORY_TO_LABEL[cat]) {
      matches.add(CATEGORY_TO_LABEL[cat]);
    }
  });

  return CHECKBOX_LABELS.map(label => ({ label, checked: matches.has(label) }));
}

const NotaRemision = forwardRef(({ venta, settings }, ref) => {
  if (!venta) return null;

  const saldoPendiente = (parseFloat(venta.total) || 0) - (parseFloat(venta.paid_amount) || 0);
  const checkboxes = getServiceCheckboxes(venta.productos);
  const entregadoHoy = venta.promised_at
    ? new Date(venta.promised_at)
    : new Date(Date.now() + 86400000);

  return (
    <div
      ref={ref}
      className="nota-remision"
      style={{
        width: "10.8cm",
        height: "14cm",
        maxWidth: "100%",
        margin: "0 auto",
        backgroundColor: "white",
        color: "black",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        fontSize: "7pt",
        padding: "10px 10px 8px 10px",
        boxSizing: "border-box",
        border: "0.5pt solid #ccc",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* HEADER */}
      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        {settings?.logo_url && (
          <img
            src={settings.logo_url}
            alt="Logo"
            style={{ maxWidth: "100%", maxHeight: "35px", objectFit: "contain", margin: "0 auto 3px", filter: "grayscale(100%)" }}
          />
        )}
        <div style={{ fontWeight: 900, fontSize: "8pt", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {settings?.name || "LAVANDERÍA"}
        </div>
        {settings?.address && <div style={{ fontSize: "5.5pt", color: "#555" }}>{settings.address}</div>}
        {settings?.phone && <div style={{ fontSize: "5.5pt", color: "#555" }}>Tel: {settings.phone}</div>}
        <div style={{ fontSize: "5pt", fontStyle: "italic", color: "#999" }}>Servicio de Lavandería y Planchaduría</div>
      </div>

      <div style={{ borderBottom: "0.5pt solid #000", margin: "3px 0" }} />

      {/* ORDER INFO */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ fontWeight: 900, fontSize: "8pt" }}>NOTA DE REMISIÓN</div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: "7pt" }}>
            No. {venta.folio ? venta.folio.toString().padStart(6, "0") : (venta.id || "").toString().slice(-6)}
          </div>
          <div style={{ fontSize: "5.5pt", color: "#555" }}>Fecha: {formatearFechaHora(new Date())}</div>
        </div>
      </div>

      {/* CLIENT INFO */}
      <div style={{ border: "0.5pt solid #333", padding: "3px 5px", marginBottom: "4px", borderRadius: "3px" }}>
        <div style={{ fontWeight: 700, fontSize: "5.5pt", textTransform: "uppercase", marginBottom: "1px" }}>Cliente</div>
        <div style={{ fontSize: "6.5pt", fontWeight: 700 }}>{venta.cliente?.name || "Cliente General"}</div>
        {venta.cliente?.phone && <div style={{ fontSize: "5.5pt", color: "#555" }}>Tel: {venta.cliente.phone}</div>}
      </div>

      {/* SERVICE TYPE GRID */}
      <div style={{ border: "0.5pt solid #333", padding: "4px", marginBottom: "4px", borderRadius: "3px" }}>
        <div style={{ fontWeight: 700, fontSize: "5.5pt", textTransform: "uppercase", marginBottom: "2px" }}>Tipo de Servicio</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
          {checkboxes.map((cb, i) => (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "3px",
              fontSize: "5.5pt",
              border: "0.3pt solid #666",
              padding: "2px 5px",
              borderRadius: "3px",
              backgroundColor: cb.checked ? "#e8f5e9" : "white",
              fontWeight: cb.checked ? 700 : 400,
              minHeight: "20px",
              textAlign: "center",
              flex: "1 1 auto",
            }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "11px",
                height: "11px",
                border: "0.5pt solid #333",
                fontSize: "8pt",
                fontWeight: 700,
                lineHeight: 1,
                flexShrink: 0,
              }}>
                {cb.checked && "✓"}
              </span>
              <span style={{ lineHeight: 1.2 }}>{cb.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ORDER ITEMS LIST */}
      <div style={{ border: "0.5pt solid #333", padding: "3px 5px", marginBottom: "4px", borderRadius: "3px", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "5.5pt", textTransform: "uppercase", marginBottom: "2px" }}>
          Servicios ({venta.productos?.length || 0})
        </div>
        {venta.productos?.map((item, idx) => (
          <div key={idx} style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            fontSize: "5.5pt",
            padding: "1px 0",
            borderBottom: idx < venta.productos.length - 1 ? "0.2pt dotted #ddd" : "none",
            lineHeight: 1.2,
          }}>
            <span style={{ flex: 1, overflowWrap: "break-word", wordBreak: "break-word", marginRight: "4px" }}>
              {item.name}
            </span>
            <span style={{ minWidth: "22px", textAlign: "center", flexShrink: 0 }}>
              x{item.quantity}
            </span>
            <span style={{ minWidth: "32px", textAlign: "right", fontWeight: 700, flexShrink: 0 }}>
              {formatearDinero((item.price || 0) * (item.quantity || 1))}
            </span>
          </div>
        ))}
      </div>

      {/* OBSERVATIONS + DELIVERY */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "4px" }}>
        <div style={{ flex: 1, border: "0.5pt solid #333", padding: "3px 5px", borderRadius: "3px" }}>
          <div style={{ fontWeight: 700, fontSize: "5.5pt", textTransform: "uppercase", marginBottom: "2px" }}>Observaciones</div>
          <div style={{
            fontSize: "5.5pt",
            minHeight: "40px",
            whiteSpace: "pre-wrap",
            lineHeight: "11px",
            backgroundImage: "repeating-linear-gradient(transparent, transparent 10px, #ddd 10px, #ddd 11px)",
          }}>
            {venta.notes || "\n\n\n"}
          </div>
        </div>
        <div style={{ border: "0.5pt solid #333", padding: "3px 5px", borderRadius: "3px", textAlign: "center", minWidth: "65px" }}>
          <div style={{ fontWeight: 700, fontSize: "5.5pt", textTransform: "uppercase", marginBottom: "1px" }}>Entrega</div>
          <div style={{ fontSize: "7pt", fontWeight: 700, color: "#d32f2f" }}>
            {entregadoHoy.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
          </div>
        </div>
      </div>

      {/* TOTALS */}
      <div style={{ border: "0.5pt solid #333", padding: "3px 5px", marginBottom: "4px", borderRadius: "3px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "7pt", fontWeight: 700 }}>
          <span>TOTAL:</span>
          <span>{formatearDinero(venta.total)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5pt" }}>
          <span>Anticipo:</span>
          <span>{formatearDinero(venta.paid_amount || 0)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "5.5pt", fontWeight: saldoPendiente > 0 ? 700 : 400 }}>
          <span>{saldoPendiente > 0.01 ? "RESTAN:" : "Pagado"}</span>
          <span>{saldoPendiente > 0.01 ? formatearDinero(saldoPendiente) : "$0.00"}</span>
        </div>
      </div>

      {/* TERMS */}
      {settings?.remision_terms && (
        <div style={{ fontSize: "4.5pt", textAlign: "center", color: "#555", marginBottom: "4px", fontStyle: "italic" }}>
          {settings.remision_terms}
        </div>
      )}

      {/* SIGNATURE - pushed to bottom */}
      <div style={{ textAlign: "center", marginTop: "auto", paddingTop: "10px" }}>
        <div style={{ borderTop: "0.5pt solid #000", width: "60%", margin: "0 auto 3px" }} />
        <div style={{ fontSize: "5pt", color: "#555" }}>Firma de Aceptación del Cliente</div>
      </div>
    </div>
  );
});

NotaRemision.displayName = "NotaRemision";
export default NotaRemision;
