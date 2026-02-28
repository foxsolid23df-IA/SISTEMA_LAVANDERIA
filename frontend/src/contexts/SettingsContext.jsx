import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { supabase } from "../supabase";
import { businessSettingsService } from "../services/businessSettingsService";
import { useAuth } from "../hooks/useAuth";

const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      // Solo activamos loadingContext si no tenemos settings (carga inicial)
      // Usamos el estado actual de settings de la clausura
      setLoading((prev) => (!settings && prev === false ? true : prev));

      const data = await businessSettingsService.getSettings();
      setSettings(data);
    } catch (error) {
      console.error("[SettingsContext] Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }, [user]); // settings NO debe ser dependencia para evitar bucles

  useEffect(() => {
    loadSettings();

    if (!user) return;

    // Suscribirse a cambios en tiempo real para business_settings
    const channel = supabase
      .channel(`settings-changes-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "business_settings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log(
            "[SettingsContext] Configuración actualizada en tiempo real:",
            payload,
          );
          if (payload.eventType === "DELETE") {
            setSettings(null);
          } else {
            setSettings(payload.new);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadSettings]);

  const updateSettings = async (newSettings) => {
    try {
      const data = await businessSettingsService.saveSettings(newSettings);
      setSettings(data);
      return data;
    } catch (error) {
      console.error("[SettingsContext] Error saving settings:", error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        reloadSettings: loadSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
