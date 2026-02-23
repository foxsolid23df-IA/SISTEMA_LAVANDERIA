// ===== COMPONENTE HISTORIAL DE VENTAS =====
// Este componente muestra todas las ventas realizadas con filtros y detalles
// Rediseñado con un estilo minimalista y moderno usando Tailwind CSS

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
import { productService } from "../../services/productService";
import { staffService } from "../../services/staffService";
import { printService } from "../../services/printService"; // Importado para reimpresión
import { businessSettingsService } from "../../services/businessSettingsService"; // Importado para configuración
import Modal from "../common/Modal";
import Swal from "sweetalert2";

export const Historial = () => {
  // 1. ESTADOS PRINCIPALES
  const [productos, setProductos] = useState([]); // Lista de productos para mostrar en el modal
  const [ventas, setVentas] = useState([]); // Lista de todas las ventas
  const [ventasFiltradas, setVentasFiltradas] = useState([]); // Ventas después de filtrar

  // Filtros adicionales (Bug 2)
  const [empleados, setEmpleados] = useState([]);
  const [filtroEmpleado, setFiltroEmpleado] = useState("");
  const [filtroMetodoPago, setFiltroMetodoPago] = useState("");

  // 2. ESTADOS PARA PAGINACIÓN
  const [paginaActual, setPaginaActual] = useState(1); // Página actual
  const ventasPorPagina = 8; // Cantidad de ventas por página

  // 3. ESTADOS PARA EL MODAL DE DETALLES
  const [mostrarModal, setMostrarModal] = useState(false); // Si se muestra el modal
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null); // Venta del modal

  // Estado para configuración de negocio (necesario para el ticket)
  const [businessSettings, setBusinessSettings] = useState(null);

  // 4. HOOK PARA FILTRADO POR FECHAS
  const dateFilter = useDateFilter();

  // 5. HOOK PARA MANEJAR LLAMADAS AL BACKEND (Solo para acciones puntuales si se requiere, no para carga inicial)
  const { ejecutarPeticion, limpiarError } = useApi();

  // Estado local de carga para tener control total y evitar bloqueos
  const [loadingData, setLoadingData] = useState(true);
  const [errorData, setErrorData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // 6. HOOK PARA VERIFICAR PERMISOS
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

  // Ref para verificar si el componente está montado
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cargar configuración al montar
  // Cargar empleados al montar para el filtro (Bug 2)
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

  // 7. FUNCIÓN PARA CARGAR TODAS LAS VENTAS DESDE SUPABASE
  const cargarVentasYProductos = async () => {
    // Usar estado local
    setLoadingData(true);
    setErrorData(null);

    try {
      // Timeout de seguridad por si Supabase se cuelga
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tiempo de espera agotado")), 15000),
      );

      const dataPromise = Promise.all([
        salesService.getSales(1000),
        productService.getProducts(),
      ]);

      const resultados = await Promise.race([dataPromise, timeoutPromise]);

      if (!isMountedRef.current) return;

      const [ventasData, productosData] = resultados;

      // Validar que ventasData sea un array
      const ventasSeguras = Array.isArray(ventasData) ? ventasData : [];

      const ventasTransformadas = ventasSeguras.map((venta) => ({
        id: venta.id,
        total: venta.total,
        createdAt: venta.created_at,
        // Mapear nuevos campos (Bug 2)
        employeeName: venta.staff?.name || "Sistema",
        paymentMethod: venta.payment_method || "efectivo",
        items: (venta.sale_items || []).map((item) => ({
          id: item.id,
          productId: item.product_id || null,
          productName: item.product_name || "Producto sin nombre",
          name: item.product_name || "Producto sin nombre",
          barcode: item.barcode || "",
          quantity: item.quantity || 0,
          price: item.price || 0,
          total: item.total || 0,
        })),
      }));

      // Validar que productosData sea un array
      const productosSeguros = Array.isArray(productosData)
        ? productosData
        : [];

      setVentas(ventasTransformadas);
      setVentasFiltradas(ventasTransformadas);
      setProductos(productosSeguros);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error("Error cargando ventas y productos:", error);
      setErrorData(
        "No se pudieron cargar las transacciones. Intenta recargar.",
      );
      setVentas([]);
      setVentasFiltradas([]);
      setProductos([]);
    } finally {
      if (isMountedRef.current) {
        setLoadingData(false);
      }
    }
  };

  // 8. FUNCIÓN PARA LIMPIAR FILTROS
  const limpiarFiltros = () => {
    dateFilter.limpiarFiltros();
    setFiltroEmpleado("");
    setFiltroMetodoPago("");
    setVentasFiltradas(ventas);
  };

  // 9. FUNCIÓN PARA ABRIR EL MODAL DE DETALLES
  const verDetalles = (venta) => {
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

  // 10. FUNCIÓN PARA CERRAR EL MODAL
  const cerrarModal = () => {
    setMostrarModal(false);
    setVentaSeleccionada(null);
  };

  // 10.b FUNCIÓN PARA ELIMINAR VENTA (Solo Admin/Dueño con Contraseña)
  const eliminarVenta = async (saleId) => {
    const { value: password } = await Swal.fire({
      title: "Seguridad de Administrador",
      text: "Para eliminar este reporte, ingresa el código de seguridad:",
      input: "password",
      inputPlaceholder: "Código de Seguridad",
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
          title: "¿Estás completamente seguro?",
          text: "Esta acción no se puede deshacer y el registro se borrará permanentemente de la base de datos.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#d33",
          cancelButtonColor: "#000000",
          confirmButtonText: "Sí, borrar definitivamente",
          cancelButtonText: "No, cancelar",
        });

        if (confirm.isConfirmed) {
          try {
            await salesService.deleteSale(saleId);
            Swal.fire({
              title: "Eliminado",
              text: "El reporte de venta ha sido eliminado exitosamente.",
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
          "PIN de administrador incorrecto. Solo el dueño o administrador puede realizar esta acción.",
          "error",
        );
      }
    }
  };

  // 11. FUNCIÓN PARA FILTRAR LAS VENTAS POR FECHAS
  // 11. FUNCIÓN PARA FILTRAR LAS VENTAS (Fechas + Empleado + Método Pago)
  const filtrarVentas = useCallback(() => {
    let filtradas = dateFilter.filtrarPorFecha(ventas);

    if (filtroEmpleado) {
      filtradas = filtradas.filter((v) => v.employeeName === filtroEmpleado);
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
  ]);

  // 12. CALCULAR VENTAS PARA LA PÁGINA ACTUAL
  const calcularVentasPaginadas = () => {
    const indiceInicio = (paginaActual - 1) * ventasPorPagina;
    const indiceFin = indiceInicio + ventasPorPagina;
    return ventasFiltradas.slice(indiceInicio, indiceFin);
  };

  // 13. CALCULAR TOTAL DE PÁGINAS
  const totalPaginas = Math.ceil(ventasFiltradas.length / ventasPorPagina);

  // 14. FUNCIÓN PARA CAMBIAR DE PÁGINA
  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
      setPaginaActual(nuevaPagina);
    }
  };

  // 15. FUNCIÓN PARA EXPORTAR A EXCEL
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
        "N°": index + 1,
        Fecha: formatearFechaHora(venta.createdAt),
        Empleado: venta.employeeName,
        "Método Pago": venta.paymentMethod,
        Productos: nombresProductos || "Sin productos registrados",
        Cantidad: contarProductos(venta.items),
        Total: venta.total,
        "Total Formateado": formatearDinero(venta.total),
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

  // FUNCIÓN PARA REIMPRIMIR TICKET DESDE HISTORIAL
  const handleReprint = async () => {
    if (!ventaSeleccionada || !businessSettings || isPrinting) {
      if (!isPrinting)
        Swal.fire(
          "Error",
          "No se puede imprimir: Falta información de venta o configuración.",
          "error",
        );
      return;
    }

    setIsPrinting(true);
    try {
      // Preparar datos para el generador de HTML
      const itemsParaTicket = ventaSeleccionada.items.map((item) => ({
        quantity: item.quantity,
        name: item.productName || item.name || "Producto",
        price: item.price,
      }));

      // Generar HTML
      const ticketHtml = printService.generateTicketHtml(
        businessSettings,
        { id: ventaSeleccionada.id, total: ventaSeleccionada.total },
        itemsParaTicket,
      );

      // Imprimir (1 copia para reimpresión)
      const result = await printService.print(
        ticketHtml,
        businessSettings.printer_name,
        { copies: 1 },
      );

      if (result) {
        Swal.fire({
          icon: "success",
          title: "Imprimiendo...",
          showConfirmButton: false,
          timer: 1500,
        });
      } else {
        throw new Error("Error en el servicio de impresión");
      }
    } catch (error) {
      console.error("Error al reimprimir:", error);
      Swal.fire(
        "Error",
        "No se pudo imprimir el ticket. Verifique la impresora.",
        "error",
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark h-full overflow-hidden">
      {/* Header */}
      <header className="p-8 pb-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto w-full flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">
              Registro de Ventas
            </p>
            <h1 className="text-4xl font-black text-primary dark:text-white tracking-tight">
              Auditoría de Historial
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Revisa y gestiona las transacciones realizadas
            </p>
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
      </header>

      {/* Filters Section */}
      <section className="px-8 py-4 flex-shrink-0">
        <div className="max-w-5xl mx-auto w-full">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl flex flex-wrap items-end gap-6 shadow-sm">
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
                Empleado:
              </label>
              <div className="relative">
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:border-slate-500 outline-none transition-all text-slate-900 dark:text-white appearance-none"
                  value={filtroEmpleado}
                  onChange={(e) => setFiltroEmpleado(e.target.value)}
                >
                  <option value="">Todos los empleados</option>
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name}
                    </option>
                  ))}
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
            <div className="flex gap-2">
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
      <section className="px-8 pb-4 flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="max-w-5xl mx-auto w-full h-full flex flex-col space-y-1">
          {/* Table Header */}
          <div className="flex-shrink-0 flex justify-between items-center px-6 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">
            <div className="flex-1">Fecha y Hora</div>
            <div className="flex-1">Empleado</div>
            <div className="flex-1">Método Pago</div>
            <div className="flex-1 text-center">Resumen de Venta</div>
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
                No se encontraron ventas en este periodo
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
                      {venta.employeeName}
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
                    <p className="text-[15px] font-medium text-slate-600 dark:text-slate-300">
                      {contarProductos(venta.items)}{" "}
                      {contarProductos(venta.items) === 1
                        ? "producto"
                        : "productos"}
                      <span className="mx-3 text-slate-300 dark:text-slate-700">
                        |
                      </span>
                      <span className="text-primary dark:text-white font-black">
                        {formatearDinero(venta.total)}
                      </span>
                    </p>
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
                Información de Venta
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

            {/* Products List */}
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
