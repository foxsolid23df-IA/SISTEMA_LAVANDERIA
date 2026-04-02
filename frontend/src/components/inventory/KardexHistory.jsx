import React, { useState, useEffect } from 'react';
import { FiX, FiClock, FiUser, FiArrowRightCircle, FiArrowLeftCircle, FiShoppingCart } from 'react-icons/fi';
import { inventoryService } from '../../services/inventoryService';
import Swal from 'sweetalert2';

const KardexHistory = ({ product, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (product && product.id) {
            loadHistory();
        }
    }, [product]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await inventoryService.getMovementHistory(product.id);
            setHistory(data || []);
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo cargar el historial.'
            });
        } finally {
            setLoading(false);
        }
    };

    const getMovementInfo = (type) => {
        switch (type) {
            case 'IN':
                return { label: 'Entrada', color: '#10b981', icon: <FiArrowRightCircle /> }; // Verde
            case 'OUT':
                return { label: 'Salida / Merma', color: '#ef4444', icon: <FiArrowLeftCircle /> }; // Rojo
            case 'SALE':
                return { label: 'Venta', color: '#3b82f6', icon: <FiShoppingCart /> }; // Azul
            default:
                return { label: 'Ajuste', color: '#6b7280', icon: <FiClock /> }; // Gris
        }
    };

    const formatDate = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">Kardex de Producto</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Historial completo de: <span className="font-semibold">{product?.name}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-white">
                        <FiX size={24} />
                    </button>
                </div>

                {/* Body / Table */}
                <div className="p-4 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <span className="text-gray-500">Cargando historial...</span>
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            No hay movimientos registrados para este producto todavía.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
                                <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                                    <tr>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Tipo</th>
                                        <th className="p-3">Cant.</th>
                                        <th className="p-3">Stock Ant.</th>
                                        <th className="p-3">Nuevo Stock</th>
                                        <th className="p-3">Personal</th>
                                        <th className="p-3 max-w-xs">Notas</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((mov) => {
                                        const info = getMovementInfo(mov.type);
                                        return (
                                            <tr key={mov.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                                                <td className="p-3 whitespace-nowrap">{formatDate(mov.created_at)}</td>
                                                <td className="p-3 font-medium flex items-center gap-2" style={{ color: info.color }}>
                                                    {info.icon} {info.label}
                                                </td>
                                                <td className="p-3 font-semibold">{mov.quantity}</td>
                                                <td className="p-3 text-gray-500">{mov.previous_stock}</td>
                                                <td className="p-3 font-bold">{mov.new_stock}</td>
                                                <td className="p-3 flex items-center gap-1">
                                                    <FiUser size={14} className="text-gray-400"/>
                                                    <span className="truncate max-w-[100px]">{mov.staff_name || 'Admin'}</span>
                                                </td>
                                                <td className="p-3 max-w-xs truncate" title={mov.notes}>
                                                    {mov.notes || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KardexHistory;
