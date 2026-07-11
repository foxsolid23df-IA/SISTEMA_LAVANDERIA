import { supabase } from '../supabase';

const PRECIOS = {
  kg_lavado: 15,
  tintoreria: 55,
  cobertores: 85,
  prenda_extra: 55,
  gorras: 50,
  tennis: 50,
  mochila_bolsa: 50,
  planchado: 5.83,
};

export const productionSheetService = {
  PRECIOS,

  getEntries: async (entryDate) => {
    const { data, error } = await supabase
      .from('daily_production_entries')
      .select('*, staff(id, name)')
      .eq('entry_date', entryDate)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  saveEntries: async (entries) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No hay sesion activa');

    const payload = entries.map((e) => ({
      user_id: user.id,
      entry_date: e.entry_date,
      staff_id: e.staff_id,
      nota: e.nota,
      kg_lavado: parseFloat(e.kg_lavado || 0),
      tintoreria: parseInt(e.tintoreria || 0, 10),
      cobertores: parseInt(e.cobertores || 0, 10),
      prenda_extra: parseInt(e.prenda_extra || 0, 10),
      gorras: parseInt(e.gorras || 0, 10),
      tennis: parseInt(e.tennis || 0, 10),
      mochila_bolsa: parseInt(e.mochila_bolsa || 0, 10),
      planchado: parseInt(e.planchado || 0, 10),
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('daily_production_entries')
      .upsert(payload, {
        onConflict: 'user_id,entry_date,staff_id,nota',
        ignoreDuplicates: false,
      })
      .select('*, staff(id, name)');

    if (error) throw error;
    return data || [];
  },

  deleteEntry: async (id) => {
    const { error } = await supabase
      .from('daily_production_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  autoLoadFromOrders: async (entryDate) => {
    const start = `${entryDate}T00:00:00`;
    const end = `${entryDate}T23:59:59`;

    const { data: items, error } = await supabase
      .from('order_items')
      .select(`
        id,
        staff_id,
        product_name,
        quantity,
        price,
        order_id!inner(
          folio,
          created_at,
          status
        ),
        staff(
          id,
          name
        )
      `)
      .not('staff_id', 'is', null)
      .gte('order_id.created_at', start)
      .lte('order_id.created_at', end);

    if (error) {
      console.error('Error cargando ordenes:', error);
      return [];
    }

    const grouped = {};
    (items || []).forEach((item) => {
      const staffId = item.staff_id;
      const nota = String(item.order_id?.folio || '');
      if (!grouped[staffId]) {
        grouped[staffId] = {};
      }
      if (!grouped[staffId][nota]) {
        grouped[staffId][nota] = {
          staff_id: staffId,
          staff_name: item.staff?.name || '',
          nota,
          kg_lavado: 0,
          tintoreria: 0,
          cobertores: 0,
          prenda_extra: 0,
          gorras: 0,
          tennis: 0,
          mochila_bolsa: 0,
          planchado: 0,
          source: 'pos',
        };
      }
      const name = (item.product_name || '').toLowerCase();
      const qty = parseFloat(item.quantity || 0);
      if (name.includes('kg') || name.includes('kilo') || name.includes('lavado') || name.includes('ropa')) {
        grouped[staffId][nota].kg_lavado += qty;
      } else if (name.includes('planchado') || name.includes('plancha')) {
        grouped[staffId][nota].planchado += Math.round(qty);
      } else {
        grouped[staffId][nota].tintoreria += Math.round(qty);
      }
    });

    const result = [];
    Object.values(grouped).forEach((notas) => {
      Object.values(notas).forEach((entry) => {
        result.push(entry);
      });
    });

    return result;
  },

  calcularIngreso: (entry) => {
    const totalkg = parseFloat(entry.kg_lavado || 0) * PRECIOS.kg_lavado;
    const totalTint = (parseInt(entry.tintoreria || 0, 10)) * PRECIOS.tintoreria;
    const totalCob = (parseInt(entry.cobertores || 0, 10)) * PRECIOS.cobertores;
    const totalExtra = (parseInt(entry.prenda_extra || 0, 10)) * PRECIOS.prenda_extra;
    const totalGorras = (parseInt(entry.gorras || 0, 10)) * PRECIOS.gorras;
    const totalTennis = (parseInt(entry.tennis || 0, 10)) * PRECIOS.tennis;
    const totalBolsa = (parseInt(entry.mochila_bolsa || 0, 10)) * PRECIOS.mochila_bolsa;
    const totalPlanchado = (parseInt(entry.planchado || 0, 10)) * PRECIOS.planchado;
    return totalkg + totalTint + totalCob + totalExtra + totalGorras + totalTennis + totalBolsa + totalPlanchado;
  },

  formatMoney: (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(parseFloat(amount || 0));
  },
};

export default productionSheetService;
