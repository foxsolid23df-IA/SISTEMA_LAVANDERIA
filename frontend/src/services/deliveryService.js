import { supabase } from '../supabase';

export const DELIVERY_PAYMENT_PREFERENCES = {
    pay_at_pickup: "Pagar o abonar al entregar al chofer",
    pay_on_ready_delivery: "Pagar cuando me entreguen la ropa lista",
    pay_at_store_pickup: "Pagar cuando pase a recoger en sucursal"
};

export const DELIVERY_PAYMENT_METHODS = {
    efectivo: "Efectivo",
    transferencia: "Transferencia",
    tarjeta: "Tarjeta"
};

const calculatePaymentStatus = (order, payments = []) => {
    const total = (Number(order?.service_cost) || 0) + (Number(order?.delivery_fee) || 0);
    const paid = payments
        .filter((payment) => payment.status !== 'voided')
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    if (paid <= 0) return 'unpaid';
    if (total > 0 && paid >= total) return 'paid';
    return 'partial';
};

const getOrderByTrackingTokenDevFallback = async (trackingToken) => {
    const { data, error } = await supabase
        .from('delivery_orders')
        .select(`
            id,
            customer_name,
            customer_address,
            notes,
            status,
            garment_summary,
            customer_item_description,
            payment_preference,
            payment_preference_confirmed_at,
            payment_status,
            service_cost,
            delivery_fee,
            pickup_quote_confirmed_at,
            quote_notes,
            tracking_token,
            created_at,
            accepted_at,
            picked_up_at,
            delivered_to_store_at,
            completed_at
        `)
        .eq('tracking_token', trackingToken)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Pedido no encontrado.");

    const serviceCost = Number(data.service_cost) || 0;
    const deliveryFee = Number(data.delivery_fee) || 0;
    const { data: payments } = await supabase
        .from('delivery_payments')
        .select('amount, payment_method, reference, status, receipt_token, created_at, reconciled_at')
        .eq('delivery_order_id', data.id)
        .neq('status', 'voided')
        .order('created_at', { ascending: true });

    const paidAmount = (payments || []).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

    return {
        ...data,
        total_cost: serviceCost + deliveryFee,
        paid_amount: paidAmount,
        balance_due: Math.max(0, serviceCost + deliveryFee - paidAmount),
        payments: payments || [],
        store_name: "Gabino PRUEBAS",
        driver_name: null
    };
};

const runDeliveryAction = async (action, payload = {}) => {
    const { data, error } = await supabase.functions.invoke('delivery-actions', {
        body: { action, payload }
    });

    // El SDK lanza un error genérico ("Edge Function returned a non-2xx status code")
    // cuando el status HTTP es >= 400. El mensaje real viene en data.error del body JSON.
    // Leer data.error primero para mostrar el motivo real al usuario.
    if (data?.error) throw new Error(data.error);
    if (error) throw error;
    return data;
};

export const deliveryService = {
    // ─── GESTIÓN DE DIRECTORIO DE CLIENTES ─────────────────────────────
    
    // Obtener clientes de la tienda
    getCustomers: async () => {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    // Registrar nuevo cliente
    createCustomer: async (customerData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data, error } = await supabase
            .from('customers')
            .insert([{
                user_id: user.id,
                name: customerData.name,
                phone: customerData.phone,
                address: customerData.address || ''
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ─── GESTIÓN DE PEDIDOS DE DELIVERY ───────────────────────────────

    // Obtener todos los pedidos de la sucursal (para el dashboard POS)
    getStoreOrders: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const { data, error } = await supabase
            .from('delivery_orders')
            .select(`
                *,
                customers:customer_id (*),
                driver:driver_id (name, role, phone),
                delivery_payments (*)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map((order) => ({
            ...order,
            _currentStoreId: user.id,
            _isCurrentStore: order.user_id === user.id
        }));
    },

    // Obtener pedidos asignados a un repartidor específico
    getDriverOrders: async (driverId, driverSessionToken) => {
        const data = await runDeliveryAction('get_driver_orders', {
            driver_id: driverId,
            driver_session_token: driverSessionToken
        });

        return data?.orders || [];
    },

    // Crear un nuevo pedido de recogida
    createOrder: async (orderData) => {
        // Obtenemos sesión por si la crea el POS o el cliente
        const { data: authData } = await supabase.auth.getUser();
        
        // Si hay usuario autenticado (POS), usamos su user_id; si es solicitud pública,
        // necesitamos asociarlo a la sucursal (user_id se provee en orderData)
        const userId = authData?.user?.id || orderData.user_id;

        if (!userId) {
            throw new Error("ID de sucursal no provisto para la creación del pedido.");
        }

        const { data, error } = await supabase
            .from('delivery_orders')
            .insert([{
                user_id: userId,
                customer_id: orderData.customer_id || null,
                customer_name: orderData.customer_name,
                customer_phone: orderData.customer_phone,
                customer_address: orderData.customer_address,
                notes: orderData.notes || '',
                status: 'requested',
                delivery_fee: orderData.delivery_fee || 0.00,
                service_cost: 0.00
            }])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Asignar repartidor a un pedido
    assignDriver: async (orderId, driverId, driverName, driverPhone) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No authenticated user");

        const parsedDriverId = Number(driverId);
        if (!Number.isFinite(parsedDriverId)) {
            throw new Error("ID de repartidor inválido.");
        }

        const { error: updateError } = await supabase
            .from('delivery_orders')
            .update({
                driver_id: parsedDriverId,
                status: 'assigned',
                accepted_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .eq('user_id', user.id);

        if (updateError) throw updateError;

        const { data: order, error: fetchError } = await supabase
            .from('delivery_orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (!order) {
            throw new Error("No se encontrÃ³ el pedido despuÃ©s de intentar asignarlo. Recarga el panel e intÃ©ntalo de nuevo.");
        }

        if (order.user_id !== user.id || Number(order.driver_id) !== parsedDriverId || order.status !== 'assigned') {
            throw new Error("El pedido no se pudo actualizar para esta tienda. Verifica que la solicitud haya sido creada con el store_id correcto del negocio y recarga el panel.");
        }

        // Disparar notificación automatizada en segundo plano
        let notificationResult = null;

        try {
            notificationResult = await deliveryService.triggerNotification(order, {
                status: 'assigned',
                driver_name: driverName,
                driver_phone: driverPhone
            });
        } catch (e) {
            console.error('[DeliveryService] Error al disparar notificación:', e);
        }

        if (!notificationResult) {
            notificationResult = { success: false, error: "No se pudo enviar la notificacion." };
        }

        return {
            ...order,
            _notificationResult: notificationResult
        };
    },

    // Actualizar estado del pedido (y notas/costos adicionales)
    updateOrderStatus: async (orderId, newStatus, extraData = {}) => {
        if (newStatus === 'completed' && !extraData.allow_balance) {
            const { data: orderToComplete } = await supabase
                .from('delivery_orders')
                .select('service_cost, delivery_fee, payment_status, delivery_payments(amount, status)')
                .eq('id', orderId)
                .maybeSingle();

            const total = (Number(orderToComplete?.service_cost) || 0) + (Number(orderToComplete?.delivery_fee) || 0);
            const paid = (orderToComplete?.delivery_payments || [])
                .filter((payment) => payment.status !== 'voided')
                .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

            if (total > 0 && paid < total) {
                throw new Error("El pedido tiene saldo pendiente. Confirma pago o autoriza entrega con saldo pendiente.");
            }
        }

        const updatePayload = { status: newStatus };
        
        if (newStatus === 'accepted') updatePayload.accepted_at = new Date().toISOString();
        if (newStatus === 'picked_up') updatePayload.picked_up_at = new Date().toISOString();
        if (newStatus === 'delivered_to_store') updatePayload.delivered_to_store_at = new Date().toISOString();
        if (newStatus === 'completed') updatePayload.completed_at = new Date().toISOString();

        if (extraData.service_cost !== undefined) updatePayload.service_cost = parseFloat(extraData.service_cost);
        if (extraData.delivery_fee !== undefined) updatePayload.delivery_fee = parseFloat(extraData.delivery_fee);
        if (extraData.garment_summary !== undefined) updatePayload.garment_summary = extraData.garment_summary;
        if (extraData.pickup_evidence_path !== undefined) updatePayload.pickup_evidence_path = extraData.pickup_evidence_path;
        if (extraData.allow_balance) updatePayload.completed_with_balance = true;

        const { data: order, error: updateError } = await supabase
            .from('delivery_orders')
            .update(updatePayload)
            .eq('id', orderId)
            .select()
            .single();

        if (updateError) throw updateError;

        // Disparar notificación automatizada en segundo plano
        try {
            await deliveryService.triggerNotification(order, {
                status: newStatus,
                driver_name: extraData.driver_name
            });
        } catch (e) {
            console.error('[DeliveryService] Error al disparar notificación:', e);
        }

        return order;
    },

    updatePickupQuote: async (orderId, deliveryFee, quoteNotes = '') => {
        const fee = Number(deliveryFee);
        if (!Number.isFinite(fee) || fee < 0) {
            throw new Error("Captura una tarifa de recogida valida. Puede ser $0.00 si no se cobrara delivery.");
        }

        const { data, error } = await supabase
            .from('delivery_orders')
            .update({
                delivery_fee: fee,
                pickup_quote_confirmed_at: new Date().toISOString(),
                quote_notes: quoteNotes?.trim() || null
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;

        let notificationResult = null;
        try {
            notificationResult = await deliveryService.triggerNotification(data, {
                status: 'quoted'
            });
        } catch (err) {
            console.warn('[DeliveryService] Tarifa guardada, pero no se pudo notificar al cliente:', err);
        }

        return {
            ...data,
            _notificationResult: notificationResult
        };
    },

    uploadPickupEvidence: async (order, file) => {
        if (!file) return null;
        if (!file.type?.startsWith('image/')) {
            throw new Error("La evidencia debe ser una imagen.");
        }

        const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
        const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${order.user_id}/${order.id}/pickup-${Date.now()}.${safeExtension}`;

        const { error } = await supabase.storage
            .from('delivery-evidence')
            .upload(path, file, {
                cacheControl: '3600',
                contentType: file.type || 'image/jpeg',
                upsert: true
            });

        if (error) throw error;
        return path;
    },

    getPickupEvidenceSignedUrl: async (path) => {
        if (!path) return null;

        const { data, error } = await supabase.storage
            .from('delivery-evidence')
            .createSignedUrl(path, 60 * 5);

        if (error) throw error;
        return data?.signedUrl || null;
    },

    // Obtener los detalles de un pedido de forma pública (para el tracker del cliente)
    getOrderByTrackingToken: async (trackingToken) => {
        const { data, error } = await supabase.functions.invoke('get-delivery-tracking', {
            body: { token: trackingToken }
        });

        if ((error || data?.error) && import.meta.env.DEV) {
            console.warn('[DeliveryTracking] Edge Function no disponible; usando fallback local de desarrollo.', error || data?.error);
            return getOrderByTrackingTokenDevFallback(trackingToken);
        }

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data?.order;
    },

    updatePublicDeliveryRequest: async (trackingToken, requestData) => {
        const { data, error } = await supabase.functions.invoke('update-delivery-request', {
            body: {
                token: trackingToken,
                customer_item_description: requestData.customer_item_description || '',
                payment_preference: requestData.payment_preference || ''
            }
        });

        if ((error || data?.error) && import.meta.env.DEV) {
            const updatePayload = {};
            if (requestData.customer_item_description) {
                updatePayload.customer_item_description = requestData.customer_item_description;
            }
            if (requestData.payment_preference) {
                updatePayload.payment_preference = requestData.payment_preference;
                updatePayload.payment_preference_confirmed_at = new Date().toISOString();
            }

            const { error: fallbackError } = await supabase
                .from('delivery_orders')
                .update(updatePayload)
                .eq('tracking_token', trackingToken);

            if (fallbackError) throw fallbackError;
            return { success: true };
        }

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data;
    },

    createDriverPayment: async (order, paymentData, driver) => {
        const amount = Number(paymentData.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("Ingresa un monto valido.");
        }

        if (['transferencia', 'tarjeta'].includes(paymentData.payment_method) && !paymentData.reference?.trim()) {
            throw new Error("La referencia es obligatoria para transferencia o tarjeta.");
        }

        const { data: payment, error } = await supabase
            .from('delivery_payments')
            .insert([{
                user_id: order.user_id,
                delivery_order_id: order.id,
                driver_id: driver?.id || null,
                amount,
                payment_method: paymentData.payment_method,
                reference: paymentData.reference || null,
                proof_photo_path: paymentData.proof_photo_path || null,
                status: 'driver_collected'
            }])
            .select()
            .single();

        if (error) throw error;

        const existingPayments = order.delivery_payments || [];
        const payment_status = calculatePaymentStatus(order, [...existingPayments, payment]);
        await supabase
            .from('delivery_orders')
            .update({ payment_status })
            .eq('id', order.id);

        try {
            await deliveryService.triggerNotification(order, {
                status: 'payment_received',
                payment_amount: amount,
                payment_method: paymentData.payment_method,
                payment_reference: paymentData.reference || ''
            });
        } catch (err) {
            console.warn('[DeliveryService] Pago registrado, pero no se pudo enviar comprobante:', err);
        }

        return payment;
    },

    reconcileDriverPayment: async (paymentId) => {
        const { data: payment, error } = await supabase
            .from('delivery_payments')
            .update({
                status: 'reconciled',
                reconciled_at: new Date().toISOString()
            })
            .eq('id', paymentId)
            .select()
            .single();

        if (error) throw error;

        const { data: deliveryOrder } = await supabase
            .from('delivery_orders')
            .select('id, pos_order_id, service_cost, delivery_fee, delivery_payments(amount, status)')
            .eq('id', payment.delivery_order_id)
            .maybeSingle();

        if (deliveryOrder?.pos_order_id) {
            const paid = (deliveryOrder.delivery_payments || [])
                .filter((row) => row.status !== 'voided')
                .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
            const total = (Number(deliveryOrder.service_cost) || 0) + (Number(deliveryOrder.delivery_fee) || 0);

            await supabase
                .from('orders')
                .update({
                    paid_amount: paid,
                    payment_status: total > 0 && paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending'
                })
                .eq('id', deliveryOrder.pos_order_id);
        }

        return payment;
    },

    linkDeliveryToPosOrder: async (deliveryOrderId, posOrderId) => {
        const { data: deliveryOrder, error: fetchError } = await supabase
            .from('delivery_orders')
            .select('id, service_cost, delivery_fee, delivery_payments(amount, status)')
            .eq('id', deliveryOrderId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        const paid = (deliveryOrder?.delivery_payments || [])
            .filter((row) => row.status === 'reconciled')
            .reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        const total = (Number(deliveryOrder?.service_cost) || 0) + (Number(deliveryOrder?.delivery_fee) || 0);

        const { error: updateDeliveryError } = await supabase
            .from('delivery_orders')
            .update({ pos_order_id: posOrderId })
            .eq('id', deliveryOrderId);

        if (updateDeliveryError) throw updateDeliveryError;

        if (paid > 0) {
            const { error: updateOrderError } = await supabase
                .from('orders')
                .update({
                    paid_amount: paid,
                    payment_status: total > 0 && paid >= total ? 'paid' : 'partial'
                })
                .eq('id', posOrderId);

            if (updateOrderError) throw updateOrderError;
        }

        return true;
    },

    // Overrides de produccion: las acciones criticas se ejecutan en Edge Function.
    assignDriver: async (orderId, driverId, driverName, driverPhone) => {
        const result = await runDeliveryAction('assign_driver', {
            order_id: orderId,
            driver_id: driverId
        });
        const order = result.order;
        const driver = result.driver || { name: driverName, phone: driverPhone };

        let notificationResult = null;
        try {
            notificationResult = await deliveryService.triggerNotification(order, {
                status: 'assigned',
                driver_name: driver.name || driverName,
                driver_phone: driver.phone || driverPhone
            });
        } catch (e) {
            console.error('[DeliveryService] Error al disparar notificacion:', e);
        }

        return {
            ...order,
            _notificationResult: notificationResult || { success: false, error: "No se pudo enviar la notificacion." }
        };
    },

    updateOrderStatus: async (orderId, newStatus, extraData = {}) => {
        const actionByStatus = {
            picked_up: 'mark_picked_up',
            delivered_to_store: 'deliver_to_store',
            completed: 'complete_order',
            cancelled: 'cancel_order'
        };
        const action = actionByStatus[newStatus];
        if (!action) {
            throw new Error(`Accion de delivery no soportada para estatus ${newStatus}.`);
        }

        const result = await runDeliveryAction(action, {
            order_id: orderId,
            driver_id: extraData.driver_id,
            driver_session_token: extraData.driver_session_token,
            garment_summary: extraData.garment_summary,
            pickup_evidence_path: extraData.pickup_evidence_path,
            service_cost: extraData.service_cost,
            allow_balance: extraData.allow_balance === true
        });
        const order = result.order;

        try {
            await deliveryService.triggerNotification(order, {
                status: newStatus,
                driver_name: extraData.driver_name
            });
        } catch (e) {
            console.error('[DeliveryService] Error al disparar notificacion:', e);
        }

        return order;
    },

    updatePickupQuote: async (orderId, deliveryFee, quoteNotes = '') => {
        const fee = Number(deliveryFee);
        if (!Number.isFinite(fee) || fee < 0) {
            throw new Error("Captura una tarifa de recogida valida. Puede ser $0.00 si no se cobrara delivery.");
        }

        const result = await runDeliveryAction('quote_pickup', {
            order_id: orderId,
            delivery_fee: fee,
            quote_notes: quoteNotes
        });
        const order = result.order;

        let notificationResult = null;
        try {
            notificationResult = await deliveryService.triggerNotification(order, {
                status: 'quoted'
            });
        } catch (err) {
            console.warn('[DeliveryService] Tarifa guardada, pero no se pudo notificar al cliente:', err);
        }

        return {
            ...order,
            _notificationResult: notificationResult
        };
    },

    getPickupEvidenceSignedUrl: async (order) => {
        if (!order?.id || !order?.pickup_evidence_path) return null;
        const data = await runDeliveryAction('get_pickup_evidence_url', {
            order_id: order.id
        });

        return data?.signedUrl || null;
    },

    verifyDriverPin: async (pin) => {
        const { data, error } = await supabase.functions.invoke('verify-driver-pin', {
            body: { pin }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data?.driver;
    },

    createDriverPayment: async (order, paymentData, driver) => {
        const amount = Number(paymentData.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("Ingresa un monto valido.");
        }

        if (['transferencia', 'tarjeta'].includes(paymentData.payment_method) && !paymentData.reference?.trim()) {
            throw new Error("La referencia es obligatoria para transferencia o tarjeta.");
        }

        const result = await runDeliveryAction('register_driver_payment', {
            order_id: order.id,
            driver_id: driver?.id,
            driver_session_token: driver?.session_token,
            amount,
            payment_method: paymentData.payment_method,
            reference: paymentData.reference || '',
            proof_photo_path: paymentData.proof_photo_path || null
        });
        const payment = result.payment;

        try {
            await deliveryService.triggerNotification(order, {
                status: 'payment_received',
                payment_amount: amount,
                payment_method: paymentData.payment_method,
                payment_reference: paymentData.reference || ''
            });
        } catch (err) {
            console.warn('[DeliveryService] Pago registrado, pero no se pudo enviar comprobante:', err);
        }

        return payment;
    },

    reconcileDriverPayment: async (paymentId) => {
        const result = await runDeliveryAction('reconcile_payment', {
            payment_id: paymentId
        });

        return result.payment;
    },

    // ─── RECOLECCIÓN EXPRÉS (DESDE PORTAL REPARTIDOR) ─────────────────
    
    // Crea un pedido express directamente desde el portal del repartidor
    // El chofer recolecta en campo y el pedido nace en estado 'picked_up'
    createExpressPickup: async (data) => {
        // data = { driver, customer_name, customer_phone, customer_address, 
        //          garment_summary, notes, delivery_fee, pickup_evidence_path,
        //          payment_preference, create_pos_order, folio,
        //          register_payment, payment_amount, payment_method, payment_reference }
        
        const result = await runDeliveryAction('create_express_pickup', {
            driver_id: data.driver.id,
            driver_name: data.driver.name,
            driver_session_token: data.driver.session_token,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            customer_address: data.customer_address,
            garment_summary: data.garment_summary,
            notes: data.notes || '',
            delivery_fee: data.delivery_fee || 0,
            pickup_evidence_path: data.pickup_evidence_path || null,
            payment_preference: data.payment_preference || '',
            create_pos_order: data.create_pos_order === true,
            folio: data.folio || null,
            register_payment: data.register_payment === true,
            payment_amount: data.payment_amount || 0,
            payment_method: data.payment_method || 'efectivo',
            payment_reference: data.payment_reference || ''
        });
        
        // Disparar notificación en segundo plano
        try {
            await deliveryService.triggerNotification(result.order, {
                status: 'picked_up',
                driver_name: data.driver.name
            });
        } catch (e) {
            console.warn('[DeliveryService] Notificación no enviada para express pickup:', e);
        }
        
        return result;
    },
    
    // Obtener estadísticas del día para el repartidor
    getDriverStats: async (driver) => {
        const data = await runDeliveryAction('get_driver_stats', {
            driver_id: driver.id,
            driver_session_token: driver.session_token
        });
        return data?.stats || { total_today: 0, picked_up: 0, delivered_to_store: 0, total_collected: 0 };
    },

    // ─── NOTIFICACIONES AUTOMÁTICAS E INTEGRACIÓN DE APIS ──────────────

    // Llama a la Edge Function notify-order para enviar el WhatsApp/SMS transaccional
    triggerNotification: async (order, extraParams = {}) => {
        // Cargar la configuración de mensajería del perfil de la sucursal (tenant)
        const { data: profile } = await supabase
            .from('profiles')
            .select('store_name, whatsapp_gateway_type, whatsapp_session_token')
            .eq('id', order.user_id)
            .single();

        const payload = {
            user_id: order.user_id,
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            customer_address: order.customer_address,
            notes: order.notes,
            order_id: order.id,
            driver_name: extraParams.driver_name || '',
            driver_phone: extraParams.driver_phone || '',
            status: extraParams.status || order.status,
            tracking_token: order.tracking_token,
            service_cost: order.service_cost,
            delivery_fee: order.delivery_fee,
            quote_notes: order.quote_notes,
            payment_amount: extraParams.payment_amount,
            payment_method: extraParams.payment_method,
            payment_reference: extraParams.payment_reference,
            whatsapp_gateway_type: profile?.whatsapp_gateway_type || 'central_saas',
            whatsapp_session_token: profile?.whatsapp_session_token || null,
            store_name: profile?.store_name || 'FoxSolid Laundry'
        };

        // Invocación oficial de la Edge Function en Supabase
        const { data, error } = await supabase.functions.invoke('notify-order', {
            body: payload
        });

        if (error) {
            console.error('[DeliveryService] Error llamando a la Edge Function:', error);
            return { success: false, error };
        }
        return data;
    },

    // Probar conexión con el gateway de WhatsApp configurado
    testWhatsAppConnection: async (gatewayType, sessionToken, instanceName) => {
        const { data, error } = await supabase.functions.invoke('test-whatsapp-connection', {
            body: {
                gateway_type: gatewayType,
                session_token: sessionToken,
                instance_name: instanceName || undefined
            }
        });
        if (error) throw error;
        return data;
    },

    // Conciliar todos los pagos pendientes de chofer
    reconcileAllPayments: async () => {
        const result = await runDeliveryAction('reconcile_all_payments', {});
        return result;
    },

    // --- Pickup Zones ---

    getPickupZones: async (storeId) => {
        const { data, error } = await supabase
            .from('pickup_zones')
            .select('*')
            .eq('user_id', storeId)
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    savePickupZone: async (zoneData) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No autenticado");
        
        const payload = {
            ...zoneData,
            user_id: user.id
        };

        if (payload.id) {
            const { data, error } = await supabase
                .from('pickup_zones')
                .update(payload)
                .eq('id', payload.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            const { data, error } = await supabase
                .from('pickup_zones')
                .insert([payload])
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    deletePickupZone: async (id) => {
        const { error } = await supabase
            .from('pickup_zones')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return true;
    }
};
