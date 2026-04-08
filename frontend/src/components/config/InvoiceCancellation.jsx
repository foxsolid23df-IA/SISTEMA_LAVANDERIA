import React, { useState, useEffect } from "react";
import { billingService } from "../../services/billingService";
import { supabase } from "../../supabase";

const CANCELLATION_MOTIVES = [
  { value: "01", label: "01 - Comprobante emitido con errores con relación" },
  { value: "02", label: "02 - Comprobante emitido con errores sin relación" },
  { value: "03", label: "03 - No se llevó a cabo la operación" },
  { value: "04", label: "04 - Operación nominativa relacionada en la factura global" },
];

export const InvoiceCancellation = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelData, setCancelData] = useState({
    motive: "02",
    uuidReplacement: ""
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          clients (razon_social)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error("Error al cargar facturas:", error);
      alert("No se pudieron cargar las facturas.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelClick = (invoice) => {
    setSelectedInvoice(invoice);
    setShowCancelModal(true);
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (cancelData.motive === "01" && !cancelData.uuidReplacement) {
      alert("El UUID de sustitución es obligatorio para el motivo 01.");
      return;
    }

    try {
      setIsSubmitting(true);
      await billingService.cancelInvoice(
        selectedInvoice.id,
        cancelData.motive,
        cancelData.uuidReplacement
      );
      
      alert("Factura cancelada exitosamente.");
      setShowCancelModal(false);
      setSelectedInvoice(null);
      setCancelData({ motive: "02", uuidReplacement: "" });
      fetchInvoices();
    } catch (error) {
      console.error("Error al cancelar factura:", error);
      alert("Error: " + (error.message || "No se pudo cancelar la factura."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPdf = (pdfBase64) => {
    if (!pdfBase64) return alert("No hay PDF disponible para esta factura.");
    
    try {
      // Normalizar base64 (quitar prefijos si existen)
      const cleanBase64 = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (error) {
      console.error("Error al procesar PDF:", error);
      alert("Error al abrir el PDF. El contenido podría no ser válido.");
    }
  };

  const handleDownloadXml = (xmlBase64, folio) => {
    if (!xmlBase64) return alert("No hay archivo XML disponible.");

    try {
      const cleanBase64 = xmlBase64.includes(',') ? xmlBase64.split(',')[1] : xmlBase64;
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/xml' });
      const fileURL = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = fileURL;
      link.download = `factura_${folio || 'CFDI'}.xml`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error al descargar XML:", error);
      alert("Error al descargar el XML.");
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.folio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.uuid_fiscal?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.clients?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full h-full flex flex-col bg-[#f7f9fc]">
      {/* Header */}
      <div className="p-8 lg:px-12 pt-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 font-['Manrope'] tracking-tight">
              Cancelación de Facturas
            </h1>
            <p className="text-slate-500 mt-2 font-['Inter']">
              Listado de facturas timbradas y herramientas de cancelación (SAT CFDI 4.0)
            </p>
          </div>
          <div className="relative">
            <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              type="text"
              placeholder="Buscar Folio, UUID o Cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl bg-white focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none w-80 font-['Inter']"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-[20px] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] border border-slate-100 p-2 relative overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-24">
              <span className="material-icons-outlined animate-spin text-4xl text-indigo-500">autorenew</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <span className="material-icons-outlined text-3xl text-slate-400">description</span>
              </div>
              <h3 className="text-lg font-['Manrope'] font-bold text-slate-800">No hay facturas encontradas</h3>
              <p className="text-slate-500 font-['Inter'] max-w-sm mt-2">
                Las facturas generadas desde el sistema aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider font-semibold font-['Inter']">
                    <th className="p-5 pl-6">Folio / Fecha</th>
                    <th className="p-5">Cliente</th>
                    <th className="p-5">UUID Fiscal</th>
                    <th className="p-5">Total</th>
                    <th className="p-5">Estado</th>
                    <th className="p-5 text-right pr-6">Acciones</th>
                  </tr>
                </thead>
                <tbody className="font-['Inter'] text-[15px] divide-y divide-slate-50">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-5 pl-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{inv.serie}{inv.folio}</span>
                          <span className="text-xs text-slate-500">{new Date(inv.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="p-5 text-slate-700 font-medium">
                        {inv.clients?.razon_social || "Sin cliente"}
                      </td>
                      <td className="p-5 text-slate-500 font-mono text-xs uppercase">
                        {inv.uuid_fiscal}
                      </td>
                      <td className="p-5 text-slate-800 font-bold">
                        ${inv.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-5">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          (inv.status === 'VIGENTE' || inv.status === 'ACTIVO')
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-5 text-right pr-6">
                        <div className="flex items-center justify-end gap-3">
                          <button 
                            onClick={() => handleViewPdf(inv.pdf_url)}
                            className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Ver PDF"
                          >
                            <span className="material-icons-outlined text-[22px]">picture_as_pdf</span>
                          </button>
                          
                          <button 
                            onClick={() => handleDownloadXml(inv.xml_url, inv.folio)}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                            title="Descargar XML"
                          >
                            <span className="material-icons-outlined text-[22px]">code</span>
                          </button>

                          <div className="w-[1px] h-6 bg-slate-100 mx-1" />

                          {(inv.status === 'VIGENTE' || inv.status === 'ACTIVO') && (
                            <button 
                              onClick={() => handleCancelClick(inv)}
                              className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border border-rose-100 rounded-xl transition-all font-bold text-xs flex items-center gap-2"
                              title="Cancelar Factura"
                            >
                              <span className="material-icons-outlined text-[18px]">cancel</span>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>


      {/* Cancellation Modal */}
      {showCancelModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isSubmitting && setShowCancelModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[24px] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                  <span className="material-icons-outlined text-3xl">info</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Cancelar Factura</h2>
                  <p className="text-slate-500 text-sm">Folio: {selectedInvoice.serie}{selectedInvoice.folio}</p>
                </div>
              </div>

              <form onSubmit={handleCancelSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Motivo de Cancelación</label>
                  <select 
                    value={cancelData.motive}
                    onChange={(e) => setCancelData({...cancelData, motive: e.target.value})}
                    required
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none font-medium appearance-none"
                  >
                    {CANCELLATION_MOTIVES.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {cancelData.motive === "01" && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <label className="text-sm font-semibold text-slate-700">UUID de Sustitución</label>
                    <input 
                      type="text"
                      placeholder="Folio fiscal de la nueva factura..."
                      value={cancelData.uuidReplacement}
                      onChange={(e) => setCancelData({...cancelData, uuidReplacement: e.target.value.toUpperCase()})}
                      required
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all outline-none font-mono text-sm uppercase"
                    />
                  </div>
                )}

                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                  <p className="text-xs text-amber-700 flex gap-2">
                    <span className="material-icons-outlined text-sm">warning</span>
                    Esta acción es irreversible una vez aceptada por el SAT. Se generará un acuse de cancelación.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded-xl transition-all"
                  >
                    Cerrar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-icons-outlined animate-spin text-[20px]">sync</span>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <span className="material-icons-outlined text-[20px]">check_circle</span>
                        Confirmar
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
