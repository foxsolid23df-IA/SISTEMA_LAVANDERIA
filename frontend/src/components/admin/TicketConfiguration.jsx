import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { useSettings } from "../../contexts/SettingsContext";
import { printService } from "../../services/printService";
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
    ticket_double_print: false,
    enable_billing_system: false,
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
        ticket_double_print: settings.ticket_double_print || false,
        enable_billing_system: settings.enable_billing_system || false,
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
    const ok = await printService.print(testHtml, formData.printer_name);
    if (ok) {
      Swal.fire("Éxito", "Comando de impresión enviado", "success");
    }
  };

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
          <div>
            <h2 className="text-4xl font-black text-slate-800 dark:text-white flex items-center gap-4 tracking-tight">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
                <span className="material-icons-outlined text-white text-3xl">settings_applications</span>
              </div>
              Configuración del Sistema
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg font-medium max-w-2xl">
              Gestiona la identidad de tu negocio, datos fiscales y parámetros de impresión POS en un solo lugar.
            </p>
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
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LOGO & PRINTER */}
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

          {/* POS PRINTER MINI SECTION */}
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-700 p-8 space-y-6 transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-[10px]">Terminal Punto de Venta</h3>
              <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${formData.printer_name ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30'}`}>
                {formData.printer_name ? 'Conectada' : 'No Configurada'}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Impresora Seleccionada</label>
                <div className="flex gap-2">
                  <select
                    name="printer_name"
                    value={formData.printer_name || ""}
                    onChange={handleChange}
                    className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none text-xs font-bold"
                  >
                    <option value="">Predeterminada</option>
                    {printersList.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={loadPrinters} className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-xl hover:scale-105 active:scale-95 transition-all">
                    <span className="material-icons-outlined text-sm">refresh</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Papel (mm)</label>
                  <select
                    name="printer_width"
                    value={formData.printer_width}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-black"
                  >
                    <option value={58}>58 mm</option>
                    <option value={80}>80 mm</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleTestPrint}
                    className="w-full py-3 bg-slate-800 dark:bg-slate-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-icons-outlined text-sm">print</span>
                    Probar
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Impresión Doble (Caja/Cli)</span>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={formData.ticket_double_print}
                    onChange={() => setFormData(p => ({ ...p, ticket_double_print: !p.ticket_double_print }))}
                  />
                  <div 
                    onClick={() => setFormData(p => ({ ...p, ticket_double_print: !p.ticket_double_print }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.ticket_double_print ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${formData.ticket_double_print ? 'left-7' : 'left-1'}`}></div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
