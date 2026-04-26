import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../../contexts/ProductContext';
import { productService } from '../../services/productService'; // Importar servicio
import { formatearDinero } from '../../utils';
import Swal from 'sweetalert2';
import './PriceConfiguration.css';

export const PriceConfiguration = () => {
    const { productos, loadProducts, loading } = useProducts();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [editedPrices, setEditedPrices] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // Filtrar productos
    const filteredProducts = productos.filter(p => {
        const name = p.name || ''; // Protección contra nombres nulos
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // Obtener categorías únicas
    const categories = ['all', ...new Set(productos.map(p => p.category).filter(Boolean))];

    // Manejar cambio de precio en input
    const handlePriceChange = (id, newPrice) => {
        setEditedPrices(prev => ({
            ...prev,
            [id]: newPrice
        }));
    };

    // Guardar cambios
    const handleSaveChanges = async () => {
        const updates = Object.entries(editedPrices);
        if (updates.length === 0) return;

        setIsSaving(true);
        try {
            let successCount = 0;
            
            // Procesar actualizaciones en paralelo
            for (const [id, price] of updates) {
                const numericPrice = parseFloat(price);
                if (!isNaN(numericPrice) && numericPrice >= 0) {
                    // 1. Encontrar producto original para mantener sus otros datos
                    const originalProduct = productos.find(p => p.id === parseInt(id) || p.id === id);
                    
                    if (originalProduct) {
                        // 2. Crear objeto completo actualizado (para no borrar nombre, stock, etc)
                        const completeUpdate = {
                            ...originalProduct,
                            price: numericPrice
                        };
                        
                        // 3. Llamar al servicio (API) en lugar del contexto
                        await productService.updateProduct(id, completeUpdate);
                        successCount++;
                    }
                }
            }


            // Recargar productos desde la BD para reflejar los cambios en "Precio Actual"
            await loadProducts(true);

            setEditedPrices({});
            Swal.fire({
                title: 'Precios Actualizados',
                text: `Se actualizaron ${successCount} servicios correctamente.`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error saving prices:', error);
            Swal.fire('Error', 'Hubo un problema al guardar los precios', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-select "Lavandería" as default filter if it exists
    useEffect(() => {
        if (categories.includes('Lavandería')) {
            setCategoryFilter('Lavandería');
        }
    }, [productos]);

    return (
        <div className="price-config-container p-6 bg-[var(--admin-bg)] min-h-screen">
            <div className="max-w-5xl mx-auto">
                <header className="mb-8">
                    <button 
                        onClick={() => navigate('/configuracion')}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-bold mb-4 transition-colors"
                    >
                        <span className="material-icons-outlined">arrow_back</span>
                        Volver a Configuración
                    </button>
                    <h1 className="text-3xl font-black text-[var(--admin-text-main)] mb-2">
                        Configuración de Precios
                    </h1>
                    <p className="text-[var(--admin-text-muted)]">
                        Ajusta rápidamente los costos de tus servicios de lavandería.
                    </p>
                </header>

                {/* Filtros */}
                <div className="bg-[var(--admin-card-bg)] p-4 rounded-2xl shadow-sm border border-[var(--admin-card-border)] mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex items-center gap-4 w-full md:w-auto flex-1">
                        <div className="relative flex-1 max-w-md">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-muted)]">search</span>
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-[var(--admin-input-bg)] border-none rounded-xl focus:ring-2 focus:ring-emerald-500 text-[var(--admin-text-main)]"
                                placeholder="Buscar servicio..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <select
                            className="bg-[var(--admin-input-bg)] border-none rounded-xl py-2 pl-4 pr-10 font-medium text-[var(--admin-text-main)] focus:ring-2 focus:ring-emerald-500"
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                        >
                            <option value="all">Todas las Categorías</option>
                            {categories.map(cat => cat !== 'all' && (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {Object.keys(editedPrices).length > 0 && (
                        <button
                            onClick={handleSaveChanges}
                            disabled={isSaving}
                            className="w-full md:w-auto px-6 py-2 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 animate-bounce-subtle"
                        >
                            {isSaving ? (
                                <span className="animate-spin material-symbols-outlined">sync</span>
                            ) : (
                                <span className="material-symbols-outlined">save</span>
                            )}
                            Guardar {Object.keys(editedPrices).length} Cambios
                        </button>
                    )}

                    <button
                        onClick={() => navigate('/inventario')}
                        className="w-full md:w-auto px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                        title="Ir a Inventario para agregar nuevo servicio"
                    >
                        <span className="material-symbols-outlined">add_circle</span>
                        Nuevo Servicio
                    </button>
                </div>

                {/* Lista de Precios */}
                <div className="bg-[var(--admin-card-bg)] rounded-2xl shadow-sm border border-[var(--admin-card-border)] overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">
                            <div className="animate-spin material-symbols-outlined text-4xl mb-2">sync</div>
                            <p>Cargando servicios...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-12 text-center text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                            <p>No se encontraron servicios.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-[var(--admin-sidebar-bg)] border-b border-[var(--admin-card-border)]">
                                    <tr>
                                        <th className="px-6 py-4 font-bold text-xs text-[var(--admin-text-muted)] uppercase tracking-wider">Servicio / Producto</th>
                                        <th className="px-6 py-4 font-bold text-xs text-[var(--admin-text-muted)] uppercase tracking-wider">Categoría</th>
                                        <th className="px-6 py-4 font-bold text-xs text-[var(--admin-text-muted)] uppercase tracking-wider">Modo Cobro</th>
                                        <th className="px-6 py-4 font-bold text-xs text-[var(--admin-text-muted)] uppercase tracking-wider text-right">Precio Actual</th>
                                        <th className="px-6 py-4 font-bold text-xs text-[var(--admin-text-muted)] uppercase tracking-wider w-40 text-center">Nuevo Precio</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredProducts.map(p => {
                                        const isKilo = p.name.toLowerCase().includes('kilo');
                                        const currentPrice = editedPrices[p.id] !== undefined ? editedPrices[p.id] : p.price;
                                        const hasChanged = editedPrices[p.id] !== undefined && parseFloat(editedPrices[p.id]) !== p.price;

                                        return (
                                            <tr key={p.id} className={`hover:bg-[var(--admin-input-bg)] transition-colors ${isKilo ? 'bg-emerald-50/30' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-[var(--admin-text-main)] flex items-center gap-2">
                                                        {isKilo && <span className="material-symbols-outlined text-emerald-500">scale</span>}
                                                        {p.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500">
                                                        {p.category || 'General'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 uppercase font-bold">
                                                    {p.pricing_type === 'kg' ? 'Por Kilo' : 'Por Pieza'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-slate-400">
                                                    {formatearDinero(p.price)}
                                                </td>
                                                <td className="px-6 py-2">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                        <input
                                                            type="number"
                                                            step="0.50"
                                                            className={`w-32 pl-7 pr-3 py-2 rounded-xl text-right font-bold outline-none ring-2 transition-all ${
                                                                hasChanged 
                                                                    ? 'ring-emerald-500 bg-emerald-50 text-emerald-700' 
                                                                    : 'ring-[var(--admin-card-border)] bg-[var(--admin-input-bg)] text-[var(--admin-text-main)] focus:ring-emerald-500'
                                                            }`}
                                                            value={currentPrice}
                                                            onChange={(e) => handlePriceChange(p.id, e.target.value)}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PriceConfiguration;
