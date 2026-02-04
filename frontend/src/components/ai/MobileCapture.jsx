import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import './VisionAIModal.css'; // Reutilizamos estilos o creamos específicos

const MobileCapture = () => {
    const { sessionId } = useParams();
    const [step, setStep] = useState('camera'); // 'camera', 'capturing', 'success'
    const [error, setError] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        document.body.style.backgroundColor = '#0f172a';
        if (step === 'camera') {
            startCamera();
        }
        return () => {
            stopCamera();
            document.body.style.backgroundColor = '';
        };
    }, [step]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
            }
        } catch (err) {
            setError("No se pudo acceder a la cámara. Verifica los permisos.");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const captureAndUpload = async () => {
        if (videoRef.current && canvasRef.current) {
            setStep('capturing');
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const base64Image = canvas.toDataURL('image/jpeg', 0.7);

            try {
                // Notificamos a la PC a través de Supabase
                const { error: uploadError } = await supabase
                    .from('ai_scan_sessions')
                    .update({ 
                        image_base64: base64Image,
                        status: 'completed' 
                    })
                    .eq('id', sessionId);

                if (uploadError) throw uploadError;
                setStep('success');
            } catch (err) {
                console.error(err);
                setError("Error al enviar la imagen. Inténtalo de nuevo.");
                setStep('camera');
            }
        }
    };

    return (
        <div className="mobile-capture-page" style={{ 
            minHeight: '100vh', 
            background: '#0f172a', 
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#10b981', padding: '8px', borderRadius: '12px' }}>
                        <span className="material-symbols-outlined" style={{ display: 'block' }}>auto_awesome</span>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>IA Vision</h2>
                        <span style={{ fontSize: '0.7rem', opacity: 0.6, fontWeight: 700, letterSpacing: '1px' }}>MOBILE SCANNER</span>
                    </div>
                </div>
                
                {error && <div className="vision-error" style={{ background: '#450a0a', color: '#f87171', padding: '16px', borderRadius: '16px', border: '1px solid #7f1d1d' }}>{error}</div>}

                {step === 'camera' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ position: 'relative', flex: 1, background: '#000', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <div style={{ position: 'absolute', inset: '40px', border: '2px solid rgba(16, 185, 129, 0.4)', borderRadius: '24px' }}></div>
                        </div>
                        <button 
                            onClick={captureAndUpload}
                            style={{ 
                                marginTop: '24px', 
                                padding: '20px', 
                                background: '#10b981', 
                                borderRadius: '24px', 
                                border: 'none', 
                                color: 'white', 
                                fontWeight: 800,
                                fontSize: '1.2rem',
                                boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)',
                                cursor: 'pointer'
                            }}
                        >
                            ENVIAR A LA PC
                        </button>
                    </div>
                )}

                {step === 'capturing' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                        <div className="ai-loader" style={{ width: '64px', height: '64px', border: '5px solid rgba(255,255,255,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                        <p style={{ fontWeight: 600, opacity: 0.8 }}>Sincronizando con mostrador...</p>
                    </div>
                )}

                {step === 'success' && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '30px' }}>
                        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '40px', borderRadius: '50%' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '80px', color: '#10b981' }}>check_circle</span>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 10px 0' }}>¡Captura Enviada!</h3>
                            <p style={{ opacity: 0.7, lineHeight: 1.6 }}>La información ha sido enviada exitosamente a la pantalla de la PC.</p>
                        </div>
                        <button onClick={() => setStep('camera')} style={{ background: 'transparent', border: '2px solid #1e293b', color: '#94a3b8', padding: '12px 24px', borderRadius: '16px', fontWeight: 600 }}>Toma otra foto</button>
                    </div>
                )}
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
};

export default MobileCapture;
