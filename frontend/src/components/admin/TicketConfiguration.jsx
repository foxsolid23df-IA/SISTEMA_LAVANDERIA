import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useSettings } from "../../contexts/SettingsContext";
import { printService } from "../../services/printService";
import { platform } from "../../utils/platform";
import "./TicketConfiguration.css";

export const TicketConfiguration = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, loading: loadingContext } = useSettings();
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    logo_url: "",
    ticket_message: "",
    billing_url: "https://pos-autofactura.vercel.app/",
    rfc: "",
    razon_social: "",
    regimen_fiscal: "",
    codigo_postal: "",
    printer_width: 80,
    printer_font_size: 12,
    printer_font_family: "'Courier New', Courier, monospace",
    printer_is_bold: false,
    printer_margin: 0,
    printer_name: "",
    printer_connection_type: platform.isAndroid ? "bluetooth" : "system",
    printer_bluetooth_address: "",
    printer_bluetooth_name: "",
    ticket_double_print: false,
    enable_billing_system: false,
    ticket_preview: true,
    enable_remision_print: false,
    remision_copies: 2,
    remision_terms: "",
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
        billing_url: settings.billing_url || "https://pos-autofactura.vercel.app/",
        rfc: settings.rfc || "",
        razon_social: settings.razon_social || "",
        regimen_fiscal: settings.regimen_fiscal || "",
        codigo_postal: settings.codigo_postal || "",
        printer_width: settings.printer_width || 80,
        printer_font_size: settings.printer_font_size || 12,
        printer_font_family:
          settings.printer_font_family || "'Courier New', Courier, monospace",
        printer_is_bold: settings.printer_is_bold || false,
        printer_margin: settings.printer_margin || 0,
        printer_name: settings.printer_name || "",
        printer_connection_type: settings.printer_connection_type || (platform.isAndroid ? "bluetooth" : "system"),
        printer_bluetooth_address: settings.printer_bluetooth_address || "",
        printer_bluetooth_name: settings.printer_bluetooth_name || "",
        ticket_double_print: settings.ticket_double_print || false,
        enable_billing_system: settings.enable_billing_system || false,
        ticket_preview: settings.ticket_preview !== undefined ? settings.ticket_preview : true,
        enable_remision_print: settings.enable_remision_print || false,
        remision_copies: settings.remision_copies || 2,
        remision_terms: settings.remision_terms || "",
      });
    }
    loadPrinters();
  }, [settings]);

  useEffect(() => {
    loadPrinters();
  }, []);

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
  const handlePrinterSelect = (e) => {
    const value = e.target.value;
    const selected = printersList.find(
      (printer) => (printer.address || printer.name) === value,
    );

    setFormData((prev) => {
      const bluetooth = selected?.connectionType === "bluetooth" || prev.printer_connection_type === "bluetooth" || platform.isAndroid;
      if (bluetooth) {
        return {
          ...prev,
          printer_connection_type: "bluetooth",
          printer_bluetooth_address: selected?.address || value,
          printer_bluetooth_name: selected?.name || value,
          printer_name: selected?.name || prev.printer_name,
        };
      }

      return {
        ...prev,
        printer_connection_type: "system",
        printer_name: selected?.name || value,
        printer_bluetooth_address: "",
        printer_bluetooth_name: "",
      };
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({
          ...prev,
          logo_url: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
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
    const ok = await printService.print(testHtml, formData.printer_name, {
      copies: 1,
      settings: formData,
      ticketData: {
        type: "sale",
        settings: formData,
        venta: { id: "TEST-001", total: "0.00" },
        items: [{ quantity: 1, name: "PRUEBA DE IMPRESION", price: 0 }],
      },
    });
    if (ok) {
      Swal.fire("Éxito", "Comando de impresión enviado", "success");
    }
  };

  const isBluetoothMode = formData.printer_connection_type === "bluetooth" || platform.isAndroid;
  const selectedPrinterValue = isBluetoothMode
    ? formData.printer_bluetooth_address || ""
    : formData.printer_name || "";
  const isPrinterConfigured = isBluetoothMode
    ? !!formData.printer_bluetooth_address
    : !!formData.printer_name;

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
    <div className="admin-container p-4 md:p-8 max-w-7xl mx-auto mb-20 overflow-y-auto">
      {/* HEADER SECTION */}
      <div className="config-header mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <button
               onClick={() => navigate('/configuracion')}
               className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors shrink-0 flex items-center gap-2 font-bold text-sm"
               title="Volver a Configuración"
            >
               <span className="material-icons-outlined">arrow_back</span>
               Volver a Configuración
            </button>
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white flex items-center gap-4 tracking-tight">
                <div className="hidden md:flex w-14 h-14 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                  <span className="material-icons-outlined text-white text-3xl">settings_applications</span>
                </div>
                Configuración
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2 md:mt-3 text-base md:text-lg font-medium max-w-2xl">
                Gestiona la identidad de tu negocio, datos fiscales y parámetros de impresión POS en un solo lugar.
              </p>
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="group relative px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-xl shadow-indigo-100 dark:shadow-none font-bold transition-all hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-3 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <span className="material-icons-outlined">{saving ? 'sync' : 'save'}</span>
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: IDENTIDAD Y FACTURACIÓN */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* DATOS GENERALES */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md">
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <span className="material-icons-outlined text-indigo-600 dark:text-indigo-400">storefront</span>
              </div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">Identidad del Negocio</h3>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">Nombre Comercial</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-800 dark:text-white font-medium"
                    placeholder="Ej. Lavandería Express"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">Teléfono o WhatsApp</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-800 dark:text-white font-medium"
                    placeholder="55 1234 5678"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">Dirección Física Completa</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-slate-800 dark:text-white font-medium resize-none"
                  placeholder="Calle, Número, Colonia, Ciudad, Estado..."
                />
              </div>
            </div>
          </div>

          {/* FISCAL DATA */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md">
            <div className="px-8 py-6 bg-emerald-50 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <span className="material-icons-outlined text-emerald-600 dark:text-emerald-400">description</span>
              </div>
              <h3 className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest text-xs">Datos de Facturación (SAT)</h3>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">RFC</label>
                  <input
                    type="text"
                    name="rfc"
                    value={formData.rfc || ""}
                    onChange={handleChange}
                    maxLength={13}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none font-mono uppercase text-slate-800 dark:text-white"
                    placeholder="XAXX010101000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">Razón Social</label>
                  <input
                    type="text"
                    name="razon_social"
                    value={formData.razon_social || ""}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none text-slate-800 dark:text-white font-medium"
                    placeholder="Denominación legal"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">Régimen Fiscal</label>
                  <select
                    name="regimen_fiscal"
                    value={formData.regimen_fiscal || ""}
                    onChange={handleChange}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none text-slate-800 dark:text-white font-medium"
                  >
                    <option value="">Seleccionar régimen...</option>
                    <option value="601">601 - Gral. Ley Personas Morales</option>
                    <option value="612">612 - PF Actividades Empresariales</option>
                    <option value="626">626 - RESICO (Confianza)</option>
                    <option value="605">605 - Sueldos y Salarios</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">C.P. Expedición</label>
                  <input
                    type="text"
                    name="codigo_postal"
                    value={formData.codigo_postal || ""}
                    onChange={handleChange}
                    maxLength={5}
                    className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none text-slate-800 dark:text-white"
                    placeholder="00000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 dark:text-slate-400 ml-1">URL de Facturación (Código QR)</label>
                <input
                  type="text"
                  name="billing_url"
                  value={formData.billing_url}
                  onChange={handleChange}
                  className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all outline-none text-slate-800 dark:text-white font-medium"
                  placeholder="https://pos-autofactura.vercel.app/"
                />
                <p className="text-[10px] text-slate-500 ml-1">Esta URL se usará para generar el código QR en los tickets.</p>
              </div>

              {/* TOGGLE: ACTIVAR FACTURACIÓN ELECTRÓNICA EN TICKETS */}
              <div className="col-span-full pt-4 mt-2 border-t border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${formData.enable_billing_system ? 'bg-emerald-500 shadow-lg shadow-emerald-200 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <span className="material-icons-outlined text-white text-lg">{formData.enable_billing_system ? 'receipt_long' : 'receipt'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Facturación Electrónica en Tickets</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Muestra el QR, enlace y PIN de facturación en cada ticket impreso</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => setFormData(p => ({ ...p, enable_billing_system: !p.enable_billing_system }))}
                    className={`w-14 h-7 rounded-full transition-all relative cursor-pointer ${formData.enable_billing_system ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-sm ${formData.enable_billing_system ? 'left-8' : 'left-1'}`}></div>
                  </div>
                </div>
                {!formData.enable_billing_system && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-2 ml-1 flex items-center gap-1">
                    <span className="material-icons-outlined text-xs">info</span>
                    Los tickets se imprimirán sin datos de facturación electrónica
                  </p>
                )}
              </div>

              {/* LINK: SISTEMA DE ESTANTERÍAS */}
              <div className="col-span-full pt-4 mt-2 border-t border-emerald-100 dark:border-emerald-900/30">
                <div className="flex items-center justify-between p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-blue-500 shadow-lg shadow-blue-200 dark:shadow-none">
                      <span className="material-icons-outlined text-white text-lg">shelves</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">Sistema de Estanterías (QR Localización)</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Configura las estanterías y auto-asignación desde el módulo dedicado</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/configuracion-estanterias')}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                  >
                    <span className="material-icons-outlined text-sm">settings</span>
                    Configurar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PRINTER CONFIGURATION PANEL */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md">
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 dark:bg-slate-700 flex items-center justify-center">
                <span className="material-icons-outlined text-white">print</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest text-xs">Configuración de Impresora</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Terminal POS y parámetros de impresión</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isPrinterConfigured ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                {isPrinterConfigured ? 'Conectada' : 'No Configurada'}
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* SELECCIONAR IMPRESORA */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Tipo de Conexion</label>
                <select
                  name="printer_connection_type"
                  value={formData.printer_connection_type || (platform.isAndroid ? "bluetooth" : "system")}
                  onChange={handleChange}
                  disabled={platform.isAndroid}
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 dark:text-white disabled:opacity-70"
                >
                  <option value="system">Sistema / Windows</option>
                  <option value="bluetooth">Bluetooth POS Android</option>
                </select>

                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Seleccionar Impresora</label>
                <div className="flex flex-col gap-3">
                  <select
                    name={isBluetoothMode ? "printer_bluetooth_address" : "printer_name"}
                    value={selectedPrinterValue}
                    onChange={handlePrinterSelect}
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none text-sm font-bold text-slate-800 dark:text-white"
                  >
                    <option value="">{isBluetoothMode ? "Selecciona impresora Bluetooth emparejada" : "Impresora Predeterminada"}</option>
                    {printersList.map((p) => (
                      <option key={p.address || p.name} value={p.address || p.name}>
                        {p.name}{p.address ? ` - ${p.address}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={loadPrinters} 
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-all border border-slate-200 dark:border-slate-600 flex items-center justify-center gap-2 font-bold text-xs uppercase"
                      title="Refrescar lista de impresoras"
                    >
                      <span className="material-icons-outlined text-lg">refresh</span>
                      Actualizar
                    </button>
                    <button 
                      type="button" 
                      onClick={handleTestPrint} 
                      className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <span className="material-icons-outlined text-lg">print</span>
                      Prueba de Impresión
                    </button>
                  </div>
                </div>
              </div>

              {/* ROW: ANCHO DEL PAPEL + TAMAÑO FUENTE + MARGEN */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Ancho del Papel</label>
                  <select
                    name="printer_width"
                    value={formData.printer_width}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold text-slate-800 dark:text-white"
                  >
                    <option value={58}>58 mm (Impresora Mini)</option>
                    <option value={80}>80 mm (Impresora Estándar)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Tamaño Fuente</label>
                  <input
                    type="number"
                    name="printer_font_size"
                    value={formData.printer_font_size}
                    onChange={handleChange}
                    min={8}
                    max={24}
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold text-slate-800 dark:text-white"
                    placeholder="12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Margen (PX)</label>
                  <input
                    type="number"
                    name="printer_margin"
                    value={formData.printer_margin}
                    onChange={handleChange}
                    min={0}
                    max={50}
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold text-slate-800 dark:text-white"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* ROW: TIPO DE FUENTE + TEXTO EN NEGRITA + IMPRIMIR DOBLE TICKET */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Familia de Fuente</label>
                  <select
                    name="printer_font_family"
                    value={formData.printer_font_family}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-sm font-bold text-slate-800 dark:text-white"
                  >
                    <option value="'Courier New', Courier, monospace">Monospace (Courier)</option>
                    <option value="Arial, Helvetica, sans-serif">Sans-Serif (Arial)</option>
                    <option value="'Times New Roman', serif">Serif (Times)</option>
                    <option value="'Lucida Console', monospace">Lucida Console</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Negrita</label>
                  <div 
                    onClick={() => setFormData(p => ({ ...p, printer_is_bold: !p.printer_is_bold }))}
                    className="flex items-center gap-2 px-3 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-indigo-300 transition-all min-h-[54px]"
                  >
                    <div className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${formData.printer_is_bold ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm" style={{ left: formData.printer_is_bold ? '1.125rem' : '0.125rem' }}></div>
                    </div>
                    <span className={`text-[10px] font-black uppercase ${formData.printer_is_bold ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {formData.printer_is_bold ? 'SÍ' : 'NO'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Impresión Doble</label>
                  <div 
                    onClick={() => setFormData(p => ({ ...p, ticket_double_print: !p.ticket_double_print }))}
                    className="flex items-center gap-2 px-3 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-indigo-300 transition-all min-h-[54px]"
                  >
                    <div className={`w-9 h-5 rounded-full transition-all relative shrink-0 ${formData.ticket_double_print ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all shadow-sm" style={{ left: formData.ticket_double_print ? '1.125rem' : '0.125rem' }}></div>
                    </div>
                    <span className={`text-[10px] font-black uppercase leading-tight ${formData.ticket_double_print ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {formData.ticket_double_print ? 'CLIENTE' : 'NO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* TICKET PREVIEW TOGGLE + FOOTER */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${formData.ticket_preview ? 'bg-indigo-500 shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <span className="material-icons-outlined text-white text-base">{formData.ticket_preview ? 'preview' : 'visibility_off'}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">Vista Previa Modal de Ticket</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Muestra el ticket antes de imprimir al completar una venta</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => setFormData(p => ({ ...p, ticket_preview: !p.ticket_preview }))}
                    className={`w-12 h-6 rounded-full transition-all relative cursor-pointer shrink-0 ${formData.ticket_preview ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${formData.ticket_preview ? 'left-7' : 'left-1'}`}></div>
                  </div>
                </div>

                {!formData.ticket_preview && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold ml-1 flex items-center gap-1">
                    <span className="material-icons-outlined text-xs">info</span>
                    Al desactivar, el ticket se imprimirá automáticamente al confirmar el pago sin previsualización
                  </p>
                )}
              </div>

              {/* NOTA DE REMISIÓN SECTION */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-700/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${formData.enable_remision_print ? 'bg-amber-500 shadow-lg shadow-amber-200 dark:shadow-none' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <span className="material-icons-outlined text-white text-base">receipt_long</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-white">Nota de Remisión (1/4 Carta)</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Formato 10.8 x 14 cm con servicios, totales y firma del cliente</p>
                    </div>
                  </div>
                  <div 
                    onClick={() => setFormData(p => ({ ...p, enable_remision_print: !p.enable_remision_print }))}
                    className={`w-12 h-6 rounded-full transition-all relative cursor-pointer shrink-0 ${formData.enable_remision_print ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${formData.enable_remision_print ? 'left-7' : 'left-1'}`}></div>
                  </div>
                </div>

                {formData.enable_remision_print && (
                  <div className="space-y-4 p-4 bg-amber-50/30 dark:bg-amber-900/5 rounded-2xl border border-amber-100 dark:border-amber-700/20">
                    <div>
                      <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Copias de Nota de Remisión</label>
                      <input
                        type="number"
                        name="remision_copies"
                        value={formData.remision_copies}
                        onChange={handleChange}
                        min="1"
                        max="5"
                        className="w-full px-5 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none text-sm text-slate-800 dark:text-white font-bold"
                      />
                      <p className="text-[10px] text-slate-500 ml-1 mt-1">Número de copias a imprimir (default: 2)</p>
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Términos y Condiciones</label>
                      <textarea
                        name="remision_terms"
                        value={formData.remision_terms}
                        onChange={handleChange}
                        rows="3"
                        className="w-full px-5 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all outline-none text-sm text-slate-800 dark:text-white font-medium resize-none"
                        placeholder="Ej: No nos hacemos responsables por daños o pérdidas después de 30 días..."
                      />
                      <p className="text-[10px] text-slate-500 ml-1 mt-1">Aparecerá al pie de la nota de remisión antes de la línea de firma</p>
                    </div>
                  </div>
                )}
              </div>

              {/* TICKET MESSAGE */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Mensaje Personalizado del Ticket</label>
                <textarea
                  name="ticket_message"
                  value={formData.ticket_message}
                  onChange={handleChange}
                  rows="2"
                  className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm text-slate-800 dark:text-white font-medium resize-none"
                  placeholder="¡Gracias por su preferencia!"
                />
                <p className="text-[10px] text-slate-500 ml-1">Aparecerá al pie de cada ticket impreso</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGO ONLY */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* LOGO SECTION */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 p-8 flex flex-col items-center transition-all hover:shadow-md">
            <h3 className="w-full text-left font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px] mb-8">Imagen Corporativa</h3>
            
            <div className="relative group">
              <div className={`w-56 h-56 rounded-[3rem] bg-slate-50 dark:bg-slate-900 border-2 border-dashed flex items-center justify-center overflow-hidden transition-all duration-500 ${formData.logo_url ? 'border-transparent ring-4 ring-slate-100 dark:ring-slate-700' : 'border-slate-200 dark:border-slate-700 group-hover:border-indigo-500 group-hover:bg-indigo-50/10'}`}>
                {formData.logo_url ? (
                  <div className="relative w-full h-full p-6">
                    <img src={formData.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    <button 
                      onClick={() => setFormData(prev => ({ ...prev, logo_url: "" }))}
                      className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all"
                    >
                      <span className="material-icons-outlined">delete</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-300 dark:text-slate-600">
                    <span className="material-icons-outlined text-6xl">add_photo_alternate</span>
                    <span className="text-[10px] font-black uppercase tracking-tighter">Sin Logotipo</span>
                  </div>
                )}
              </div>
              
              <label htmlFor="logo-upload-final" className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-700 text-slate-800 dark:text-white px-6 py-3 rounded-2xl shadow-2xl shadow-indigo-500/20 border border-slate-100 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center gap-3 whitespace-nowrap group-hover:scale-105 active:scale-95">
                <span className="material-icons-outlined text-indigo-500">cloud_upload</span>
                <span className="text-xs font-black uppercase">Cambiar Logo</span>
              </label>
              <input 
                type="file" 
                id="logo-upload-final" 
                className="hidden" 
                accept="image/*" 
                onChange={handleLogoUpload} 
              />
            </div>
            
            <div className="mt-12 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl w-full">
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold leading-normal flex items-start gap-2">
                <span className="material-icons-outlined text-sm">tips_and_updates</span>
                <span>Optimiza tu imagen: Usa PNG con fondo transparente (min 500x500px).</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};






