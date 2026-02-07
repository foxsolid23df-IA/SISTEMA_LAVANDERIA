import React, { useState, useEffect } from 'react';
import { adminLicenseService } from '../../services/adminLicenseService';
import { invitationService } from '../../services/invitationService';
import { supabase } from '../../supabase';
import Swal from 'sweetalert2';

export const MasterLicenseManager = () => {
    const [masterPin, setMasterPin] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('licenses'); // 'licenses' | 'invitations'

    // Estado para nueva invitación
    const [invitationNote, setInvitationNote] = useState('');
    const [generatedCode, setGeneratedCode] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Intentar obtener perfiles para validar el PIN y el Rol
        const response = await adminLicenseService.getProfiles(masterPin);
        setLoading(false);

        if (response.success) {
            setProfiles(response.data);
            setIsAuthenticated(true);
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            Toast.fire({
                icon: 'success',
                title: 'Acceso concedido'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Acceso Denegado',
                text: response.error || 'PIN incorrecto o falta de permisos.'
            });
        }
    };

    const refreshProfiles = async () => {
        setLoading(true);
        const response = await adminLicenseService.getProfiles(masterPin);
        if (response.success) {
            setProfiles(response.data);
        }
        setLoading(false);
    };

    const handleUpdateLicense = async (profile, daysToAdd) => {
        const currentExpiry = profile.license_expires_at ? new Date(profile.license_expires_at) : new Date();
        // Si ya venció, usar fecha actual como base. Si no, usar la fecha de vencimiento.
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        
        const newDate = new Date(baseDate);
        newDate.setDate(newDate.getDate() + daysToAdd); // Sumar días

        const result = await Swal.fire({
            title: '¿Confirmar renovación?',
            html: `Cliente: <b>${profile.store_name || 'Sin nombre'}</b><br/>
                   Nueva fecha: <b>${newDate.toLocaleDateString()}</b>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, renovar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            setLoading(true);
            const response = await adminLicenseService.updateLicense(profile.id, newDate.toISOString(), masterPin);
            setLoading(false);

            if (response.success) {
                Swal.fire('Renovado', 'La licencia ha sido actualizada.', 'success');
                refreshProfiles();
            } else {
                Swal.fire('Error', 'No se pudo actualizar la licencia.', 'error');
            }
        }
    };

    const handleToggleAdmin = async (profile) => {
        const isCurrentlyAdmin = profile.role === 'super_admin';
        const actionText = isCurrentlyAdmin ? 'Quitar privilegios de Super Admin' : 'Hacer Super Admin';
        const confirmText = isCurrentlyAdmin ? 'Sí, degradar' : 'Sí, ascender';

        const result = await Swal.fire({
            title: `¿${actionText}?`,
            html: `Usuario: <b>${profile.full_name}</b><br/>Tienda: ${profile.store_name}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#7c3aed',
            confirmButtonText: confirmText
        });

        if (result.isConfirmed) {
            setLoading(true);
            const response = await adminLicenseService.toggleSuperAdmin(profile.id, !isCurrentlyAdmin, masterPin);
            setLoading(false);

            if (response.success) {
                Swal.fire('Éxito', 'Permisos actualizados correctamente', 'success');
                refreshProfiles();
            } else {
                Swal.fire('Error', 'No se pudo actualizar los permisos', 'error');
            }
        }
    };

    const handleSuspend = async (profile) => {
        const result = await Swal.fire({
            title: '¿Suspender Servicio?',
            text: `Esto bloqueará el acceso a ${profile.store_name} inmediatamente.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, suspender'
        });

        if (result.isConfirmed) {
            // Establecer fecha en el pasado (-1 día)
            const newDate = new Date();
            newDate.setDate(newDate.getDate() - 1);

            setLoading(true);
            const response = await adminLicenseService.updateLicense(profile.id, newDate.toISOString(), masterPin);
            setLoading(false);

            if (response.success) {
                Swal.fire('Suspendido', 'El servicio ha sido suspendido.', 'success');
                refreshProfiles();
            } else {
                Swal.fire('Error', 'No se pudo suspender el servicio.', 'error');
            }
        }
    };

    const generateInvitation = async () => {
        if (!invitationNote.trim()) {
            return Swal.fire('Requerido', 'Ingresa una nota o nombre del cliente', 'warning');
        }

        // Generar código aleatorio: CLIENTE-XXXX
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const code = `CLIENTE-${randomSuffix}`;

        // Insertar en Supabase (Usando inserción directa permitida por políticas o crear servicio)
        // Por simplicidad, usaremos un insert directo si la política lo permite, 
        // o idealmente un RPC si quisieramos ser más estrictos, pero el manual decía 'insert'.
        // Vamos a usar supabase direct client here ya que invitationService es más de lectura/validación.
        
        try {
            const { data, error } = await supabase
                .from('invitation_codes')
                .insert([{ 
                    code: code, 
                    notes: invitationNote,
                    created_by: 'SuperAdmin Panel' 
                }])
                .select()
                .single();

            if (error) throw error;

            setGeneratedCode({
                code: data.code,
                link: `${window.location.origin}/#/register/${data.code}`
            });
            setInvitationNote('');
            
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo generar el código.', 'error');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                    <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Panel Super Admin</h2>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">PIN Maestro</label>
                            <input
                                type="password"
                                value={masterPin}
                                onChange={(e) => setMasterPin(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
                                placeholder="******"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            {loading ? 'Verificando...' : 'Acceder'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Licencias</h1>
                <p className="text-gray-600">Panel de Control Maestro</p>
            </header>

            <div className="mb-6">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('licenses')}
                            className={`${activeTab === 'licenses' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Clientes Activos
                        </button>
                        <button
                            onClick={() => setActiveTab('invitations')}
                            className={`${activeTab === 'invitations' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            Generar Invitaciones
                        </button>
                    </nav>
                </div>
            </div>

            {activeTab === 'licenses' && (
                <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                    <div className="px-4 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Listado de Tiendas</h3>
                        <button onClick={refreshProfiles} className="text-sm text-blue-600 hover:text-blue-900">Actualizar</button>
                    </div>
                    <ul className="divide-y divide-gray-200">
                        {profiles.map((profile) => {
                            const expiresAt = profile.license_expires_at ? new Date(profile.license_expires_at) : null;
                            const isExpired = expiresAt && expiresAt < new Date();
                            const statusColor = !expiresAt ? 'gray' : isExpired ? 'red' : 'green';

                            return (
                                <li key={profile.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-lg font-bold text-gray-900 truncate">{profile.store_name || 'Sin Nombre'}</h4>
                                            <p className="text-sm text-gray-500">{profile.full_name} • {profile.email}</p>
                                            <div className="mt-2 flex items-center text-sm text-gray-500 space-x-2">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${statusColor}-100 text-${statusColor}-800`}>
                                                    {expiresAt ? `Vence: ${expiresAt.toLocaleDateString()}` : 'Sin Licencia'}
                                                </span>
                                                {profile.role === 'super_admin' && (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                                        SUPER ADMIN
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                                            <button
                                                onClick={() => handleUpdateLicense(profile, 30)}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm"
                                            >
                                                +30 Días
                                            </button>
                                            <button
                                                onClick={() => handleUpdateLicense(profile, 365)}
                                                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                                            >
                                                +1 Año
                                            </button>
                                            <button
                                                onClick={() => handleToggleAdmin(profile)}
                                                className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white shadow-sm ${
                                                    profile.role === 'super_admin' 
                                                    ? 'bg-gray-600 hover:bg-gray-700' 
                                                    : 'bg-purple-600 hover:bg-purple-700'
                                                }`}
                                            >
                                                {profile.role === 'super_admin' ? 'Degradar' : 'Hacer Admin'}
                                            </button>
                                            <button
                                                onClick={() => handleSuspend(profile)}
                                                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                                            >
                                                Suspender
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                        {profiles.length === 0 && (
                            <li className="px-4 py-8 text-center text-gray-500">No se encontraron clientes registrados.</li>
                        )}
                    </ul>
                </div>
            )}

            {activeTab === 'invitations' && (
                <div className="bg-white shadow sm:rounded-lg p-6 max-w-2xl mx-auto mt-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Nueva Invitación de Registro</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nota / Cliente</label>
                            <input
                                type="text"
                                value={invitationNote}
                                onChange={(e) => setInvitationNote(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
                                placeholder="Ej: Lavandería El Sol - Sucursal Norte"
                            />
                        </div>
                        <button
                            onClick={generateInvitation}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                        >
                            Generar Código y Enlace
                        </button>
                    </div>

                    {generatedCode && (
                        <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
                            <h4 className="text-sm font-bold text-green-800 mb-2">¡Invitación Generada!</h4>
                            <p className="text-sm text-gray-700 mb-1">Código: <span className="font-mono font-bold">{generatedCode.code}</span></p>
                            <div className="flex items-center content-center gap-2">
                                <input 
                                    readOnly 
                                    value={generatedCode.link} 
                                    className="flex-1 p-2 text-xs bg-white border border-gray-300 rounded text-black"
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(generatedCode.link);
                                        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
                                        Toast.fire({ icon: 'success', title: 'Copiado' });
                                    }}
                                    className="px-3 py-2 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                                >
                                    Copiar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
