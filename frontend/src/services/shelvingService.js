import { supabase } from '../supabase';

export const shelvingService = {
  // ==================== ESTANTERÍAS (CATÁLOGO) ====================

  getShelves: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('shelves')
      .select('*')
      .eq('user_id', user.id)
      .order('row_label', { ascending: true })
      .order('column_number', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  createShelf: async (shelfData) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('shelves')
      .insert([{ ...shelfData, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateShelf: async (id, updates) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('shelves')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  deleteShelf: async (id) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { error } = await supabase
      .from('shelves')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  },

  generateShelvesForStore: async (rows = 5, columns = 10) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    // PRIMERO: Obtener IDs de estanterías actuales para limpiar assignments
    const { data: currentShelves } = await supabase
      .from('shelves')
      .select('id')
      .eq('user_id', user.id);

    // Eliminar assignments huérfanas antes de borrar estanterías
    if (currentShelves && currentShelves.length > 0) {
      const shelfIds = currentShelves.map(s => s.id);
      await supabase
        .from('order_shelf_assignments')
        .update({ removed_at: new Date().toISOString(), notes: 'Removido automáticamente: regeneración de grid' })
        .eq('user_id', user.id)
        .in('shelf_id', shelfIds)
        .is('removed_at', null);
    }

    // Eliminar estanterías existentes
    await supabase.from('shelves').delete().eq('user_id', user.id);

    const shelves = [];
    const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    for (let r = 0; r < rows; r++) {
      for (let c = 1; c <= columns; c++) {
        const rowLabel = rowLabels[r] || `R${r + 1}`;
        shelves.push({
          user_id: user.id,
          row_label: rowLabel,
          column_number: c,
          label: `${rowLabel}${c}`,
          status: 'available'
        });
      }
    }

    const { data, error } = await supabase
      .from('shelves')
      .insert(shelves)
      .select();

    if (error) throw error;
    return data;
  },

  // ==================== ASIGNACIONES ====================

  getShelfAssignments: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('order_shelf_assignments')
      .select(`
        *,
        shelf:shelf_id (id, label, row_label, column_number, status),
        order:order_id (id, folio, total, status, promised_at, notes, created_at,
          customer:customer_id (name, phone))
      `)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .order('assigned_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  getShelfOrderCounts: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('order_shelf_assignments')
      .select('shelf_id')
      .eq('user_id', user.id)
      .is('removed_at', null);

    if (error) throw error;

    // Contar órdenes por estantería
    const counts = {};
    (data || []).forEach(a => {
      counts[a.shelf_id] = (counts[a.shelf_id] || 0) + 1;
    });
    return counts;
  },

  getOrderShelf: async (orderId) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('order_shelf_assignments')
      .select(`
        *,
        shelf:shelf_id (id, label, row_label, column_number, status)
      `)
      .eq('user_id', user.id)
      .eq('order_id', orderId)
      .is('removed_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  assignOrderToShelf: async (orderId, shelfId, assignedBy = null) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    // Verificar si la orden ya tiene asignación
    const existing = await shelvingService.getOrderShelf(orderId);
    if (existing) {
      throw new Error("Esta orden ya tiene una estantería asignada. Quite la asignación actual primero.");
    }

    // Verificar que la estantería exista y esté en buen estado
    const { data: shelf, error: shelfError } = await supabase
      .from('shelves')
      .select('id, status')
      .eq('id', shelfId)
      .eq('user_id', user.id)
      .single();

    if (shelfError || !shelf) {
      throw new Error("La estantería seleccionada no existe.");
    }

    if (shelf.status === 'maintenance') {
      throw new Error("Esta estantería está en mantenimiento y no se puede usar.");
    }

    // Permitir asignar a estanterías ocupadas (múltiples órdenes por estantería)

    // Crear asignación
    const { data, error } = await supabase
      .from('order_shelf_assignments')
      .insert([{
        order_id: orderId,
        shelf_id: shelfId,
        user_id: user.id,
        assigned_by: assignedBy
      }])
      .select(`
        *,
        shelf:shelf_id (id, label, row_label, column_number, status)
      `)
      .single();

    if (error) throw error;

    // Actualizar estado de la estantería a ocupada (con manejo de error)
    const { error: updateError } = await supabase
      .from('shelves')
      .update({ status: 'occupied', updated_at: new Date().toISOString() })
      .eq('id', shelfId)
      .eq('user_id', user.id);

    if (updateError) {
      console.warn("Error actualizando status de estantería:", updateError);
    }

    // Registrar en historial
    await shelvingService._logMovement(orderId, shelfId, 'assigned', assignedBy);

    return data;
  },

  unassignOrder: async (orderId, performedBy = null) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    // Obtener la asignación actual
    const assignment = await shelvingService.getOrderShelf(orderId);
    if (!assignment) throw new Error("No hay asignación para esta orden.");

    // Marcar como removida
    const { error } = await supabase
      .from('order_shelf_assignments')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', assignment.id)
      .eq('user_id', user.id);

    if (error) throw error;

    // Verificar si la estantería tiene otras órdenes activas
    const { data: otherOrders } = await supabase
      .from('order_shelf_assignments')
      .select('id')
      .eq('shelf_id', assignment.shelf_id)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .neq('id', assignment.id);

    // Si no hay más órdenes, marcar como disponible
    if (!otherOrders || otherOrders.length === 0) {
      await supabase
        .from('shelves')
        .update({ status: 'available', updated_at: new Date().toISOString() })
        .eq('id', assignment.shelf_id)
        .eq('user_id', user.id);
    }

    // Registrar en historial
    await shelvingService._logMovement(orderId, assignment.shelf_id, 'removed', performedBy);
  },

  reassignOrder: async (orderId, newShelfId, assignedBy = null) => {
    // Obtener asignación actual antes de quitar
    const currentAssignment = await shelvingService.getOrderShelf(orderId);

    // Quitar asignación actual
    await shelvingService.unassignOrder(orderId, assignedBy);

    // Asignar nueva
    const newAssignment = await shelvingService.assignOrderToShelf(orderId, newShelfId, assignedBy);

    // Registrar reasignación en historial
    if (currentAssignment) {
      await shelvingService._logMovement(orderId, newShelfId, 'reassigned', assignedBy, {
        from_shelf: currentAssignment.shelf?.label
      });
    }

    return newAssignment;
  },

  // ==================== AUTO-ASIGNACIÓN ====================

  autoAssignShelf: async (orderId, assignedBy = null) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    // Preferir estantería disponible (vacía)
    const { data: availableShelf } = await supabase
      .from('shelves')
      .select('id, label')
      .eq('user_id', user.id)
      .eq('status', 'available')
      .order('row_label', { ascending: true })
      .order('column_number', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (availableShelf) {
      return await shelvingService.assignOrderToShelf(orderId, availableShelf.id, assignedBy || 'Auto-asignado');
    }

    // No hay disponibles: buscar la estantería con MENOS órdenes activas (que no esté en mantenimiento)
    const { data: occupiedShelves } = await supabase
      .from('shelves')
      .select('id, label')
      .eq('user_id', user.id)
      .neq('status', 'maintenance')
      .order('row_label', { ascending: true })
      .order('column_number', { ascending: true });

    if (!occupiedShelves || occupiedShelves.length === 0) {
      return null; // No hay estanterías válidas
    }

    // Contar órdenes activas por estantería y elegir la de menor carga
    let bestShelf = null;
    let bestCount = Infinity;

    for (const shelf of occupiedShelves) {
      const { count } = await supabase
        .from('order_shelf_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('shelf_id', shelf.id)
        .is('removed_at', null);

      if (count < bestCount) {
        bestCount = count;
        bestShelf = shelf;
      }
    }

    if (!bestShelf) return null;

    return await shelvingService.assignOrderToShelf(orderId, bestShelf.id, assignedBy || 'Auto-asignado');
  },

  // ==================== BÚSQUEDA / ESCANEO ====================

  getOrdersByShelf: async (shelfLabel) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('order_shelf_assignments')
      .select(`
        *,
        shelf:shelf_id (id, label, row_label, column_number, status),
        order:order_id (id, folio, total, status, promised_at, notes, created_at,
          customer:customer_id (name, phone))
      `)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .eq('shelf.label', shelfLabel.toUpperCase());

    if (error) throw error;
    return data || [];
  },

  scanShelf: async (orderId) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('order_shelf_assignments')
      .select(`
        *,
        shelf:shelf_id (id, label, row_label, column_number, status),
        order:order_id (
          id, folio, total, status, promised_at, notes, created_at,
          customer:customer_id (name, phone),
          order_items (id, product_name, quantity, price, total)
        )
      `)
      .eq('user_id', user.id)
      .eq('order_id', orderId)
      .is('removed_at', null)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  // ==================== ÓRDENES SIN ASIGNAR ====================

  getUnassignedOrders: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    // Obtener IDs de órdenes que ya tienen asignación
    const { data: assignedOrders } = await supabase
      .from('order_shelf_assignments')
      .select('order_id')
      .eq('user_id', user.id)
      .is('removed_at', null);

    const assignedIds = assignedOrders?.map(a => a.order_id) || [];

    // Obtener órdenes activas sin asignación
    let query = supabase
      .from('orders')
      .select(`
        id, folio, total, status, promised_at, notes, created_at,
        customer:customer_id (name, phone),
        order_items (product_name, quantity)
      `)
      .eq('user_id', user.id)
      .in('status', ['received', 'processing'])
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });

    if (assignedIds.length > 0) {
      query = query.not('id', 'in', `(${assignedIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // ==================== ÓRDENES VENCIDAS ====================

  getOverdueAssignments: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('order_shelf_assignments')
      .select(`
        *,
        shelf:shelf_id (id, label, row_label, column_number, status),
        order:order_id (id, folio, total, status, promised_at, notes,
          customer:customer_id (name, phone))
      `)
      .eq('user_id', user.id)
      .is('removed_at', null)
      .lt('order.promised_at', now)
      .not('order.status', 'in', '(ready,delivered,cancelled)');

    if (error) throw error;
    return data || [];
  },

  // ==================== HISTORIAL DE MOVIMIENTOS ====================

  _logMovement: async (orderId, shelfId, action, performedBy = null, metadata = null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('shelf_movement_log')
        .insert([{
          order_id: orderId,
          shelf_id: shelfId,
          user_id: user.id,
          action,
          performed_by: performedBy || 'Sistema',
          metadata: metadata ? JSON.stringify(metadata) : null
        }]);
    } catch (err) {
      console.warn("Error logging shelf movement:", err);
    }
  },

  getMovementHistory: async (limit = 50) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('shelf_movement_log')
      .select(`
        *,
        shelf:shelf_id (label),
        order:order_id (folio, id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // ==================== ESTADÍSTICAS ====================

  getShelvingStats: async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    // Una sola consulta para shelves
    const { data: shelves } = await supabase
      .from('shelves')
      .select('id, status')
      .eq('user_id', user.id);

    // Contar assignments activos
    const { count: activeAssignments } = await supabase
      .from('order_shelf_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('removed_at', null);

    // Contar órdenes vencidas
    const now = new Date().toISOString();
    const { count: overdueCount } = await supabase
      .from('order_shelf_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('removed_at', null);

    const totalShelves = shelves?.length || 0;
    const occupiedShelves = shelves?.filter(s => s.status === 'occupied').length || 0;
    const availableShelves = shelves?.filter(s => s.status === 'available').length || 0;
    const maintenanceShelves = shelves?.filter(s => s.status === 'maintenance').length || 0;
    const occupancyRate = totalShelves > 0 ? Math.round((occupiedShelves / totalShelves) * 100) : 0;

    return {
      totalShelves,
      occupiedShelves,
      availableShelves,
      maintenanceShelves,
      activeAssignments: activeAssignments || 0,
      occupancyRate,
      overdueCount: overdueCount || 0
    };
  },

  // ==================== REPORTE DE UTILIZACIÓN ====================

  getUtilizationReport: async (days = 7) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('shelf_movement_log')
      .select('action, created_at')
      .eq('user_id', user.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Agrupar por día
    const report = {};
    (data || []).forEach(m => {
      const day = m.created_at.split('T')[0];
      if (!report[day]) {
        report[day] = { assigned: 0, removed: 0, reassigned: 0 };
      }
      if (m.action === 'assigned') report[day].assigned++;
      else if (m.action === 'removed') report[day].removed++;
      else if (m.action === 'reassigned') report[day].reassigned++;
    });

    return report;
  },

  updateShelfStatus: async (shelfId, status) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("No hay una sesión activa");

    const { data, error } = await supabase
      .from('shelves')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', shelfId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
