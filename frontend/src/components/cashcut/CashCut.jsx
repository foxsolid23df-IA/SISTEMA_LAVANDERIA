import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { cashCutService } from "../../services/cashCutService";
import { salesService } from "../../services/salesService";
import { terminalService } from "../../services/terminalService";
import { useSettings } from "../../contexts/SettingsContext";
import { cashWithdrawalService } from "../../services/cashWithdrawalService"; // Import Service
import { printService } from "../../services/printService";
import TicketCorte from "./TicketCorte";
import CashWithdrawalModal from "./CashWithdrawalModal"; // Import Modal
import Swal from "sweetalert2";
import { CashFundModal } from "../auth/CashFundModal";

export const CashCut = ({ onClose }) => {
  const {
    activeStaff,
    activeRole,
    lockScreen,
    storeName,
    closeCashSession,
    cashSession,
    checkCashSession,
  } = useAuth();

  // Si no hay sesión activa, permitir realizar la apertura
  if (!cashSession) {
    return (
      <CashFundModal
        staffName={activeStaff?.name || storeName || "Operador"}
        staffId={activeStaff?.id}
        onSessionCreated={() => {
          checkCashSession();
          onClose();
        }}
        onClose={onClose}
      />
    );
  }
  const [loading, setLoading] = useState(true);
  const [shiftSummary, setShiftSummary] = useState(null);
  const [daySummary, setDaySummary] = useState(null);
  const [shiftDeclared, setShiftDeclared] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [actualUSD, setActualUSD] = useState("");
  const [notes, setNotes] = useState("");
  const [cutType, setCutType] = useState("turno");
  const [submitting, setSubmitting] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [cutResult, setCutResult] = useState(null);

  const { settings, loading: loadingSettings } = useSettings();
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false); // State for modal
  const ticketRef = useRef(null);

  // El resumen se carga mediante el efecto dependiente de cutType definido más abajo

  const processSummaryData = (data) => {
    const sales = data.sales || [];
    const usdSales = sales.filter(
      (s) => s.currency === "USD" || s.payment_method === "dolares",
    );
    const totalUSD = usdSales.reduce(
      (acc, curr) => acc + (parseFloat(curr.amount_usd) || 0),
      0,
    );

    // Calcular efectivo esperado (Fondo Inicial + Ventas Efectivo - Retiros)
    let expectedMXN = parseFloat(data.opening_fund || cashSession?.opening_fund || 0);
    
    // Separar ventas activos de cancelados
    const activeSales = sales.filter((s) => s.status !== "cancelled");
    const cancelledSales = sales.filter((s) => s.status === "cancelled");

    const cashSales = activeSales.filter(
      (s) => s.payment_method === "efectivo",
    );
    expectedMXN += cashSales.reduce(
      (sum, sale) => sum + parseFloat(sale.total || 0),
      0,
    );
    expectedMXN -= parseFloat(data.withdrawals?.totalMXN || 0);
    // Nota: No restamos cancelaciones aquí porque cashSales ya solo incluye ventas activas.

    const usdSalesMixed = activeSales.filter(
      (s) => s.payment_method === "dolares",
    );
    expectedMXN += usdSalesMixed.reduce((acc, curr) => {
      const saleTotal = parseFloat(curr.total) || 0;
      const usdVal =
        (parseFloat(curr.amount_usd) || 0) *
        (parseFloat(curr.exchange_rate) || 0);
      return acc + (saleTotal - usdVal);
    }, 0);

    return {
      ...data,
      totalUSD,
      expectedMXN,
      withdrawals: data.withdrawals || { totalMXN: 0, totalUSD: 0, count: 0 },
      cardTotal: data.cardTotal || 0,
      transferTotal: data.transferTotal || 0,
      cashTotal: data.cashTotal || 0,
      cancelledSales,
      cancelledCount: cancelledSales.length,
      cancelledTotal: cancelledSales.reduce(
        (sum, s) => sum + parseFloat(s.total || 0),
        0,
      ),
    };
  };

  const loadSummary = async () => {
    try {
      setLoading(true);
      const shiftData = await cashCutService.getCurrentShiftSummary("turno");
      setShiftSummary(processSummaryData(shiftData));

      if (cutType === "dia") {
        const dayData = await cashCutService.getCurrentShiftSummary("dia");
        setDaySummary(processSummaryData(dayData));
      }
    } catch (error) {
      console.error("Error cargando resumen:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo cargar el resumen del turno",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (amount, currency = "MXN") => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency,
    }).format(amount);
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleString("es-MX", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleSubmit = async () => {
    if (cutType === "dia") {
      return executeCut("dia");
    }

    if (diffMXN !== 0 && !notes.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Justificación Requerida",
        text: "Por favor agrega una nota explicando la diferencia en caja",
        confirmButtonColor: "#10b981",
      });
      return;
    }

    if (diffUSD !== 0 && !notes.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Justificación Requerida",
        text: "Por favor agrega una nota explicando la diferencia en dólares",
        confirmButtonColor: "#10b981",
      });
      return;
    }

    executeCut("turno");
  };

  const executeCut = async (typeToExecute) => {
    if (submitting) return;

    let currentSummary = typeToExecute === "dia" ? daySummary : shiftSummary;

    const diffMXN =
      typeToExecute === "turno"
        ? (parseFloat(actualCash) || 0) - (currentSummary?.expectedMXN || 0)
        : 0;
    const diffUSD =
      typeToExecute === "turno"
        ? (parseFloat(actualUSD) || 0) - (currentSummary?.totalUSD || 0)
        : 0;

    const result = await Swal.fire({
      title: typeToExecute === "dia" ? "¿Cerrar el día?" : "¿Cerrar turno?",
      html:
        `<div style="text-align: left; font-size: 0.9em;">
        <p><strong>Fondo Inicial:</strong> ${formatMoney(parseFloat(cashSession?.opening_fund) || 0)}</p>
        <hr style="margin: 5px 0;">
        <p><strong>Esperado MXN:</strong> ${formatMoney(currentSummary.expectedMXN || 0)}</p>` +
        (typeToExecute === "turno"
          ? `<p><strong>Contado MXN:</strong> ${formatMoney(parseFloat(actualCash) || 0)}</p>
        <p style="color: ${diffMXN !== 0 ? "red" : "green"}"><strong>Diferencia MXN:</strong> ${formatMoney(diffMXN)}</p>`
          : "") +
        `<hr style="margin: 5px 0;">
        <p><strong>Esperado USD:</strong> ${formatMoney(currentSummary.totalUSD || 0, "USD")}</p>` +
        (typeToExecute === "turno"
          ? `<p><strong>Contado USD:</strong> ${formatMoney(parseFloat(actualUSD) || 0, "USD")}</p>
        <p style="color: ${diffUSD !== 0 ? "red" : "green"}"><strong>Diferencia USD:</strong> ${formatMoney(diffUSD, "USD")}</p>`
          : "") +
        `</div>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, cerrar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    setSubmitting(true);

    try {
      const cutData = {
        staffName: activeStaff?.name || "Desconocido",
        staffRole: activeRole,
        cutType: typeToExecute,
        startTime: currentSummary.startTime,
        salesCount: currentSummary.salesCount,
        salesTotal: currentSummary.salesTotal,
        cashTotal: currentSummary.cashTotal,
        expectedCash: currentSummary.expectedMXN,
        actualCash:
          typeToExecute === "turno"
            ? parseFloat(actualCash) || 0
            : currentSummary.expectedMXN,
        difference: diffMXN,
        expectedUSD: currentSummary.totalUSD,
        actualUSD:
          typeToExecute === "turno"
            ? parseFloat(actualUSD) || 0
            : currentSummary.totalUSD,
        differenceUSD: diffUSD,
        cardTotal: currentSummary.cardTotal,
        transferTotal: currentSummary.transferTotal,
        opening_fund: parseFloat(cashSession?.opening_fund) || 0,
        notes,
        // Datos de cancelaciones
        cancelledCount: currentSummary.cancelledCount || 0,
        cancelledTotal: currentSummary.cancelledTotal || 0,
        cancelledCash: currentSummary.cancelledCash || 0,
        cancelledCard: currentSummary.cancelledCard || 0,
        cancelledTransfer: currentSummary.cancelledTransfer || 0,
        cancelledOrders: currentSummary.cancelledOrders || [],
      };

      const savedCut = await cashCutService.createCashCut(cutData);

      setCutResult({
        ...savedCut,
        ...cutData,
        withdrawals: currentSummary.withdrawals,
        endTime: new Date().toISOString(),
        difference: diffMXN,
        differenceUSD: diffUSD,
      });

      setShowTicket(true);
    } catch (error) {
      console.error("Error al crear corte:", error);
      Swal.fire("Error", "No se pudo realizar el corte", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = async () => {
    if (!ticketRef.current) return;

    const printContent = ticketRef.current.outerHTML; // <-- Usamos outerHTML para conservar el contenedor con sus estilos (ancho, fuente, etc)

    // Obtenemos los settings para inyectar los estilos globales en la cabecera del driver de impresión
    const width = settings?.printer_width || 80;
    const fontSize = settings?.printer_font_size || 12;
    const fontFamily =
      settings?.printer_font_family || "'Courier New', Courier, monospace";
    const fontWeight = settings?.printer_is_bold ? "bold" : "normal";

    const fullHtml = `
            <html>
                <head>
                    <title>CAJA - ${cutType === "dia" ? "Cierre de Día" : "Corte de Turno"}</title>
                    <style>
                        /* Reseteo general para ticket */
                        html, body { 
                            margin: 0; 
                            padding: 0; 
                            width: ${width}mm;
                            max-width: 100%;
                            font-family: ${fontFamily};
                            font-size: ${fontSize}px;
                            font-weight: ${fontWeight};
                            box-sizing: border-box;
                        }
                        @page { 
                            margin: 0; /* Quita los márgenes del navegador para no achicar el contenido */
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
            </html>
        `;

    // Llamamos al servicio de impresión unificado (soportará Electron sin diálogos)
    try {
      await printService.print(fullHtml, settings?.printer_name);
    } catch (error) {
      console.error("Error al imprimir el corte de caja:", error);
      Swal.fire(
        "Atención",
        "Hubo un problema al contactar la impresora preferida, se intentará usar la del sistema.",
        "warning",
      );
    }
  };

  const handleFinish = async () => {
    if (cutType === "dia" && cutResult?.cutType === "turno") {
      setShiftDeclared(true);
      setShowTicket(false);
      return;
    }

    Swal.fire({
      title: "¡Corte realizado!",
      text:
        cutType === "dia"
          ? "El día ha sido cerrado exitosamente"
          : "Tu turno ha sido cerrado exitosamente",
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
    });

    await closeCashSession();
    lockScreen();
    if (onClose) onClose();
  };

  // Función para manejar el éxito del retiro
  const handleWithdrawalSuccess = () => {
    loadSummary(); // Recargar el resumen para actualizar los montos esperados
  };

  // Función para exportar historial de retiros
  const handleExportWithdrawals = async () => {
    try {
      // Si hay sesión, intentamos filtrar por ella, si no, traemos los del día/turno aproximado
      // Por simplicidad, exportamos los de la sesión actual o recientes
      let withdrawals = [];
      if (cashSession?.id) {
        withdrawals = await cashWithdrawalService.getWithdrawalsBySession(
          cashSession.id,
        );
      } else {
        // Fallback: últimos 50 o por fecha
        withdrawals = await cashWithdrawalService.getWithdrawalHistory({
          limit: 100,
          startDate: summary?.startTime,
        });
      }

      if (withdrawals.length === 0) {
        Swal.fire("Info", "No hay retiros registrados en este periodo", "info");
        return;
      }

      cashWithdrawalService.exportToExcel(
        withdrawals,
        `Retiros_${activeStaff?.name || "Caja"}`,
      );
    } catch (error) {
      console.error("Error exportando retiros:", error);
      Swal.fire("Error", "No se pudo exportar el historial", "error");
    }
  };

  const currentSummary = cutType === "dia" ? daySummary : shiftSummary;

  // Cálculos en tiempo real para la UI
  const expectedMXN = currentSummary?.expectedMXN || 0;
  const diffMXN =
    cutType === "turno" ? (parseFloat(actualCash) || 0) - expectedMXN : 0;

  const expectedUSD = currentSummary?.totalUSD || 0;
  const diffUSD =
    cutType === "turno" ? (parseFloat(actualUSD) || 0) - expectedUSD : 0;

  useEffect(() => {
    loadSummary();
  }, [cutType]);

  if (loading && !currentSummary) {
    return (
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4 animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
            Cargando Resumen...
          </p>
        </div>
      </div>
    );
  }

  // Modal de Ticket
  if (showTicket && cutResult) {
    return (
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4">
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-300">
          <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg">
                <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400">
                  receipt_long
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Corte Exitoso
              </h2>
            </div>
            <button
              onClick={handleFinish}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-rounded">close</span>
            </button>
          </div>

          <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex justify-center">
              <TicketCorte
                cutResult={cutResult}
                settings={settings}
                cutType={cutType}
                ref={ticketRef}
              />
            </div>
          </div>

          <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
            <button
              onClick={handleFinish}
              className="flex-1 py-4 px-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Cerrar
            </button>
            <button
              onClick={handlePrint}
              className="flex-[1.5] py-4 px-6 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-rounded">print</span>
              Imprimir Ticket
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4">
      <style>{`
                .material-symbols-rounded { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
            `}</style>

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-3.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-xl shadow-inner shadow-amber-200/50 dark:shadow-none">
              <span className="material-symbols-rounded text-amber-600 dark:text-amber-400 text-2xl">
                savings
              </span>
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                CAJA
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Control de Efectivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-slate-100 dark:bg-slate-800 p-1.5 rounded-lg"
          >
            <span className="material-symbols-rounded text-xl">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
          {/* Botones de Acción Rápida (Retiros y Exportar) */}
          <div className="flex gap-2 mb-1">
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="flex-1 py-2 px-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded-lg text-rose-600 dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-base">
                money_off
              </span>
              Retiro / Gasto
            </button>
            <button
              onClick={handleExportWithdrawals}
              className="flex-1 py-2 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-rounded text-base">
                file_download
              </span>
              Historial Retiros
            </button>
          </div>

          {/* Selector de Tipo de Corte */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl gap-1">
            <button
              onClick={() => setCutType("turno")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all font-bold text-xs ${
                cutType === "turno"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-rounded text-base">person</span>
              Cierre de Turno
            </button>
            <button
              onClick={() => setCutType("dia")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg transition-all font-bold text-xs ${
                cutType === "dia"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-rounded text-base">
                dark_mode
              </span>
              Cierre del Día
            </button>
          </div>

          {/* ===== VISTA CIERRE DEL DÍA (dos tarjetas) ===== */}
          {cutType === "dia" && (
            <div className="space-y-4">
              {/* ── TARJETA 1: CORTE DEL TURNO ── */}
              <div
                className={`relative rounded-2xl border-2 transition-all duration-500 overflow-hidden ${
                  shiftDeclared
                    ? "border-slate-200 dark:border-slate-700 opacity-50 pointer-events-none"
                    : "border-amber-300 dark:border-amber-500/40 shadow-lg shadow-amber-100/50 dark:shadow-none"
                }`}
              >
                {shiftDeclared && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 z-10 flex items-center justify-center">
                    <div className="bg-emerald-100 dark:bg-emerald-900/50 px-4 py-2 rounded-xl flex items-center gap-2">
                      <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400 text-lg">
                        check_circle
                      </span>
                      <span className="text-emerald-700 dark:text-emerald-300 font-black uppercase tracking-widest text-[10px]">
                        Turno Declarado
                      </span>
                    </div>
                  </div>
                )}
                <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800/30 flex items-center gap-2">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-1.5 rounded-lg">
                    <span className="material-symbols-rounded text-amber-600 dark:text-amber-400 text-lg">
                      person
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">
                      Corte del Turno
                    </h3>
                    <p className="text-[9px] text-slate-500 font-bold">
                      Inicio: {formatTime(shiftSummary?.startTime)}
                    </p>
                  </div>
                </div>
                <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
                  {/* Stats del turno */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="text-base font-black text-slate-900 dark:text-white leading-none">
                        {shiftSummary?.salesCount || 0}
                      </div>
                      <div className="text-[8px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">
                        Ventas
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="text-base font-black text-slate-900 dark:text-white leading-none">
                        {formatMoney(shiftSummary?.salesTotal || 0)}
                      </div>
                      <div className="text-[8px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">
                        Monto Ventas
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="text-base font-black text-slate-900 dark:text-white leading-none">
                        {formatMoney(
                          parseFloat(cashSession?.opening_fund) || 0,
                        )}
                      </div>
                      <div className="text-[8px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">
                        Fondo Caja
                      </div>
                    </div>
                    <div className="bg-emerald-500 p-2.5 rounded-lg shadow-md shadow-emerald-500/20">
                      <div className="text-base font-black text-white leading-none">
                        {formatMoney(shiftSummary?.expectedMXN || 0)}
                      </div>
                      <div className="text-[8px] uppercase font-bold text-emerald-50 tracking-widest mt-0.5">
                        Esperado MXN
                      </div>
                    </div>
                  </div>
                  {/* Secundarios del turno */}
                  <div className="grid grid-cols-3 gap-2">
                    {shiftSummary?.cardTotal > 0 && (
                      <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/10 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                        <span className="material-symbols-rounded text-indigo-500 text-base">
                          credit_card
                        </span>
                        <div>
                          <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
                            Tarjeta
                          </p>
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {formatMoney(shiftSummary.cardTotal)}
                          </p>
                        </div>
                      </div>
                    )}
                    {shiftSummary?.transferTotal > 0 && (
                      <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/10 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                        <span className="material-symbols-rounded text-indigo-500 text-base">
                          account_balance
                        </span>
                        <div>
                          <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
                            Transferencia
                          </p>
                          <p className="text-xs font-black text-slate-900 dark:text-white">
                            {formatMoney(shiftSummary.transferTotal)}
                          </p>
                        </div>
                      </div>
                    )}
                    {shiftSummary?.withdrawals?.count > 0 && (
                      <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/10 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30">
                        <span className="material-symbols-rounded text-rose-500 text-base">
                          money_off
                        </span>
                        <div>
                          <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
                            Retiros ({shiftSummary.withdrawals.count})
                          </p>
                          <p className="text-xs font-black text-rose-600 dark:text-rose-400">
                            -{formatMoney(shiftSummary.withdrawals.totalMXN)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Inputs de efectivo dentro de la tarjeta del turno */}
                  {!shiftDeclared && (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        <div>
                          <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-[10px] mb-1.5">
                            <span className="material-symbols-rounded text-emerald-500 text-sm">
                              payments
                            </span>
                            Efectivo Físico (MXN)
                          </label>
                          <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-lg font-black text-emerald-500">
                                $
                              </span>
                            </div>
                            <input
                              className="block w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-xl font-black text-slate-900 dark:text-white focus:ring-0 focus:border-amber-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                              placeholder="0.00"
                              type="number"
                              step="0.01"
                              value={actualCash}
                              onChange={(e) => setActualCash(e.target.value)}
                            />
                            <div className="absolute top-1 right-2.5 text-[8px] font-bold text-slate-400">
                              ESPERADO:{" "}
                              {formatMoney(shiftSummary?.expectedMXN || 0)}
                            </div>
                          </div>
                        </div>
                        {(shiftSummary?.totalUSD > 0 || actualUSD > 0) && (
                          <div>
                            <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-[10px] mb-1.5">
                              <span className="material-symbols-rounded text-emerald-500 text-sm">
                                currency_exchange
                              </span>
                              Efectivo Físico (USD)
                            </label>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-base font-black text-emerald-500">
                                  US$
                                </span>
                              </div>
                              <input
                                className="block w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-xl font-black text-slate-900 dark:text-white focus:ring-0 focus:border-amber-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                placeholder="0.00"
                                type="number"
                                step="0.01"
                                value={actualUSD}
                                onChange={(e) => setActualUSD(e.target.value)}
                              />
                              <div className="absolute top-1 right-2.5 text-[8px] font-bold text-slate-400">
                                ESPERADO:{" "}
                                {formatMoney(
                                  shiftSummary?.totalUSD || 0,
                                  "USD",
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Botón declarar turno */}
                      <button
                        onClick={() => executeCut("turno")}
                        disabled={submitting}
                        className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-[0.12em] text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                      >
                        {submitting
                          ? "Procesando..."
                          : "Declarar Corte del Turno"}
                        {!submitting && (
                          <span className="material-symbols-rounded text-base">
                            chevron_right
                          </span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── TARJETA 2: CIERRE DEL DÍA ── */}
              <div
                className={`rounded-2xl border-2 transition-all duration-500 overflow-hidden ${
                  shiftDeclared
                    ? "border-emerald-300 dark:border-emerald-500/40 shadow-lg shadow-emerald-100/50 dark:shadow-none"
                    : "border-slate-200 dark:border-slate-700 opacity-60"
                }`}
              >
                <div
                  className={`px-4 py-2.5 border-b flex items-center gap-2 ${
                    shiftDeclared
                      ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div
                    className={`p-1.5 rounded-lg ${
                      shiftDeclared
                        ? "bg-emerald-100 dark:bg-emerald-900/30"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`material-symbols-rounded text-lg ${
                        shiftDeclared
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      dark_mode
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">
                      Cierre del Día
                    </h3>
                    <p className="text-[9px] text-slate-500 font-bold">
                      {shiftDeclared
                        ? `Período completo — Inicio: ${formatTime(daySummary?.startTime)}`
                        : "Declara el turno primero"}
                    </p>
                  </div>
                </div>
                <div className="p-4 space-y-3 bg-white dark:bg-slate-900">
                  {shiftDeclared && daySummary ? (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="text-base font-black text-slate-900 dark:text-white leading-none">
                            {daySummary.salesCount || 0}
                          </div>
                          <div className="text-[8px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">
                            Ventas del Día
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="text-base font-black text-slate-900 dark:text-white leading-none">
                            {formatMoney(daySummary.salesTotal || 0)}
                          </div>
                          <div className="text-[8px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">
                            Monto Total
                          </div>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="text-base font-black text-slate-900 dark:text-white leading-none">
                            {formatMoney(daySummary.cashTotal || 0)}
                          </div>
                          <div className="text-[8px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">
                            Efectivo Total
                          </div>
                        </div>
                        <div className="bg-emerald-500 p-2.5 rounded-lg shadow-md shadow-emerald-500/20">
                          <div className="text-base font-black text-white leading-none">
                            {formatMoney(daySummary.expectedMXN || 0)}
                          </div>
                          <div className="text-[8px] uppercase font-bold text-emerald-50 tracking-widest mt-0.5">
                            Esperado Día
                          </div>
                        </div>
                      </div>
                      {/* Secundarios del día */}
                      <div className="grid grid-cols-3 gap-2">
                        {daySummary.cardTotal > 0 && (
                          <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/10 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                            <span className="material-symbols-rounded text-indigo-500 text-base">
                              credit_card
                            </span>
                            <div>
                              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
                                Tarjeta
                              </p>
                              <p className="text-xs font-black text-slate-900 dark:text-white">
                                {formatMoney(daySummary.cardTotal)}
                              </p>
                            </div>
                          </div>
                        )}
                        {daySummary.transferTotal > 0 && (
                          <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/10 p-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                            <span className="material-symbols-rounded text-indigo-500 text-base">
                              account_balance
                            </span>
                            <div>
                              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
                                Transferencia
                              </p>
                              <p className="text-xs font-black text-slate-900 dark:text-white">
                                {formatMoney(daySummary.transferTotal)}
                              </p>
                            </div>
                          </div>
                        )}
                        {daySummary.totalUSD > 0 && (
                          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                            <span className="material-symbols-rounded text-emerald-500 text-base">
                              currency_exchange
                            </span>
                            <div>
                              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
                                Dólares
                              </p>
                              <p className="text-xs font-black text-slate-900 dark:text-white">
                                {formatMoney(daySummary.totalUSD, "USD")}
                              </p>
                            </div>
                          </div>
                        )}
                        {daySummary.withdrawals?.count > 0 && (
                          <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/10 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30">
                            <span className="material-symbols-rounded text-rose-500 text-base">
                              money_off
                            </span>
                            <div>
                              <p className="text-[8px] uppercase font-bold text-slate-400 tracking-widest">
                                Retiros ({daySummary.withdrawals.count})
                              </p>
                              <p className="text-xs font-black text-rose-600 dark:text-rose-400">
                                -{formatMoney(daySummary.withdrawals.totalMXN)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4 text-slate-400">
                      <span className="material-symbols-rounded text-3xl mb-1">
                        lock
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-widest">
                        Primero declara el corte del turno
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== VISTA CORTE DE TURNO (original) ===== */}
          {cutType === "turno" && (
            <>
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs">
                    <span className="material-symbols-rounded text-blue-500 text-lg">
                      analytics
                    </span>
                    Resumen del Período
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    Inicio: {formatTime(currentSummary?.startTime)}
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                      {currentSummary?.salesCount || 0}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                      Ventas Realizadas
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                      {formatMoney(currentSummary?.salesTotal || 0)}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                      Monto en Ventas
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                      {formatMoney(parseFloat(cashSession?.opening_fund) || 0)}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                      Fondo de Caja
                    </div>
                  </div>
                  <div className="bg-emerald-500 p-5 rounded-2xl shadow-lg shadow-emerald-500/20">
                    <div className="text-2xl font-black text-white mb-1 leading-none">
                      {formatMoney(expectedMXN)}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-emerald-50 tracking-widest">
                      Esperado MXN
                    </div>
                  </div>
                </div>

                {/* Totales Secundarios (Tarjeta, Transferencia, USD) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {currentSummary?.cardTotal > 0 && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl">
                          <span className="material-symbols-rounded text-indigo-600 dark:text-indigo-400 text-lg">
                            credit_card
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                            Tarjeta
                          </p>
                          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                            {formatMoney(currentSummary.cardTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSummary?.transferTotal > 0 && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl">
                          <span className="material-symbols-rounded text-indigo-600 dark:text-indigo-400 text-lg">
                            account_balance
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                            Transferencia
                          </p>
                          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                            {formatMoney(currentSummary.transferTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSummary?.totalUSD > 0 && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl">
                          <span className="material-symbols-rounded text-emerald-600 dark:text-emerald-400 text-lg">
                            currency_exchange
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                            Dólares
                          </p>
                          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                            {formatMoney(currentSummary.totalUSD, "USD")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentSummary?.withdrawals?.count > 0 && (
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-xl">
                          <span className="material-symbols-rounded text-rose-600 dark:text-rose-400 text-lg">
                            money_off
                          </span>
                        </div>
                        <div>
                          <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                            Retiros ({currentSummary.withdrawals.count})
                          </p>
                          <p className="text-lg font-black text-rose-600 dark:text-rose-400 leading-tight">
                            -{formatMoney(currentSummary.withdrawals.totalMXN)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Efectivo en Caja Inputs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section>
                  <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
                    <span className="material-symbols-rounded text-emerald-500">
                      payments
                    </span>
                    Efectivo en Caja (MXN)
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                      <span className="text-3xl font-black text-emerald-500 transition-all duration-300 group-focus-within:scale-120">
                        $
                      </span>
                    </div>
                    <input
                      className="block w-full pl-14 pr-6 py-7 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-3xl text-4xl font-black text-slate-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                      placeholder="0.00"
                      type="number"
                      step="0.01"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                    />
                    <div className="absolute top-2 right-4 text-[10px] font-bold text-slate-400">
                      ESPERADO: {formatMoney(expectedMXN)}
                    </div>
                  </div>
                </section>

                {/* USD Input Section */}
                {(currentSummary?.totalUSD > 0 || actualUSD > 0) && (
                  <section>
                    <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
                      <span className="material-symbols-rounded text-emerald-500">
                        currency_exchange
                      </span>
                      Efectivo en Caja (USD)
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                        <span className="text-2xl font-black text-emerald-500 transition-all duration-300 group-focus-within:scale-120">
                          US$
                        </span>
                      </div>
                      <input
                        className="block w-full pl-16 pr-6 py-7 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-3xl text-4xl font-black text-slate-900 dark:text-white focus:ring-0 focus:border-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-inner"
                        placeholder="0.00"
                        type="number"
                        step="0.01"
                        value={actualUSD}
                        onChange={(e) => setActualUSD(e.target.value)}
                      />
                      <div className="absolute top-2 right-4 text-[10px] font-bold text-slate-400">
                        ESPERADO: {formatMoney(expectedUSD, "USD")}
                      </div>
                    </div>
                  </section>
                )}
              </div>

              {/* Diferencia Display con feedback visual mejorado */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div
                  className={`p-6 rounded-2xl border-2 flex items-center justify-between transition-all duration-500 ${
                    diffMXN === 0
                      ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20"
                      : diffMXN > 0
                        ? "bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20"
                        : "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20"
                  }`}
                >
                  <div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1 ${
                        diffMXN === 0
                          ? "text-emerald-500"
                          : diffMXN > 0
                            ? "text-blue-500"
                            : "text-rose-500"
                      }`}
                    >
                      Balance MXN
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        diffMXN === 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : diffMXN > 0
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {diffMXN === 0
                        ? "✓ MXN Correcto"
                        : diffMXN > 0
                          ? "⬆ Sobrante MXN"
                          : "⬇ Faltante MXN"}
                    </span>
                  </div>
                  <span
                    className={`text-4xl font-black tabular-nums transition-all ${
                      diffMXN === 0
                        ? "text-emerald-600"
                        : diffMXN > 0
                          ? "text-blue-600"
                          : "text-rose-600"
                    }`}
                  >
                    {diffMXN === 0 ? "OK" : formatMoney(diffMXN)}
                  </span>
                </div>

                {(currentSummary?.totalUSD > 0 || actualUSD > 0) && (
                  <div
                    className={`p-6 rounded-2xl border-2 flex items-center justify-between transition-all duration-500 ${
                      diffUSD === 0
                        ? "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/20"
                        : diffUSD > 0
                          ? "bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/20"
                          : "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/20"
                    }`}
                  >
                    <div>
                      <span
                        className={`text-[10px] font-black uppercase tracking-[0.2em] block mb-1 ${
                          diffUSD === 0
                            ? "text-emerald-500"
                            : diffUSD > 0
                              ? "text-blue-500"
                              : "text-rose-500"
                        }`}
                      >
                        Balance USD
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          diffUSD === 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : diffUSD > 0
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {diffUSD === 0
                          ? "✓ USD Correcto"
                          : diffUSD > 0
                            ? "⬆ Sobrante USD"
                            : "⬇ Faltante USD"}
                      </span>
                    </div>
                    <span
                      className={`text-4xl font-black tabular-nums transition-all ${
                        diffUSD === 0
                          ? "text-emerald-600"
                          : diffUSD > 0
                            ? "text-blue-600"
                            : "text-rose-600"
                      }`}
                    >
                      {diffUSD === 0 ? "OK" : formatMoney(diffUSD, "USD")}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Observaciones */}
          <section>
            <label className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-[10px] mb-2">
              <span className="material-symbols-rounded text-slate-400 text-base">
                notes
              </span>
              Observaciones (Opcional)
            </label>
            <textarea
              className="block w-full p-3 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:ring-0 focus:border-emerald-500 transition-all resize-none shadow-inner"
              placeholder="Anota cualquier detalle relevante del corte..."
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </section>
        </div>

        {/* Footer and Actions */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 space-y-2 bg-slate-50/30 dark:bg-slate-900/40">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Cancelar
            </button>
            {cutType === "dia" ? (
              <button
                onClick={() => executeCut("dia")}
                disabled={submitting || !shiftDeclared}
                className="flex-[2.5] py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-[0.15em] text-xs hover:translate-y-[-1px] hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40 disabled:translate-y-0 disabled:cursor-not-allowed"
              >
                {submitting ? "Procesando..." : "Ejecutar Cierre del Día"}
                {!submitting && (
                  <span className="material-symbols-rounded text-base">
                    chevron_right
                  </span>
                )}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-[2.5] py-3 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:translate-y-[-1px] hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:translate-y-0"
              >
                {submitting
                  ? "Procesando Corte..."
                  : "Ejecutar Cierre de Turno"}
                {!submitting && (
                  <span className="material-symbols-rounded text-base">
                    chevron_right
                  </span>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
            <p className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Autenticado como:{" "}
              <span className="text-slate-600 dark:text-slate-300">
                {activeStaff?.name || "Desconocido"}
              </span>
            </p>
            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          </div>
        </div>
      </div>

      {/* Modal de Retiros */}
      {showWithdrawalModal && (
        <CashWithdrawalModal
          onClose={() => setShowWithdrawalModal(false)}
          onSuccess={handleWithdrawalSuccess}
          cashSessionId={cashSession?.id}
          terminalId={cashSession?.terminal_id}
          staffId={activeStaff?.id}
          staffName={activeStaff?.name}
          maxAmount={expectedMXN} // Opcional: Advertencia si retira más de lo esperado
        />
      )}
    </div>
  );
};
