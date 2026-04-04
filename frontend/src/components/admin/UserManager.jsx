import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { staffService } from '../../services/staffService';
import Swal from 'sweetalert2';
import './UserManager.css';

const ROLES = {
    admin: { 
        id: 'admin',
        icon: '⭐', 
        label: 'Administrador', 
        class: 'role-admin',
        desc: 'Acceso total a todas las funciones y configuraciones.',
        permissions: {
            can_access_sales: true,
            can_manage_orders: true,
            can_delete_orders: true,
            can_access_services: true,
            can_access_products: true,
            can_manage_supplies: true,
            can_see_reports: true,
            can_view_dashboard: true,
            can_manage_inventory: true,
            can_view_supplies: true,
            can_manage_staff: true,
            can_manage_clients: true,
            can_view_audit: true,
            can_access_settings: true,
            can_use_ia_vision: true,
            can_manage_cash: true,
            can_lock_terminal: true,
            can_restart_cash: true,
            can_logout: true,
            can_process_orders: true,
            can_deliver_orders: true,
            can_void_sales: true
        }
    },
    gerente: { 
        id: 'gerente',
        icon: '👔', 
        label: 'Gerente', 
        class: 'role-gerente',
        desc: 'Gestión operativa, reportes y supervisión.',
        permissions: {
            can_access_sales: true,
            can_manage_orders: true,
            can_delete_orders: false,
            can_access_services: true,
            can_access_products: true,
            can_manage_supplies: true,
            can_see_reports: true,
            can_view_dashboard: true,
            can_manage_inventory: true,
            can_view_supplies: true,
            can_manage_staff: false,
            can_manage_clients: true,
            can_view_audit: true,
            can_access_settings: false,
            can_use_ia_vision: true,
            can_manage_cash: true,
            can_lock_terminal: true,
            can_restart_cash: false,
            can_logout: true,
            can_process_orders: true,
            can_deliver_orders: true,
            can_void_sales: false
        }
    },
    cajero: { 
        id: 'cajero',
        icon: '🛒', 
        label: 'Cajero', 
        class: 'role-cajero',
        desc: 'Ventas, cobros y atención al cliente.',
        permissions: {
            can_access_sales: true,
            can_manage_orders: true,
            can_delete_orders: false,
            can_access_services: false,
            can_access_products: false,
            can_manage_supplies: false,
            can_see_reports: false,
            can_view_dashboard: false,
            can_manage_inventory: false,
            can_view_supplies: false,
            can_manage_staff: false,
            can_manage_clients: true,
            can_view_audit: false,
            can_access_settings: false,
            can_use_ia_vision: true,
            can_manage_cash: true,
            can_lock_terminal: true,
            can_restart_cash: false,
            can_logout: true,
            can_deliver_orders: true,
            can_void_sales: false,
            can_view_supplies: true
        }
    },
    operador: { 
        id: 'operador',
        icon: '🌀', 
        label: 'Operador', 
        class: 'role-operador',
        desc: 'Procesamiento de prendas (Lavado/Secado).',
        permissions: {
            can_access_sales: false,
            can_manage_orders: true,
            can_delete_orders: false,
            can_access_services: false,
            can_access_products: false,
            can_manage_supplies: false,
            can_see_reports: false,
            can_view_dashboard: false,
            can_manage_inventory: false,
            can_view_supplies: false,
            can_manage_staff: false,
            can_manage_clients: false,
            can_view_audit: false,
            can_access_settings: false,
            can_use_ia_vision: false,
            can_manage_cash: false,
            can_lock_terminal: true,
            can_restart_cash: false,
            can_logout: true,
            can_process_orders: true,
            can_deliver_orders: false,
            can_void_sales: false
        }
    },
    repartidor: { 
        id: 'repartidor',
        icon: '🛵', 
        label: 'Repartidor', 
        class: 'role-repartidor',
        desc: 'Entrega de pedidos a domicilio.',
        permissions: {
            can_access_sales: false,
            can_manage_orders: true,
            can_delete_orders: false,
            can_access_services: false,
            can_access_products: false,
            can_manage_supplies: false,
            can_see_reports: false,
            can_view_dashboard: false,
            can_manage_inventory: false,
            can_view_supplies: false,
            can_manage_staff: false,
            can_manage_clients: false,
            can_view_audit: false,
            can_access_settings: false,
            can_use_ia_vision: false,
            can_manage_cash: false,
            can_lock_terminal: true,
            can_restart_cash: false,
            can_logout: true,
            can_process_orders: false,
            can_deliver_orders: true,
            can_void_sales: false
        }
    }

};

const PERMISSION_LABELS = {
    can_access_sales: { label: 'Ventas', desc: 'Acceso a caja y realizar ventas' },
    can_manage_orders: { label: 'Gestión de Órdenes', desc: 'Ver y gestionar el listado de pedidos' },
    can_access_services: { label: 'Catálogo de Servicios', desc: 'Administrar servicios y precios' },
    can_access_products: { label: 'Catálogo de Productos', desc: 'Administrar productos y precios' },
    can_manage_supplies: { label: 'Administrar Insumos Internos', desc: 'Control total: stock, catálogo e historial' },
    can_view_supplies: { label: 'Insumos: Libreta Digital', desc: 'Solo registrar uso de detergentes y ver existencias' },
    can_manage_clients: { label: 'Clientes', desc: 'Gestionar base de datos de clientes' },
    can_view_audit: { label: 'Auditoría', desc: 'Acceso al historial de movimientos' },
    can_view_dashboard: { label: 'Dashboard', desc: 'Ver estadísticas y reportes' },
    can_access_settings: { label: 'Configuración', desc: 'Acceso ajustes generales del sistema' },
    can_use_ia_vision: { label: 'IA Vision', desc: 'Uso de reconocimiento de prendas por IA' },
    can_manage_cash: { label: 'Caja', desc: 'Aperturas, retiros y cortes de caja' },
    can_lock_terminal: { label: 'Bloquear', desc: 'Posibilidad de bloquear la pantalla' },
    can_restart_cash: { label: 'Reiniciar Caja/Terminal', desc: 'Borrar ajustes locales de conexión (Soporte)' },
    can_logout: { label: 'Cerrar Sesión (Desvincular)', desc: 'Desvincular cuenta de la terminal/dispositivo' },
    can_delete_orders: { label: 'Eliminar Órdenes', desc: 'Permite borrar registros de órdenes' },
    can_void_sales: { label: 'Anular Ventas', desc: 'Cancelar ventas ya cobradas' },
    can_manage_staff: { label: 'Persona & Seguridad', desc: 'Crear o editar usuarios' }
};

export const UserManager = () => {
    const navigate = useNavigate();
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        role: 'cajero',
        pin: '',
        permissions: ROLES.cajero.permissions
    });

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        try {
            setLoading(true);
            const data = await staffService.getStaff();
            setStaff(data);
        } catch (error) {
            console.error('Error al cargar empleados:', error);
            Swal.fire('Error', 'No se pudieron cargar los empleados', 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ 
            name: '', 
            role: 'cajero', 
            pin: '', 
            permissions: ROLES.cajero.permissions 
        });
        setEditingStaff(null);
    };

    const handleOpenModal = (staffMember = null) => {
        if (staffMember) {
            setEditingStaff(staffMember);
            setFormData({
                name: staffMember.name,
                role: staffMember.role,
                pin: staffMember.pin,
                permissions: staffMember.permissions || ROLES[staffMember.role]?.permissions || ROLES.cajero.permissions
            });
        } else {
            resetForm();
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        resetForm();
    };

    const handleRoleSelect = (roleId) => {
        setFormData({
            ...formData,
            role: roleId,
            permissions: ROLES[roleId].permissions
        });
    };

    const handlePermissionToggle = (permKey) => {
        setFormData({
            ...formData,
            permissions: {
                ...formData.permissions,
                [permKey]: !formData.permissions[permKey]
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.pin) {
            Swal.fire('Error', 'Nombre y PIN son obligatorios', 'warning');
            return;
        }

        if (formData.pin.length < 4 || formData.pin.length > 6) {
            Swal.fire('Error', 'El PIN debe tener entre 4 y 6 dígitos', 'warning');
            return;
        }

        try {
            // Validar PIN duplicado
            const isDuplicate = await staffService.checkPinDuplicate(formData.pin, editingStaff?.id);
            
            if (isDuplicate) {
                Swal.fire({
                    title: 'PIN Duplicado',
                    text: 'Este PIN ya está siendo usado por otro empleado. Por razones de seguridad, cada empleado debe tener un PIN único.',
                    icon: 'error'
                });
                return;
            }

            if (editingStaff) {
                await staffService.updateStaff(editingStaff.id, formData);
                Swal.fire('Actualizado', 'Empleado actualizado correctamente', 'success');
            } else {
                await staffService.createStaff(formData);
                Swal.fire('Creado', 'Empleado creado correctamente', 'success');
            }
            handleCloseModal();
            loadStaff();
        } catch (error) {
            console.error('Error al guardar:', error);
            
            if (error.code === '23505' || error.message?.includes('duplicate key')) {
                Swal.fire({
                    title: '¡PIN ya en uso!',
                    html: `El PIN <strong>${formData.pin}</strong> ya está registrado para otro empleado.<br><br>Por favor, asigna un código diferente para mantener la seguridad.`,
                    icon: 'warning',
                    confirmButtonColor: '#3085d6'
                });
            } else {
                Swal.fire({
                    title: 'Error de Guardado',
                    text: 'No pudimos registrar los cambios: ' + (error.message || 'Error de conexión'),
                    icon: 'error'
                });
            }
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: '¿Eliminar empleado?',
            text: `Se eliminará a "${name}" del sistema`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await staffService.deleteStaff(id);
                Swal.fire('Eliminado', 'Empleado eliminado', 'success');
                loadStaff();
            } catch (error) {
                console.error('Error al eliminar:', error);
                Swal.fire('Error', 'No se pudo eliminar el empleado', 'error');
            }
        }
    };

    const toggleActive = async (staffMember) => {
        try {
            await staffService.updateStaff(staffMember.id, {
                ...staffMember,
                active: !staffMember.active
            });
            loadStaff();
        } catch (error) {
            console.error('Error al cambiar estado:', error);
        }
    };

    const getRoleBadge = (role) => {
        return ROLES[role] || ROLES.cajero;
    };

    if (loading) return <div className="loading-state">Cargando empleados...</div>;

    return (
        <div className="user-manager-container">
            <div style={{ marginBottom: '1rem' }}>
                <button 
                    onClick={() => navigate('/configuracion')}
                    style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                    <span className="material-icons-outlined">arrow_back</span>
                    Volver a Configuración
                </button>
            </div>
            <header className="manager-header">
                <div>
                    <div className="header-badge">Personal & Seguridad</div>
                    <h2>Gestión de Usuarios</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Administra roles y permisos para el acceso al punto de venta
                    </p>
                </div>
                <button className="btn-add-employee-premium" onClick={() => handleOpenModal()}>
                    <span className="material-icons-outlined">person_add</span>
                    Nuevo Empleado
                </button>
            </header>

            <div className="user-list-card">
                {staff.length === 0 ? (
                    <div className="empty-state">
                        <p>No hay empleados registrados</p>
                        <small>Haz clic en "Nuevo Empleado" para agregar uno</small>
                    </div>
                ) : (
                    <table className="user-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Rol</th>
                                <th>PIN</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map(s => {
                                const roleInfo = getRoleBadge(s.role);
                                return (
                                    <tr key={s.id}>
                                        <td className="font-bold">{s.name}</td>
                                        <td>
                                            <span className={`role-badge ${roleInfo.class}`}>
                                                {roleInfo.icon} {roleInfo.label}
                                            </span>
                                        </td>
                                        <td>
                                            <code className="pin-display">****</code>
                                        </td>
                                        <td>
                                            <span
                                                className={`status-badge ${s.active ? 'active' : 'inactive'}`}
                                                onClick={() => toggleActive(s)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {s.active ? '✓ Activo' : '✗ Inactivo'}
                                            </span>
                                        </td>
                                        <td className="actions-cell">
                                            <button
                                                className="btn-edit"
                                                onClick={() => handleOpenModal(s)}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDelete(s.id, s.name)}
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{editingStaff ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    Nombre completo *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Juan Pérez"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '10px', color: '#fff' }}
                                />
                            </div>

                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '1rem' }}>
                                Seleccionar Rol del Sistema
                            </label>
                            <div className="role-cards-grid">
                                {Object.values(ROLES).map(role => (
                                    <div 
                                        key={role.id}
                                        className={`role-card ${formData.role === role.id ? 'selected' : ''}`}
                                        onClick={() => handleRoleSelect(role.id)}
                                    >
                                        <span className="role-icon">{role.icon}</span>
                                        <span className="role-name">{role.label}</span>
                                        <span className="role-desc">{role.desc}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    PIN de acceso * (4-6 dígitos)
                                </label>
                                <input
                                    type="password"
                                    required
                                    maxLength="6"
                                    placeholder="Ej: 1234"
                                    value={formData.pin}
                                    onChange={e => setFormData({
                                        ...formData,
                                        pin: e.target.value.replace(/\D/g, '')
                                    })}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', padding: '0.8rem', borderRadius: '10px', color: '#fff', letterSpacing: '4px' }}
                                />
                            </div>

                            <div className="permissions-section" style={{ marginTop: '2rem' }}>
                                <label style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', display: 'block', marginBottom: '1.5rem', borderBottom: '2px solid rgba(99, 102, 241, 0.3)', paddingBottom: '0.5rem' }}>
                                    Panel de Control de Permisos 2026
                                </label>

                                {[
                                    { 
                                        title: 'Ventas y Operaciones', 
                                        icon: 'shopping_cart',
                                        keys: ['can_access_sales', 'can_manage_orders', 'can_delete_orders', 'can_void_sales', 'can_manage_clients', 'can_use_ia_vision'] 
                                    },
                                    { 
                                        title: 'Catálogos e Inventario', 
                                        icon: 'inventory_2',
                                        keys: ['can_access_services', 'can_access_products', 'can_manage_supplies', 'can_view_supplies', 'can_manage_inventory'] 
                                    },
                                    { 
                                        title: 'Administración y Reportes', 
                                        icon: 'analytics',
                                        keys: ['can_view_dashboard', 'can_view_audit', 'can_manage_staff', 'can_see_reports'] 
                                    },
                                    { 
                                        title: 'Sistema y Terminal', 
                                        icon: 'settings',
                                        keys: ['can_access_settings', 'can_manage_cash', 'can_lock_terminal', 'can_restart_cash', 'can_logout'] 
                                    }
                                ].map(category => (
                                    <div key={category.title} style={{ marginBottom: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <h4 style={{ color: '#6366f1', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>{category.icon}</span>
                                            {category.title}
                                        </h4>
                                        <div className="permissions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                            {category.keys.map(key => {
                                                const info = PERMISSION_LABELS[key];
                                                if (!info) return null;
                                                return (
                                                    <div key={key} className="permission-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s', border: '1px solid transparent' }}>
                                                        <div className="permission-info" style={{ pointerEvents: 'none' }}>
                                                            <div className="permission-title" style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{info.label}</div>
                                                            <div className="permission-desc" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{info.desc}</div>
                                                        </div>
                                                        <label className="switch">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={formData.permissions[key] || false}
                                                                onChange={() => handlePermissionToggle(key)}
                                                            />
                                                            <span className="slider round"></span>
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="modal-actions" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn-secondary" onClick={handleCloseModal} style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: '#fff', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '1rem', borderRadius: '12px', cursor: 'pointer' }}>
                                    {editingStaff ? 'Guardar Cambios' : 'Crear Empleado'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
