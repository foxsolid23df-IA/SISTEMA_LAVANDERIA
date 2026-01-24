
import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { businessSettingsService } from '../../services/businessSettingsService';
import './TicketConfiguration.css';

export const TicketConfiguration = () => {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        logo_url: '',
        ticket_message: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const settings = await businessSettingsService.getSettings();
            if (settings) {
                setFormData({
                    name: settings.name || '',
                    address: settings.address || '',
                    phone: settings.phone || '',
                    logo_url: settings.logo_url || '',
                    ticket_message: settings.ticket_message || ''
                });
            }
        } catch (error) {
            console.error('Error cargando configuración:', error);
            Swal.fire('Error', 'No se pudo cargar la configuración', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await businessSettingsService.saveSettings(formData);
            Swal.fire({
                title: 'Guardado',
                text: 'La configuración del ticket ha sido actualizada',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error guardando configuración:', error);
            Swal.fire('Error', 'No se pudo guardar la configuración', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando configuración...</div>;

    return (
        <div className="ticket-config-container">
            <div className="ticket-config-header">
                <h1>Configuración del Ticket</h1>
                <p>Personaliza la información que aparece en el ticket de venta para tus clientes.</p>
            </div>

            <form onSubmit={handleSubmit} className="ticket-config-form">
                <div className="form-group-config">
                    <label htmlFor="name">Nombre del Negocio</label>
                    <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Ej: Lavandería La Burbuja"
                    />
                </div>

                <div className="form-group-config">
                    <label htmlFor="address">Dirección</label>
                    <textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="Calle Principal #123, Col. Centro, Ciudad"
                        rows="3"
                    />
                </div>

                <div className="form-group-config">
                    <label htmlFor="phone">Teléfono / Contacto</label>
                    <input
                        type="text"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="Ej: 555-123-4567"
                    />
                </div>

                <div className="form-group-config">
                    <label htmlFor="logo_upload">Logo del Negocio</label>
                    
                    <div className="logo-upload-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input
                            type="file"
                            id="logo_upload"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (!file) return;

                                // Validar tamaño (max 500KB)
                                if (file.size > 500 * 1024) {
                                    Swal.fire('Archivo muy grande', 'El logo debe pesar menos de 500KB', 'warning');
                                    return;
                                }

                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    setFormData(prev => ({
                                        ...prev,
                                        logo_url: reader.result
                                    }));
                                };
                                reader.readAsDataURL(file);
                            }}
                            style={{ padding: '10px' }}
                        />
                        <p className="text-xs text-gray-500">Formatos: PNG, JPG. Máximo 500KB.</p>
                    </div>

                    {formData.logo_url && (
                        <div className="preview-logo">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <p className="text-sm font-bold text-gray-700">Vista previa:</p>
                                <button 
                                    type="button" 
                                    className="text-red-500 text-xs hover:text-red-700 underline"
                                    onClick={() => setFormData(prev => ({ ...prev, logo_url: '' }))}
                                >
                                    Eliminar Logo
                                </button>
                            </div>
                            <img 
                                src={formData.logo_url} 
                                alt="Logo Preview" 
                                onError={(e) => e.target.style.display = 'none'} 
                            />
                        </div>
                    )}
                </div>

                <div className="form-group-config">
                    <label htmlFor="ticket_message">Mensaje de Pie de Página</label>
                    <textarea
                        id="ticket_message"
                        name="ticket_message"
                        value={formData.ticket_message}
                        onChange={handleChange}
                        placeholder="Gracias por su compra, vuelva pronto"
                        rows="2"
                    />
                </div>

                <button type="submit" className="save-config-btn" disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </form>
        </div>
    );
};
