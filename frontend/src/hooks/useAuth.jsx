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
  const [adminMode, setAdminMode] = useState(
    () => sessionStorage.getItem("adminMode") === "true",
  );

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
              setActiveStaff(JSON.parse(savedStaff));
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
        .single();

      if (error) {
        console.warn("Error fetching profile:", error);
      }
      setProfile(data);

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
    setAdminMode(false);
    sessionStorage.removeItem("adminMode");
  };

  // Login de empleado por PIN
  const loginWithPin = async (pin) => {
    try {
      const staff = await staffService.validatePin(pin);
      setActiveStaff(staff);
      localStorage.setItem("activeStaff", JSON.stringify(staff));
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
      const session = await cashSessionService.getActiveSession();
      if (session) {
        setCashSession(session);
        setNeedsCashFund(false);
      } else {
        setCashSession(null);
        setNeedsCashFund(true);
      }
      return session;
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

  // Mapear los nuevos permisos granulares si existen, si no, usar defaults
  const canAccessReports =
    activeStaff?.permissions?.can_see_reports ??
    (canAccessAdmin || activeRole === "gerente");

  const canManageInventory =
    activeStaff?.permissions?.can_manage_inventory ??
    (canAccessAdmin || activeRole === "gerente");

  const canViewSupplies =
    activeStaff?.permissions?.can_view_supplies ?? false;

  const canManageStaff =
    activeStaff?.permissions?.can_manage_staff ?? canAccessAdmin;

  const canDeleteOrders =
    activeStaff?.permissions?.can_delete_orders ?? canAccessAdmin;

  const canProcessOrders =
    activeStaff?.permissions?.can_process_orders ??
    (canAccessAdmin || activeRole === "gerente" || activeRole === "operador");

  const canDeliverOrders =
    activeStaff?.permissions?.can_deliver_orders ??
    (canAccessAdmin ||
      activeRole === "gerente" ||
      activeRole === "repartidor" ||
      activeRole === "cajero");

  const canVoidSales =
    activeStaff?.permissions?.can_void_sales ?? canAccessAdmin;

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
      isAdmin: canManageStaff || canAccessAdmin, // Permitimos que isAdmin se base en canManageStaff temporalmente para retrocompatibilidad
      canAccessReports,
      canManageInventory,
      canViewSupplies,
      canManageStaff,
      canDeleteOrders,
      canProcessOrders,
      canDeliverOrders,
      canVoidSales,
      activeRole, // Rol del empleado actual

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
      canAccessReports,
      canManageInventory,
      canViewSupplies,
      canManageStaff,
      canDeleteOrders,
      canProcessOrders,
      canDeliverOrders,
      canVoidSales,
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
