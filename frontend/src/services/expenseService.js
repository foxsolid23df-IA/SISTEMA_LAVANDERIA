import { supabase } from '../supabase';

export const expenseService = {
  // Obtener todos los gastos del usuario actual
  getAll: async (filters = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id);

    if (filters.startDate) {
      query = query.gte('expense_date', filters.startDate);
    }

    if (filters.endDate) {
      query = query.lte('expense_date', filters.endDate);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Obtener un gasto por ID
  getById: async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay una sesión activa.");

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  // Crear nuevo gasto
  create: async (expenseData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay una sesión activa para crear gastos.");

    const { data, error } = await supabase
      .from('expenses')
      .insert([{
        user_id: user.id,
        amount: parseFloat(expenseData.amount || 0),
        reason: expenseData.reason || expenseData.description || 'Gasto sin descripción',
        notes: expenseData.notes || null,
        category: expenseData.category || 'General',
        expense_date: expenseData.expense_date || new Date().toISOString().split('T')[0],
        payment_method: expenseData.payment_method || 'cash',
        staff_id: expenseData.staff_id || null,
        staff_name: expenseData.staff_name || null,
        cash_session_id: expenseData.cash_session_id || null,
        terminal_id: expenseData.terminal_id || null
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Actualizar gasto
  update: async (id, expenseData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay una sesión activa para actualizar gastos.");

    const updatePayload = {};

    if (expenseData.amount !== undefined) {
      updatePayload.amount = parseFloat(expenseData.amount);
    }
    if (expenseData.reason !== undefined || expenseData.description !== undefined) {
      updatePayload.reason = expenseData.reason || expenseData.description || 'Gasto sin descripción';
    }
    if (expenseData.notes !== undefined) {
      updatePayload.notes = expenseData.notes || null;
    }
    if (expenseData.category !== undefined) {
      updatePayload.category = expenseData.category || 'General';
    }
    if (expenseData.expense_date !== undefined) {
      updatePayload.expense_date = expenseData.expense_date;
    }
    if (expenseData.payment_method !== undefined) {
      updatePayload.payment_method = expenseData.payment_method || 'cash';
    }

    const { data, error } = await supabase
      .from('expenses')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Eliminar gasto
  delete: async (id) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No hay una sesión activa para eliminar gastos.");

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  },

  // Obtener resumen de gastos por categoría
  getSummaryByCategory: async (filters = {}) => {
    const expenses = await expenseService.getAll(filters);

    const summary = {};
    let total = 0;

    expenses.forEach(expense => {
      const category = expense.category || 'General';
      const amount = parseFloat(expense.amount || 0);

      if (!summary[category]) {
        summary[category] = 0;
      }

      summary[category] += amount;
      total += amount;
    });

    return { summary, total, count: expenses.length };
  }
};

export default expenseService;
