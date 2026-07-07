import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useSettings } from "../../contexts/SettingsContext";
import { businessSettingsService } from "../../services/businessSettingsService";
import { shelvingService } from "../../services/shelvingService";
import "./ShelvingConfiguration.css";

export const ShelvingConfiguration = () => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    shelving_enabled: false,
    shelving_rows: 5,
    shelving_columns: 10,
    shelving_auto_assign: false,
  });

  const [shelves, setShelves] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        shelving_enabled: settings.shelving_enabled || false,
        shelving_rows: settings.shelving_rows || 5,
        shelving_columns: settings.shelving_columns || 10,
        shelving_auto_assign: settings.shelving_auto_assign || false,
      });
    }
  }, [settings]);

  useEffect(() => {
    if (formData.shelving_enabled) {
      loadShelves();
    }
  }, [formData.shelving_enabled]);

  const loadShelves = async () => {
    try {
      setLoading(true);
      const data = await shelvingService.getShelves();
      setShelves(data);
      const st = await shelvingService.getShelvingStats();
      setStats(st);
    } catch (err) {
      console.error("Error cargando estanterías:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    const newValue = !formData.shelving_enabled;
    setFormData(prev => ({ ...prev, shelving_enabled: newValue }));

    try {
      await businessSettingsService.saveSettings({ shelving_enabled: newValue });
      await updateSettings({ shelving_enabled: newValue });

      if (newValue) {
        Swal.fire({
          title: "Módulo activado",
          text: "Configura las dimensiones y genera las estanterías.",
          icon: "success",
          timer: 3000,
          showConfirmButton: false,
          toast: true,
          position: "top-end"
        });
      } else {
        Swal.fire({
          title: "Módulo desactivado",
          text: "Los tickets no incluirán código de ubicación.",
          icon: "info",
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: "top-end"
        });
      }
    } catch (err) {
      setFormData(prev => ({ ...prev, shelving_enabled: !newValue }));
      Swal.fire("Error", "No se pudo guardar la configuración", "error");
    }
  };

  const handleAutoAssignToggle = async () => {
    const newValue = !formData.shelving_auto_assign;
    setFormData(prev => ({ ...prev, shelving_auto_assign: newValue }));

    try {
      await businessSettingsService.saveSettings({ shelving_auto_assign: newValue });
      await updateSettings({ shelving_auto_assign: newValue });
    } catch (err) {
      setFormData(prev => ({ ...prev, shelving_auto_assign: !newValue }));
      Swal.fire("Error", "No se pudo guardar", "error");
    }
  };

  const handleApplyAndGenerate = async () => {
    const total = formData.shelving_rows * formData.shelving_columns;

    const result = await Swal.fire({
      title: "¿Aplicar configuración?",
      html: `Se crearán <strong>${formData.shelving_rows} filas × ${formData.shelving_columns} columnas = ${total} estanterías</strong>.<br/><br/>${shelves.length > 0 ? '<span style="color:#ef4444">⚠️ Se eliminarán las estanterías existentes y sus asignaciones activas.</span>' : ''}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Sí, aplicar y generar",
      cancelButtonText: "Cancelar"
    });

    if (!result.isConfirmed) return;

    try {
      setSaving(true);

      // Guardar dimensiones
      await businessSettingsService.saveSettings({
        shelving_rows: formData.shelving_rows,
        shelving_columns: formData.shelving_columns,
      });
      await updateSettings({
        shelving_rows: formData.shelving_rows,
        shelving_columns: formData.shelving_columns,
      });

      // Generar estanterías
      await shelvingService.generateShelvesForStore(
        formData.shelving_rows,
        formData.shelving_columns
      );

      await loadShelves();

      Swal.fire({
        title: "¡Listo!",
        text: `Se crearon ${total} estanterías correctamente.`,
        icon: "success",
        timer: 3000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire("Error", "No se pudo aplicar la configuración", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleMaintenance = async (shelfId, currentStatus) => {
    const newStatus = currentStatus === 'maintenance' ? 'available' : 'maintenance';
    try {
      await shelvingService.updateShelfStatus(shelfId, newStatus);
      await loadShelves();
    } catch (err) {
      Swal.fire("Error", "No se pudo actualizar el estado", "error");
    }
  };

  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  return (
    <div className="shelving-config-container">
      <div className="shelving-config-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1>
          <span className="material-icons-outlined">shelves</span>
          Configuración de Estanterías
        </h1>
      </div>

      {/* Toggle principal */}
      <div className="config-card">
        <div className="config-card-header">
          <div>
            <h2>Módulo de Estanterías</h2>
            <p className="config-description">
              Activa el sistema de localización de ropa por código QR y estanterías.
            </p>
          </div>
          <button
            className={`toggle-btn ${formData.shelving_enabled ? 'active' : ''}`}
            onClick={handleToggle}
          >
            <div className="toggle-knob" />
          </button>
        </div>
        {!formData.shelving_enabled && (
          <div className="config-warning">
            <span className="material-icons-outlined">info</span>
            Las estanterías están deshabilitadas. Los tickets no incluirán código de ubicación.
          </div>
        )}
      </div>

      {/* Configuración completa (solo si está habilitado) */}
      {formData.shelving_enabled && (
        <>
          {/* Configuración unificada */}
          <div className="config-card">
            <h2>Configuración del Grid</h2>
            <p className="config-description">
              Define el tamaño del grid de estanterías y si quieres auto-asignar al recibir órdenes.
            </p>

            <div className="dimensions-form">
              <div className="dimension-field">
                <label>Filas (Letras)</label>
                <div className="dimension-input-group">
                  <button
                    className="dim-btn"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      shelving_rows: Math.max(1, prev.shelving_rows - 1)
                    }))}
                  >
                    <span className="material-icons-outlined">remove</span>
                  </button>
                  <span className="dimension-value">{formData.shelving_rows}</span>
                  <button
                    className="dim-btn"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      shelving_rows: Math.min(26, prev.shelving_rows + 1)
                    }))}
                  >
                    <span className="material-icons-outlined">add</span>
                  </button>
                </div>
                <span className="dimension-preview">A - {rowLabels[formData.shelving_rows - 1]}</span>
              </div>
              <span className="dimension-x">×</span>
              <div className="dimension-field">
                <label>Columnas (Números)</label>
                <div className="dimension-input-group">
                  <button
                    className="dim-btn"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      shelving_columns: Math.max(1, prev.shelving_columns - 1)
                    }))}
                  >
                    <span className="material-icons-outlined">remove</span>
                  </button>
                  <span className="dimension-value">{formData.shelving_columns}</span>
                  <button
                    className="dim-btn"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      shelving_columns: Math.min(50, prev.shelving_columns + 1)
                    }))}
                  >
                    <span className="material-icons-outlined">add</span>
                  </button>
                </div>
                <span className="dimension-preview">1 - {formData.shelving_columns}</span>
              </div>
            </div>

            <div className="dimensions-total">
              Total: <strong>{formData.shelving_rows * formData.shelving_columns}</strong> estanterías
            </div>

            {/* Auto-asignación */}
            <div className="auto-assign-section">
              <div className="auto-assign-header">
                <div>
                  <p className="auto-assign-title">Auto-asignar estantería</p>
                  <p className="auto-assign-desc">Al recibir una orden, asigna automáticamente la primera estantería disponible</p>
                </div>
                <button
                  className={`toggle-btn toggle-btn-sm ${formData.shelving_auto_assign ? 'active' : ''}`}
                  onClick={handleAutoAssignToggle}
                >
                  <div className="toggle-knob" />
                </button>
              </div>
            </div>

            {/* Botón unificado: Aplicar y generar */}
            <button
              className="ui-btn ui-btn--primary apply-btn"
              onClick={handleApplyAndGenerate}
              disabled={saving}
            >
              <span className="material-icons-outlined">
                {saving ? 'sync' : 'auto_fix_high'}
              </span>
              {saving ? "Aplicando..." : "Aplicar y generar estanterías"}
            </button>
          </div>

          {/* Vista previa del grid */}
          {shelves.length > 0 && (
            <div className="config-card">
              <div className="grid-header">
                <h2>Vista Previa</h2>
                {stats && (
                  <div className="grid-stats">
                    <span className="stat-badge stat-total">{stats.totalShelves} total</span>
                    <span className="stat-badge stat-available">{stats.availableShelves} disponibles</span>
                    <span className="stat-badge stat-occupied">{stats.occupiedShelves} ocupadas</span>
                    <span className="stat-badge stat-maintenance">{stats.maintenanceShelves} mto.</span>
                  </div>
                )}
              </div>
              <div className="shelf-grid-preview">
                {rowLabels.slice(0, formData.shelving_rows).map(row => (
                  <div key={row} className="shelf-grid-row">
                    <span className="row-label">{row}</span>
                    {Array.from({ length: formData.shelving_columns }, (_, i) => i + 1).map(col => {
                      const shelf = shelves.find(s => s.row_label === row && s.column_number === col);
                      const status = shelf?.status || 'available';
                      return (
                        <div
                          key={col}
                          className={`shelf-cell shelf-${status}`}
                          onClick={() => shelf && handleToggleMaintenance(shelf.id, status)}
                          title={`${row}${col} - ${status === 'available' ? 'Disponible' : status === 'occupied' ? 'Ocupada' : 'Mto.'}`}
                        >
                          {row}{col}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShelvingConfiguration;
