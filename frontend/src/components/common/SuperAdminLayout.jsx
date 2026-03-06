import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../supabase";
import { ScrollTopButton } from "./ScrollTopButton";

/**
 * Layout exclusivo para el Portal SuperAdmin
 * - No requiere Terminal, ni Caja, ni Múltiples Stores.
 * - Solo verifica sesión de Auth y chequea super_admins.
 */
export const SuperAdminLayout = ({ children }) => {
  const [status, setStatus] = useState({
    loading: true,
    isSuperAdmin: false,
    isAuthenticated: false,
  });
  const location = useLocation();

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setStatus({
            loading: false,
            isAuthenticated: false,
            isSuperAdmin: false,
          });
          return;
        }

        const { data: superAdmin } = await supabase
          .from("super_admins")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();

        if (superAdmin) {
          setStatus({
            loading: false,
            isAuthenticated: true,
            isSuperAdmin: true,
          });
        } else {
          // Si entra un cliente regular a esta ruta, se le bloquea.
          await supabase.auth.signOut();
          setStatus({
            loading: false,
            isAuthenticated: false,
            isSuperAdmin: false,
          });
        }
      } catch (error) {
        console.error("Error validando SuperAdminLayout:", error);
        setStatus({
          loading: false,
          isAuthenticated: false,
          isSuperAdmin: false,
        });
      }
    };

    verifyAccess();
  }, [location.pathname]);

  if (status.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p>Cargando Entorno Administrativo...</p>
        </div>
      </div>
    );
  }

  if (!status.isAuthenticated || !status.isSuperAdmin) {
    return <Navigate to="/portal-maestro" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Cabecera Exclusiva */}
      <header className="bg-slate-900 border-b border-slate-700 shadow-sm text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="material-icons-outlined text-blue-500 mr-2">
                admin_panel_settings
              </span>
              <h1 className="text-xl font-bold tracking-tight">
                Portal Corporativo
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = "/#/portal-maestro";
                }}
                className="text-sm font-medium text-slate-300 hover:text-white flex items-center bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                <span className="material-icons-outlined text-sm mr-1">
                  logout
                </span>
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal Descubierto */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <ScrollTopButton />
    </div>
  );
};
