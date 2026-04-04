import React, { useState } from "react";
import Swal from "sweetalert2";
import { terminalService } from "../../services/terminalService";
import { useAuth } from "../../hooks/useAuth";
import "./TerminalSetup.css";

export const TerminalSetup = ({ onTerminalConfigured, isAdmin }) => {
  const { setAdminMode, verifyMasterPin, masterPinConfigured } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      Swal.fire("Error", "Debes asignar un nombre a esta caja", "warning");
      return;
    }

    setIsSubmitting(true);

    try {
      const terminal = await terminalService.registerTerminal(
        name.trim(),
        location.trim(),
        isMain,
      );

      Swal.fire({
        title: "¡Terminal Configurada!",
        text: `Esta PC ahora está identificada como: ${terminal.name}`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      if (onTerminalConfigured) {
        onTerminalConfigured(terminal);
      }
    } catch (error) {
      console.error("Error configurando terminal:", error);
      Swal.fire(
        "Error",
        "No se pudo registrar la terminal. Intenta de nuevo.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="terminal-setup-overlay">
      <div className="terminal-setup-modal">
        <div className="terminal-setup-header">
          <div className="terminal-icon">🖥️</div>
          <h1>Configuración de Caja</h1>
          <p>Identifica este equipo para comenzar</p>
        </div>

        <form onSubmit={handleSubmit} className="terminal-setup-form">
          <div className="form-group">
            <label>Nombre de la Caja</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: CAJA-01, CAJA-PRINCIPAL"
              autoFocus
              disabled={isSubmitting}
            />
            <span className="input-hint">Debe ser único para cada equipo</span>
          </div>

          <div className="form-group">
            <label>Ubicación (Opcional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: Entrada Principal, Piso 2"
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group checkbox-group">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isMain}
                onChange={(e) => setIsMain(e.target.checked)}
                disabled={isSubmitting}
                className="w-5 h-5 accent-emerald-500"
              />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Esta es la Caja Principal
              </span>
            </label>
            <p className="text-xs text-slate-500 mt-1 ml-7">
              Cualquier equipo puede realizar el cierre de día.
            </p>
          </div>

          <button
            type="submit"
            className="setup-submit-btn"
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Configurando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">save</span>
                Guardar Configuración
              </>
            )}
          </button>

          <div className="setup-info">
            <p>
              ℹ️ Esta configuración se guardará en este dispositivo y es
              necesaria para operar en modo multicajas.
            </p>
          </div>

          {!window.electron && (
            <button
              type="button"
              className="simulate-btn"
              onClick={async () => {
                const result = await Swal.fire({
                  title: 'Modo Simulación',
                  text: '¿Deseas entrar en modo simulación? Se creará una terminal temporal para que puedas probar los perfiles y permisos rápidamente.',
                  icon: 'info',
                  showCancelButton: true,
                  confirmButtonText: 'Sí, simular',
                  cancelButtonText: 'Cancelar',
                  confirmButtonColor: '#3b82f6'
                });

                if (result.isConfirmed) {
                  const randomId = Math.floor(100 + Math.random() * 900);
                  const terminal = await terminalService.registerTerminal(
                    `SIMULACION-WEB-${randomId}`,
                    "Navegador de Pruebas",
                    false
                  );
                  onTerminalConfigured(terminal);
                }
              }}
            >
              <span className="material-symbols-outlined">science</span>
              Omitir y Usar Modo Simulación
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              className="admin-mode-btn"
              onClick={async () => {
                if (!masterPinConfigured) {
                  const result = await Swal.fire({
                    title: "Seguridad",
                    text: "No tienes un PIN Maestro configurado. ¿Deseas entrar de todos modos? Se recomienda configurar uno en el Panel de Administrador para proteger este acceso.",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sí, entrar",
                    cancelButtonText: "Cancelar",
                    confirmButtonColor: "#0f172a",
                  });

                  if (result.isConfirmed) {
                    setAdminMode(true);
                  }
                  return;
                }

                const { value: pin } = await Swal.fire({
                  title: "Verificación de Seguridad",
                  text: "Ingresa el PIN Maestro para continuar en modo administrador:",
                  input: "password",
                  inputPlaceholder: "PIN Maestro...",
                  inputAttributes: {
                    autocapitalize: "off",
                    autocorrect: "off",
                    maxlength: 6,
                  },
                  showCancelButton: true,
                  confirmButtonText: "Verificar",
                  cancelButtonText: "Cancelar",
                  confirmButtonColor: "#0f172a",
                });

                if (pin) {
                  const check = await verifyMasterPin(pin);
                  if (check.success) {
                    setAdminMode(true);
                    Swal.fire({
                      title: "📋 Modo Administrador",
                      text: "Acceso concedido. Podrás gestionar inventarios, reportes y configuración.",
                      icon: "success",
                      timer: 2000,
                      showConfirmButton: false,
                    });
                  } else {
                    Swal.fire("Error", "PIN Maestro incorrecto", "error");
                  }
                }
              }}
              style={{
                marginTop: "16px",
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                color: "#f8fafc",
                border: "none",
                borderRadius: "14px",
                fontSize: "0.95rem",
                fontWeight: "800",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                letterSpacing: "-0.01em",
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(15, 23, 42, 0.3)",
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "20px" }}
              >
                admin_panel_settings
              </span>
              Entrar como Administrador
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
