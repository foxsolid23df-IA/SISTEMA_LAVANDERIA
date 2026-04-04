import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";
import { useAuth } from "../../hooks/useAuth";
import BillingPortalModal from "./BillingPortalModal";

const REGIMENES_FISCALES = [
  { value: "601", label: "601 - General de Ley Personas Morales" },
  { value: "603", label: "603 - Personas Morales con Fines no Lucrativos" },
  { value: "606", label: "606 - Arrendamiento" },
  { value: "612", label: "612 - Personas Físicas con Actividades Empresariales y Profesionales" },
  { value: "621", label: "621 - Incorporación Fiscal" },
  { value: "626", label: "626 - Régimen Simplificado de Confianza" }
];

export default function BillingIssuers() {
  const { token } = useAuth();
  const [issuers, setIssuers] = useState([]);
  const [loading, setLoading] = useState(true);
   const [showModal, setShowModal] = useState(false);
   const [showPortalModal, setShowPortalModal] = useState(false);
   const [selectedIssuer, setSelectedIssuer] = useState(null);
   const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    rfc: "",
    razonSocial: "",
    regimenFiscal: "612",
    codigoPostal: "",
    branchName: "Matriz principal",
    password: ""
  });

  const [files, setFiles] = useState({
    cer: null,
    key: null,
    cerBase64: "",
    keyBase64: ""
  });

  const cerInputRef = useRef(null);
  const keyInputRef = useRef(null);

  useEffect(() => {
    fetchIssuers();
  }, []);

  const fetchIssuers = async () => {
    try {
      setLoading(true);
      // Traer emisores y sus portales asociados para el logo
      const { data, error } = await supabase
        .from("billing_issuers")
        .select("*, billing_portals(logo_url)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setIssuers(data || []);
    } catch (error) {
      console.error("Error al cargar emisores:", error);
      alert("No se pudieron cargar los emisores.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result.split(',')[1];
      setFiles(prev => ({
        ...prev,
        [type]: file,
        [`${type}Base64`]: base64String
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este emisor? Sus CSD se perderán.")) return;
    
    try {
      setLoading(true);
      const { error } = await supabase.from("billing_issuers").delete().eq("id", id);
      if (error) throw error;
      fetchIssuers();
    } catch (error) {
      console.error("Error eliminando emisor:", error);
      alert("Error eliminando el emisor.");
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.cerBase64 || !files.keyBase64 || !formData.password) {
      alert("Por favor cargue los archivos .cer y .key, además de la contraseña.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      const response = await supabase.functions.invoke('upload-csd', {
        body: {
          rfc: formData.rfc,
          cer_base64: files.cerBase64,
          key_base64: files.keyBase64,
          password: formData.password,
          razon_social: formData.razonSocial,
          regimen_fiscal: formData.regimenFiscal,
          codigo_postal: formData.codigoPostal,
          sucursal_nombre: formData.branchName
        }
      });

      console.log("Edge Function response:", { data: response.data, error: response.error });

      // Si hay error del relay o HTTP, intentar leer el body real
      if (response.error) {
        // response.data puede tener el JSON del body aunque haya error HTTP
        const serverMsg = response.data?.error 
          || response.data?.message 
          || response.data?.details?.message
          || null;
        
        if (serverMsg) {
          throw new Error(serverMsg);
        }

        // Fallback: intentar leer el contexto del error
        let contextMsg = response.error.message;
        if (response.error.context) {
          try {
            const ctx = await response.error.context.json();
            contextMsg = ctx.error || ctx.message || contextMsg;
          } catch (_) { /* no parseable */ }
        }
        throw new Error(contextMsg);
      }
      
      const result = response.data;
      if (result && result.error) {
        throw new Error(result.error);
      }
      if (result && !result.success && result.message) {
        throw new Error(result.message);
      }

      alert("Emisor validado y registrado exitosamente a través de Facturama.");
      setShowModal(false);
      setFormData({
        rfc: "", razonSocial: "", regimenFiscal: "612",
        codigoPostal: "", branchName: "Matriz principal", password: ""
      });
      setFiles({ cer: null, key: null, cerBase64: "", keyBase64: "" });
      fetchIssuers();
    } catch (error) {
      console.error("Error completo:", error);
      alert("Falló la validación del CSD: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#f7f9fc]">
      {/* Header */}
      <div className="p-8 lg:px-12 pt-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 font-['Manrope'] tracking-tight">
              Datos de Emisión Fiscal
            </h1>
            <p className="text-slate-500 mt-2 font-['Inter']">
              Administración de RFCs y Certificados de Sellos Digitales (CSD)
            </p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-b from-[#003f87] to-[#0056b3] hover:from-[#004b9e] hover:to-[#0060c5] text-white rounded-xl shadow-sm transition-all duration-300 font-medium font-['Inter']"
          >
            <span className="material-icons-outlined text-[20px]">add_circle</span>
            Añadir Emisor
          </button>
        </div>

        {/* Data Table Area */}
        <div className="bg-white rounded-[20px] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] border border-slate-100 p-2 relative overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <span className="material-icons-outlined animate-spin text-4xl text-[#003f87]">autorenew</span>
            </div>
          ) : issuers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <span className="material-icons-outlined text-3xl text-slate-400">domain_disabled</span>
              </div>
              <h3 className="text-lg font-['Manrope'] font-bold text-slate-800">No hay emisores configurados</h3>
              <p className="text-slate-500 font-['Inter'] max-w-sm mt-2">
                Presiona "Añadir Emisor" para registrar tu RFC y CSD para poder facturar.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[#424752] text-sm uppercase tracking-wider font-semibold font-['Inter']">
                    <th className="p-5 pl-6">RFC</th>
                    <th className="p-5">Razón Social</th>
                    <th className="p-5">Régimen</th>
                    <th className="p-5">C.P. / Sucursal</th>
                    <th className="p-5">Logo / Portal</th>
                    <th className="p-5 text-right pr-6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="font-['Inter'] text-[15px] divide-y divide-slate-50">
                  {issuers.map((issuer, index) => (
                    <tr key={issuer.id} className="hover:bg-[#f2f4f7]/40 transition-colors group">
                      <td className="p-5 pl-6">
                        <span className="font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-md text-sm">{issuer.rfc}</span>
                      </td>
                      <td className="p-5 text-slate-700 font-medium">{issuer.razon_social}</td>
                      <td className="p-5 text-slate-500">
                        {REGIMENES_FISCALES.find(r => r.value === issuer.regimen_fiscal)?.label || issuer.regimen_fiscal}
                      </td>
                      <td className="p-5 text-slate-500">
                        <div className="flex flex-col">
                          <span className="text-slate-800">{issuer.codigo_postal}</span>
                          <span className="text-sm opacity-70">{issuer.branch_name}</span>
                        </div>
                      </td>
                       <td className="p-5 text-slate-500">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {issuer.billing_portals?.[0]?.logo_url ? (
                              <img src={issuer.billing_portals[0].logo_url} alt="Logo" className="w-full h-full object-contain" />
                            ) : (
                              <span className="material-icons-outlined text-slate-400 text-[18px]">image</span>
                            )}
                          </div>
                          <button 
                            onClick={() => {
                              setSelectedIssuer(issuer);
                              setShowPortalModal(true);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-[#003f87]/10 text-slate-700 hover:text-[#003f87] border border-slate-200 rounded-lg transition-all font-medium text-xs whitespace-nowrap"
                          >
                            <span className="material-icons-outlined text-[16px]">palette</span>
                            Branding
                          </button>
                        </div>
                      </td>
                      <td className="p-5 text-right pr-6 gap-2 flex items-center justify-end">
                        <button 
                          onClick={() => handleDelete(issuer.id)}
                          className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Eliminar Emisor"
                        >
                          <span className="material-icons-outlined text-[20px]">delete_outline</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Glassmorphism Override */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#001a40]/20 backdrop-blur-md"
            onClick={() => !isSubmitting && setShowModal(false)}
          />
          <div className="relative w-full max-w-3xl bg-white rounded-[24px] shadow-[0_24px_40px_-8px_rgba(0,0,0,0.1)] flex flex-col font-['Inter'] animate-in fade-in zoom-in-95 duration-200 object-contain max-h-[90vh] overflow-hidden">
            
            {/* Header Modal */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-[#ffffff]">
              <div>
                <h2 className="text-2xl font-bold font-['Manrope'] text-slate-800">Cargar Datos de Facturación</h2>
                <p className="text-sm text-slate-500 mt-1">Configura tu CSD mediante conexión segura a Facturama.</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={isSubmitting}
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-8 py-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">RFC del Contribuyente</label>
                  <input 
                    name="rfc" value={formData.rfc} onChange={handleChange} required
                    placeholder="Ej. EJM951010AAA"
                    className="w-full px-4 py-3 bg-[#f2f4f7] border border-slate-200/50 rounded-xl focus:border-[#003f87] focus:ring-4 focus:ring-[#d7e2ff] transition-all outline-none font-medium uppercase"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Razón Social</label>
                  <input 
                    name="razonSocial" value={formData.razonSocial} onChange={handleChange} required
                    placeholder="Empresa Emisora S.A. de C.V."
                    className="w-full px-4 py-3 bg-[#f2f4f7] border border-slate-200/50 rounded-xl focus:border-[#003f87] focus:ring-4 focus:ring-[#d7e2ff] transition-all outline-none font-medium"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Régimen Fiscal</label>
                  <select 
                    name="regimenFiscal" value={formData.regimenFiscal} onChange={handleChange} required
                    className="w-full px-4 py-3 bg-[#f2f4f7] border border-slate-200/50 rounded-xl focus:border-[#003f87] focus:ring-4 focus:ring-[#d7e2ff] transition-all outline-none font-medium text-slate-700"
                  >
                    {REGIMENES_FISCALES.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Código Postal</label>
                  <input 
                    name="codigoPostal" value={formData.codigoPostal} onChange={handleChange} required
                    maxLength={5} pattern="[0-9]{5}"
                    placeholder="12345"
                    className="w-full px-4 py-3 bg-[#f2f4f7] border border-slate-200/50 rounded-xl focus:border-[#003f87] focus:ring-4 focus:ring-[#d7e2ff] transition-all outline-none font-medium"
                  />
                </div>
              </div>

              {/* Uploads Zone */}
              <div className="bg-[#f7f9fc] rounded-2xl p-6 border border-indigo-50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <span className="material-icons-outlined text-[#003f87]/10 text-6xl">security</span>
                </div>
                <div className="relative z-10 space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-[#001a40] mb-1 font-['Manrope']">Documentos Seguros CSD</h3>
                    <p className="text-xs text-[#003f87] flex items-center gap-1.5 font-medium">
                      <span className="material-icons-outlined text-[14px]">lock</span>
                      Tus certificados se transmiten al vuelo y NUNCA se almacenan en nuestra BDD
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Botón Certificado */}
                    <div 
                      onClick={() => cerInputRef.current?.click()}
                      className={`relative cursor-pointer border-2 border-dashed rounded-xl p-4 flex items-center gap-4 transition-all
                        ${files.cer ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-[#003f87] bg-white'}`}
                    >
                      <input type="file" required accept=".cer" ref={cerInputRef} onChange={(e) => handleFileChange(e, 'cer')} className="hidden" />
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${files.cer ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        <span className="material-icons-outlined">{files.cer ? 'check_circle' : 'upload_file'}</span>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-slate-700">Certificado .CER</p>
                        <p className="text-xs text-slate-500 truncate">{files.cer?.name || 'Seleccione un archivo'}</p>
                      </div>
                    </div>

                    {/* Botón Llave */}
                    <div 
                      onClick={() => keyInputRef.current?.click()}
                      className={`relative cursor-pointer border-2 border-dashed rounded-xl p-4 flex items-center gap-4 transition-all
                        ${files.key ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300 hover:border-[#003f87] bg-white'}`}
                    >
                      <input type="file" required accept=".key" ref={keyInputRef} onChange={(e) => handleFileChange(e, 'key')} className="hidden" />
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${files.key ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        <span className="material-icons-outlined">{files.key ? 'check_circle' : 'key'}</span>
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold text-slate-700">Llave Privada .KEY</p>
                        <p className="text-xs text-slate-500 truncate">{files.key?.name || 'Seleccione un archivo'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-sm font-semibold text-slate-700 block mb-2">Contraseña del CSD</label>
                    <input 
                      type="password" name="password" value={formData.password} onChange={handleChange} required
                      placeholder="••••••••••••••"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-[#003f87] focus:ring-4 focus:ring-[#d7e2ff] transition-all outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-gradient-to-b from-[#003f87] to-[#0056b3] hover:from-[#004b9e] hover:to-[#0060c5] text-white font-semibold rounded-xl shadow-sm transition-all duration-300 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="material-icons-outlined animate-spin text-[20px]">sync</span>
                      Validando...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined text-[20px]">verified_user</span>
                      Guardar y Validar CSD
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showPortalModal && selectedIssuer && (
        <BillingPortalModal 
          issuer={selectedIssuer}
          onClose={() => {
            setShowPortalModal(false);
            setSelectedIssuer(null);
          }}
          onSave={() => fetchIssuers()}
        />
      )}
    </div>
  );
}
