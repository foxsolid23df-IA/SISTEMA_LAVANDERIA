import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../../contexts/SettingsContext";
import { shelvingService } from "../../services/shelvingService";
import { formatearDinero } from "../../utils";
import Swal from "sweetalert2";

export const ShelfScanner = () => {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const inputRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recentScans, setRecentScans] = useState([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    // Autofocus al montar
    if (inputRef.current) inputRef.current.focus();

    // Cargar escaneos recientes
    try {
      const saved = localStorage.getItem('shelf_recent_scans');
      if (saved) setRecentScans(JSON.parse(saved));
    } catch (e) {
      setRecentScans([]);
    }
  }, []);

  // Re-enfocar después de cada búsqueda
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, result]);

  const handleSearch = async (term = searchTerm) => {
    if (!term.trim()) return;
    setLoading(true);
    try {
      const data = await shelvingService.scanShelf(term.trim());
      if (data) {
        setResult(data);
        const newScan = {
          orderId: data.order_id,
          shelf: data.shelf?.label,
          client: data.order?.customer?.name,
          folio: data.order?.folio,
          timestamp: new Date().toISOString()
        };
        const updated = [newScan, ...recentScans.filter(s => s.orderId !== data.order_id)].slice(0, 20);
        setRecentScans(updated);
        localStorage.setItem('shelf_recent_scans', JSON.stringify(updated));
      } else {
        Swal.fire("No encontrada", "No se encontró asignación para este código", "warning");
      }
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    // Detectar Enter (scanners de código de barras envían Enter automáticamente)
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleRemoveAssignment = async () => {
    if (!result) return;
    const { isConfirmed } = await Swal.fire({
      title: "¿Retirar ropa?",
      text: "Se marcará como retirada de la estantería",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef4444"
    });
    if (!isConfirmed) return;
    try {
      await shelvingService.unassignOrder(result.order_id);
      Swal.fire("Retirada", "La ropa fue retirada de la estantería", "success");
      setResult(null);
      setSearchTerm("");
      if (inputRef.current) inputRef.current.focus();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const startCameraScan = async () => {
    setScanning(true);
    try {
      // Usar la API de cámara del navegador
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Crear elemento de video temporal
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;

      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;inset:0;z-index:9999;background:black;display:flex;align-items:center;justify-content:center;';
      container.appendChild(video);

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancelar';
      cancelBtn.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);padding:12px 24px;background:#ef4444;color:white;border:none;border-radius:10px;font-size:16px;z-index:10000;cursor:pointer;';
      cancelBtn.onclick = () => {
        stream.getTracks().forEach(t => t.stop());
        document.body.removeChild(container);
        document.body.removeChild(cancelBtn);
        setScanning(false);
      };
      document.body.appendChild(container);
      document.body.appendChild(cancelBtn);

      // Nota: Para escaneo QR real se necesita html5-qrcode
      // Por ahora mostramos la cámara y pedimos input manual
      Swal.fire({
        title: "Cámara activada",
        text: "Para escanear códigos QR reales, instala la librería html5-qrcode. Por ahora ingresa el código manualmente.",
        icon: "info",
        timer: 5000
      }).then(() => {
        stream.getTracks().forEach(t => t.stop());
        if (container.parentNode) document.body.removeChild(container);
        if (cancelBtn.parentNode) document.body.removeChild(cancelBtn);
        setScanning(false);
        if (inputRef.current) inputRef.current.focus();
      });
    } catch (err) {
      console.error("Error accediendo a cámara:", err);
      Swal.fire("Error", "No se pudo acceder a la cámara", "error");
      setScanning(false);
    }
  };

  const clearRecentScans = () => {
    setRecentScans([]);
    localStorage.removeItem('shelf_recent_scans');
  };

  return (
    <div style={{ maxWidth: 500, margin: '0 auto', padding: '1.5rem', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, border: '1px solid #e2e8f0',
          background: '#fff', cursor: 'pointer'
        }}>
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>
          <span className="material-icons-outlined" style={{ verticalAlign: 'middle' }}>qr_code_scanner</span>
          Escanear Estantería
        </h1>
      </div>

      {/* Input con autofocus */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escanea o escribe el código (A3, B5...)"
          autoFocus
          style={{
            flex: 1, padding: '0.875rem 1rem', borderRadius: 10,
            border: '2px solid #e2e8f0', fontSize: '1.1rem',
            outline: 'none', fontWeight: 600, letterSpacing: '0.05em'
          }}
        />
        <button onClick={() => handleSearch()} disabled={loading || !searchTerm.trim()}
          style={{
            padding: '0.875rem 1.5rem', borderRadius: 10, border: 'none',
            background: '#10b981', color: 'white', fontWeight: 600,
            cursor: loading ? 'wait' : 'pointer'
          }}>
          {loading ? '...' : 'Buscar'}
        </button>
      </div>

      {/* Botón cámara */}
      <button onClick={startCameraScan} disabled={scanning}
        style={{
          width: '100%', padding: '0.75rem', borderRadius: 10,
          border: '2px dashed #cbd5e1', background: '#f8fafc',
          color: '#64748b', fontWeight: 600, cursor: 'pointer',
          marginBottom: '1.5rem', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: '0.5rem'
        }}>
        <span className="material-icons-outlined">photo_camera</span>
        {scanning ? 'Abriendo cámara...' : 'Escanear con cámara'}
      </button>

      {/* Resultado */}
      {result && (
        <div style={{
          background: '#fff', border: '2px solid #10b981', borderRadius: 12,
          padding: '1.5rem', marginBottom: '1.5rem'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{
              display: 'inline-block', padding: '0.75rem 1.5rem',
              background: '#d1fae5', borderRadius: 10
            }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#065f46' }}>
                {result.shelf?.label || 'N/A'}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>Ubicación</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              ['Orden', `#${result.order?.folio || result.order?.id}`],
              ['Cliente', result.order?.customer?.name || 'N/A'],
              ['Total', formatearDinero(result.order?.total)],
              ['Entrega', result.order?.promised_at ? new Date(result.order.promised_at).toLocaleDateString() : 'N/A'],
              ['Servicios', result.order?.order_items?.map(i => i.product_name).join(', ') || 'N/A']
            ].map(([label, value], i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{label}</span>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{value}</span>
              </div>
            ))}
          </div>

          <button onClick={handleRemoveAssignment} style={{
            width: '100%', padding: '0.875rem', borderRadius: 10, border: 'none',
            background: '#fee2e2', color: '#991b1b', fontWeight: 700,
            cursor: 'pointer', marginTop: '1rem', fontSize: '0.95rem'
          }}>
            Retirar de estantería
          </button>
        </div>
      )}

      {/* Escaneos recientes */}
      {recentScans.length > 0 && !result && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', margin: 0 }}>
              Últimos escaneos
            </h3>
            <button onClick={clearRecentScans} style={{
              fontSize: '0.7rem', color: '#94a3b8', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline'
            }}>
              Limpiar
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentScans.map((scan, i) => (
              <div key={i}
                onClick={() => { setSearchTerm(String(scan.orderId)); handleSearch(String(scan.orderId)); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem', background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, cursor: 'pointer'
                }}>
                <span style={{
                  padding: '0.25rem 0.5rem', borderRadius: 6,
                  background: '#d1fae5', color: '#065f46', fontWeight: 700, fontSize: '0.75rem'
                }}>
                  {scan.shelf}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>#{scan.folio}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{scan.client}</div>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  {new Date(scan.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShelfScanner;
