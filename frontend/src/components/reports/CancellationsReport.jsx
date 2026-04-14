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
          customers (name, phone),
          staff:created_by_staff_id (id, name, role),
          cancelled_by_staff:cancelled_by_staff_id (id, name, role)
        `,
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
        "Cajero que Canceló": order.cancelled_by_staff?.name || "N/A",
        Notas: order.notes || "",
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
    <div className="p-6 bg-gray-50 dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6 p-5 bg-gradient-to-r from-slate-500 to-slate-600 dark:from-slate-700 dark:to-slate-800 rounded-2xl shadow-lg">
        <h2 className="text-2xl font-semibold text-white m-0">
          📋 Reporte de Cancelaciones
        </h2>
        <button
          className="px-5 py-2.5 bg-blue-500 text-white border-none rounded-lg text-sm font-medium cursor-pointer transition-all hover:bg-blue-600 hover:-translate-y-0.5 hover:shadow-lg"
          onClick={exportToExcel}
        >
          📊 Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm flex-wrap border border-gray-200 dark:border-slate-700">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Fecha Inicio:
          </label>
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Fecha Fin:
          </label>
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Buscar:
          </label>
          <input
            type="text"
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            placeholder="Folio, cliente, notas..."
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
          />
        </div>
      </div>

      {/* Resumen */}
      {loading ? (
        <div className="text-center py-10 text-base text-slate-500 dark:text-slate-400">
          Cargando...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-3xl flex-shrink-0">❌</div>
              <div className="flex-1">
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                  Total Cancelaciones
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {summary.count}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-3xl flex-shrink-0">💰</div>
              <div className="flex-1">
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                  Monto Total Cancelado
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {formatearDinero(summary.total)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-3xl flex-shrink-0">💵</div>
              <div className="flex-1">
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                  Efectivo
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {formatearDinero(summary.cash)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-3xl flex-shrink-0">💳</div>
              <div className="flex-1">
                <div className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
                  Tarjeta
                </div>
                <div className="text-2xl font-bold text-slate-800 dark:text-white">
                  {formatearDinero(summary.card)}
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de cancelaciones */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700">
                      Folio
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700">
                      Total
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700">
                      Método de Pago
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700">
                      Cancelado por
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300 border-b-2 border-gray-200 dark:border-slate-700">
                      Notas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCancellations.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-10 px-5 text-slate-500 dark:text-slate-400 italic"
                      >
                        No se encontraron cancelaciones en el período
                        seleccionado
                      </td>
                    </tr>
                  ) : (
                    filteredCancellations.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700">
                          {formatearFechaHora(new Date(order.created_at))}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700">
                          {order.folio || order.id?.slice(-6)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700">
                          {order.customers?.name || "Cliente General"}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-red-500 dark:text-red-400 border-b border-gray-100 dark:border-slate-700">
                          {formatearDinero(order.total)}
                        </td>
                        <td className="px-4 py-3 text-sm border-b border-gray-100 dark:border-slate-700">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                              order.payment_method === "cash" ||
                              order.payment_method === "efectivo"
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : order.payment_method === "card" ||
                                    order.payment_method === "tarjeta"
                                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                                  : order.payment_method === "transfer" ||
                                      order.payment_method === "transferencia"
                                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                    : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
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
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700">
                          {order.cancelled_by_staff?.name || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200 border-b border-gray-100 dark:border-slate-700 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                          {order.notes || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CancellationsReport;
