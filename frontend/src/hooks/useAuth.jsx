import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import { staffService } from "../services/staffService";
import { cashSessionService } from "../services/cashSessionService";
import { platform } from "../utils/platform";
import { storage } from "../utils/storage";

const isAbortError = (error) =>
  error?.name === "AbortError" || error?.message?.includes("aborted");

const AuthContext = createContext();

const INITIAL_ADMIN_MODE = (() => {
  if (!platform.isNativePos) return true;
  return sessionStorage.getItem("adminMode") === "true";
})();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStaff, setActiveStaff] = useState(null);
  const [cashSession, setCashSession] = useState(null);
  const [needsCashFund, setNeedsCashFund] = useState(false);
  const [adminMode, setAdminModeState] = useState(INITIAL_ADMIN_MODE);

  const setAdminMode = useCallback((value) => {
    if (!platform.isNativePos && !value) return;
    setAdminModeState(value);
    if (value) {
      sessionStorage.setItem("adminMode", "true");
    } else {
      sessionStorage.removeItem("adminMode");
    }
  }, []);

  const isLocked = !!session && !activeStaff;

  const persistActiveStaff = useCallback(async (staff) => {
    if (staff) {
      await storage.setObject("activeStaff", staff);
    } else {
      await storage.remove("activeStaff");
    }
  }, []);

  const restoreActiveStaff = useCallback(async () => {
    try {
      const savedStaff = await storage.getObject("activeStaff");
      return savedStaff;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
      }
    }, 6000);

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
          const savedStaff = await restoreActiveStaff();
          if (savedStaff) {
            setActiveStaff(savedStaff);
            if (savedStaff.id && !savedStaff.isOwner) {
              supabase
                .from("staff")
                .select("*")
                .eq("id", savedStaff.id)
                .eq("active", true)
                .single()
                .then(({ data, error }) => {
                  if (data && !error) {
                    setActiveStaff(data);
                    persistActiveStaff(data);
                  } else {
                    lockScreen();
                  }
                });
            }
          }
        } else {
          setLoading(false);
          clearTimeout(timeout);
        }
      })
      .catch((err) => {
        setLoading(false);
        clearTimeout(timeout);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setActiveStaff(null);
        persistActiveStaff(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    // Suscribirse a cambios en tiempo real en el perfil del usuario actual
    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          console.log("[Realtime] Perfil actualizado desde DB:", payload.new);
          setProfile(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) console.warn("Error fetching profile:", error);
      setProfile(data || null);
      await checkCashSession();
    } catch (error) {
      console.error("Error in fetchProfile:", error);
    } finally {
      setLoading(false);
    }
  };

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
      return { success: true, warning: "PIN no configurado" };
    }
    return { success: profile.master_pin === pin };
  };

  const verifyRecoveryCode = async (code) => {
    if (!profile?.recovery_code) return false;
    return profile.recovery_code === code;
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    const ownerStaff = { name: "Propietario", role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    await persistActiveStaff(ownerStaff);
    if (!platform.isNativePos) {
      setAdminMode(true);
    }
    return data;
  };

  const signUp = async (email, password, storeName, fullName, invitationCodeId) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, store_name: storeName },
      },
    });
    if (authError) throw authError;
    if (authData.user && invitationCodeId) {
      try {
        const invitationService = (await import("../services/invitationService")).invitationService;
        await invitationService.markAsUsed(invitationCodeId, authData.user.id);
      } catch (codeError) {
        console.error("Error marcando c\u00f3digo de invitaci\u00f3n como usado:", codeError);
      }
    }
    const ownerStaff = { name: fullName, role: "admin", isOwner: true };
    setActiveStaff(ownerStaff);
    await persistActiveStaff(ownerStaff);
    if (!platform.isNativePos) {
      setAdminMode(true);
    }
    return authData;
  };

  const logout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    setProfile(null);
    setUser(null);
    setSession(null);
    setActiveStaff(null);
    await persistActiveStaff(null);
    setCashSession(null);
    setNeedsCashFund(false);
    if (platform.isNativePos) {
      setAdminMode(false);
    }
  };

  const loginWithPin = async (pin) => {
    try {
      const staff = await staffService.validatePin(pin);
      setActiveStaff(staff);
      await persistActiveStaff(staff);
      if (platform.isNativePos) {
        setAdminMode(false);
      }
      return staff;
    } catch (error) {
      throw new Error("PIN inv\u00e1lido o empleado inactivo");
    }
  };

  const lockScreen = useCallback(() => {
    setActiveStaff(null);
    persistActiveStaff(null);
  }, []);

  const unlockAsOwner = () => {
    const ownerStaff = {
      name: profile?.full_name || "Propietario",
      role: "admin",
      isOwner: true,
    };
    setActiveStaff(ownerStaff);
    persistActiveStaff(ownerStaff);
  };

  const checkCashSession = async () => {
    try {
      let session = await cashSessionService.getActiveSession();
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
        console.error("Error verificando sesi\u00f3n de caja:", error);
      }
      setNeedsCashFund(true);
      return null;
    }
  };

  const openCashSession = async (openingFund) => {
    const staffName = activeStaff?.name || profile?.full_name || "Propietario";
    const staffId = activeStaff?.id || null;
    const session = await cashSessionService.openSession(staffName, openingFund, staffId);
    setCashSession(session);
    setNeedsCashFund(false);
    return session;
  };

  const closeCashSession = async () => {
    if (!cashSession) return;
    await cashSessionService.closeSession(cashSession.id);
    setCashSession(null);
    setNeedsCashFund(true);
  };

  const activeRole = activeStaff?.role || "cajero";
  const canAccessAdmin = activeStaff?.isOwner || activeRole === "admin";
  const p = activeStaff?.permissions || {};

  const canAccessSales = p.can_access_sales ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canManageOrders = p.can_manage_orders ?? true;
  const canAccessServices = p.can_access_services ?? (canAccessAdmin || activeRole === "gerente");
  const canAccessProducts = p.can_access_products ?? (canAccessAdmin || activeRole === "gerente");
  const canManageSupplies = p.can_manage_supplies ?? (canAccessAdmin || activeRole === "gerente");
  const canManageClients = p.can_manage_clients ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canViewAudit = p.can_view_audit ?? (canAccessAdmin || activeRole === "gerente");
  const canViewDashboard = p.can_view_dashboard ?? (canAccessAdmin || activeRole === "gerente");
  const canAccessSettings = p.can_access_settings ?? canAccessAdmin;
  const canUseIAVision = p.can_use_ia_vision ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canManageCash = p.can_manage_cash ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canLockTerminal = p.can_lock_terminal ?? true;
  const canRestartCash = p.can_restart_cash ?? canAccessAdmin;
  const canLogout = p.can_logout ?? true;
  const canViewCashReports = p.can_view_cash_reports ?? (canAccessAdmin || activeRole === "gerente");
  const canViewCancellations = p.can_view_cancellations ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canViewPendingAccounts = p.can_view_pending_accounts ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "cajero");
  const canAccessReports = canViewDashboard;
  const canManageInventory = p.can_manage_inventory ?? (canAccessAdmin || activeRole === "gerente");
  const canViewSupplies = p.can_view_supplies ?? canManageSupplies;
  const canManageStaff = p.can_manage_staff ?? canAccessAdmin;
  const canDeleteOrders = p.can_delete_orders ?? canAccessAdmin;
  const canVoidSales = p.can_void_sales ?? canAccessAdmin;
  const canProcessOrders = p.can_process_orders ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "operador");
  const canDeliverOrders = p.can_deliver_orders ?? (canAccessAdmin || activeRole === "gerente" || activeRole === "repartidor" || activeRole === "cajero");
  const canAccessProduccionDiaria = p.can_access_produccion_diaria ?? (canAccessAdmin || activeRole === "gerente");
  const hasDeliveryModule = profile?.delivery_enabled === true;

  const memoizedUser = React.useMemo(
    () => (user ? { ...user, ...profile } : null),
    [user, profile],
  );

  const value = React.useMemo(
    () => ({
      user: memoizedUser,
      token: session?.access_token,
      login,
      signUp,
      logout,
      loading,
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
      canAccessProduccionDiaria,
      canViewPendingAccounts,
      hasDeliveryModule,
      activeRole,
      activeStaff,
      isLocked,
      loginWithPin,
      lockScreen,
      unlockAsOwner,
      updateProfile,
      verifyMasterPin,
      verifyRecoveryCode,
      cashSession,
      needsCashFund,
      checkCashSession,
      openCashSession,
      closeCashSession,
      adminMode,
      setAdminMode,
      storeName: profile?.store_name || user?.user_metadata?.store_name,
      masterPinConfigured: !!profile?.master_pin,
    }),
    [
      memoizedUser, session?.access_token, loading,
      canAccessAdmin, canAccessSales, canManageOrders,
      canAccessServices, canAccessProducts, canManageSupplies,
      canManageClients, canViewAudit, canViewDashboard,
      canAccessSettings, canUseIAVision, canManageCash,
      canLockTerminal, canRestartCash, canLogout,
      canAccessReports, canManageInventory, canViewSupplies,
      canManageStaff, canDeleteOrders, canProcessOrders,
      canDeliverOrders, canVoidSales, canViewCashReports,
      canViewCancellations, canViewPendingAccounts, canAccessProduccionDiaria, hasDeliveryModule, activeRole,
      activeStaff, isLocked, cashSession, needsCashFund,
      adminMode, profile?.store_name, profile?.master_pin,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
