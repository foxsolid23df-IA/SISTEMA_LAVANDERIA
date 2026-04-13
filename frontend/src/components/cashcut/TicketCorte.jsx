import React, { forwardRef } from "react";
import { formatearDinero, formatearFechaHora } from "../../utils";

const TicketCorte = forwardRef(({ cutResult, settings, cutType }, ref) => {
  if (!cutResult) return null;

  const isDayCut = cutType === "dia";
  const storeName = settings?.name || "MI TIENDA";

  return (
    <div
      ref={ref}
      className="ticket-corte"
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
          : "0px",
        paddingRight: settings?.printer_margin
          ? `${settings.printer_margin}px`
          : "0px",
        margin: "0 auto",
        backgroundColor: "white",
        color: "black",
      }}
    >
      <div
        className="ticket-header"
        style={{ textAlign: "center", marginBottom: "10px" }}
      >
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
        <div
          style={{ fontSize: "1.2em", fontWeight: "bold", uppercase: "true" }}
        >
          {storeName}
        </div>
        <div style={{ fontSize: "0.9em", fontWeight: "bold" }}>
          {isDayCut ? "CIERRE FINAL DEL DÍA" : "CORTE DE TURNO"}
        </div>
        <div style={{ fontSize: "0.8em", marginTop: "5px" }}>
          {formatearFechaHora(new Date())}
        </div>
      </div>

      <div style={{ borderBottom: "1px dashed #000", margin: "5px 0" }} />

      <div className="ticket-info" style={{ fontSize: "0.9em" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Operador:</span>
          <span style={{ fontWeight: "bold" }}>{cutResult.staffName}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Terminal:</span>
          <span style={{ fontWeight: "bold" }}>
            {cutResult.terminal_id?.slice(-8) || "Caja Principal"}
          </span>
        </div>
      </div>

      <div style={{ borderBottom: "1px dashed #000", margin: "5px 0" }} />

      <div className="ticket-totals" style={{ spaceY: "2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>FONDO INICIAL:</span>
          <span style={{ fontWeight: "bold" }}>
            {formatearDinero(cutResult.opening_fund || 0)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>EFECTIVO:</span>
          <span style={{ fontWeight: "bold" }}>
            {formatearDinero(cutResult.cashTotal || 0)}
          </span>
        </div>

        {cutResult.cardTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>TARJETA:</span>
            <span style={{ fontWeight: "bold" }}>
              {formatearDinero(cutResult.cardTotal)}
            </span>
          </div>
        )}

        {cutResult.transferTotal > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>TRANSFERENCIA:</span>
            <span style={{ fontWeight: "bold" }}>
              {formatearDinero(cutResult.transferTotal)}
            </span>
          </div>
        )}

        {/* Mostrar cancelaciones si existen */}
        {cutResult.cancelledCount > 0 && (
          <div style={{ padding: "4px 0", borderBottom: "1px dotted #000" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "red",
                marginBottom: "2px",
                fontWeight: "bold",
              }}
            >
              <span>CANCELACIONES ({cutResult.cancelledCount}):</span>
              <span style={{ fontWeight: "bold" }}>
                -{formatearDinero(cutResult.cancelledTotal)}
              </span>
            </div>
            {cutResult.cancelledOrders &&
              cutResult.cancelledOrders.map((order, idx) => (
                <div
                  key={idx}
                  style={{
                    paddingLeft: "8px",
                    fontSize: "0.85em",
                    color: "#666",
                    marginBottom: "2px",
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>
                      - #{order.folio || order.id?.slice(-6)} -{" "}
                      {order.customers?.name ||
                        order.customer_name ||
                        "Cliente"}
                    </span>
                    <span>{formatearDinero(order.total)}</span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {cutResult.withdrawals?.count > 0 && (
          <div style={{ padding: "4px 0", borderBottom: "1px dotted #000" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                color: "red",
                marginBottom: "2px",
              }}
            >
              <span>RETIROS ({cutResult.withdrawals.count}):</span>
              <span style={{ fontWeight: "bold" }}>
                -{formatearDinero(cutResult.withdrawals.totalMXN)}
              </span>
            </div>
            {cutResult.withdrawals?.details &&
              cutResult.withdrawals.details.map((w, idx) => (
                <div
                  key={idx}
                  style={{
                    paddingLeft: "8px",
                    fontSize: "0.9em",
                    color: "black",
                  }}
                >
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>- {w.reason}</span>
                    <span>{formatearDinero(w.amount)}</span>
                  </div>
                  {w.notes && (
                    <div
                      style={{
                        fontStyle: "italic",
                        fontSize: "0.85em",
                        color: "#444",
                      }}
                    >
                      {w.notes}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}

        <div style={{ borderBottom: "1px dotted #000", margin: "5px 0" }} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "1.1em",
            fontWeight: "bold",
          }}
        >
          <span>TOTAL VENTAS ({cutResult.salesCount}):</span>
          <span>
            {formatearDinero(
              (cutResult.opening_fund || 0) +
                (cutResult.cashTotal || 0) +
                (cutResult.cardTotal || 0) +
                (cutResult.transferTotal || 0),
            )}
          </span>
        </div>

        <div style={{ borderBottom: "1px dotted #000", margin: "5px 0" }} />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "1.1em",
            fontWeight: "bold",
          }}
        >
          <span>EFECTIVO ESPERADO MXN:</span>
          <span>{formatearDinero(cutResult.expectedCash)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "1.1em",
            fontWeight: "bold",
          }}
        >
          <span>EFECTIVO CONTADO MXN:</span>
          <span>{formatearDinero(cutResult.actualCash)}</span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "1.1em",
            fontWeight: "bold",
            color:
              cutResult.difference === 0
                ? "black"
                : cutResult.difference > 0
                  ? "blue"
                  : "red",
          }}
        >
          <span>DIFERENCIA:</span>
          <span>
            {cutResult.difference === 0
              ? "CORRECTO"
              : formatearDinero(cutResult.difference)}
          </span>
        </div>

        {cutResult.expectedUSD > 0 && (
          <>
            <div style={{ borderBottom: "1px dotted #000", margin: "5px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>ESPERADO USD:</span>
              <span style={{ fontWeight: "bold" }}>
                {formatearDinero(cutResult.expectedUSD, "USD")}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CONTADO USD:</span>
              <span style={{ fontWeight: "bold" }}>
                {formatearDinero(cutResult.actualUSD, "USD")}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                color:
                  cutResult.differenceUSD === 0
                    ? "black"
                    : cutResult.differenceUSD > 0
                      ? "blue"
                      : "red",
              }}
            >
              <span>DIFERENCIA USD:</span>
              <span>
                {cutResult.differenceUSD === 0
                  ? "CORRECTO"
                  : formatearDinero(cutResult.differenceUSD, "USD")}
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ borderBottom: "1px dashed #000", margin: "5px 0" }} />

      {cutResult.notes && (
        <div style={{ marginBottom: "10px" }}>
          <div style={{ fontWeight: "bold", fontSize: "0.8em" }}>
            OBSERVACIONES:
          </div>
          <div style={{ fontSize: "0.8em", fontStyle: "italic" }}>
            {cutResult.notes}
          </div>
          <div style={{ borderBottom: "1px dashed #000", margin: "5px 0" }} />
        </div>
      )}

      <div
        style={{ textAlign: "center", fontSize: "0.8em", marginTop: "10px" }}
      >
        SISTEMA LAVANDERIA PRO 2026
        <br />
        Reporte de Auditoría de Caja
      </div>
    </div>
  );
});

export default TicketCorte;
