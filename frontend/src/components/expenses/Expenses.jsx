import React, { useState, useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { expenseService } from "../../services/expenseService";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import "./Expenses.css";

const EXPENSE_CATEGORIES = [
  "Suministros",
  "Renta",
  "Nómina",
  "Servicios públicos",
  "Mantenimiento",
  "Transporte",
  "Marketing",
  "Otros"
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "card", label: "Tarjeta" },
  { value: "transfer", label: "Transferencia" },
  { value: "other", label: "Otro" }
];

export const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    category: ""
  });

  const [formData, setFormData] = useState({
    amount: "",
    reason: "",
    category: "Otros",
    expense_date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    notes: ""
  });

  const { isAdmin } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  if (!settingsLoading && !settings?.express_workflow_enabled) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    loadExpenses();
  }, [filters]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await expenseService.getAll(filters);
      setExpenses(data);
    } catch (error) {
      console.error("Error cargando gastos:", error);
      Swal.fire("Error", "No se pudieron cargar los gastos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const summary = useMemo(() => {
    const categories = {};
    let total = 0;

    expenses.forEach((expense) => {
      const category = expense.category || "General";
      const amount = parseFloat(expense.amount || 0);
      categories[category] = (categories[category] || 0) + amount;
      total += amount;
    });

    return { categories, total };
  }, [expenses]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      amount: "",
      reason: "",
      category: "Otros",
      expense_date: new Date().toISOString().split("T")[0],
      payment_method: "cash",
      notes: ""
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      Swal.fire("Atención", "El monto debe ser mayor a 0.", "warning");
      return;
    }

    if (!formData.reason.trim()) {
      Swal.fire("Atención", "La descripción es obligatoria.", "warning");
      return;
    }

    try {
      if (editingId) {
        await expenseService.update(editingId, formData);
        Swal.fire("Actualizado", "Gasto actualizado correctamente.", "success");
      } else {
        await expenseService.create(formData);
        Swal.fire("Guardado", "Gasto registrado correctamente.", "success");
      }
      resetForm();
      loadExpenses();
    } catch (error) {
      console.error("Error guardando gasto:", error);
      Swal.fire("Error", "No se pudo guardar el gasto.", "error");
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense.id);
    setFormData({
      amount: expense.amount,
      reason: expense.reason || "",
      category: expense.category || "Otros",
      expense_date: expense.expense_date,
      payment_method: expense.payment_method || "cash",
      notes: expense.notes || ""
    });
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar gasto?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    if (result.isConfirmed) {
      try {
        await expenseService.delete(id);
        Swal.fire("Eliminado", "Gasto eliminado correctamente.", "success");
        loadExpenses();
      } catch (error) {
        console.error("Error eliminando gasto:", error);
        Swal.fire("Error", "No se pudo eliminar el gasto.", "error");
      }
    }
  };

  const handleExport = () => {
    if (expenses.length === 0) {
      Swal.fire("Atención", "No hay gastos para exportar.", "warning");
      return;
    }

    const exportData = expenses.map((expense) => ({
      Fecha: expense.expense_date,
      Categoría: expense.category || "General",
      Descripción: expense.reason || "",
      Notas: expense.notes || "",
      Monto: parseFloat(expense.amount || 0),
      "Método de pago": expense.payment_method || "Efectivo"
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, `Gastos_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(parseFloat(amount || 0));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-MX");
  };

  return (
    <div className="expenses-container">
      <div className="expenses-header">
        <h1>💸 Control de Gastos</h1>
        <p>Registra y monitorea los gastos operativos de tu lavandería.</p>
      </div>

      <div className="expenses-grid">
        {/* Formulario */}
        <div className="expenses-card">
          <h2>{editingId ? "Editar Gasto" : "Nuevo Gasto"}</h2>
          <form onSubmit={handleSubmit} className="expenses-form">
            <div className="form-group">
              <label>Fecha</label>
              <input
                type="date"
                name="expense_date"
                value={formData.expense_date}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label>Categoría</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Descripción</label>
              <input
                type="text"
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                placeholder="Ej. Detergente, renta, luz..."
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Monto</label>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>Método de pago</label>
                <select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleInputChange}
                  required
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Notas adicionales</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Información adicional opcional..."
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingId ? "Actualizar Gasto" : "Guardar Gasto"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Resumen */}
        <div className="expenses-card">
          <h2>Resumen</h2>
          <div className="expenses-total">
            <span className="total-label">Total de gastos:</span>
            <span className="total-amount">{formatMoney(summary.total)}</span>
          </div>

          <div className="expenses-summary">
            {Object.entries(summary.categories).length === 0 ? (
              <p className="empty-text">No hay gastos registrados.</p>
            ) : (
              Object.entries(summary.categories)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => (
                  <div key={category} className="summary-row">
                    <span className="summary-category">{category}</span>
                    <span className="summary-amount">{formatMoney(amount)}</span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Filtros y lista */}
      <div className="expenses-card">
        <div className="expenses-list-header">
          <h2>Historial de Gastos</h2>
          <button className="btn btn-export" onClick={handleExport}>
            📥 Exportar Excel
          </button>
        </div>

        <div className="expenses-filters">
          <div className="filter-group">
            <label>Desde</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
          </div>

          <div className="filter-group">
            <label>Hasta</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, endDate: e.target.value }))
              }
            />
          </div>

          <div className="filter-group">
            <label>Categoría</label>
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
            >
              <option value="">Todas</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="loading-text">Cargando gastos...</p>
        ) : expenses.length === 0 ? (
          <p className="empty-text">No se encontraron gastos.</p>
        ) : (
          <div className="expenses-table-wrapper">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Notas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td>{formatDate(expense.expense_date)}</td>
                    <td>
                      <span className="category-badge">
                        {expense.category || "General"}
                      </span>
                    </td>
                    <td>{expense.reason}</td>
                    <td className="amount-cell">{formatMoney(expense.amount)}</td>
                    <td>{expense.payment_method || "Efectivo"}</td>
                    <td>{expense.notes || "-"}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-icon btn-edit"
                        onClick={() => handleEdit(expense)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(expense.id)}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Expenses;
