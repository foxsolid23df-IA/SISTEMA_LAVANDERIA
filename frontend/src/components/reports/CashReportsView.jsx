import { useState, useEffect, useCallback, useMemo } from "react";
import { cashCutService } from "../../services/cashCutService";
import Modal from "../common/Modal"; // Importación por defecto corregida
import "./CashReportsView.css";

const TYPE_LABELS = {
  turno: "Turno",
  dia: "Día",
  parcial: "Parcial",
};

const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const CashReportsView = () => {
  const [cuts, setCuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    cutType: "all",
    staffName: "",
  });
  const [selectedCut, setSelectedCut] = useState(null);
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("orders"); // 'orders' | 'clients'

  const fetchCuts = useCallback(async () => {
    setLoading(true);
    try {
      const options = { limit: 100 };
      if (filters.startDate) options.startDate = filters.startDate;
      if (filters.endDate) options.endDate = filters.endDate;
      if (filters.cutType && filters.cutType !== "all")
        options.cutType = filters.cutType;
      if (filters.staffName) options.staffName = filters.staffName;

      const data = await cashCutService.getCashCuts(options);
      setCuts(data);
    } catch (err) {
      console.error("[CashReportsView] Error cargando cortes:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCuts();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCuts();
  };

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleRowClick = async (cut) => {
    setSelectedCut(cut);
    setLoadingDetails(true);
    setDetails(null);
    try {
      const data = await cashCutService.getCutDetails(cut.start_time, cut.created_at, cut.terminal_id);
      setDetails(data);
    } catch (err) {
      console.error("[CashReportsView] Error al cargar detalles:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Group transactions by client
  const clientsData = useMemo(() => {
    if (!details?.transactions) return [];
    const groups = {};
    details.transactions.forEach((tx) => {
      const name = tx.customer_name || "Cliente General";
      if (!groups[name]) {
        groups[name] = { name, count: 0, total: 0, transactions: [] };
      }
      groups[name].count += 1;
      groups[name].total += parseFloat(tx.total) || 0;
      groups[name].transactions.push(tx);
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [details]);

  // Totals by payment method
  const paymentSummary = useMemo(() => {
    if (!details?.transactions) return null;
    const summary = {
      efectivo: 0,
      tarjeta: 0,
      transferencia: 0,
      dolares: 0
    };
    details.transactions.forEach(tx => {
      const method = tx.payment_method?.toLowerCase();
      if (summary.hasOwnProperty(method)) {
          summary[method] += parseFloat(tx.total) || 0;
      }
    });
    return summary;
  }, [details]);

  // Summary calculations
  const totalSales = cuts.reduce(
    (acc, c) => acc + (parseFloat(c.sales_total) || 0),
    0,
  );
  const totalDiff = cuts.reduce(
    (acc, c) => acc + (parseFloat(c.difference) || 0),
    0,
  );
  const totalSalesCount = cuts.reduce(
    (acc, c) => acc + (parseInt(c.sales_count) || 0),
    0,
  );

  return (
    <div className="cash-reports">
      {/* Header */}
      <div className="cash-reports__header">
        <h1 className="cash-reports__title-v2 group cursor-default">
          <span className="material-icons-outlined">receipt_long</span>
          <span>Reportes de Caja</span>
        </h1>
        <span className="cash-reports__badge">
          <span className="material-icons-outlined" style={{ fontSize: 14 }}>
            cloud
          </span>
          Acceso Web Remoto
        </span>
      </div>

      {/* Filters */}
      <form className="cash-reports__filters" onSubmit={handleSearch}>
        <div className="cash-reports__filter-group">
          <label>Desde</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilter("startDate", e.target.value)}
          />
        </div>
        <div className="cash-reports__filter-group">
          <label>Hasta</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilter("endDate", e.target.value)}
          />
        </div>
        <div className="cash-reports__filter-group">
          <label>Tipo</label>
          <select
            value={filters.cutType}
            onChange={(e) => updateFilter("cutType", e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="turno">Turno</option>
            <option value="dia">Día</option>
            <option value="parcial">Parcial</option>
          </select>
        </div>
        <div className="cash-reports__filter-group">
          <label>Empleado</label>
          <input
            type="text"
            placeholder="Nombre..."
            value={filters.staffName}
            onChange={(e) => updateFilter("staffName", e.target.value)}
          />
        </div>
        <button type="submit" className="cash-reports__filter-btn">
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>
            search
          </span>
          Buscar
        </button>
      </form>

      {/* Summary Cards */}
      <div className="cash-reports__summary">
        <div className="cash-reports__card">
          <div className="cash-reports__card-icon cash-reports__card-icon--cuts">
            <span className="material-icons-outlined">content_cut</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">{cuts.length}</span>
            <span className="cash-reports__card-label">Cortes encontrados</span>
          </div>
        </div>
        <div className="cash-reports__card">
          <div className="cash-reports__card-icon cash-reports__card-icon--sales">
            <span className="material-icons-outlined">shopping_cart</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">{totalSalesCount}</span>
            <span className="cash-reports__card-label">Ventas totales</span>
          </div>
        </div>
        <div className="cash-reports__card">
          <div className="cash-reports__card-icon cash-reports__card-icon--total">
            <span className="material-icons-outlined">payments</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">
              {formatCurrency(totalSales)}
            </span>
            <span className="cash-reports__card-label">Monto total</span>
          </div>
        </div>
        <div className="cash-reports__card">
          <div className="cash-reports__card-icon cash-reports__card-icon--diff">
            <span className="material-icons-outlined">compare_arrows</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">
              {formatCurrency(totalDiff)}
            </span>
            <span className="cash-reports__card-label">Diferencia acumulada</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="cash-reports__table-wrapper">
        {loading ? (
          <div className="cash-reports__loading">
            <span className="material-icons-outlined">sync</span>
            Cargando reportes...
          </div>
        ) : cuts.length === 0 ? (
          <div className="cash-reports__empty">
            <span className="material-icons-outlined">inbox</span>
            <h3>Sin registros</h3>
            <p>No se encontraron cortes de caja con los filtros seleccionados.</p>
          </div>
        ) : (
          <table className="cash-reports__table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Estatus</th>
                <th>Empleado</th>
                <th>Ventas</th>
                <th>Total MXN</th>
                <th>Fondo Inicial</th>
                <th>Esperado</th>
                <th>Entregado</th>
                <th>Diferencia</th>
                <th>Tarjeta</th>
                <th>Transfer.</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuts.map((cut) => {
                const diff = parseFloat(cut.difference) || 0;
                const diffClass =
                  diff > 0
                    ? "cash-reports__diff--positive"
                    : diff < 0
                      ? "cash-reports__diff--negative"
                      : "cash-reports__diff--zero";

                return (
                  <tr 
                    key={cut.id} 
                    onClick={() => handleRowClick(cut)}
                    className="cash-reports__row-clickable"
                  >
                    <td>{formatDate(cut.created_at)}</td>
                    <td>{formatTime(cut.created_at)}</td>
                    <td>
                      <span
                        className={`cash-reports__type-badge cash-reports__type-badge--${cut.cut_type}`}
                      >
                        {TYPE_LABELS[cut.cut_type] || cut.cut_type}
                      </span>
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span 
                          className={`status-dot status-dot--${!cut.fecha_cierre ? 'open' : 'closed'}`}
                        ></span>
                        <span className={`status-text--${!cut.fecha_cierre ? 'open' : 'closed'}`}>
                          {!cut.fecha_cierre ? 'Abierta' : 'Cerrada'}
                        </span>
                      </div>
                    </td>
                    <td>{cut.staff_name || "—"}</td>
                    <td>{cut.sales_count || 0}</td>
                    <td style={{ fontWeight: 700 }}>
                      {formatCurrency(cut.sales_total)}
                    </td>
                    <td>{formatCurrency(cut.opening_fund || 0)}</td>
                    <td>{formatCurrency(cut.expected_cash)}</td>
                    <td>{formatCurrency(cut.actual_cash)}</td>
                    <td className={diffClass}>{formatCurrency(diff)}</td>
                    <td>{formatCurrency(cut.card_total)}</td>
                    <td>{formatCurrency(cut.transfer_total)}</td>
                    <td>
                      <button 
                        className="cash-reports__details-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(cut);
                        }}
                        title="Ver reporte avanzado"
                      >
                        <span className="material-icons-outlined">list_alt</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Detalles */}
      {selectedCut && (
        <Modal 
            isOpen={true} 
            onClose={() => setSelectedCut(null)}
            title={`Reporte Detallado de Caja — ${formatDate(selectedCut.created_at)}`}
            className="modal-wide"
        >
            <div className="cut-details">
                <div className="report-card">
                    <div className="report-header">
                        <div className="report-header__brand">
                            <h2>Resumen de Operaciones</h2>
                            <div className="report-header__meta">
                                {formatDate(selectedCut.created_at)} {formatTime(selectedCut.created_at)} | ID: #{selectedCut.id.toString().slice(-6)}
                            </div>
                        </div>
                        <div className={`cash-reports__type-badge cash-reports__type-badge--${selectedCut.cut_type}`}>
                            {TYPE_LABELS[selectedCut.cut_type]}
                        </div>
                    </div>

                    <div className="report-body">
                        <div className="report-summary-grid">
                            <div className="summary-stat">
                                <label>Usuario</label>
                                <span className="value">{selectedCut.staff_name}</span>
                            </div>
                            <div className="summary-stat">
                                <label>Total Ventas</label>
                                <span className="value">{formatCurrency(selectedCut.sales_total)}</span>
                            </div>
                            <div className="summary-stat">
                                <label>Fondo Inicial de Caja</label>
                                <span className="value">{formatCurrency(selectedCut.opening_fund || 0)}</span>
                            </div>
                            <div className="summary-stat">
                                <label>Esperado en Caja</label>
                                <span className="value">{formatCurrency(selectedCut.expected_cash)}</span>
                            </div>
                            <div className="summary-stat">
                                <label>Entregado Real</label>
                                <span className="value">{formatCurrency(selectedCut.actual_cash)}</span>
                            </div>
                            <div className="summary-stat">
                                <label>Diferencia</label>
                                <span className={`value ${parseFloat(selectedCut.difference) >= 0 ? "cash-reports__diff--positive" : "cash-reports__diff--negative"}`}>
                                    {formatCurrency(selectedCut.difference)}
                                </span>
                            </div>
                        </div>

                        {loadingDetails ? (
                            <div className="cash-reports__loading">
                                <span className="material-icons-outlined">sync</span>
                                Cargando desglose detallado...
                            </div>
                        ) : (
                            <>
                                <div className="cut-details__tabs" style={{ marginBottom: '1.5rem' }}>
                                    <button 
                                        className={`cut-details__tab ${activeTab === 'orders' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('orders')}
                                    >
                                        <span className="material-icons-outlined">receipt_long</span>
                                        Ventas por Orden
                                    </button>
                                    <button 
                                        className={`cut-details__tab ${activeTab === 'clients' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('clients')}
                                    >
                                        <span className="material-icons-outlined">people</span>
                                        Ventas por Clientes
                                    </button>
                                </div>

                                <div className="report-table-section">
                                    {activeTab === 'orders' ? (
                                        <table className="cut-details__table">
                                            <thead>
                                                <tr>
                                                    <th>Hora</th>
                                                    <th>Cliente</th>
                                                    <th>Detalle de Items</th>
                                                    <th>Método</th>
                                                    <th className="text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {details?.transactions.map((tx, idx) => (
                                                    <tr key={idx}>
                                                        <td>{formatTime(tx.created_at)}</td>
                                                        <td>{tx.customer_name}</td>
                                                        <td className="cut-details__items-cell">
                                                            {tx.items_summary || "Sin detalles"}
                                                        </td>
                                                        <td>
                                                            <span className={`method-badge method-badge--${tx.payment_method?.toLowerCase()}`}>
                                                                {tx.payment_method}
                                                            </span>
                                                        </td>
                                                        <td className="text-right font-bold">{formatCurrency(tx.total)}</td>
                                                    </tr>
                                                ))}
                                                {details?.transactions.length === 0 && (
                                                    <tr>
                                                        <td colSpan="5" className="text-center py-4">Sin transacciones en este corte.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <table className="cut-details__table">
                                            <thead>
                                                <tr>
                                                    <th>Cliente</th>
                                                    <th>Nº Ventas</th>
                                                    <th className="text-right">Monto Acumulado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {clientsData.map((client, idx) => (
                                                    <tr key={idx}>
                                                        <td>{client.name}</td>
                                                        <td>{client.count}</td>
                                                        <td className="text-right font-bold">{formatCurrency(client.total)}</td>
                                                    </tr>
                                                ))}
                                                {clientsData.length === 0 && (
                                                    <tr>
                                                        <td colSpan="3" className="text-center py-4">No se encontraron datos de clientes.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn-print" onClick={() => window.print()}>
                        <span className="material-icons-outlined">print</span>
                        Imprimir / Descargar PDF
                    </button>
                    <button className="cash-reports__filter-btn" onClick={() => setSelectedCut(null)}>
                        Cerrar Ventana
                    </button>
                </div>
            </div>
        </Modal>
      )}
    </div>
  );
};
