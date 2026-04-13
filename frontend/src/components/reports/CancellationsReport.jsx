import React, { useState, useEffect } from "react";
import { supabase } from "../../supabase";
import { formatearDinero, formatearFechaHora } from "../../utils";
import "./CancellationsReport.css";

const CancellationsReport = () => {
  const [cancellations, setCancellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    search: "",
  });
  const [summary, setSummary] = useState({
    total: 0,
    count: 0,
    cash: 0,
    card: 0,
    transfer: 0,
    usd: 0,
  });

  useEffect(() => {
    loadCancellations();
  }, [filters.startDate, filters.endDate]);

  const loadCancellations = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          customers (name, phone)
        `
        )
        .eq("user_id", user.id)
        .eq("status", "cancelled")
        .gte("created_at", filters.startDate)
        .lte("created_at", filters.endDate + "T23:59:59")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCancellations(data || []);

      // Calcular resumen
      const summaryData = {
        total: 0,
        count: data?.length || 0,
        cash: 0,
        card: 0,
        transfer: 0,
        usd: 0,
      };

      data?.forEach((order) => {
        const total = parseFloat(order.total) || 0;
        summaryData.total += total;

        switch (order.payment_method) {
          case "cash":
          case "efectivo":
            summaryData.cash += total;
            break;
          case "card":
          case "tarjeta":
            summaryData.card += total;
            break;
          case "transfer":
          case "transferencia":
            summaryData.transfer += total;
            break;
          case "usd_cash":
          case "dolares":
            summaryData.usd += total;
            break;
        }
      });

      setSummary(summaryData);
    } catch (error) {
      console.error("Error cargando cancelaciones:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const exportData = cancellations.map((order) => ({
        Fecha: formatearFechaHora(new Date(order.created_at)),
        Folio: order.folio || order.id?.slice(-6),
        Cliente: order.customers?.name || "Cliente General",
        Total: parseFloat(order.total),
        "Método de Pago": order.payment_method,
        "Notas": order.notes || "",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cancelaciones");

      const fileName = `Cancelaciones_${filters.startDate}_${filters.endDate}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error exportando:", error);
    }
  };

  const filteredCancellations = cancellations.filter((order) => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    return (
      (order.folio || "").toLowerCase().includes(search) ||
      (order.customers?.name || "").toLowerCase().includes(search) ||
      (order.notes || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="cancellations-report">
      <div className="report-header">
        <h2>📋 Reporte de Cancelaciones</h2>
        <button className="btn-export" onClick={exportToExcel}>
          📊 Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Fecha Inicio:</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Fecha Fin:</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Buscar:</label>
          <input
            type="text"
            placeholder="Folio, cliente, notas..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
          />
        </div>
      </div>

      {/* Resumen */}
      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <>
          <div className="summary-cards">
            <div className="summary-card">
              <div className="card-icon">❌</div>
              <div className="card-info">
                <div className="card-label">Total Cancelaciones</div>
                <div className="card-value">{summary.count}</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">💰</div>
              <div className="card-info">
                <div className="card-label">Monto Total Cancelado</div>
                <div className="card-value">{formatearDinero(summary.total)}</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">💵</div>
              <div className="card-info">
                <div className="card-label">Efectivo</div>
                <div className="card-value">{formatearDinero(summary.cash)}</div>
              </div>
            </div>
            <div className="summary-card">
              <div className="card-icon">💳</div>
              <div className="card-info">
                <div className="card-label">Tarjeta</div>
                <div className="card-value">{formatearDinero(summary.card)}</div>
              </div>
            </div>
          </div>

          {/* Tabla de cancelaciones */}
          <div className="cancellations-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Método de Pago</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {filteredCancellations.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="no-data">
                      No se encontraron cancelaciones en el período seleccionado
                    </td>
                  </tr>
                ) : (
                  filteredCancellations.map((order) => (
                    <tr key={order.id}>
                      <td>{formatearFechaHora(new Date(order.created_at))}</td>
                      <td>{order.folio || order.id?.slice(-6)}</td>
                      <td>{order.customers?.name || "Cliente General"}</td>
                      <td className="amount-cell">
                        {formatearDinero(order.total)}
                      </td>
                      <td>
                        <span
                          className={`payment-badge ${
                            order.payment_method === "cash" ||
                            order.payment_method === "efectivo"
                              ? "cash"
                              : order.payment_method === "card" ||
                                order.payment_method === "tarjeta"
                              ? "card"
                              : order.payment_method === "transfer" ||
                                order.payment_method === "transferencia"
                              ? "transfer"
                              : "usd"
                          }`}
                        >
                          {order.payment_method === "cash" ||
                          order.payment_method === "efectivo"
                            ? "Efectivo"
                            : order.payment_method === "card" ||
                              order.payment_method === "tarjeta"
                            ? "Tarjeta"
                            : order.payment_method === "transfer" ||
                              order.payment_method === "transferencia"
                            ? "Transferencia"
                            : "Dólares"}
                        </span>
                      </td>
                      <td className="notes-cell">{order.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CancellationsReport;
