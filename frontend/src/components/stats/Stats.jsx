// ===== COMPONENTE ESTADÍSTICAS - DASHBOARD PREMIUM =====
import { useState, useEffect } from "react";
import { useDateFilter } from "../../hooks/useDateFilter";
import { useAuth } from "../../hooks/useAuth";
import { formatearDinero } from "../../utils";
import { exportMultipleSheets } from "../../utils/exportToExcel";
import { salesService } from "../../services/salesService";
import { orderService } from "../../services/orderService";
import { productService } from "../../services/productService";
import DateFilter from "../common/DateFilter";
import "../common/DateFilter.css";
import "./Stats.css";

export const Stats = () => {
  // TEMA
  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.classList.contains("dark")
  );

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("lavanderia_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("lavanderia_theme", "light");
    }
  };

  useEffect(() => {
    // Escuchar cambios externos en el tema (ej: desde Sidebar)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          setIsDarkMode(document.documentElement.classList.contains("dark"));
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  // MODO DE REPORTE (A solicitud del usuario: Reportes Separados)
  const [reportMode, setReportMode] = useState("SERVICES"); // 'SERVICES' (Laundry) o 'PRODUCTS' (Sales)

  // ESTADOS
  const [estadisticasRango, setEstadisticasRango] = useState(null);
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [ventasSemana, setVentasSemana] = useState([]);

  // MODAL PERSONALIZADO
  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // HOOK PARA FILTRADO POR FECHAS
  const dateFilter = useDateFilter({
    onValidationError: (error) => {
      mostrarModal(error.titulo, error.mensaje, error.tipo);
    },
    allowFutureDates: false,
  });

  // HOOKS
  const [estadisticas, setEstadisticas] = useState(null);
  const [cargandoStats, setCargandoStats] = useState(true);
  const [errorStats, setErrorStats] = useState("");
  const [topProductos, setTopProductos] = useState(null);
  const [productosPocoStock, setProductosPocoStock] = useState(null);
  const { canAccessReports } = useAuth();

  // Obtener día actual de la semana (0 = Domingo, 1 = Lunes, etc.)
  const diaActual = new Date().getDay();
  const diasSemana = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  // Reordenar para que empiece en Lunes
  const diasOrdenados = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
  const indiceDiaActual = diaActual === 0 ? 6 : diaActual - 1;

  // EFECTOS
  useEffect(() => {
    let isMounted = true;

    const cargarDatosActuales = async () => {
      try {
        setCargandoStats(true);
        setErrorStats("");
        setEstadisticas(null);
        setTopProductos(null);
        setEstadisticasRango(null);

        // Cargar estadísticas según el modo de reporte
        let statsData, topData, weeklyData;

        if (reportMode === "SERVICES") {
          // MODO LAVANDERÍA (TABLA ORDERS)
          statsData = await orderService.getStatistics();
          topData = await orderService.getTopServices(5);
          weeklyData = await orderService.getWeeklyOrdersData();
        } else {
          // MODO PRODUCTOS (TABLA SALES)
          statsData = await salesService.getStatistics();
          topData = await salesService.getTopProducts(5);
          weeklyData = await salesService.getWeeklySalesData();
        }

        if (isMounted) {
          setEstadisticas(statsData);
          setTopProductos(topData);
          setVentasSemana(weeklyData || []);
        }

        // Cargar productos con poco stock siempre (es global)
        if (isMounted && !productosPocoStock) {
          try {
            const pocoStockData = await productService.getLowStockProducts(10);
            setProductosPocoStock(pocoStockData);
          } catch (error) {
            console.error("Error cargando productos con poco stock:", error);
          }
        }
      } catch (error) {
        console.error("Error cargando estadísticas:", error);
        if (isMounted) {
          setErrorStats(
            "No se pudieron cargar las estadísticas. Por favor, recarga la página.",
          );
          mostrarModal(
            "Error al cargar datos",
            "No se pudieron cargar las estadísticas. Verifica tu conexión.",
            "error",
          );
        }
      } finally {
        if (isMounted) {
          setCargandoStats(false);
        }
      }
    };

    cargarDatosActuales();

    return () => {
      isMounted = false;
    };
  }, [reportMode]); // Se recarga cuando cambia el modo de reporte

  // Efecto para mostrar error del hook useApi si ocurre

  useEffect(() => {
    if (errorStats) {
      mostrarModal("Aviso", errorStats, "warning");
    }
  }, [errorStats]);

  // FUNCIÓN PARA MOSTRAR MODAL
  const mostrarModal = (title, message, type = "info") => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  // FUNCIÓN PARA CERRAR MODAL
  const cerrarModal = () => {
    setModal({
      isOpen: false,
      title: "",
      message: "",
      type: "info",
    });
  };


  // FUNCIÓN PARA ANALIZAR PERIODO (COMO EN HISTORIAL)
  const analizarPeriodo = async () => {
    setCargandoAnalisis(true);
    try {
      const fechasAPI = dateFilter.prepararFechasParaAPI();

      if (!fechasAPI) {
        setCargandoAnalisis(false);
        return;
      }

      if (!dateFilter.hayFiltrosActivos) {
        setEstadisticasRango(null);
        setCargandoAnalisis(false);
        return;
      }

      const service = reportMode === "SERVICES" ? orderService : salesService;

      if (fechasAPI.valido) {
        const datos = await service.getStatisticsByDateRange(
          fechasAPI.fechaDesde,
          fechasAPI.fechaHasta,
        );
        setEstadisticasRango(datos);
      } else if (fechasAPI.fechaHasta) {
        const datos = await service.getStatisticsByDateRange(
          undefined,
          fechasAPI.fechaHasta,
        );
        setEstadisticasRango(datos);
      } else {
        setEstadisticasRango(null);
      }
    } catch {
      mostrarModal(
        "Error al analizar período",
        "No se pudieron obtener las estadísticas del período seleccionado. Por favor, intenta nuevamente.",
        "error",
      );
      setEstadisticasRango(null);
    } finally {
      setCargandoAnalisis(false);
    }
  };

  // FUNCIÓN PARA LIMPIAR FILTROS
  const limpiarFiltros = () => {
    dateFilter.limpiarFiltros();
    setEstadisticasRango(null);
  };

  // FUNCIÓN PARA EXPORTAR ESTADÍSTICAS A EXCEL
  const exportarEstadisticasExcel = () => {
    if (!estadisticas) {
      alert("No hay estadísticas para exportar");
      return;
    }

    const fechaActual = new Date().toISOString().split("T")[0];

    // Preparar hojas de datos
    const sheets = [];

    // Hoja 1: Estadísticas Generales
    sheets.push({
      name: "Estadísticas Generales",
      data: [
        {
          Período: "Hoy",
          Ingresos: estadisticas.ingresosDeHoy || 0,
          "Ingresos Formateado": formatearDinero(
            estadisticas.ingresosDeHoy || 0,
          ),
          Ventas: estadisticas.ventasDeHoy || 0,
        },
        {
          Período: "Esta Semana",
          Ingresos: estadisticas.ingresosSemana || 0,
          "Ingresos Formateado": formatearDinero(
            estadisticas.ingresosSemana || 0,
          ),
          Ventas: estadisticas.ventasSemana || 0,
        },
        {
          Período: "Este Mes",
          Ingresos: estadisticas.ingresosMes || 0,
          "Ingresos Formateado": formatearDinero(estadisticas.ingresosMes || 0),
          "Crecimiento (%)": estadisticas.crecimiento || 0,
        },
        {
          Período: "Total",
          Ingresos: estadisticas.ingresosTotales || 0,
          "Ingresos Formateado": formatearDinero(
            estadisticas.ingresosTotales || 0,
          ),
          Ventas: estadisticas.ventasTotales || 0,
        },
      ],
    });

    // Hoja 2: Top Productos
    if (topProductos && topProductos.length > 0) {
      sheets.push({
        name: "Top Productos",
        data: topProductos.map((prod, index) => ({
          Ranking: index + 1,
          "Producto/Artículo": prod.name,
          "Cantidad Vendida": prod.cantidadVendida,
          Ingresos: prod.ingresos,
          "Ingresos Formateado": formatearDinero(prod.ingresos || 0),
        })),
      });
    }

    // Hoja 3: Productos con Poco Stock
    if (productosPocoStock && productosPocoStock.length > 0) {
      sheets.push({
        name: "Productos Poco Stock",
        data: productosPocoStock.map((prod) => ({
          "Producto/Artículo": prod.name,
          "Stock Actual": prod.stock,
          Precio: prod.price,
          "Precio Formateado": formatearDinero(prod.price || 0),
        })),
      });
    }

    // Hoja 4: Estadísticas por Rango (si hay filtro activo)
    if (estadisticasRango) {
      sheets.push({
        name: "Estadísticas Rango",
        data: [
          {
            "Fecha Inicio": estadisticasRango.fechaInicio,
            "Fecha Fin": estadisticasRango.fechaFin,
            "Ventas en Rango": estadisticasRango.ventasEnRango,
            "Ingresos en Rango": estadisticasRango.ingresosEnRango,
          },
        ],
      });
    }

    const nombreArchivo = `estadisticas_${fechaActual}`;
    exportMultipleSheets(sheets, nombreArchivo);
  };

  // Calcular alturas para el gráfico de barras
  const calcularAlturaBarra = (valor, maxValor) => {
    if (!maxValor || maxValor === 0) return "10%";
    const porcentaje = (valor / maxValor) * 100;
    return `${Math.max(porcentaje, 5)}%`;
  };

  // Valor máximo para escala del gráfico
  const maxVentaSemana = Math.max(
    ...(ventasSemana.length > 0 ? ventasSemana : [500]),
    1,
  );

  // Calcular porcentaje de progreso para productos
  const calcularPorcentaje = (index) => {
    const porcentajes = [85, 65, 55, 50, 30];
    return porcentajes[index] || 20;
  };

  if (cargandoStats) {
    return <div className="loading">Cargando estadísticas...</div>;
  }

  return (
    <div className="stats-view bg-white dark:bg-slate-950 transition-colors duration-300">
      {/* HEADER */}
      <header className="stats-header">
        <div className="header-title-section">
          <div>
            <div className="header-badge">Inteligencia de Negocio</div>
            <h2>Análisis de Rendimiento</h2>
            <p>Visualiza el crecimiento y tendencias de tu empresa</p>
          </div>
          <div className="header-buttons">
            {/* TOGGLE DE MODO (Reportes Separados) */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mr-4 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setReportMode("SERVICES")}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${reportMode === "SERVICES" ? "bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <span className="material-icons-outlined text-[16px]">
                  local_laundry_service
                </span>
                Lavandería
              </button>
              <button
                onClick={() => setReportMode("PRODUCTS")}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${reportMode === "PRODUCTS" ? "bg-white dark:bg-slate-700 shadow-md text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
              >
                <span className="material-icons-outlined text-[16px]">
                  shopping_bag
                </span>
                Productos
              </button>
            </div>

            <button onClick={toggleDarkMode} className="btn-dark-mode">
              <span className="material-icons-outlined">
                {isDarkMode ? "light_mode" : "dark_mode"}
              </span>
              <span>{isDarkMode ? "Modo Claro" : "Modo Oscuro"}</span>
            </button>
            {canAccessReports && (
              <button
                onClick={exportarEstadisticasExcel}
                className="btn-exportar-header"
                disabled={!estadisticas}
                title="Exportar estadísticas a Excel"
              >
                <span className="material-icons-outlined">file_download</span>
                <span>Exportar Excel</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="stats-content">
        {/* ESTADÍSTICAS PRINCIPALES */}
        <div className="stats-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <div className="stat-content">
              <h3>{reportMode === "SERVICES" ? "Órdenes Hoy" : "Hoy"}</h3>
              <div className="stat-value">
                {formatearDinero(estadisticas?.ingresosDeHoy || 0)}
              </div>
              <div className="stat-detail">
                {reportMode === "SERVICES"
                  ? `${estadisticas?.ordenesDeHoy || 0} ${estadisticas?.ordenesDeHoy === 1 ? "orden" : "órdenes"}`
                  : `${estadisticas?.ventasDeHoy || 0} ${estadisticas?.ventasDeHoy === 1 ? "venta" : "ventas"}`}
              </div>
            </div>
          </div>

          <div className="stat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <div className="stat-content">
              <h3>
                {reportMode === "SERVICES" ? "Semana (Órdenes)" : "Esta Semana"}
              </h3>
              <div className="stat-value">
                {formatearDinero(estadisticas?.ingresosSemana || 0)}
              </div>
              <div className="stat-detail">
                {reportMode === "SERVICES"
                  ? `${estadisticas?.ordenesSemana || 0} órdenes`
                  : `${estadisticas?.ventasSemana || 0} ventas`}
              </div>
            </div>
          </div>

          <div className="stat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <div className="stat-content">
              <h3>{reportMode === "SERVICES" ? "Ingresos Mes" : "Este Mes"}</h3>
              <div className="stat-value">
                {formatearDinero(estadisticas?.ingresosMes || 0)}
              </div>
              <div className="stat-detail">
                {estadisticas?.crecimiento !== undefined &&
                  estadisticas.crecimiento !== 0 && (
                    <span className="stat-growth">
                      <span className="material-icons-outlined">
                        trending_up
                      </span>
                      {estadisticas.crecimiento > 0 ? "+" : ""}
                      {Math.abs(estadisticas.crecimiento || 0)}% vs mes anterior
                    </span>
                  )}
              </div>
            </div>
          </div>

          <div className="stat-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
            <div className="stat-content">
              <h3>{reportMode === "SERVICES" ? "Total Histórico" : "Total"}</h3>
              <div className="stat-value">
                {formatearDinero(estadisticas?.ingresosTotales || 0)}
              </div>
              <div className="stat-detail">
                {reportMode === "SERVICES"
                  ? `${estadisticas?.ordenesTotales?.toLocaleString() || 0} órdenes totales`
                  : `${estadisticas?.ventasTotales?.toLocaleString() || 0} ventas totales`}
              </div>
            </div>
          </div>
        </div>

        {/* GRÁFICO Y TOP PRODUCTOS */}
        <div className="content-columns">
          {/* GRÁFICO DE VENTAS DE LA SEMANA */}
          <div className="column">
            <div className="section-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm">
              <div className="section-header">
                <h2>
                  {reportMode === "SERVICES"
                    ? "Flujo de Órdenes"
                    : "Ventas de la Semana"}
                </h2>
                <span className="section-subtitle">Últimos 7 días</span>
              </div>
              <div className="chart-wrapper">
                <div className="chart-y-axis">
                  <span>$500</span>
                  <span>$400</span>
                  <span>$300</span>
                  <span>$200</span>
                  <span>$100</span>
                  <span>$0</span>
                </div>
                <div className="chart-main">
                  <div className="bar-chart-container">
                    {diasOrdenados.map((dia, index) => {
                      const valor = ventasSemana[index] || 0;
                      const esHoy = index === indiceDiaActual;
                      return (
                        <div key={dia} className="chart-bar-wrapper">
                          <div
                            className={`chart-bar ${esHoy ? "active" : ""}`}
                            style={{
                              height: `${(valor / (Math.max(...ventasSemana, 1) * 1.2)) * 100}%`,
                            }}
                            title={`${dia}: ${formatearDinero(valor)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-x-axis">
                    {diasOrdenados.map((dia, index) => (
                      <span
                        key={dia}
                        className={index === indiceDiaActual ? "active" : ""}
                      >
                        {dia}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TOP 5 PRODUCTOS/SERVICIOS */}
          <div className="column">
            <div className="section-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm">
              <div className="section-header">
                <h2>
                  {reportMode === "SERVICES"
                    ? "Top 5 Servicios"
                    : "Top 5 Productos"}
                </h2>
                <span className="material-icons-outlined section-icon">
                  workspace_premium
                </span>
              </div>
              <div className="products-list">
                {topProductos?.length > 0 ? (
                  topProductos.map((producto, index) => (
                    <div key={producto.id} className="product-item">
                      <div className="product-header">
                        <div className="product-info">
                          <h4>{producto.name}</h4>
                          <span>
                            {producto.cantidadVendida || producto.cantidad}{" "}
                            {reportMode === "SERVICES"
                              ? "veces solicitado"
                              : "unidades vendidas"}
                          </span>
                        </div>
                        <span className="product-price">
                          {formatearDinero(producto.ingresos)}
                        </span>
                      </div>
                      <div className="product-progress">
                        <div
                          className={`product-progress-bar ${index === 0 ? "primary" : "secondary"}`}
                          style={{ width: `${calcularPorcentaje(index)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data">
                    {reportMode === "SERVICES"
                      ? "No hay datos de servicios solicitados"
                      : "No hay datos de productos vendidos"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* FILTRO POR FECHAS (Estilo Auditoría de Historial) */}
        <div className="max-w-full mx-auto w-full mb-10">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl flex flex-wrap items-end gap-6 shadow-sm">
            <div className="flex-1 min-w-[400px]">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1">
                Análisis por Período
              </p>
              <DateFilter
                fechaDesde={dateFilter.fechaDesde}
                fechaHasta={dateFilter.fechaHasta}
                onFechaDesdeChange={dateFilter.setFechaDesde}
                onFechaHastaChange={dateFilter.setFechaHasta}
                onBuscar={analizarPeriodo}
                onLimpiar={limpiarFiltros}
                showButtons={false}
                className="stats-date-filter"
              />
            </div>

            <div className="flex flex-wrap gap-2 mb-[2px]">
              {canAccessReports && (
                <button
                  onClick={exportarEstadisticasExcel}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  disabled={!estadisticas}
                  title="Exportar estadísticas a Excel"
                >
                  <span className="material-icons-outlined text-[18px]">
                    table_view
                  </span>
                  Exportar Excel
                </button>
              )}
              <button
                onClick={analizarPeriodo}
                className="px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold rounded-xl hover:opacity-90 transition-all flex items-center gap-2 shadow-lg"
                disabled={cargandoAnalisis}
              >
                {cargandoAnalisis ? (
                  <>
                    <span className="material-icons-outlined animate-spin text-[18px]">
                      sync
                    </span>
                    Analizando...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-[18px]">
                      search
                    </span>
                    Buscar
                  </>
                )}
              </button>
              <button
                onClick={limpiarFiltros}
                className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2"
                disabled={cargandoAnalisis}
              >
                <span className="material-icons-outlined text-[18px]">
                  filter_alt_off
                </span>
                Limpiar
              </button>
            </div>
          </div>

          {estadisticasRango && (
            <div className="range-results">
              <div className="range-card">
                <h4>
                  Resultados
                  {dateFilter.textoRango
                    ? ` ${dateFilter.textoRango}`
                    : " del período seleccionado"}
                </h4>
                <div className="range-stats">
                  <div className="range-stat">
                    <span className="label">Total ventas:</span>
                    <span className="value">
                      {estadisticasRango.ventasEnRango}
                    </span>
                  </div>
                  <div className="range-stat">
                    <span className="label">Ingresos:</span>
                    <span className="value">
                      {formatearDinero(estadisticasRango.ingresosEnRango)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PRODUCTOS CON POCO STOCK */}
        <div className="section-card">
          <div className="section-header">
            <h2>Productos con Poco Stock</h2>
            <span className="material-icons-outlined section-icon">
              warning
            </span>
          </div>
          <div className="low-stock-list">
            {productosPocoStock?.length > 0 ? (
              productosPocoStock.map((producto) => {
                let colorClass = "";
                if (producto.stock === 0 || producto.stock === 1)
                  colorClass = "no-stock";
                else if (producto.stock === 2 || producto.stock === 3)
                  colorClass = "orange-stock";
                else if (producto.stock === 4 || producto.stock === 5)
                  colorClass = "yellow-stock";
                else colorClass = "low";
                return (
                  <div key={producto.id} className={`stock-item ${colorClass}`}>
                    <div className="stock-info">
                      <h4>{producto.name}</h4>
                      <div className="stock-level">
                        <span className="stock-label">
                          {producto.stock === 0
                            ? "Sin stock disponible"
                            : producto.stock === 1
                              ? "1 unidad disponible"
                              : `${producto.stock} unidades disponibles`}
                        </span>
                      </div>
                    </div>
                    <div className="stock-price">
                      {formatearDinero(producto.price)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="no-data">
                Todos los productos tienen stock suficiente
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL PERSONALIZADO PARA ERRORES */}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div
            className={`modal-content modal-${modal.type}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>{modal.title}</h3>
              <button className="modal-close" onClick={cerrarModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>{modal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-ok" onClick={cerrarModal}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
