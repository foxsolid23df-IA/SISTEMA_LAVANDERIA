import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabase';
import { QRCodeSVG } from 'qrcode.react';
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
        }, payload => {
          if (payload.new.status === 'completed' && payload.new.image_base64) {
            setImage(payload.new.image_base64);
            setStep('analyzing');
            analyzeImage(payload.new.image_base64);
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
      // Intentar conectar con la IP del host si no es localhost
      const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
      const response = await fetch(`http://${host}:3001/api/ai/analyze-cloth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: base64Data }),
      });

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
      setError("Error al conectar con la IA. Asegúrate de que el backend esté corriendo.");
      setStep('camera');
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
