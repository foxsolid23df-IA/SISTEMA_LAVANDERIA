import React, { useState, useEffect } from "react";
import { inventoryService } from "../../services/inventoryService";
import { useAuth } from "../../hooks/useAuth";
import Swal from "sweetalert2";
import "./KardexView.css";

export const KardexView = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ products: [], kpis: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states for movements
  const [moveType, setMoveType] = useState("OUT"); // IN, OUT
  const [moveQty, setMoveQty] = useState("");
  const [moveNotes, setMoveNotes] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await inventoryService.getProductsValuation();
      setData(result);
    } catch (error) {
      console.error("Error loading kardex:", error);
      Swal.fire("Error", "No se pudo cargar la valoración del inventario", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectProduct = async (product) => {
    setSelectedProduct(product);
    await fetchHistory(product.id);
  };

  const fetchHistory = async (productId) => {
    try {
      setLoadingHistory(true);
      const res = await inventoryService.getMovementHistory(productId);
      setHistory(res);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "No se pudo cargar el historial", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleRegisterMovement = async (e) => {
    e.preventDefault();
    if (!moveQty || isNaN(moveQty) || Number(moveQty) <= 0) {
      return Swal.fire("Atención", "Ingresa una cantidad válida mayor a 0", "warning");
    }

    try {
      Swal.fire({ title: "Registrando...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await inventoryService.registerMovement({
        productId: selectedProduct.id,
        type: moveType,
        quantity: Number(moveQty),
        unitCost: selectedProduct.cost_price || 0,
        unitPrice: selectedProduct.price || 0,
        notes: moveNotes || (moveType === 'IN' ? 'Ajuste de Entrada' : 'Merma / Ajuste de Salida'),
        staffName: user?.email || "Admin"
      });
      Swal.fire("Éxito", "Movimiento registrado correctamente", "success");
      
      // Reset form
      setMoveQty("");
      setMoveNotes("");
      
      // Refresh
      fetchHistory(selectedProduct.id);
      loadData();
    } catch (error) {
      Swal.fire("Error", error.message || "Error al registrar movimiento", "error");
    }
  };

  // Filter
  const filteredProducts = data.products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return <div className="kardex-loading"><span className="material-icons-outlined animate-spin">refresh</span> Cargando Kardex...</div>;

  return (
    <div className="kardex-container">
      {/* KPIs Section */}
      <div className="kardex-kpis">
        <div className="kpi-card card-blue">
          <div className="kpi-icon"><span className="material-icons-outlined">inventory</span></div>
          <div className="kpi-data">
            <h4>Total Productos</h4>
            <h2>{data.kpis.totalProducts}</h2>
          </div>
        </div>
        <div className="kpi-card card-emerald">
          <div className="kpi-icon"><span className="material-icons-outlined">monetization_on</span></div>
          <div className="kpi-data">
            <h4>Valorización a Costo</h4>
            <h2>${(data.kpis.totalCostValue || 0).toFixed(2)}</h2>
          </div>
        </div>
        <div className="kpi-card card-purple">
          <div className="kpi-icon"><span className="material-icons-outlined">price_check</span></div>
          <div className="kpi-data">
            <h4>Valorización Esperada (PV)</h4>
            <h2>${(data.kpis.totalPriceValue || 0).toFixed(2)}</h2>
          </div>
        </div>
        <div className="kpi-card card-rose">
          <div className="kpi-icon"><span className="material-icons-outlined">warning</span></div>
          <div className="kpi-data">
            <h4>Bajo Stock</h4>
            <h2>{data.kpis.lowStockCount}</h2>
          </div>
        </div>
      </div>

      <div className="kardex-main-layout">
        <div className={`kardex-table-section ${selectedProduct ? 'shrink' : ''}`}>
          <div className="k-table-header">
            <h3>Control de Inventario (Kardex)</h3>
            <div className="search-box">
              <span className="material-icons-outlined">search</span>
              <input 
                type="text" 
                placeholder="Buscar producto..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="k-table-container">
            <table className="k-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock Actual</th>
                  <th>Costo Prom.</th>
                  <th>Precio Venta</th>
                  <th>Valorizado (Costo)</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.id} className={selectedProduct?.id === p.id ? 'active-row' : ''} onClick={() => handleSelectProduct(p)}>
                    <td className="font-bold">{p.name} {p.barcode && <span className="k-barcode">({p.barcode})</span>}</td>
                    <td>
                      <span className={`stock-badge ${p.stock <= (p.min_stock || 10) ? 'danger' : 'success'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="text-slate-300">${(p.cost_price || 0).toFixed(2)}</td>
                    <td className="text-slate-300">${(p.price || 0).toFixed(2)}</td>
                    <td className="text-emerald-400 font-bold">${(p.total_cost_value || 0).toFixed(2)}</td>
                    <td>
                      <button className="k-btn-view" onClick={(e) => { e.stopPropagation(); handleSelectProduct(p); }}>
                        Ver Historial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedProduct && (
          <div className="kardex-side-panel slide-in">
            <div className="panel-header">
              <div>
                <h2>{selectedProduct.name}</h2>
                <p>Stock actual: <strong className={selectedProduct.stock <= (selectedProduct.min_stock || 10) ? 'text-red-400' : 'text-emerald-400'}>{selectedProduct.stock}</strong> unidades</p>
              </div>
              <button className="close-panel" onClick={() => setSelectedProduct(null)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>

            <div className="movement-form-box">
              <h3>Registrar Merma o Ajuste</h3>
              <form onSubmit={handleRegisterMovement}>
                <div className="form-row">
                  <select value={moveType} onChange={e => setMoveType(e.target.value)} className="k-select">
                    <option value="IN">Entrada (Sumar)</option>
                    <option value="OUT">Salida / Merma (Restar)</option>
                  </select>
                  <input 
                    type="number" 
                    placeholder="Cantidad" 
                    min="1" 
                    value={moveQty} 
                    onChange={e => setMoveQty(e.target.value)} 
                    className="k-input" 
                    required
                  />
                </div>
                <input 
                  type="text" 
                  placeholder="Motivo (ej. Producto dañado, Caducado, Ajuste inventario)" 
                  value={moveNotes} 
                  onChange={e => setMoveNotes(e.target.value)} 
                  className="k-input full-width mt-2" 
                  required
                />
                <button type="submit" className={`k-btn-submit ${moveType === 'IN' ? 'btn-in' : 'btn-out'} mt-3`}>
                  <span className="material-icons-outlined">{moveType === 'IN' ? 'add_circle' : 'remove_circle'}</span>
                  Confirmar {moveType === 'IN' ? 'Entrada' : 'Salida'}
                </button>
              </form>
            </div>

            <div className="history-section">
              <h3>Historial de Movimientos</h3>
              {loadingHistory ? (
                <div className="loading-history">Cargando...</div>
              ) : history.length === 0 ? (
                <div className="no-history">No hay movimientos registrados.</div>
              ) : (
                <div className="timeline">
                  {history.map(item => (
                    <div className="timeline-item" key={item.id}>
                      <div className={`timeline-icon ${item.type}`}>
                        <span className="material-icons-outlined">
                          {item.type === 'IN' ? 'arrow_downward' : item.type === 'OUT' ? 'arrow_upward' : 'shopping_cart_checkout'}
                        </span>
                      </div>
                      <div className="timeline-content">
                        <div className="t-header">
                          <span className={`t-badge ${item.type}`}>
                            {item.type === 'IN' ? '+ ENTRADA' : item.type === 'OUT' ? '- MERMA / SALIDA' : '- VENTA'}
                          </span>
                          <span className="t-date">{new Date(item.created_at).toLocaleString()}</span>
                        </div>
                        <p className="t-details">
                          <strong>{item.quantity}</strong> unds. 
                          (Antes: {item.previous_stock} → Ahora: <strong>{item.new_stock}</strong>)
                        </p>
                        {item.notes && <p className="t-notes"><em>"{item.notes}"</em></p>}
                        <span className="t-staff">Por: {item.staff_name || 'Sistema'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
