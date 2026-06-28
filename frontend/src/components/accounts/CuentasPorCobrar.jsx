import React, { useState, useEffect, useMemo, useCallback } from "react";
import { orderService } from "../../services/orderService";
import { formatearDinero } from "../../utils";
import Swal from "sweetalert2";

const SaldoBadge = ({ days }) => {
  const color =
    days > 30
      ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
      : days > 15
        ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
        : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${color}`}>
      {days > 30 ? "+30 días" : days > 15 ? "+15 días" : "Reciente"}
    </span>
  );
};

export const CuentasPorCobrar = () => {
  const [customers, setCustomers] = useState([]);
  const [allOrders, setAllOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minDebt, setMinDebt] = useState(0);
  const [expandedCustomer, setExpandedCustomer] = useState(null);

  // Estados para el modal de liquidación
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderToLiquidate, setOrderToLiquidate] = useState(null);
  const [metodoPago, setMetodoPago] = useState("cash");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, orders] = await Promise.all([
        orderService.getPendingAccountsSummary(),
        orderService.getPendingOrders(),
      ]);
      setCustomers(summary || []);
      setAllOrders(orders || []);
    } catch (err) {
      console.error("Error al cargar cuentas por cobrar:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Totales del dashboard
  const totals = useMemo(() => {
    const totalDebt = customers.reduce((s, c) => s + c.total_debt, 0);
    return {
      totalDebt,
      customerCount: customers.filter(c => c.total_debt > 0).length,
      orderCount: allOrders.length,
      avgPerCustomer: customers.filter(c => c.total_debt > 0).length
        ? totalDebt / customers.filter(c => c.total_debt > 0).length
        : 0,
    };
  }, [customers, allOrders]);

  // Filtros
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (search) {
      const term = search.toLowerCase();
      list = list.filter(c =>
        c.customer_name.toLowerCase().includes(term) ||
        (c.customer_phone && c.customer_phone.includes(term))
      );
    }
    if (minDebt > 0) {
      list = list.filter(c => c.total_debt >= minDebt);
    }
    return list;
  }, [customers, search, minDebt]);

  const getDaysSince = (dateStr) => {
    const diff = new Date() - new Date(dateStr);
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Liquidar orden
  const handleLiquidate = (order) => {
    setOrderToLiquidate(order);
    setMetodoPago("cash");
    setMontoRecibido("");
    setIsPaymentModalOpen(true);
  };

  const finalizeLiquidation = async () => {
    if (!orderToLiquidate) return;
    setIsProcessing(true);
    try {
      await orderService.updateOrderPayment(orderToLiquidate.id, {
        paid_amount: orderToLiquidate.total,
        payment_status: "paid",
        payment_method: metodoPago,
      });
      await loadData();
      Swal.fire({
        title: "Pago Liquidado!",
        text: `La orden #${String(orderToLiquidate.folio || orderToLiquidate.id).padStart(6, "0")} ha sido pagada totalmente.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      setIsPaymentModalOpen(false);
      setOrderToLiquidate(null);
    } catch (error) {
      console.error("Error liquidando pago:", error);
      Swal.fire("Error", "No se pudo registrar el pago", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Exportar a Excel
  const exportToExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = [];
      filteredCustomers.forEach(c => {
        c.orders.forEach(o => {
          rows.push({
            Cliente: c.customer_name,
            Teléfono: c.customer_phone,
            Folio: o.folio || o.id,
            Fecha: new Date(o.created_at).toLocaleDateString("es-ES"),
            Total: o.total,
            Pagado: o.paid_amount || 0,
            Saldo: o.balance,
            Estado: o.status === "delivered" ? "Entregado" : "Pendiente",
          });
        });
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cuentas por Cobrar");
      XLSX.writeFile(wb, `cuentas_por_cobrar_${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch (err) {
      console.error("Error exportando a Excel:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh]">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
            Cuentas por Cobrar
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {totals.customerCount} clientes con adeudo &middot; {totals.orderCount} órdenes pendientes
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total por cobrar</p>
          <p className="text-3xl font-black text-rose-500">{formatearDinero(totals.totalDebt)}</p>
        </div>
      </div>

      {/* Dashboard: Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">payments</span>
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Pendiente</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white">{formatearDinero(totals.totalDebt)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">group</span>
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clientes</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white">{totals.customerCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">receipt_long</span>
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Órdenes</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white">{totals.orderCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">analytics</span>
            </div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Promedio</span>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white">{formatearDinero(totals.avgPerCustomer)}</p>
        </div>
      </div>

      {/* Top 5 clientes (dashboard visual) */}
      {filteredCustomers.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
            Top Clientes con Mayor Adeudo
          </h3>
          <div className="space-y-3">
            {filteredCustomers.slice(0, 5).map((c, i) => {
              const maxVal = filteredCustomers[0]?.total_debt || 1;
              const pct = (c.total_debt / maxVal) * 100;
              return (
                <div key={c.customer_id} className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-400 w-5 text-right">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{c.customer_name}</span>
                      <span className="font-bold text-rose-500">{formatearDinero(c.total_debt)}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-400 to-rose-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por cliente o teléfono..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 dark:text-slate-300"
          value={minDebt}
          onChange={(e) => setMinDebt(Number(e.target.value))}
        >
          <option value={0}>Todos los montos</option>
          <option value={50}>$50 o más</option>
          <option value={100}>$100 o más</option>
          <option value={500}>$500 o más</option>
          <option value={1000}>$1,000 o más</option>
        </select>
        <button
          onClick={exportToExcel}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">download</span>
          Exportar Excel
        </button>
      </div>

      {/* Tabla de clientes expandible */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700 mb-3">credit_score</span>
            <p className="text-slate-500 font-bold">No hay cuentas por cobrar</p>
            <p className="text-slate-400 text-sm mt-1">Todos los clientes han pagado sus órdenes.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCustomers.map((c) => {
              const isExpanded = expandedCustomer === c.customer_id;
              const daysSince = c.last_order_date ? getDaysSince(c.last_order_date) : 0;
              return (
                <div key={c.customer_id}>
                  {/* Fila resumen del cliente */}
                  <button
                    onClick={() => setExpandedCustomer(isExpanded ? null : c.customer_id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`material-symbols-outlined text-slate-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                        chevron_right
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white truncate">{c.customer_name}</p>
                        <p className="text-xs text-slate-400">{c.customer_phone || "Sin teléfono"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">{c.order_count} órdenes</p>
                        <p className="font-bold text-rose-500">{formatearDinero(c.total_debt)}</p>
                      </div>
                      {c.last_order_date && <SaldoBadge days={daysSince} />}
                    </div>
                  </button>

                  {/* Órdenes detalle (expandido) */}
                  {isExpanded && (
                    <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                      {c.orders.map((o) => {
                        const oDays = getDaysSince(o.created_at);
                        return (
                          <div
                            key={o.id}
                            className="flex items-center justify-between p-3 pl-14 pr-4 hover:bg-white dark:hover:bg-slate-900/50 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                  #{String(o.folio || o.id).padStart(6, "0")}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {new Date(o.created_at).toLocaleDateString("es-ES")}
                                </p>
                              </div>
                              <SaldoBadge days={oDays} />
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right text-xs">
                                <p className="text-slate-500">Total: <span className="font-bold text-slate-700 dark:text-slate-300">{formatearDinero(o.total)}</span></p>
                                <p className="text-slate-500">Pagado: <span className="font-bold text-emerald-600">{formatearDinero(o.paid_amount || 0)}</span></p>
                                <p className="text-slate-500">Saldo: <span className="font-bold text-rose-500">{formatearDinero(o.balance)}</span></p>
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleLiquidate(o); }}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">payments</span>
                                Cobrar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE LIQUIDACIÓN (simplificado) */}
      {isPaymentModalOpen && orderToLiquidate && (
        <div className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white uppercase tracking-tighter">
                Liquidar Saldo
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Orden #{String(orderToLiquidate.folio || orderToLiquidate.id).padStart(6, "0")}</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">Saldo a Cobrar</p>
                <h4 className="text-4xl font-black text-slate-900 dark:text-white mt-2">
                  {formatearDinero(orderToLiquidate.balance)}
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {["cash", "card", "transferencia"].map((m) => {
                  const icons = { cash: "payments", card: "credit_card", transferencia: "account_balance" };
                  const labels = { cash: "Efectivo", card: "Tarjeta", transferencia: "Transf." };
                  return (
                    <button
                      key={m}
                      onClick={() => setMetodoPago(m)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                        metodoPago === m
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600"
                          : "border-slate-100 dark:border-slate-800 text-slate-400"
                      }`}
                    >
                      <span className="material-symbols-outlined text-3xl">{icons[m]}</span>
                      <span className="text-[10px] font-bold uppercase">{labels[m]}</span>
                    </button>
                  );
                })}
              </div>

              {metodoPago === "cash" && (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2 block">
                    Dinero Recibido (MXN)
                  </label>
                  <input
                    type="number"
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-xl font-bold text-slate-900 dark:text-white"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                  {parseFloat(montoRecibido) >= orderToLiquidate.balance && (
                    <p className="text-right text-xs font-bold text-emerald-600 mt-2">
                      Cambio: {formatearDinero(parseFloat(montoRecibido) - orderToLiquidate.balance)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-3 text-slate-500 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={finalizeLiquidation}
                disabled={isProcessing}
                className="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isProcessing && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                LIQUIDAR PAGO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
