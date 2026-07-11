import { supabase } from '../supabase';

export const productionService = {
  getEmployeeProduction: async (filters = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('order_items')
      .select(`
        id,
        staff_id,
        product_id,
        product_name,
        quantity,
        price,
        total,
        cost_price,
        order_id (
          folio,
          created_at,
          status
        ),
        staff (
          id,
          name
        ),
        products (
          cost_price
        )
      `)
      .eq('user_id', user.id)
      .not('staff_id', 'is', null);

    if (filters.startDate) {
      query = query.gte('order_id.created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('order_id.created_at', filters.endDate);
    }
    if (filters.staffId) {
      query = query.eq('staff_id', filters.staffId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const sorted = (data || []).sort((a, b) =>
      new Date(b.order_id?.created_at || 0) - new Date(a.order_id?.created_at || 0)
    );

    return sorted.map(item => {
      const costPrice = parseFloat(item.cost_price ?? item.products?.cost_price ?? 0);
      const sellingPrice = parseFloat(item.price || 0);
      const qty = parseFloat(item.quantity || 0);
      const unitProfit = sellingPrice - costPrice;
      const totalProfit = unitProfit * qty;

      return {
        id: item.id,
        staffName: item.staff?.name || 'Sin asignar',
        staffId: item.staff_id,
        folio: item.order_id?.folio || '-',
        service: item.product_name,
        quantity: qty,
        sellingPrice,
        costPrice,
        unitProfit,
        totalProfit,
        total: parseFloat(item.total || 0),
        createdAt: item.order_id?.created_at || null
      };
    });
  },

  getEmployeeSummary: async (filters = {}) => {
    const items = await productionService.getEmployeeProduction(filters);

    const summary = {};
    let grandTotal = 0;

    items.forEach(item => {
      const name = item.staffName;
      if (!summary[name]) {
        summary[name] = {
          staffName: name,
          staffId: item.staffId,
          totalProfit: 0,
          itemCount: 0,
          items: []
        };
      }
      summary[name].totalProfit += item.totalProfit;
      summary[name].itemCount += 1;
      summary[name].items.push(item);
      grandTotal += item.totalProfit;
    });

    return {
      employees: Object.values(summary).sort((a, b) => b.totalProfit - a.totalProfit),
      grandTotal,
      totalItems: items.length
    };
  }
};

export default productionService;
