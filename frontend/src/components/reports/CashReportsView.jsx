import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cashCutService } from "../../services/cashCutService";
import { cashWithdrawalService } from "../../services/cashWithdrawalService";
import { supabase } from "../../supabase";
import Modal from "../common/Modal";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
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

const formatShortDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

const COLORS = [
  "#0f172a",
  "#2563eb",
  "#059669",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
];

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
  const [activeTab, setActiveTab] = useState("orders");

  // New state for enhanced reporting
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonFilters, setComparisonFilters] = useState({
    startDate2: "",
    endDate2: "",
  });
  const [cutsPeriod2, setCutsPeriod2] = useState([]);
  const [showCharts, setShowCharts] = useState(true);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchCuts = useCallback(async () => {
    setLoading(true);
    try {
      // Cargar cortes históricos
      const historyCuts = await cashCutService.getCashCuts({
        cutType: filters.cutType !== "all" ? filters.cutType : undefined,
        staffName: filters.staffName || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });

      // Cargar sesiones abiertas para mostrar "Abierta" en tiempo real CON ventas reales
      let openSessions = [];
      if (filters.cutType === "all" || filters.cutType === "turno") {
        let query = supabase
          .from("cash_sessions")
          .select("*, terminals(name)")
          .eq("status", "open");

        if (filters.startDate) {
          query = query.gte(
            "opened_at",
            new Date(filters.startDate).toISOString(),
          );
        }
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          query = query.lte("opened_at", endDate.toISOString());
        }

        const { data: sessions } = await query.order("opened_at", {
          ascending: false,
        });

        // Para cada sesión abierta, calcular ventas reales en tiempo real
        const sessionPromises = (sessions || []).map(async (session) => {
          // Consultar órdenes pagadas vinculadas a esta sesión de caja
          const { data: sessionOrders } = await supabase
            .from("orders")
            .select("total, payment_method, payment_status")
            .eq("cash_session_id", session.id)
            .in("payment_status", ["paid", "partial"]);

          // Consultar ventas directas (mostrador) desde la apertura de sesión
          const { data: sessionSales } = await supabase
            .from("sales")
            .select("total, payment_method")
            .gte("created_at", session.opened_at)
            .eq("terminal_id", session.terminal_id);

          const allTransactions = [
            ...(sessionOrders || []).map((o) => ({
              total: parseFloat(o.total) || 0,
              method:
                o.payment_method === "cash"
                  ? "efectivo"
                  : o.payment_method === "card"
                    ? "tarjeta"
                    : o.payment_method === "transfer"
                      ? "transferencia"
                      : o.payment_method?.toLowerCase() || "efectivo",
            })),
            ...(sessionSales || []).map((s) => ({
              total: parseFloat(s.total) || 0,
              method:
                s.payment_method === "cash"
                  ? "efectivo"
                  : s.payment_method === "card"
                    ? "tarjeta"
                    : s.payment_method === "transfer"
                      ? "transferencia"
                      : s.payment_method?.toLowerCase() || "efectivo",
            })),
          ];

          const salesCount = allTransactions.length;
          const salesTotal = allTransactions.reduce(
            (sum, t) => sum + t.total,
            0,
          );
          const cashTotal = allTransactions
            .filter((t) => t.method === "efectivo")
            .reduce((sum, t) => sum + t.total, 0);
          const cardTotal = allTransactions
            .filter((t) => t.method === "tarjeta")
            .reduce((sum, t) => sum + t.total, 0);
          const transferTotal = allTransactions
            .filter((t) => t.method === "transferencia")
            .reduce((sum, t) => sum + t.total, 0);
          const openingFund = parseFloat(session.opening_fund) || 0;

          return {
            id: `active-${session.id}`,
            session_id: session.id,
            staff_name: session.staff_name,
            cut_type: "turno",
            status: "Abierta",
            is_active_session: true,
            created_at: new Date().toISOString(),
            start_time: session.opened_at,
            end_time: null,
            sales_count: salesCount,
            sales_total: salesTotal,
            opening_fund: openingFund,
            expected_cash: openingFund + cashTotal,
            actual_cash: 0,
            difference: 0,
            card_total: cardTotal,
            transfer_total: transferTotal,
            terminal_name: session.terminals?.name,
            terminal_id: session.terminal_id,
          };
        });

        openSessions = await Promise.all(sessionPromises);
      }

      // Combinar y ordenar por fecha
      const combinedResults = [...openSessions, ...historyCuts].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );

      setCuts(combinedResults);
    } catch (err) {
      console.error("[CashReportsView] Error cargando cortes:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Suscripción en tiempo real
  useEffect(() => {
    const cutsChannel = supabase
      .channel("cash_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_cuts",
        },
        () => {
          fetchCuts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cash_sessions",
        },
        () => {
          fetchCuts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        () => {
          fetchCuts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sales",
        },
        () => {
          fetchCuts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cutsChannel);
    };
  }, [fetchCuts]);

  useEffect(() => {
    fetchCuts();
  }, [fetchCuts]);

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
      const data = await cashCutService.getCutDetails(
        cut.start_time,
        cut.created_at,
        cut.terminal_id,
      );
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
      dolares: 0,
    };
    details.transactions.forEach((tx) => {
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

  // ===== NEW: Chart data - Sales evolution by day =====
  const salesEvolutionData = useMemo(() => {
    const grouped = {};
    cuts
      .filter((c) => c.cut_type !== "parcial")
      .forEach((cut) => {
        const dateKey = formatShortDate(cut.created_at);
        if (!grouped[dateKey]) {
          grouped[dateKey] = {
            date: dateKey,
            ventas: 0,
            diferencia: 0,
            cortes: 0,
            tarjeta: 0,
            transferencia: 0,
          };
        }
        grouped[dateKey].ventas += parseFloat(cut.sales_total) || 0;
        grouped[dateKey].diferencia += parseFloat(cut.difference) || 0;
        grouped[dateKey].cortes += 1;
        grouped[dateKey].tarjeta += parseFloat(cut.card_total) || 0;
        grouped[dateKey].transferencia += parseFloat(cut.transfer_total) || 0;
      });
    return Object.values(grouped).sort(
      (a, b) => new Date(a.date) - new Date(b.date),
    );
  }, [cuts]);

  // ===== NEW: Payment method distribution =====
  const paymentMethodData = useMemo(() => {
    const summary = { efectivo: 0, tarjeta: 0, transferencia: 0 };
    cuts.forEach((cut) => {
      const cash = parseFloat(cut.sales_total) || 0;
      const card = parseFloat(cut.card_total) || 0;
      const transfer = parseFloat(cut.transfer_total) || 0;
      summary.efectivo += cash - card - transfer;
      summary.tarjeta += card;
      summary.transferencia += transfer;
    });
    return [
      { name: "Efectivo", value: Math.max(0, summary.efectivo) },
      { name: "Tarjeta", value: summary.tarjeta },
      { name: "Transferencia", value: summary.transferencia },
    ].filter((item) => item.value > 0);
  }, [cuts]);

  // ===== NEW: Staff performance ranking =====
  const staffRanking = useMemo(() => {
    const groups = {};
    cuts.forEach((cut) => {
      const name = cut.staff_name || "Sin asignar";
      if (!groups[name]) {
        groups[name] = {
          name,
          cortes: 0,
          ventas: 0,
          diferencia: 0,
          totalVentas: 0,
        };
      }
      groups[name].cortes += 1;
      groups[name].ventas += parseInt(cut.sales_count) || 0;
      groups[name].diferencia += parseFloat(cut.difference) || 0;
      groups[name].totalVentas += parseFloat(cut.sales_total) || 0;
    });
    return Object.values(groups)
      .sort((a, b) => b.totalVentas - a.totalVentas)
      .slice(0, 10);
  }, [cuts]);

  // ===== NEW: Comparison period data =====
  const totalSales2 = cutsPeriod2.reduce(
    (acc, c) => acc + (parseFloat(c.sales_total) || 0),
    0,
  );
  const totalDiff2 = cutsPeriod2.reduce(
    (acc, c) => acc + (parseFloat(c.difference) || 0),
    0,
  );
  const totalSalesCount2 = cutsPeriod2.reduce(
    (acc, c) => acc + (parseInt(c.sales_count) || 0),
    0,
  );

  // ===== NEW: Enhanced summary cards with payment breakdown =====
  const paymentBreakdown = useMemo(() => {
    const breakdown = { efectivo: 0, tarjeta: 0, transferencia: 0, dolares: 0 };
    cuts.forEach((cut) => {
      const sales = parseFloat(cut.sales_total) || 0;
      const card = parseFloat(cut.card_total) || 0;
      const transfer = parseFloat(cut.transfer_total) || 0;
      const usd = parseFloat(cut.actual_usd) || 0;
      
      breakdown.efectivo += sales - card - transfer;
      breakdown.tarjeta += card;
      breakdown.transferencia += transfer;
      breakdown.dolares += usd;
    });
    return breakdown;
  }, [cuts]);

  // ===== NEW: Export to Excel =====
  const handleExportExcel = async () => {
    setExportLoading(true);
    try {
      // Sheet 1: Summary
      const summaryData = [
        ["Reporte de Caja - Exportado", new Date().toLocaleString("es-MX")],
        [],
        ["RESUMEN GENERAL"],
        ["Total de Cortes", cuts.length],
        ["Total de Ventas", totalSalesCount],
        ["Monto Total", totalSales],
        ["Diferencia Acumulada", totalDiff],
        [],
        ["DESGLOSE POR MÉTODO DE PAGO"],
        ["Efectivo", paymentBreakdown.efectivo],
        ["Tarjeta", paymentBreakdown.tarjeta],
        ["Transferencia", paymentBreakdown.transferencia],
        [],
        ["DETALLE DE CORTES"],
        [
          "Fecha",
          "Hora",
          "Tipo",
          "Empleado",
          "Ventas",
          "Total",
          "Esperado",
          "Entregado",
          "Diferencia",
          "Tarjeta",
          "Transferencia",
        ],
        ...cuts.map((cut) => [
          formatDate(cut.created_at),
          formatTime(cut.created_at),
          TYPE_LABELS[cut.cut_type] || cut.cut_type,
          cut.staff_name || "—",
          cut.sales_count || 0,
          parseFloat(cut.sales_total) || 0,
          parseFloat(cut.expected_cash) || 0,
          parseFloat(cut.actual_cash) || 0,
          parseFloat(cut.difference) || 0,
          parseFloat(cut.card_total) || 0,
          parseFloat(cut.transfer_total) || 0,
        ]),
      ];

      if (comparisonMode && cutsPeriod2.length > 0) {
        summaryData.push([]);
        summaryData.push(["COMPARATIVA PERÍODO 2"]);
        summaryData.push(["Total de Cortes", cutsPeriod2.length]);
        summaryData.push(["Total de Ventas", totalSalesCount2]);
        summaryData.push(["Monto Total", totalSales2]);
        summaryData.push(["Diferencia Acumulada", totalDiff2]);
      }

      // Sheet 2: Staff Ranking
      const staffData = [
        ["Ranking de Personal - Reporte de Caja"],
        [],
        ["Empleado", "Cortes", "Ventas", "Monto Total", "Diferencia"],
        ...staffRanking.map((s, idx) => [
          idx + 1,
          s.name,
          s.cortes,
          s.ventas,
          s.totalVentas,
          s.diferencia,
        ]),
      ];

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      const ws2 = XLSX.utils.aoa_to_sheet(staffData);

      // Column widths
      ws1["!cols"] = [
        { wch: 15 },
        { wch: 10 },
        { wch: 12 },
        { wch: 20 },
        { wch: 10 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      ws2["!cols"] = [
        { wch: 8 },
        { wch: 30 },
        { wch: 10 },
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
      ];

      XLSX.utils.book_append_sheet(wb, ws1, "Reporte General");
      XLSX.utils.book_append_sheet(wb, ws2, "Ranking Personal");

      const fileName = `Reporte_Caja_${filters.startDate || "inicio"}_a_${filters.endDate || "hoy"}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (err) {
      console.error("[CashReportsView] Error exportando a Excel:", err);
      alert("Error al exportar. Revisa la consola para más detalles.");
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportFullReport = () => {
    const doc = new jsPDF();
    const primaryColor = [15, 23, 42]; // slate-900
    const accentColor = [37, 99, 235]; // blue-600

    // Header
    doc.setFontSize(22);
    doc.setTextColor(...primaryColor);
    doc.text("REPORTE EJECUTIVO DE CAJA", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 27);
    doc.text(`Período: ${filters.startDate || "Inicio"} al ${filters.endDate || "Hoy"}`, 14, 32);

    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(...accentColor);
    doc.text("Resumen de Operaciones", 14, 45);

    const summaryData = [
      ["Total Ventas", formatCurrency(totalSales)],
      ["Nº Transacciones", totalSalesCount.toString()],
      ["Diferencia Total", formatCurrency(totalDiff)],
      ["Efectivo", formatCurrency(paymentBreakdown.efectivo)],
      ["Tarjeta", formatCurrency(paymentBreakdown.tarjeta)],
      ["Transferencia", formatCurrency(paymentBreakdown.transferencia)],
      ["Dólares", formatCurrency(paymentBreakdown.dolares)],
    ];

    doc.autoTable({
      startY: 50,
      head: [["Métrica", "Valor"]],
      body: summaryData,
      theme: "striped",
      headStyles: { fillStyle: primaryColor },
      styles: { cellPadding: 3, fontSize: 10 }
    });

    // Staff Ranking
    doc.setFontSize(14);
    doc.setTextColor(...accentColor);
    doc.text("Desempeño del Personal", 14, doc.lastAutoTable.finalY + 15);

    const rankingData = staffRanking.map(staff => [
      staff.name,
      staff.cortes,
      staff.ventas,
      formatCurrency(staff.totalVentas),
      formatCurrency(staff.diferencia)
    ]);

    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 20,
      head: [["Empleado", "Cortes", "Ventas", "Monto Total", "Dif. Acum."]],
      body: rankingData,
      theme: "grid",
      headStyles: { fillStyle: [5, 150, 105] }, // emerald-600
    });

    // Detail List
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(...accentColor);
    doc.text("Detalle Cronológico de Cortes", 14, 20);

    const cutsData = cuts.slice(0, 50).map(cut => [
      formatDate(cut.created_at),
      cut.staff_name,
      TYPE_LABELS[cut.cut_type] || cut.cut_type,
      formatCurrency(cut.sales_total),
      formatCurrency(cut.difference)
    ]);

    doc.autoTable({
      startY: 25,
      head: [["Fecha", "Encargado", "Tipo", "Ventas", "Diferencia"]],
      body: cutsData,
      headStyles: { fillStyle: [124, 58, 237] }, // violet-600
    });

    doc.save(`Reporte_Caja_${filters.startDate || "hist"}.pdf`);
  };

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
        <button
          type="button"
          className={`cash-reports__filter-btn cash-reports__filter-btn--${comparisonMode ? "active" : "secondary"}`}
          onClick={() => setComparisonMode(!comparisonMode)}
        >
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>
            compare_arrows
          </span>
          {comparisonMode ? "Quitar Comparativa" : "Comparar"}
        </button>
        <button
          type="button"
          className="cash-reports__filter-btn cash-reports__filter-btn--export"
          onClick={handleExportExcel}
          disabled={exportLoading}
        >
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>
            {exportLoading ? "sync" : "download"}
          </span>
          {exportLoading ? "Exportando..." : "Exportar Excel"}
        </button>
        <button
          type="button"
          className="cash-reports__filter-btn cash-reports__filter-btn--pdf"
          onClick={handleExportFullReport}
          disabled={exportLoading}
        >
          <span className="material-icons-outlined" style={{ fontSize: 18 }}>
            picture_as_pdf
          </span>
          PDF Ejecutivo
        </button>
      </form>

      {/* Comparison Period 2 Filters */}
      {comparisonMode && (
        <div className="cash-reports__filters cash-reports__filters--comparison">
          <div className="cash-reports__filter-group">
            <label>Período 2 - Desde</label>
            <input
              type="date"
              value={comparisonFilters.startDate2}
              onChange={(e) =>
                setComparisonFilters((prev) => ({
                  ...prev,
                  startDate2: e.target.value,
                }))
              }
            />
          </div>
          <div className="cash-reports__filter-group">
            <label>Período 2 - Hasta</label>
            <input
              type="date"
              value={comparisonFilters.endDate2}
              onChange={(e) =>
                setComparisonFilters((prev) => ({
                  ...prev,
                  endDate2: e.target.value,
                }))
              }
            />
          </div>
          <button
            type="button"
            className="cash-reports__filter-btn"
            onClick={async () => {
              try {
                const data = await cashCutService.getCashCuts({
                  startDate: comparisonFilters.startDate2 || undefined,
                  endDate: comparisonFilters.endDate2 || undefined,
                });
                setCutsPeriod2(data);
              } catch (err) {
                console.error("Error cargando período 2:", err);
              }
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>
              search
            </span>
            Cargar Período 2
          </button>
          {cutsPeriod2.length > 0 && (
            <span
              style={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#2563eb",
                alignSelf: "center",
              }}
            >
              {cutsPeriod2.length} cortes cargados
            </span>
          )}
        </div>
      )}

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
            <span className="cash-reports__card-label">
              Diferencia acumulada
            </span>
          </div>
        </div>
      </div>

      {/* NEW: Payment Breakdown Cards */}
      <div className="cash-reports__payment-breakdown">
        <div className="cash-reports__card cash-reports__card--payment">
          <div
            className="cash-reports__card-icon"
            style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
          >
            <span className="material-icons-outlined">attach_money</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">
              {formatCurrency(paymentBreakdown.efectivo)}
            </span>
            <span className="cash-reports__card-label">Efectivo</span>
          </div>
        </div>
        <div className="cash-reports__card cash-reports__card--payment">
          <div
            className="cash-reports__card-icon"
            style={{ background: "linear-gradient(135deg, #2563eb, #3b82f6)" }}
          >
            <span className="material-icons-outlined">credit_card</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">
              {formatCurrency(paymentBreakdown.tarjeta)}
            </span>
            <span className="cash-reports__card-label">Tarjeta</span>
          </div>
        </div>
        <div className="cash-reports__card cash-reports__card--payment">
          <div
            className="cash-reports__card-icon"
            style={{ background: "linear-gradient(135deg, #7c3aed, #8b5cf6)" }}
          >
            <span className="material-icons-outlined">account_balance</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">
              {formatCurrency(paymentBreakdown.transferencia)}
            </span>
            <span className="cash-reports__card-label">Transferencia</span>
          </div>
        </div>
        <div className="cash-reports__card cash-reports__card--payment">
          <div
            className="cash-reports__card-icon"
            style={{ background: "linear-gradient(135deg, #f59e0b, #fbbf24)" }}
          >
            <span className="material-icons-outlined">payments</span>
          </div>
          <div className="cash-reports__card-info">
            <span className="cash-reports__card-value">
              {formatCurrency(paymentBreakdown.dolares)}
            </span>
            <span className="cash-reports__card-label">Dólares</span>
          </div>
        </div>
      </div>

      {/* NEW: Comparison Side-by-Side Metrics */}
      {comparisonMode && cutsPeriod2.length > 0 && (
        <div className="cash-reports__comparison-grid">
          <div className="cash-reports__comparison-column">
            <div className="comparison-header">Período 1 (Actual)</div>
            <div className="comparison-row">
              <span className="label">Ventas</span>
              <span className="value">{formatCurrency(totalSales)}</span>
            </div>
            <div className="comparison-row">
              <span className="label">Transacciones</span>
              <span className="value">{totalSalesCount}</span>
            </div>
            <div className="comparison-row">
              <span className="label">Diferencia</span>
              <span
                className={`value ${totalDiff >= 0 ? "positive" : "negative"}`}
              >
                {formatCurrency(totalDiff)}
              </span>
            </div>
          </div>

          <div className="cash-reports__comparison-divider">
            <span className="material-icons-outlined">compare_arrows</span>
          </div>

          <div className="cash-reports__comparison-column">
            <div className="comparison-header">Período 2 (Comparativa)</div>
            <div className="comparison-row">
              <span className="label">Ventas</span>
              <span className="value">{formatCurrency(totalSales2)}</span>
            </div>
            <div className="comparison-row">
              <span className="label">Transacciones</span>
              <span className="value">{totalSalesCount2}</span>
            </div>
            <div className="comparison-row">
              <span className="label">Diferencia</span>
              <span
                className={`value ${totalDiff2 >= 0 ? "positive" : "negative"}`}
              >
                {formatCurrency(totalDiff2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Charts Button */}
      {salesEvolutionData.length > 0 && (
        <div className="cash-reports__charts-header">
          <button
            className="cash-reports__filter-btn cash-reports__filter-btn--secondary"
            onClick={() => setShowCharts(!showCharts)}
          >
            <span className="material-icons-outlined" style={{ fontSize: 18 }}>
              {showCharts ? "collapse_all" : "expand_all"}
            </span>
            {showCharts ? "Ocultar Gráficas" : "Mostrar Gráficas"}
          </button>
        </div>
      )}

      {/* NEW: Charts Section */}
      {showCharts && salesEvolutionData.length > 0 && (
        <div className="cash-reports__charts-grid">
          {/* Sales Evolution Line Chart */}
          <div className="cash-reports__chart-card">
            <h3 className="cash-reports__chart-title">
              <span className="material-icons-outlined">trending_up</span>
              Evolución de Ventas por Día
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={salesEvolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fontWeight: 600 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="ventas"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Ventas"
                />
                 <Line
                  type="monotone"
                  dataKey="diferencia"
                  stroke="#dc2626"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Diferencia"
                />
                <Line
                  type="monotone"
                  dataKey="tarjeta"
                  stroke="#7c3aed"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="V. Tarjeta"
                />
                <Line
                  type="monotone"
                  dataKey="transferencia"
                  stroke="#10b981"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  name="V. Transf."
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Payment Method Pie Chart */}
          <div className="cash-reports__chart-card">
            <h3 className="cash-reports__chart-title">
              <span className="material-icons-outlined">donut_large</span>
              Distribución por Método de Pago
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {paymentMethodData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Staff Ranking Bar Chart */}
          {staffRanking.length > 0 && (
            <div className="cash-reports__chart-card cash-reports__chart-card--wide">
              <h3 className="cash-reports__chart-title">
                <span className="material-icons-outlined">leaderboard</span>
                Top Empleados por Ventas
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={staffRanking}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fontWeight: 600 }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar
                    dataKey="totalVentas"
                    fill="#0f172a"
                    name="Total Ventas"
                  />
                  <Bar
                    dataKey="ventas"
                    fill="#059669"
                    name="Nº Transacciones"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* NEW: Detailed Staff Ranking */}
      {showCharts && staffRanking.length > 0 && (
        <div className="cash-reports__ranking-section">
          <h3 className="cash-reports__ranking-title">
            <span className="material-icons-outlined">military_tech</span>
            Rendimiento del Personal
          </h3>
          <table className="ranking-table">
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Nº Cortes</th>
                <th>Transacciones</th>
                <th>Volumen de Ventas</th>
                <th>Diferencia Acum.</th>
                <th>Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {staffRanking.map((staff, idx) => {
                const effectiveness = staff.totalVentas > 0 
                  ? ((staff.totalVentas / (staff.totalVentas + Math.abs(staff.diferencia))) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr key={idx}>
                    <td>{staff.name}</td>
                    <td>{staff.cuts}</td>
                    <td>{staff.ventas}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(staff.totalVentas)}</td>
                    <td className={staff.diferencia >= 0 ? "cash-reports__diff--positive" : "cash-reports__diff--negative"}>
                      {formatCurrency(staff.diferencia)}
                    </td>
                    <td>
                      <div className="status-indicator">
                        <span className={`status-dot status-dot--${parseFloat(effectiveness) > 98 ? "open" : "warning"}`}></span>
                        <span>{effectiveness}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
            <p>
              No se encontraron cortes de caja con los filtros seleccionados.
            </p>
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
                          className={`status-dot status-dot--${cut.cut_type === "parcial" || cut.status === "Abierta" ? "open" : "closed"}`}
                        ></span>
                        <span
                          className={`status-text--${cut.cut_type === "parcial" || cut.status === "Abierta" ? "open" : "closed"}`}
                        >
                          {cut.cut_type === "parcial" ||
                          cut.status === "Abierta"
                            ? "Abierta"
                            : "Cerrada"}
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
                        <span className="material-icons-outlined">
                          list_alt
                        </span>
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
                    {formatDate(selectedCut.created_at)}{" "}
                    {formatTime(selectedCut.created_at)} | ID: #
                    {selectedCut.id.toString().slice(-6)}
                  </div>
                </div>
                <div
                  className={`cash-reports__type-badge cash-reports__type-badge--${selectedCut.cut_type}`}
                >
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
                    <span className="value">
                      {formatCurrency(selectedCut.sales_total)}
                    </span>
                  </div>
                  <div className="summary-stat">
                    <label>Fondo Inicial de Caja</label>
                    <span className="value">
                      {formatCurrency(selectedCut.opening_fund || 0)}
                    </span>
                  </div>
                  <div className="summary-stat">
                    <label>Esperado en Caja</label>
                    <span className="value">
                      {formatCurrency(selectedCut.expected_cash)}
                    </span>
                  </div>
                  <div className="summary-stat">
                    <label>Entregado Real</label>
                    <span className="value">
                      {formatCurrency(selectedCut.actual_cash)}
                    </span>
                  </div>
                  <div className="summary-stat">
                    <label>Diferencia</label>
                    <span
                      className={`value ${parseFloat(selectedCut.difference) >= 0 ? "cash-reports__diff--positive" : "cash-reports__diff--negative"}`}
                    >
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
                    <div
                      className="cut-details__tabs"
                      style={{ marginBottom: "1.5rem" }}
                    >
                      <button
                        className={`cut-details__tab ${activeTab === "orders" ? "active" : ""}`}
                        onClick={() => setActiveTab("orders")}
                      >
                        <span className="material-icons-outlined">
                          receipt_long
                        </span>
                        Ventas por Orden
                      </button>
                      <button
                        className={`cut-details__tab ${activeTab === "clients" ? "active" : ""}`}
                        onClick={() => setActiveTab("clients")}
                      >
                        <span className="material-icons-outlined">people</span>
                        Ventas por Clientes
                      </button>
                    </div>

                    <div className="report-table-section">
                      {activeTab === "orders" ? (
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
                                  <span
                                    className={`method-badge method-badge--${tx.payment_method?.toLowerCase()}`}
                                  >
                                    {tx.payment_method}
                                  </span>
                                </td>
                                <td className="text-right font-bold">
                                  {formatCurrency(tx.total)}
                                </td>
                              </tr>
                            ))}
                            {details?.transactions.length === 0 && (
                              <tr>
                                <td colSpan="5" className="text-center py-4">
                                  Sin transacciones en este corte.
                                </td>
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
                                <td className="text-right font-bold">
                                  {formatCurrency(client.total)}
                                </td>
                              </tr>
                            ))}
                            {clientsData.length === 0 && (
                              <tr>
                                <td colSpan="3" className="text-center py-4">
                                  No se encontraron datos de clientes.
                                </td>
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
              <button
                className="cash-reports__filter-btn"
                onClick={() => setSelectedCut(null)}
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
