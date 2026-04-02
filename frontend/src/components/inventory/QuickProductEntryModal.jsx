import React, { useState, useEffect, useRef } from 'react';
import { productService } from '../../services/productService';
import { FiSearch, FiX, FiPackage, FiTruck, FiCornerDownRight, FiCheck } from 'react-icons/fi';
import './QuickProductEntryModal.css';

const QuickProductEntryModal = ({ isOpen, onClose, onProductCreated, products = [] }) => {
    const [step, setStep] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [inventoryQty, setInventoryQty] = useState('');
    const [mermaQty, setMermaQty] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const searchRef = useRef(null);

    // Filtrado de productos para la búsqueda
    const filteredProducts = products.filter(p => 
        (p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.barcode?.includes(searchTerm)) &&
        p.type === 'PRODUCT'
    ).slice(0, 5);

    useEffect(() => {
        if (isOpen) {
            resetModal();
            setTimeout(() => searchRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const resetModal = () => {
        setStep(1);
        setSearchTerm('');
        setSelectedProduct(null);
        setInventoryQty('');
        setMermaQty('');
        setError(null);
    };

    if (!isOpen) return null;

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!selectedProduct || (!inventoryQty && !mermaQty)) return;

        setLoading(true);
        setError(null);

        try {
            const addedStock = parseInt(inventoryQty || 0);
            const addedMerma = parseInt(mermaQty || 0);
            
            // Calculamos el nuevo stock restando la merma si es necesario? 
            // Según la imagen, la merma son piezas devueltas o dadas de baja.
            // Si el proveedor trae 10 y 2 son merma, el stock neto que entra es 10 o 8?
            // "CANTIDAD QUE INGRESA A LA TIENDA" -> Esto debería sumarse directamente al stock.
            // "CANTIDAD EN INTERCAMBIO (MERMA)" -> Esto debería sumarse a la merma acumulada.
            
            const newStock = parseInt(selectedProduct.stock || 0) + addedStock;
            const newMerma = parseInt(selectedProduct.merma || 0) + addedMerma;

            const result = await productService.updateProduct(selectedProduct.id, {
                stock: newStock,
                merma: newMerma
            });

            if (onProductCreated) {
                onProductCreated(result);
            }
            onClose();
        } catch (err) {
            console.error('Error al registrar entrada:', err);
            setError('Error al procesar el registro. Intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="quick-entry-overlay" onClick={onClose}>
            <div className="quick-entry-card" onClick={e => e.stopPropagation()}>
                <div className="quick-entry-header">
                    <div className="header-text">
                        <h2>{step === 1 ? 'Busque el producto' : 'Registrar Entrada'}</h2>
                        <p>
                            {step === 1 
                                ? 'Busque un producto para registrar la entrada del proveedor o piezas de intercambio' 
                                : 'Configure las cantidades que ingresan al inventario y las devoluciones.'}
                        </p>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <FiX size={24} />
                    </button>
                </div>

                <div className="quick-entry-content">
                    {step === 1 ? (
                        <div className="step-search">
                            <div className="search-container">
                                <FiSearch className="search-icon" />
                                <input 
                                    ref={searchRef}
                                    type="text" 
                                    className="search-input"
                                    placeholder="Nombre del producto o código..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            
                            {searchTerm && (
                                <div className="search-results">
                                    {filteredProducts.length > 0 ? (
                                        filteredProducts.map(p => (
                                            <div key={p.id} className="result-item" onClick={() => handleSelectProduct(p)}>
                                                <div className="item-icon">
                                                    <FiPackage />
                                                </div>
                                                <div className="item-info">
                                                    <span className="item-name">{p.name}</span>
                                                    <span className="item-category">{p.category || 'Sin categoría'} • Stock: {p.stock}</span>
                                                </div>
                                                <FiCornerDownRight color="#3b82f6" />
                                            </div>
                                        ))
                                    ) : (
                                        <div className="result-item no-results">
                                            <span>No se encontraron productos coincidentes</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="step-form">
                            <div className="selected-product-card">
                                <button className="change-product-btn" onClick={() => setStep(1)}>
                                    Cambiar
                                </button>
                                <div className="product-avatar">
                                    {selectedProduct.image_url ? (
                                        <img src={selectedProduct.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                                    ) : (
                                        <FiPackage />
                                    )}
                                </div>
                                <div className="product-details-info">
                                    <h3>{selectedProduct.name}</h3>
                                    <div className="stats-row">
                                        <span className="stat-tag">Stock actual: <strong>{selectedProduct.stock}</strong></span>
                                        <span className="stat-tag">Merma acum: <strong>{selectedProduct.merma || 0}</strong></span>
                                    </div>
                                </div>
                            </div>

                            <div className="entry-form-grid">
                                <div className="entry-group">
                                    <label>CANTIDAD QUE INGRESA A LA TIENDA</label>
                                    <input 
                                        type="number" 
                                        className="large-input"
                                        placeholder="0"
                                        value={inventoryQty}
                                        onChange={(e) => setInventoryQty(e.target.value)}
                                        autoFocus
                                    />
                                    <span className="input-hint">Piezas que se suman al stock físico.</span>
                                </div>
                                <div className="entry-group">
                                    <label>CANTIDAD EN INTERCAMBIO (MERMA)</label>
                                    <input 
                                        type="number" 
                                        className="large-input"
                                        placeholder="0"
                                        value={mermaQty}
                                        onChange={(e) => setMermaQty(e.target.value)}
                                        style={{ color: '#ef4444' }}
                                    />
                                    <span className="input-hint">Piezas devueltas o dadas de baja.</span>
                                </div>
                            </div>

                            {error && <p className="error-text" style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: '16px', textAlign: 'center' }}>{error}</p>}
                        </div>
                    )}
                </div>

                <div className="quick-entry-footer">
                    <button className="btn-secondary" onClick={step === 2 ? () => setStep(1) : onClose}>
                        {step === 2 ? 'Regresar' : 'Cancelar'}
                    </button>
                    {step === 2 && (
                        <button 
                            className={`btn-primary ${(inventoryQty > 0 || mermaQty > 0) ? 'active' : ''}`}
                            disabled={loading || (!inventoryQty && !mermaQty)}
                            onClick={handleSubmit}
                        >
                            {loading ? 'Registrando...' : (
                                <>
                                    <FiCheck />
                                    Registrar Entrada
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuickProductEntryModal;
