import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../supabase";
import { staffService } from "../services/staffService";
import { cashSessionService } from "../services/cashSessionService";

const isAbortError = (error) =>
  error?.name === "AbortError" || error?.message?.includes("aborted");

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Empleado activo (quien está usando la caja)
  const [activeStaff, setActiveStaff] = useState(null);

  // Sistema de sesión de caja (fondo de caja)
  const [cashSession, setCashSession] = useState(null);
  const [needsCashFund, setNeedsCashFund] = useState(false);

  // Modo Admin: permite acceder sin terminal/caja para tareas administrativas
  const [adminMode, setAdminMode] = useState(() => {
    const isDesktop = !!window?.electron?.isElectron;
    // Forzar modo admin en la web siempre
    if (!isDesktop) return true;
    return sessionStorage.getItem("adminMode") === "true";
  });

  // La pantalla está bloqueada si hay sesión pero no hay empleado activo
  const isLocked = !!session && !activeStaff;

  useEffect(() => {
    console.log("[Auth] Inicializando AuthProvider...");

    // Timer de seguridad: si en 6 segundos no hay respuesta, forzar el fin del loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("[Auth] Timeout de seguridad activado. Forzando carga.");
        setLoading(false);
      }
    }, 6000);

    // 1. Get initial session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        console.log(
          "[Auth] Sesión recuperada:",
          session ? "Usuario logueado" : "Sin sesión",
        );
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
          // Intentar restaurar sesión de empleado activa
          const savedStaff = localStorage.getItem("activeStaff");
          if (savedStaff) {
            try {
              const staffData = JSON.parse(savedStaff);
              setActiveStaff(staffData);

              // Refrescar datos desde la BD para asegurar permisos actualizados
              if (staffData.id && !staffData.isOwner) {
                supabase
                  .from("staff")
                  .select("*")
                  .eq("id", staffData.id)
                  .eq("active", true)
                  .single()
                  .then(({ data, error }) => {
                    if (data && !error) {
                      setActiveStaff(data);
                      localStorage.setItem("activeStaff", JSON.stringify(data));
                      console.log(
                        "[Auth] Datos de empleado refrescados desde la BD.",
                      );
                    } else if (error || !data) {
                      console.warn(
                        "[Auth] Empleado inactivo o no encontrado. Cerrando sesión local.",
                      );
                      lockScreen();
                    }
                  });
              }
            } catch (e) {
              localStorage.removeItem("activeStaff");
            }
          }
        } else {
          setLoading(false);
          clearTimeout(timeout);
        }
      })
      .catch((err) => {
        console.error("[Auth] Error crítico en getSession:", err);
        setLoading(false);
        clearTimeout(timeout);
      });

    // 2. Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setActiveStaff(null);
        localStorage.removeItem("activeStaff");
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Error fetching profile:", error);
      }
      setProfile(data || null);

      // Verificar sesión de caja inmediatamente después de obtener el perfil
      await checkCashSession();
    } catch (error) {
      console.error("Error in fetchProfile:", error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar datos del perfil (ej. PIN Maestro)
  const updateProfile = async (updates) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data);
    return data;
  };

  const verifyMasterPin = async (pin) => {
    if (!profile?.master_pin) {
      // Si no hay PIN configurado, permitimos el acceso pero avisamos
      return { success: true, warning: "PIN no configurado" };
    }
    return { success: profile.master_pin === pin };
  };

  const verifyRecoveryCode = async (code) => {
    if (!profile?.recovery_code) return false;
    return profile.recovery_code === code;
  };

  // Login del dueño con email/password
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // Al iniciar sesión, el dueño es el operador activo
    const ownerStaff = { name: "Propietario", role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    localStorage.setItem("activeStaff", JSON.stringify(ownerStaff));

    // Detección de plataforma: Si NO es Electron (.exe), activar modo admin automáticamente
    // Los usuarios web son siempre administradores y no necesitan configurar terminal/caja
    const isDesktop = !!window?.electron?.isElectron;
    if (!isDesktop) {
      console.log(
        "[Auth] Plataforma Web detectada. Activando adminMode automático.",
      );
      setAdminMode(true);
      sessionStorage.setItem("adminMode", "true");
    }

    return data;
  };

  // Registro de nueva tienda
  const signUp = async (
    email,
    password,
    storeName,
    fullName,
    invitationCodeId = null,
  ) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          store_name: storeName,
        },
      },
    });

    if (authError) throw authError;

    if (authData.user) {
      // Ya no insertamos manualmente en 'profiles'.
      // El trigger 'on_auth_user_created' en el servidor se encarga de esto
      // de forma segura y evita errores de RLS durante el registro.

      // Marcar el código de invitación como usado después del registro exitoso
      if (invitationCodeId && authData.user.id) {
        try {
          // Importación dinámica para evitar dependencias circulares
          const invitationService = (
            await import("../services/invitationService")
          ).invitationService;
          await invitationService.markAsUsed(
            invitationCodeId,
            authData.user.id,
          );
        } catch (codeError) {
          console.error(
            "Error marcando código de invitación como usado:",
            codeError,
          );
        }
      }
    }
    // Al registrarse, el dueño es el operador activo
    const ownerStaff = { name: fullName, role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    localStorage.setItem("activeStaff", JSON.stringify(ownerStaff));

    // Detección de plataforma: Si NO es Electron (.exe), activar modo admin automáticamente
    const isDesktop = !!window?.electron?.isElectron;
    if (!isDesktop) {
      console.log(
        "[Auth] Plataforma Web detectada (registro). Activando adminMode automático.",
      );
      setAdminMode(true);
      sessionStorage.setItem("adminMode", "true");
    }

    return authData;
  };

  // Cerrar sesión LOCAL (afecta solo a este dispositivo)
  const logout = async () => {
    // Usamos { scope: 'local' } para que no cierre las sesiones en otros equipos
    // del mismo usuario (propietario).
    await supabase.auth.signOut({ scope: "local" });
    setProfile(null);
    setUser(null);
    setSession(null);
    setActiveStaff(null);
    localStorage.removeItem("activeStaff");
    setCashSession(null);
    setNeedsCashFund(false);
    const isDesktop = !!window?.electron?.isElectron;
    if (isDesktop) {
      setAdminMode(false);
      sessionStorage.removeItem("adminMode");
    }
  };

  // Login de empleado por PIN
  const loginWithPin = async (pin) => {
    try {
      const staff = await staffService.validatePin(pin);
      setActiveStaff(staff);
      localStorage.setItem("activeStaff", JSON.stringify(staff));

      // Asegurar que al entrar un empleado se desactive el modo admin
      const isDesktop = !!window?.electron?.isElectron;
      if (isDesktop) {
        setAdminMode(false);
        sessionStorage.removeItem("adminMode");
      }

      return staff;
    } catch (error) {
      throw new Error("PIN inválido o empleado inactivo");
    }
  };

  // Bloquear pantalla (requiere PIN para continuar)
  const lockScreen = () => {
    setActiveStaff(null);
    localStorage.removeItem("activeStaff");
  };

  // Desbloquear como propietario (sin cerrar sesión de la tienda)
  const unlockAsOwner = () => {
    const ownerStaff = {
      name: profile?.full_name || "Propietario",
      role: "admin",
      isOwner: true,
    };
    setActiveStaff(ownerStaff);
    localStorage.setItem("activeStaff", JSON.stringify(ownerStaff));
  };

  // Verificar si hay sesión de caja activa
  const checkCashSession = async () => {
    try {
      // Primero intentar obtener la sesión del usuario actual
      let session = await cashSessionService.getActiveSession();

      // Si no hay sesión propia, buscar cualquier sesión abierta del negocio
      // (para que empleados que no abrieron la caja puedan operar)
      if (!session) {
        session = await cashSessionService.getGlobalActiveSession();
      }

      if (session) {
        setCashSession(session);
        setNeedsCashFund(false);
        return session;
      }

      setCashSession(null);
      setNeedsCashFund(true);
      return null;
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("Error verificando sesión de caja:", error);
      }
      setNeedsCashFund(true);
      return null;
    }
  };

  // Abrir sesión de caja con fondo inicial
  const openCashSession = async (openingFund) => {
    const staffName = activeStaff?.name || profile?.full_name || "Propietario";
    const staffId = activeStaff?.id || null;

    const session = await cashSessionService.openSession(
      staffName,
      openingFund,
      staffId,
    );
    setCashSession(session);
    setNeedsCashFund(false);
    return session;
  };

  // Cerrar sesión de caja actual
  const closeCashSession = async () => {
    if (!cashSession) return;
    await cashSessionService.closeSession(cashSession.id);
    setCashSession(null);
    setNeedsCashFund(true);
  };

  // Verificar permisos basados en el empleado ACTIVO
  const activeRole = activeStaff?.role || "cajero";
  const canAccessAdmin = activeStaff?.isOwner || activeRole === "admin";

  // Permisos Granulares 2026
  const p = activeStaff?.permissions || {};

  const canAccessSales =
    p.can_access_sales ??
    (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canManageOrders = p.can_manage_orders ?? true;
  const canAccessServices =
    p.can_access_services ?? (canAccessAdmin || activeRole === "gerente");
  const canAccessProducts =
    p.can_access_products ?? (canAccessAdmin || activeRole === "gerente");
  const canManageSupplies =
    p.can_manage_supplies ?? (canAccessAdmin || activeRole === "gerente");
  const canManageClients =
    p.can_manage_clients ??
    (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canViewAudit =
    p.can_view_audit ?? (canAccessAdmin || activeRole === "gerente");
  const canViewDashboard =
    p.can_view_dashboard ?? (canAccessAdmin || activeRole === "gerente");
  const canAccessSettings = p.can_access_settings ?? canAccessAdmin;
  const canUseIAVision =
    p.can_use_ia_vision ??
    (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canManageCash =
    p.can_manage_cash ??
    (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canLockTerminal = p.can_lock_terminal ?? true;
  const canRestartCash = p.can_restart_cash ?? canAccessAdmin;
  const canLogout = p.can_logout ?? true;
  const canViewCashReports =
    p.can_view_cash_reports ?? (canAccessAdmin || activeRole === "gerente");
  const canViewCancellations =
    p.can_view_cancellations ??
    (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");

  // Compatibilidad con código antiguo
  const canAccessReports = canViewDashboard;
  const canManageInventory =
    p.can_manage_inventory ?? (canAccessAdmin || activeRole === "gerente");
  const canViewSupplies = p.can_view_supplies ?? canManageSupplies;
  const canManageStaff = p.can_manage_staff ?? canAccessAdmin;
  const canDeleteOrders = p.can_delete_orders ?? canAccessAdmin;
  const canVoidSales = p.can_void_sales ?? canAccessAdmin;

  const canProcessOrders =
    p.can_process_orders ??
    (canAccessAdmin || activeRole === "gerente" || activeRole === "operador");

  const canDeliverOrders =
    p.can_deliver_orders ??
    (canAccessAdmin ||
      activeRole === "gerente" ||
      activeRole === "repartidor" ||
      activeRole === "cajero");

  // Memoizar el objeto de usuario para evitar cambios de referencia innecesarios
  const memoizedUser = React.useMemo(
    () => (user ? { ...user, ...profile } : null),
    [user, profile],
  );

  // Memoizar el valor del contexto
  const value = React.useMemo(
    () => ({
      // Usuario autenticado de Supabase (dueño de la tienda)
      user: memoizedUser,
      token: session?.access_token,

      // Funciones de auth principales
      login,
      signUp,
      logout,
      loading,

      // PERMISOS basados en el empleado activo
      isAdmin: canManageStaff || canAccessAdmin,
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
      canAccessReports,
      canManageInventory,
      canViewSupplies,
      canManageStaff,
      canDeleteOrders,
      canProcessOrders,
      canDeliverOrders,
      canVoidSales,
      canViewCashReports,
      canViewCancellations,
      activeRole,

      // Sistema de empleados
      activeStaff, // Quien está operando la caja actualmente
      isLocked, // Si la pantalla está bloqueada
      loginWithPin, // Login de empleado por PIN
      lockScreen, // Bloquear pantalla
      unlockAsOwner, // Desbloquear como propietario

      // Seguridad Avanzada 2026
      updateProfile, // Actualizar datos del perfil
      verifyMasterPin, // Validar PIN Maestro
      verifyRecoveryCode, // Validar Código de Recuperación

      // Sistema de sesión de caja (fondo de caja)
      cashSession, // Sesión de caja activa
      needsCashFund, // Si necesita ingresar fondo de caja
      checkCashSession, // Verificar si hay sesión activa
      openCashSession, // Abrir sesión con fondo inicial
      closeCashSession, // Cerrar sesión de caja

      // Modo Admin (sin terminal/caja)
      adminMode, // Si está en modo admin sin caja
      setAdminMode: (value) => {
        const isDesktop = !!window?.electron?.isElectron;
        if (!isDesktop) return; // En web no se puede quitar el modo admin
        
        setAdminMode(value);
        if (value) {
          sessionStorage.setItem("adminMode", "true");
        } else {
          sessionStorage.removeItem("adminMode");
        }
      },

      // Info de la tienda
      storeName: profile?.store_name || user?.user_metadata?.store_name,

      masterPinConfigured: !!profile?.master_pin,
    }),
    [
      memoizedUser,
      session?.access_token,
      loading,
      canAccessAdmin,
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
      canAccessReports,
      canManageInventory,
      canViewSupplies,
      canManageStaff,
      canDeleteOrders,
      canProcessOrders,
      canDeliverOrders,
      canVoidSales,
      canViewCashReports,
      canViewCancellations,
      activeRole,
      activeStaff,
      isLocked,
      cashSession,
      needsCashFund,
      adminMode,
      profile?.store_name,
      profile?.master_pin,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
