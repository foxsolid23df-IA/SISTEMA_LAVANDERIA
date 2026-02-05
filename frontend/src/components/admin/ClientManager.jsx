import React, { useState, useEffect } from 'react';
import { customerService } from '../../services/customerService';
import Swal from 'sweetalert2';
import './UserManager.css'; // Reusing styles

export const ClientManager = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: ''
    });

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            setLoading(true);
            const data = await customerService.getCustomers();
            setClients(data);
        } catch (error) {
            console.error('Error al cargar clientes:', error);
            Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', phone: '', address: '' });
        setEditingClient(null);
    };

    const handleOpenModal = (client = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name,
                phone: client.phone || '',
                address: client.address || ''
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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            Swal.fire('Error', 'El nombre es obligatorio', 'warning');
            return;
        }

        try {
            if (editingClient) {
                // Check duplicates excluding self
                const duplicates = await customerService.checkDuplicate(formData.name.trim(), formData.phone.trim());
                const isDuplicate = duplicates.some(d => d.id !== editingClient.id);
                
                if (isDuplicate) {
                     Swal.fire('Error', 'Ya existe otro cliente con ese nombre o teléfono', 'warning');
                     return;
                }

                await customerService.updateCustomer(editingClient.id, formData);
                Swal.fire('Actualizado', 'Cliente actualizado correctamente', 'success');
            } else {
                // Check duplicates
                const duplicates = await customerService.checkDuplicate(formData.name.trim(), formData.phone.trim());
                if (duplicates.length > 0) {
                     Swal.fire('Error', 'Ya existe un cliente con ese nombre o teléfono', 'warning');
                     return;
                }

                await customerService.createCustomer(formData);
                Swal.fire('Creado', 'Cliente registrado correctamente', 'success');
            }
            handleCloseModal();
            loadClients();
        } catch (error) {
            console.error('Error al guardar:', error);
            Swal.fire('Error', 'No se pudieron guardar los cambios', 'error');
        }
    };

    const handleDelete = async (id, name) => {
        const result = await Swal.fire({
            title: '¿Eliminar cliente?',
            text: `Se eliminará a "${name}" del sistema. Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await customerService.deleteCustomer(id);
                Swal.fire('Eliminado', 'Cliente eliminado', 'success');
                loadClients();
            } catch (error) {
                console.error('Error al eliminar:', error);
                Swal.fire('Error', 'No se pudo eliminar el cliente', 'error');
            }
        }
    };

    const filteredClients = clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.phone && client.phone.includes(searchTerm))
    );

    if (loading) return <div className="loading-state">Cargando clientes...</div>;

    return (
        <div className="user-manager-container">
            <header className="manager-header">
                <div>
                    <div className="header-badge">Control de Clientes</div>
                    <h2>Gestión de Clientes</h2>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Administra tu base de datos de clientes
                    </p>
                </div>
                <div className="flex items-center gap-3">
                     <div className="relative">
                        <input 
                            type="text" 
                            placeholder="Buscar cliente..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border rounded-xl bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-gray-400 text-sm">search</span>
                    </div>
                    <button className="btn-primary" onClick={() => handleOpenModal()}>
                        + Nuevo Cliente
                    </button>
                </div>
            </header>

            <div className="user-list-card">
                {filteredClients.length === 0 ? (
                    <div className="empty-state">
                        <p>No se encontraron clientes</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="user-table w-full">
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Teléfono</th>
                                    <th>Dirección</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredClients.map(client => (
                                    <tr key={client.id}>
                                        <td className="font-medium">{client.name}</td>
                                        <td>{client.phone || '-'}</td>
                                        <td className="truncate max-w-xs" title={client.address}>{client.address || '-'}</td>
                                        <td className="actions-cell">
                                            <button
                                                className="btn-edit"
                                                onClick={() => handleOpenModal(client)}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                className="btn-delete"
                                                onClick={() => handleDelete(client.id, client.name)}
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Nombre completo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: Juan Pérez"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Teléfono</label>
                                <input
                                    type="tel"
                                    placeholder="Ej: 55 1234 5678"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                             <div className="form-group">
                                <label>Dirección</label>
                                <textarea
                                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white resize-none h-24"
                                    placeholder="Dirección completa"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-primary">
                                    {editingClient ? 'Guardar Cambios' : 'Registrar Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
