import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { shelvingService } from "../../services/shelvingService";

export const ShelvingReports = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState({});
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    loadReport();
  }, [days]);

  const loadReport = async () => {
    try {
      setLoading(true);
      const [reportData, statsData] = await Promise.all([
        shelvingService.getUtilizationReport(days),
        shelvingService.getShelvingStats()
      ]);
      setReport(reportData);
      setStats(statsData);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const days_list = Object.keys(report).sort();
  const maxVal = Math.max(1, ...Object.values(report).map(d => d.assigned + d.removed + d.reassigned));

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
          <span className="material-icons-outlined">bar_chart</span>
          Reporte de Utilización
        </h1>
      </div>

      {/* Selector de período */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: '#f1f5f9', padding: '4px', borderRadius: 10, width: 'fit-content' }}>
        {[7, 14, 30].map(d => (
          <button key={d} onClick={() => setDays(d)}
            style={{
              padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
              background: days === d ? '#10b981' : 'transparent',
              color: days === d ? 'white' : '#64748b',
              fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
            }}>
            {d} días
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #e2e8f0',
            borderTopColor: '#10b981', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem'
          }} />
          Cargando reporte...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* Resumen */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { label: 'Total estanterías', value: stats.totalShelves, color: '#64748b' },
                { label: 'Ocupación actual', value: `${stats.occupancyRate}%`, color: '#10b981' },
                { label: 'Activas', value: stats.activeAssignments, color: '#2563eb' },
                { label: 'Vencidas', value: stats.overdueCount, color: '#f59e0b' },
              ].map((s, i) => (
                <div key={i} style={{
                  padding: '1rem', background: 'white', borderRadius: 12,
                  border: '1px solid #e2e8f0', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Gráfico de barras */}
          <div style={{
            background: 'white', borderRadius: 12, padding: '1.5rem',
            border: '1px solid #e2e8f0', marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0', color: '#1e293b' }}>
              Movimientos por día
            </h3>
            {days_list.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No hay datos en este período</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {days_list.map(day => {
                  const d = report[day];
                  const total = d.assigned + d.removed + d.reassigned;
                  const pct = (total / maxVal) * 100;
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', width: 80, textAlign: 'right' }}>
                        {new Date(day + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                      </span>
                      <div style={{ flex: 1, height: 24, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', height: '100%' }}>
                          {d.assigned > 0 && (
                            <div style={{ width: `${(d.assigned / maxVal) * 100}%`, background: '#10b981', height: '100%' }} />
                          )}
                          {d.reassigned > 0 && (
                            <div style={{ width: `${(d.reassigned / maxVal) * 100}%`, background: '#3b82f6', height: '100%' }} />
                          )}
                          {d.removed > 0 && (
                            <div style={{ width: `${(d.removed / maxVal) * 100}%`, background: '#ef4444', height: '100%' }} />
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', width: 30 }}>{total}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', justifyContent: 'center' }}>
              {[
                { color: '#10b981', label: 'Asignadas' },
                { color: '#3b82f6', label: 'Reasignadas' },
                { color: '#ef4444', label: 'Retiradas' }
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ShelvingReports;
