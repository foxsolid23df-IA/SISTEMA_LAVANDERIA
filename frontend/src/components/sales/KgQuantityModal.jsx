import React, { useState, useEffect, useRef } from "react";
import { formatearDinero } from "../../utils";

/**
 * Modal para capturar la cantidad en KG cuando se selecciona un servicio de tipo "kg".
 * Reemplaza la integración con la báscula física.
 */
const KgQuantityModal = ({ product, onAccept, onCancel }) => {
  const [quantity, setQuantity] = useState(1.0);
  const inputRef = useRef(null);

  const importe = quantity * (product?.price || 0);

  useEffect(() => {
    // Focus y seleccionar el input al abrir
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleAccept();
    if (e.key === "Escape") onCancel();
  };

  if (!product) return null;

  // Derive display name: use category or product name
  const displayName = product.category
    ? `${product.category.toUpperCase()} KG`
    : `${product.name.toUpperCase()}`;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-md animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header - Amarillo/Dorado como en la imagen de referencia */}
        <div className="bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-amber-950 flex items-center gap-2">
            <span className="material-symbols-outlined">help</span>
            ¿Cantidad del Producto?
          </h3>
          <button
            onClick={onCancel}
            className="text-amber-800 hover:text-amber-950 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-8">
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

          {/* Sección de Entradas */}
          <div className="space-y-6">
            {/* Cantidad del Producto */}
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

            {/* Importe Actual - Como un visor */}
            <div className="pt-4 border-t border-slate-100">
              <label className="block text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                Importe Total Calculado
              </label>
              <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border-4 border-slate-800 relative overflow-hidden">
                {/* Efecto de brillo de pantalla */}
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

        {/* Footer - Botones */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={handleAccept}
            disabled={quantity <= 0}
            className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-lg">
              check_circle
            </span>
            Aceptar
          </button>
          <button
            onClick={onCancel}
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
