import React, { useState, useEffect } from 'react';
import { FiBox, FiTrendingDown, FiDollarSign, FiPlusCircle, FiList, FiAlertTriangle } from 'react-icons/fi';
import { inventoryService } from '../../services/inventoryService';
import MovementModal from './MovementModal';
import KardexHistory from './KardexHistory';
import Swal from 'sweetalert2';

const InventoryControl = () => {
    const [products, setProducts] = useState([]);
    const [kpis, setKpis] = useState({ totalCostValue: 0, totalPriceValue: 0, lowStockCount: 0, totalProducts: 0 });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modales
    const [movementModalTarget, setMovementModalTarget] = useState(null);
    const [kardexModalTarget, setKardexModalTarget] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await inventoryService.getProductsValuation();
            setProducts(result.products || []);
            setKpis(result.kpis || { totalCostValue: 0, totalPriceValue: 0, lowStockCount: 0, totalProducts: 0 });
        } catch (error) {
            Swal.fire('Error', 'No se pudieron cargar los datos del inventario.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(amount);
    };

    const filteredProducts = products.filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 h-full flex flex-col bg-gray-50 dark:bg-gray-900">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Inventario de Productos</h1>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg">
                        <FiBox size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Productos</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{kpis.totalProducts}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg">
                        <FiAlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Stock Bajo</p>
                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{kpis.lowStockCount}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-lg">
                        <FiDollarSign size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Costo Total Disp.</p>
                        <p className="text-xl font-bold text-gray-800 dark:text-white">{formatMoney(kpis.totalCostValue)}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-lg">
                        <FiTrendingDown size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Valor de Venta</p>
                        <p className="text-xl font-bold text-gray-800 dark:text-white">{formatMoney(kpis.totalPriceValue)}</p>
                    </div>
                </div>
            </div>

            {/* Actions & Filters */}
            <div className="flex flex-col md:flex-row justify-between mb-4 mt-2 gap-4">
                <input 
                    type="text"
                    placeholder="Buscar producto..."
                    className="p-2 border rounded-lg max-w-sm w-full dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden flex-1 border border-gray-100 dark:border-gray-700">
                <div className="overflow-x-auto h-full">
                    <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
                        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                            <tr>
                                <th className="p-4 font-semibold border-b dark:border-gray-600">Código / Nombre</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-600">Stock</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-600 hidden sm:table-cell">Mínimo</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-600 hidden lg:table-cell">Costo Unit.</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-600 hidden lg:table-cell">Precio Público</th>
                                <th className="p-4 font-semibold border-b dark:border-gray-600 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-8 text-gray-500">Cargando inventario...</td>
                                </tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-8 text-gray-500">No se encontraron productos.</td>
                                </tr>
                            ) : (
                                filteredProducts.map((p) => {
                                    const isLow = p.stock <= (p.min_stock || 10);
                                    return (
                                        <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                                            <td className="p-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
                                                {p.barcode && <div className="text-xs text-gray-500">{p.barcode}</div>}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${isLow ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}>
                                                    {p.stock}
                                                </span>
                                            </td>
                                            <td className="p-4 hidden sm:table-cell text-gray-500">{p.min_stock || 10}</td>
                                            <td className="p-4 hidden lg:table-cell">{formatMoney(p.cost_price || 0)}</td>
                                            <td className="p-4 hidden lg:table-cell font-medium">{formatMoney(p.price || 0)}</td>
                                            <td className="p-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={() => setKardexModalTarget(p)}
                                                        className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/60 dark:text-blue-400 rounded transition flex items-center gap-1"
                                                        title="Ver Kardex"
                                                    >
                                                        <FiList /> <span className="hidden xl:inline text-xs">Kardex</span>
                                                    </button>
                                                    <button 
                                                        onClick={() => setMovementModalTarget(p)}
                                                        className="p-2 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/60 dark:text-emerald-400 rounded transition flex items-center gap-1"
                                                        title="Añadir Movimiento"
                                                    >
                                                        <FiPlusCircle /> <span className="hidden xl:inline text-xs">Mov.</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {movementModalTarget && (
                <MovementModal 
                    product={movementModalTarget}
                    onClose={() => setMovementModalTarget(null)}
                    onSuccess={loadData}
                />
            )}
            {kardexModalTarget && (
                <KardexHistory 
                    product={kardexModalTarget}
                    onClose={() => setKardexModalTarget(null)}
                />
            )}
        </div>
    );
};

export default InventoryControl;
