import React, { useState, useEffect } from "react";
import { supplyService } from "../../services/supplyService";
import { useAuth } from "../../hooks/useAuth";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";

export const SupplyInventory = () => {
  const [supplies, setSupplies] = useState([]);
  const [history, setHistory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [latestRecons, setLatestRecons] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("usage"); // usage, entry, reconciliation, inventory, history, movements

  const { isAdmin, activeRole, canManageInventory, canViewSupplies } = useAuth();
  const canEditOrDelete = canManageInventory;

  // Estados para filtros de historial
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedUsageSupplyId, setSelectedUsageSupplyId] = useState("");

  // Insumo seleccionado en Libreta Digital para mostrar su unidad
  const selectedUsageSupply = supplies.find((s) => s.id === selectedUsageSupplyId);

  useEffect(() => {
    loadSupplies();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
    if (activeTab === "movements") {
      loadMovements();
    }
    if (activeTab === "reconciliation") {
      loadLatestRecons();
    }
  }, [activeTab]);

  const loadSupplies = async () => {
    try {
      const data = await supplyService.getAll();
      setSupplies(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await supplyService.getReconciliationHistory();
      setHistory(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadMovements = async () => {
    try {
      const data = await supplyService.getMovementHistory();
      setMovements(data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadLatestRecons = async () => {
    try {
      const data = await supplyService.getLatestReconciliations();
      const map = {};
      data.forEach(r => { map[r.supply_id] = r.physical_stock });
      setLatestRecons(map);
    } catch (e) { console.error(e); }
  };

  const handleRecordUsage = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      supply_id: formData.get("supply_id"),
      quantity: formData.get("quantity"),
      type: formData.get("type"),
      notes: formData.get("notes"),
      user_name: formData.get("user_name"),
      usage_date: formData.get("usage_date"),
    };

    try {
      await supplyService.recordUsage(data);
      Swal.fire(
        "¡Éxito!",
        "Consumo registrado en la libreta digital.",
        "success",
      );
      e.target.reset();
      // Restablecer fecha a hoy por defecto después del reset
      setTimeout(() => {
        const dateInput = document.getElementsByName("usage_date")[0];
        if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
      }, 100);
      loadSupplies();
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  const handleAddWeekly = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      supply_id: formData.get("supply_id"),
      quantity: formData.get("quantity"),
      notes: formData.get("notes"),
    };

    try {
      await supplyService.addWeekly(data);
      Swal.fire("¡Éxito!", "Insumos agregados al inventario.", "success");
      e.target.reset();
      loadSupplies();
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  const handleExportHistoryExcel = () => {
    try {
      if (history.length === 0) {
        Swal.fire("Aviso", "No hay datos para exportar", "info");
        return;
      }

      // Filtrar los datos que se están visualizando actualmente (según búsqueda y fecha)
      const filteredData = history.filter((h) => {
        const matchSearch =
          (h.supply?.name || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (h.responsible || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchDate = filterDate
          ? (h.reconciliation_date || h.createdAt).split("T")[0] === filterDate
          : true;
        return matchSearch && matchDate;
      });

      if (filteredData.length === 0) {
        Swal.fire("Aviso", "No hay datos filtrados para exportar", "info");
        return;
      }

      // Preparar los datos para el Excel
      const excelData = filteredData.map((h) => ({
        Fecha: new Date(h.reconciliation_date || h.createdAt).toLocaleDateString(),
        Responsable: h.responsible,
        Insumo: h.supply?.name || "Insumo Eliminado",
        "Stock Teórico": parseFloat(h.theoretical_stock).toFixed(2),
        "Stock Físico": parseFloat(h.physical_stock).toFixed(2),
        Diferencia: h.difference,
      }));

      // Crear el libro y la hoja
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Historial_Cortes");

      // Ajustar anchos de columna automáticamente
      const wscols = [
        { wch: 15 }, // Fecha
        { wch: 25 }, // Responsable
        { wch: 25 }, // Insumo
        { wch: 15 }, // Stock Teórico
        { wch: 15 }, // Stock Físico
        { wch: 15 }, // Diferencia
      ];
      worksheet["!cols"] = wscols;

      // Generar y descargar el archivo
      const fileName = `Historial_Cortes_Insumos_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

    } catch (error) {
      console.error("Error al exportar Excel:", error);
      Swal.fire("Error", "No se pudo generar el archivo Excel", "error");
    }
  };

  const handleCreateSupply = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      unit_measure: formData.get("unit_measure"),
      presentation: formData.get("presentation"),
      content_per_presentation: formData.get("content_per_presentation"),
      min_stock: formData.get("min_stock"),
    };

    try {
      await supplyService.create(data);
      Swal.fire("¡Éxito!", "Nuevo insumo creado.", "success");
      e.target.reset();
      loadSupplies();
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  const handleExportExcel = () => {
    const dataToExport = supplies.map((s) => {
      // Intentar obtener el valor actual del input si existe, si no, usar stock actual
      const inputElement = document.getElementsByName(`physical_${s.id}`)[0];
      const physical = inputElement
        ? parseFloat(inputElement.value)
        : s.current_stock;
      const diff = physical - s.current_stock;

      return {
        Insumo: s.name,
        Unidad: s.unit_measure,
        "Stock Sistema": s.current_stock,
        "Conteo Físico": physical,
        Diferencia: diff,
      };
    });

    // Agregar fecha y responsable al nombre del archivo
    const dateInput = document.getElementsByName("reconciliation_date")[0];
    const responsibleInput = document.getElementsByName("responsible")[0];
    const dateStr = dateInput
      ? dateInput.value
      : new Date().toISOString().split("T")[0];
    const responsibleStr = responsibleInput
      ? responsibleInput.value
      : "General";

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Corte Semanal");
    XLSX.writeFile(wb, `Corte_Insumos_${dateStr}_${responsibleStr}.xlsx`);
  };

  const handleReconciliation = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const reconciliations = supplies.map((s) => {
      const inputElement = document.getElementsByName(`physical_${s.id}`)[0];
      const val = inputElement ? inputElement.value : formData.get(`physical_${s.id}`);
      const physical = (val !== "" && val !== null && val !== undefined) ? parseFloat(val) : s.current_stock;

      const last_count = latestRecons[s.id] !== undefined ? latestRecons[s.id] : null;

      return {
        supply_id: s.id,
        previous_stock: s.current_stock,
        physical_stock: physical,
        last_count: last_count
      };
    });

    const responsible = formData.get("responsible");
    const reconciliation_date = formData.get("reconciliation_date");

    try {
      const result = await supplyService.closeWeek({
        reconciliations,
        responsible,
        reconciliation_date,
      });
      Swal.fire({
        title: "Corte Completado",
        html: `Se ha ajustado el inventario.<br/><br/><b>Resumen del Periodo:</b><br/> 
        <div class="max-h-60 overflow-y-auto">
          ${result.summary.map((r) => 
            `<div class="text-left mt-2 pb-2 border-b border-gray-100 dark:border-slate-800">
               <b class="text-indigo-600 dark:text-indigo-400">${r.name}</b><br/>
               <span class="text-xs text-slate-500">Último corte: ${r.last_count !== null ? r.last_count.toFixed(2) : '-'} | Actual: ${r.physical_stock.toFixed(2)}</span><br/>
               <span class="text-sm font-bold ${r.gasto > 0 ? 'text-rose-500' : 'text-slate-500'}">Gasto del Periodo: ${r.gasto !== 0 ? r.gasto.toFixed(2) : '0.00'}</span><br/>
               <span class="text-xs ${r.diff !== 0 ? 'text-amber-500' : 'text-emerald-500'}">Dif Sist: ${r.diff.toFixed(2)}</span>
             </div>`
          ).join("")}
        </div>`,
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "OK",
        cancelButtonText: "🖨️ Imprimir Ticket",
        cancelButtonColor: "#4f46e5",
      }).then((swalResult) => {
        if (swalResult.dismiss === Swal.DismissReason.cancel) {
          // Imprimir Ticket
          const printWindow = window.open('', '_blank');
          const printHtml = `
            <html>
            <head>
              <title>Ticket de Corte Semanal</title>
              <style>
                body { font-family: monospace; font-size: 14px; padding: 20px; max-width: 400px; margin: 0 auto; }
                h2 { text-align: center; font-size: 18px; margin-bottom: 5px; }
                p { text-align: center; margin: 5px 0; }
                .divider { border-bottom: 1px dashed #000; margin: 15px 0; }
                .item { margin-bottom: 10px; }
                .title { font-weight: bold; }
                .row { display: flex; justify-content: space-between; }
                .small { font-size: 12px; }
              </style>
            </head>
            <body>
              <h2>CORTE DE INSUMOS</h2>
              <p>Fecha: ${reconciliation_date}</p>
              <p>Responsable: ${responsible}</p>
              <div class="divider"></div>
              ${result.summary.map(r => `
                <div class="item">
                  <div class="title">${r.name}</div>
                  <div class="small">Último: ${r.last_count !== null ? r.last_count.toFixed(2) : '-'} | Actual: ${r.physical_stock.toFixed(2)}</div>
                  <div class="row">
                    <span>Gasto:</span>
                    <span>${r.gasto !== 0 ? r.gasto.toFixed(2) : '0.00'}</span>
                  </div>
                  <div class="row small">
                    <span>Dif. Sist:</span>
                    <span>${r.diff.toFixed(2)}</span>
                  </div>
                </div>
              `).join("")}
              <div class="divider"></div>
              <p>FIN DEL REPORTE</p>
              <script>
                window.onload = function() { 
                  setTimeout(() => { window.print(); }, 500); 
                }
                window.onafterprint = function() { window.close(); }
              </script>
            </body>
            </html>
          `;
          printWindow.document.write(printHtml);
          printWindow.document.close();
        }
      });
      loadSupplies();
      loadLatestRecons();
      setActiveTab("inventory");
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };

  const handleEditSupply = async (supply) => {
    const { value: formValues } = await Swal.fire({
      title: "Editar Insumo",
      html: `<div class="text-left">
          <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Nombre del Insumo</label>
          <input id="swal-edit-name" class="swal2-input w-full mx-0 mb-4" value="${supply.name}">
          <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Presentación (Galón, Bote, etc)</label>
          <input id="swal-edit-presentation" class="swal2-input w-full mx-0 mb-4" value="${supply.presentation || 'Galón'}">
          <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Contenido por Presentación</label>
          <input id="swal-edit-content" type="number" step="0.01" class="swal2-input w-full mx-0 mb-4" value="${supply.content_per_presentation || 1}">
          <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Unidad Base (L, Kg, mL, Pza)</label>
          <input id="swal-edit-unit" class="swal2-input w-full mx-0 mb-4" value="${supply.unit_measure}">
          <label class="block text-xs font-bold text-slate-500 mb-1 uppercase">Stock Mínimo</label>
          <input id="swal-edit-min" type="number" step="0.01" class="swal2-input w-full mx-0 mb-4" value="${supply.min_stock}">
          <label class="block text-xs font-bold text-slate-500 mb-1 uppercase text-indigo-500">Stock Actual (Ajuste Manual)</label>
          <input id="swal-edit-current" type="number" step="0.01" class="swal2-input w-full mx-0 mb-4 font-bold text-indigo-600" value="${supply.current_stock}">
        </div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Guardar Cambios",
      cancelButtonText: "Cancelar",
      preConfirm: () => {
        return {
          name: document.getElementById("swal-edit-name").value,
          presentation: document.getElementById("swal-edit-presentation").value,
          content_per_presentation: document.getElementById("swal-edit-content").value,
          unit_measure: document.getElementById("swal-edit-unit").value,
          min_stock: document.getElementById("swal-edit-min").value,
          current_stock: document.getElementById("swal-edit-current").value,
        };
      },
    });

    if (formValues) {
      if (
        !formValues.name ||
        !formValues.unit_measure ||
        formValues.min_stock === "" ||
        formValues.current_stock === ""
      ) {
        Swal.fire("Error", "Todos los campos son requeridos", "error");
        return;
      }
      try {
        await supplyService.update(supply.id, formValues);
        Swal.fire("¡Actualizado!", "El insumo ha sido actualizado.", "success");
        loadSupplies();
      } catch (error) {
        Swal.fire("Error", error.message, "error");
      }
    }
  };

  const handleDeleteSupply = async (supply) => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Borrar Insumo?",
      html: `<p class="mb-4">¿Estás seguro de que deseas borrar el insumo <b>${supply.name}</b>?</p>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
    });

    if (isConfirmed) {
      try {
        await supplyService.delete(supply.id);
        Swal.fire(
          "¡Borrado!",
          "El insumo ha sido eliminado.",
          "success",
        );
        loadSupplies();
      } catch (error) {
        Swal.fire("Error", error.message, "error");
      }
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500 font-bold">
        Cargando inventario de insumos...
      </div>
    );

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="material-icons-outlined text-primary text-4xl">
              inventory_2
            </span>
            Control de Insumos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Libreta digital y gestión de inventario interno.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-8 w-fit">
        {[
          { id: "usage", label: "Libreta Digital", icon: "edit_note" },
          { id: "inventory", label: "Existencias", icon: "inventory" },
          { id: "entry", label: "Entradas", icon: "add_circle" },
          { id: "catalog", label: "Catálogo", icon: "settings_suggest" },
          {
            id: "reconciliation",
            label: "Corte Semanal",
            icon: "assignment_turned_in",
          },
          { id: "movements", label: "Movimientos", icon: "swap_vert" },
          { id: "history", label: "Historial Cortes", icon: "history" },
        ]
          .filter((tab) => {
            // Si tiene permiso completo, ve todas las tabs
            if (canManageInventory) return true;
            // Si solo tiene can_view_supplies, solo ve Libreta Digital y Existencias
            if (canViewSupplies) return ["usage", "inventory"].includes(tab.id);
            return true;
          })
          .map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5"
            }`}
          >
            <span className="material-icons-outlined text-[20px]">
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Tab: Libreta Digital (Usage) */}
        {activeTab === "usage" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
              <span className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                <span className="material-icons-outlined text-sm">edit</span>
              </span>
              Registrar Uso de Turno
            </h2>
            <form
              onSubmit={handleRecordUsage}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Insumo
                </label>
                <select
                  name="supply_id"
                  required
                  value={selectedUsageSupplyId}
                  onChange={(e) => setSelectedUsageSupplyId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Seleccionar...</option>
                  {supplies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.unit_measure})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cantidad Gastada
                </label>
                <div className="relative">
                  <input
                    name="quantity"
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 pr-16 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                  {selectedUsageSupply && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-primary/10 text-primary text-xs font-black px-2 py-1 rounded-lg uppercase pointer-events-none">
                      {selectedUsageSupply.unit_measure}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Turno
                </label>
                <select
                  name="type"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                >
                  <option value="USAGE_MORNING">Mañana</option>
                  <option value="USAGE_AFTERNOON">Tarde</option>
                </select>
              </div>

              {/* NUEVOS CAMPOS */}
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quién lo usó? (Nombre)
                </label>
                <input
                  name="user_name"
                  type="text"
                  required
                  placeholder="Ej. Maria Perez"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Fecha de Uso
                </label>
                <input
                  name="usage_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().split("T")[0]}
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                  Guardar en Libreta
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Inventory View */}
        {activeTab === "inventory" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Resumen de Existencias
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-black/20 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4">Insumo</th>
                    <th className="px-6 py-4">Stock Actual</th>
                    <th className="px-6 py-4">Presentación</th>
                    <th className="px-6 py-4">Unidad Base</th>
                    <th className="px-6 py-4">Estado</th>
                    {canEditOrDelete && (
                      <th className="px-6 py-4 text-right">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {supplies.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                        {s.name}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-lg font-black ${s.current_stock <= s.min_stock ? "text-rose-500" : "text-emerald-500"}`}
                        >
                          {s.current_stock.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">
                        {s.presentation || '—'} ({s.content_per_presentation || 1} {s.unit_measure})
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">
                        {s.unit_measure}
                      </td>
                      <td className="px-6 py-4">
                        {s.current_stock <= s.min_stock ? (
                          <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-1 rounded-md uppercase">
                            Stock Bajo
                          </span>
                        ) : (
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-1 rounded-md uppercase">
                            OK
                          </span>
                        )}
                      </td>
                      {canEditOrDelete && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEditSupply(s)}
                              className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                              title="Editar Insumo"
                            >
                              <span className="material-icons-outlined text-[18px]">
                                edit
                              </span>
                            </button>
                            <button
                              onClick={() => handleDeleteSupply(s)}
                              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Borrar Insumo"
                            >
                              <span className="material-icons-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {supplies.length === 0 && (
                    <tr>
                      <td
                        colSpan={canEditOrDelete ? "7" : "6"}
                        className="px-6 py-12 text-center text-slate-400"
                      >
                        No hay insumos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Add Weekly Supply (Entry) */}
        {activeTab === "entry" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
              <span className="material-icons-outlined">add_circle</span>
              Entrada de Insumos (Semanal)
            </h2>
            <form
              onSubmit={handleAddWeekly}
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Insumo
                </label>
                <select
                  name="supply_id"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Seleccionar...</option>
                  {supplies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.presentation || 'Galón'} ({s.content_per_presentation || 1} {s.unit_measure})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Cantidad (en Presentaciones)
                </label>
                <input
                  name="quantity"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:bg-black dark:hover:bg-slate-200"
                >
                  Registrar Entrega
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Catalog (Create New) */}
        {activeTab === "catalog" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
              <span className="material-icons-outlined">settings_suggest</span>
              Configuración de Insumos
            </h2>
            <form
              onSubmit={handleCreateSupply}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <div className="space-y-2 lg:col-span-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Nombre del Insumo
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Ej. Suavizante Libre Enjuague"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>

              {/* PRESENTACIÓN */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Presentación
                </label>
                <select
                  name="presentation"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Galón">Galón</option>
                  <option value="Bote">Bote</option>
                  <option value="Garrafa">Garrafa</option>
                  <option value="Costal">Costal</option>
                  <option value="Caja">Caja</option>
                  <option value="Bolsa">Bolsa</option>
                  <option value="Frasco">Frasco</option>
                  <option value="Pieza">Pieza</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {/* CONTENIDO POR PRESENTACIÓN */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Contenido por Presentación
                </label>
                <input
                  name="content_per_presentation"
                  type="number"
                  step="0.01"
                  required
                  placeholder="Ej. 3.7"
                  defaultValue="1"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>

              {/* UNIDAD DE MEDIDA BASE */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Unidad de Medida
                </label>
                <select
                  name="unit_measure"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20"
                >
                  <option value="L">Litros (L)</option>
                  <option value="mL">Mililitros (mL)</option>
                  <option value="Kg">Kilogramos (Kg)</option>
                  <option value="g">Gramos (g)</option>
                  <option value="Pza">Piezas (Pza)</option>
                  <option value="Rollo">Rollos</option>
                  <option value="Galón">Galón</option>
                </select>
              </div>

              {/* STOCK MÍNIMO */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Stock Mínimo (Alerta)
                </label>
                <input
                  name="min_stock"
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                />
              </div>

              <div className="lg:col-span-3 flex justify-end">
                <button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
                >
                  Crear Insumo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab: Weekly Reconciliation (Corte) */}
        {activeTab === "reconciliation" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-500">
                  <span className="material-icons-outlined">
                    assignment_turned_in
                  </span>
                  Corte Semanal de Insumos
                </h2>
                <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">
                  Contabiliza lo que hay físicamente en la estantería
                </p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                  Instrucciones
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Ingresa la cantidad real que tienes hoy. El sistema ajustará
                  el stock automáticamente.
                </p>
              </div>
            </div>

            <form onSubmit={handleReconciliation}>
              {/* Info del Responsable */}
              {/* Info del Responsable y Fecha */}
              <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-2">
                    Responsable del Corte (Obligatorio)
                  </label>
                  <input
                    name="responsible"
                    type="text"
                    required
                    placeholder="Escribe tu nombre..."
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-lg p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="w-full md:w-1/3 relative">
                  <label className="block text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-2">
                    Fecha del Corte
                  </label>
                  <input
                    name="reconciliation_date"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split("T")[0]}
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-lg p-3 pl-10 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center"
                  />
                  <div className="absolute left-3 top-[38px] text-black dark:text-white z-10 pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="opacity-100"
                    >
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="h-[48px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all"
                  >
                    <span className="material-icons-outlined">
                      file_download
                    </span>
                    Excel
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto mb-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-black/20 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4">Insumo</th>
                      <th className="px-6 py-4">Último Conteo</th>
                      <th className="px-6 py-4">Stock Sistema</th>
                      <th className="px-6 py-4">Conteo Físico Real</th>
                      <th className="px-6 py-4 text-center">Gasto Periodo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {supplies.map((s) => {
                      // Lógica simple para calcular diferencia en tiempo real si implementáramos estado,
                      // por ahora usaremos inputs no controlados con visualización básica post-submit,
                      // o mejoramos a componentes controlados en el futuro.
                      // Para esta iteración, mantenemos input simple pero añadimos visualización clara.
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                            {s.name}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {s.unit_measure}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-400">
                            {latestRecons[s.id] !== undefined ? latestRecons[s.id].toFixed(2) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-500">
                            {s.current_stock.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              name={`physical_${s.id}`}
                              type="number"
                              step="0.01"
                              defaultValue={s.current_stock.toFixed(2)}
                              className="w-32 bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                
                                // Gasto (Último Conteo - Conteo Físico)
                                const last = latestRecons[s.id] !== undefined ? latestRecons[s.id] : s.current_stock;
                                const gasto = last - val;
                                
                                const spanGasto = document.getElementById(`gasto_${s.id}`);
                                if (spanGasto) {
                                  spanGasto.innerText = gasto.toFixed(2);
                                  spanGasto.className = `font-black ${gasto > 0 ? "text-rose-500" : gasto < 0 ? "text-emerald-500" : "text-slate-300"}`;
                                }
                              }}
                            />
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div
                              id={`gasto_${s.id}`}
                              className="font-black text-slate-300"
                            >
                              { (() => {
                                const last = latestRecons[s.id] !== undefined ? latestRecons[s.id] : s.current_stock;
                                return (last - s.current_stock).toFixed(2);
                              })() }
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab("inventory")}
                  className="px-6 py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-10 py-3 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  <span className="material-icons-outlined">fact_check</span>
                  FINALIZAR CORTE Y AJUSTAR STOCK
                </button>
              </div>
            </form>
          </div>
        )}
        {/* Tab: Movimientos Diarios */}
        {activeTab === "movements" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">swap_vert</span>
                Movimientos Diarios (Entradas y Consumos)
              </h2>
              <button
                onClick={loadMovements}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 transition-all"
                title="Actualizar"
              >
                <span className="material-icons-outlined">refresh</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-black/20 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Insumo</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4 text-center">Cantidad</th>
                    <th className="px-6 py-4">Responsable</th>
                    <th className="px-6 py-4">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {movements.map((m, index) => {
                    const isEntry = m.type === 'ENTRY_WEEKLY';
                    const typeLabel = {
                      'ENTRY_WEEKLY': 'Entrada Semanal',
                      'USAGE_MORNING': 'Consumo Mañana',
                      'USAGE_AFTERNOON': 'Consumo Tarde',
                      'ADJUSTMENT': 'Ajuste'
                    }[m.type] || m.type;
                    return (
                      <tr key={m.id || index} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                          {m.usage_date ? new Date(m.usage_date + 'T12:00:00').toLocaleDateString() : new Date(m.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {m.supply?.name || 'Insumo Eliminado'}
                          <span className="block text-[10px] text-slate-400 font-normal">{m.supply?.unit_measure}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase ${
                            isEntry
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`font-mono font-black text-lg ${isEntry ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isEntry ? '+' : '-'}{parseFloat(m.quantity).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-500">
                          {m.staff_name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400 max-w-[200px] truncate">
                          {m.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {movements.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">
                        No hay movimientos registrados aún. Registra un consumo o entrada para empezar a ver el historial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* Tab: Reconciliation History */}
        {activeTab === "history" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">
                  history
                </span>
                Historial de Cortes Semanales
              </h2>

              <div className="flex flex-wrap items-center gap-3">
                {/* Buscador */}
                <div className="relative group">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors text-[20px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por insumo o responsable..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-black dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-black/5 w-full md:w-64 transition-all"
                  />
                </div>

                {/* Filtro de Fecha */}
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black dark:text-white z-10 pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="opacity-100"
                    >
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
                    </svg>
                  </div>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-bold text-black dark:text-white focus:ring-2 focus:ring-black/5 transition-all"
                  />
                  {filterDate && (
                    <button
                      onClick={() => setFilterDate("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <span className="material-icons-outlined text-[16px]">
                        close
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadHistory}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-500 transition-all"
                    title="Actualizar historial"
                  >
                    <span className="material-icons-outlined">refresh</span>
                  </button>
                  <button
                    onClick={handleExportHistoryExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-500/20"
                    title="Exportar a Excel"
                  >
                    <span className="material-icons-outlined text-[18px]">
                      file_download
                    </span>
                    EXCEL
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-black/20 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Responsable</th>
                    <th className="px-6 py-4">Insumo</th>
                    <th className="px-6 py-4 text-center">Teórico</th>
                    <th className="px-6 py-4 text-center">Físico</th>
                    <th className="px-6 py-4 text-center">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {history
                    .filter((h) => {
                      const matchSearch =
                        (h.supply?.name || "")
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        (h.responsible || "")
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase());
                      const matchDate = filterDate
                        ? (h.reconciliation_date || h.createdAt).split(
                            "T",
                          )[0] === filterDate
                        : true;
                      return matchSearch && matchDate;
                    })
                    .map((h, index) => (
                      <tr
                        key={h.id || index}
                        className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                          {new Date(
                            h.reconciliation_date || h.createdAt,
                          ).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-500">
                          {h.responsible}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                          {h.supply?.name || "Insumo Eliminado"}
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-slate-500">
                          {parseFloat(h.theoretical_stock).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {parseFloat(h.physical_stock).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`font-mono font-black ${h.difference < 0 ? "text-rose-500" : h.difference > 0 ? "text-emerald-500" : "text-slate-300"}`}
                          >
                            {h.difference > 0
                              ? `+${parseFloat(h.difference).toFixed(2)}`
                              : parseFloat(h.difference).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {history.length === 0 && (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-12 text-center text-slate-400 font-medium"
                      >
                        No hay registros de cortes previos.
                      </td>
                    </tr>
                  )}
                  {history.length > 0 &&
                    history.filter((h) => {
                      const matchSearch =
                        (h.supply?.name || "")
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase()) ||
                        (h.responsible || "")
                          .toLowerCase()
                          .includes(searchTerm.toLowerCase());
                      const matchDate = filterDate
                        ? (h.reconciliation_date || h.createdAt).split(
                            "T",
                          )[0] === filterDate
                        : true;
                      return matchSearch && matchDate;
                    }).length === 0 && (
                      <tr>
                        <td
                          colSpan="6"
                          className="px-6 py-12 text-center text-slate-400 font-medium whitespace-nowrap"
                        >
                          No se encontraron resultados para los filtros
                          aplicados.
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
