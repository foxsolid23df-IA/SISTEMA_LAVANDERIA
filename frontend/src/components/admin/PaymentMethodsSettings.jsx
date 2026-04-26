import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { paymentMethodsService } from '../../services/paymentMethodsService';
import { UiButton, UiCard, UiBadge, UiPageHeader } from '../common/ui';
import '../common/ui/ui-kit.css';
import './PaymentMethodsSettings.css';

const satPaymentForms = [
    { value: '', label: 'Seleccionar clave SAT...' },
    { value: '01', label: '01: Efectivo' },
    { value: '02', label: '02: Cheque nominativo' },
    { value: '03', label: '03: Transferencia electrónica de fondos' },
    { value: '04', label: '04: Tarjeta de crédito' },
    { value: '28', label: '28: Tarjeta de débito' },
    { value: '99', label: '99: Por definir ' }
];

const PaymentMethodsSettings = () => {
    const navigate = useNavigate();
    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [newMethodName, setNewMethodName] = useState('');
    const [newMethodSatKey, setNewMethodSatKey] = useState('');
    const [saving, setSaving] = useState(false);

    const [openMenuId, setOpenMenuId] = useState(null);

    useEffect(() => {
        fetchMethods();
        
        const handleClickOutside = (event) => {
            if (!event.target.closest('.pms-menu-anchor')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchMethods = async () => {
        try {
            setLoading(true);
            const data = await paymentMethodsService.getPaymentMethods();
            setMethods(data);
        } catch (error) {
            console.error('Error al cargar métodos:', error);
            Swal.fire('Error', 'No se pudieron cargar los métodos de pago', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newMethodName.trim()) return;

        try {
            setSaving(true);
            const data = await paymentMethodsService.addPaymentMethod({
                name: newMethodName.trim(),
                sat_key: newMethodSatKey.trim() || null
            });
            setMethods([...methods, data]);
            setNewMethodName('');
            setNewMethodSatKey('');
            Swal.fire({
                title: 'Agregado',
                text: 'Método de pago agregado con éxito',
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (error) {
            console.error('Error al guardar:', error);
            Swal.fire('Error', 'Error al guardar el método de pago', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async (method) => {
        setOpenMenuId(null);

        const satOptionsHtml = satPaymentForms.map(opt => 
            `<option value="${opt.value}" ${method.sat_key === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        const { value: formValues } = await Swal.fire({
            title: 'Editar Método de Pago',
            html:
                `<div class="flex flex-col gap-3 text-left">
                    <div>
                        <label class="text-sm font-semibold mb-1 block">Nombre del método</label>
                        <input id="swal-input1" class="swal2-input !m-0 !w-full" placeholder="Nombre" value="${method.name}">
                    </div>
                    <div>
                        <label class="text-sm font-semibold mb-1 block">Clave SAT (Opcional)</label>
                        <select id="swal-input2" class="swal2-select !m-0 !w-full" style="display: flex;">
                            ${satOptionsHtml}
                        </select>
                    </div>
                </div>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                return [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value
                ]
            }
        });

        if (formValues) {
            const newName = formValues[0].trim();
            const newSat = formValues[1].trim() || null;
            if (!newName) return;

            try {
                const updated = await paymentMethodsService.updatePaymentMethod(method.id, {
                    name: newName,
                    sat_key: newSat
                });
                
                setMethods(methods.map(m => m.id === method.id ? updated : m));
                Swal.fire({
                    title: 'Actualizado',
                    text: 'Cambios guardados correctamente',
                    icon: 'success',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } catch (error) {
                console.error('Error al actualizar:', error);
                Swal.fire('Error', 'Error al actualizar el método', 'error');
            }
        }
    };

    const handleToggleState = async (method) => {
        setOpenMenuId(null);
        try {
            const updated = await paymentMethodsService.toggleStatus(method.id, !method.is_active);
            setMethods(methods.map(m => m.id === method.id ? updated : m));
            Swal.fire({
                title: updated.is_active ? 'Activado' : 'Desactivado',
                text: `El método de pago ahora está ${updated.is_active ? 'visible' : 'oculto'} en ventas`,
                icon: 'success',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            Swal.fire('Error', 'No se pudo cambiar el estado', 'error');
        }
    };

    const handleDelete = async (method) => {
        setOpenMenuId(null);
        if (method.is_system) return;

        const result = await Swal.fire({
            title: '¿Eliminar método de pago?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await paymentMethodsService.deletePaymentMethod(method.id);
                setMethods(methods.filter(m => m.id !== method.id));
                Swal.fire({
                    title: 'Eliminado',
                    text: 'Método de pago eliminado correctamente',
                    icon: 'success',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } catch (error) {
                console.error('Error al eliminar:', error);
                Swal.fire('Error', 'No se pudo eliminar el método de pago', 'error');
            }
        }
    };

    const toggleMenu = (e, id) => {
        e.stopPropagation();
        setOpenMenuId(openMenuId === id ? null : id);
    };

    const getIconForMethod = (name) => {
        const n = name.toLowerCase();
        if (n.includes('efectivo') || n.includes('cash')) return 'payments';
        if (n.includes('tarjeta') || n.includes('card')) return 'credit_card';
        if (n.includes('transf') || n.includes('spei')) return 'account_balance';
        return 'local_atm';
    };

    return (
        <div className="pms-container">
            <UiPageHeader
                title="Formas de Pago"
                description="Administra los métodos de pago disponibles en el sistema Punto de Venta."
                backTo="/configuracion"
                backLabel="Volver a Configuración"
            />

            <UiCard>
                <UiCard.Body>
                    {/* Add Form */}
                    <form onSubmit={handleAdd} className="pms-add-form">
                        <div className="pms-add-form__field">
                            <label className="ui-label">Nombre del método</label>
                            <input 
                                type="text" 
                                className="ui-input"
                                placeholder="Ej. Vales de Despensa"
                                value={newMethodName}
                                onChange={(e) => setNewMethodName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="pms-add-form__field">
                            <label className="ui-label">Clave SAT (Opcional)</label>
                            <select 
                                className="ui-select"
                                value={newMethodSatKey}
                                onChange={(e) => setNewMethodSatKey(e.target.value)}
                            >
                                {satPaymentForms.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <UiButton
                            type="submit"
                            variant="primary"
                            icon={saving ? 'hourglass_empty' : 'add'}
                            disabled={saving}
                            className="pms-add-form__submit"
                        >
                            Añadir
                        </UiButton>
                    </form>
                </UiCard.Body>

                <UiCard.Body>
                    {/* Method List */}
                    {loading ? (
                        <div className="pms-loading">Cargando métodos...</div>
                    ) : (
                        <div className="pms-methods-list">
                            {methods.map(method => (
                                <div 
                                    key={method.id} 
                                    className={`ui-list-item pms-menu-anchor ${!method.is_active ? 'ui-list-item--inactive' : ''}`}
                                >
                                    <div className="ui-list-item__icon">
                                        <span className="material-icons-outlined">
                                            {getIconForMethod(method.name)}
                                        </span>
                                    </div>
                                    <div className="ui-list-item__content">
                                        <span className="ui-list-item__title">{method.name}</span>
                                        
                                        {method.sat_key && (
                                            <UiBadge variant="accent">SAT: {method.sat_key}</UiBadge>
                                        )}
                                        {method.is_system && (
                                            <UiBadge variant="info">Sistema</UiBadge>
                                        )}
                                        {!method.is_active && (
                                            <UiBadge variant="neutral">Inactivo</UiBadge>
                                        )}
                                    </div>

                                    <button 
                                        onClick={(e) => toggleMenu(e, method.id)}
                                        className="pms-menu-trigger"
                                        aria-label="Opciones"
                                    >
                                        <span className="material-icons-outlined">more_vert</span>
                                    </button>

                                    {openMenuId === method.id && (
                                        <div className="ui-dropdown">
                                            <button 
                                                onClick={() => handleEdit(method)}
                                                className="ui-dropdown__item"
                                            >
                                                <span className="material-icons-outlined ui-dropdown__item-icon">edit</span>
                                                <div>
                                                    <div className="ui-dropdown__item-label">Editar</div>
                                                    <div className="ui-dropdown__item-desc">Renombrar o clave SAT</div>
                                                </div>
                                            </button>
                                            
                                            <button 
                                                onClick={() => handleToggleState(method)}
                                                className="ui-dropdown__item"
                                            >
                                                <span className="material-icons-outlined ui-dropdown__item-icon">
                                                    {method.is_active ? 'visibility_off' : 'visibility'}
                                                </span>
                                                <div>
                                                    <div className="ui-dropdown__item-label">
                                                        {method.is_active ? 'Desactivar' : 'Activar'}
                                                    </div>
                                                    <div className="ui-dropdown__item-desc">
                                                        {method.is_active ? 'Ocultar en ventas' : 'Mostrar en ventas'}
                                                    </div>
                                                </div>
                                            </button>

                                            {!method.is_system ? (
                                                <button 
                                                    onClick={() => handleDelete(method)}
                                                    className="ui-dropdown__item ui-dropdown__item--danger"
                                                >
                                                    <span className="material-icons-outlined ui-dropdown__item-icon">delete_outline</span>
                                                    <div>
                                                        <div className="ui-dropdown__item-label">Eliminar</div>
                                                        <div className="ui-dropdown__item-desc">Borrar permanentemente</div>
                                                    </div>
                                                </button>
                                            ) : (
                                                <div className="ui-dropdown__item ui-dropdown__item--disabled">
                                                    <span className="material-icons-outlined ui-dropdown__item-icon">delete_outline</span>
                                                    <div>
                                                        <div className="ui-dropdown__item-label">Eliminar</div>
                                                        <div className="ui-dropdown__item-desc">No disponible en Métodos del Sistema</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {methods.length === 0 && !loading && (
                                <div className="pms-empty">
                                    <span className="material-icons-outlined pms-empty__icon">credit_card_off</span>
                                    <p>No se encontraron métodos de pago</p>
                                    <small>Añade uno usando el formulario de arriba</small>
                                </div>
                            )}
                        </div>
                    )}
                </UiCard.Body>
            </UiCard>
        </div>
    );
};

export default PaymentMethodsSettings;
