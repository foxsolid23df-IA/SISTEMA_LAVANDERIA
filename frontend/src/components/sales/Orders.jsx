import React, { useState, useEffect } from 'react';
import { orderService } from '../../services/orderService';
import { formatearDinero } from '../../utils';
import './Orders.css';

export const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, received, processing, ready, delivered

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await orderService.getOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      // Actualizar estado localmente para rapidez
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      alert('Error al actualizar estado');
    }
  };

  const statusLabels = {
    received: { label: 'Recibido', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    processing: { label: 'En Lavado/Proceso', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    ready: { label: 'Listo para Entrega', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    delivered: { label: 'Entregado', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200' }
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.status === filter);

  return (
    <div className="orders-container p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gestión de Lavandería</h1>
          <p className="text-slate-500 dark:text-slate-400">Administra el ciclo de vida de las prendas</p>
        </div>
        
        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          {['all', 'received', 'processing', 'ready', 'delivered'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filter === f 
                ? 'bg-emerald-500 text-white shadow-md' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'Todos' : statusLabels[f]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
               <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">inventory_2</span>
               <p className="text-slate-500">No hay órdenes en esta categoría</p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="order-card bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
                  <div>
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full border ${statusLabels[order.status]?.color}`}>
                      {statusLabels[order.status]?.label}
                    </span>
                    <h3 className="text-sm font-bold mt-2 text-slate-800 dark:text-white uppercase">#{order.id.toString().slice(-6)} - {order.customers?.name}</h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Promrometido</p>
                    <p className={`text-xs font-bold ${new Date(order.promised_at) < new Date() && order.status !== 'delivered' ? 'text-red-500' : 'text-slate-600 dark:text-slate-300'}`}>
                      {new Date(order.promised_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="p-4 flex-grow">
                   <div className="space-y-2 mb-4">
                      {order.order_items?.map(item => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-400 italic">{item.product_name}</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{item.quantity} {item.pricing_type === 'kg' ? 'kg' : 'pza'}</span>
                        </div>
                      ))}
                   </div>
                   
                   {order.notes && (
                     <div className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg text-[10px] text-slate-500 italic mb-4">
                        " {order.notes} "
                     </div>
                   )}

                   <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-50 dark:border-slate-700">
                      <span className="text-slate-500">Total: {formatearDinero(order.total)}</span>
                      <span className={`font-bold ${order.payment_status === 'paid' ? 'text-emerald-600' : 'text-orange-500'}`}>
                         {order.payment_status === 'paid' ? 'Pagado' : `Debe ${formatearDinero(order.total - order.paid_amount)}`}
                      </span>
                   </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 flex gap-2">
                  {order.status === 'received' && (
                    <button 
                      onClick={() => handleStatusChange(order.id, 'processing')}
                      className="flex-grow py-2 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                    >
                      Empezar Lavado
                    </button>
                  )}
                  {order.status === 'processing' && (
                    <button 
                      onClick={() => handleStatusChange(order.id, 'ready')}
                      className="flex-grow py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg transition-colors"
                    >
                      Marcar Listo
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button 
                      onClick={() => handleStatusChange(order.id, 'delivered')}
                      className="flex-grow py-2 bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-bold rounded-lg transition-colors"
                    >
                      Registrar Entrega
                    </button>
                  )}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button 
                      onClick={() => handleStatusChange(order.id, 'cancelled')}
                      className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <span className="material-symbols-outlined text-sm">cancel</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
