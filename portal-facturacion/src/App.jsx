import { useState } from 'react';
import { Search, FileText, Download, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { supabase } from './supabase';
import Swal from 'sweetalert2';

// ── Configuración Multi-Negocio vía Variables de Entorno ──
const APP_NAME = import.meta.env.VITE_APP_NAME || 'Mi Negocio';
const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'Portal de Auto-Facturación';
const ACCENT_HUE = import.meta.env.VITE_ACCENT_HUE || '220'; // 220=blue, 160=teal/lavandería, 0=red, 30=orange

export default function App() {
  const [step, setStep] = useState(1);
  const [folioValue, setFolioValue] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [totalValue, setTotalValue] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ticketData, setTicketData] = useState(null);

  // Formulario Fiscal
  const [rfc, setRfc] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [codigoPostal, setCodigoPostal] = useState('');
  const [regimenFiscal, setRegimenFiscal] = useState('601'); // 601 General de Ley
  const [usoCfdi, setUsoCfdi] = useState('G03'); // G03 Gastos en General
  const [email, setEmail] = useState('');

  const [invoiceResult, setInvoiceResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (!folioValue || !pinValue || !totalValue) throw new Error("Por favor, rellena todos los campos.");

      // Buscamos venta por Folio (ID) y PIN primero
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('folio', folioValue.trim()) 
        .eq('pin_facturacion', pinValue.trim().toUpperCase())
        .single();

      if (error) {
        console.error("DB Error fetching ticket:", error);
        if (error.code === 'PGRST116') {
          throw new Error('No se encontró ningún ticket con esos datos. Verifica el Folio y PIN.');
        }
        throw new Error(`Error BD: ${error.message}`);
      }

      if (!data) throw new Error("No se encontró ningún ticket devuelto por el servidor.");

      // Validamos el monto con tolerancia de 0.01 para evitar errores de precisión (visto en DB 40.5999... vs input 40.60)
      const dbTotal = parseFloat(data.total);
      const inputTotal = parseFloat(totalValue);
      
      if (Math.abs(dbTotal - inputTotal) > 0.01) {
        throw new Error('El monto ingresado no coincide con el registrado en el ticket.');
      }

      if (data.facturado) {
        // Si ya está facturado, buscamos la factura en la tabla invoices
        const { data: invData, error: invErr } = await supabase
          .from('invoices')
          .select('*')
          .eq('sale_id', data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (invErr) {
          console.error("Error al buscar factura previa:", invErr);
        }

        if (invData) {
          setInvoiceResult({
            id: invData.id,
            facturama_id: invData.facturama_id,
            uuid: invData.uuid_cfdi,
            xml_url: invData.xml_url,
            pdf_url: invData.pdf_url,
            status: invData.status,
            created_at: invData.created_at
          });
          setTicketData(data);
          setStep(4); // Saltamos directo a la pantalla final si ya existe
          return;
        }
      }

      setTicketData(data);
      setStep(2); // Pasar a confirmación de recibo
    } catch (err) {
      setErrorMsg(err.message || 'Error al buscar el ticket.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRfc = async () => {
    if (!rfc || rfc.length < 12) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('rfc', rfc.toUpperCase())
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setRazonSocial(data.razon_social);
        setCodigoPostal(data.codigo_postal);
        setRegimenFiscal(data.regimen_fiscal);
        setUsoCfdi(data.uso_cfdi);
        if(data.email) setEmail(data.email);
      }
    } catch (err) {
      console.warn("No se encontró historial previo de este RFC.", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFacturar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Guardar o actualizar cliente (opcional para no pedirlo de nuevo)
      const { data: existingClient, error: selectErr } = await supabase
        .from('clients')
        .select('id')
        .eq('rfc', rfc.toUpperCase())
        .limit(1)
        .maybeSingle();

      if (selectErr && selectErr.code !== 'PGRST116') {
        console.warn("Error consultando cliente", selectErr);
      }

      const clientData = {
        user_id: ticketData.user_id,
        rfc: rfc.toUpperCase(), 
        razon_social: razonSocial,
        regimen_fiscal: regimenFiscal,
        uso_cfdi: usoCfdi,
        codigo_postal: codigoPostal,
        email: email
      };

      if (existingClient) {
        const { error: updateErr } = await supabase.from('clients').update(clientData).eq('id', existingClient.id);
        if (updateErr) console.warn("Error actualizando cliente", updateErr);
      } else {
        const { error: insertErr } = await supabase.from('clients').insert([clientData]);
        if (insertErr) console.warn("Error guardando nuevo cliente", insertErr);
      }

      // 2. Aquí llamaremos a la Edge Function 'timbrar'
      // Simularemos por ahora el proceso de timbrado.
      
      const { data: timbradoData, error: timbrarErr } = await supabase.functions.invoke('timbrar', {
        body: {
          ticket_uuid: ticketData.ticket_uuid,
          rfc: rfc.toUpperCase(),
          razon_social: razonSocial,
          codigo_postal: codigoPostal,
          regimen_fiscal: regimenFiscal,
          uso_cfdi: usoCfdi,
          email: email
        }
      });

      if (timbrarErr) {
        let errorDetails = timbrarErr.message;
        if (timbrarErr.context) {
            try {
                const errBody = await timbrarErr.context.json();
                if (errBody.error) errorDetails = errBody.error;
            } catch {
                console.warn('Cannot parse error context as JSON');
            }
        }
        
        throw new Error(`Error en timbrado: ${errorDetails}`);
      }
      
      // Si la simulación retorna error local
      if (timbradoData && timbradoData.success) {
        setInvoiceResult({
          id: timbradoData.data?.Id || timbradoData.data?.id || timbradoData.data?.Uuid || timbradoData.data?.uuid,
          uuid: timbradoData.data?.FolioFiscal || timbradoData.data?.uuid || 'AAABBBCC-1234-5678-UIOP',
          xml_url: timbradoData.data?.Xml,
          pdf_url: timbradoData.data?.Pdf
        });
      } else {
        throw new Error(timbradoData?.message || 'Error desconocido al facturar');
      }
      
      setStep(4); // Pantalla final
      
    } catch (err) {
      console.error("Error en handleFacturar:", err);
      setErrorMsg(err.message || "Error al procesar la factura con el SAT.");
      Swal.fire({
        title: 'Error de Facturación',
        text: err.message || "Error al procesar la factura con el SAT.",
        icon: 'error',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (content, fileName, type) => {
    if (!content) {
      Swal.fire('Error', 'El contenido del archivo no está disponible.', 'error');
      return;
    }

    // Si es una URL directa, abrir en nueva pestaña
    if (content.startsWith('http')) {
      window.open(content, '_blank');
      return;
    }
    
    try {
      // Facturama API Lite devuelve Base64 sin el prefijo "data:..."
      // Necesitamos convertir el Base64 a un Blob
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: type });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error procesando archivo para descarga:", e);
      // Fallback: tratar como texto plano si falla atob (por si ya viniera decodificado)
      const blob = new Blob([content], { type: type });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const handleSendEmail = async () => {
    if (!email) {
      Swal.fire('Error', 'Por favor, ingresa un correo electrónico.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-factura-email', {
        body: {
          cfdi_id: invoiceResult.id,
          email: email,
          subject: 'Tu factura electrónica está lista',
          comments: 'Adjuntamos tu factura electrónica generada automáticamente.',
          issuer_email: 'noreply@facturama.mx'
        }
      });

      if (error) throw error;

      if (data && data.success) {
        Swal.fire({
          title: 'Correo Enviado',
          text: 'La factura ha sido enviada exitosamente a ' + email,
          icon: 'success',
          confirmButtonColor: '#3085d6'
        });
      } else {
        throw new Error(data?.message || 'No se pudo enviar el correo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    const { isConfirmed } = await Swal.fire({
      title: '¿Confirmas la cancelación?',
      text: "Esta acción anulará el CFDI ante el SAT y no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, Cancelar Factura',
      cancelButtonText: 'No, mantener'
    });

    if (!isConfirmed) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancelar-cfdi', {
        body: { id: invoiceResult.id, motive: '02' }
      });

      if (error) throw error;

      if (data && data.success) {
        Swal.fire({
            title: 'Cancelada',
            text: 'La factura ha sido cancelada exitosamente ante el SAT.',
            icon: 'success'
        });
        // Resetear vista para que pueda volver a facturar si lo desea
        setStep(1);
        setFolioValue('');
        setPinValue('');
        setTotalValue('');
      } else {
        throw new Error(data?.message || 'Error al cancelar la factura.');
      }
    } catch (err) {
      console.error("Error al cancelar CFDI:", err);
      Swal.fire('Error', err.message || 'Error al cancelar el CFDI.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isCancellationExpired = () => {
    if (!invoiceResult?.created_at) return true;
    const created = new Date(invoiceResult.created_at);
    const now = new Date();
    const diffHours = (now - created) / (1000 * 60 * 60);
    return diffHours > 24; 
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg bg-slate-50 dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 transition-colors">
        
        {/* CABECERA GENERAL - Branding dinámico */}
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg" style={{ backgroundColor: `hsl(${ACCENT_HUE}, 65%, 50%)`, boxShadow: `0 10px 15px -3px hsl(${ACCENT_HUE}, 65%, 50%, 0.3)` }}>
            {step === 4 ? <CheckCircle size={32} className="text-white" /> : <FileText size={32} className="text-white" />}
          </div>
        </div>
        
        {step < 4 && (
          <>
            <h1 className="text-2xl font-bold text-center mb-1 text-slate-900 dark:text-white">{APP_TITLE}</h1>
            <p className="text-center font-medium mb-0" style={{ color: `hsl(${ACCENT_HUE}, 65%, 50%)`, fontSize: '0.65rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{APP_NAME}</p>
          </>
        )}

        {/* ========================================================= */}
        {/* PASO 1: Buscar Ticket                                     */}
        {/* ========================================================= */}
        {step === 1 && (
          <div className="animate-in fade-in duration-300">
            <p className="text-slate-400 text-center mb-8 text-sm">
              Ingresa los datos impresos en tu recibo de compra.
            </p>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Folio (Ticket)</label>
                  <input required type="text" value={folioValue} onChange={(e) => setFolioValue(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all font-mono" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }} placeholder="Ej. 1254" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">PIN</label>
                  <input required type="text" value={pinValue} onChange={(e) => setPinValue(e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all font-mono" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }} placeholder="Ej. F7D1" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Total de la Compra</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-500 font-medium">$</span>
                  <input required type="number" step="0.01" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all font-mono" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }} placeholder="0.00" />
                </div>
              </div>
              {errorMsg && <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-3 text-sm text-red-200 text-center">{errorMsg}</div>}
              <button type="submit" disabled={loading} className="w-full text-white font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-2 mt-6 transition-colors" style={{ backgroundColor: `hsl(${ACCENT_HUE}, 65%, 50%)` }} onMouseEnter={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 58%)`} onMouseLeave={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 50%)`}>
                {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div> : <><Search size={20} /> Buscar Ticket</>}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 2: Confirmar Ticket                                  */}
        {/* ========================================================= */}
        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="space-y-4 bg-slate-100 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center shadow-inner">
              <h3 className="text-emerald-400 font-medium flex items-center justify-center gap-2 mb-2">
                <div className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></div>
                ¡Recibo Encontrado!
              </h3>
              <p className="text-slate-900 dark:text-slate-200 text-3xl font-mono mb-1">${Number(ticketData.total).toFixed(2)}</p>
              <p className="text-slate-500 text-sm">Folio: {ticketData.id} • Fecha: {new Date(ticketData.created_at).toLocaleDateString()}</p>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button onClick={() => setStep(1)} className="flex-1 bg-transparent border border-slate-700 text-slate-400 hover:text-white py-3 rounded-lg flex justify-center items-center gap-2">
                <ArrowLeft size={18}/> Atrás
              </button>
              <button onClick={() => setStep(3)} className="flex-1 text-white font-semibold py-3 rounded-lg flex justify-center items-center gap-2 transition-colors" style={{ backgroundColor: `hsl(${ACCENT_HUE}, 65%, 50%)` }} onMouseEnter={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 58%)`} onMouseLeave={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 50%)`}>
                Continuar <ArrowRight size={18}/>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 3: Datos Fiscales                                    */}
        {/* ========================================================= */}
        {step === 3 && (
          <div className="animate-in slide-in-from-right-4 duration-300">
            <p className="text-slate-400 text-center mb-6 text-sm">Ingresa los datos para emitir tu CFDI 4.0.</p>
            
            <form onSubmit={handleFacturar} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">RFC</label>
                  <input required type="text" value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} onBlur={handleSearchRfc} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono uppercase focus:ring-2 focus:ring-opacity-50 transition-all" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }} placeholder="XAXX010101000" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Razón Social o Nombre (Sin el SA de CV en 4.0)</label>
                  <input required type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value.toUpperCase())} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-opacity-50 transition-all" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">C.P. Fiscal</label>
                  <input required type="text" maxLength={5} value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-opacity-50 transition-all" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Uso CFDI</label>
                  <select value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-opacity-50 transition-all" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }}>
                    <option value="G01">G01 Adquisición mercancías</option>
                    <option value="G03">G03 Gastos en general</option>
                    <option value="S01">S01 Sin efectos fiscales</option>
                    <option value="CP01">CP01 Pagos</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Régimen Fiscal</label>
                  <select value={regimenFiscal} onChange={(e) => setRegimenFiscal(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-opacity-50 transition-all text-sm" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }}>
                    <option value="601">601 General de Ley Personas Morales</option>
                    <option value="606">606 Arrendamiento</option>
                    <option value="612">612 Personas Físicas. Actividades Empresariales</option>
                    <option value="616">616 Sin obligaciones fiscales</option>
                    <option value="626">626 RESICO</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Correo Electrónico (Opcional)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-opacity-50 transition-all" style={{ '--tw-ring-color': `hsl(${ACCENT_HUE}, 65%, 55%)` }} placeholder="correo@ejemplo.com" />
                </div>
              </div>

              {errorMsg && <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-3 text-sm text-red-200 text-center mt-2">{errorMsg}</div>}

              <div className="flex gap-3 mt-6 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button type="button" disabled={loading} onClick={() => setStep(2)} className="flex-1 bg-transparent border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-white py-3 rounded-lg flex justify-center items-center gap-2 transition-colors">
                  Atrás
                </button>
                <button type="submit" disabled={loading} className="flex-2 text-white font-semibold py-3 rounded-lg flex justify-center items-center gap-2 transition-colors relative overflow-hidden" style={{ backgroundColor: `hsl(${ACCENT_HUE}, 65%, 50%)` }} onMouseEnter={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 58%)`} onMouseLeave={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 50%)`}>
                  {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div> : 'Generar Factura SAT'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 4: ÉXITO                                             */}
        {/* ========================================================= */}
        {step === 4 && invoiceResult && (
          <div className="text-center animate-in zoom-in-95 duration-500">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">¡Factura Generada!</h2>
            <p className="text-emerald-600 dark:text-emerald-400 text-sm mb-6 bg-emerald-100 dark:bg-emerald-900/30 py-2 rounded max-w-[80%] mx-auto shadow-inner border border-emerald-500/20">
              Timbrado exitosamente por el SAT
            </p>

            <div className="bg-slate-100 dark:bg-slate-900 p-4 rounded-xl shadow-inner border border-slate-200 dark:border-slate-700 mb-8 space-y-3">
              <div className="flex justify-between items-center px-2 mb-4">
                <span className="text-slate-500">Total</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white">${parseFloat(ticketData.total).toFixed(2)}</span>
              </div>
              <button 
                onClick={() => handleDownload(invoiceResult.pdf_url, 'Factura.pdf', 'application/pdf')}
                className="w-full flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-all border border-slate-200 dark:border-transparent hover:border-blue-500/30 group"
              >
                <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <FileText className="text-red-500" size={24} />
                  <span className="font-medium">Descargar Formato PDF</span>
                </div>
                <Download size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
              </button>
              
              <button 
                onClick={() => handleDownload(invoiceResult.xml_url, 'Factura.xml', 'text/xml')}
                className="w-full flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-all border border-slate-200 dark:border-transparent hover:border-blue-500/30 group mb-3"
              >
                <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                  <FileText className="text-blue-500" size={24} />
                  <span className="font-medium">Descargar Código XML</span>
                </div>
                <Download size={20} className="text-blue-500 group-hover:scale-110 transition-transform" />
              </button>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-3">
                {invoiceResult.status !== 'CANCELADO' ? (
                  <>
                    <button 
                      disabled={loading}
                      onClick={handleSendEmail}
                      className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                      style={{ backgroundColor: `hsl(${ACCENT_HUE}, 65%, 50%)` }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 58%)`}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = `hsl(${ACCENT_HUE}, 65%, 50%)`}
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                      ) : (
                        <>
                          <FileText size={20} />
                          Enviar por Correo a {email || '...'}
                        </>
                      )}
                    </button>
                    
                    {!isCancellationExpired() ? (
                      <button 
                        disabled={loading}
                        onClick={handleCancel}
                        className="w-full text-red-500 hover:text-red-400 text-sm font-medium py-2 transition-colors border border-red-500/20 rounded-lg hover:bg-red-500/10"
                      >
                        Solicitar Cancelación de Factura
                      </button>
                    ) : (
                      <div className="text-slate-500 text-xs mt-2 italic px-4">
                        El periodo de cancelación por portal ha expirado (24h). 
                        Contacte al establecimiento para cambios.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-red-900/40 border border-red-500/50 rounded-lg p-3 text-sm text-red-200 text-center">
                    Esta factura se encuentra CANCELADA.
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                setStep(1); setTicketData(null); setFolioValue(''); setPinValue(''); setTotalValue(''); setRfc('');
              }}
              className="text-slate-400 hover:text-white text-sm"
            >
              ← Facturar otro ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
