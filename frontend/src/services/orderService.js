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
        cash_session_id: orderData.cash_session_id
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
  }
};
