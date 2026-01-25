import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { terminalService } from "../../services/terminalService";
import { CashCut } from "../cashcut/CashCut";
import "./Sidebar.css";

export const Sidebar = () => {
  const {
    logout,
    isAdmin,
    canAccessReports,
    activeStaff,
    lockScreen,
    storeName,
    activeRole,
  } = useAuth();

  const [showCashCut, setShowCashCut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <>
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-[1001]">
        <button className="p-2 text-slate-500" onClick={toggleSidebar}>
          <span className="material-icons-outlined text-[24px]">
            {isOpen ? "close" : "menu"}
          </span>
        </button>
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-black dark:text-white">
          <span className="bg-primary text-white p-1 rounded">
            <span className="material-icons-outlined block text-[18px]">
              point_of_sale
            </span>
          </span>
          <span>{storeName || "POS Store"}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors"
            onClick={toggleDarkMode}
            title="Cambiar Tema"
          >
            <span className="material-icons-outlined text-[22px]">
              {document.documentElement.classList.contains("dark")
                ? "light_mode"
                : "dark_mode"}
            </span>
          </button>
          <button className="p-2 text-slate-500" onClick={lockScreen}>
            <span className="material-icons-outlined text-[24px]">
              account_circle
            </span>
          </button>
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
        <div className="px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-200 font-bold border border-slate-200 dark:border-white/5 uppercase">
            {displayName.charAt(0)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-primary dark:text-white truncate">
              {displayName}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {displayRole}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
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

          <NavLink
            to="/inventario"
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
            <span className="text-sm font-bold">Inventario</span>
          </NavLink>

          <NavLink
            to="/precios"
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
              price_change
            </span>
            <span className="text-sm font-bold">Ajustar Precios</span>
          </NavLink>

          <NavLink
            to="/proveedores"
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
              local_shipping
            </span>
            <span className="text-sm font-bold">Proveedores</span>
          </NavLink>

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
            <span className="material-icons-outlined text-[20px]">
              group
            </span>
            <span className="text-sm font-bold">Clientes</span>
          </NavLink>

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

          {canAccessReports && (
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

          {isAdmin && (
            <NavLink
              to="/usuarios"
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
              <span className="text-sm font-bold">Usuarios</span>
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/configuracion-ticket"
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
              <span className="text-sm font-bold">Config. Ticket</span>
            </NavLink>
          )}

          <NavLink
            to="/configuracion-dolares"
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
              currency_exchange
            </span>
            <span className="text-sm font-bold">Dólares</span>
          </NavLink>

          <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => {
                setShowCashCut(true);
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-amber-600 dark:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
            >
              <span className="material-icons-outlined text-[20px]">
                monetization_on
              </span>
              <span className="text-sm font-bold">Corte de Caja</span>
            </button>

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

            {isAdmin && (
              <div className="space-y-1">
                <button
                  onClick={() => {
                    if (window.confirm("¿Estás seguro de desvincular esta PC? Deberás configurar la caja de nuevo al iniciar sesión.")) {
                      terminalService.resetLocalTerminal();
                      logout();
                      setIsOpen(false);
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
              </div>
            )}
          </div>
        </nav>

        {/* Footer Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-black/20">
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
    </>
  );
};
