import React, { useState, useEffect } from 'react';
import { customerService } from '../../services/customerService';
import Swal from 'sweetalert2';
import BulkCustomerImportModal from './BulkCustomerImportModal';
import './ClientManager.css';

export const ClientManager = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        email: '',
        notes: ''
    });

    useEffect(() => {
        loadClients();
    }, []);

    const loadClients = async () => {
        try {
            const data = await customerService.getCustomers();
            setClients(data);
        } catch (error) {
            console.error('Error loading clients:', error);
            Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (client = null) => {
        if (client) {
            setEditingClient(client);
            setFormData({
                name: client.name || '',
                phone: client.phone || '',
                address: client.address || '',
                email: client.email || '',
                notes: client.notes || ''
            });
        } else {
            setEditingClient(null);
            setFormData({
                name: '',
                phone: '',
                address: '',
                email: '',
                notes: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingClient(null);
        setFormData({ name: '', phone: '', address: '', email: '', notes: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingClient) {
                await customerService.updateCustomer(editingClient.id, formData);
                Swal.fire('Éxito', 'Cliente actualizado correctamente', 'success');
            } else {
                await customerService.createCustomer(formData);
                Swal.fire('Éxito', 'Cliente creado correctamente', 'success');
            }
            handleCloseModal();
            loadClients();
        } catch (error) {
            console.error('Error saving client:', error);
            Swal.fire('Error', 'No se pudo guardar el cliente', 'error');
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "Esta acción no se puede deshacer",
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
                Swal.fire('Eliminado', 'El cliente ha sido eliminado', 'success');
                loadClients();
            } catch (error) {
                console.error('Error deleting client:', error);
                Swal.fire('Error', 'No se pudo eliminar el cliente', 'error');
            }
        }
    };

    const filteredClients = clients.filter(client => 
        client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone?.includes(searchTerm) ||
        client.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="loading-container">
            <div className="loader"></div>
            <p>Cargando clientes...</p>
        </div>
    );

    return (
        <div className="client-manager-container">
            <div className="client-manager-header">
                <div className="search-container">
                    <span className="material-symbols-outlined search-icon">search</span>
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, teléfono o email..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="header-actions">
                    <button className="btn-client btn-bulk" onClick={() => setShowBulkModal(true)}>
                        <span className="material-symbols-outlined">upload_file</span>
                        Carga Masiva
                    </button>
                    <button className="btn-client btn-new" onClick={() => handleOpenModal()}>
                        <span className="material-symbols-outlined">person_add</span>
                        Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="client-table-card">
                <div className="client-table-scroll">
                    <table className="client-table">
                        <thead>
                            <tr>
                                <th>Cliente / Nombre</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Dirección</th>
                                <th>Notas</th>
                                <th style={{ textAlign: 'center' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.length > 0 ? (
                                filteredClients.map(client => (
                                    <tr key={client.id}>
                                        <td>
                                            <div className="name-cell">
                                                <div className="avatar-initial">
                                                    {(client.name || 'C').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="client-info">
                                                    <h4>{client.name}</h4>
                                                    <span>Registrado el {new Date(client.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {client.phone ? (
                                                <div className="phone-badge">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>call</span>
                                                    {client.phone}
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">-</span>
                                            )}
                                        </td>
                                        <td>
                                            {client.email ? (
                                                <a href={`mailto:${client.email}`} className="email-link">
                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>mail</span>
                                                    {client.email}
                                                </a>
                                            ) : (
                                                <span className="text-slate-500">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="address-text" title={client.address}>
                                                {client.address || 'Sin dirección'}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="notes-text" title={client.notes}>
                                                {client.notes || '-'}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="actions-row">
                                                <button className="btn-action btn-edit" onClick={() => handleOpenModal(client)} title="Editar">
                                                    <span className="material-symbols-outlined">edit_square</span>
                                                </button>
                                                <button className="btn-action btn-delete" onClick={() => handleDelete(client.id)} title="Eliminar">
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                                        No se encontraron clientes que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="client-modal-overlay">
                    <div className="client-modal">
                        <div className="modal-head">
                            <h2>{editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                            <button className="btn-close" onClick={handleCloseModal}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-grid">
                                    <div className="input-group full-width">
                                        <label>Nombre Completo*</label>
                                        <input 
                                            type="text" 
                                            required 
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            placeholder="Nombre completo del cliente"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Teléfono</label>
                                        <input 
                                            type="text" 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            placeholder="000 000 0000"
                                        />
                                    </div>
                                    <div className="input-group">
                                        <label>Email</label>
                                        <input 
                                            type="email" 
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            placeholder="ejemplo@correo.com"
                                        />
                                    </div>
                                    <div className="input-group full-width">
                                        <label>Dirección</label>
                                        <textarea 
                                            value={formData.address}
                                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                                            placeholder="Calle, Número, Colonia, Municipio..."
                                            rows="2"
                                        ></textarea>
                                    </div>
                                    <div className="input-group full-width">
                                        <label>Notas / Observaciones</label>
                                        <textarea 
                                            value={formData.notes}
                                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                            placeholder="Información relevante para pedidos..."
                                            rows="2"
                                        ></textarea>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-client btn-cancel" onClick={handleCloseModal}>Cancelar</button>
                                <button type="submit" className="btn-client btn-save">
                                    {editingClient ? 'Actualizar Cliente' : 'Registrar Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showBulkModal && (
                <BulkCustomerImportModal 
                    onClose={() => setShowBulkModal(false)}
                    onSuccess={() => loadClients()}
                />
            )}
        </div>
    );
};
