import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabase';
import { QRCodeSVG } from 'qrcode.react';
import { config } from '../../config';
import './VisionAIModal.css';

const VisionAIModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState('camera'); // 'camera', 'capturing', 'analyzing', 'result', 'mobile_qr'
  const [sessionId, setSessionId] = useState(null);
  const [image, setImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isOpen && step === 'camera') {
      startCamera();
    }
    return () => stopCamera();
  }, [isOpen, step]);

  useEffect(() => {
    let subscription = null;

    if (step === 'mobile_qr' && sessionId) {
      subscription = supabase
        .channel(`ai_scan_${sessionId}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'ai_scan_sessions', 
            filter: `id=eq.${sessionId}` 
        }, async (payload) => {
          console.log('[VisionAI] Cambio detectado en sesión:', payload.new.status);
          if (payload.new.status === 'completed') {
            const imageData = payload.new.image_base64;
            
            // Si la imagen no viene en el payload (por ser muy pesada para realtime), la buscamos
            if (!imageData) {
                console.log('[VisionAI] Imagen no encontrada en realtime, descargando de la tabla...');
                const { data } = await supabase.from('ai_scan_sessions').select('image_base64').eq('id', sessionId).single();
                if (data?.image_base64) {
                    setImage(data.image_base64);
                    setStep('analyzing');
                    analyzeImage(data.image_base64);
                }
            } else {
                setImage(imageData);
                setStep('analyzing');
                analyzeImage(imageData);
            }
          }
        })
        .subscribe();
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [step, sessionId]);

  const startCamera = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Su navegador no soporta el acceso a la cámara o requiere HTTPS.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Cámara PC bloqueada (use localhost o active el modo celular).");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setImage(dataUrl);
      setStep('analyzing');
      analyzeImage(dataUrl);
    }
  };

  const analyzeImage = async (base64Data) => {
    try {
      // Intentamos usar la URL configurada, o por defecto el puente local 127.0.0.1
      // Esto permite que la versión Web hable con el motor de IA que corre en la PC del usuario.
      const apiUrl = config.api.baseUrl || 'http://127.0.0.1:3001';
      
      console.log('[VisionAI] Solicitando análisis a:', `${apiUrl}/api/ai/analyze-cloth`);
      
      const response = await fetch(`${apiUrl}/api/ai/analyze-cloth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Data }),
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error("El servidor de IA no encontró la ruta de análisis.");
        throw new Error(`Error del servidor (${response.status})`);
      }

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.analysis);
        setStep('result');
        if (data.isMock) {
          setError("Modo Demo: Ingresa tu API Key en el backend para resultados reales.");
        }
      } else {
        throw new Error(data.error || "Error en el análisis");
      }
    } catch (err) {
      console.error("AI Analysis Error:", err);
      let errorMsg = err.message;
      
      // Guía para el usuario sobre Mixed Content (HTTPS -> HTTP Localhost)
      if (window.location.protocol === 'https:' && (apiUrl.includes('127.0.0.1') || apiUrl.includes('localhost'))) {
          errorMsg = "Conexión local bloqueada por el navegador. Como estás en Vercel (Sitio Seguro), debes dar permiso para conectar con tu PC: Haz clic en el icono de AJUSTES/CANDADO junto a la URL y activa 'Contenido no seguro' (Insecure content).";
      }

      setError(errorMsg);
    }
  };

  const startMobileSession = async () => {
    setError(null); // Limpiar error de cámara de la PC
    try {
      const { data, error } = await supabase
        .from('ai_scan_sessions')
        .insert({ status: 'pending' })
        .select()
        .single();

      if (error) throw error;
      setSessionId(data.id);
      setStep('mobile_qr');
    } catch (err) {
      setError("Error al iniciar sesión móvil.");
    }
  };

  const reset = () => {
    setImage(null);
    setAnalysis(null);
    setStep('camera');
  };

  if (!isOpen) return null;

  return (
    <div className="vision-modal-overlay" onClick={onClose}>
      <div className="vision-modal-content" onClick={e => e.stopPropagation()}>
        <div className="vision-modal-header">
          <h3><span className="material-symbols-outlined">auto_awesome</span> IA Vision POC</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="vision-modal-body">
          {error && <div className="vision-error">{error}</div>}

          {step === 'camera' && (
            <div className="camera-container">
              {image && <img src={image} alt="Última Captura" className="preview-img-overlay" style={{ opacity: 0.5, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />}
              <video ref={videoRef} autoPlay playsInline muted />
              <div className="camera-controls">
                <button className="capture-btn" onClick={capturePhoto}>
                  <span className="material-symbols-outlined">photo_camera</span>
                  Capturar
                </button>
                <button className="mobile-btn" onClick={startMobileSession}>
                  <span className="material-symbols-outlined">qr_code_2</span>
                  Usar Celular
                </button>
              </div>
              {error && (
                <div style={{ marginTop: '10px', textAlign: 'center' }}>
                     <button className="retry-btn" onClick={() => { setError(null); reset(); }}>Intentar de nuevo</button>
                </div>
              )}
            </div>
          )}

          {step === 'mobile_qr' && (
            <div className="mobile-qr-container">
              <h4>Escanea con tu Celular</h4>
              <p>Captura la prenda sin cables ni apps instaladas.</p>
              <div className="qr-box">
                <QRCodeSVG 
                  value={(() => {
                    // En Electron (file://), window.location.origin no sirve para el móvil.
                    // Priorizamos la IP local o una URL de despliegue estable.
                    const isLocalFile = window.location.protocol === 'file:';
                    const baseUrl = isLocalFile 
                      ? `http://192.168.1.112:5173` // Tu IP actual (ideal para pruebas locales)
                      : window.location.origin;
                    
                    return `${baseUrl}/#/mobile-capture/${sessionId}`;
                  })()} 
                  size={200}
                  level="H"
                />
              </div>
              <p className="qr-hint">Esperando captura del móvil...</p>
              <button className="retry-btn" onClick={() => setStep('camera')}>Volver a Cámara PC</button>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="analyzing-container">
              <img src={image} alt="Captura" className="preview-img" />
              <div className="loader-container">
                <div className="ai-loader"></div>
                <p>La IA está analizando la prenda...</p>
              </div>
            </div>
          )}

          {step === 'result' && analysis && (
            <div className="result-container">
              <div className="result-header">
                <img src={image} alt="Captura" className="result-img-mini" />
                <h4>Análisis Completado</h4>
              </div>
              <div className="result-grid">
                <div className="result-item">
                  <label>Tipo de Prenda</label>
                  <span>{analysis.prenda}</span>
                </div>
                <div className="result-item">
                  <label>Color Detectado</label>
                  <span>{analysis.color}</span>
                </div>
                <div className="result-item">
                  <label>Estado/Notas</label>
                  <span className="status-badge">{analysis.estado}</span>
                </div>
              </div>
              <div className="suggestion-box">
                <label>Sugerencia de Tratamiento:</label>
                <p>{analysis.sugerencia}</p>
              </div>
              <button className="retry-btn" onClick={reset}>Probar con otra prenda</button>
            </div>
          )}
        </div>
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default VisionAIModal;
