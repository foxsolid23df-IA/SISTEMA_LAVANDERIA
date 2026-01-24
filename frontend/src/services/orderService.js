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
        status: orderData.status || 'received',
        payment_status: orderData.payment_status || 'pending',
        notes: orderData.notes,
        promised_at: orderData.promised_at
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
  }
};
