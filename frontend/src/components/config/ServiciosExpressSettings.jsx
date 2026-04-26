import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import Swal from 'sweetalert2';
import { expressServicesService } from '../../services/expressServicesService';

export const ServiciosExpressSettings = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newServiceName, setNewServiceName] = useState('');

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async () => {
        try {
            setLoading(true);
            const data = await expressServicesService.getExpressServices();
            setServices(data || []);
        } catch (error) {
            console.error("Error al cargar servicios express:", error);
            Swal.fire('Error', 'No se pudieron cargar los servicios express', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddService = async (e) => {
        e.preventDefault();
        if (!newServiceName.trim()) return;

        try {
            const addedData = await expressServicesService.addExpressService(newServiceName);
            setServices([...services, addedData].sort((a, b) => a.name.localeCompare(b.name)));
            setNewServiceName('');
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Servicio agregado',
                showConfirmButton: false,
                timer: 2000
            });
        } catch (error) {
            console.error("Error al agregar:", error);
            Swal.fire('Error', error.message || 'No se pudo agregar el servicio', 'error');
        }
    };

    const handleEdit = async (service) => {
        const { value: newName } = await Swal.fire({
            title: 'Editar Servicio',
            input: 'text',
            inputLabel: 'Nombre del servicio',
            inputValue: service.name,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            inputValidator: (value) => {
                if (!value.trim()) {
                    return 'El nombre no puede estar vacío';
                }
            }
        });

        if (newName && newName.trim() !== service.name) {
            try {
                const updatedData = await expressServicesService.updateExpressService(service.id, newName);
                setServices(services.map(s => s.id === service.id ? updatedData : s).sort((a, b) => a.name.localeCompare(b.name)));
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Servicio actualizado',
                    showConfirmButton: false,
                    timer: 2000
                });
            } catch (error) {
                console.error("Error al actualizar:", error);
                Swal.fire('Error', error.message || 'No se pudo actualizar el servicio', 'error');
            }
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: `¿Eliminar ${name}?`,
            text: "No podrás revertir esta acción",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await expressServicesService.deleteExpressService(id);
                setServices(services.filter(s => s.id !== id));
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Servicio eliminado',
                    showConfirmButton: false,
                    timer: 2000
                });
            } catch (error) {
                console.error("Error al eliminar:", error);
                Swal.fire('Error', 'No se pudo eliminar el servicio', 'error');
            }
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <NavLink 
                    to="/configuracion" 
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors flex items-center gap-2 font-bold text-sm"
                >
                    <span className="material-icons-outlined">arrow_back</span>
                    Volver a Configuración
                </NavLink>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }} className="text-slate-800 dark:text-white">
                        Servicios Express
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.25rem' }}>
                        Configura los nombres de servicios que podrás usar en venta libre
                    </p>
                </div>
            </header>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <form onSubmit={handleAddService} className="flex gap-4">
                    <input
                        type="text"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder="Ej. SERVICIO EXPRESS ROPA..."
                        className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                    />
                    <button 
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2"
                        disabled={!newServiceName.trim()}
                    >
                        <span className="material-icons-outlined">add</span>
                        Agregar
                    </button>
                </form>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        Cargando servicios express...
                    </div>
                ) : services.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        No hay servicios express configurados
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300">Servicio Express</th>
                                <th className="p-4 font-semibold text-slate-600 dark:text-slate-300 w-24 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map((service) => (
                                <tr key={service.id} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                    <td className="p-4 text-slate-800 dark:text-slate-200 font-medium">
                                        {service.name}
                                    </td>
                                    <td className="p-4 text-center flex justify-center gap-2">
                                        <button 
                                            onClick={() => handleEdit(service)}
                                            className="p-2 text-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                                            title="Editar servicio"
                                        >
                                            <span className="material-icons-outlined">edit</span>
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(service.id, service.name)}
                                            className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                            title="Eliminar servicio"
                                        >
                                            <span className="material-icons-outlined">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
