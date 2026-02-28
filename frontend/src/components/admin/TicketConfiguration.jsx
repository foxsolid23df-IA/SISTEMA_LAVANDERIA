import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { useSettings } from "../../contexts/SettingsContext";
import { printService } from "../../services/printService";
import "./TicketConfiguration.css";

export const TicketConfiguration = () => {
  const { settings, updateSettings, loading: loadingContext } = useSettings();
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    logo_url: "",
    ticket_message: "",
    printer_width: 80,
    printer_font_size: 12,
    printer_font_family: "'Courier New', Courier, monospace",
    printer_is_bold: false,
    printer_margin: 0,
    printer_name: "",
    ticket_double_print: false,
  });
  const [printersList, setPrintersList] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name || "",
        address: settings.address || "",
        phone: settings.phone || "",
        logo_url: settings.logo_url || "",
        ticket_message: settings.ticket_message || "",
        printer_width: settings.printer_width || 80,
        printer_font_size: settings.printer_font_size || 12,
        printer_font_family:
          settings.printer_font_family || "'Courier New', Courier, monospace",
        printer_is_bold: settings.printer_is_bold || false,
        printer_margin: settings.printer_margin || 0,
        printer_name: settings.printer_name || "",
        ticket_double_print: settings.ticket_double_print || false,
      });
    }
    loadPrinters();
  }, [settings]);

  useEffect(() => {
    loadPrinters();
  }, []); // Cargar impresoras solo una vez al montar, settings se encarga del resto si cambia

  const loadPrinters = async () => {
    try {
      const list = await printService.getPrinters();
      setPrintersList(list);
    } catch (e) {
      console.error("Error loading printers:", e);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(formData);
      Swal.fire({
        title: "¡Configuración Guardada!",
        text: "Los cambios se han sincronizado con todos tus usuarios registrados en Gestión de Usuarios.",
        icon: "success",
        timer: 3000,
        showConfirmButton: true,
      });
    } catch (error) {
      console.error("Error guardando configuración:", error);
      Swal.fire("Error", "No se pudo guardar la configuración", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    const testHtml = printService.generateTicketHtml(
      formData,
      { id: "TEST-001", total: "0.00" },
      [{ quantity: 1, name: "PRUEBA DE IMPRESIÓN", price: 0 }],
    );
    const ok = await printService.print(testHtml, formData.printer_name);
    if (ok) {
      Swal.fire("Éxito", "Comando de impresión enviado", "success");
    }
  };

  // No mostramos pantalla de carga SI ya tenemos settings para evitar el 'parpadeo'
  // Solo bloqueamos la UI si es la carga inicial (loadingContext es true y no hay settings)
  if (loadingContext && !settings)
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1050] p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">
            Cargando configuración...
          </p>
        </div>
      </div>
    );

  return (
    <div className="ticket-config-container">
      <div className="ticket-config-header">
        <h1>Configuración del Ticket</h1>
        <p>
          Personaliza la información que aparece en el ticket de venta para tus
          clientes.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="ticket-config-form">
        <div className="form-group-config">
          <label htmlFor="name">Nombre del Negocio</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ej: Lavandería La Burbuja"
          />
        </div>

        <div className="form-group-config">
          <label htmlFor="address">Dirección</label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Calle Principal #123, Col. Centro, Ciudad"
            rows="3"
          />
        </div>

        <div className="form-group-config">
          <label htmlFor="phone">Teléfono / Contacto</label>
          <input
            type="text"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Ej: 555-123-4567"
          />
        </div>

        <div className="form-group-config">
          <label htmlFor="logo_upload">Logo del Negocio</label>

          <div
            className="logo-upload-container"
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <input
              type="file"
              id="logo_upload"
              accept="image/png, image/jpeg, image/jpg"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;

                // Validar tamaño (max 500KB)
                if (file.size > 500 * 1024) {
                  Swal.fire(
                    "Archivo muy grande",
                    "El logo debe pesar menos de 500KB",
                    "warning",
                  );
                  return;
                }

                const reader = new FileReader();
                reader.onloadend = () => {
                  setFormData((prev) => ({
                    ...prev,
                    logo_url: reader.result,
                  }));
                };
                reader.readAsDataURL(file);
              }}
              style={{ padding: "10px" }}
            />
            <p className="text-xs text-gray-500">
              Formatos: PNG, JPG. Máximo 500KB.
            </p>
          </div>

          {formData.logo_url && (
            <div className="preview-logo">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <p className="text-sm font-bold text-gray-700">Vista previa:</p>
                <button
                  type="button"
                  className="text-red-500 text-xs hover:text-red-700 underline"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, logo_url: "" }))
                  }
                >
                  Eliminar Logo
                </button>
              </div>
              <img
                src={formData.logo_url}
                alt="Logo Preview"
                onError={(e) => (e.target.style.display = "none")}
              />
            </div>
          )}
        </div>

        <div className="form-group-config">
          <label htmlFor="ticket_message">Mensaje de Pie de Página</label>
          <textarea
            id="ticket_message"
            name="ticket_message"
            value={formData.ticket_message}
            onChange={handleChange}
            placeholder="Gracias por su compra, vuelva pronto"
            rows="2"
          />
        </div>

        <div
          className="printer-config-section"
          style={{
            marginTop: "20px",
            padding: "20px",
            backgroundColor: "rgba(0,0,0,0.02)",
            borderRadius: "15px",
            border: "1px dashed #ccc",
            marginBottom: "20px",
          }}
        >
          <h3
            style={{
              fontSize: "14px",
              fontWeight: "bold",
              marginBottom: "15px",
            }}
          >
            Configuración de Impresora POS
          </h3>

          <div className="form-group-config" style={{ marginBottom: "15px" }}>
            <label
              htmlFor="printer_name"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: "bold",
                color: "#000",
                marginBottom: "5px",
              }}
            >
              Seleccionar Impresora
            </label>
            <div style={{ display: "flex", gap: "10px" }}>
              <select
                id="printer_name"
                name="printer_name"
                value={formData.printer_name || ""}
                onChange={handleChange}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "2px solid #333",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#000",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="">Impresora Predeterminada</option>
                {printersList.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} {p.isDefault ? "(Principal)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={loadPrinters}
                className="bg-gray-200 p-2 rounded hover:bg-gray-300"
                title="Recargar impresoras"
              >
                🔄
              </button>
              <button
                type="button"
                onClick={handleTestPrint}
                style={{
                  padding: "5px 15px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
                disabled={saving}
              >
                Pruebas
              </button>
            </div>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "15px",
            }}
          >
            <div className="form-group-config">
              <label
                htmlFor="printer_width"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#000",
                  marginBottom: "5px",
                }}
              >
                Ancho del Papel
              </label>
              <select
                id="printer_width"
                name="printer_width"
                value={formData.printer_width}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "2px solid #333",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#000",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                <option
                  value={58}
                  style={{ color: "#000", fontWeight: "bold" }}
                >
                  58 mm (Mini)
                </option>
                <option
                  value={80}
                  style={{ color: "#000", fontWeight: "bold" }}
                >
                  80 mm (Estándar)
                </option>
              </select>
            </div>

            <div className="form-group-config">
              <label
                htmlFor="printer_font_size"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#000",
                  marginBottom: "5px",
                }}
              >
                Tamaño Fuente (px)
              </label>
              <input
                type="number"
                id="printer_font_size"
                name="printer_font_size"
                value={formData.printer_font_size}
                onChange={handleChange}
                min="8"
                max="24"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "2px solid #333",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#000",
                  backgroundColor: "#fff",
                }}
              />
            </div>

            <div className="form-group-config">
              <label
                htmlFor="printer_margin"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#000",
                  marginBottom: "5px",
                }}
              >
                Margen (px)
              </label>
              <input
                type="number"
                id="printer_margin"
                name="printer_margin"
                value={formData.printer_margin}
                onChange={handleChange}
                min="0"
                max="50"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "2px solid #333",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#000",
                  backgroundColor: "#fff",
                }}
              />
            </div>

            <div className="form-group-config">
              <label
                htmlFor="printer_font_family"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#000",
                  marginBottom: "5px",
                }}
              >
                Tipo de Fuente
              </label>
              <select
                id="printer_font_family"
                name="printer_font_family"
                value={formData.printer_font_family}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "2px solid #333",
                  fontSize: "14px",
                  fontWeight: "bold",
                  color: "#000",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
              >
                <option value="'Courier New', Courier, monospace">
                  Monospace (Courier)
                </option>
                <option value="Arial, Helvetica, sans-serif">
                  Sans-Serif (Arial)
                </option>
                <option value="'Times New Roman', Times, serif">
                  Serif (Times)
                </option>
                <option value="system-ui">Sistema</option>
              </select>
            </div>

            <div className="form-group-config">
              <label
                htmlFor="printer_is_bold"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#000",
                  marginBottom: "5px",
                }}
              >
                Texto en Negrita
              </label>
              <div
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    printer_is_bold: !prev.printer_is_bold,
                  }))
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "46px",
                  gap: "10px",
                  padding: "0 15px",
                  border: "2px solid #000",
                  borderRadius: "10px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  id="printer_is_bold"
                  name="printer_is_bold"
                  checked={formData.printer_is_bold}
                  onChange={(e) => {
                    // Evitar doble toggle por el onClick del div
                    e.stopPropagation();
                    setFormData((prev) => ({
                      ...prev,
                      printer_is_bold: e.target.checked,
                    }));
                  }}
                  style={{ width: "22px", height: "22px", cursor: "pointer" }}
                />
                <span
                  style={{ fontSize: "16px", fontWeight: "900", color: "#000" }}
                >
                  {formData.printer_is_bold ? "SI" : "NO"}
                </span>
              </div>
            </div>

            <div className="form-group-config">
              <label
                htmlFor="ticket_double_print"
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: "#000",
                  marginBottom: "5px",
                }}
              >
                Imprimir Doble Ticket
              </label>
              <div
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    ticket_double_print: !prev.ticket_double_print,
                  }))
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "46px",
                  gap: "10px",
                  padding: "0 15px",
                  border: "2px solid #000",
                  borderRadius: "10px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  id="ticket_double_print"
                  name="ticket_double_print"
                  checked={formData.ticket_double_print}
                  onChange={(e) => {
                    // Evitar doble toggle por el onClick del div
                    e.stopPropagation();
                    setFormData((prev) => ({
                      ...prev,
                      ticket_double_print: e.target.checked,
                    }));
                  }}
                  style={{ width: "22px", height: "22px", cursor: "pointer" }}
                />
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#000",
                  }}
                >
                  {formData.ticket_double_print
                    ? "CLIENTE + CAJERO"
                    : "SOLO CLIENTE"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <button type="submit" className="save-config-btn" disabled={saving}>
          {saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </form>
    </div>
  );
};
