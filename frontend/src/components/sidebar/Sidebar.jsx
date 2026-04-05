import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useConnectivity } from "../../hooks/useConnectivity";
import { terminalService } from "../../services/terminalService";
import { productService } from "../../services/productService";
import { salesService } from "../../services/salesService";
import { supplyService } from "../../services/supplyService";
import { CashCut } from "../cashcut/CashCut";
import Swal from "sweetalert2";
import { config } from "../../config";
import "./Sidebar.css";
import VisionAIModal from "../ai/VisionAIModal";

export const Sidebar = () => {
  const {
    logout,
    isAdmin,
    activeStaff,
    lockScreen,
    storeName,
    activeRole,
    cashSession,
    adminMode,
    // Nuevos permisos granulares
    canAccessSales,
    canManageOrders,
    canAccessServices,
    canAccessProducts,
    canManageSupplies,
    canManageClients,
    canViewAudit,
    canViewDashboard,
    canAccessSettings,
    canUseIAVision,
    canManageCash,
    canLockTerminal,
    canRestartCash,
    canLogout,
    // Compatibilidad
    canViewSupplies,
    canManageInventory,
  } = useAuth();

  const [showCashCut, setShowCashCut] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [updaterMessage, setUpdaterMessage] = useState("");
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const isOnline = useConnectivity();

  useEffect(() => {
    if (window.electron?.onUpdaterMessage) {
      window.electron.onUpdaterMessage((message) => {
        setUpdaterMessage(message);
        if (message.includes("Error") || message.includes("actualizado")) {
          setTimeout(() => setUpdaterMessage(""), 5000);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!canViewSupplies && !canManageSupplies) return;

    const checkLowStock = async () => {
      try {
        const supplies = await supplyService.getAll();
        const count = supplies.filter(s => parseFloat(s.current_stock || 0) <= parseFloat(s.min_stock || 0)).length;
        setLowStockCount(count);
      } catch (err) {
        console.error("[Sidebar] Error checkLowStock", err);
      }
    };

    checkLowStock();
    const interval = setInterval(checkLowStock, 120000); // Check every 2 minutes
    return () => clearInterval(interval);
  }, [isAdmin, activeRole, canViewSupplies]);

  const handleCheckUpdates = async () => {
    if (!window.electron?.checkForUpdates) return;
    setIsCheckingUpdate(true);
    setUpdaterMessage("Iniciando búsqueda...");
    try {
      await window.electron.checkForUpdates();
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // Determinar el nombre a mostrar
  const displayName = activeStaff?.name || "Usuario";
  const displayRole = activeStaff?.isOwner
    ? "PROPIETARIO"
    : activeRole?.toUpperCase() || "VENDEDOR";

  const toggleSidebar = () => setIsOpen(!isOpen);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle("dark");
    // Persistir preferencia
    const isDark = document.documentElement.classList.contains("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      Swal.fire(
        "Sin Conexión",
        "Por favor conecte el equipo a internet para sincronizar.",
        "warning",
      );
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Sincronizar Inventario (Nube -> Local)
      const invResult = await productService.syncWithLocal();

      // 2. Subir Ventas Pendientes (Local -> Nube)
      const salesResult = await salesService.syncPendingSales();

      Swal.fire({
        title: "Sincronización Exitosa",
        html: `
          <ul style="text-align: left;">
            <li>Inventario: ${invResult.created} nuevos, ${invResult.updated} actualizados.</li>
            <li>Ventas subidas: ${salesResult.count} pendientes procesadas.</li>
          </ul>
        `,
        icon: "success",
      });
    } catch (error) {
      console.error("[Sidebar] Error en sincronización:", error);
      Swal.fire(
        "Error",
        "Ocurrió un fallo durante la sincronización.",
        "error",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-auto min-h-16 pt-[env(safe-area-inset-top)] bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-[2000]">
        <div className="flex items-center h-16 w-full justify-between">
          <button
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
            onClick={toggleSidebar}
          >
            <span className="material-icons-outlined text-[28px] font-bold">
              {isOpen ? "close" : "menu"}
            </span>
          </button>
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-black dark:text-white">
            <span className="bg-primary text-white p-1 rounded shadow-sm">
              <span className="material-icons-outlined block text-[18px]">
                point_of_sale
              </span>
            </span>
            <span className="truncate max-w-[120px] sm:max-w-none">
              {storeName || "POS Store"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors h-12 w-12 flex items-center justify-center"
              onClick={toggleDarkMode}
              title="Cambiar Tema"
            >
              <span className="material-icons-outlined text-[24px]">
                {document.documentElement.classList.contains("dark")
                  ? "light_mode"
                  : "dark_mode"}
              </span>
            </button>
            <button
              className="p-2 text-slate-500 h-12 w-12 flex items-center justify-center"
              onClick={lockScreen}
            >
              <span className="material-icons-outlined text-[24px]">
                account_circle
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <aside
        className={`
                fixed lg:sticky lg:top-0 lg:h-screen inset-y-0 left-0 z-[1002] w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 
                flex flex-col transition-transform duration-300 ease-in-out
                ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 font-bold text-xl tracking-tight text-black dark:text-white">
            <span className="bg-primary text-white p-2 rounded-lg shadow-lg shadow-black/10">
              <span className="material-icons-outlined block text-[24px]">
                point_of_sale
              </span>
            </span>
            <div className="flex flex-col">
              <span className="leading-none">{storeName || "POS Store"}</span>
              <span className="text-[10px] font-bold text-black dark:text-slate-400 uppercase tracking-widest mt-1">
                Premium Retail
              </span>
            </div>
          </div>
        </div>

        {/* User Info (Minimalist) */}
        <div
          className="px-6 py-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group relative"
          onClick={lockScreen}
          title="Bloquear Pantalla / Cambiar Usuario"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-200 font-bold border border-slate-200 dark:border-white/5 uppercase relative group-hover:border-primary transition-colors">
            {displayName.charAt(0)}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="material-icons-outlined text-white text-sm">
                lock
              </span>
            </div>
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-primary dark:text-white truncate group-hover:text-amber-500 transition-colors">
              {displayName}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              {displayRole}
              <span className="bg-slate-100 dark:bg-white/5 px-1 rounded text-[8px] border border-slate-200 dark:border-white/10">
                v{typeof APP_VERSION !== "undefined" ? APP_VERSION : "1.4.43"}
              </span>
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${adminMode ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" : cashSession ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500"}`}
              ></span>
              <span
                className={`text-[9px] font-black uppercase tracking-tighter ${adminMode ? "text-indigo-500" : cashSession ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
              >
                {adminMode
                  ? "MODO ADMIN"
                  : cashSession
                    ? "Caja Abierta"
                    : "Caja Cerrada"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          {canAccessSales && (
            <NavLink
              to="/"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
              end
            >
              <span className="material-icons-outlined text-[20px]">
                shopping_cart
              </span>
              <span className="text-sm font-bold">Ventas</span>
            </NavLink>
          )}

          {canManageOrders && (
            <NavLink
              to="/ordenes"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">
                assignment
              </span>
              <span className="text-sm font-bold">Gestión de Órdenes</span>
            </NavLink>
          )}


          {canAccessServices && (
            <NavLink
              to="/servicios"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">
                local_laundry_service
              </span>
              <span className="text-sm font-bold">Catálogo de Servicios</span>
            </NavLink>
          )}

          {canAccessProducts && (
            <NavLink
              to="/productos"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">
                shopping_bag
              </span>
              <span className="text-sm font-bold">Catálogo de Productos</span>
            </NavLink>
          )}

          {(canManageSupplies || canViewSupplies) && (
            <NavLink
              to="/insumos"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">
                inventory_2
              </span>
              <span className="text-sm font-bold flex-1">Insumos (Interno)</span>
              {(isAdmin || activeRole === "GERENTE") && lowStockCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm shadow-rose-500/30">
                  {lowStockCount}
                </span>
              )}
            </NavLink>
          )}


          {canManageClients && (
            <NavLink
              to="/clientes"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">group</span>
              <span className="text-sm font-bold">Clientes</span>
            </NavLink>
          )}

          {canViewAudit && (
            <NavLink
              to="/historial"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">history</span>
              <span className="text-sm font-bold">Auditoría</span>
            </NavLink>
          )}

          {canViewDashboard && (
            <NavLink
              to="/estadisticas"
              className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                                ${
                                  isActive
                                    ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                                }
                            `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">
                analytics
              </span>
              <span className="text-sm font-bold">Dashboard</span>
            </NavLink>
          )}

          {adminMode && isAdmin && (
            <NavLink
              to="/reportes-caja"
              className={({ isActive }) => `
                              flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                              ${
                                isActive
                                  ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                              }
                          `}
              onClick={() => setIsOpen(false)}
            >
              <span className="material-icons-outlined text-[20px]">
                receipt_long
              </span>
              <span className="text-sm font-bold">Reportes de Caja</span>
              <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[9px] px-1.5 py-0.5 rounded-md font-black tracking-tighter ml-auto">
                WEB
              </span>
            </NavLink>
          )}


          {canAccessSettings && (
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
              <NavLink
                to="/configuracion"
                className={({ isActive }) => `
                                flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200
                                ${
                                  isActive
                                    ? "bg-slate-100 dark:bg-white/10 text-primary dark:text-white shadow-sm"
                                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-primary dark:hover:text-white"
                                }
                            `}
                onClick={() => setIsOpen(false)}
              >
                <span className="material-icons-outlined text-[20px]">
                  settings
                </span>
                <span className="text-sm font-bold">Configuración</span>
              </NavLink>
            </div>
          )}


          {canUseIAVision && (
            <button
              onClick={() => {
                setShowAIModal(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="material-icons-outlined text-[20px]">
                  auto_awesome
                </span>
                <span className="text-sm font-bold">IA Vision</span>
              </div>
              <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] px-1.5 py-0.5 rounded-md font-black tracking-tighter">
                BETA
              </span>
            </button>
          )}


          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            {(canManageCash || isAdmin) && (
              <button
                onClick={() => {
                  setShowCashCut(true);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ${
                  cashSession
                    ? "text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                    : "text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                }`}
              >
                <span className="material-icons-outlined text-[20px]">
                  {cashSession ? "monetization_on" : "lock"}
                </span>
                <span className="text-sm font-bold">
                  {cashSession ? "CAJA" : "ABRIR CAJA"}
                </span>
              </button>
            )}

            {canLockTerminal && (
              <button
                onClick={() => {
                  lockScreen();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-blue-600 dark:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
              >
                <span className="material-icons-outlined text-[20px]">lock</span>
                <span className="text-sm font-bold">Bloquear</span>
              </button>
            )}

            <div className="space-y-1">
              {canRestartCash && (
                <button
                  onClick={async () => {
                    const { value: password } = await Swal.fire({
                      title: "Código de Seguridad",
                      text: "Ingrese el código para reiniciar la caja:",
                      input: "password",
                      inputPlaceholder: "Código...",
                      inputAttributes: {
                        autocapitalize: "off",
                        autocorrect: "off",
                      },
                      showCancelButton: true,
                      confirmButtonText: "Confirmar",
                      cancelButtonText: "Cancelar",
                      confirmButtonColor: "#0f172a",
                    });

                    if (password === "2026SOP") {
                      terminalService.resetLocalTerminal();
                      logout();
                      setIsOpen(false);
                      Swal.fire(
                        "Éxito",
                        "Caja reiniciada correctamente",
                        "success",
                      );
                    } else if (password !== undefined) {
                      Swal.fire("Error", "Código incorrecto", "error");
                    }
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  title="Reiniciar configuración de terminal"
                >
                  <span className="material-icons-outlined text-[20px]">
                    restart_alt
                  </span>
                  <span className="text-sm font-bold">Reiniciar Caja</span>
                </button>
              )}

              {canLogout && (
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-600 dark:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                >
                  <span className="material-icons-outlined text-[20px]">
                    logout
                  </span>
                  <span className="text-sm font-bold">Cerrar Sesión</span>
                </button>
              )}
            </div>

          </div>
        </nav>

        {/* Footer Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20 space-y-2">
          {/* Sync Status & Action */}
          <div
            className={`p-3 rounded-xl border flex flex-col gap-2 transition-all ${
              isOnline
                ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20"
                : "bg-rose-50/50 border-rose-100 dark:bg-rose-500/5 dark:border-rose-500/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
                ></span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  {isOnline ? "En Línea" : "Sin Conexión"}
                </span>
              </div>
              {isOnline && config.isElectron && (
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  className={`text-slate-400 hover:text-primary transition-all ${isSyncing ? "animate-spin" : ""}`}
                  title="Sincronizar Ahora"
                >
                  <span className="material-icons-outlined text-[18px]">
                    sync
                  </span>
                </button>
              )}
            </div>
            {!isOnline && (
              <p className="text-[9px] text-rose-600 dark:text-rose-400 font-medium leading-tight">
                Las ventas se guardarán localmente y se sincronizarán al
                recuperar conexión.
              </p>
            )}
          </div>

          <button
            className={`w-full flex items-center justify-between px-4 py-3 text-xs font-extrabold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all group ${
              isCheckingUpdate
                ? "opacity-50 pointer-events-none"
                : "hover:shadow-md hover:border-emerald-500 hover:scale-[1.02]"
            }`}
            onClick={handleCheckUpdates}
          >
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <span
                className={`material-icons-outlined text-[18px] text-emerald-600 ${isCheckingUpdate ? "animate-spin" : ""}`}
              >
                system_update
              </span>
              <div className="flex flex-col items-start">
                <span
                  className={
                    updaterMessage.includes("Error") ? "text-red-600" : ""
                  }
                >
                  {updaterMessage || "BUSCAR ACTUALIZACIONES"}
                </span>
                {updaterMessage && (
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                    Estado del sistema
                  </span>
                )}
              </div>
            </div>
          </button>

          <button
            className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-primary dark:hover:border-white transition-all group"
            onClick={toggleDarkMode}
          >
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-[18px] group-hover:rotate-12 transition-transform">
                dark_mode
              </span>
              <span>Modo Oscuro</span>
            </div>
            <div className="w-8 h-4 bg-slate-200 dark:bg-slate-700 rounded-full relative transition-colors">
              <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full transition-transform dark:translate-x-4"></div>
            </div>
          </button>
        </div>
      </aside>

      {/* Modal de Corte de Caja */}
      {showCashCut && <CashCut onClose={() => setShowCashCut(false)} />}

      {/* Modal de IA Vision POC */}
      {showAIModal && (
        <VisionAIModal
          isOpen={showAIModal}
          onClose={() => setShowAIModal(false)}
        />
      )}
    </>
  );
};
