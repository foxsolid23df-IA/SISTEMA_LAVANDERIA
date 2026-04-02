import React, { useState } from 'react';
import { productService } from '../../services/productService';
import Swal from 'sweetalert2';

export default function ProductEntryTab({ products, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setObservations] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId || !quantity || quantity <= 0) {
      Swal.fire('Faltan Datos', 'Debes seleccionar un producto y una cantidad válida.', 'warning');
      return;
    }

    try {
      setLoading(true);
      await productService.recordEntry({
        product_id: selectedProductId,
        quantity: parseFloat(quantity),
        notes: notes || "Entrada de stock (Catalogo)"
      });
      Swal.fire('Éxito', 'Entrada registrada correctamente.', 'success');
      onSuccess();
    } catch (error) {
      console.error(error);
      Swal.fire('Error', 'No se pudo registrar la entrada.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl shadow-black/5 animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-2xl font-black mb-1 flex items-center gap-2 text-emerald-500 uppercase italic">
        <span className="material-icons-outlined">add_business</span>
        Entrada de Mercancía
      </h2>
      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">
        Registrar ingreso al almacén de punto de venta
      </p>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
        <div className="space-y-2">
          <label className="block text-xs font-black uppercase text-slate-400 tracking-widest">
            Seleccionar Producto
          </label>
          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Selecciona un producto...</option>
            {products?.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Actual: {p.stock} {p.unit_type || 'PZA'})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black uppercase text-slate-400 tracking-widest">
            Cantidad a Ingresar
          </label>
          <input
            type="number"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 font-bold text-2xl text-emerald-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-black uppercase text-slate-400 tracking-widest">
            Notas / Observaciones
          </label>
          <textarea
            value={notes}
            onChange={(e) => setObservations(e.target.value)}
            rows="3"
            placeholder="Ej. Factura #123, Proveedor X..."
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500 resize-none"
          ></textarea>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-4 font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'PROCESANDO...' : 'REGISTRAR ENTRADA'}
          </button>
        </div>
      </form>
    </div>
  );
}
