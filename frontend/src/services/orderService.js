import { supabase } from '../supabase';

export const orderService = {
  // Crear una nueva orden de lavandería
  async createOrder(orderData) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    // 1. Insertar la cabecera de la orden
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: user.id,
        customer_id: orderData.customer_id,
        total: orderData.total,
        paid_amount: orderData.paid_amount || 0,
        discount: orderData.discount || 0,
        status: orderData.status || 'received',
        payment_status: orderData.payment_status || 'pending',
        payment_method: orderData.payment_method || 'cash',
        notes: orderData.notes,
        promised_at: orderData.promised_at,
        cash_session_id: orderData.cash_session_id,
        has_tax: orderData.has_tax || false,
        tax_amount: orderData.tax_amount || 0,
        invoice_requested: orderData.invoice_requested || false
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. Insertar los items de la orden
    const items = orderData.items.map(item => ({
      order_id: order.id,
      user_id: user.id,
      product_id: item.product_id || null,
      product_name: item.product_name || item.name,
      quantity: item.quantity,
      price: item.price,
      pricing_type: item.pricing_type || 'unit',
      total: item.price * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(items);

    if (itemsError) throw itemsError;

    return order;
  },

  // Obtener todas las órdenes con detalles de cliente e items
  async getOrders() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        order_items (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Obtener órdenes por estado
  async getOrdersByStatus(status) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        order_items (*)
      `)
      .eq('user_id', user.id)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Actualizar estado de una orden
  async updateOrderStatus(orderId, newStatus) {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  },

  // Eliminar una orden (requiere permisos administrativos)
  async deleteOrder(orderId) {
    // Primero eliminar items
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    // Luego eliminar orden
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (orderError) throw orderError;
    return true;
  },

  // Actualizar pago de una orden
  async updateOrderPayment(orderId, paymentData) {
    const { error } = await supabase
      .from('orders')
      .update({
        paid_amount: paymentData.paid_amount,
        payment_status: paymentData.payment_status,
        payment_method: paymentData.payment_method || 'cash'
      })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  },

  // Actualizar solo el método de pago de una orden
  async updateOrderPaymentMethod(orderId, newMethod) {
    const { error } = await supabase
      .from('orders')
      .update({ payment_method: newMethod })
      .eq('id', orderId);

    if (error) throw error;
    return true;
  },

  // Obtener órdenes de hoy
  async getTodayOrders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Obtener órdenes en un rango de fechas
  async getOrdersInRange(startTime, endTime, terminalId = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    let query = supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        order_items (*)
      `)
      .gte('created_at', startTime)
      .lte('created_at', endTime)
      .order('created_at', { ascending: false });

    // Since orders don't have terminal_id DIRECTLY in this version of the schema, 
    // we would need a join if we wanted to filter by terminal. 
    // However, for reports, searching by time range is usually enough.
    // If sessions are used, we can filter by session_id in the future.

    const { data: orders, error } = await query;
    if (error) throw error;
    return orders || [];
  },

  // Obtener órdenes desde una fecha
  async getOrdersSince(startTime, terminalId = null) {
    if (!startTime) return [];

    let query = supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        order_items (*)
      `)
      .gte('created_at', startTime)
      .order('created_at', { ascending: false });

    const { data: orders, error } = await query;

    if (error) throw error;
    return orders || [];
  },

  // Obtener órdenes por sesión de caja
  async getOrdersBySession(sessionId) {
    if (!sessionId) return [];

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, phone),
        order_items (*)
      `)
      .eq('cash_session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // --- MÉTODOS PARA ESTADÍSTICAS Y AUDITORÍA ---

  // Eliminar una orden (requiere permisos administrativos)
  async deleteOrder(orderId) {
    // Primero eliminar los items de la orden
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    // Luego eliminar la orden
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (orderError) throw orderError;
    return true;
  },

  // Obtener estadísticas generales de órdenes
  async getStatistics(signal) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No authenticated user");

    const ahora = new Date();

    // Usar instancias separadas para evitar mutación
    const inicioDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0).toISOString();
    const finDelDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999).toISOString();

    const diaActual = ahora.getDay();
    const diferencia = diaActual === 0 ? 6 : diaActual - 1;
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - diferencia);
    inicioSemana.setHours(0, 0, 0, 0);

    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();

    let query = supabase
      .from('orders')
      .select('total, paid_amount, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (signal) query = query.abortSignal(signal);

    const { data: todasOrdenes, error } = await query;
    if (error) throw error;

    const calculos = (data) => ({
      count: data.length,
      total: data.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0),
      collected: data.reduce((sum, o) => sum + (parseFloat(o.paid_amount) || 0), 0)
    });

    const totales = calculos(todasOrdenes);
    const hoy = calculos(todasOrdenes.filter(o => new Date(o.created_at) >= new Date(inicioDelDia)));
    const semana = calculos(todasOrdenes.filter(o => new Date(o.created_at) >= inicioSemana));
    const mes = calculos(todasOrdenes.filter(o => new Date(o.created_at) >= new Date(inicioMes)));

    return {
      ordenesTotales: totales.count,
      ingresosTotales: totales.total,
      recaudadoTotal: totales.collected,
      ordenesDeHoy: hoy.count,
      ingresosDeHoy: hoy.total,
      recaudadoHoy: hoy.collected,
      ordenesSemana: semana.count,
      ingresosSemana: semana.total,
      ingresosMes: mes.total
    };
  },

  // Obtener top servicios más solicitados
  async getTopServices(limit = 5, signal) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('order_items')
      .select('product_name, quantity, price, total')
      .eq('user_id', user.id);

    if (signal) query = query.abortSignal(signal);

    const { data: items, error } = await query;
    if (error) throw error;

    const serviciosMap = {};
    items.forEach(item => {
      const nombre = item.product_name;
      if (!serviciosMap[nombre]) {
        serviciosMap[nombre] = { name: nombre, cantidad: 0, ingresos: 0 };
      }
      serviciosMap[nombre].cantidad += parseFloat(item.quantity) || 0;
      serviciosMap[nombre].ingresos += parseFloat(item.total) || 0;
    });

    return Object.values(serviciosMap)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, limit)
      .map((s, i) => ({ id: i + 1, ...s }));
  },

  // Ventas semanales de órdenes
  async getWeeklyOrdersData(signal) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [0, 0, 0, 0, 0, 0, 0];

    const ahora = new Date();
    const diaActual = ahora.getDay();
    const diasHastaLunes = diaActual === 0 ? 6 : diaActual - 1;
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - diasHastaLunes);
    inicioSemana.setHours(0, 0, 0, 0);

    let query = supabase
      .from('orders')
      .select('total, created_at')
      .eq('user_id', user.id)
      .gte('created_at', inicioSemana.toISOString());

    if (signal) query = query.abortSignal(signal);

    const { data: orders, error } = await query;
    if (error) throw error;

    const data = [0, 0, 0, 0, 0, 0, 0];
    orders.forEach(o => {
      const d = (new Date(o.created_at).getDay() + 6) % 7; // Lun=0...Dom=6
      data[d] += parseFloat(o.total) || 0;
    });
    return data;
  },

  // Estadísticas por rango para órdenes
  async getStatisticsByDateRange(fechaInicio, fechaFin, signal) {
    let query = supabase.from('orders').select('total, paid_amount, created_at');
    if (fechaInicio) query = query.gte('created_at', fechaInicio);
    if (fechaFin) {
      const d = new Date(fechaFin);
      d.setHours(23, 59, 59, 999);
      query = query.lte('created_at', d.toISOString());
    }

    if (signal) query = query.abortSignal(signal);

    const { data, error } = await query;
    if (error) throw error;

    return {
      ventasEnRango: data.length,
      ingresosEnRango: data.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0),
      recaudadoEnRango: data.reduce((sum, o) => sum + (parseFloat(o.paid_amount) || 0), 0),
      fechaInicio: fechaInicio || 'Inicio',
      fechaFin: fechaFin || 'Fin'
    };
  }
};
