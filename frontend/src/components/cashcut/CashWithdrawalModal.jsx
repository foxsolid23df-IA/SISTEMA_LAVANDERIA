import React, { useState } from 'react';
import { cashWithdrawalService } from '../../services/cashWithdrawalService';
import Swal from 'sweetalert2';

export const CashWithdrawalModal = ({ 
    onClose, 
    onSuccess, 
    cashSessionId, 
    terminalId, 
    staffId, 
    staffName,
    maxAmount 
}) => {
    const [formData, setFormData] = useState({
        amount: '',
        reason: '',
        notes: '',
        currency: 'MXN'
    });
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const amount = parseFloat(formData.amount);
        if (!amount || amount <= 0) {
            Swal.fire('Error', 'Ingresa un monto válido', 'error');
            return;
        }

        if (!formData.reason.trim()) {
            Swal.fire('Error', 'Debes especificar el motivo del retiro', 'error');
            return;
        }

        if (maxAmount && amount > maxAmount) {
            const confirm = await Swal.fire({
                title: '⚠️ Atención',
                html: `El monto <strong>$${amount.toFixed(2)}</strong> excede el efectivo esperado en caja (<strong>$${maxAmount.toFixed(2)}</strong>).<br><br>¿Deseas continuar de todas formas?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, registrar',
                cancelButtonText: 'Cancelar'
            });
            if (!confirm.isConfirmed) return;
        }

        setSubmitting(true);
        try {
            await cashWithdrawalService.createWithdrawal({
                amount,
                currency: formData.currency,
                reason: formData.reason.trim(),
                notes: formData.notes.trim() || null,
                staff_id: staffId,
                staff_name: staffName,
                cash_session_id: cashSessionId,
                terminal_id: terminalId
            });

            Swal.fire({
                title: '✅ Retiro Registrado',
                text: `Se registró un retiro de $${amount.toFixed(2)} ${formData.currency}`,
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Error al registrar retiro:', error);
            Swal.fire('Error', error.message || 'No se pudo registrar el retiro', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const commonReasons = [
        'Pago a proveedor',
        'Compra de insumos',
        'Pago de servicios',
        'Gastos operativos',
        'Retiro de propietario',
        'Otro'
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-100 dark:bg-rose-900/30 p-2.5 rounded-xl">
                            <span className="material-symbols-rounded text-rose-600 dark:text-rose-400 text-2xl">money_off</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Retiro de Caja</h2>
                            <p className="text-xs text-slate-400">Registrar salida de efectivo</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Monto *
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">$</span>
                            <input
                                type="number"
                                name="amount"
                                value={formData.amount}
                                onChange={handleChange}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                className="w-full pl-10 pr-20 py-4 text-2xl font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-rose-500 focus:ring-0 transition-colors"
                                autoFocus
                            />
                            <select
                                name="currency"
                                value={formData.currency}
                                onChange={handleChange}
                                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-200 dark:bg-slate-700 border-0 rounded-lg px-3 py-2 font-bold text-sm text-slate-900 dark:text-white focus:ring-0"
                            >
                                <option value="MXN">MXN</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Motivo *
                        </label>
                        <select
                            name="reason"
                            value={formData.reason}
                            onChange={handleChange}
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-rose-500 focus:ring-0 transition-colors font-medium text-slate-900 dark:text-white"
                        >
                            <option value="">Selecciona un motivo...</option>
                            {commonReasons.map(reason => (
                                <option key={reason} value={reason}>{reason}</option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                            Notas (Opcional)
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            placeholder="Detalles adicionales, nombre del proveedor, etc..."
                            rows="2"
                            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-rose-500 focus:ring-0 transition-colors resize-none text-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-[1.5] py-4 px-6 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></span>
                                    Registrando...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-rounded">check</span>
                                    Registrar Retiro
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CashWithdrawalModal;
