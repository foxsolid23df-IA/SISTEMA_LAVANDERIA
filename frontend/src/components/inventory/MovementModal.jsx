import React, { useState } from 'react';
import { FiX, FiSave, FiAlertCircle } from 'react-icons/fi';
import { inventoryService } from '../../services/inventoryService';
import Swal from 'sweetalert2';

const MovementModal = ({ product, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        type: 'IN',
        quantity: '',
        notes: '',
        staffName: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const qty = parseInt(formData.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
            Swal.fire('Error', 'Debe ingresar una cantidad mayor a 0', 'error');
            return;
        }

        if (formData.type === 'OUT' && qty > product.stock) {
            Swal.fire({
                title: 'Alerta de Stock',
                text: `Está intentando retirar ${qty} pero solo hay ${product.stock} en inventario. ¿Desea continuar y dejar el inventario en negativo?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, retirar',
                cancelButtonText: 'Cancelar'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await processMovement(qty);
                }
            });
            return;
        }

        await processMovement(qty);
    };

    const processMovement = async (qty) => {
        setLoading(true);
        try {
            await inventoryService.registerMovement({
                productId: product.id,
                type: formData.type,
                quantity: qty,
                unitCost: product.cost_price || 0,
                unitPrice: product.price || 0,
                notes: formData.notes,
                staffName: formData.staffName
            });

            Swal.fire({
                icon: 'success',
                title: 'Movimiento registrado',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudo guardar el movimiento'
            });
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        Registrar Movimiento
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-white">
                        <FiX size={24} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded flex items-start gap-3">
                        <FiAlertCircle className="text-blue-500 mt-1" size={20} />
                        <div>
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                                Producto: {product?.name}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                Stock actual: <span className="font-bold">{product?.stock}</span>
                            </p>
                        </div>
                    </div>

                    {/* Tipo de movimiento */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Tipo de Movimiento *
                        </label>
                        <select 
                            name="type" 
                            value={formData.type} 
                            onChange={handleChange}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            <option value="IN">Entrada (Aumentar stock)</option>
                            <option value="OUT">Salida / Merma (Disminuir stock)</option>
                        </select>
                    </div>

                    {/* Cantidad */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Cantidad *
                        </label>
                        <input 
                            type="number" 
                            name="quantity" 
                            value={formData.quantity} 
                            onChange={handleChange}
                            min="1"
                            placeholder="Ej. 10"
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    {/* Personal */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Personal Autorizado (Opcional)
                        </label>
                        <input 
                            type="text" 
                            name="staffName" 
                            value={formData.staffName} 
                            onChange={handleChange}
                            placeholder="Nombre del empleado"
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>

                    {/* Notas */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Comentarios o Notas (Opcional)
                        </label>
                        <textarea 
                            name="notes" 
                            value={formData.notes} 
                            onChange={handleChange}
                            placeholder="Motivo del movimiento..."
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-blue-500 focus:border-blue-500 resize-none h-20"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-2 pt-4 mt-2 border-t dark:border-gray-700">
                        <button 
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border dark:border-gray-600 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 transition"
                            disabled={loading}
                        >
                            <FiSave />
                            {loading ? 'Guardando...' : 'Guardar Movimiento'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MovementModal;
