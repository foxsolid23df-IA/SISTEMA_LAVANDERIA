import React, { useState, useEffect, useRef } from "react";
import { formatearDinero } from "../../utils";
import { useScale } from "../../hooks/useScale";

/**
 * Modal para capturar la cantidad en KG cuando se selecciona un servicio de tipo "kg".
 * Soporta entrada manual Y lectura directa desde báscula serial (Rhino BAR-10, Torrey, etc.).
 */
const KgQuantityModal = ({ product, onAccept, onCancel }) => {
  const [quantity, setQuantity] = useState(1.0);
  const inputRef = useRef(null);

  // Hook de báscula — conexión, lectura en tiempo real, simulación
  const {
    weight,
    isConnected: scaleConnected,
    error: scaleError,
    isReading,
    connect: connectScale,
    connectSimulation,
    disconnect: disconnectScale,
  } = useScale();

  const importe = quantity * (product?.price || 0);

  // Focus al input al abrir
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Cuando la báscula envía un peso > 0, actualizar el campo automáticamente
  useEffect(() => {
    if (scaleConnected && weight > 0) {
      setQuantity(parseFloat(weight.toFixed(3)));
    }
  }, [weight, scaleConnected]);

  const handleQuantityChange = (value) => {
    const parsed = parseFloat(value);
    if (isNaN(parsed) || parsed < 0) return;
    setQuantity(parsed);
  };

  const increment = () =>
    setQuantity((prev) => Math.round((prev + 0.5) * 100) / 100);
  const decrement = () =>
    setQuantity((prev) => Math.max(0.5, Math.round((prev - 0.5) * 100) / 100));

  const handleAccept = () => {
    if (quantity <= 0) return;
    onAccept(quantity);
  };

  // Al cancelar o aceptar, desconectar la báscula para liberar el puerto
  const handleCancel = async () => {
    if (scaleConnected) {
      try { await disconnectScale(); } catch (e) { /* silenciar */ }
    }
    onCancel();
  };

  const handleAcceptAndCleanup = async () => {
    if (quantity <= 0) return;
    if (scaleConnected) {
      try { await disconnectScale(); } catch (e) { /* silenciar */ }
    }
    onAccept(quantity);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleAcceptAndCleanup();
    if (e.key === "Escape") handleCancel();
  };

  if (!product) return null;

  const displayName = product.category
    ? `${product.category.toUpperCase()} KG`
    : `${product.name.toUpperCase()}`;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-md animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
            <span className="material-symbols-outlined">help</span>
            ¿Cantidad del Producto?
          </h3>
          <button
            onClick={handleCancel}
            className="text-amber-800 hover:text-amber-950 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Nombre del servicio */}
          <div className="text-center px-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-tight">
              {displayName}
            </h2>
            <div className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded-full">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Precio: {formatearDinero(product.price)} / kg
              </p>
            </div>
          </div>

          {/* ── Sección de Báscula ── */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <label className="block text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
              <span className="material-symbols-outlined text-xs align-middle mr-1">usb</span>
              Báscula Serial
            </label>

            {/* Estado + Botones de control */}
            <div className="flex items-center justify-center gap-2">
              {!scaleConnected ? (
                <>
                  <button
                    type="button"
                    onClick={connectScale}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                  >
                    <span className="material-symbols-outlined text-sm">cable</span>
                    Conectar
                  </button>
                  <button
                    type="button"
                    onClick={connectSimulation}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1.5"
                    title="Modo Simulación (sin báscula física)"
                  >
                    <span className="material-symbols-outlined text-sm">science</span>
                    Simular
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Indicador de estado */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
                    <span className={`w-2 h-2 rounded-full ${isReading ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`}></span>
                    <span className="text-xs font-bold text-emerald-700">
                      {isReading ? 'Leyendo...' : 'Conectada'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={disconnectScale}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-all active:scale-95 flex items-center gap-1 border border-red-200"
                  >
                    <span className="material-symbols-outlined text-sm">power_off</span>
                    Desconectar
                  </button>
                </div>
              )}
            </div>

            {/* Lectura en vivo de la báscula */}
            {scaleConnected && (
              <div className="bg-slate-900 rounded-xl p-3 mt-2 border-2 border-slate-700 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/10"></div>
                <div className="flex items-center justify-between">
                  <span className="text-cyan-500/60 material-symbols-outlined text-lg">
                    monitor_weight
                  </span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-cyan-400 font-mono tracking-tighter">
                      {weight.toFixed(3)}
                    </span>
                    <span className="text-cyan-500/60 text-xs font-bold ml-1">kg</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error de báscula */}
            {scaleError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                <p className="text-xs text-red-600 font-medium flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-sm mt-0.5 shrink-0">error</span>
                  {scaleError}
                </p>
              </div>
            )}
          </div>

          {/* ── Sección de Entradas ── */}
          <div className="space-y-6">
            {/* Cantidad Manual */}
            <div className="space-y-3">
              <label className="block text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Cantidad del Producto (KG)
              </label>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={decrement}
                  className="w-14 h-14 bg-slate-100 hover:bg-slate-200 rounded-2xl flex items-center justify-center text-slate-600 font-bold text-2xl transition-all active:scale-90 border-b-4 border-slate-300 active:border-b-0"
                >
                  −
                </button>
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="number"
                    step="0.5"
                    min="0.5"
                    className="w-40 h-20 text-center text-4xl font-black text-blue-700 bg-blue-50 border-2 border-blue-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-inner"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    onFocus={(e) => e.target.select()}
                  />
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                    Kilogramos
                  </span>
                </div>
                <button
                  type="button"
                  onClick={increment}
                  className="w-14 h-14 bg-slate-100 hover:bg-slate-200 rounded-2xl flex items-center justify-center text-slate-600 font-bold text-2xl transition-all active:scale-90 border-b-4 border-slate-300 active:border-b-0"
                >
                  +
                </button>
              </div>
            </div>

            {/* Importe Total */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                Importe Total Calculado
              </label>
              <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border-4 border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/10"></div>
                <div className="flex items-center justify-between">
                  <span className="text-emerald-500/50 material-symbols-outlined text-2xl">
                    payments
                  </span>
                  <span className="text-4xl font-black text-emerald-400 font-mono tracking-tighter">
                    {formatearDinero(importe)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleAcceptAndCleanup}
            disabled={quantity <= 0}
            className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-lg">
              check_circle
            </span>
            Aceptar
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm border border-slate-200"
          >
            <span className="material-symbols-outlined text-lg">cancel</span>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};

export default KgQuantityModal;
