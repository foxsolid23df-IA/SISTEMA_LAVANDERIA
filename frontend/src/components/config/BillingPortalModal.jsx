import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../../supabase";

export default function BillingPortalModal({ issuer, onClose, onSave }) {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portalData, setPortalData] = useState({
    id: null,
    nombre_marca: "",
    brand_color: "#003f87",
    logo_url: "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPortal();
  }, [issuer.id]);

  const fetchPortal = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("billing_portals")
        .select("*")
        .eq("billing_issuer_id", issuer.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPortalData({
          id: data.id,
          nombre_marca: data.nombre_marca || "",
          brand_color: data.brand_color || "#003f87",
          logo_url: data.logo_url || "",
        });
        setLogoPreview(data.logo_url || "");
      } else {
        // Inicializar con valores por defecto del emisor si no hay portal
        setPortalData(prev => ({
          ...prev,
          nombre_marca: issuer.razon_social,
        }));
      }
    } catch (error) {
      console.error("Error al cargar portal:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      
      let finalLogoUrl = portalData.logo_url;

      // 1. Subir logo si hay archivo nuevo
      if (logoFile) {
        const fileExt = logoFile.name.split(".").pop();
        const fileName = `${issuer.id}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("branding")
          .upload(filePath, logoFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("branding")
          .getPublicUrl(filePath);
        
        finalLogoUrl = urlData.publicUrl;
      }

      // 2. Guardar o actualizar registro del portal
      const payload = {
        billing_issuer_id: issuer.id,
        nombre_marca: portalData.nombre_marca,
        logo_url: finalLogoUrl,
        brand_color: portalData.brand_color,
        user_id: issuer.user_id, // Usar el mismo ID del emisor
      };

      if (portalData.id) {
        const { error } = await supabase
          .from("billing_portals")
          .update(payload)
          .eq("id", portalData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("billing_portals")
          .insert([payload]);
        if (error) throw error;
      }

      alert("Branding y logo actualizados correctamente.");
      if (onSave) onSave();
      onClose();
    } catch (error) {
      console.error("Error al guardar portal:", error);
      alert("Error al guardar la configuración: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-[#001a40]/30 backdrop-blur-md"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-[24px] shadow-2xl flex flex-col font-['Inter'] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-[#ffffff]">
          <div>
            <h2 className="text-xl font-bold font-['Manrope'] text-slate-800">Logo y Branding</h2>
            <p className="text-sm text-slate-500 mt-0.5">Configura el logo para tus facturas y portal.</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <span className="material-icons-outlined animate-spin text-4xl text-[#003f87]">autorenew</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 pb-8 space-y-6">
            
            {/* Visual Preview */}
            <div className="flex flex-col items-center gap-4">
              <div 
                onClick={() => fileInputRef.current.click()}
                className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group cursor-pointer hover:border-[#003f87] transition-all"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-[#003f87]">
                    <span className="material-icons-outlined text-3xl">image</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">Subir Logo</span>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                />
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Formato recomendado: PNG transparente (Max 2MB)</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nombre de la Marca</label>
                <input 
                  value={portalData.nombre_marca}
                  onChange={(e) => setPortalData(prev => ({ ...prev, nombre_marca: e.target.value }))}
                  required
                  placeholder="Ej. Mi Lavandería Express"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-[#003f87] focus:ring-4 focus:ring-[#d7e2ff] transition-all outline-none font-medium text-slate-900 placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Color de Marca</label>
                <div className="flex gap-3">
                  <input 
                    type="color"
                    value={portalData.brand_color}
                    onChange={(e) => setPortalData(prev => ({ ...prev, brand_color: e.target.value }))}
                    className="w-12 h-10 p-1 bg-white border border-slate-200 rounded-lg cursor-pointer"
                  />
                  <input 
                    type="text"
                    value={portalData.brand_color}
                    onChange={(e) => setPortalData(prev => ({ ...prev, brand_color: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm uppercase text-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-semibold rounded-xl transition-colors"
                disabled={isSubmitting}
              >
                Cerrar
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-[1.5] px-6 py-3 bg-gradient-to-b from-[#003f87] to-[#0056b3] hover:from-[#004b9e] hover:to-[#0060c5] text-white font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="material-icons-outlined animate-spin text-[18px]">sync</span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined text-[18px]">save</span>
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
