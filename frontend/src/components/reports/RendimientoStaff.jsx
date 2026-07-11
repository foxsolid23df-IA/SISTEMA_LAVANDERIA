import React, { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { productionService } from "../../services/productionService";
import { staffService } from "../../services/staffService";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import "./RendimientoStaff.css";

export const RendimientoStaff = () => {
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    staffId: ""
  });
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const { isAdmin } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  if (!settingsLoading && !settings?.employee_production_enabled) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadStaff = async () => {
    try {
      const data = await staffService.getStaff();
      setEmployees(data);
    } catch (error) {
      console.error("Error cargando staff:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await productionService.getEmployeeSummary(filters);
      setSummary(data);
      if (data.employees.length > 0 && !selectedEmployee) {
        setSelectedEmployee(data.employees[0].staffName);
      }
    } catch (error) {
      console.error("Error cargando producción:", error);
      Swal.fire("Error", "No se pudo cargar la producción de empleados.", "error");
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(parseFloat(amount || 0));
  };

  const handleExport = () => {
    if (!summary?.employees) {
      Swal.fire("Atención", "No hay datos para exportar.", "warning");
      return;
    }

    const rows = [];
    summary.employees.forEach(emp => {
      emp.items.forEach(item => {
        rows.push({
          Empleado: item.staffName,
          Nota: item.folio,
          Servicio: item.service,
          Cantidad: item.quantity,
          "Precio venta": item.sellingPrice,
          Costo: item.costPrice,
          "Ganancia unit.": item.unitProfit,
          "Ganancia total": item.totalProfit
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rendimiento Staff");
    XLSX.writeFile(wb, `Rendimiento_Staff_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const selectedEmployeeData = useMemo(() => {
    if (!summary || !selectedEmployee) return null;
    return summary.employees.find(e => e.staffName === selectedEmployee);
  }, [summary, selectedEmployee]);

  const allItems = useMemo(() => {
    if (!selectedEmployeeData) return [];
    return selectedEmployeeData.items;
  }, [selectedEmployeeData]);

  return (
    <div className="rendimiento-container">
      <div className="rendimiento-header">
        <h1>📊 Rendimiento de Staff</h1>
        <p>Ganancia neta generada por cada empleado según los servicios asignados.</p>
      </div>

      {/* Filters */}
      <div className="rendimiento-card">
        <div className="rendimiento-filters">
          <div className="filter-group">
            <label>Desde</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(p => ({ ...p, startDate: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label>Hasta</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(p => ({ ...p, endDate: e.target.value }))}
            />
          </div>
          <div className="filter-group">
            <label>Empleado</label>
            <select
              value={filters.staffId}
              onChange={(e) => setFilters(p => ({ ...p, staffId: e.target.value }))}
            >
              <option value="">Todos</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-export" onClick={handleExport}>
            📥 Exportar Excel
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading-text">Cargando datos...</p>
      ) : !summary || summary.employees.length === 0 ? (
        <div className="rendimiento-card">
          <p className="empty-text">No hay datos de producción disponibles. Asigna empleados a los servicios en las órdenes.</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="rendimiento-summary-grid">
            <div className="summary-card total">
              <span className="summary-label">Ganancia neta total</span>
              <span className="summary-value">{formatMoney(summary.grandTotal)}</span>
            </div>
            <div className="summary-card best">
              <span className="summary-label">Top empleado</span>
              <span className="summary-value">
                {summary.employees[0].staffName}: {formatMoney(summary.employees[0].totalProfit)}
              </span>
            </div>
            <div className="summary-card count">
              <span className="summary-label">Servicios realizados</span>
              <span className="summary-value">{summary.totalItems}</span>
            </div>
          </div>

          {/* Employee selector */}
          <div className="rendimiento-card">
            <div className="employee-tabs">
              {summary.employees.map(emp => (
                <button
                  key={emp.staffName}
                  className={`employee-tab ${selectedEmployee === emp.staffName ? 'active' : ''}`}
                  onClick={() => setSelectedEmployee(emp.staffName)}
                >
                  <span>{emp.staffName}</span>
                  <span className="tab-profit">{formatMoney(emp.totalProfit)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Detail table */}
          {selectedEmployeeData && (
            <div className="rendimiento-card">
              <h2>{selectedEmployee} — {selectedEmployeeData.itemCount} servicios</h2>
              <div className="rendimiento-table-wrapper">
                <table className="rendimiento-table">
                  <thead>
                    <tr>
                      <th>Nota</th>
                      <th>Servicio</th>
                      <th>Cantidad</th>
                      <th>Venta unit.</th>
                      <th>Costo unit.</th>
                      <th>Ganancia unit.</th>
                      <th>Ganancia total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.map(item => (
                      <tr key={item.id}>
                        <td>#{item.folio}</td>
                        <td>{item.service}</td>
                        <td>{item.quantity}</td>
                        <td>{formatMoney(item.sellingPrice)}</td>
                        <td>{formatMoney(item.costPrice)}</td>
                        <td className="profit-cell">{formatMoney(item.unitProfit)}</td>
                        <td className="total-profit-cell">{formatMoney(item.totalProfit)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan="6">Total ganancia neta</td>
                      <td className="total-profit-cell">
                        {formatMoney(selectedEmployeeData.totalProfit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RendimientoStaff;
