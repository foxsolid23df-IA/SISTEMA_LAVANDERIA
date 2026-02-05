import React, { useState, useEffect } from "react";
import { supplyService } from "../../services/supplyService";
import Swal from "sweetalert2";
import * as XLSX from 'xlsx';


export const SupplyInventory = () => {
  const [supplies, setSupplies] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("usage"); // usage, entry, reconciliation, inventory, history
  
  // Estados para filtros de historial
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    loadSupplies();
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
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
      Swal.fire("¡Éxito!", "Consumo registrado en la libreta digital.", "success");
      e.target.reset();
      // Restablecer fecha a hoy por defecto después del reset
      setTimeout(() => {
        const dateInput = document.getElementsByName("usage_date")[0];
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
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

  const handleCreateSupply = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      unit_measure: formData.get("unit_measure"),
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
    const dataToExport = supplies.map(s => {
      // Intentar obtener el valor actual del input si existe, si no, usar stock actual
      const inputElement = document.getElementsByName(`physical_${s.id}`)[0];
      const physical = inputElement ? parseFloat(inputElement.value) : s.current_stock;
      const diff = physical - s.current_stock;
      
      return {
        "Insumo": s.name,
        "Unidad": s.unit_measure,
        "Stock Sistema": s.current_stock,
        "Conteo Físico": physical,
        "Diferencia": diff
      };
    });

    // Agregar fecha y responsable al nombre del archivo
    const dateInput = document.getElementsByName("reconciliation_date")[0];
    const responsibleInput = document.getElementsByName("responsible")[0];
    const dateStr = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    const responsibleStr = responsibleInput ? responsibleInput.value : 'General';

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Corte Semanal");
    XLSX.writeFile(wb, `Corte_Insumos_${dateStr}_${responsibleStr}.xlsx`);
  };

  const handleReconciliation = async (e) => {

    e.preventDefault();
    const formData = new FormData(e.target);
    const reconciliations = supplies.map(s => ({
      supply_id: s.id,
      physical_stock: formData.get(`physical_${s.id}`) || s.current_stock
    }));

    const responsible = formData.get("responsible");
    const reconciliation_date = formData.get("reconciliation_date");

    try {
      const result = await supplyService.closeWeek({ reconciliations, responsible, reconciliation_date });
      Swal.fire({
        title: "Corte Completado",
        html: `Se ha ajustado el inventario.<br/><b>Resumen de diferencias:</b><br/> ${result.summary.map(r => `${r.name}: ${r.diff.toFixed(2)}`).join('<br/>')}`,
        icon: "success"
      });
      loadSupplies();
    } catch (error) {
      Swal.fire("Error", error.message, "error");
    }
  };





  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Cargando inventario de insumos...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <span className="material-icons-outlined text-primary text-4xl">inventory_2</span>
            Control de Insumos
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Libreta digital y gestión de inventario interno.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mb-8 w-fit">
        {[
          { id: "usage", label: "Libreta Digital", icon: "edit_note" },
          { id: "inventory", label: "Existencias", icon: "inventory" },
          { id: "entry", label: "Entradas", icon: "add_circle" },
          { id: "catalog", label: "Catálogo", icon: "settings_suggest" },
          { id: "reconciliation", label: "Corte Semanal", icon: "assignment_turned_in" },
          { id: "history", label: "Historial", icon: "history" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5"
            }`}
          >
            <span className="material-icons-outlined text-[20px]">{tab.icon}</span>
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
            <form onSubmit={handleRecordUsage} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Insumo</label>
                <select name="supply_id" required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20">
                  <option value="">Seleccionar...</option>
                  {supplies.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unit_measure})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cantidad Gastada</label>
                <input name="quantity" type="number" step="0.01" required placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Turno</label>
                <select name="type" required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20">
                  <option value="USAGE_MORNING">Mañana</option>
                  <option value="USAGE_AFTERNOON">Tarde</option>
                </select>
              </div>

                            {/* NUEVOS CAMPOS */}
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Quién lo usó? (Nombre)</label>
                <input name="user_name" type="text" required placeholder="Ej. Maria Perez" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Fecha de Uso</label>
                <input name="usage_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>

              <div className="flex items-end">
                <button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20">
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
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Resumen de Existencias</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-black/20 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4">Insumo</th>
                    <th className="px-6 py-4">Stock Actual</th>
                    <th className="px-6 py-4">Unidad</th>
                    <th className="px-6 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {supplies.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{s.name}</td>
                      <td className="px-6 py-4">
                        <span className={`text-lg font-black ${s.current_stock <= s.min_stock ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {s.current_stock.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">{s.unit_measure}</td>
                      <td className="px-6 py-4">
                        {s.current_stock <= s.min_stock ? (
                          <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black px-2 py-1 rounded-md uppercase">Stock Bajo</span>
                        ) : (
                          <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-2 py-1 rounded-md uppercase">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {supplies.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-slate-400">No hay insumos registrados.</td>
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
            <form onSubmit={handleAddWeekly} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Insumo</label>
                <select name="supply_id" required className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20">
                  <option value="">Seleccionar...</option>
                  {supplies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Cantidad que Entra</label>
                <input name="quantity" type="number" step="0.01" required placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:bg-black dark:hover:bg-slate-200">
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
            <form onSubmit={handleCreateSupply} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2 lg:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nombre del Insumo</label>
                <input name="name" type="text" required placeholder="Ej. Suavizante Libre Enjuague" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Unidad (Galón, Bote, etc)</label>
                <input name="unit_measure" type="text" required placeholder="GALON" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Stock Mínimo (Alerta)</label>
                <input name="min_stock" type="number" step="0.01" required placeholder="0.00" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <button type="submit" className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-primary/20">
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
                  <span className="material-icons-outlined">assignment_turned_in</span>
                  Corte Semanal de Insumos
                </h2>
                <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Contabiliza lo que hay físicamente en la estantería</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">Instrucciones</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">Ingresa la cantidad real que tienes hoy. El sistema ajustará el stock automáticamente.</p>
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
                        defaultValue={new Date().toISOString().split('T')[0]}
                        className="w-full bg-white dark:bg-slate-800 border-none rounded-lg p-3 pl-10 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 cursor-pointer text-center"
                    />
                    <span className="material-icons-outlined absolute left-3 top-[38px] text-black pointer-events-none text-[20px]">calendar_today</span>
                  </div>
                  <div>
                      <button 
                        type="button" 
                        onClick={handleExportExcel}
                        className="h-[48px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all"
                      >
                          <span className="material-icons-outlined">file_download</span>
                          Excel
                      </button>
                  </div>
              </div>


              <div className="overflow-x-auto mb-6">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-black/20 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4">Insumo</th>
                      <th className="px-6 py-4">Stock Sistema</th>
                      <th className="px-6 py-4">Conteo Físico Real</th>
                      <th className="px-6 py-4">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {supplies.map((s) => {
                       // Lógica simple para calcular diferencia en tiempo real si implementáramos estado, 
                       // por ahora usaremos inputs no controlados con visualización básica post-submit,
                       // o mejoramos a componentes controlados en el futuro.
                       // Para esta iteración, mantenemos input simple pero añadimos visualización clara.
                       return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                          {s.name}
                          <span className="block text-[10px] text-slate-400 font-normal">{s.unit_measure}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-500">{s.current_stock.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <input 
                            name={`physical_${s.id}`}
                            type="number"
                            step="0.01"
                            defaultValue={s.current_stock.toFixed(2)}
                            className="w-32 bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-2 font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                            onChange={(e) => {
                                // Cálculo visual rápido de diferencia (DOM manipulation simple para no re-renderizar todo)
                                const val = parseFloat(e.target.value) || 0;
                                const diff = val - s.current_stock;
                                const span = document.getElementById(`diff_${s.id}`);
                                if (span) {
                                    span.innerText = diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
                                    span.className = `font-black ${diff < 0 ? 'text-rose-500' : (diff > 0 ? 'text-emerald-500' : 'text-slate-300')}`;
                                }
                            }}
                          />
                        </td>
                        <td className="px-6 py-4">
                             <div id={`diff_${s.id}`} className="font-black text-slate-300">0.00</div>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-4">
                <button type="button" onClick={() => setActiveTab("inventory")} className="px-6 py-3 text-slate-500 font-bold hover:text-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-10 py-3 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center gap-2">
                  <span className="material-icons-outlined">fact_check</span>
                  FINALIZAR CORTE Y AJUSTAR STOCK
                </button>
              </div>
            </form>
          </div>

        )}
        {/* Tab: Reconciliation History */}
        {activeTab === "history" && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-icons-outlined text-primary">history</span>
                Historial de Cortes Semanales
              </h2>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Buscador */}
                <div className="relative group">
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-black transition-colors text-[20px]">search</span>
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
                  <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black group-focus-within:text-black transition-colors text-[20px]">calendar_today</span>
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
                      <span className="material-icons-outlined text-[16px]">close</span>
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
                    .filter(h => {
                      const matchSearch = (h.supply?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                                          (h.responsible || "").toLowerCase().includes(searchTerm.toLowerCase());
                      const matchDate = filterDate ? (h.reconciliation_date || h.createdAt).split('T')[0] === filterDate : true;
                      return matchSearch && matchDate;
                    })
                    .map((h, index) => (
                    <tr key={h.id || index} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">
                        {new Date(h.reconciliation_date || h.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-500">{h.responsible}</td>
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                        {h.supply?.name || 'Insumo Eliminado'}
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-500">{parseFloat(h.theoretical_stock).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">{parseFloat(h.physical_stock).toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-mono font-black ${h.difference < 0 ? 'text-rose-500' : (h.difference > 0 ? 'text-emerald-500' : 'text-slate-300')}`}>
                          {h.difference > 0 ? `+${parseFloat(h.difference).toFixed(2)}` : parseFloat(h.difference).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {history.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium">No hay registros de cortes previos.</td>
                    </tr>
                  )}
                  {history.length > 0 && history.filter(h => {
                      const matchSearch = (h.supply?.name || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
                                          (h.responsible || "").toLowerCase().includes(searchTerm.toLowerCase());
                      const matchDate = filterDate ? (h.reconciliation_date || h.createdAt).split('T')[0] === filterDate : true;
                      return matchSearch && matchDate;
                    }).length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-slate-400 font-medium whitespace-nowrap">No se encontraron resultados para los filtros aplicados.</td>
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
