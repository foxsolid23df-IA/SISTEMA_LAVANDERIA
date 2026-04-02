import React, { useState, useEffect } from 'react';
import { productService } from '../../services/productService';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../hooks/useAuth';
import Swal from 'sweetalert2';

export default function ProductReconciliationTab({ products, onCancel, onSuccess }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [periodData, setPeriodData] = useState([]);
  
  // Filtros
  const [activeFilter, setActiveFilter] = useState("semana");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Estado para las cantidades físicas ingresadas
  const [physicalStocks, setPhysicalStocks] = useState({});
  const [responsible, setResponsible] = useState("");

  const fetchData = async (start, end) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const data = await productService.getReconciliationPeriodData(start, end);
      setPeriodData(data);
      
      const initialPhysical = {};
      data.forEach(item => {
        initialPhysical[item.product_id] = item.theoretical_stock;
      });
      setPhysicalStocks(initialPhysical);
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'No se pudo obtener el historial del periodo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDate = (type) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let start = todayStr;
    let end = todayStr;

    if (type === 'hoy') {
      start = todayStr;
      end = todayStr;
    } else if (type === 'ayer') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      start = yesterday.toISOString().split('T')[0];
      end = start;
    } else if (type === 'semana') {
      const startOfWeek = new Date();
      const day = startOfWeek.getDay() || 7;
      if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
      start = startOfWeek.toISOString().split('T')[0];
      end = todayStr;
    }

    setStartDate(start);
    setEndDate(end);
    setActiveFilter(type);
    fetchData(start, end);
  };

  const calculatePeriod = () => {
    setActiveFilter("personalizado");
    fetchData(startDate, endDate);
  };

  // Cargar automático al iniciar
  useEffect(() => {
    fetchData(startDate, endDate);
  }, []);

  const handlePhysicalChange = (productId, val) => {
    setPhysicalStocks(prev => ({
      ...prev,
      [productId]: val
    }));
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!responsible) {
      Swal.fire('Falta responsable', 'Por favor, ingresa el responsable del corte.', 'warning');
      return;
    }

    try {
      setLoading(true);
      const reconciliations = periodData.map(item => ({
        product_id: item.product_id,
        previous_stock: item.theoretical_stock,
        physical_stock: physicalStocks[item.product_id] !== undefined && physicalStocks[item.product_id] !== "" 
                         ? parseFloat(physicalStocks[item.product_id]) 
                         : parseFloat(item.theoretical_stock)
      }));

      await productService.closeWeek({
        reconciliations,
        responsible,
        reconciliation_date: endDate
      });

      Swal.fire('Corte Aplicado', 'Las diferencias se han ajustado en el sistema.', 'success');
      onSuccess();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Hubo un error al aplicar el corte.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Resumen del Periodo
  const totalInicial = periodData.reduce((acc, a) => acc + (a.initial_stock || 0), 0);
  const totalEntradas = periodData.reduce((acc, a) => acc + (a.period_entries || 0), 0);
  const totalVentas = periodData.reduce((acc, a) => acc + (a.period_sales || 0), 0);
  const totalTeorico = periodData.reduce((acc, a) => acc + (a.theoretical_stock || 0), 0);

  let rowsWithDiff = 0;
  let totalImpact = 0;
  
  periodData.forEach(item => {
    const phys = parseFloat(physicalStocks[item.product_id] || 0);
    const theor = parseFloat(item.theoretical_stock || 0);
    const diff = phys - theor;
    if (Math.abs(diff) > 0.001) {
      rowsWithDiff++;
      totalImpact += diff;
    }
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
      {/* HEADER Y FILTROS */}
      <div className="flex flex-col xl:flex-row justify-between xl:items-end gap-6 mb-8 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div className="flex-1">
          <h2 className="text-2xl font-black mb-1 flex items-center gap-2 text-indigo-500">
            <span className="material-icons-outlined">fact_check</span>
            CORTE DE PRODUCTOS (CATÁLOGO)
          </h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Ajuste de Auditoría y Balance del Periodo
          </p>
          
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2 border-b border-transparent">
             <button type="button" onClick={() => handleQuickDate('hoy')} className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors ${activeFilter === 'hoy' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>Hoy</button>
             <button type="button" onClick={() => handleQuickDate('ayer')} className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors ${activeFilter === 'ayer' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>Ayer</button>
             <button type="button" onClick={() => handleQuickDate('semana')} className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors ${activeFilter === 'semana' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>Esta semana</button>
             <button type="button" onClick={() => setActiveFilter('personalizado')} className={`px-4 py-1.5 text-xs font-bold rounded-full border transition-colors ${activeFilter === 'personalizado' ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>Personalizado</button>
          </div>
        </div>

        <div className="flex-1 max-w-2xl bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Seleccionar Periodo</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha inicio</label>
              <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setActiveFilter('personalizado'); }} className="w-full bg-white dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Fecha fin</label>
              <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setActiveFilter('personalizado'); }} className="w-full bg-white dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <button onClick={calculatePeriod} className="w-full bg-indigo-600 text-white font-bold p-2 text-xs rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all h-[34px]">
                {loading ? 'Calculando...' : 'CALCULAR CORTE'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TARJETAS RESUMEN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-center sm:text-left">
        <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-2xl border border-sky-100 dark:border-sky-800/50">
          <p className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 mb-1">Stock Inicial</p>
          <p className="text-xl font-black text-sky-900 dark:text-sky-100">{totalInicial.toFixed(2)}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
          <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Entradas</p>
          <p className="text-xl font-black text-emerald-900 dark:text-emerald-100">+{totalEntradas.toFixed(2)}</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800/50">
          <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 mb-1">Ventas</p>
          <p className="text-xl font-black text-rose-900 dark:text-rose-100">-{totalVentas.toFixed(2)}</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 ring-1 ring-indigo-500/20">
          <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mb-1">Stock Teórico</p>
          <p className="text-xl font-black text-indigo-900 dark:text-indigo-100">{totalTeorico.toFixed(2)}</p>
        </div>
      </div>

      {/* RESPONSABLE */}
      <div className="mb-6 w-full md:w-1/3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          Responsable del Corte
        </label>
        <input
          type="text"
          value={responsible}
          onChange={e => setResponsible(e.target.value)}
          placeholder="Ej. Admin"
          className="w-full bg-slate-50 dark:bg-slate-800/30 border-none rounded-xl p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* TABLA DETALLE */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-4 tracking-tighter">Producto</th>
                <th className="px-4 py-4 text-right">Inicial</th>
                <th className="px-4 py-4 text-right">Entradas</th>
                <th className="px-4 py-4 text-right">Ventas</th>
                <th className="px-4 py-4 text-right">Teórico</th>
                <th className="px-6 py-4 text-center bg-indigo-50 dark:bg-indigo-900/10">Físico Real</th>
                <th className="px-4 py-4 text-center">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {periodData.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400 font-bold italic">
                    {loading ? "Cargando datos..." : "No hay datos para este periodo. Selecciona y presiona CALCULAR."}
                  </td>
                </tr>
              )}
              {periodData.map((item) => {
                const theoric = parseFloat(item.theoretical_stock || 0);
                const phys = physicalStocks[item.product_id] !== undefined ? physicalStocks[item.product_id] : theoric;
                const diff = phys - theoric;
                
                const diffColor = diff < 0 
                  ? "text-rose-600 bg-rose-50 dark:bg-rose-900/20" 
                  : diff > 0 
                    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" 
                    : "text-slate-400 bg-slate-50 dark:bg-slate-800";

                return (
                  <tr key={item.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">
                      {item.name}
                    </td>
                    <td className="px-4 py-4 text-right text-xs font-mono text-slate-500">{(item.initial_stock || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-xs font-mono text-emerald-600">+{(item.period_entries || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-right text-xs font-mono text-rose-500">-{(item.period_sales || 0).toFixed(2)}</td>
                    <td className="px-4 py-4 text-right font-black font-mono text-indigo-600">{theoric.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center bg-indigo-50 dark:bg-indigo-900/10">
                      <input
                        type="number"
                        step="0.01"
                        value={phys}
                        onChange={(e) => handlePhysicalChange(item.product_id, e.target.value)}
                        className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 text-center font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`font-mono text-xs font-black px-2 py-1 rounded inline-block min-w-[60px] ${diffColor}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER ACCIONES */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-700/50 gap-4">
        <div className="text-center md:text-left">
          <p className="text-xs font-black uppercase text-indigo-500 tracking-widest mb-1 italic">Resumen del ajuste</p>
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {rowsWithDiff} productos con diferencia • Impacto: <span className={`font-black ${totalImpact < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{totalImpact.toFixed(2)}</span> unidades
          </p>
        </div>
        
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            type="button" 
            onClick={onCancel}
            className="flex-1 md:flex-none px-6 py-3 font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cerrar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={loading || periodData.length === 0}
            className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {loading ? 'APLICANDO...' : 'CONFIRMAR CORTE FINAL'}
          </button>
        </div>
      </div>
    </div>
  );
}
