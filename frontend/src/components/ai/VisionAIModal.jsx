import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabase';
import { QRCodeSVG } from 'qrcode.react';
import { config } from '../../config';
import './VisionAIModal.css';

const VisionAIModal = ({ isOpen, onClose, onAccept }) => {
  const [step, setStep] = useState('choice'); // 'choice', 'camera', 'mobile', 'loading', 'result'
  const [sessionId, setSessionId] = useState(null);
  const [image, setImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  /* EFECTO SECUNDARIO: Iniciar Cámara o Móvil según Step */
  useEffect(() => {
    if (isOpen && step === 'camera') {
      setImage(null); // Limpiar imagen previa para ver la cámara limpia
      startCamera();
    } else if (isOpen && step === 'mobile') {
      startMobileSession();
    }
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

      let data;
      try {
        data = await response.json();
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Error del servidor (${response.status})`);
        }
        throw new Error("Error al procesar la respuesta del servidor.");
      }

      if (!response.ok) {
        throw new Error(data.error || `Error del servidor (${response.status})`);
      }

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

          {step === 'choice' && (
            <div className="choice-container" style={{ textAlign: 'center', padding: '10px' }}>
              <h4 style={{ marginBottom: '25px', fontSize: '1.2rem', color: '#1f2937', fontWeight: '800' }}>¿Cómo quieres escanear la prenda?</h4>
              
              <div className="choice-buttons" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <button 
                    onClick={() => setStep('camera')}
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
                        padding: '25px', borderRadius: '16px', border: 'none',
                        background: '#1f2937', color: 'white', cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#34d399' }}>webcam</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Cámara PC</span>
                </button>

                <button 
                    onClick={() => setStep('mobile')}
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px',
                        padding: '25px', borderRadius: '16px', border: 'none',
                        background: '#10b981', color: 'white', cursor: 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'white' }}>phone_iphone</span>
                  <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>Usar Celular</span>
                </button>
              </div>
            </div>
          )}

          {step === 'camera' && (
            <div className="camera-view-wrapper" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="camera-container" style={{ flex: 1, position: 'relative', overflow: 'hidden', borderRadius: '12px', background: 'black' }}>
                  {!image ? (
                      <>
                          <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              muted 
                              className="camera-feed" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div className="camera-overlay">
                              <div className="scan-area"></div>
                              <p>Encuadra la prenda aquí</p>
                          </div>
                      </>
                  ) : (
                      <img src={image} alt="Captura" className="captured-image" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  )}
              </div>

              <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '15px' }}>
                  {!image ? (
                      <>
                          <button 
                            onClick={() => setStep('choice')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '12px',
                                border: '1px solid #e5e7eb',
                                background: 'white',
                                color: '#374151',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.background = '#f3f4f6'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = 'white'; }}
                          >
                            Cambiar modo
                          </button>
                          
                          <button className="capture-btn" onClick={capturePhoto}>
                              <span className="material-symbols-outlined">photo_camera</span>
                              Capturar
                          </button>
                      </>
                  ) : (
                      <>
                          <button className="retry-btn" onClick={() => setImage(null)}>Repetir</button>
                          <button className="analyze-btn" onClick={() => analyzeImage(image)}>
                              <span className="material-symbols-outlined">auto_awesome</span>
                              Analizar con IA
                          </button>
                      </>
                  )}
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
                    // Usamos la URL de producción en Vercel para asegurar HTTPS y acceso a cámara.
                    const isLocalFile = window.location.protocol === 'file:';
                    const productionUrl = 'https://sistema-lavanderia-nu.vercel.app';
                    
                    const baseUrl = isLocalFile ? productionUrl : window.location.origin;
                    
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
            <div className="analysis-result fade-in">
                <div className="result-header">
                    <span className="material-symbols-outlined icon">check_circle</span>
                    <h3>Análisis Completado</h3>
                </div>

                <div className="image-preview-mini">
                    {image && <img src={image} alt="Prenda analizada" />}
                </div>

                <div className="result-grid">
                    <div className="result-item">
                        <label>Prenda / Marca</label>
                        <span>{analysis.prenda}</span>
                    </div>
                    <div className="result-item">
                        <label>Color</label>
                        <span>{analysis.color}</span>
                    </div>
                    <div className="result-item">
                        <label>Inspección Técnica</label>
                        <span className="status-badge" style={{ backgroundColor: '#eef2ff', color: '#4f46e5', fontWeight: 'bold' }}>
                            {analysis.estado}
                        </span>
                    </div>
                    <div className="result-item">
                        <label>Riesgo</label>
                        <div className="risk-meter">
                            <span className="risk-badge" style={{ 
                                backgroundColor: analysis.riesgo > 7 ? '#fee2e2' : (analysis.riesgo > 4 ? '#fef3c7' : '#ecfdf5'),
                                color: analysis.riesgo > 7 ? '#991b1b' : (analysis.riesgo > 4 ? '#92400e' : '#065f46')
                            }}>
                                {analysis.riesgo} / 10
                            </span>
                        </div>
                    </div>
                </div>

                <div className="suggestion-box">
                    <label><span className="material-symbols-outlined" style={{ verticalAlign: 'middle', fontSize: '18px' }}>science</span> Plan de Lavado Inteligente:</label>
                    <p>
                    {typeof analysis.sugerencia === 'object' 
                        ? JSON.stringify(analysis.sugerencia).replace(/[{}"]/g, ' ') 
                        : analysis.sugerencia}
                    </p>
                </div>

                <div className="result-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button className="retry-btn" onClick={reset} style={{ flex: 1 }}>Probar con otra prenda</button>
                    {onAccept && (
                    <button 
                        className="accept-btn" 
                        onClick={() => {
                        const report = `[IA INSPECCIÓN: ${analysis.prenda}] - Estado: ${analysis.estado}. Riesgo: ${analysis.riesgo}/10. Plan: ${analysis.sugerencia}`;
                        onAccept(report);
                        onClose();
                        }}
                        style={{ 
                        flex: 1, 
                        backgroundColor: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        padding: '12px', 
                        borderRadius: '12px', 
                        fontWeight: 'bold', 
                        cursor: 'pointer' 
                        }}
                    >
                        Vincular a Orden
                    </button>
                    )}
                </div>
            </div>
          )}
        </div>
        
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default VisionAIModal;
