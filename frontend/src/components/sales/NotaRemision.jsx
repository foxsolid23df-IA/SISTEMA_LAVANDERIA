import React, { forwardRef } from "react";

const CHECKBOX_LABELS = [
  "LAVADO",
  "PLANCHADO",
  "SERVICIO DE TINTORERIA",
  "LAVADO DE TENIS",
  "LAVADO DE ROPA",
  "SERVICIO DE TINTORERIA",
  "LAVADO POR DOCENA",
  "LAVADO Y PLANCHADO POR PIEZA",
  "LAVADO DE TENIS",
  "EDREDÓN/COLCHA/ROPA",
];

const CATEGORY_TO_LABEL = {
  "lavado": "LAVADO",
  "planchado": "PLANCHADO",
  "tintorería": "SERVICIO DE TINTORERIA",
  "tintoreria": "SERVICIO DE TINTORERIA",
  "lavado y planchado": "LAVADO Y PLANCHADO POR PIEZA",
  "planchado x docena": "LAVADO POR DOCENA",
  "lavado de tenis": "LAVADO DE TENIS",
  "lavado de edredón": "EDREDÓN/COLCHA/ROPA",
  "lavado de ropa": "LAVADO DE ROPA",
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

  const now = new Date();
  const fechaEntrega = entregadoHoy.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  const horaEntrega = entregadoHoy.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

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
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: "7pt",
        padding: "8px",
        boxSizing: "border-box",
        border: "1px solid #999",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ===== HEADER ===== */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "4px", borderBottom: "1.5px solid #1565C0", paddingBottom: "4px" }}>
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt="Logo"
              style={{ width: "45px", height: "45px", objectFit: "contain" }}
            />
          ) : (
            <div style={{
              width: "45px",
              height: "45px",
              borderRadius: "50%",
              border: "2px solid #1565C0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "6pt",
              color: "#1565C0",
              fontWeight: 700,
            }}>
              LOGO
            </div>
          )}
        </div>

        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "6pt", color: "#1565C0", fontWeight: 600, textTransform: "uppercase" }}>
            Lavandería y Planchaduría
          </div>
          <div style={{ fontSize: "9pt", fontWeight: 900, color: "#D32F2F", fontStyle: "italic", margin: "1px 0" }}>
            &quot;{settings?.name || "Laundry's Express"}&quot;
          </div>
          <div style={{ fontSize: "7pt", color: "#D32F2F", fontWeight: 700 }}>
            Tel.: {settings?.phone || "55 74 34 44 09"}
          </div>
          <div style={{ fontSize: "5pt", color: "#1565C0", fontStyle: "italic" }}>
            Lavamos tu Ropa, Edredones, Cobertores, Cubre camas y Planchamos tu Ropa
          </div>
        </div>

        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "3px" }}>
          <div style={{
            border: "1.5px solid #1565C0",
            padding: "2px 6px",
            textAlign: "center",
            borderRadius: "2px",
          }}>
            <div style={{ fontSize: "5pt", color: "#1565C0", fontWeight: 700 }}>NUMERO DE ORDEN</div>
            <div style={{ fontSize: "8pt", fontWeight: 900 }}>
              {venta.folio ? venta.folio.toString().padStart(6, "0") : (venta.id || "").toString().slice(-6)}
            </div>
          </div>
          <div style={{
            border: "1.5px solid #1565C0",
            padding: "2px 6px",
            textAlign: "center",
            borderRadius: "2px",
          }}>
            <div style={{ fontSize: "5pt", color: "#1565C0", fontWeight: 700 }}>FECHA</div>
            <div style={{ fontSize: "6pt", fontWeight: 700 }}>
              {now.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" })}
            </div>
          </div>
        </div>
      </div>

      {settings?.address && (
        <div style={{ fontSize: "4.5pt", color: "#555", marginBottom: "3px", textAlign: "center" }}>
          {settings.address}
        </div>
      )}

      {/* ===== DATOS DEL CLIENTE ===== */}
      <div style={{
        border: "1.5px solid #1565C0",
        borderRadius: "3px",
        marginBottom: "4px",
        overflow: "hidden",
      }}>
        <div style={{
          backgroundColor: "#1565C0",
          color: "white",
          fontSize: "6pt",
          fontWeight: 700,
          textAlign: "center",
          padding: "2px 0",
          textTransform: "uppercase",
        }}>
          DATOS DEL CLIENTE
        </div>
        <div style={{ padding: "3px 5px", display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
          <div style={{ flex: "1 1 100%" }}>
            <span style={{ fontSize: "5pt", fontWeight: 700 }}>NOMBRE DEL CLIENTE: </span>
            <span style={{ fontSize: "6pt", borderBottom: "0.5pt solid #999", minWidth: "120px", display: "inline-block" }}>
              {venta.cliente?.name || "Cliente General"}
            </span>
          </div>
          <div style={{ flex: "1 1 45%" }}>
            <span style={{ fontSize: "5pt", fontWeight: 700 }}>DOMICILIO: </span>
            <span style={{ fontSize: "6pt", borderBottom: "0.5pt solid #999", minWidth: "80px", display: "inline-block" }}>
              {venta.cliente?.address || ""}
            </span>
          </div>
          <div style={{ flex: "1 1 45%" }}>
            <span style={{ fontSize: "5pt", fontWeight: 700 }}>TELEFONOS: </span>
            <span style={{ fontSize: "6pt", borderBottom: "0.5pt solid #999", minWidth: "80px", display: "inline-block" }}>
              {venta.cliente?.phone || ""}
            </span>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT: 2 COLUMNS ===== */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "4px", flex: 1, minHeight: 0 }}>
        {/* LEFT: TIPO DE SERVICIO */}
        <div style={{
          flex: "0 0 55%",
          border: "1.5px solid #1565C0",
          borderRadius: "3px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            backgroundColor: "#1565C0",
            color: "white",
            fontSize: "6pt",
            fontWeight: 700,
            textAlign: "center",
            padding: "2px 0",
            textTransform: "uppercase",
          }}>
            TIPO DE SERVICIO
          </div>
          <div style={{ padding: "3px", flex: 1 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px" }}>
              {checkboxes.map((cb, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "3px",
                  fontSize: "5pt",
                  padding: "2px 3px",
                  backgroundColor: cb.checked ? "#E3F2FD" : "white",
                  borderRadius: "2px",
                  border: "0.5pt solid #ddd",
                }}>
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "10px",
                    height: "10px",
                    border: "1px solid #333",
                    fontSize: "7pt",
                    fontWeight: 700,
                    lineHeight: 1,
                    flexShrink: 0,
                    backgroundColor: cb.checked ? "#1565C0" : "white",
                    color: cb.checked ? "white" : "transparent",
                  }}>
                    {cb.checked ? "✓" : ""}
                  </span>
                  <span style={{ lineHeight: 1.1, fontWeight: cb.checked ? 700 : 400 }}>
                    {cb.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: OBSERVACIONES */}
        <div style={{
          flex: 1,
          border: "1.5px solid #1565C0",
          borderRadius: "3px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            backgroundColor: "#1565C0",
            color: "white",
            fontSize: "6pt",
            fontWeight: 700,
            textAlign: "center",
            padding: "2px 0",
            textTransform: "uppercase",
          }}>
            OBSERVACIONES
          </div>
          <div style={{
            flex: 1,
            padding: "3px 5px",
            fontSize: "5.5pt",
            whiteSpace: "pre-wrap",
            lineHeight: "11px",
            backgroundImage: "repeating-linear-gradient(transparent, transparent 10px, #ccc 10px, #ccc 11px)",
            minHeight: "80px",
          }}>
            {venta.notes || ""}
          </div>
        </div>
      </div>

      {/* ===== HORA Y FECHA DE ENTREGA ===== */}
      <div style={{
        border: "1.5px solid #1565C0",
        borderRadius: "3px",
        marginBottom: "4px",
        overflow: "hidden",
      }}>
        <div style={{
          backgroundColor: "#1565C0",
          color: "white",
          fontSize: "6pt",
          fontWeight: 700,
          textAlign: "center",
          padding: "2px 0",
          textTransform: "uppercase",
        }}>
          HORA Y FECHA DE ENTREGA
        </div>
        <div style={{ padding: "3px 5px", textAlign: "center" }}>
          <span style={{ fontSize: "7pt", fontWeight: 700 }}>
            {fechaEntrega} - {horaEntrega}
          </span>
        </div>
      </div>

      {/* ===== BOTTOM ROW: TERMS + TOTALS ===== */}
      <div style={{ display: "flex", gap: "5px", marginBottom: "4px" }}>
        {/* LEFT: Condiciones */}
        <div style={{ flex: 1, fontSize: "4pt", color: "#333", lineHeight: "1.3", padding: "3px" }}>
          {settings?.remision_terms ? (
            settings.remision_terms.split("\n").map((line, i) => (
              <div key={i} style={{ marginBottom: "1px" }}>{line}</div>
            ))
          ) : (
            <>
              <div>-Después de 30 días de almacenamiento, se cobrará un cargo extra.</div>
              <div>-Revise su prenda al momento de retirar, una vez salido no hacemos responsables.</div>
              <div>-Dudas, quejas o aclaraciones por favor al teléfono: {settings?.phone || "55 74 34 44 09"}.</div>
              <div>-Entregas en un tiempo estimado de 24 hrs. a 48 hrs.</div>
              <div>-Si no recibe NOTA, su servicio es GRATIS.</div>
              <div>-No nos hacemos responsables por callotines o ropa interior extraviada.</div>
              <div>-Para el servicio de planchado por favor traer sus ganchos.</div>
            </>
          )}
        </div>

        {/* RIGHT: Totales */}
        <div style={{
          flex: "0 0 35%",
          border: "1.5px solid #1565C0",
          borderRadius: "3px",
          overflow: "hidden",
        }}>
          <div style={{ padding: "3px 5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
              <span style={{ fontSize: "6pt", fontWeight: 700 }}>TOTAL</span>
              <span style={{ fontSize: "6pt", fontWeight: 900, borderBottom: "0.5pt solid #999", minWidth: "50px", textAlign: "right", display: "inline-block" }}>
                ${parseFloat(venta.total || 0).toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
              <span style={{ fontSize: "6pt", fontWeight: 700 }}>ANTICIPO</span>
              <span style={{ fontSize: "6pt", fontWeight: 900, borderBottom: "0.5pt solid #999", minWidth: "50px", textAlign: "right", display: "inline-block" }}>
                ${parseFloat(venta.paid_amount || 0).toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "6pt", fontWeight: 700 }}>RESTAN</span>
              <span style={{ fontSize: "6pt", fontWeight: 900, borderBottom: "0.5pt solid #999", minWidth: "50px", textAlign: "right", display: "inline-block" }}>
                ${saldoPendiente > 0 ? saldoPendiente.toFixed(2) : "0.00"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== FIRMA ===== */}
      <div style={{ textAlign: "center", marginTop: "auto", paddingTop: "4px" }}>
        <div style={{ borderTop: "1px solid #333", width: "65%", margin: "0 auto 2px" }} />
        <div style={{ fontSize: "5pt", fontWeight: 700, color: "#333" }}>FIRMA DE ACEPTACIÓN DEL CLIENTE</div>
      </div>
    </div>
  );
});

NotaRemision.displayName = "NotaRemision";
export default NotaRemision;
