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
  const [summary, setSummary] = useState(null);
  const [salesDetails, setSalesDetails] = useState([]);
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

  const loadSummary = async () => {
    try {
      setLoading(true);
      const data = await cashCutService.getCurrentShiftSummary(cutType);

      // Calculate Expectatives
      const sales = data.sales || [];

      // 1. Calculate Expected USD
      const usdSales = sales.filter(
        (s) => s.currency === "USD" || s.payment_method === "dolares",
      );
      const totalUSD = usdSales.reduce(
        (acc, curr) => acc + (parseFloat(curr.amount_usd) || 0),
        0,
      );

      // 2. Calculate Expected MXN
      // Start with opening fund
      let expectedMXN = parseFloat(cashSession?.opening_fund) || 0;

      // Add Cash Sales (MXN)
      const cashSales = sales.filter((s) => s.payment_method === "efectivo");
      expectedMXN += cashSales.reduce(
        (acc, curr) => acc + (parseFloat(curr.total) || 0),
        0,
      );

      // Subtract Withdrawals (MXN)
      const withdrawalsMXN = data.withdrawals?.totalMXN || 0;
      expectedMXN -= withdrawalsMXN;

      // Handle USD Sales (Add Sale Value in MXN, Subtract Change given in MXN)
      // Effectively: Net Change to MXN Drawer = SaleTotal - (USDAmount * ExchangeRate)
      // Example: Sale 100, Pay 10USD (200MXN). Change 100. Desk gets +10USD, -100MXN.
      // 100 - 200 = -100. Correct.
      const usdSalesMixed = sales.filter((s) => s.payment_method === "dolares");
      expectedMXN += usdSalesMixed.reduce((acc, curr) => {
        const saleTotal = parseFloat(curr.total) || 0;
        const usdVal =
          (parseFloat(curr.amount_usd) || 0) *
          (parseFloat(curr.exchange_rate) || 0);
        return acc + (saleTotal - usdVal);
      }, 0);

      setSummary({
        ...data,
        totalUSD,
        expectedMXN,
        withdrawals: data.withdrawals || { totalMXN: 0, totalUSD: 0, count: 0 }, // Store withdrawals info
        cardTotal: data.cardTotal || 0,
        transferTotal: data.transferTotal || 0,
        cashTotal: data.cashTotal || 0,
      });
      setSalesDetails(sales);

      // Initialize inputs
      // We don't autofill actual cash to prevent assumption, or we can defaulting to 0 or expected?
      // Previous code initialized to salesTotal, which was wrong. Let's start empty or 0.
      // setActualCash(data.salesTotal.toFixed(2)); // Removing this autocalc to force counting
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
    if (submitting) return;

    if (submitting) return;

    // Validaciones para Cierre de Día
    try {
      if (cutType === "dia") {
        /*
        // Comentado para permitir cierre desde cualquier equipo según requerimiento
        const isMain = await terminalService.checkIfMainTerminal();
        if (!isMain) {
          Swal.fire(
            "Acceso Denegado",
            "El Cierre de Día solo puede realizarse desde la Caja Principal.",
            "warning",
          );
          return;
        }
        */
        /*
        // Comentado para permitir cerrar el día incluso con otras cajas abiertas según requerimiento
        const blockingSessions = await cashCutService.checkBlockingSessions();
        if (blockingSessions.length > 0) {
          const sessionList = blockingSessions
            .map(
              (s) =>
                `<li><strong>${s.terminals?.name || "Terminal desconocida"}</strong>: ${s.staff_name}</li>`,
            )
            .join("");

          Swal.fire({
            title: "No se puede cerrar el día",
            html: `
                            <p>Hay cajas con turno abierto. Deben realizar su corte primero:</p>
                            <ul style="text-align: left; margin-top: 10px;">${sessionList}</ul>
                        `,
            icon: "error",
          });
          return;
        }
        */
      }
    } catch (error) {
      console.error("Error en validaciones de cierre:", error);
      Swal.fire(
        "Error",
        "Ocurrió un error verificando los permisos de cierre. Por favor revisa la conexión.",
        "error",
      );
      return;
    }

    const diffMXN = (parseFloat(actualCash) || 0) - (summary?.expectedMXN || 0);
    const diffUSD = (parseFloat(actualUSD) || 0) - (summary?.totalUSD || 0);

    const result = await Swal.fire({
      title: cutType === "dia" ? "¿Cerrar el día?" : "¿Cerrar turno?",
      html: `
                <div style="text-align: left; font-size: 0.9em;">
                    <p><strong>Fondo Inicial:</strong> ${formatMoney(parseFloat(cashSession?.opening_fund) || 0)}</p>
                    <hr style="margin: 5px 0;">
                    <p><strong>Esperado MXN:</strong> ${formatMoney(summary.expectedMXN || 0)}</p>
                    <p><strong>Contado MXN:</strong> ${formatMoney(parseFloat(actualCash) || 0)}</p>
                    <p style="color: ${diffMXN !== 0 ? "red" : "green"}"><strong>Diferencia MXN:</strong> ${formatMoney(diffMXN)}</p>
                    <hr style="margin: 5px 0;">
                    <p><strong>Esperado USD:</strong> ${formatMoney(summary.totalUSD || 0, "USD")}</p>
                    <p><strong>Contado USD:</strong> ${formatMoney(parseFloat(actualUSD) || 0, "USD")}</p>
                    <p style="color: ${diffUSD !== 0 ? "red" : "green"}"><strong>Diferencia USD:</strong> ${formatMoney(diffUSD, "USD")}</p>
                </div>
            `,
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
        cutType,
        startTime: summary.startTime,
        salesCount: summary.salesCount,
        salesTotal: summary.salesTotal,
        cashTotal: summary.cashTotal,
        expectedCash: summary.expectedMXN,
        actualCash: parseFloat(actualCash) || 0,
        difference: diffMXN,
        expectedUSD: summary.totalUSD,
        actualUSD: parseFloat(actualUSD) || 0,
        differenceUSD: diffUSD,
        cardTotal: summary.cardTotal,
        transferTotal: summary.transferTotal,
        opening_fund: parseFloat(cashSession?.opening_fund) || 0,
        notes,
      };

      const savedCut = await cashCutService.createCashCut(cutData);

      // Guardar resultado para el ticket
      setCutResult({
        ...savedCut,
        ...cutData,
        withdrawals: summary.withdrawals,
        endTime: new Date().toISOString(),
        difference: diffMXN,
        differenceUSD: diffUSD,
      });

      // Mostrar ticket antes de bloquear
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

    // Cerrar la sesión de visualización de caja
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

  // Cálculos en tiempo real para la UI
  const expectedMXN = summary?.expectedMXN || 0;
  const diffMXN = (parseFloat(actualCash) || 0) - expectedMXN;

  const expectedUSD = summary?.totalUSD || 0;
  const diffUSD = (parseFloat(actualUSD) || 0) - expectedUSD;

  // Efecto para recargar el resumen si cambia el tipo (proactivo por si el servicio se expande)
  useEffect(() => {
    loadSummary();
  }, [cutType]);

  if (loading && !summary) {
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
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
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[1050] p-4">
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
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
      <style>{`
                .material-symbols-rounded { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
            `}</style>

      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl flex flex-col max-h-[95vh] lg:max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl shadow-inner shadow-amber-200/50 dark:shadow-none">
              <span className="material-symbols-rounded text-amber-600 dark:text-amber-400 text-3xl">
                savings
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">
                CAJA
              </h1>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                Control de Efectivo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-slate-100 dark:bg-slate-800 p-2 rounded-xl"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {/* Botones de Acción Rápida (Retiros y Exportar) */}
          <div className="flex gap-3 mb-2">
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="flex-1 py-3 px-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded-xl text-rose-600 dark:text-rose-400 font-bold text-xs uppercase tracking-wider hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-rounded">money_off</span>
              Registrar Retiro / Gasto
            </button>
            <button
              onClick={handleExportWithdrawals}
              className="flex-1 py-3 px-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-rounded">file_download</span>
              Historial Retiros (Excel)
            </button>
          </div>

          {/* Selector de Tipo de Corte */}
          <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl gap-1">
            <button
              onClick={() => setCutType("turno")}
              className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition-all font-bold text-sm ${
                cutType === "turno"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-rounded">person</span>
              Cierre de Turno
            </button>
            <button
              onClick={() => setCutType("dia")}
              className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition-all font-bold text-sm ${
                cutType === "dia"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-rounded">dark_mode</span>
              Cierre del Día
            </button>
          </div>

          {/* Resumen Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs">
                <span className="material-symbols-rounded text-blue-500 text-lg">
                  analytics
                </span>
                Resumen del Período
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                Inicio: {formatTime(summary?.startTime)}
              </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                  {summary?.salesCount || 0}
                </div>
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                  Ventas Realizadas
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="text-2xl font-black text-slate-900 dark:text-white mb-1 leading-none">
                  {formatMoney(summary?.salesTotal || 0)}
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
              {summary?.cardTotal > 0 && (
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
                        {formatMoney(summary.cardTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {summary?.transferTotal > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-purple-600 dark:text-purple-400 text-lg">
                        account_balance
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                        Transferencia
                      </p>
                      <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {formatMoney(summary.transferTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {summary?.totalUSD > 0 && (
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
                        {formatMoney(summary.totalUSD, "USD")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {summary?.withdrawals?.count > 0 && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border-2 border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-rose-100 dark:bg-rose-900/30 p-2 rounded-xl">
                      <span className="material-symbols-rounded text-rose-600 dark:text-rose-400 text-lg">
                        money_off
                      </span>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">
                        Retiros ({summary.withdrawals.count})
                      </p>
                      <p className="text-lg font-black text-rose-600 dark:text-rose-400 leading-tight">
                        -{formatMoney(summary.withdrawals.totalMXN)}
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
            {(summary?.totalUSD > 0 || actualUSD > 0) && (
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

            {(summary?.totalUSD > 0 || actualUSD > 0) && (
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

          {/* Observaciones */}
          <section>
            <label className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase tracking-widest text-xs mb-4">
              <span className="material-symbols-rounded text-slate-400">
                notes
              </span>
              Observaciones (Opcional)
            </label>
            <textarea
              className="block w-full p-6 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-slate-700 dark:text-slate-300 focus:ring-0 focus:border-emerald-500 transition-all resize-none shadow-inner"
              placeholder="Anota cualquier detalle relevante del corte..."
              rows="3"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </section>
        </div>

        {/* Footer and Actions */}
        <div className="p-8 border-t border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-slate-900/40">
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 py-5 px-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black uppercase tracking-widest text-xs hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-[2.5] py-5 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-[0.2em] text-sm hover:translate-y-[-2px] hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0"
            >
              {submitting
                ? "Procesando Corte..."
                : `Ejecutar ${cutType === "dia" ? "Cierre de Día" : "Cierre de Turno"}`}
              {!submitting && (
                <span className="material-symbols-rounded">chevron_right</span>
              )}
            </button>
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
