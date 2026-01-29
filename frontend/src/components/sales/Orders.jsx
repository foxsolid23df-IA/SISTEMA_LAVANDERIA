import React, { useState, useEffect, useRef } from 'react';
import { orderService } from '../../services/orderService';
import { staffService } from '../../services/staffService';
import { exchangeRateService } from '../../services/exchangeRateService';
import { businessSettingsService } from '../../services/businessSettingsService';
import TicketVenta from './TicketVenta';
import { formatearDinero } from '../../utils';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import './Orders.css';

export const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, received, processing, ready, delivered
  
  // Nuevos estados para filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);

  // Estados para liquidación de pago
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderToLiquidate, setOrderToLiquidate] = useState(null);
  const [metodoPago, setMetodoPago] = useState("cash");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [montoRecibidoUSD, setMontoRecibidoUSD] = useState("");
  const [usarUSD, setUsarUSD] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados para reimpresión
  const [businessSettings, setBusinessSettings] = useState(null);
  const [orderToPrint, setOrderToPrint] = useState(null);
  const ticketRef = useRef(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const resp = await Promise.all([
        orderService.getOrders(),
        exchangeRateService.getActiveRate(),
        businessSettingsService.getSettings()
      ]);
      setOrders(resp[0]);
      if (resp[1] && resp[1].is_active) {
        setExchangeRate(resp[1]);
      }
      setBusinessSettings(resp[2]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (order, newStatus) => {
    const orderId = order.id;
    const balance = order.total - (order.paid_amount || 0);
    const isPaid = order.payment_status === 'paid' || balance <= 0;

    if (newStatus === 'cancelled') {
      const firstConfirm = await Swal.fire({
        title: '¿Iniciar Cancelación?',
        text: "Se iniciará el proceso de cancelación de la orden. ¿Deseas continuar?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Volver'
      });

      if (!firstConfirm.isConfirmed) return;

      const secondConfirm = await Swal.fire({
        title: 'Confirmación de Seguridad',
        text: '¿Estás seguro que quieren cancelar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: 'SI',
        cancelButtonText: 'NO'
      });

      if (!secondConfirm.isConfirmed) return;
    }

    if (newStatus === 'ready' || newStatus === 'delivered') {
      const actionText = newStatus === 'ready' ? 'marcada como LISTA' : 'registrada como ENTREGADA';
      
      if (isPaid) {
        Swal.fire({
          title: 'Orden Pagada',
          text: `La orden #${orderId.toString().slice(-6)} ha sido ${actionText}. El pago está completo.`,
          icon: 'success',
          timer: 3000,
          toast: true,
          position: 'top-end',
          showConfirmButton: false
        });
      } else {
        if (newStatus === 'delivered') {
          const result = await Swal.fire({
            title: '¡Saldo Pendiente!',
            text: `La orden #${orderId.toString().slice(-6)} tiene un saldo de ${formatearDinero(balance)}. ¿Confirmar entrega sin liquidar?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, entregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#f43f5e',
          });
          if (!result.isConfirmed) return;
        } else {
          Swal.fire({
            title: 'Saldo Pendiente',
            text: `Orden ${actionText}. Recordatorio: Falta cobrar ${formatearDinero(balance)}.`,
            icon: 'warning',
            timer: 4000,
            toast: true,
            position: 'top-end',
            showConfirmButton: false
          });
        }
      }
    }

    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      // Actualizar estado localmente para rapidez
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (error) {
      Swal.fire('Error', 'No se pudo actualizar el estado', 'error');
    }
  };

  const handleOrderDelete = async (orderId) => {
    const { value: password } = await Swal.fire({
      title: 'Seguridad del Sistema',
      text: 'Ingresa la contraseña del administrador para eliminar esta orden:',
      input: 'password',
      inputPlaceholder: 'Contraseña de Seguridad',
      showCancelButton: true,
      confirmButtonText: 'Confirmar Eliminación',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#000000',
    });

    if (password) {
      const isValidAdmin = await staffService.validateAdminPin(password);

      if (isValidAdmin) {
        const confirm = await Swal.fire({
          title: '¿Eliminar orden permanentemente?',
          text: "Esta acción borrará la orden y sus prendas del sistema. Esta acción es irreversible.",
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#ef4444',
          cancelButtonColor: '#000000',
          confirmButtonText: 'Sí, eliminar',
          cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
          try {
            await orderService.deleteOrder(orderId);
            setOrders(prev => prev.filter(o => o.id !== orderId));
            Swal.fire({
              title: 'Orden Eliminada',
              icon: 'success',
              timer: 2000,
              showConfirmButton: false
            });
          } catch (error) {
            Swal.fire('Error', 'No se pudo eliminar la orden: ' + error.message, 'error');
          }
        }
      } else {
        Swal.fire('Error', 'PIN de administrador incorrecto', 'error');
      }
    }
  };
  
  const handleLiquidatePayment = (order) => {
    setOrderToLiquidate(order);
    setMetodoPago("cash");
    setMontoRecibido("");
    setMontoRecibidoUSD("");
    setUsarUSD(false);
    setIsPaymentModalOpen(true);
  };

  const finalizeLiquidation = async () => {
    if (!orderToLiquidate) return;
    
    setIsProcessing(true);
    try {
      const finalMethod = usarUSD ? 'usd_cash' : metodoPago;
      
      await orderService.updateOrderPayment(orderToLiquidate.id, {
        paid_amount: orderToLiquidate.total,
        payment_status: 'paid',
        payment_method: finalMethod
      });
      
      setOrders(prev => prev.map(o => o.id === orderToLiquidate.id ? { 
        ...o, 
        paid_amount: o.total, 
        payment_status: 'paid',
        payment_method: finalMethod
      } : o));
      
      Swal.fire({
        title: '¡Pago Liquidado!',
        text: `La orden #${orderToLiquidate.id.toString().slice(-6)} ha sido pagada totalmente.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      
      setIsPaymentModalOpen(false);
      setOrderToLiquidate(null);
    } catch (error) {
      console.error('Error finalizing liquidation:', error);
      Swal.fire('Error', 'No se pudo registrar el pago', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReprint = (order) => {
    // Transformar los datos para que coincidan con lo que espera TicketVenta
    const ventaData = {
      ...order,
      cliente: order.customers,
      productos: order.order_items.map(i => ({
        name: i.product_name,
        quantity: i.quantity,
        price: i.price,
        pricing_type: i.pricing_type
      }))
    };
    setOrderToPrint(ventaData);
  };

  const imprimirTicket = () => {
    if (ticketRef.current) {
        const printContent = ticketRef.current.innerHTML;
        const win = window.open('', '', 'width=800,height=600');
        win.document.write(`
            <html>
                <head>
                    <title>Reimpresión Ticket #${orderToPrint.id}</title>
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 5mm; }
                        .linea { border-bottom: 1px dashed #000; margin: 5px 0; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                    </style>
                </head>
                <body>${printContent}</body>
            </html>
        `);
        win.document.close();
        win.print();
    }
  };

  const statusLabels = {
    received: { label: 'Recibido', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    processing: { label: 'En Lavado/Proceso', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    ready: { label: 'Listo para Entrega', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    delivered: { label: 'Entregado', color: 'bg-slate-100 text-slate-700 border-slate-200' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 border-red-200' }
  };

  // Lógica de filtrado avanzada
  const filteredOrders = orders.filter(order => {
    // 1. Filtro por Estado
    if (filter !== 'all' && order.status !== filter) return false;

    // 2. Filtro por Búsqueda de Texto (ID o Nombre Cliente)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const clientName = order.customers?.name?.toLowerCase() || '';
      const orderId = order.id.toString();
      if (!clientName.includes(term) && !orderId.includes(term)) {
        return false;
      }
    }

    // 3. Filtro por Rango de Fechas (Fecha de creación)
    if (dateRange.start) {
      const orderDate = new Date(order.created_at).setHours(0,0,0,0);
      const startDate = new Date(dateRange.start).setHours(0,0,0,0);
      if (orderDate < startDate) return false;
    }
    if (dateRange.end) {
      const orderDate = new Date(order.created_at).setHours(0,0,0,0);
      const endDate = new Date(dateRange.end).setHours(0,0,0,0);
      if (orderDate > endDate) return false;
    }

    return true;
  });

  // Función para exportar a Excel
  const exportToExcel = () => {
    const dataToExport = filteredOrders.map(order => ({
      'ID Orden': order.id,
      'Cliente': order.customers?.name || 'Cliente General',
      'Teléfono': order.customers?.phone || '',
      'Estado': statusLabels[order.status]?.label || order.status,
      'Fecha Creación': new Date(order.created_at).toLocaleDateString(),
      'Fecha Prometida': new Date(order.promised_at).toLocaleDateString(),
      'Total': order.total,
      'Pagado': order.paid_amount,
      'Debe': Math.max(0, order.total - (order.paid_amount || 0)),
      'Notas': order.notes || '',
      'Items': order.order_items?.map(i => `${i.quantity} ${i.pricing_type === 'kg' ? 'kg' : 'pza'} ${i.product_name}`).join(', ')
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordenes");
    XLSX.writeFile(wb, `Reporte_Ordenes_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="orders-container p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Gestión de Lavandería</h1>
          <p className="text-slate-500 dark:text-slate-400">Administra el ciclo de vida de las prendas</p>
        </div>
        
        <div className="flex gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto max-w-full">
          {['all', 'received', 'processing', 'ready', 'delivered'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
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

      {/* BARRA DE HERRAMIENTAS DE FILTROS Y EXPORTACIÓN */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 animate-fade-in-down">
         <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            
            {/* Buscador */}
            <div className="relative w-full md:w-auto md:flex-1 max-w-md">
               <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
               <input 
                  type="text" 
                  placeholder="Buscar por Cliente o # Orden..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>

            {/* Acciones */}
            <div className="flex gap-2 w-full md:w-auto">
               <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
               >
                  <span className="material-symbols-outlined text-lg">filter_list</span>
                  Filtros
               </button>
               
               <button 
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
               >
                  <span className="material-symbols-outlined text-lg">download</span>
                  Exportar Excel
               </button>
            </div>
         </div>

         {/* Filtros Expandibles (Rango de Fechas) */}
         {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
               <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Desde</label>
                  <input 
                     type="date" 
                     className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold black-calendar-icon"
                     value={dateRange.start}
                     onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                  />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400">Hasta</label>
                  <input 
                     type="date" 
                     className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold black-calendar-icon"
                     value={dateRange.end}
                     onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                  />
               </div>
            </div>
         )}
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
               <p className="text-slate-500">No hay órdenes que coincidan con los filtros</p>
               <button 
                  onClick={() => {setFilter('all'); setSearchTerm(''); setDateRange({start:'', end:''});}}
                  className="mt-4 text-emerald-500 font-bold hover:underline"
               >
                  Limpiar filtros
               </button>
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
                    <p className="text-[10px] text-slate-400">Prometido</p>
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
                      <div className="flex flex-col">
                        <span className="text-slate-500">Total: {formatearDinero(order.total)}</span>
                      </div>
                      {(() => {
                        const balance = order.total - (order.paid_amount || 0);
                        const isPaid = order.payment_status === 'paid' || balance <= 0;
                        return (
                          <span className={`font-bold ${isPaid ? 'text-emerald-600' : 'text-orange-500'}`}>
                             {isPaid ? 'Pagado' : `Debe ${formatearDinero(balance)}`}
                          </span>
                        );
                      })()}
                   </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/30 flex gap-2">
                  {order.status === 'received' && (
                    <button 
                      onClick={() => handleStatusChange(order, 'processing')}
                      className="flex-grow py-2 bg-blue-500 hover:bg-blue-600 text-black text-[10px] font-black rounded-lg transition-colors shadow-sm"
                    >
                      Empezar Lavado
                    </button>
                  )}
                  {order.status === 'processing' && (
                    <button 
                      onClick={() => handleStatusChange(order, 'ready')}
                      className="flex-grow py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-[10px] font-black rounded-lg transition-colors shadow-sm"
                    >
                      Marcar Listo
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button 
                      onClick={() => handleStatusChange(order, 'delivered')}
                      className="flex-grow py-2 bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-black rounded-lg transition-colors shadow-sm"
                    >
                      Registrar Entrega
                    </button>
                  )}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button 
                      onClick={() => handleStatusChange(order, 'cancelled')}
                      className="px-2 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancelar"
                    >
                      <span className="material-symbols-outlined text-sm">cancel</span>
                    </button>
                  )}
                  {(order.total - (order.paid_amount || 0)) > 0 && (
                    <button 
                      onClick={() => handleLiquidatePayment(order)}
                      className="px-2 py-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Liquidar saldo pendiente"
                    >
                      <span className="material-symbols-outlined text-sm">payments</span>
                    </button>
                  )}
                  <button 
                    onClick={() => handleReprint(order)}
                    className="px-2 py-2 text-slate-400 hover:text-emerald-500 rounded-lg transition-colors"
                    title="Reimprimir Ticket"
                  >
                    <span className="material-symbols-outlined text-sm">print</span>
                  </button>
                  <button 
                    onClick={() => handleOrderDelete(order.id)}
                    className="px-2 py-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Eliminar permanentemente"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL DE PAGO (Liquidación) */}
      {isPaymentModalOpen && orderToLiquidate && (
        <div className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white uppercase tracking-tighter">Liquidar Saldo Pendiente</h3>
                    <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="text-center">
                        <p className="text-black text-[10px] mb-1 uppercase tracking-widest font-bold">Saldo a Cobrar</p>
                        <h4 className="text-4xl font-black text-slate-900 dark:text-white">
                          {formatearDinero(orderToLiquidate.total - orderToLiquidate.paid_amount)}
                        </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => {setMetodoPago("cash"); setUsarUSD(false);}}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === 'cash' && !usarUSD ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                        >
                            <span className="material-symbols-outlined text-3xl">payments</span>
                            <span className="text-xs font-bold uppercase">Efectivo</span>
                        </button>
                        <button 
                            onClick={() => {setMetodoPago("card"); setUsarUSD(false);}}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === 'card' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                        >
                            <span className="material-symbols-outlined text-3xl">credit_card</span>
                            <span className="text-xs font-bold uppercase">Tarjeta</span>
                        </button>
                        
                        {exchangeRate && (
                            <button 
                                onClick={() => {setMetodoPago("cash"); setUsarUSD(true);}}
                                className={`col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all ${usarUSD ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                            >
                                <span className="material-symbols-outlined text-xl">currency_exchange</span>
                                <span className="text-xs font-bold uppercase">Pagar con Dólares (USD @ ${exchangeRate.rate})</span>
                            </button>
                        )}
                    </div>

                    {/* CALCULADORA DE CAMBIO */}
                    {metodoPago === 'cash' && (
                        <div className={`p-4 rounded-xl border ${usarUSD ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'}`}>
                            <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${usarUSD ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                {usarUSD ? 'Dólares Recibidos (USD)' : 'Dinero Recibido (MXN)'}
                            </label>

                            {usarUSD && (
                                <div className="mb-3 p-2 bg-blue-100/50 dark:bg-blue-500/20 rounded-lg border border-blue-200 dark:border-blue-500/30">
                                    <p className="text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase">
                                        Cobrar al menos: <span className="text-sm">U$ {((orderToLiquidate.total - orderToLiquidate.paid_amount) / exchangeRate.rate).toFixed(2)}</span>
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-4 items-center">
                                <div className="relative flex-1">
                                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold ${usarUSD ? 'text-blue-600' : 'text-emerald-600'}`}>
                                        {usarUSD ? 'U$' : '$'}
                                    </span>
                                    <input 
                                        type="number" 
                                        className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border rounded-xl outline-none focus:ring-2 text-xl font-bold text-slate-900 dark:text-white ${usarUSD ? 'border-blue-200 focus:ring-blue-500' : 'border-emerald-200 focus:ring-emerald-500'}`}
                                        value={usarUSD ? montoRecibidoUSD : montoRecibido}
                                        onChange={(e) => usarUSD ? setMontoRecibidoUSD(e.target.value) : setMontoRecibido(e.target.value)}
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs mb-1 ${usarUSD ? 'text-blue-600' : 'text-emerald-600'}`}>Cambio (MXN)</p>
                                    <p className={`text-2xl font-black ${usarUSD ? 'text-blue-600' : 'text-blue-400'}`}>
                                        {(() => {
                                            const saldoPendiente = orderToLiquidate.total - orderToLiquidate.paid_amount;
                                            const recibidoMXN = usarUSD 
                                                ? (parseFloat(montoRecibidoUSD) || 0) * exchangeRate.rate 
                                                : (parseFloat(montoRecibido) || 0);
                                            return formatearDinero(Math.max(0, recibidoMXN - saldoPendiente));
                                        })()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-950 flex gap-3">
                    <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancelar</button>
                    <button 
                        onClick={finalizeLiquidation} 
                        disabled={isProcessing}
                        className="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                        LIQUIDAR PAGO
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL REIMPRESIÓN */}
      {orderToPrint && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                  <div id="printable-ticket" className="overflow-hidden">
                        <TicketVenta venta={orderToPrint} settings={businessSettings} ref={ticketRef} />
                  </div>
                  <div className="mt-8 space-y-3">
                      <button 
                          onClick={imprimirTicket}
                          className="w-full py-4 bg-slate-900 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                      >
                          <span className="material-symbols-outlined">print</span>
                          REIMPRIMIR TICKET
                      </button>
                      <button 
                          onClick={() => setOrderToPrint(null)}
                          className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                      >
                          CERRAR
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
