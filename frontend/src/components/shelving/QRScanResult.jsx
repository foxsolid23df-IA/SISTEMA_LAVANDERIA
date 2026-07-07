import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { shelvingService } from "../../services/shelvingService";
import { formatearDinero } from "../../utils";
import Swal from "sweetalert2";

export const QRScanResult = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removed, setRemoved] = useState(false);

  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (orderId) {
      loadResult();
    } else {
      setError("No se proporcionó un ID de orden válido");
      setLoading(false);
    }
  }, [orderId]);

  const loadResult = async () => {
    try {
      setLoading(true);
      const data = await shelvingService.scanShelf(orderId);
      if (data) {
        setResult(data);
        setRemoved(false);
      } else {
        setError("No se encontró asignación para esta orden");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Retirar ropa?",
      text: "Se marcará como retirada",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef4444"
    });
    if (!isConfirmed) return;
    try {
      await shelvingService.unassignOrder(orderId);
      Swal.fire({
        title: "Retirada",
        text: "La ropa fue retirada correctamente",
        icon: "success",
        timer: 2000,
        showConfirmButton: false
      });
      setRemoved(true);
      setResult(null);
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleScanAnother = () => {
    setResult(null);
    setRemoved(false);
    setError(null);
    setSearchParams({});
    navigate('/escanear-estanteria', { replace: true });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: '1rem'
      }}>
        <div className="spinner" style={{
          width: 40, height: 40, border: '3px solid #e2e8f0',
          borderTopColor: '#10b981', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ color: '#64748b' }}>Buscando información...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Pantalla de éxito post-retiro
  if (removed) {
    return (
      <div style={{
        maxWidth: 400, margin: '0 auto', padding: '2rem',
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '1.5rem'
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: '#d1fae5', display: 'flex', alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span className="material-icons-outlined" style={{ fontSize: 40, color: '#059669' }}>check_circle</span>
        </div>
        <h2 style={{ color: '#1e293b', margin: 0, textAlign: 'center' }}>Ropa retirada</h2>
        <p style={{ color: '#64748b', textAlign: 'center' }}>La estantería quedó disponible para nueva ropa</p>
        <button onClick={handleScanAnother} style={{
          padding: '0.875rem 2rem', borderRadius: 12, border: 'none',
          background: '#10b981', color: 'white', fontWeight: 700,
          cursor: 'pointer', fontSize: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <span className="material-icons-outlined">qr_code_scanner</span>
          Escanear otra orden
        </button>
        <button onClick={() => navigate('/estanterias')} style={{
          padding: '0.75rem 1.5rem', borderRadius: 12,
          border: '1px solid #e2e8f0', background: 'white',
          color: '#64748b', fontWeight: 600, cursor: 'pointer'
        }}>
          Ver estanterías
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '100vh', gap: '1rem', padding: '2rem'
      }}>
        <span className="material-icons-outlined" style={{ fontSize: 64, color: '#f59e0b' }}>error_outline</span>
        <h2 style={{ color: '#1e293b', margin: 0 }}>No encontrada</h2>
        <p style={{ color: '#64748b', textAlign: 'center' }}>{error}</p>
        <button onClick={handleScanAnother} style={{
          padding: '0.75rem 1.5rem', borderRadius: 10, border: 'none',
          background: '#10b981', color: 'white', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '0.5rem'
        }}>
          <span className="material-icons-outlined">qr_code_scanner</span>
          Reintentar
        </button>
        <button onClick={() => navigate('/estanterias')} style={{
          padding: '0.75rem 1.5rem', borderRadius: 10, border: '1px solid #e2e8f0',
          background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer'
        }}>
          Ver estanterías
        </button>
      </div>
    );
  }

  if (!result) return null;

  const order = result.order;
  const shelf = result.shelf;

  return (
    <div style={{
      maxWidth: 400, margin: '0 auto', padding: '1.5rem',
      minHeight: '100vh', background: '#f8fafc'
    }}>
      {/* Ubicación destacada */}
      <div style={{
        textAlign: 'center', marginBottom: '1.5rem',
        background: 'white', borderRadius: 16, padding: '2rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <span style={{ fontSize: '0.85rem', color: '#64748b', display: 'block', marginBottom: '0.5rem' }}>
          Ubicación de la ropa
        </span>
        <div style={{ display: 'inline-block', padding: '1rem 2rem', background: '#d1fae5', borderRadius: 12 }}>
          <span style={{ fontSize: '3rem', fontWeight: 800, color: '#065f46' }}>
            {shelf?.label || 'N/A'}
          </span>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
          Fila {shelf?.row_label} · Columna {shelf?.column_number}
        </div>
      </div>

      {/* Datos de la orden */}
      <div style={{
        background: 'white', borderRadius: 12, padding: '1.25rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1rem'
      }}>
        {[
          ['Orden', `#${order?.folio || order?.id}`],
          ['Cliente', order?.customer?.name || 'N/A'],
          ['Teléfono', order?.customer?.phone || 'N/A'],
          ['Total', formatearDinero(order?.total)],
          ['Entrega', order?.promised_at ? new Date(order.promised_at).toLocaleDateString() : 'N/A'],
        ].map(([label, value], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none' }}>
            <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{label}</span>
            <span style={{ fontWeight: label === 'Total' ? 700 : 600, color: label === 'Total' ? '#10b981' : undefined }}>
              {value}
            </span>
          </div>
        ))}
        {order?.order_items && order.order_items.length > 0 && (
          <div style={{ paddingTop: '0.6rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Servicios:</span>
            {order.order_items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.25rem 0' }}>
                <span>{item.product_name}</span>
                <span>{item.quantity} × {formatearDinero(item.price)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <button onClick={handleRemove} style={{
          padding: '1rem', borderRadius: 12, border: 'none',
          background: '#fee2e2', color: '#991b1b', fontWeight: 700,
          cursor: 'pointer', fontSize: '1rem'
        }}>
          Retirar de estantería
        </button>
        <button onClick={handleScanAnother} style={{
          padding: '0.875rem', borderRadius: 12, border: '2px solid #e2e8f0',
          background: 'white', color: '#10b981', fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
        }}>
          <span className="material-icons-outlined">qr_code_scanner</span>
          Escanear otra orden
        </button>
        <button onClick={() => navigate('/estanterias')} style={{
          padding: '0.75rem', borderRadius: 12, border: '1px solid #e2e8f0',
          background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer'
        }}>
          Ver todas las estanterías
        </button>
      </div>
    </div>
  );
};

export default QRScanResult;
