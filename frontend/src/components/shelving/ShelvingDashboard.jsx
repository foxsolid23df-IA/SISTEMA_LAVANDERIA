import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import { shelvingService } from "../../services/shelvingService";
import { formatearDinero } from "../../utils";
import Swal from "sweetalert2";
import "./ShelvingDashboard.css";

const ROW_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const ShelvingDashboard = () => {
  const { activeStaff } = useAuth();
  const { settings } = useSettings();
  const [shelves, setShelves] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [unassignedOrders, setUnassignedOrders] = useState([]);
  const [overdueAssignments, setOverdueAssignments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [showAssignPanel, setShowAssignPanel] = useState(false);

  // Maps para búsqueda O(1)
  const shelfMap = useMemo(() => {
    const map = new Map();
    shelves.forEach(s => map.set(`${s.row_label}-${s.column_number}`, s));
    return map;
  }, [shelves]);

  const assignmentMap = useMemo(() => {
    const map = new Map();
    assignments.forEach(a => {
      if (a.shelf?.id) {
        if (!map.has(a.shelf.id)) map.set(a.shelf.id, []);
        map.get(a.shelf.id).push(a);
      }
    });
    return map;
  }, [assignments]);

  const overdueMap = useMemo(() => {
    const map = new Map();
    overdueAssignments.forEach(a => { if (a.shelf?.id) map.set(a.shelf.id, a); });
    return map;
  }, [overdueAssignments]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [shelvesData, assignmentsData, statsData, unassignedData, overdueData] = await Promise.all([
        shelvingService.getShelves(),
        shelvingService.getShelfAssignments(),
        shelvingService.getShelvingStats(),
        shelvingService.getUnassignedOrders(),
        shelvingService.getOverdueAssignments()
      ]);
      setShelves(shelvesData);
      setAssignments(assignmentsData);
      setStats(statsData);
      setUnassignedOrders(unassignedData);
      setOverdueAssignments(overdueData);
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignOrder = async (orderId, shelfId) => {
    try {
      await shelvingService.assignOrderToShelf(orderId, shelfId, activeStaff?.name || 'Sistema');
      Swal.fire({ title: "¡Asignada!", icon: "success", timer: 2000, showConfirmButton: false });
      await loadData();
      setShowAssignPanel(false);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleUnassignOrder = async (orderId) => {
    const result = await Swal.fire({
      title: "¿Quitar asignación?",
      text: "La ropa se marcará como retirada",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, quitar"
    });
    if (!result.isConfirmed) return;
    try {
      await shelvingService.unassignOrder(orderId, activeStaff?.name || 'Sistema');
      Swal.fire({ title: "Desasignada", icon: "success", timer: 2000, showConfirmButton: false });
      await loadData();
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleSearchByShelf = async () => {
    if (!searchTerm.trim()) { await loadData(); return; }
    try {
      const results = await shelvingService.getOrdersByShelf(searchTerm.trim().toUpperCase());
      setAssignments(results);
    } catch (err) {
      Swal.fire("Error", "No se encontraron resultados", "error");
    }
  };

  const handleScanQR = async () => {
    const { value: orderId } = await Swal.fire({
      title: "Escanear / Ingresar código",
      input: "text",
      inputLabel: "ID de orden o código QR",
      inputPlaceholder: "Pega el código o escribe el ID",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      inputValidator: (v) => !v && "Debes ingresar un código"
    });
    if (!orderId) return;
    try {
      const result = await shelvingService.scanShelf(orderId);
      if (result) {
        const o = result.order;
        Swal.fire({
          title: `Ubicación: ${result.shelf?.label || 'N/A'}`,
          html: `<div style="text-align:left">
            <p><strong>Orden:</strong> #${o.folio || o.id}</p>
            <p><strong>Cliente:</strong> ${o.customer?.name || 'N/A'}</p>
            <p><strong>Total:</strong> $${parseFloat(o.total).toFixed(2)}</p>
            <p><strong>Entrega:</strong> ${o.promised_at ? new Date(o.promised_at).toLocaleDateString() : 'N/A'}</p>
          </div>`,
          icon: "info",
          confirmButtonColor: "#10b981"
        });
      } else {
        Swal.fire("No encontrada", "No se encontró asignación", "warning");
      }
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const filteredShelves = useMemo(() => {
    return shelves.filter(shelf => filterStatus === 'all' || shelf.status === filterStatus);
  }, [shelves, filterStatus]);

  const filteredSet = useMemo(() => new Set(filteredShelves.map(s => s.id)), [filteredShelves]);

  const isOverdue = (orderId) => {
    return overdueAssignments.some(a => a.order_id === orderId);
  };

  if (!settings?.shelving_enabled) {
    return (
      <div className="shelving-container">
        <div className="shelving-disabled">
          <span className="material-icons-outlined" style={{ fontSize: 48, color: '#94a3b8' }}>shelves</span>
          <h2>Módulo de Estanterías Deshabilitado</h2>
          <p>Activa el módulo desde Configuración de Estanterías.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shelving-container">
      <div className="shelving-header">
        <h1>
          <span className="material-icons-outlined">shelves</span>
          Gestión de Estanterías
        </h1>
        <div className="shelving-actions">
          <button className="ui-btn ui-btn--secondary" onClick={handleScanQR}>
            <span className="material-icons-outlined">qr_code_scanner</span>
            Escanear
          </button>
          <button className="ui-btn ui-btn--primary" onClick={() => { loadData(); setShowAssignPanel(true); }}>
            <span className="material-icons-outlined">add_location</span>
            Asignar
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="shelving-stats-grid">
          <div className="stat-card">
            <span className="material-icons-outlined" style={{ color: '#64748b' }}>inventory_2</span>
            <div><span className="stat-value">{stats.totalShelves}</span><span className="stat-label">Total</span></div>
          </div>
          <div className="stat-card">
            <span className="material-icons-outlined" style={{ color: '#10b981' }}>check_circle</span>
            <div><span className="stat-value stat-available">{stats.availableShelves}</span><span className="stat-label">Disponibles</span></div>
          </div>
          <div className="stat-card">
            <span className="material-icons-outlined" style={{ color: '#ef4444' }}>lock</span>
            <div><span className="stat-value stat-occupied">{stats.occupiedShelves}</span><span className="stat-label">Ocupadas</span></div>
          </div>
          <div className="stat-card">
            <span className="material-icons-outlined" style={{ color: '#f59e0b' }}>warning</span>
            <div><span className="stat-value stat-overdue">{overdueAssignments.length}</span><span className="stat-label">Vencidas</span></div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="shelving-toolbar">
        <div className="search-box">
          <span className="material-icons-outlined">search</span>
          <input type="text" placeholder="Buscar estantería (ej: A3)..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearchByShelf()} />
          {searchTerm && (
            <button className="clear-btn" onClick={() => { setSearchTerm(""); loadData(); }}>
              <span className="material-icons-outlined">close</span>
            </button>
          )}
          <button className="search-go-btn" onClick={handleSearchByShelf}>
            <span className="material-icons-outlined">arrow_forward</span>
          </button>
        </div>
        <div className="filter-tabs">
          {['all', 'available', 'occupied', 'maintenance'].map(s => (
            <button key={s} className={`filter-tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'Todas' : s === 'available' ? 'Libres' : s === 'occupied' ? 'Ocupadas' : 'Mto.'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="shelving-loading">
          <div className="spinner"></div>
          <span>Cargando estanterías...</span>
        </div>
      ) : (
        <div className="shelf-grid">
          {ROW_LABELS.slice(0, settings?.shelving_rows || 5).map(row => (
            <div key={row} className="shelf-grid-row-main">
              <span className="row-label-main">{row}</span>
              <div className="shelf-grid-cells">
                {Array.from({ length: settings?.shelving_columns || 10 }, (_, i) => i + 1).map(col => {
                  const shelf = shelfMap.get(`${row}-${col}`);
                  const shelfAssignments = shelf ? (assignmentMap.get(shelf.id) || []) : [];
                  const orderCount = shelfAssignments.length;
                  const overdue = shelf ? overdueMap.get(shelf.id) : null;
                  const status = shelf?.status || 'available';
                  const isSelected = selectedShelf?.id === shelf?.id;
                  const isFiltered = shelf ? filteredSet.has(shelf.id) : false;

                  const countClass = orderCount === 0 ? '' : orderCount <= 2 ? 'count-low' : orderCount <= 4 ? 'count-medium' : 'count-high';

                  return (
                    <div key={col}
                      className={`shelf-cell-main shelf-${status} ${isSelected ? 'selected' : ''} ${!isFiltered && filterStatus !== 'all' ? 'dimmed' : ''} ${overdue ? 'overdue' : ''}`}
                      onClick={() => setSelectedShelf(isSelected ? null : shelf)}
                      title={shelf ? `${shelf.label} - ${orderCount > 0 ? orderCount + ' orden(es)' : 'Vacía'}${overdue ? ' ⚠️ VENCIDA' : ''}` : `${row}${col}`}>
                      <span className="cell-label">{row}{col}</span>
                      {orderCount > 0 && (
                        <span className={`cell-order-badge ${countClass} ${overdue ? 'overdue-badge' : ''}`}>
                          {orderCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Panel lateral de detalles */}
      {selectedShelf && (
        <div className="shelf-detail-panel">
          <div className="detail-header">
            <h3>
              <span className={`shelf-dot shelf-dot-${selectedShelf.status}`} />
              {selectedShelf.label}
            </h3>
            <button className="close-btn" onClick={() => setSelectedShelf(null)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="detail-body">
            <div className="detail-row">
              <span>Estado:</span>
              <span className={`status-badge status-${selectedShelf.status}`}>
                {selectedShelf.status === 'available' ? 'Disponible' : selectedShelf.status === 'occupied' ? 'Ocupada' : 'Mantenimiento'}
              </span>
            </div>
            {assignments.filter(a => a.shelf?.id === selectedShelf.id).map(a => (
              <div key={a.id} className={`assignment-card ${isOverdue(a.order_id) ? 'assignment-overdue' : ''}`}>
                {isOverdue(a.order_id) && (
                  <div className="overdue-alert">
                    <span className="material-icons-outlined">warning</span>
                    Orden vencida
                  </div>
                )}
                <div className="assignment-order">
                  <strong>Orden #{a.order?.folio || a.order?.id}</strong>
                  <span className="assignment-client">{a.order?.customer?.name || 'Sin cliente'}</span>
                </div>
                <div className="assignment-info">
                  <span>Asignada: {new Date(a.assigned_at).toLocaleDateString()}</span>
                  {a.order?.promised_at && (
                    <span>Entrega: {new Date(a.order.promised_at).toLocaleDateString()}</span>
                  )}
                </div>
                <button className="ui-btn ui-btn--danger ui-btn--sm" onClick={() => handleUnassignOrder(a.order_id)}>
                  <span className="material-icons-outlined">remove_circle</span> Retirar
                </button>
              </div>
            ))}
            {assignments.filter(a => a.shelf?.id === selectedShelf.id).length === 0 && (
              <div className="no-assignments">
                <span className="material-icons-outlined">inbox</span>
                <p>Sin órdenes asignadas</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Panel de órdenes sin asignar */}
      {showAssignPanel && (
        <div className="modal-overlay" onClick={() => setShowAssignPanel(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Asignar Estantería</h2>
              <button className="modal-close" onClick={() => setShowAssignPanel(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="modal-body">
              <div className="unassigned-section">
                <h3>Órdenes sin ubicar ({unassignedOrders.length})</h3>
                {unassignedOrders.length === 0 ? (
                  <p className="no-data">Todas las órdenes activas tienen estantería asignada</p>
                ) : (
                  <div className="unassigned-list">
                    {unassignedOrders.map(order => (
                      <UnassignedOrderCard key={order.id} order={order} shelves={shelves}
                        onAssign={(shelfId) => handleAssignOrder(order.id, shelfId)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-componente para orden sin asignar
const UnassignedOrderCard = ({ order, shelves, onAssign }) => {
  const [selectedShelfId, setSelectedShelfId] = useState(null);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    shelvingService.getShelfAssignments().then(setAssignments).catch(() => {});
  }, []);

  const getShelfOccupancy = (shelfId) => {
    return assignments.filter(a => a.shelf_id === shelfId).length;
  };

  const handleAssignClick = async () => {
    if (!selectedShelfId) return;
    const occupancy = getShelfOccupancy(selectedShelfId);
    const selectedShelf = shelves.find(s => s.id === selectedShelfId);

    if (occupancy > 0) {
      const result = await Swal.fire({
        title: `Asignar a ${selectedShelf?.label}?`,
        html: `<p style="text-align:center;margin:0">
          <strong>${selectedShelf?.label}</strong> actualmente tiene
          <strong>${occupancy} orden(es)</strong> asignada(s).
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

  // Incluir estanterías no mantenimiento (available + occupied)
  const assignableShelves = shelves.filter(s => s.status !== 'maintenance');

  return (
    <div className="unassigned-card">
      <div className="unassigned-info">
        <span className="unassigned-folio">#{order.folio || order.id}</span>
        <span className="unassigned-client">{order.customer?.name || 'Sin cliente'}</span>
        <span className="unassigned-total">{formatearDinero(order.total)}</span>
      </div>
      <div className="unassigned-shelf-select">
        <select value={selectedShelfId || ''} onChange={(e) => setSelectedShelfId(e.target.value)}>
          <option value="">Seleccionar...</option>
          {assignableShelves.map(s => {
            const occ = getShelfOccupancy(s.id);
            return (
              <option key={s.id} value={s.id}>
                {s.label}{occ > 0 ? ` (${occ}ord)` : ' (vacía)'}
              </option>
            );
          })}
        </select>
        <button className="ui-btn ui-btn--primary ui-btn--sm" disabled={!selectedShelfId}
          onClick={handleAssignClick}>
          <span className="material-icons-outlined text-sm">check</span>
        </button>
      </div>
    </div>
  );
};

export default ShelvingDashboard;
