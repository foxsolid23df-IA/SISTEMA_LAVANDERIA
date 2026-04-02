import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../supabase';
import Swal from 'sweetalert2';
import './LockScreen.css';

export const LockScreen = () => {
    const [pin, setPin] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const { loginWithPin, unlockAsOwner, storeName, logout, user, verifyMasterPin, verifyRecoveryCode, canLogout } = useAuth();
    const containerRef = React.useRef(null);

    // Auto-enfocar el contenedor al montar para habilitar teclado de inmediato
    React.useEffect(() => {
        if (containerRef.current) {
            containerRef.current.focus();
        }
    }, []);

    const handlePinInput = (digit) => {
        if (pin.length < 6 && !isValidating) {
            setPin(prev => prev + digit);
        }
    };

    const handleBackspace = () => {
        if (!isValidating) {
            setPin(prev => prev.slice(0, -1));
        }
    };

    const handleClear = () => {
        if (!isValidating) {
            setPin('');
        }
    };

    const handleSubmit = async () => {
        if (pin.length < 4 || isValidating) {
            return;
        }

        setIsValidating(true);

        try {
            const staff = await loginWithPin(pin);
            Swal.fire({
                title: `¡Bienvenido!`,
                text: `${staff.name} - ${staff.role.toUpperCase()}`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (error) {
            Swal.fire('PIN Incorrecto', 'Verifica tu PIN e intenta de nuevo', 'error');
            setPin('');
        } finally {
            setIsValidating(false);
        }
    };

    const handleKeyDown = (e) => {
        if (isValidating) return;

        // Números (Teclado principal y numérico)
        if (/^[0-9]$/.test(e.key)) {
            handlePinInput(e.key);
        } 
        // Borrar uno atrás
        else if (e.key === 'Backspace') {
            handleBackspace();
        }
        // Borrar todo
        else if (e.key === 'Delete' || e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
            handleClear();
        }
        // Validar/Desbloquear
        else if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    const handleOwnerAccess = async () => {
        // 1. Intentar acceso con PIN Maestro primero si está configurado
        const { value: masterPin } = await Swal.fire({
            title: '👑 Acceso Propietario',
            text: 'Ingresa tu PIN Maestro de 6 dígitos',
            input: 'password',
            inputAttributes: {
                maxlength: 6,
                autocapitalize: 'off',
                autocorrect: 'off'
            },
            inputPlaceholder: 'PIN Maestro',
            showCancelButton: true,
            confirmButtonText: 'Validar PIN',
            cancelButtonText: 'Usar Contraseña',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b'
        });

        // Si canceló o cerró el modal
        if (masterPin === undefined) return;

        // Si pulsó "Usar Contraseña" (masterPin será null o vacío si no escribió nada y cerró, 
        // pero Swal devuelve false o undefined dependiendo de como se cierre)
        // En este caso, si no hay PIN, vamos al flujo de contraseña
        if (!masterPin) {
            return await handleOwnerAccessWithPassword();
        }

        const result = await verifyMasterPin(masterPin);
        
        if (result.success) {
            unlockAsOwner();
            Swal.fire({
                title: '¡Bienvenido, Propietario!',
                text: result.warning || '',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } else {
            Swal.fire('PIN Incorrecto', 'El PIN Maestro no es válido.', 'error');
        }
    };

    const handleOwnerAccessWithPassword = async () => {
        const { value: password } = await Swal.fire({
            title: '🔐 Acceso por Contraseña',
            html: `
                <p style="margin-bottom: 15px; color: #666;">
                    Ingresa tu contraseña de cuenta (Supabase)
                </p>
                <p style="font-size: 11px; color: #ef4444; font-weight: bold;">
                    ⚠️ Se recomienda configurar un PIN Maestro en Configuración para evitar usar tu contraseña principal.
                </p>
            `,
            input: 'password',
            inputPlaceholder: 'Tu contraseña',
            showCancelButton: true,
            confirmButtonText: 'Verificar',
            cancelButtonText: 'Cancelar'
        });

        if (!password) return;

        Swal.fire({ title: 'Verificando...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: user?.email,
                password: password
            });

            if (error) {
                Swal.fire('Error', 'Contraseña incorrecta.', 'error');
                return;
            }

            unlockAsOwner();
            Swal.fire({ title: 'Acceso Concedido', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', 'No se pudo verificar la identidad.', 'error');
        }
    };

    const handleLogout = async () => {
        const { value: credential, dismiss } = await Swal.fire({
            title: '🚪 Desvincular Tienda',
            text: 'Ingresa tu PIN Maestro o Código de Recuperación',
            input: 'password',
            inputPlaceholder: 'PIN o Código',
            showCancelButton: true,
            confirmButtonText: 'Confirmar Cierre',
            cancelButtonText: 'Usar Contraseña',
            confirmButtonColor: '#ef4444'
        });

        if (dismiss === Swal.DismissReason.cancel) {
            return await handleLogoutWithPassword();
        }

        if (!credential) return;

        const isPinValid = (await verifyMasterPin(credential)).success;
        const isRecoveryValid = await verifyRecoveryCode(credential);

        if (isPinValid || isRecoveryValid) {
            logout();
            Swal.fire({ title: 'Sesión Finalizada', icon: 'success', timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire('Error', 'Credencial inválida. No se puede desvincular el equipo.', 'error');
        }
    };

    const handleLogoutWithPassword = async () => {
        const { value: password } = await Swal.fire({
            title: '🚪 Desvincular con Contraseña',
            text: 'Usa tu contraseña maestra para desvincular este dispositivo.',
            input: 'password',
            inputPlaceholder: 'Contraseña de cuenta',
            showCancelButton: true,
            confirmButtonText: 'Desvincular Ahora',
            confirmButtonColor: '#ef4444'
        });

        if (!password) return;

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: user?.email,
                password: password
            });

            if (error) {
                Swal.fire('Error', 'Contraseña incorrecta.', 'error');
                return;
            }

            logout();
            Swal.fire({ title: 'Sesión Finalizada', icon: 'success', timer: 1500, showConfirmButton: false });
        } catch (error) {
            Swal.fire('Error', 'Ocurrió un error inesperado.', 'error');
        }
    };

    return (
        <div 
            className="lock-screen-split" 
            onKeyDown={handleKeyDown} 
            tabIndex={0}
            ref={containerRef}
            style={{ outline: 'none' }}
        >

            {/* Seccion Izquierda: Imagen de fondo */}
            <div className="lock-left-panel">
                {/* Vacío ya que la imagen que cargará el usuario del chat ya lo incluye */}
            </div>

            {/* Seccion Derecha: Tarjeta Neon como Stitch */}
            <div className="lock-right-panel">
                <div className="ambient-glow"></div>
                
                <div className="lock-neon-card">
                    <div className="lock-neon-header">
                        {/* Candado SVG con degrade cian */}
                        <div className="lock-icon">
                            <svg width="68" height="68" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17 11H7C5.89543 11 5 11.8954 5 13V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V13C19 11.8954 18.1046 11 17 11Z" fill="url(#lock-grad)" />
                                <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="url(#lock-grad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                                <circle cx="12" cy="16" r="1.8" fill="#121A2D" />
                                <defs>
                                    <linearGradient id="lock-grad" x1="5" y1="2" x2="19" y2="21" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#0CD9A6" />
                                        <stop offset="1" stopColor="#01A382" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        <h1>Pantalla Bloqueada</h1>
                        <p>Ingresa tu PIN para continuar</p>
                    </div>

                    <div className="pin-display">
                        {[...Array(6)].map((_, i) => (
                            <div
                                key={i}
                                className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
                            />
                        ))}
                    </div>

                    <div className="pin-keypad">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
                            <button
                                key={digit}
                                className="key-btn"
                                onClick={() => handlePinInput(digit.toString())}
                                disabled={isValidating}
                            >
                                {digit}
                            </button>
                        ))}
                        <button className="key-btn clear-btn" onClick={handleClear} disabled={isValidating}>C</button>
                        <button className="key-btn" onClick={() => handlePinInput('0')} disabled={isValidating}>0</button>
                        <button className="key-btn backspace-btn" onClick={handleBackspace} disabled={isValidating}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                                <line x1="18" y1="9" x2="12" y2="15"></line>
                                <line x1="12" y1="9" x2="18" y2="15"></line>
                            </svg>
                        </button>
                    </div>

                    <button
                        className="unlock-btn"
                        onClick={handleSubmit}
                        disabled={pin.length < 4 || isValidating}
                    >
                        {isValidating ? 'Desbloqueando...' : 'Desbloquear'}
                    </button>
                </div>

                <div className="lock-card-footer">
                    <button className="footer-action-btn" onClick={handleOwnerAccess}>Soy Propietario</button>
                    {canLogout && (
                        <button className="footer-action-btn" onClick={handleLogout}>Cerrar Sesión</button>
                    )}
                </div>
            </div>
        </div>
    );
};
