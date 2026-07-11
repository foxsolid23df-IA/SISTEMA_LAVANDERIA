import React, { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { productionSheetService } from '../../services/productionSheetService';
import { staffService } from '../../services/staffService';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../contexts/SettingsContext';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import './ProduccionDiaria.css';

const LAVANDERIA_STAFF_ROLES = ['admin', 'gerente', 'cajero', 'operador'];
const ESPECIALISTA_LABELS = {
  gorras: 'Gorras',
  tennis: 'Tennis',
  mochila_bolsa: 'Mochila/Bolsa',
  planchado: 'Planchado (pzas)',
};

const EMPTY_ENTRY = (staffId, date) => ({
  tempId: Date.now() + Math.random(),
  staff_id: staffId,
  entry_date: date,
  nota: '',
  kg_lavado: '',
  tintoreria: '',
  cobertores: '',
  prenda_extra: '',
  gorras: '',
  tennis: '',
  mochila_bolsa: '',
  planchado: '',
  isNew: true,
});

export const ProduccionDiaria = () => {
  const { isAdmin } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffList, setStaffList] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!settingsLoading && !settings?.daily_production_enabled) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (date) {
      loadEntries();
    }
  }, [date]);

  const loadStaff = async () => {
    try {
      const all = await staffService.getStaff();
      const lavanderia = all.filter((s) =>
        LAVANDERIA_STAFF_ROLES.includes(s.role) && s.active
      );
      setStaffList(lavanderia);
    } catch (err) {
      console.error('Error cargando staff:', err);
    }
  };

  const loadEntries = async () => {
    try {
      setLoading(true);
      const data = await productionSheetService.getEntries(date);
      setEntries(data || []);
    } catch (err) {
      console.error('Error cargando entradas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromOrders = async () => {
    if (!date) return;
    try {
      setLoading(true);
      const orders = await productionSheetService.autoLoadFromOrders(date);
      if (!orders.length) {
        Swal.fire('Sin datos', 'No se encontraron ordenes con staff asignado para esta fecha.', 'info');
        setLoading(false);
        return;
      }
      const merged = [...entries, ...orders.filter((o) => {
        return !entries.some((e) =>
          String(e.staff_id) === String(o.staff_id) && String(e.nota) === String(o.nota)
        );
      })];
      setEntries(merged);
      Swal.fire('Cargado', `${orders.length} entradas cargadas desde ordenes del POS.`, 'success');
    } catch (err) {
      console.error('Error auto-cargando:', err);
      Swal.fire('Error', 'No se pudieron cargar las ordenes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const toSave = entries.map((e) => ({
        ...e,
        entry_date: date,
        tempId: undefined,
        isNew: undefined,
      }));
      await productionSheetService.saveEntries(toSave);
      await loadEntries();
      Swal.fire('Guardado', 'Planilla guardada correctamente.', 'success');
    } catch (err) {
      console.error('Error guardando:', err);
      Swal.fire('Error', 'No se pudo guardar la planilla.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddEntry = (staffId) => {
    setEntries((prev) => [...prev, EMPTY_ENTRY(staffId, date)]);
  };

  const handleUpdateEntry = useCallback((index, field, value) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleDeleteEntry = async (index) => {
    const entry = entries[index];
    if (!entry.isNew && entry.id) {
      try {
        await productionSheetService.deleteEntry(entry.id);
      } catch (err) {
        console.error('Error eliminando:', err);
      }
    }
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const getStaffEntries = (staffId) => {
    return entries
      .map((e, idx) => ({ ...e, _idx: idx }))
      .filter((e) => String(e.staff_id) === String(staffId));
  };

  const getEspecialistaEntries = () => {
    return entries.filter((e) => !e.staff_id);
  };

  const calcStaffTotals = (staffId) => {
    const staffEntries = getStaffEntries(staffId);
    return staffEntries.reduce(
      (acc, e) => ({
        kg: acc.kg + (parseFloat(e.kg_lavado) || 0),
        tint: acc.tint + (parseInt(e.tintoreria) || 0),
        cob: acc.cob + (parseInt(e.cobertores) || 0),
        extra: acc.extra + (parseInt(e.prenda_extra) || 0),
        ingreso: acc.ingreso + productionSheetService.calcularIngreso(e),
      }),
      { kg: 0, tint: 0, cob: 0, extra: 0, ingreso: 0 }
    );
  };

  const calcEspecialistaTotals = () => {
    const esp = getEspecialistaEntries();
    return esp.reduce(
      (acc, e) => ({
        gorras: acc.gorras + (parseInt(e.gorras) || 0),
        tennis: acc.tennis + (parseInt(e.tennis) || 0),
        mochila: acc.mochila + (parseInt(e.mochila_bolsa) || 0),
        planchado: acc.planchado + (parseInt(e.planchado) || 0),
        ingreso: acc.ingreso + productionSheetService.calcularIngreso(e),
      }),
      { gorras: 0, tennis: 0, mochila: 0, planchado: 0, ingreso: 0 }
    );
  };

  const calcGrandTotal = () => {
    let total = 0;
    staffList.forEach((s) => {
      total += calcStaffTotals(s.id).ingreso;
    });
    total += calcEspecialistaTotals().ingreso;
    return total;
  };

  const calcByService = () => {
    let kgTotal = 0;
    let tintTotal = 0;
    let cobTotal = 0;
    staffList.forEach((s) => {
      const t = calcStaffTotals(s.id);
      kgTotal += t.kg;
      tintTotal += t.tint;
      cobTotal += t.cob;
    });
    const esp = calcEspecialistaTotals();
    const planchadoIngreso = (esp.planchado || 0) * productionSheetService.PRECIOS.planchado;
    return { kgTotal, tintTotal, cobTotal, esp, planchadoIngreso };
  };

  const handleExport = () => {
    const rows = [];
    staffList.forEach((s) => {
      const staffEntries = getStaffEntries(s.id);
      if (!staffEntries.length) return;
      rows.push({ Empleado: s.name, Nota: '', 'KG Lavado': '', Tintoreria: '', Cobertores: '', 'Prenda Extra': '' });
      staffEntries.forEach((e) => {
        rows.push({
          Empleado: '',
          Nota: e.nota || '-',
          'KG Lavado': e.kg_lavado || 0,
          Tintoreria: e.tintoreria || 0,
          Cobertores: e.cobertores || 0,
          'Prenda Extra': e.prenda_extra || 0,
        });
      });
      const totals = calcStaffTotals(s.id);
      rows.push({
        Empleado: 'TOTAL',
        Nota: '',
        'KG Lavado': totals.kg,
        Tintoreria: totals.tint,
        Cobertores: totals.cob,
        'Prenda Extra': totals.extra,
      });
      rows.push({
        Empleado: 'INGRESO',
        Nota: '',
        'KG Lavado': productionSheetService.formatMoney(totals.ingreso),
        Tintoreria: '',
        Cobertores: '',
        'Prenda Extra': '',
      });
      rows.push({});
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produccion Diaria');
    XLSX.writeFile(wb, `Produccion_Diaria_${date}.xlsx`);
  };

  const fmt = productionSheetService.formatMoney;

  return (
    <div className="pd-container">
      <div className="pd-header">
        <div className="pd-title-row">
          <h1>Produccion Diaria (Planilla)</h1>
          <p>Registro diario de produccion por empleado</p>
        </div>
        <div className="pd-toolbar">
          <div className="pd-date-group">
            <label>Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pd-date-input"
            />
          </div>
          <button className="pd-btn pd-btn-outline" onClick={handleLoadFromOrders} disabled={loading}>
            <span className="material-icons-outlined icon-18">sync</span>
            Cargar desde Ordenes
          </button>
          <button className="pd-btn pd-btn-primary" onClick={handleSave} disabled={saving || loading}>
            <span className="material-icons-outlined icon-18">save</span>
            {saving ? 'Guardando...' : 'Guardar Planilla'}
          </button>
          <button className="pd-btn pd-btn-export" onClick={handleExport}>
            <span className="material-icons-outlined icon-18">download</span>
            Exportar Excel
          </button>
        </div>
      </div>

      {loading && staffList.length === 0 ? (
        <div className="pd-loading">Cargando datos...</div>
      ) : (
        <>
          {/* Staff columns */}
          <div className="pd-staff-grid">
            {staffList.map((staff) => {
              const staffEntries = getStaffEntries(staff.id);
              const totals = calcStaffTotals(staff.id);
              return (
                <div key={staff.id} className="pd-staff-card">
                  <div className="pd-staff-header">
                    <h3>{staff.name}</h3>
                    <span className="pd-staff-role">{staff.role}</span>
                  </div>
                  <div className="pd-table-wrapper">
                    <table className="pd-table">
                      <thead>
                        <tr>
                          <th className="pd-th-nota">Nota</th>
                          <th className="pd-th-kg">KG Lavado</th>
                          <th className="pd-th-tint">Tintoreria</th>
                          <th className="pd-th-cob">Cobertores</th>
                          <th className="pd-th-extra">Extra</th>
                          <th className="pd-th-act"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffEntries.map((e) => (
                          <tr key={e._idx} className={e.isNew ? 'pd-row-new' : ''}>
                            <td>
                              <input
                                type="text"
                                className="pd-input pd-input-nota"
                                value={e.nota || ''}
                                onChange={(ev) => handleUpdateEntry(e._idx, 'nota', ev.target.value)}
                                placeholder="#"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="pd-input pd-input-num"
                                value={e.kg_lavado || ''}
                                onChange={(ev) => handleUpdateEntry(e._idx, 'kg_lavado', ev.target.value)}
                                placeholder="0"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="pd-input pd-input-num"
                                value={e.tintoreria || ''}
                                onChange={(ev) => handleUpdateEntry(e._idx, 'tintoreria', ev.target.value)}
                                placeholder="0"
                                min="0"
                                step="1"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="pd-input pd-input-num"
                                value={e.cobertores || ''}
                                onChange={(ev) => handleUpdateEntry(e._idx, 'cobertores', ev.target.value)}
                                placeholder="0"
                                min="0"
                                step="1"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="pd-input pd-input-num"
                                value={e.prenda_extra || ''}
                                onChange={(ev) => handleUpdateEntry(e._idx, 'prenda_extra', ev.target.value)}
                                placeholder="0"
                                min="0"
                                step="1"
                              />
                            </td>
                            <td>
                              <button
                                className="pd-btn-del"
                                onClick={() => handleDeleteEntry(e._idx)}
                                title="Eliminar fila"
                              >
                                <span className="material-icons-outlined icon-16">delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="pd-staff-totals">
                    <div className="pd-totals-row">
                      <div className="pd-total-item">
                        <span className="pd-total-label">KG Total</span>
                        <span className="pd-total-value">{totals.kg.toFixed(2)} kg</span>
                      </div>
                      <div className="pd-total-item">
                        <span className="pd-total-label">Tintoreria</span>
                        <span className="pd-total-value">{totals.tint} pzas</span>
                      </div>
                      <div className="pd-total-item">
                        <span className="pd-total-label">Cobertores</span>
                        <span className="pd-total-value">{totals.cob} pzas</span>
                      </div>
                      <div className="pd-total-item">
                        <span className="pd-total-label">Extra</span>
                        <span className="pd-total-value">{totals.extra} pzas</span>
                      </div>
                      <div className="pd-total-item pd-total-ingreso">
                        <span className="pd-total-label">Ingreso</span>
                        <span className="pd-total-value">{fmt(totals.ingreso)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="pd-btn-add-row"
                    onClick={() => handleAddEntry(staff.id)}
                  >
                    + Agregar fila
                  </button>
                </div>
              );
            })}
          </div>

          {/* Especialistas: JOEL / VICKY */}
          <div className="pd-especialistas-card">
            <h3>Especialistas y Servicios Extra</h3>
            <div className="pd-esp-grid">
              {/* JOEL: gorras, tennis, mochila */}
              <div className="pd-esp-section">
                <h4>Especialistas (Gorras / Tennis / Mochila / Planchado)</h4>
                <table className="pd-table pd-table-esp">
                  <thead>
                    <tr>
                      <th>Gorras</th>
                      <th>Tennis</th>
                      <th>Mochila/Bolsa</th>
                      <th>Planchado</th>
                      <th>Ingreso</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const espEntries = getEspecialistaEntries();
                      if (!espEntries.length) {
                        return (
                          <tr>
                            <td colSpan="6" className="pd-empty-cell">Sin entradas de especialistas</td>
                          </tr>
                        );
                      }
                      return espEntries.map((e) => (
                        <tr key={e._idx}>
                          <td>
                            <input
                              type="number"
                              className="pd-input pd-input-num"
                              value={e.gorras || ''}
                              onChange={(ev) => handleUpdateEntry(e._idx, 'gorras', ev.target.value)}
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="pd-input pd-input-num"
                              value={e.tennis || ''}
                              onChange={(ev) => handleUpdateEntry(e._idx, 'tennis', ev.target.value)}
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="pd-input pd-input-num"
                              value={e.mochila_bolsa || ''}
                              onChange={(ev) => handleUpdateEntry(e._idx, 'mochila_bolsa', ev.target.value)}
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="pd-input pd-input-num"
                              value={e.planchado || ''}
                              onChange={(ev) => handleUpdateEntry(e._idx, 'planchado', ev.target.value)}
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td className="pd-esp-ingreso">
                            {fmt(productionSheetService.calcularIngreso(e))}
                          </td>
                          <td>
                            <button
                              className="pd-btn-del"
                              onClick={() => handleDeleteEntry(e._idx)}
                              title="Eliminar"
                            >
                              <span className="material-icons-outlined icon-16">delete</span>
                            </button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
                <button
                  className="pd-btn-add-row"
                  onClick={() => handleAddEntry(null)}
                >
                  + Agregar especialista
                </button>
              </div>

              {/* VICKY: planchado */}
              <div className="pd-esp-section">
                <h4>Planchado (pzas)</h4>
                {(() => {
                  const esp = calcEspecialistaTotals();
                  return (
                    <div className="pd-planchado-summary">
                      <div className="pd-planchado-row">
                        <span className="pd-planchado-label">Total piezas planchadas</span>
                        <span className="pd-planchado-value-big">{esp.planchado}</span>
                      </div>
                      <div className="pd-planchado-row">
                        <span className="pd-planchado-label">Ingreso por planchado</span>
                        <span className="pd-planchado-value-big">{fmt(esp.planchado * productionSheetService.PRECIOS.planchado)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Grand Totals */}
          <div className="pd-grand-card">
            <h3>Totale Neto del Dia</h3>
            <div className="pd-grand-grid">
              {(() => {
                const s = calcByService();
                return (
                  <>
                    <div className="pd-grand-item">
                      <span className="pd-grand-label">Lavanderia (kg)</span>
                      <span className="pd-grand-value">{s.kgTotal.toFixed(2)} kg / {fmt(s.kgTotal * productionSheetService.PRECIOS.kg_lavado)}</span>
                    </div>
                    <div className="pd-grand-item">
                      <span className="pd-grand-label">Tintoreria (pzas)</span>
                      <span className="pd-grand-value">{s.tintTotal} pzas / {fmt(s.tintTotal * productionSheetService.PRECIOS.tintoreria)}</span>
                    </div>
                    <div className="pd-grand-item">
                      <span className="pd-grand-label">Cobertores</span>
                      <span className="pd-grand-value">{s.cobTotal} pzas / {fmt(s.cobTotal * productionSheetService.PRECIOS.cobertores)}</span>
                    </div>
                    <div className="pd-grand-item">
                      <span className="pd-grand-label">Gorras</span>
                      <span className="pd-grand-value">{s.esp.gorras} pzas / {fmt(s.esp.gorras * productionSheetService.PRECIOS.gorras)}</span>
                    </div>
                    <div className="pd-grand-item">
                      <span className="pd-grand-label">Tennis</span>
                      <span className="pd-grand-value">{s.esp.tennis} pzas / {fmt(s.esp.tennis * productionSheetService.PRECIOS.tennis)}</span>
                    </div>
                    <div className="pd-grand-item">
                      <span className="pd-grand-label">Mochila/Bolsa</span>
                      <span className="pd-grand-value">{s.esp.mochila} pzas / {fmt(s.esp.mochila * productionSheetService.PRECIOS.mochila_bolsa)}</span>
                    </div>
                    <div className="pd-grand-item">
                      <span className="pd-grand-label">Planchado</span>
                      <span className="pd-grand-value">{s.esp.planchado} pzas / {fmt(s.esp.planchado * productionSheetService.PRECIOS.planchado)}</span>
                    </div>
                    <div className="pd-grand-item pd-grand-total">
                      <span className="pd-grand-label">TOTAL NETO</span>
                      <span className="pd-grand-value-big">{fmt(calcGrandTotal())}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProduccionDiaria;
