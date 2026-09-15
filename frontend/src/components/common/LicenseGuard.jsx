import React, { useEffect, useState } from "react";
import { licenseService } from "../../services/licenseService";

const MAX_RETRIES = 5;

/**
 * Componente para bloquear la app si la licencia no es válida.
 * Incluye reintentos con backoff exponencial para tolerar
 * lentitud en Supabase o en el backend local al arrancar.
 */
export const LicenseGuard = ({ children }) => {
  const [status, setStatus] = useState({
    loading: true,
    isValid: true,
    message: "",
    retryAttempt: 0,
  });

  useEffect(() => {
    let cancelled = false;

    const attempt = async (retryNumber = 1) => {
      if (cancelled) return;

      if (navigator.onLine) {
        await licenseService.syncLicenseWithLocal();
      }

      const result = await licenseService.checkLicense();

      if (cancelled) return;

      if (result.isValid) {
        setStatus({
          loading: false,
          isValid: true,
          message: result.message,
          expiresAt: result.expiresAt,
          retryAttempt: 0,
        });
        return;
      }

      if (retryNumber < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, retryNumber - 1), 16000);
        setStatus({
          loading: true,
          isValid: false,
          message: result.message,
          expiresAt: result.expiresAt,
          retryAttempt: retryNumber,
        });
        setTimeout(() => attempt(retryNumber + 1), delay);
        return;
      }

      setStatus({
        loading: false,
        isValid: false,
        message: result.message,
        expiresAt: result.expiresAt,
        retryAttempt: 0,
      });
    };

    attempt();

    return () => {
      cancelled = true;
    };
  }, []);

  if (status.loading) {
    return (
      <div className="loading-screen">
        <div className="flex flex-col items-center gap-2">
          <div className="spinner" />
          <p className="text-white text-lg font-medium">Validando Licencia...</p>
          {status.retryAttempt > 0 && (
            <p className="text-slate-400 text-sm">
              Intento {status.retryAttempt} de {MAX_RETRIES}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!status.isValid) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6 text-center">
        <div className="bg-rose-500/10 border border-rose-500/20 p-8 rounded-2xl max-w-md">
          <span className="material-icons-outlined text-rose-500 text-6xl mb-4">
            gpp_maybe
          </span>
          <h1 className="text-2xl font-bold mb-2">Licencia Requerida</h1>
          <p className="text-slate-400 mb-6">
            {status.message ||
              "Su periodo de licencia ha expirado o no se puede validar."}
          </p>
          <div className="bg-black/20 p-4 rounded-xl text-sm mb-6">
            <p>
              Para reactivar el sistema, por favor contacte a soporte técnico o
              conecte el equipo a internet para renovar automáticamente.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Reintentar Validación
          </button>
          {status.expiresAt && (
            <p className="mt-4 text-[10px] text-slate-500 uppercase tracking-widest">
              Vencimiento registrado:{" "}
              {new Date(status.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    );
  }

  return children;
};
