import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { shelvingService } from "../../services/shelvingService";

export const ShelvingHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await shelvingService.getMovementHistory(100);
      setHistory(data);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = history.filter(h => filter === 'all' || h.action === filter);

  const actionLabels = {
    assigned: { label: 'Asignada', color: '#059669', bg: '#d1fae5', icon: 'add_circle' },
    removed: { label: 'Retirada', color: '#dc2626', bg: '#fee2e2', icon: 'remove_circle' },
    reassigned: { label: 'Reasignada', color: '#2563eb', bg: '#dbeafe', icon: 'swap_horiz' }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10, border: '1px solid #e2e8f0',
          background: '#fff', cursor: 'pointer'
        }}>
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="material-icons-outlined">history</span>
          Historial de Movimientos
        </h1>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: '#f1f5f9', padding: '4px', borderRadius: 10, width: 'fit-content' }}>
        {[
          { key: 'all', label: 'Todos' },
          { key: 'assigned', label: 'Asignadas' },
          { key: 'removed', label: 'Retiradas' },
          { key: 'reassigned', label: 'Reasignadas' }
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
              background: filter === f.key ? '#10b981' : 'transparent',
              color: filter === f.key ? 'white' : '#64748b',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <div className="spinner" style={{
            width: 40, height: 40, border: '3px solid #e2e8f0',
            borderTopColor: '#10b981', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem'
          }} />
          Cargando historial...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <span className="material-icons-outlined" style={{ fontSize: 48, display: 'block', marginBottom: '0.5rem' }}>inbox</span>
          No hay movimientos registrados
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(movement => {
            const action = actionLabels[movement.action] || actionLabels.assigned;
            return (
              <div key={movement.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem', background: 'white', border: '1px solid #e2e8f0',
                borderRadius: 10
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, background: action.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span className="material-icons-outlined" style={{ fontSize: 18, color: action.color }}>{action.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Orden #{movement.order?.folio || movement.order_id}</span>
                    <span style={{
                      padding: '0.15rem 0.5rem', borderRadius: 20, fontSize: '0.65rem',
                      fontWeight: 600, background: action.bg, color: action.color
                    }}>
                      {action.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Estantería: <strong>{movement.shelf?.label || 'N/A'}</strong>
                    {movement.performed_by && ` · Por: ${movement.performed_by}`}
                  </div>
                </div>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {new Date(movement.created_at).toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShelvingHistory;
