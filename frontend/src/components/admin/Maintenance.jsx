import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase';
import { maintenanceService } from '../../services/maintenanceService';
import { terminalService } from '../../services/terminalService';
import './Maintenance.css';

const Maintenance = () => {
    const navigate = useNavigate();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [masterPin, setMasterPin] = useState('');
    const [pinError, setPinError] = useState('');

    const [loading, setLoading] = useState(false);
    const [confirmation, setConfirmation] = useState('');
    const [message, setMessage] = useState({ text: '', type: '' });
    const [options, setOptions] = useState({
        resetTerminals: true,
        resetTransactions: true,
        resetProfiles: false
    });

    const [terminals, setTerminals] = useState([]);
    const [systemHealth, setSystemHealth] = useState({ status: 'checking', database: 'checking' });
    const [cloudHealth, setCloudHealth] = useState({ status: 'checking', database: 'checking' });
    const [auditLogs, setAuditLogs] = useState([]);

    const fetchTerminals = async () => {
        try {
            const data = await terminalService.getTerminals();
            setTerminals(data);
        } catch (error) {
            console.error('Error fetching terminals:', error);
        }
    };

    const fetchHealth = async (pin) => {
        // Mostrar estado de carga visualmente
        setSystemHealth({ status: 'checking', database: 'checking' });
        setCloudHealth({ status: 'checking', database: 'checking' });

        // Verificar API Local
        const local = await maintenanceService.getSystemHealth(pin);
        setSystemHealth(local);

        // Verificar API Global (Supabase)
        const cloud = await maintenanceService.getGlobalHealth(pin);
        setCloudHealth(cloud);
    };

    const fetchLogs = async (pin) => {
        try {
            const data = await maintenanceService.getAdminLogs(pin);
            setAuditLogs(data.logs || []);
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    React.useEffect(() => {
        if (isAuthorized) {
            fetchTerminals();
            fetchHealth(masterPin);
            fetchLogs(masterPin);
            
            // Refrescar salud cada 30 segundos
            const interval = setInterval(() => fetchHealth(masterPin), 30000);
            return () => clearInterval(interval);
        }
    }, [isAuthorized]);

    const handlePinSubmit = (e) => {
        e.preventDefault();
        if (masterPin === '2026SOP') {
            setIsAuthorized(true);
            setPinError('');
        } else {
            setPinError('PIN Maestro incorrecto. Acceso denegado.');
            setMasterPin('');
        }
    };

    if (!isAuthorized) {
        return (
            <div className="maintenance-lock-screen">
                <div className="lock-card">
                    <span className="material-icons-outlined lock-icon">admin_panel_settings</span>
                    <h2>Soporte Técnico Especializado</h2>
                    <p>Ingrese el PIN Maestro para acceder a las herramientas de bajo nivel.</p>
                    <form onSubmit={handlePinSubmit}>
                        <input 
                            type="password" 
                            placeholder="PIN de Seguridad"
                            value={masterPin}
                            onChange={(e) => setMasterPin(e.target.value)}
                            autoFocus
                        />
                        {pinError && <p className="error-text">{pinError}</p>}
                        <button type="submit" className="btn-auth">Validar Acceso</button>
                    </form>
                </div>
            </div>
        );
    }

    const handleReset = async (nuclearParam = false) => {
        const isNuclear = nuclearParam === true;
        const expectedPhrase = isNuclear ? 'BORRAR-TODO' : 'RESET';
        const userInput = confirmation.trim();
        
        if (userInput !== expectedPhrase) {
            setMessage({ text: `Por favor, escribe ${expectedPhrase} exactamente para confirmar.`, type: 'error' });
            return;
        }

        const warningMsg = isNuclear 
            ? '¡ADVERTENCIA NUCLEAR! Se borrará absolutamente TODO. ¿Estás 100% seguro?'
            : '¿Estás SEGURO de que deseas realizar esta acción?';

        if (!window.confirm(warningMsg)) {
            return;
        }

        setLoading(true);
        setMessage({ text: '', type: '' });

        try {
            const result = await maintenanceService.resetProjectData({
                ...options,
                factoryReset: isNuclear,
                masterPin // Enviamos el PIN a la API local
            });
            
            if (result.success) {
                setMessage({ 
                    text: result.message || 'Operación completada con éxito.', 
                    type: 'success' 
                });
                
                fetchLogs(masterPin); // Refrescar logs para ver la acción

                if (isNuclear) {
                    maintenanceService.resetLocalTerminal();
                    await supabase.auth.signOut();
                    setTimeout(() => {
                        window.location.href = '/#/login';
                        window.location.reload();
                    }, 3000);
                } else if (options.resetTerminals) {
                    setTimeout(() => window.location.reload(), 2000);
                }
            }
        } catch (error) {
            setMessage({ text: 'Error: ' + error.message, type: 'error' });
        } finally {
            setLoading(false);
            setConfirmation('');
        }
    };

    return (
        <div className="maintenance-container">
            <header className="maintenance-header">
                <button 
                    onClick={() => navigate('/configuracion')}
                    style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                    <span className="material-icons-outlined">arrow_back</span>
                    Volver a Configuración
                </button>
                <h1>Administración y Mantenimiento</h1>
                <p>Gestiona la limpieza de datos y licencias del sistema.</p>
            </header>

            {/* MONITOR DE SALUD DEL SISTEMA */}
            <div className="health-monitor">
                <div className="health-status-info">
                   {/* Estado Local */}
                   <div className="status-item">
                        <span className="material-icons-outlined">lan</span>
                        <strong>API Local:</strong>
                        <span className={`status-indicator ${systemHealth.status === 'Operational' ? 'online' : systemHealth.status === 'checking' ? 'checking' : 'offline'}`}>
                            {systemHealth.status === 'Operational' ? 'En línea' : systemHealth.status === 'checking' ? '...' : 'Offline'}
                        </span>
                   </div>

                   {/* Estado Nube (Supabase) */}
                   <div className="status-item">
                        <span className="material-icons-outlined">public</span>
                        <strong>API Global:</strong>
                        <span className={`status-indicator ${cloudHealth.status === 'Operational' ? 'online' : cloudHealth.status === 'checking' ? 'checking' : 'offline'}`}>
                            {cloudHealth.status === 'Operational' ? 'Conectada' : cloudHealth.status === 'checking' ? '...' : 'Inactiva'}
                        </span>
                   </div>

                   <div className="status-item">
                        <span className="material-icons-outlined">storage</span>
                        <strong>Base de Datos:</strong>
                        <span className={`status-indicator ${cloudHealth.database === 'Connected' ? 'online' : cloudHealth.database === 'checking' ? 'checking' : 'offline'}`}>
                            {cloudHealth.database === 'Connected' ? 'Vinculada' : cloudHealth.database === 'checking' ? '...' : 'Error'}
                        </span>
                   </div>
                </div>
                <button className="btn-icon" onClick={() => fetchHealth(masterPin)} title="Refrescar Estado">
                    <span className="material-icons-outlined">refresh</span>
                </button>
            </div>

            <div className="maintenance-card warning">
                <div className="warning-icon">⚠️</div>
                <div className="warning-content">
                    <h2>Zona de Peligro</h2>
                    <p>Acciones integradas con Auditoría Forense 2026. Todas las acciones quedan registradas.</p>
                </div>
            </div>

            <div className="maintenance-content">
                <section className="reset-section">
                    <h3>Opciones de Reset</h3>
                    <div className="options-grid">
                        <label className="option-item">
                            <input 
                                type="checkbox" 
                                checked={options.resetTerminals} 
                                onChange={(e) => setOptions({...options, resetTerminals: e.target.checked})}
                            />
                            <span>
                                <strong>Resetear Dispositivos</strong>
                                <small>Libera licencias de terminales registradas.</small>
                            </span>
                        </label>

                        <label className="option-item">
                            <input 
                                type="checkbox" 
                                checked={options.resetTransactions} 
                                onChange={(e) => setOptions({...options, resetTransactions: e.target.checked})}
                            />
                            <span>
                                <strong>Limpiar Transacciones</strong>
                                <small>Ventas y Cortes. Mantiene productos.</small>
                            </span>
                        </label>

                        <label className="option-item">
                            <input 
                                type="checkbox" 
                                checked={options.resetProfiles} 
                                onChange={(e) => setOptions({...options, resetProfiles: e.target.checked})}
                            />
                            <span>
                                <strong>Preservar solo Administrador</strong>
                                <small>Elimina cuentas de empleados secundarios.</small>
                            </span>
                        </label>
                    </div>

                    <div className="confirmation-box">
                        <p>Escriba <strong>RESET</strong> para habilitar:</p>
                        <input 
                            type="text" 
                            placeholder="Escribe RESET aquí"
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            disabled={loading}
                        />
                        <button 
                            className={`btn-reset ${confirmation.trim() === 'RESET' ? 'active' : ''}`}
                            onClick={() => handleReset(false)}
                            disabled={loading || confirmation.trim() !== 'RESET'}
                        >
                            {loading ? 'Procesando...' : 'Ejecutar Acción'}
                        </button>
                    </div>

                    {message.text && (
                        <div className={`status-message ${message.type}`}>
                            {message.text}
                        </div>
                    )}
                </section>

                <section className="reset-section">
                    <h3>Sesiones de Caja</h3>
                    <p className="section-description">Forzar el cierre de cajas abiertas en otros dispositivos.</p>
                    <div className="utility-box">
                        <button 
                            className="btn-warning"
                            onClick={async () => {
                                if (window.confirm('¿Forzar cierre de todas las cajas?')) {
                                    setLoading(true);
                                    try {
                                        await maintenanceService.forceCloseAllSessions();
                                        setMessage({ text: 'Sesiones cerradas.', type: 'success' });
                                    } catch (e) {
                                        setMessage({ text: 'Error: ' + e.message, type: 'error' });
                                    } finally {
                                        setLoading(false);
                                    }
                                }
                            }}
                            disabled={loading}
                        >
                            <span className="material-icons-outlined">lock_reset</span>
                            {loading ? 'Cerrando...' : 'Forzar Cierre Global'}
                        </button>
                    </div>
                </section>

                <section className="maintenance-section">
                    <h3>Auditoría Forense (Últimos Movimientos)</h3>
                    <p className="section-description">Registro inmutable de acciones realizadas con el PIN Maestro.</p>
                    <div className="logs-table-wrapper">
                        {auditLogs.length === 0 ? (
                            <p className="empty-msg">No hay registros de auditoría.</p>
                        ) : (
                            <table className="maintenance-table">
                                <thead>
                                    <tr>
                                        <th>Acción</th>
                                        <th>Detalles</th>
                                        <th>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map(log => (
                                        <tr key={log.id}>
                                            <td><span className="log-action">{log.action}</span></td>
                                            <td><small>{log.details}</small></td>
                                            <td className="log-date">{new Date(log.createdAt).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>

                <section className="maintenance-section">
                    <h3>Dispositivos Registrados</h3>
                    <div className="terminals-list">
                        {terminals.length === 0 ? (
                            <p className="empty-msg">No hay terminales.</p>
                        ) : (
                            <table className="maintenance-table">
                                <thead>
                                    <tr>
                                        <th>Equipo</th>
                                        <th>Estado</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {terminals.map(t => (
                                        <tr key={t.id}>
                                            <td><strong>{t.name}</strong></td>
                                            <td>
                                                <span className={`status-badge ${t.is_main ? 'main' : 'secondary'}`}>
                                                    {t.is_main ? 'Principal' : 'Secundaria'}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="btn-icon delete" onClick={async () => {
                                                    if (window.confirm(`¿Eliminar "${t.name}"?`)) {
                                                        try {
                                                            await terminalService.deleteTerminal(t.id);
                                                            fetchTerminals();
                                                            setMessage({ text: `Terminal "${t.name}" eliminada.`, type: 'success' });
                                                        } catch (error) {
                                                            console.error('Error deleting terminal:', error);
                                                            setMessage({ text: 'Error al eliminar terminal: ' + error.message, type: 'error' });
                                                        }
                                                    }
                                                }}><span className="material-icons-outlined">delete_forever</span></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            </div>

            <section className="reset-section nuclear">
                <h3 className="text-danger">☢️ Reset de Fábrica</h3>
                <div className="confirmation-box nuclear">
                    <p>Confirmar con <strong>BORRAR-TODO</strong>:</p>
                    <input 
                        type="text" 
                        value={confirmation}
                        onChange={(e) => setConfirmation(e.target.value)}
                        className="nuclear-input"
                    />
                    <button 
                        className={`btn-nuclear ${confirmation.trim() === 'BORRAR-TODO' ? 'active' : ''}`}
                        disabled={loading || confirmation.trim() !== 'BORRAR-TODO'}
                        onClick={() => handleReset(true)}
                    >
                        {loading ? 'Destruyendo...' : 'RESETEO TOTAL'}
                    </button>
                </div>
            </section>
        </div>
    );
};

export default Maintenance;
