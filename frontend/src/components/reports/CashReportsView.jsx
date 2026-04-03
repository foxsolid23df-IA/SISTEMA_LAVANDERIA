import { useState, useEffect, useCallback } from "react";
import { cashCutService } from "../../services/cashCutService";
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
        <h1 className="cash-reports__title">
          <span className="material-icons-outlined">receipt_long</span>
          Reportes de Caja
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
                <th>Empleado</th>
                <th>Ventas</th>
                <th>Total MXN</th>
                <th>Esperado</th>
                <th>Entregado</th>
                <th>Diferencia</th>
                <th>Tarjeta</th>
                <th>Transfer.</th>
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
                  <tr key={cut.id}>
                    <td>{formatDate(cut.created_at)}</td>
                    <td>{formatTime(cut.created_at)}</td>
                    <td>
                      <span
                        className={`cash-reports__type-badge cash-reports__type-badge--${cut.cut_type}`}
                      >
                        {TYPE_LABELS[cut.cut_type] || cut.cut_type}
                      </span>
                    </td>
                    <td>{cut.staff_name || "—"}</td>
                    <td>{cut.sales_count || 0}</td>
                    <td style={{ fontWeight: 700 }}>
                      {formatCurrency(cut.sales_total)}
                    </td>
                    <td>{formatCurrency(cut.expected_cash)}</td>
                    <td>{formatCurrency(cut.actual_cash)}</td>
                    <td className={diffClass}>{formatCurrency(diff)}</td>
                    <td>{formatCurrency(cut.card_total)}</td>
                    <td>{formatCurrency(cut.transfer_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
