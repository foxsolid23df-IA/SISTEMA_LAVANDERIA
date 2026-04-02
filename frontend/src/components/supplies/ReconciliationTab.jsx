import React, { useState, useEffect } from 'react';
import { supplyService } from '../../services/supplyService';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../hooks/useAuth';
import Swal from 'sweetalert2';

export default function ReconciliationTab({ supplies, onCancel, onSuccess }) {
  const { settings } = useSettings();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [periodData, setPeriodData] = 
    useState([]);
  
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
  const [branch, setBranch] = useState("Lavandería Centro");
  const [category, setCategory] = useState("Insumos internos");
  
  // Estado para las cantidades físicas ingresadas
  const [physicalStocks, setPhysicalStocks] = useState({});
  const [observations, setObservations] = useState("");
  const [responsible, setResponsible] = useState("");

  const fetchData = async (start, end) => {
    if (!start || !end) return;
    setLoading(true);
    try {
      const data = await supplyService.getReconciliationPeriodData(start, end);
      setPeriodData(data);
      
      const initialPhysical = {};
      data.forEach(item => {
        initialPhysical[item.supply_id] = item.theoretical_stock;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhysicalChange = (supplyId, val) => {
    setPhysicalStocks(prev => ({
      ...prev,
      [supplyId]: val
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
      // Armamos los datos para enviar a closeWeek o registerAdjustment
      const reconciliations = periodData.map(item => ({
        supply_id: item.supply_id,
        previous_stock: item.theoretical_stock,
        physical_stock: physicalStocks[item.supply_id] !== undefined && physicalStocks[item.supply_id] !== "" 
                         ? parseFloat(physicalStocks[item.supply_id]) 
                         : parseFloat(item.theoretical_stock)
      }));

      // El supplyService.closeWeek espera reconciliations, responsible, reconciliation_date
      await supplyService.closeWeek({
        reconciliations,
        responsible,
        reconciliation_date: endDate // Se toma la fecha fin como fecha de corte
      });

      handlePrint();

      Swal.fire('Corte Aplicado', 'Las diferencias se han ajustado en el sistema.', 'success');
      onSuccess();
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Hubo un error al aplicar el corte.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      Swal.fire('Error', 'No se pudo abrir la ventana de impresión (Popup bloqueado)', 'error');
      return;
    }

    const businessName = settings?.name || 'LAVANDERÍA "LA ESPERANZA"';
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-MX');
    const formattedTime = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    let totalInicialValue = 0;
    let totalEntradasValue = 0;
    let totalConsumoValue = 0;
    let totalTeoricoValue = 0;
    let totalDiferenciaValue = 0;

    const buildSection = (title, getter) => {
      const items = periodData.map(item => {
        const val = getter(item);
        const unit = item.unit_measure || 'L';
        return `<div class="row"><span>${item.name}</span><div class="dots"></div><strong>${val.toFixed(2)} ${unit}</strong></div>`;
      }).join('');
      return `<div class="section-title">${title}</div>${items}<div class="divider"></div>`;
    };

    const initialSection = buildSection('INICIAL (al principio del periodo)', (item) => {
      totalInicialValue += item.initial_stock;
      return item.initial_stock;
    });

    const entriesSection = buildSection('ENTRADAS (compras)', (item) => {
      totalEntradasValue += item.period_entries;
      return item.period_entries;
    });

    const usageSection = buildSection('CONSUMO (uso)', (item) => {
      totalConsumoValue += item.period_usage;
      return item.period_usage;
    });

    const theoreticalSection = buildSection('STOCK TEÓRICO', (item) => {
      totalTeoricoValue += item.theoretical_stock;
      return item.theoretical_stock;
    });

    const physicalSection = buildSection('CONTEO FÍSICO', (item) => {
      const physical = physicalStocks[item.supply_id] !== undefined && physicalStocks[item.supply_id] !== "" 
                       ? parseFloat(physicalStocks[item.supply_id]) 
                       : item.theoretical_stock;
      return physical;
    });

    const differenceSection = buildSection('DIFERENCIA', (item) => {
      const physical = physicalStocks[item.supply_id] !== undefined && physicalStocks[item.supply_id] !== "" 
                       ? parseFloat(physicalStocks[item.supply_id]) 
                       : item.theoretical_stock;
      const difference = physical - item.theoretical_stock;
      totalDiferenciaValue += difference;
      return difference;
    });

    const printHtml = `
      <html>
        <head>
          <title>Corte de Insumos</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 11px; 
              margin: 0; 
              padding: 10px; 
              color: #000; 
              width: 58mm; 
              box-sizing: border-box;
            }
            .header { text-align: center; margin-bottom: 5px; font-weight: bold; }
            .title { font-weight: bold; font-size: 13px; text-transform: uppercase; }
            .subtitle { font-size: 9px; margin-top: 2px; }
            .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
            .section-title { font-weight: bold; font-size: 10px; margin: 4px 0 2px; text-transform: uppercase; }
            .row { display: flex; align-items: baseline; margin: 2px 0; }
            .dots { flex-grow: 1; border-bottom: 1px dotted #000; margin: 0 4px; }
            strong { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${businessName}</div>
            <div class="subtitle">CORTE DE INSUMOS (DIARIO)</div>
          </div>

          <div class="divider"></div>
          <div>Periodo:</div>
          <div>${startDate} &rarr; ${endDate}</div>
          <div style="margin-top: 4px;">Sucursal:</div>
          <div>${branch}</div>
          <div class="divider"></div>

          ${initialSection}
          ${entriesSection}
          ${usageSection}
          ${theoreticalSection}
          ${physicalSection}
          ${differenceSection}

          <div class="section-title">RESUMEN</div>
          <div class="row"><span>Inicial Total</span><div class="dots"></div><strong>${totalInicialValue.toFixed(2)}</strong></div>
          <div class="row"><span>Entradas</span><div class="dots"></div><strong>${totalEntradasValue.toFixed(2)}</strong></div>
          <div class="row"><span>Consumo</span><div class="dots"></div><strong>${totalConsumoValue.toFixed(2)}</strong></div>
          <div class="row"><span>Teórico</span><div class="dots"></div><strong>${totalTeoricoValue.toFixed(2)}</strong></div>
          <div class="row"><span>Diferencia</span><div class="dots"></div><strong>${totalDiferenciaValue >= 0 ? '+' : ''}${totalDiferenciaValue.toFixed(2)}</strong></div>
          <div class="divider"></div>

          ${observations ? `<div>OBSERVACIONES:</div><div>${observations}</div><div class="divider"></div>` : ''}

          <div>Usuario: ${user?.email?.split('@')[0] || 'Admin'}</div>
          <div>Fecha: ${formattedDate} ${formattedTime}</div>

          <div style="text-align: center; margin-top: 10px; font-weight: bold;">* CORTE FINALIZADO *</div>

          <script>
            window.onload = function() { 
              setTimeout(() => { window.print(); }, 300); 
            }
            window.onafterprint = function() { window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  // Cálculos resumen
  const totalInicial = periodData.reduce((acc, a) => acc + (a.initial_stock || 0), 0);
  const totalEntradas = periodData.reduce((acc, a) => acc + (a.period_entries || 0), 0);
  const totalConsumo = periodData.reduce((acc, a) => acc + (a.period_usage || 0), 0);
  const totalTeorico = periodData.reduce((acc, a) => acc + (a.theoretical_stock || 0), 0);

  // Diferencias
  let rowsWithDiff = 0;
  let totalImpact = 0;
  
  periodData.forEach(item => {
    const phys = parseFloat(physicalStocks[item.supply_id] || 0);
    const theor = parseFloat(item.theoretical_stock || 0);
    const diff = phys - theor;
    if (Math.abs(diff) > 0.001) { // diff != 0
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
            CORTE DE INSUMOS
          </h2>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Ajuste de Auditoría y Balance del Periodo
          </p>
          
          <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
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
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Sucursal</label>
              <select value={branch} onChange={e => setBranch(e.target.value)} className="w-full bg-white dark:bg-slate-900 border-none rounded-lg p-2 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500">
                <option>{branch}</option>
              </select>
            </div>
            <div>
              <button onClick={calculatePeriod} className="w-full bg-indigo-600 text-white font-bold p-2 text-xs rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                {loading ? 'Calculando...' : 'CALCULAR CORTE'}
              </button>
            </div>
          </div>
          <p className="text-[9px] text-slate-400 mt-2 font-medium">Nota: El "Stock inicial" corresponde a la existencia al término del día anterior a la Fecha inicio.</p>
        </div>
      </div>

      {/* TARJETAS RESUMEN */}
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Resumen del Periodo</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-2xl border border-sky-100 dark:border-sky-800/50">
          <p className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 mb-1">Stock Inicial Total</p>
          <p className="text-2xl font-black text-sky-900 dark:text-sky-100">{totalInicial.toFixed(2)} <span className="text-xs font-bold text-sky-500">Lts</span></p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
          <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Entradas</p>
          <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100">+{totalEntradas.toFixed(2)} <span className="text-xs font-bold text-emerald-500">Lts</span></p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-900/20 p-4 rounded-2xl border border-rose-100 dark:border-rose-800/50">
          <p className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 mb-1">Consumo Total</p>
          <p className="text-2xl font-black text-rose-900 dark:text-rose-100">-{totalConsumo.toFixed(2)} <span className="text-xs font-bold text-rose-500">Lts</span></p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 ring-1 ring-indigo-500/20">
          <p className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mb-1">Stock Teórico</p>
          <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100">{totalTeorico.toFixed(2)} <span className="text-xs font-bold text-indigo-500">Lts</span></p>
        </div>
      </div>

      {/* RESPONSABLE */}
      <div className="mb-6 bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 w-full md:w-1/3">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Responsable del Corte
        </label>
        <input
          type="text"
          value={responsible}
          onChange={e => setResponsible(e.target.value)}
          placeholder="Ej. Juan Pérez"
          className="w-full bg-white dark:bg-slate-900 border-none rounded-lg p-3 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* TABLA DETALLE */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Detalle por Insumo</h3>
        <span className={`text-[10px] font-black px-3 py-1 rounded-full ${rowsWithDiff > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
          {rowsWithDiff} insumos con diferencia
        </span>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="px-4 py-3">Insumo</th>
                <th className="px-4 py-3 text-right">Inicial</th>
                <th className="px-4 py-3 text-right">Entradas</th>
                <th className="px-4 py-3 text-right">Consumo</th>
                <th className="px-4 py-3 text-right">Teórico</th>
                <th className="px-4 py-3 text-center bg-indigo-50 dark:bg-indigo-900/10">Físico Real</th>
                <th className="px-4 py-3 text-center">Diferencia</th>
                <th className="px-4 py-3">Ajuste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {periodData.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-slate-400 font-bold">
                    No hay información en el periodo seleccionado o debes dar clic en Calcular.
                  </td>
                </tr>
              )}
              {periodData.map((item) => {
                const theoric = parseFloat(item.theoretical_stock || 0);
                const phys = physicalStocks[item.supply_id] !== undefined ? physicalStocks[item.supply_id] : theoric;
                const diff = phys - theoric;
                
                const diffColor = diff < 0 
                  ? "text-rose-600 bg-rose-50" 
                  : diff > 0 
                    ? "text-emerald-600 bg-emerald-50" 
                    : "text-slate-400 bg-slate-50 dark:bg-slate-800";

                return (
                  <tr key={item.supply_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                      {item.name}
                      <span className="block text-[9px] text-slate-400 font-normal uppercase">{item.unit_measure}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-slate-500">{parseFloat(item.initial_stock || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-emerald-600">+{parseFloat(item.period_entries || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-sm font-mono text-rose-500">-{parseFloat(item.period_usage || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-black font-mono text-indigo-600">{theoric.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center bg-indigo-50 dark:bg-indigo-900/10 input-cell">
                      <input
                        type="number"
                        step="0.01"
                        value={phys}
                        onChange={(e) => handlePhysicalChange(item.supply_id, e.target.value)}
                        className="w-24 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded p-1 text-center font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-mono text-xs font-black px-2 py-1 rounded inline-block min-w-[60px] ${diffColor}`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {Math.abs(diff) > 0.001 ? (
                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                          Esperando ajuste
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400">Sin cambio</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER ACCIONES */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="w-full lg:w-1/2">
          <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Observaciones (Opcional)</label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows="2"
            placeholder="Anotaciones sobre diferencias (ej. derrame de cloro, etc.)"
            className="w-full bg-white dark:bg-slate-900 border-none rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 resize-none"
          ></textarea>
        </div>

        <div className="flex-1 w-full lg:w-auto flex flex-col items-center lg:items-end">
          <div className="text-center lg:text-right mb-4">
            <p className="text-[11px] font-black uppercase text-indigo-500 tracking-widest mb-1">LISTO PARA AJUSTAR</p>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              Se aplicarán <span className="bg-amber-100 text-amber-700 px-1 rounded mx-1">{rowsWithDiff}</span> ajustes • Impacto total: <span className={`font-black ${totalImpact < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{totalImpact.toFixed(2)}</span> L
            </p>
          </div>
          
          <div className="flex gap-3 w-full lg:w-auto">
            <button 
              type="button" 
              onClick={onCancel}
              className="px-6 py-3 font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="button"
              onClick={handlePrint}
              className="px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-icons-outlined text-[18px]">print</span>
              Imprimir
            </button>
            <button 
              onClick={handleConfirm}
              className="px-8 py-3 bg-indigo-600 text-white font-black rounded-xl shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
            >
              {loading ? 'Procesando...' : 'CONFIRMAR AJUSTES'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
