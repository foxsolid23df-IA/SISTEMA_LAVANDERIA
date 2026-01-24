import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { customerService } from '../../services/customerService';

export const ClientRegistrationModal = ({ isOpen, onClose, onClientRegistered }) => {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: ''
    });
    const [loading, setLoading] = useState(false);

    // Resetear formulario al abrir
    React.useEffect(() => {
        if (isOpen) {
            setFormData({ name: '', phone: '', address: '' });
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.name.trim()) {
            Swal.fire('Error', 'El nombre es obligatorio', 'error');
            return;
        }

        setLoading(true);
        try {
            // Verificar duplicados
            const duplicates = await customerService.checkDuplicate(formData.name.trim(), formData.phone.trim());
            
            if (duplicates && duplicates.length > 0) {
                // Filtrar duplicado exacto para mostrar mensaje específico
                const nameMatch = duplicates.find(d => d.name.toLowerCase() === formData.name.trim().toLowerCase());
                const phoneMatch = formData.phone.trim() ? duplicates.find(d => d.phone === formData.phone.trim()) : null;

                let errorMsg = 'Ya existe un cliente con estos datos.';
                if (nameMatch && phoneMatch) errorMsg = 'Ya existe un cliente con ese nombre y teléfono.';
                else if (nameMatch) errorMsg = `Ya existe un cliente con el nombre "${nameMatch.name}".`;
                else if (phoneMatch) errorMsg = `Ya existe un cliente con el teléfono "${phoneMatch.phone}".`;

                await Swal.fire({
                    icon: 'warning',
                    title: 'Cliente Duplicado',
                    text: errorMsg,
                    showCancelButton: true,
                    confirmButtonText: 'Registrar de todos modos',
                    cancelButtonText: 'Cancelar'
                }).then(async (result) => {
                    if (result.isConfirmed) {
                       await proceedRegistration();
                    }
                });
                
                // Si el usuario cancela o cierra el modal, aseguramos que loading sea false.
                // Si confirmó, proceedRegistration ya se encargó de la lógica (éxito cierra modal, error lanza excepción caught below)
                // Pero como proceedRegistration no lanza error si tiene éxito (solo cierra), necesitamos controlar el estado.
                // En realidad, si proceedRegistration es llamado, él maneja el flujo.
                // Solo si NO se llama (cancelar), debemos poner false.
                
                // NOTA: Si el usuario confirma, `proceedRegistration` se ejecuta y puede cerrar el modal.
                // Si el usuario Cancela, el código sigue aquí.
                
                // Corrección: Como el `then` anterior espera a proceedRegistration, si llegamos aquí es que terminó.
                // Si proceedRegistration tuvo éxito, el componente probablemente se desmontó (onClose).
                // Pero es seguro poner false aquí.
                setLoading(false);
                return;
            }


            await proceedRegistration();
        } catch (error) {
            console.error('Error creating customer:', error);
            Swal.fire('Error', 'No se pudo registrar el cliente', 'error');
            setLoading(false);
        }
    };

    const proceedRegistration = async () => {
        try {
            const newClient = await customerService.createCustomer(formData);
            Swal.fire({
                icon: 'success',
                title: 'Cliente Registrado',
                text: 'El cliente ha sido guardado y seleccionado correctamente',
                timer: 1500,
                showConfirmButton: false
            });
            onClientRegistered(newClient);
            onClose();
            setFormData({ name: '', phone: '', address: '' });
        } catch (error) {
             throw error; // Re-throw to be caught by outer catch if called directly, or handle here
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white">Registrar Nuevo Cliente</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Nombre Completo <span className="text-rose-500">*</span></label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold placeholder:text-slate-400"
                            placeholder="Ej. Juan Pérez"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Teléfono</label>
                        <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold placeholder:text-slate-400"
                            placeholder="Ej. 55 1234 5678"
                        />
                        <p className="text-xs text-slate-400">Recomendado para notificaciones</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Dirección</label>
                        <textarea
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold resize-none h-24 placeholder:text-slate-400"
                            placeholder="Dirección completa (Opcional)"
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">save</span>
                                    Guardar y Seleccionar
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
