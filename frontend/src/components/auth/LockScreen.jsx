import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../supabase';
import Swal from 'sweetalert2';
import './LockScreen.css';

export const LockScreen = () => {
    const [pin, setPin] = useState('');
    const [isValidating, setIsValidating] = useState(false);
    const { loginWithPin, unlockAsOwner, storeName, logout, user, verifyMasterPin, verifyRecoveryCode } = useAuth();
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
            className="lock-screen" 
            onKeyDown={handleKeyDown} 
            tabIndex={0}
            ref={containerRef}
            style={{ outline: 'none' }}
        >
            <div className="lock-container">
                <div className="lock-header">
                    <button 
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-primary dark:hover:text-white transition-colors"
                        onClick={() => {
                            document.documentElement.classList.toggle('dark');
                            localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
                        }}
                        title="Cambiar Tema"
                    >
                        <span className="material-icons-outlined">dark_mode</span>
                    </button>
                    <div className="store-name">{storeName || 'Mi Tienda'}</div>
                    <div className="lock-icon">🔐</div>
                    <h1>Pantalla Bloqueada</h1>
                    <p>Ingresa tu PIN para comenzar</p>
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
                    <button className="key-btn clear" onClick={handleClear} disabled={isValidating}>C</button>
                    <button className="key-btn" onClick={() => handlePinInput('0')} disabled={isValidating}>0</button>
                    <button className="key-btn backspace" onClick={handleBackspace} disabled={isValidating}>⌫</button>
                </div>

                <button
                    className="unlock-btn"
                    onClick={handleSubmit}
                    disabled={pin.length < 4 || isValidating}
                >
                    {isValidating ? 'Verificando...' : 'Desbloquear'}
                </button>

                <div className="lock-actions">
                    <button className="owner-btn" onClick={handleOwnerAccess}>
                        👑 Soy el Propietario
                    </button>
                    <button className="logout-btn" onClick={handleLogout}>
                        🚪 Cerrar Sesión de la Tienda
                    </button>
                </div>

                <div className="lock-hint">
                    <small>💡 Ingresa tu PIN de 4-6 dígitos y presiona "Desbloquear"</small>
                </div>
            </div>
        </div>
    );
};
