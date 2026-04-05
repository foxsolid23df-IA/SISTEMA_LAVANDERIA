import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { terminalService } from "../../services/terminalService";
import { useAuth } from "../../hooks/useAuth";
import "./TerminalSetup.css";

export const TerminalSetup = ({ onTerminalConfigured, isAdmin }) => {
  const { setAdminMode, verifyMasterPin, masterPinConfigured } = useAuth();
  
  // Estados para el formulario de registro
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isMain, setIsMain] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para la lista de terminales existentes
  const [existingTerminals, setExistingTerminals] = useState([]);
  const [loadingTerminals, setLoadingTerminals] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const fetchTerminals = async () => {
      try {
        const terminals = await terminalService.getTerminals();
        setExistingTerminals(terminals);
        // Si no hay terminales, mostrar el formulario directamente
        if (terminals.length === 0) {
          setShowForm(true);
        }
      } catch (err) {
        console.error("Error fetching terminals:", err);
      } finally {
        setLoadingTerminals(false);
      }
    };
    fetchTerminals();
  }, []);

  const handleSelectTerminal = async (terminal) => {
    const result = await Swal.fire({
      title: "¿Vincular este equipo?",
      text: `¿Estás seguro de que este equipo es la terminal "${terminal.name}"? Los datos de sesión se sincronizarán.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, vincular",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#10b981",
    });

    if (result.isConfirmed) {
      terminalService.setTerminalId(terminal.id);
      localStorage.setItem("pos_terminal_name", terminal.name);

      Swal.fire({
        title: "¡Terminal Vinculada!",
        text: `Este equipo ahora opera como: ${terminal.name}`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });

      if (onTerminalConfigured) onTerminalConfigured(terminal);
    }
  };

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
          <p>
            {showForm
              ? "Registra este equipo para comenzar"
              : "Selecciona una caja existente o registra una nueva"}
          </p>
        </div>

        {loadingTerminals ? (
          <div className="p-8 text-center">
            <span className="spinner"></span>
            <p className="mt-2 text-slate-500">Cargando terminales...</p>
          </div>
        ) : !showForm ? (
          <div className="existing-terminals-container">
            <div className="terminals-list">
              {existingTerminals.map((t) => (
                <div
                  key={t.id}
                  className="terminal-item"
                  onClick={() => handleSelectTerminal(t)}
                >
                  <div className="terminal-info">
                    <span className="terminal-name">{t.name}</span>
                    <span className="terminal-loc">
                      {t.location || "Sin ubicación"}
                    </span>
                  </div>
                  <span className="material-symbols-outlined select-icon">
                    login
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="register-new-btn"
            >
              <span className="material-symbols-outlined">add_circle</span>
              Registrar Nueva Caja
            </button>
            
            {isAdmin && (
              <AdminModeButton 
                masterPinConfigured={masterPinConfigured}
                setAdminMode={setAdminMode}
                verifyMasterPin={verifyMasterPin}
              />
            )}
          </div>
        ) : (
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
              <AdminModeButton 
                masterPinConfigured={masterPinConfigured}
                setAdminMode={setAdminMode}
                verifyMasterPin={verifyMasterPin}
              />
            )}

            {existingTerminals.length > 0 && (
              <button
                type="button"
                className="back-btn"
                onClick={() => setShowForm(false)}
              >
                Volver a la selección de cajas
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

// Componente auxiliar para el botón de administrador para evitar repetición
const AdminModeButton = ({ masterPinConfigured, setAdminMode, verifyMasterPin }) => (
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
    <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
      admin_panel_settings
    </span>
    Entrar como Administrador
  </button>
);
