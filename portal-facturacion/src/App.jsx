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
  const [rfcType, setRfcType] = useState(''); // 'moral' o 'fisica'

  // Regímenes válidos por tipo de persona según SAT
  const REGIMENES_MORAL = [
    { value: '601', label: '601 General de Ley Personas Morales' },
    { value: '603', label: '603 Personas Morales con Fines no Lucrativos' },
    { value: '620', label: '620 Sociedades Cooperativas de Producción' },
    { value: '622', label: '622 Actividades Agrícolas, Ganaderas' },
    { value: '623', label: '623 Opcional para Grupos de Sociedades' },
    { value: '624', label: '624 Coordinados' },
  ];
  const REGIMENES_FISICA = [
    { value: '605', label: '605 Sueldos y Salarios' },
    { value: '606', label: '606 Arrendamiento' },
    { value: '608', label: '608 Demás ingresos' },
    { value: '610', label: '610 Residentes en el Extranjero' },
    { value: '611', label: '611 Ingresos por Dividendos' },
    { value: '612', label: '612 Personas Físicas. Actividades Empresariales' },
    { value: '614', label: '614 Ingresos por intereses' },
    { value: '616', label: '616 Sin obligaciones fiscales' },
    { value: '621', label: '621 Incorporación Fiscal' },
    { value: '625', label: '625 Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
    { value: '626', label: '626 RESICO' },
  ];

  // Detectar tipo de RFC y auto-seleccionar régimen
  const handleRfcChange = (value) => {
    const cleanRfc = value.toUpperCase().trim();
    setRfc(cleanRfc);

    if (cleanRfc.length === 12) {
      setRfcType('moral');
      // Auto-seleccionar el régimen más común para Persona Moral
      if (!REGIMENES_MORAL.find(r => r.value === regimenFiscal)) {
        setRegimenFiscal('601');
      }
    } else if (cleanRfc.length === 13) {
      setRfcType('fisica');
      // Auto-seleccionar el régimen más común para Persona Física
      if (!REGIMENES_FISICA.find(r => r.value === regimenFiscal)) {
        setRegimenFiscal('612');
      }
    } else {
      setRfcType('');
    }
  };

  // Obtener regímenes según tipo de RFC detectado
  const getRegimenesDisponibles = () => {
    if (rfcType === 'moral') return REGIMENES_MORAL;
    if (rfcType === 'fisica') return REGIMENES_FISICA;
    return [...REGIMENES_MORAL, ...REGIMENES_FISICA];
  };

  const [invoiceResult, setInvoiceResult] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      if (!folioValue || !pinValue || !totalValue) throw new Error("Por favor, rellena todos los campos.");

      const cleanFolio = folioValue.trim();
      const cleanPin = pinValue.trim().toUpperCase();

      // 1. Intentamos buscar en la tabla 'sales' primero (para ventas directas)
      let { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('folio', cleanFolio) 
        .eq('pin_facturacion', cleanPin)
        .maybeSingle();

      // 2. Si no se encontró en 'sales', intentamos buscar en la tabla 'orders' (lavandería)
      if (!data && !error) {
        const folioNum = parseInt(cleanFolio, 10);
        
        if (!isNaN(folioNum)) {
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('folio', folioNum)
            .eq('pin',  cleanPin)
            .maybeSingle();
          
          if (orderError) {
              console.error("Error buscando en orders:", orderError);
              error = orderError;
          }
          if (orderData) {
          // Adaptamos los datos de 'orders' para que tengan el formato que espera el portal (usando 'pin_facturacion' en lugar de 'pin')
          data = { 
            ...orderData, 
            pin_facturacion: orderData.pin,
            ticket_uuid: orderData.id // En orders por ahora usamos el id como uuid (puedes ajustarlo si tienes un uuid real)
          };
        }
      }
    }

      if (error) {
        console.error("DB Error fetching ticket:", error);
        throw new Error(`Error BD: ${error.message}`);
      }

      if (!data) {
        throw new Error('No se encontró ningún ticket con esos datos. Verifica el Folio y PIN.');
      }

      // Validamos el monto con tolerancia de 0.01 para evitar errores de precisión
      const dbTotal = parseFloat(data.total);
      const inputTotal = parseFloat(totalValue);
      
      if (Math.abs(dbTotal - inputTotal) > 0.01) {
        throw new Error(`El monto ingresado ($${inputTotal.toFixed(2)}) no coincide con el registrado en el ticket ($${dbTotal.toFixed(2)}).`);
      }

      // Identificamos el origen para buscar facturas previas
      const isOrder = 'customer_id' in data; // 'orders' tiene customer_id
      data._table = isOrder ? 'orders' : 'sales'; // Usamos el nombre plural de la tabla para facilitar la lógica SQL

      if (data.facturado || data.status === 'facturado') {
        const idQueryField = isOrder ? 'order_id' : 'sale_id';
        const { data: invData } = await supabase
          .from('invoices')
          .select('*')
          .eq(idQueryField, data.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (invData) {
          setInvoiceResult({
            id: invData.id,
            uuid: invData.uuid_fiscal,
            xml_url: invData.xml_url,
            pdf_url: invData.pdf_url,
          });
          setTicketData(data);
          setStep(4);
          return;
        }
      }

      setTicketData(data);
      setStep(2);
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
        
        // Ensure fetched regimen matches RFC type
        const isMoral = rfc.length === 12;
        const isFisica = rfc.length === 13;
        
        let fetchedRegimen = data.regimen_fiscal;
        if (isMoral && !REGIMENES_MORAL.find(r => r.value === fetchedRegimen)) {
          fetchedRegimen = '601';
        } else if (isFisica && !REGIMENES_FISICA.find(r => r.value === fetchedRegimen)) {
          fetchedRegimen = '612';
        }
        
        setRegimenFiscal(fetchedRegimen);
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
      
      const { data: timbradoData, error: timbrarErr } = await supabase.functions.invoke('Timbrar', {
        body: {
          ticket_uuid: ticketData.ticket_uuid,
          pin: ticketData.pin_facturacion,
          table: ticketData._table,
          client_data: {
            rfc: rfc.toUpperCase(),
            razon_social: razonSocial,
            codigo_postal: codigoPostal,
            regimen_fiscal: regimenFiscal,
            uso_cfdi: usoCfdi,
            email: email
          }
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]"></div>

      <div className="w-full max-w-lg glass-card p-10 rounded-[2.5rem] relative z-10 transition-all duration-500">
        
        {/* CABECERA NEXUM POS */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-6 transform hover:scale-105 transition-transform duration-300">
            <img 
              src="/src/assets/hero.png" 
              alt="Nexum POS Logo" 
              className="h-20 w-auto object-contain drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="h-16 w-16 bg-blue-500/20 backdrop-blur-md border border-white/10 rounded-2xl flex items-center justify-center shadow-lg"><span class="text-2xl font-bold text-white">N</span></div>';
              }}
            />
          </div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">
            Auto-Facturación
          </h1>
          <p className="text-slate-400 text-center text-sm leading-relaxed max-w-[280px]">
            Ingresa los datos impresos en tu recibo para comenzar el proceso de facturación.
          </p>
        </div>

        {/* ========================================================= */}
        {/* PASO 1: Buscar Ticket                                     */}
        {/* ========================================================= */}
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-5 duration-500">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Folio del Ticket</label>
                  <input 
                    required 
                    type="text" 
                    value={folioValue} 
                    onChange={(e) => setFolioValue(e.target.value)} 
                    className="w-full nexum-input text-lg font-mono placeholder:text-slate-600" 
                    placeholder="Ej. 1254" 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">PIN</label>
                    <input 
                      required 
                      type="text" 
                      value={pinValue} 
                      onChange={(e) => setPinValue(e.target.value.toUpperCase())} 
                      className="w-full nexum-input text-lg font-mono placeholder:text-slate-600 uppercase" 
                      placeholder="Ej. F7D1" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Total Compra</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                      <input 
                        required 
                        type="number" 
                        step="0.01" 
                        value={totalValue} 
                        onChange={(e) => setTotalValue(e.target.value)} 
                        className="w-full nexum-input pl-10 text-lg font-mono placeholder:text-slate-600" 
                        placeholder="0.00" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 text-center animate-shake">
                  {errorMsg}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full nexum-button text-white py-4 flex items-center justify-center gap-3 shadow-[0_10px_20px_-10px_rgba(59,130,246,0.5)] active:scale-95"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white"></div>
                ) : (
                  <>
                    <Search size={22} strokeWidth={2.5} />
                    <span className="text-lg">Buscar Fichaje</span>
                  </>
                )}
              </button>

              <div className="pt-6 flex justify-center items-center gap-2 text-slate-500 text-xs font-medium">
                <div className="h-5 w-5 bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"></path></svg>
                </div>
                Transacción Segura
              </div>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 2: Confirmar Ticket                                  */}
        {/* ========================================================= */}
        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="space-y-4 bg-white/5 p-8 rounded-3xl border border-white/10 text-center shadow-inner group transition-all hover:bg-white/10">
              <div className="flex justify-center mb-4">
                <div className="h-12 w-12 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
                  <div className="h-3 w-3 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_#4ade80]"></div>
                </div>
              </div>
              <h3 className="text-emerald-400 font-bold tracking-tight">¡Recibo Encontrado!</h3>
              <p className="text-white text-5xl font-mono tracking-tighter mb-1">${Number(ticketData.total).toFixed(2)}</p>
              <div className="flex flex-col gap-1">
                <p className="text-slate-400 text-sm font-medium">Folio: <span className="text-slate-200">{ticketData.id}</span></p>
                <p className="text-slate-500 text-xs">Fecha: {new Date(ticketData.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setStep(1)} 
                className="flex-1 bg-white/5 border border-white/10 text-slate-400 hover:text-white py-4 rounded-2xl flex justify-center items-center gap-2 transition-all hover:bg-white/10 active:scale-95"
              >
                <ArrowLeft size={18}/> Atrás
              </button>
              <button 
                onClick={() => setStep(3)} 
                className="flex-[2] nexum-button text-white py-4 rounded-2xl flex justify-center items-center gap-2 shadow-[0_10px_20px_-10px_rgba(59,130,246,0.3)] active:scale-95"
              >
                Continuar <ArrowRight size={18}/>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PASO 3: Datos Fiscales                                    */}
        {/* ========================================================= */}
        {step === 3 && (
          <div className="animate-in slide-in-from-right-8 duration-500">
            <p className="text-slate-400 text-center mb-8 text-sm px-4">Ingresa los datos fiscales vigentes para emitir tu CFDI 4.0.</p>
            
            <form onSubmit={handleFacturar} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">RFC</label>
                  <input 
                    required 
                    type="text" 
                    value={rfc} 
                    onChange={(e) => handleRfcChange(e.target.value)} 
                    onBlur={handleSearchRfc} 
                    className="w-full nexum-input text-lg font-mono uppercase tracking-widest" 
                    placeholder="XAXX010101000" 
                  />
                  {rfcType && (
                    <div className="flex items-center gap-2 mt-2 ml-1">
                      <div className={`h-1.5 w-1.5 rounded-full ${rfcType === 'moral' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                      <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">
                        {rfcType === 'moral' ? 'Persona Moral' : 'Persona Física'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Razón Social</label>
                  <input 
                    required 
                    type="text" 
                    value={razonSocial} 
                    onChange={(e) => setRazonSocial(e.target.value.toUpperCase())} 
                    className="w-full nexum-input text-sm" 
                    placeholder="NOMBRE O EMPRESA"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">CP Fiscal</label>
                  <input 
                    required 
                    type="text" 
                    maxLength={5} 
                    value={codigoPostal} 
                    onChange={(e) => setCodigoPostal(e.target.value)} 
                    className="w-full nexum-input text-lg font-mono" 
                    placeholder="00000"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Uso CFDI</label>
                  <select 
                    value={usoCfdi} 
                    onChange={(e) => setUsoCfdi(e.target.value)} 
                    className="w-full nexum-input text-xs appearance-none cursor-pointer"
                  >
                    <option value="G01">G01 Adquisición mercancías</option>
                    <option value="G03">G03 Gastos en general</option>
                    <option value="S01">S01 Sin efectos fiscales</option>
                    <option value="CP01">CP01 Pagos</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Régimen Fiscal</label>
                  <select 
                    value={regimenFiscal} 
                    onChange={(e) => setRegimenFiscal(e.target.value)} 
                    className="w-full nexum-input text-xs appearance-none cursor-pointer"
                  >
                    {getRegimenesDisponibles().map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 ml-1">Correo Electrónico</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full nexum-input text-sm" 
                    placeholder="ejemplo@correo.com" 
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400 text-center">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-4 pt-6">
                <button 
                  type="button" 
                  disabled={loading} 
                  onClick={() => setStep(2)} 
                  className="flex-1 bg-white/5 border border-white/10 text-slate-400 hover:text-white py-4 rounded-2xl transition-all hover:bg-white/10 active:scale-95"
                >
                  Atrás
                </button>
                <button 
                  type="submit" 
                  disabled={loading} 
                  className="flex-[2] nexum-button text-white py-4 rounded-2xl flex justify-center items-center gap-2 shadow-[0_10px_20px_-10px_rgba(59,130,246,0.3)] active:scale-95"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-white/30 border-t-white"></div>
                  ) : (
                    'Generar Factura SAT'
                  )}
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
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 bg-emerald-500/20 rounded-[2rem] flex items-center justify-center border-2 border-emerald-500/30 relative">
                <div className="absolute inset-0 bg-emerald-400/20 blur-xl rounded-full animate-pulse"></div>
                <CheckCircle size={40} className="text-emerald-400 relative z-10" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">¡Operación Exitosa!</h2>
            <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">
              Certificado por el SAT
            </div>

            <div className="bg-white/5 rounded-3xl border border-white/10 p-6 mb-8 space-y-4">
              <div className="flex justify-between items-center px-2 pb-4 border-b border-white/5">
                <span className="text-slate-500 font-medium">Total Facturado</span>
                <span className="text-3xl font-extrabold text-white tracking-tighter">${parseFloat(ticketData.total).toFixed(2)}</span>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => handleDownload(invoiceResult.pdf_url, 'Factura.pdf', 'application/pdf')}
                  className="w-full flex items-center justify-between bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                      <FileText className="text-red-400" size={20} />
                    </div>
                    <span className="text-white font-semibold text-sm">Descargar PDF</span>
                  </div>
                  <Download size={18} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-y-1 transition-all" />
                </button>
                
                <button 
                  onClick={() => handleDownload(invoiceResult.xml_url, 'Factura.xml', 'text/xml')}
                  className="w-full flex items-center justify-between bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                      <FileText className="text-blue-400" size={20} />
                    </div>
                    <span className="text-white font-semibold text-sm">Descargar XML</span>
                  </div>
                  <Download size={18} className="text-slate-500 group-hover:text-blue-400 group-hover:translate-y-1 transition-all" />
                </button>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                {invoiceResult.status !== 'CANCELADO' ? (
                  <>
                    <button 
                      disabled={loading}
                      onClick={handleSendEmail}
                      className="w-full bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold py-4 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-600/30 transition-all"
                    >
                      {loading ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400/30 border-t-blue-400"></div>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                          Enviar a {email || 'Correo'}
                        </>
                      )}
                    </button>
                    
                    {!isCancellationExpired() ? (
                      <button 
                        disabled={loading}
                        onClick={handleCancel}
                        className="w-full text-red-500/60 hover:text-red-400 text-xs font-bold py-2 transition-all"
                      >
                        SOLICITAR CANCELACIÓN
                      </button>
                    ) : (
                      <p className="text-slate-600 text-[10px] italic px-4">
                        Periodo de cancelación en portal expirado.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-xs text-red-400 font-bold uppercase tracking-wider">
                    Factura Cancelada
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={() => {
                setStep(1); setTicketData(null); setFolioValue(''); setPinValue(''); setTotalValue(''); setRfc('');
              }}
              className="text-slate-500 hover:text-white text-xs font-bold tracking-widest uppercase transition-colors"
            >
              ← Facturar otro ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
