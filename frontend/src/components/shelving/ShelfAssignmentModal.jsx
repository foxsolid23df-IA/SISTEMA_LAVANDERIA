import React, { useState, useEffect, useMemo } from "react";
import Swal from "sweetalert2";
import { useAuth } from "../../hooks/useAuth";
import { shelvingService } from "../../services/shelvingService";
import { orderService } from "../../services/orderService";
import { formatearDinero } from "../../utils";

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const ShelfAssignmentModal = ({ isOpen, onClose, onAssign, orderId = null }) => {
  const { activeStaff } = useAuth();
  const [shelves, setShelves] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(orderId);
  const [selectedShelfId, setSelectedShelfId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterRow, setFilterRow] = useState("all");

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (orderId) setSelectedOrderId(orderId);
    }
  }, [isOpen, orderId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shelvesData, assignmentsData, ordersData] = await Promise.all([
        shelvingService.getShelves(),
        shelvingService.getShelfAssignments(),
        orderService.getOrders()
      ]);
      // Incluir todas las estanterías excepto mantenimiento (permitir occupied)
      setShelves(shelvesData.filter(s => s.status !== 'maintenance'));
      setAssignments(assignmentsData);
      const pending = ordersData.filter(o => o.status === 'received' || o.status === 'processing');
      setOrders(pending);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Agrupar estanterías por fila
  const shelvesByRow = useMemo(() => {
    const map = new Map();
    shelves.forEach(s => {
      if (!map.has(s.row_label)) map.set(s.row_label, []);
      map.get(s.row_label).push(s);
    });
    return map;
  }, [shelves]);

  const availableRows = useMemo(() => [...shelvesByRow.keys()].sort(), [shelvesByRow]);

  const getShelfOccupancy = (shelfId) => {
    return assignments.filter(a => a.shelf_id === shelfId).length;
  };

  const handleAssignClick = async () => {
    if (!selectedOrderId || !selectedShelfId) return;

    const occupancy = getShelfOccupancy(selectedShelfId);
    const selectedShelf = shelves.find(s => s.id === selectedShelfId);

    // Si la estantería ya tiene órdenes, mostrar confirmación
    if (occupancy > 0) {
      const result = await Swal.fire({
        title: `Asignar a ${selectedShelf?.label}?`,
        html: `<p style="text-align:center;margin:0">
          <strong>${selectedShelf?.label}</strong> actualmente tiene
          <strong>${occupancy} orden(es)</strong> asignada(s).
        </p>
        <p style="text-align:center;margin:0.5rem 0 0;color:#64748b;font-size:0.85rem">
          ¿Asignar esta orden también?
        </p>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#10b981",
        confirmButtonText: "Sí, asignar",
        cancelButtonText: "Cancelar"
      });
      if (!result.isConfirmed) return;
    }

    onAssign(selectedShelfId);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
        <div className="modal-header">
          <h2>Asignar Orden a Estantería</h2>
          <button className="modal-close" onClick={onClose}>
            <span className="material-icons-outlined">close</span>
          </button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#64748b' }}>Cargando...</p>
          ) : (
            <>
              {/* Selección de orden */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                  Orden
                </label>
                <select value={selectedOrderId || ''} onChange={(e) => setSelectedOrderId(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                  <option value="">Seleccionar orden...</option>
                  {orders.map(order => (
                    <option key={order.id} value={order.id}>
                      #{order.folio || order.id} - {order.customers?.name || 'Sin cliente'} - {formatearDinero(order.total)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de estantería agrupado por fila */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                  Estantería
                </label>

                {/* Filtro de fila */}
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                  <button onClick={() => setFilterRow("all")}
                    style={{
                      padding: '0.3rem 0.6rem', borderRadius: 6, border: 'none',
                      background: filterRow === 'all' ? '#10b981' : '#f1f5f9',
                      color: filterRow === 'all' ? 'white' : '#64748b',
                      fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer'
                    }}>
                    Todas
                  </button>
                  {availableRows.map(row => (
                    <button key={row} onClick={() => setFilterRow(row)}
                      style={{
                        padding: '0.3rem 0.6rem', borderRadius: 6, border: 'none',
                        background: filterRow === row ? '#10b981' : '#f1f5f9',
                        color: filterRow === row ? 'white' : '#64748b',
                        fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer'
                      }}>
                      Fila {row}
                    </button>
                  ))}
                </div>

                {/* Grid agrupado por fila */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {availableRows.filter(row => filterRow === 'all' || filterRow === row).map(row => (
                    <div key={row}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                        Fila {row}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {shelvesByRow.get(row).map(shelf => {
                          const occupancy = getShelfOccupancy(shelf.id);
                          const isEmpty = occupancy === 0;
                          return (
                            <button key={shelf.id}
                              onClick={() => setSelectedShelfId(shelf.id)}
                              style={{
                                width: 52, height: 52, borderRadius: 8,
                                display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700,
                                cursor: 'pointer', transition: 'all 0.15s',
                                background: selectedShelfId === shelf.id ? '#10b981' :
                                  isEmpty ? '#d1fae5' : '#fef3c7',
                                color: selectedShelfId === shelf.id ? 'white' :
                                  isEmpty ? '#065f46' : '#92400e',
                                border: selectedShelfId === shelf.id ? '2px solid #059669' : '1px solid transparent',
                              }}>
                              <span>{shelf.label}</span>
                              <span style={{ fontSize: '0.5rem', opacity: 0.8 }}>
                                {isEmpty ? 'vacía' : `${occupancy}ord`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="ui-btn ui-btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="ui-btn ui-btn--primary" disabled={!selectedOrderId || !selectedShelfId || loading}
            onClick={handleAssignClick}>
            <span className="material-icons-outlined">check</span>
            Asignar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShelfAssignmentModal;
