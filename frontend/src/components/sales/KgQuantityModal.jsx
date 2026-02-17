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
        <div className="p-6 space-y-6">
          {/* Nombre del servicio */}
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800 tracking-wide">
              {displayName}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Precio unitario: {formatearDinero(product.price)} / kg
            </p>
          </div>

          {/* Campos */}
          <div className="grid grid-cols-2 gap-6">
            {/* Cantidad del Producto */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Cantidad del Producto:
              </label>
              <div className="flex items-center gap-1">
                <button
                  onClick={decrement}
                  className="w-10 h-12 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-bold text-lg transition-all active:scale-95"
                >
                  −
                </button>
                <input
                  ref={inputRef}
                  type="number"
                  step="0.5"
                  min="0.5"
                  className="flex-1 h-12 text-center text-xl font-black text-blue-700 bg-blue-50 border-2 border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={increment}
                  className="w-10 h-12 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-600 font-bold text-lg transition-all active:scale-95"
                >
                  +
                </button>
              </div>
            </div>

            {/* Importe Actual */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Importe Actual:
              </label>
              <div className="h-12 flex items-center justify-center bg-slate-50 border-2 border-slate-200 rounded-lg">
                <span className="text-xl font-black text-slate-800">
                  {formatearDinero(importe)}
                </span>
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
