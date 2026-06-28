// ===== COMPONENTE HISTORIAL DE VENTAS =====
// Este componente muestra todas las ventas realizadas con filtros y detalles
// RediseÃ±ado con un estilo minimalista y moderno usando Tailwind CSS

import React, { useState, useEffect, useCallback } from "react";
import "./Historial.css";
import { useApi } from "../../hooks/useApi";
import { useDateFilter } from "../../hooks/useDateFilter";
import { useAuth } from "../../hooks/useAuth";
import {
  formatearDinero,
  formatearFechaHora,
  contarProductos,
} from "../../utils";
import { exportToExcel } from "../../utils/exportToExcel";
import { salesService } from "../../services/salesService";
import { orderService } from "../../services/orderService";
import { productService } from "../../services/productService";
import { staffService } from "../../services/staffService";
import { printService } from "../../services/printService"; // Importado para reimpresiÃ³n
import { businessSettingsService } from "../../services/businessSettingsService"; // Importado para configuraciÃ³n
import { cashCutService } from "../../services/cashCutService"; // Importado para historial de cortes
import TicketCorte from "../cashcut/TicketCorte"; // Importado para reimpresiÃ³n de cortes
import Modal from "../common/Modal";
import Swal from "sweetalert2";

export const Historial = () => {
  // MODO DE REPORTE (A solicitud del usuario: Reportes Separados)
  const [reportMode, setReportMode] = useState("SERVICES"); // 'SERVICES', 'PRODUCTS' o 'CASH_CUTS'

  // 1. ESTADOS PRINCIPALES
  const [productos, setProductos] = useState([]); // Lista de productos para mostrar en el modal
  const [ventas, setVentas] = useState([]); // Lista de todas las ventas/Ã³rdenes
  const [ventasFiltradas, setVentasFiltradas] = useState([]); // Ventas despuÃ©s de filtrar

  const [empleados, setEmpleados] = useState([]);
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [filtroMetodoPago, setFiltroMetodoPago] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const ventasPorPagina = 8;

  // 3. ESTADOS PARA EL MODAL DE DETALLES
  const [mostrarModal, setMostrarModal] = useState(false);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);

  // Estado para configuraciÃ³n de negocio (necesario para el ticket)
  const [businessSettings, setBusinessSettings] = useState(null);

  // 4. HOOK PARA FILTRADO POR FECHAS
  const dateFilter = useDateFilter();

  // 5. HOOK PARA MANEJAR LLAMADAS AL BACKEND
  const { ejecutarPeticion } = useApi();

  // Estado local de carga
  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  const { canAccessReports } = useAuth();

  // 6.b EFECTO PARA SUPRIMIR ERRORES DE ABORTO
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      const errorString = args.join(" ");
      if (
        errorString.includes("AbortError") ||
        errorString.includes("signal is aborted")
      ) {
        return;
      }
      originalError.apply(console, args);
    };
    return () => {
      console.error = originalError;
    };
  }, []);

  // Ref para verificar si el componente estÃ¡ montado
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cargar empleados y configuraciÃ³n al montar
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const data = await staffService.getStaff();
        setEmpleados(data || []);
      } catch (e) {
        console.error("Error cargando empleados", e);
      }
    };
    const loadSettings = async () => {
      try {
        const settings = await businessSettingsService.getSettings();
        setBusinessSettings(settings);
      } catch (e) {
        console.error("Error cargando settings para ticket", e);
      }
    };
    loadStaff();
    loadSettings();
  }, []);

  // 7. FUNCIÃ“N PARA CARGAR TODAS LAS VENTAS/Ã“RDENES DESDE SUPABASE
  const cargarVentasYProductos = async () => {
    setLoadingData(true);
    setErrorData(null);
    setVentas([]);
    setVentasFiltradas([]);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tiempo de espera agotado")), 15000),
      );

      // Cargar datos segÃºn el modo
      let serviceCall;
      if (reportMode === "SERVICES") {
        serviceCall = orderService.getOrders();
      } else if (reportMode === "PRODUCTS") {
        serviceCall = salesService.getSales(1000);
      } else if (reportMode === "CASH_CUTS") {
        serviceCall = cashCutService.getCashCuts({ limit: 200 });
      }

      const dataPromise = Promise.all([
        serviceCall,
        productService.getProducts(),
      ]);

      const resultados = await Promise.race([dataPromise, timeoutPromise]);
      if (!isMountedRef.current) return;

      const [transaccionesData, productosData] = resultados;
      const dataSegura = Array.isArray(transaccionesData)
        ? transaccionesData
        : [];

      // TransformaciÃ³n unificada para el resto del componente
      const transaccionesTransformadas = dataSegura.map((t) => {
        if (reportMode === "CASH_CUTS") {
          return {
            id: t.id,
            total: t.sales_total,
            actualCash: t.actual_cash,
            expectedCash: t.expected_cash,
            difference: t.difference,
            createdAt: t.created_at,
            employeeName: t.staff_name || "Desconocido",
            paymentMethod: t.cut_type === "dia" ? "Cierre DÃ­a" : "Corte Turno",
            status: "completed",
            isCut: true,
            opening_fund: t.opening_fund,
            salesCount: t.sales_count,
            cardTotal: t.card_total,
            transferTotal: t.transfer_total,
            expectedUSD: t.expected_usd,
            actualUSD: t.actual_usd,
            differenceUSD: t.difference_usd,
            notes: t.notes,
            terminal_id: t.terminal_id,
            items: [], // Los cortes no tienen items en el mismo sentido
          };
        }

        return {
          id: t.id,
          folio: t.folio,
          total: t.total,
          paidAmount: t.paid_amount || t.total,
          createdAt: t.created_at,
          customerName: t.customers?.name || "PÃºblico General",
          customerPhone: t.customers?.phone,
          employeeName: t.staff?.name || "Sistema",
          paymentMethod: t.payment_method || "efectivo",
          status: t.status || "completed",
          isOrder: reportMode === "SERVICES",
          ticket_uuid: t.ticket_uuid,
          pin_facturacion: t.pin || t.pin_facturacion,
          items: (t.order_items || t.sale_items || []).map((item) => ({
            id: item.id,
            productId: item.product_id || null,
            productName: item.product_name || "Sin nombre",
            name: item.product_name || "Sin nombre",
            quantity: item.quantity || 0,
            price: item.price || 0,
            total: item.total || 0,
          })),
        };
      });

      const productosSeguros = Array.isArray(productosData)
        ? productosData
        : [];

      setVentas(transaccionesTransformadas);
      setVentasFiltradas(transaccionesTransformadas);
      setProductos(productosSeguros);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Error cargando datos:", error);
      setErrorData("No se pudieron cargar los datos. Verifica tu conexiÃ³n.");
    } finally {
      if (isMountedRef.current) setLoadingData(false);
    }
  };

  // Recargar cuando cambie el modo
  useEffect(() => {
    setFiltroEmpleado("");
    setFiltroMetodoPago("");
    dateFilter.limpiarFiltros();
    cargarVentasYProductos();
  }, [reportMode]);

  // 8. FUNCIÃ“N PARA LIMPIAR FILTROS
  const limpiarFiltros = () => {
    dateFilter.limpiarFiltros();
    setFiltroEmpleado("");
    setFiltroMetodoPago("");
    setVentasFiltradas(ventas);
  };

  // 9. FUNCIÃ“N PARA ABRIR EL MODAL DE DETALLES
  const verDetalles = (venta) => {
    if (venta.isCut) {
      setVentaSeleccionada(venta);
      setMostrarModal(true);
      return;
    }

    const ventaConNombres = {
      ...venta,
      items: venta.items.map((item) => {
        const prod = productos.find((p) => p.id === item.productId);
        return {
          ...item,
          productName:
            item.productName ||
            item.name ||
            (prod ? prod.name : "Producto sin nombre"),
          barcode: item.barcode || (prod ? prod.barcode : ""),
        };
      }),
    };
    setVentaSeleccionada(ventaConNombres);
    setMostrarModal(true);
  };

  // 10. FUNCIÃ“N PARA CERRAR EL MODAL
  const cerrarModal = () => {
    setMostrarModal(false);
    setVentaSeleccionada(null);
  };

  // 10.b FUNCIÃ“N PARA ELIMINAR VENTA (Solo Admin/DueÃ±o con ContraseÃ±a)
  const eliminarVenta = async (saleId) => {
    const { value: password } = await Swal.fire({
      title: "Seguridad de Administrador",
      text: "Para eliminar este reporte, ingresa el cÃ³digo de seguridad:",
      input: "password",
      inputPlaceholder: "CÃ³digo de Seguridad",
      showCancelButton: true,
      confirmButtonText: "Eliminar Registro",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#000000",
      inputAttributes: {
        autocapitalize: "off",
        autocorrect: "off",
      },
    });

    if (password) {
      const isValidAdmin = await staffService.validateAdminPin(password);

      if (isValidAdmin) {
        const confirm = await Swal.fire({
          title: "Â¿EstÃ¡s seguro?",
          text: reportMode === "SERVICES"
            ? "La orden serÃ¡ removida de la vista activa y el stock se restaurarÃ¡."
            : "Esta acciÃ³n no se puede deshacer y el registro se borrarÃ¡ permanentemente de la base de datos.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#000000",
          confirmButtonText: "SÃ­, eliminar",
          cancelButtonText: "No, cancelar",
        });

        if (confirm.isConfirmed) {
          try {
            if (reportMode === "SERVICES") {
              await orderService.deleteOrder(saleId, null, 'Eliminada desde historial');
            } else {
              await salesService.deleteSale(saleId);
            }
            Swal.fire({
              title: "Eliminado",
              text:
                reportMode === "SERVICES"
                  ? "La orden de servicio ha sido eliminada exitosamente."
                  : "El reporte de venta ha sido eliminado exitosamente.",
              icon: "success",
              confirmButtonColor: "#000000",
            });
            // Recargar datos
            cargarVentasYProductos();
          } catch (error) {
            Swal.fire(
              "Error",
              "No se pudo eliminar el reporte: " + error.message,
              "error",
            );
          }
        }
      } else {
        Swal.fire(
          "Error",
          "PIN de administrador incorrecto. Solo el dueÃ±o o administrador puede realizar esta acciÃ³n.",
          "error",
        );
      }
    }
  };

  // 11. FUNCIÃ“N PARA FILTRAR LAS VENTAS (Fechas + Empleado/Cliente + Método Pago)
  const filtrarVentas = useCallback(() => {
    let filtradas = dateFilter.filtrarPorFecha(ventas);

    if (filtroEmpleado) {
      if (reportMode === "SERVICES") {
        // En modo servicios, filtrar por nombre del cliente
        filtradas = filtradas.filter((v) => v.customerName === filtroEmpleado);
      } else {
        // En modo productos, filtrar por nombre del empleado
        filtradas = filtradas.filter((v) => v.employeeName === filtroEmpleado);
      }
    }

    if (filtroMetodoPago) {
      filtradas = filtradas.filter((v) => v.paymentMethod === filtroMetodoPago);
    }

    setVentasFiltradas(filtradas);
    setPaginaActual(1);
  }, [
    dateFilter.fechaDesde,
    dateFilter.fechaHasta,
    ventas,
    dateFilter.filtrarPorFecha,
    filtroEmpleado,
    filtroMetodoPago,
    reportMode,
  ]);

  // 12. CALCULAR VENTAS PARA LA PÃGINA ACTUAL
  const calcularVentasPaginadas = () => {
    const indiceInicio = (paginaActual - 1) * ventasPorPagina;
    const indiceFin = indiceInicio + ventasPorPagina;
    return ventasFiltradas.slice(indiceInicio, indiceFin);
  };

  // 13. CALCULAR TOTAL DE PÃGINAS
  const totalPaginas = Math.ceil(ventasFiltradas.length / ventasPorPagina);

  // 14. FUNCIÃ“N PARA CAMBIAR DE PÃGINA
  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setPaginaActual(nuevaPagina);
    }
  };

  // 15. FUNCIÃ“N PARA EXPORTAR A EXCEL
  const exportarHistorialExcel = () => {
    if (ventasFiltradas.length === 0) return;

    const datosExportar = ventasFiltradas.map((venta, index) => {
      const nombresProductos = venta.items
        .map((item) => {
          const nombre = item.productName || item.name || "Producto sin nombre";
          const cantidad = item.quantity || 1;
          return cantidad > 1 ? `${nombre} (x${cantidad})` : nombre;
        })
        .join(", ");

      return {
        "NÂ°": index + 1,
        Fecha: formatearFechaHora(venta.createdAt),
        Empleado: venta.employeeName,
        "Método Pago": venta.paymentMethod,
        Productos: nombresProductos || "Sin productos registrados",
        Cantidad: contarProductos(venta.items),
        Total: venta.total,
        "Total Formateado": formatearDinero(venta.total),
        Tipo: venta.isCut
          ? venta.paymentMethod
          : venta.isOrder
            ? "Servicio"
            : "Venta",
      };
    });

    const fechaActual = new Date().toISOString().split("T")[0];
    exportToExcel(
      datosExportar,
      `historial_ventas_${fechaActual}`,
      "Historial de Ventas",
    );
  };

  // 16. EFECTOS
  useEffect(() => {
    cargarVentasYProductos();
  }, []);

  useEffect(() => {
    filtrarVentas();
  }, [
    dateFilter.fechaDesde,
    dateFilter.fechaHasta,
    ventas,
    filtrarVentas,
    filtroEmpleado,
    filtroMetodoPago,
  ]);

  // FUNCIÃ“N PARA REIMPRIMIR TICKET DESDE HISTORIAL
  const handleReprint = async () => {
    if (!ventaSeleccionada || !businessSettings || isPrinting) {
      if (!isPrinting)
        Swal.fire(
          "Error",
          "No se puede imprimir: Falta informaciÃ³n de venta o configuraciÃ³n.",
          "error",
        );
      return;
    }

    setIsPrinting(true);
    try {
      if (ventaSeleccionada.isCut) {
        // LÃ³gica especÃ­fica para reimprimir cortes de caja
        const width = businessSettings?.printer_width || 80;
        const fontSize = businessSettings?.printer_font_size || 12;
        const fontFamily =
          businessSettings?.printer_font_family ||
          "'Courier New', Courier, monospace";
        const fontWeight = businessSettings?.printer_is_bold
          ? "bold"
          : "normal";

        const ticketHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { margin: 0; size: ${width}mm auto; }
        body {
            width: ${width}mm;
            max-width: 100%;
            font-family: ${fontFamily};
            font-size: ${fontSize}px;
            font-weight: ${fontWeight};
            padding: ${businessSettings?.printer_margin || 0}px;
            -webkit-print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="text-center">
        <div class="bold" style="font-size: 1.2em;">${businessSettings?.name || "LAVANDERIA"}</div>
        <div>${ventaSeleccionada.paymentMethod.toUpperCase()}</div>
        <div style="font-size: 0.8em;">ReimpresiÃ³n: ${formatearFechaHora(new Date())}</div>
    </div>
    <hr />
    <div>Fecha Original: ${formatearFechaHora(ventaSeleccionada.createdAt)}</div>
    <div>Operador: ${ventaSeleccionada.employeeName}</div>
    <hr />
    <div>Ventas: ${ventaSeleccionada.salesCount}</div>
    <div>Total Ventas: ${formatearDinero(ventaSeleccionada.total)}</div>
    <hr />
    <div class="bold">ESPERADO: ${formatearDinero(ventaSeleccionada.expectedCash)}</div>
    <div class="bold">CONTADO: ${formatearDinero(ventaSeleccionada.actualCash)}</div>
    <div class="bold">DIFERENCIA: ${formatearDinero(ventaSeleccionada.difference)}</div>
    ${ventaSeleccionada.notes ? `<div>Notas: ${ventaSeleccionada.notes}</div>` : ""}
</body>
</html>`;

        await printService.print(ticketHtml, businessSettings?.printer_name, {
          copies: 1,
          settings: businessSettings,
          ticketData: {
            type: "cashCut",
            cutResult: ventaSeleccionada,
            settings: businessSettings,
          },
        });
      } else {
        // LÃ³gica existente para ventas/servicios
        const itemsParaTicket = ventaSeleccionada.items.map((item) => ({
          quantity: item.quantity,
          name: item.productName || item.name || "Producto",
          price: item.price,
        }));

        const ticketHtml = printService.generateTicketHtml(
          businessSettings,
          { id: ventaSeleccionada.id, total: ventaSeleccionada.total },
          itemsParaTicket,
        );

        await printService.print(ticketHtml, businessSettings.printer_name, {
          copies: 1,
        });
      }

      Swal.fire({
        title: "Â¡Reimpreso!",
        text: "El ticket ha sido enviado a la impresora.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error al reimprimir:", error);
      Swal.fire("Error", "No se pudo conectar con la impresora", "error");
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="historial-page flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark h-full overflow-hidden">
      {/* Header */}
      <header className="p-8 pb-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto w-full flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
              Registro de{" "}
              {reportMode === "SERVICES" ? "Lavandería" : "Ventas Directas"}
            </p>
            <h1 className="text-4xl font-black text-primary dark:text-white tracking-tight">
              {reportMode === "SERVICES"
                ? "Auditoría de Servicios"
                : "Auditoría de Ventas"}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {reportMode === "SERVICES"
                ? "Revisión de órdenes y servicios de lavandería realizados"
                : "Revisión de ventas directas de productos y artículos realizados"}
            </p>
          </div>
          <div className="historial-header-actions flex items-center gap-4">
            {/* TOGGLE DE MODO (Reportes Separados) */}
            <div className="historial-mode-tabs flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => setReportMode("SERVICES")}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${reportMode === "SERVICES" ? "bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white border-none" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <span className="material-icons-outlined text-[16px]">
                  local_laundry_service
                </span>
                Servicios
              </button>
              <button
                onClick={() => setReportMode("PRODUCTS")}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${reportMode === "PRODUCTS" ? "bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white border-none" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <span className="material-icons-outlined text-[16px]">
                  shopping_bag
                </span>
                Ventas Directas
              </button>
              <button
                onClick={() => setReportMode("CASH_CUTS")}
                className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 ${reportMode === "CASH_CUTS" ? "bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white border-none" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <span className="material-icons-outlined text-[16px]">
                  account_balance_wallet
                </span>
                Cierres de Caja
              </button>
            </div>

            <button
              onClick={() => {
                document.documentElement.classList.toggle("dark");
                localStorage.setItem(
                  "theme",
                  document.documentElement.classList.contains("dark")
                    ? "dark"
                    : "light",
                );
                // Re-render workaround for native elements
                window.dispatchEvent(new Event("storage"));
              }}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
            >
              <span className="material-icons-outlined text-[18px]">
                dark_mode
              </span>
              <span>Modo Oscuro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filters Section */}
      <section className="px-8 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto w-full">
          <div className="historial-filters bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex flex-wrap items-end gap-6 shadow-sm">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Desde:
              </label>
              <div className="relative">
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-slate-500 outline-none transition-all text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                  type="date"
                  value={dateFilter.fechaDesde}
                  onChange={(e) => dateFilter.setFechaDesde(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Hasta:
              </label>
              <div className="relative">
                <input
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-slate-500 outline-none transition-all text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]"
                  type="date"
                  value={dateFilter.fechaHasta}
                  onChange={(e) => dateFilter.setFechaHasta(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                {reportMode === "SERVICES" ? "Cliente:" : "Empleado:"}
              </label>
              <div className="relative">
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-slate-500 outline-none transition-all text-slate-900 dark:text-white appearance-none"
                  value={filtroEmpleado}
                  onChange={(e) => setFiltroEmpleado(e.target.value)}
                >
                  {reportMode === "SERVICES" ? (
                    <>
                      <option value="">Todos los clientes</option>
                      {[
                        ...new Set(
                          ventas.map((v) => v.customerName).filter(Boolean),
                        ),
                      ]
                        .sort()
                        .map((nombre) => (
                          <option key={nombre} value={nombre}>
                            {nombre}
                          </option>
                        ))}
                    </>
                  ) : (
                    <>
                      <option value="">Todos los empleados</option>
                      {empleados.map((emp) => (
                        <option key={emp.id} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Método de Pago:
              </label>
              <div className="relative">
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-slate-500 outline-none transition-all text-slate-900 dark:text-white appearance-none"
                  value={filtroMetodoPago}
                  onChange={(e) => setFiltroMetodoPago(e.target.value)}
                >
                  <option value="">Todos los métodos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
            </div>
            <div className="historial-filter-actions flex gap-2">
              {canAccessReports && (
                <button
                  className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                  onClick={exportarHistorialExcel}
                  disabled={ventasFiltradas.length === 0}
                >
                  <span className="material-icons-outlined text-[18px]">
                    table_view
                  </span>
                  Exportar
                </button>
              )}
              <button
                className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                onClick={limpiarFiltros}
                disabled={
                  !dateFilter.hayFiltrosActivos &&
                  !filtroEmpleado &&
                  !filtroMetodoPago
                }
              >
                <span className="material-icons-outlined text-[18px]">
                  filter_alt_off
                </span>
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="historial-results px-8 pb-4 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-1">
          {/* Table Header */}
          <div className="historial-list-header flex-shrink-0 flex justify-between items-center px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
            <div className="flex-1">Fecha y Hora</div>
            <div className="flex-1 text-center">
              {reportMode === "SERVICES" ? "Cliente" : "Empleado"}
            </div>
            <div className="flex-1 text-center">Método Pago</div>
            <div className="flex-1 text-center">
              {reportMode === "CASH_CUTS"
                ? "Estado / Diferencia"
                : reportMode === "SERVICES"
                  ? "Resumen de Orden"
                  : "Resumen de Venta"}
            </div>
            <div className="w-32"></div>
          </div>

          {/* Sales List */}
          {loadingData ? (
            <div className="py-12 text-center text-slate-500 animate-pulse">
              Cargando transacciones...
            </div>
          ) : errorData ? (
            <div className="py-12 text-center text-red-500 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
              {errorData}
            </div>
          ) : ventasFiltradas.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
              <span className="material-icons-outlined text-4xl text-slate-200 mb-2">
                history
              </span>
              <p className="text-slate-400 font-medium">
                No se encontraron{" "}
                {reportMode === "SERVICES" ? "servicios" : "ventas"} en este
                periodo
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto min-h-0 max-h-[65vh] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800 shadow-sm">
              {calcularVentasPaginadas().map((venta) => (
                <div
                  key={venta.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors px-6 py-5 flex items-center group"
                >
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-primary dark:text-white">
                      {formatearFechaHora(venta.createdAt)}
                    </p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
                      {reportMode === "SERVICES"
                        ? venta.customerName
                        : venta.employeeName}
                    </p>
                  </div>
                  <div className="flex-1 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold 
                                            ${
                                              venta.paymentMethod === "efectivo"
                                                ? "bg-green-100 text-green-700"
                                                : venta.paymentMethod ===
                                                    "tarjeta"
                                                  ? "bg-blue-100 text-blue-700"
                                                  : "bg-purple-100 text-purple-700"
                                            }`}
                    >
                      {venta.paymentMethod}
                    </span>
                  </div>
                  <div className="flex-1 text-center">
                    {venta.isCut ? (
                      <p className="text-[14px] font-medium">
                        <span
                          className={
                            venta.difference === 0
                              ? "text-green-500"
                              : "text-red-500"
                          }
                        >
                          {venta.difference === 0
                            ? "✓ Cuadrado"
                            : `Diferencia: ${formatearDinero(venta.difference)}`}
                        </span>
                        <span className="mx-3 text-slate-300 dark:text-slate-700">
                          |
                        </span>
                        <span className="text-primary dark:text-white font-black">
                          {formatearDinero(venta.total)}
                        </span>
                      </p>
                    ) : (
                      <p className="text-[15px] font-medium text-slate-600 dark:text-slate-300">
                        {contarProductos(venta.items)}{" "}
                        {contarProductos(venta.items) === 1
                          ? reportMode === "SERVICES"
                            ? "servicio"
                            : "producto"
                          : reportMode === "SERVICES"
                            ? "servicios"
                            : "productos"}
                        <span className="mx-3 text-slate-300 dark:text-slate-700">
                          |
                        </span>
                        <span className="text-primary dark:text-white font-black">
                          {formatearDinero(venta.total)}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="w-32 flex justify-end gap-2">
                    <button
                      className="bg-primary dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full hover:opacity-80 transition-all transform active:scale-95 shadow-sm"
                      onClick={() => verDetalles(venta)}
                    >
                      Ver Detalles
                    </button>
                    <button
                      className="bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-black p-2 rounded-full transition-all active:scale-95"
                      onClick={() => eliminarVenta(venta.id)}
                      title="Eliminar Reporte"
                    >
                      <span className="material-icons-outlined text-[18px]">
                        delete
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {ventasFiltradas.length > 0 && totalPaginas > 1 && (
            <div className="pt-4 pb-2 flex-shrink-0 flex justify-center">
              <nav className="inline-flex items-center gap-1 bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-20 transition-colors"
                  onClick={() => cambiarPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                >
                  <span className="material-icons-outlined text-[20px]">
                    chevron_left
                  </span>
                </button>

                {[...Array(totalPaginas)].map((_, i) => {
                  const pageNum = i + 1;
                  // Logic to show a limited number of pages if many exist
                  if (totalPaginas > 7) {
                    if (
                      pageNum === 1 ||
                      pageNum === totalPaginas ||
                      (pageNum >= paginaActual - 1 &&
                        pageNum <= paginaActual + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${paginaActual === pageNum ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                          onClick={() => cambiarPagina(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (pageNum === 2 || pageNum === totalPaginas - 1) {
                      return (
                        <span
                          key={pageNum}
                          className="px-1 text-slate-300 font-bold"
                        >
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNum}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${paginaActual === pageNum ? "bg-primary text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
                      onClick={() => cambiarPagina(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 disabled:opacity-20 transition-colors"
                  onClick={() => cambiarPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                >
                  <span className="material-icons-outlined text-[20px]">
                    chevron_right
                  </span>
                </button>
              </nav>
            </div>
          )}
        </div>
      </section>

      {/* Help Button */}
      <button className="fixed bottom-8 right-8 w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-primary dark:hover:text-white transition-all transform hover:scale-110 active:scale-90 group">
        <span className="material-icons-outlined text-[20px] group-hover:rotate-12 transition-transform">
          help_outline
        </span>
      </button>

      {/* Modal de Detalles Estilizado */}
      <Modal
        isOpen={mostrarModal && ventaSeleccionada !== null}
        onClose={cerrarModal}
        raw={true}
        className="w-full max-w-2xl px-4 animate-in"
      >
        <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 dark:border-white/5">
            <div className="flex flex-col">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Detalle de Transacción
              </p>
              <h2 className="text-xl font-black text-primary dark:text-white">
                InformaciÃ³n de Venta
              </h2>
            </div>
            <button
              className="bg-slate-50 dark:bg-white/5 p-2 rounded-full text-slate-400 hover:text-primary dark:hover:text-white transition-colors"
              onClick={cerrarModal}
            >
              <span className="material-icons-outlined">close</span>
            </button>
          </div>

          <div className="p-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Fecha y Hora
                </p>
                <p className="text-sm font-bold text-slate-700 dark:text-white">
                  {ventaSeleccionada &&
                    formatearFechaHora(ventaSeleccionada.createdAt)}
                </p>
              </div>
              <div className="bg-primary dark:bg-white p-4 rounded-xl shadow-lg shadow-black/10 dark:shadow-white/5">
                <p className="text-[9px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Monto Total
                </p>
                <p className="text-xl font-black text-white dark:text-primary">
                  {ventaSeleccionada &&
                    formatearDinero(ventaSeleccionada.total)}
                </p>
              </div>
            </div>

            {/* Products List or Cut Details */}
            {ventaSeleccionada && ventaSeleccionada.isCut ? (
              <div className="flex justify-center bg-white p-6 rounded-xl border border-slate-200 shadow-inner overflow-y-auto max-h-[400px]">
                <TicketCorte
                  cutResult={{
                    ...ventaSeleccionada,
                    staffName: ventaSeleccionada.employeeName,
                    salesTotal: ventaSeleccionada.total,
                    salesCount: ventaSeleccionada.salesCount,
                    opening_fund: ventaSeleccionada.opening_fund,
                    expectedCash: ventaSeleccionada.expectedCash,
                    actualCash: ventaSeleccionada.actualCash,
                    difference: ventaSeleccionada.difference,
                    expectedUSD: ventaSeleccionada.expectedUSD,
                    actualUSD: ventaSeleccionada.actualUSD,
                    differenceUSD: ventaSeleccionada.differenceUSD,
                    notes: ventaSeleccionada.notes,
                    cardTotal: ventaSeleccionada.cardTotal,
                    transferTotal: ventaSeleccionada.transferTotal,
                    terminal_id: ventaSeleccionada.terminal_id,
                  }}
                  settings={businessSettings}
                  cutType={
                    ventaSeleccionada.paymentMethod === "Cierre DÃ­a"
                      ? "dia"
                      : "turno"
                  }
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Productos (
                    {ventaSeleccionada &&
                      contarProductos(ventaSeleccionada.items)}
                    )
                  </h3>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100/50 dark:bg-white/5 border-b border-slate-200/50 dark:border-white/5">
                      <tr>
                        <th className="px-5 py-3">Artículo</th>
                        <th className="px-5 py-3 text-center">Cant.</th>
                        <th className="px-5 py-3 text-right">Precio</th>
                        <th className="px-5 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {ventaSeleccionada &&
                        ventaSeleccionada.items.map((item, index) => (
                          <tr
                            key={index}
                            className="text-slate-700 dark:text-white"
                          >
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold">
                                  {item.productName || item.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  #{item.barcode || "S/N"}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center font-medium capitalize prose-sm">
                              x{item.quantity}
                            </td>
                            <td className="px-5 py-4 text-right font-medium">
                              {formatearDinero(item.price)}
                            </td>
                            <td className="px-5 py-4 text-right font-black">
                              {formatearDinero(item.price * item.quantity)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="px-8 py-6 bg-slate-50 dark:bg-white/5 flex justify-end gap-4">
            <button
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center gap-2 ${isPrinting ? "bg-gray-400 cursor-not-allowed text-gray-200" : "bg-gray-800 text-white hover:bg-gray-700 active:scale-95"}`}
              onClick={handleReprint}
              disabled={isPrinting}
            >
              <span
                className={`material-icons-outlined text-sm ${isPrinting ? "animate-spin" : ""}`}
              >
                {isPrinting ? "sync" : "print"}
              </span>
              {isPrinting ? "IMPRIMIENDO..." : "REIMPRIMIR TICKET"}
            </button>

            <button
              className="bg-primary dark:bg-white text-white dark:text-black px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-lg"
              onClick={cerrarModal}
            >
              Cerrar Detalles
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};


