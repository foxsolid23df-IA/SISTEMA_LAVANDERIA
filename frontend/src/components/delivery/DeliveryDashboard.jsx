import React, { useEffect, useState, useMemo } from "react";
import { DELIVERY_PAYMENT_METHODS, DELIVERY_PAYMENT_PREFERENCES, deliveryService } from "../../services/deliveryService";
import { priceListService } from "../../services/priceListService";
import { staffService } from "../../services/staffService";
import { supabase } from "../../supabase";
import { FiTruck, FiClock, FiCheck, FiX, FiSettings, FiUser, FiMapPin, FiMessageSquare, FiDollarSign, FiPlus, FiTrash2, FiEdit3 } from "react-icons/fi";
import Swal from "sweetalert2";
import "./DeliveryDashboard.css";

const DELIVERY_DRIVER_ROLES = ["repartidor", "chofer"];

const isDeliveryDriver = (staffMember) =>
    staffMember?.active && DELIVERY_DRIVER_ROLES.includes(staffMember.role?.toLowerCase());

const getErrorMessage = (error) =>
    error?.message || error?.details || error?.hint || JSON.stringify(error);

const getPaymentSummary = (order) => {
    const payments = (order.delivery_payments || []).filter(payment => payment.status !== "voided");
    const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const pendingDriver = payments
        .filter(payment => payment.status === "driver_collected")
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const reconciled = payments
        .filter(payment => payment.status === "reconciled")
        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
    const total = (Number(order.service_cost) || 0) + (Number(order.delivery_fee) || 0);

    return {
        paid,
        pendingDriver,
        reconciled,
        balance: Math.max(0, total - paid),
        payments
    };
};

const hasPickupQuote = (order) => Boolean(order?.pickup_quote_confirmed_at || order?.auto_quoted);

const formatPickupQuote = (order) => {
    if (!hasPickupQuote(order)) return "Pendiente de cotizar";
    const total = Number(order.service_cost || 0) + Number(order.delivery_fee || 0);
    if (total === 0) return "$0.00 MXN (Gratis)";
    const parts = [];
    if (Number(order.service_cost || 0) > 0) parts.push(`Servicio: $${Number(order.service_cost).toFixed(2)}`);
    if (Number(order.delivery_fee || 0) > 0) parts.push(`Delivery: $${Number(order.delivery_fee).toFixed(2)}`);
    return `$${total.toFixed(2)} MXN${parts.length > 0 ? ` (${parts.join(" + ")})` : ""}`;
};

const escapeHtml = (value = "") =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

const playNewOrderSound = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    try {
        const ctx = new AudioContext();
        const playTone = (startTime, frequency) => {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.type = "sine";
            oscillator.frequency.setValueAtTime(frequency, startTime);
            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.24);
        };

        const now = ctx.currentTime;
        playTone(now, 880);
        playTone(now + 0.28, 1175);
    } catch (err) {
        console.warn("[Delivery] No se pudo reproducir alerta sonora:", err);
    }
};

export const DeliveryDashboard = () => {
    const [orders, setOrders] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showPriceListModal, setShowPriceListModal] = useState(false);

    // Variables de configuración de la tienda
    const [gatewayType, setGatewayType] = useState("central_saas");
    const [sessionToken, setSessionToken] = useState("");
    const [chatbotEnabled, setChatbotEnabled] = useState(false);
    const [autoReplies, setAutoReplies] = useState({});
    const [connectionStatus, setConnectionStatus] = useState(null);
    const [testingConnection, setTestingConnection] = useState(false);

    // Variables de lista de precios
    const [priceCategories, setPriceCategories] = useState([]);
    const [priceItems, setPriceItems] = useState([]);
    const [deliverySettings, setDeliverySettings] = useState({ min_free_delivery: 250, small_order_fee: 35, auto_reminder_enabled: true, reminder_minutes: 30 });
    const [newCategoryName, setNewCategoryName] = useState("");
    const [savingPriceList, setSavingPriceList] = useState(false);
    const [priceListImageUrl, setPriceListImageUrl] = useState(null);
    const [priceListImageFile, setPriceListImageFile] = useState(null);

    // Variables de Zonas de Recogida
    const [showZonesModal, setShowZonesModal] = useState(false);
    const [pickupZones, setPickupZones] = useState([]);
    const [newZoneName, setNewZoneName] = useState("");
    const [savingZones, setSavingZones] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            
            // 1. Cargar pedidos
            const ordersData = await deliveryService.getStoreOrders();
            setOrders(ordersData);

            // 2. Cargar empleados (staff) y filtrar solo repartidores activos
            const staffList = await staffService.getStaff();
            const activeDrivers = staffList.filter(isDeliveryDriver);
            setDrivers(activeDrivers);

            // 3. Cargar perfil de la tienda
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: storeProfile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                
                if (storeProfile) {
                    setProfile(storeProfile);
                    setGatewayType(storeProfile.whatsapp_gateway_type || "central_saas");
                    setSessionToken(storeProfile.whatsapp_session_token || "");
                    setChatbotEnabled(storeProfile.whatsapp_chatbot_enabled === true);
                    setAutoReplies(storeProfile.whatsapp_auto_replies || {});

                    // 4. Cargar lista de precios
                    try {
                        const priceData = await priceListService.getPriceList(user.id);
                        setPriceCategories(priceData.categories);
                        setPriceItems(priceData.items);
                        if (priceData.settings) {
                            setDeliverySettings({
                                min_free_delivery: priceData.settings.min_free_delivery || 250,
                                small_order_fee: priceData.settings.small_order_fee || 35,
                                auto_reminder_enabled: priceData.settings.auto_reminder_enabled !== false,
                                reminder_minutes: priceData.settings.reminder_minutes || 30,
                            });
                            setPriceListImageUrl(priceData.settings.price_list_image_url || null);
                        }
                    } catch (plErr) {
                        console.error("Error cargando lista de precios:", plErr);
                    }

                    // 5. Cargar Zonas de Recogida
                    try {
                        const zonesData = await deliveryService.getPickupZones(user.id);
                        setPickupZones(zonesData);
                    } catch (zonesErr) {
                        console.error("Error cargando zonas de recogida:", zonesErr);
                    }
                }
            }

        } catch (err) {
            console.error("Error cargando datos de delivery:", err);
            Swal.fire("Error", "No se pudieron cargar los datos de delivery.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        // Suscribirse a cambios en tiempo real en la tabla delivery_orders
        const channel = supabase
            .channel('delivery-dashboard-realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'delivery_orders' },
                (payload) => {
                    console.log("[Realtime] Cambio detectado, recargando panel...", payload);
                    if (payload.eventType === 'INSERT' && payload.new?.status === 'requested') {
                        playNewOrderSound();
                        Swal.fire({
                            title: "Nueva recogida",
                            text: `${payload.new.customer_name || "Cliente"} solicito recoger ropa a domicilio.`,
                            icon: "info",
                            toast: true,
                            position: "top-end",
                            timer: undefined,
                            showConfirmButton: true,
                            confirmButtonText: "Cerrar",
                            showCloseButton: true,
                            timerProgressBar: false
                        });
                    }
                    if (payload.eventType === 'INSERT' && (payload.new?.status === 'picked_up' || payload.new?.status === 'delivered_to_store') && !payload.new?.accepted_at) {
                        playNewOrderSound();
                        Swal.fire({
                            title: "Recoleccion express",
                            text: `${payload.new.customer_name || "Cliente"} - Recoleccion directa del repartidor.`,
                            icon: "info",
                            toast: true,
                            position: "top-end",
                            timer: 5000,
                            showConfirmButton: false,
                            showCloseButton: true,
                            timerProgressBar: false
                        });
                    }
                    loadData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Aceptar una solicitud y asignar un repartidor
    const handleAcceptOrder = async (orderId) => {
        const order = orders.find(o => o.id === orderId);

        if (order && order._isCurrentStore === false) {
            Swal.fire({
                title: "Pedido de otra tienda",
                html: `
                    <p>Este pedido fue creado con un store_id distinto al negocio actual.</p>
                    <div style="text-align:left; margin-top: 0.75rem; font-size: 0.85rem;">
                        <strong>ID sesiÃ³n actual:</strong><br>
                        <code>${order._currentStoreId || "No disponible"}</code><br><br>
                        <strong>user_id del pedido:</strong><br>
                        <code>${order.user_id || "No disponible"}</code>
                    </div>
                    <p style="margin-top: 0.75rem;">Verifica que estÃ©s logueado en la cuenta correcta o que Evolution estÃ© usando el webhook actualizado.</p>
                `,
                icon: "warning",
                confirmButtonColor: "#0f172a"
            });
            return;
        }

        if (drivers.length === 0) {
            Swal.fire({
                title: "Sin Repartidores Disponibles",
                text: "No tienes empleados registrados con el rol de 'repartidor' o no están activos. Ve a Usuarios para crear uno primero.",
                icon: "warning",
                confirmButtonColor: "#0f172a"
            });
            return;
        }

        if (order && !hasPickupQuote(order)) {
            Swal.fire({
                title: "Falta tarifa de recogida",
                text: "Captura la tarifa que vera la clienta antes de asignar el repartidor. Puede ser $0.00 si no se cobrara delivery.",
                icon: "warning",
                confirmButtonColor: "#0f172a"
            });
            return;
        }

        if (order && !order.payment_preference_confirmed_at) {
            Swal.fire({
                title: "Falta preferencia de pago",
                text: "Antes de asignar chofer, la clienta debe confirmar en el link si pagara al chofer, al recibir la ropa lista o en sucursal.",
                icon: "warning",
                confirmButtonColor: "#0f172a"
            });
            return;
        }

        // Crear opciones de selección de repartidores para el modal
        const driverOptions = {};
        drivers.forEach(d => {
            driverOptions[d.id] = d.name;
        });

        const { value: selectedDriverId } = await Swal.fire({
            title: "Aceptar Pedido y Asignar Repartidor",
            text: "Selecciona el repartidor que realizará la recogida:",
            input: "select",
            inputOptions: driverOptions,
            inputPlaceholder: "Seleccionar repartidor...",
            showCancelButton: true,
            confirmButtonText: "Asignar y Aceptar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#0f172a",
            inputValidator: (value) => {
                if (!value) {
                    return "¡Debes seleccionar un repartidor!";
                }
            }
        });

        if (selectedDriverId) {
            try {
                const selectedDriver = drivers.find(d => d.id.toString() === selectedDriverId.toString());
                if (!selectedDriver.phone?.trim()) {
                    Swal.fire("Telefono requerido", "Completa el telefono del repartidor en Usuarios antes de asignarle pedidos.", "warning");
                    return;
                }

                const assignedOrder = await deliveryService.assignDriver(orderId, selectedDriverId, selectedDriver.name, selectedDriver.phone);
                const notificationResult = assignedOrder._notificationResult;
                const driverNotification = notificationResult?.driver;
                console.log("[Delivery] Resultado de notificaciones:", notificationResult);

                if (driverNotification?.success === false) {
                    Swal.fire({
                        title: "Pedido asignado",
                        text: `Pedido asignado, pero no se pudo confirmar WhatsApp al repartidor. ${driverNotification.error || ""}`,
                        icon: "warning",
                        confirmButtonColor: "#0f172a"
                    });
                } else {
                    Swal.fire({
                        title: "Pedido Asignado",
                        text: `El pedido ha sido asignado a ${selectedDriver.name} y se ha enviado la alerta automatizada.`,
                        icon: "success",
                        timer: 2000,
                        showConfirmButton: false
                    });
                }
                loadData();
            } catch (err) {
                console.error("Error al asignar repartidor:", err);
                Swal.fire("Error", `No se pudo asignar el repartidor. ${getErrorMessage(err)}`, "error");
            }
        }
    };

    // Rechazar/Cancelar pedido
    const handleRejectOrder = async (orderId) => {
        const result = await Swal.fire({
            title: "¿Rechazar solicitud?",
            text: "Esta acción cancelará la solicitud del cliente de forma permanente.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, rechazar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#ef4444"
        });

        if (result.isConfirmed) {
            try {
                await deliveryService.updateOrderStatus(orderId, "cancelled");
                Swal.fire("Cancelado", "La solicitud ha sido cancelada.", "success");
                loadData();
            } catch (err) {
                console.error("Error al cancelar pedido:", err);
                Swal.fire("Error", "No se pudo cancelar el pedido.", "error");
            }
        }
    };

    const handleQuotePickup = async (order) => {
        const itemDescription = order.customer_item_description || order.garment_summary || "";
        const { value: quoteValues } = await Swal.fire({
            title: "Definir tarifa de recogida",
            html: `
                <div style="text-align:left">
                    <p style="font-size:13px; color:#64748b; margin-bottom:10px;">
                        Esta tarifa sera visible para la clienta antes de confirmar como desea pagar.
                        El costo del servicio se calculara despues en sucursal.
                    </p>
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <strong style="display:block; font-size:12px; color:#0f172a; margin-bottom:4px;">Que va a recoger el repartidor</strong>
                        <span style="font-size:13px; color:#334155;">${itemDescription ? escapeHtml(itemDescription) : "La clienta aun no describio las prendas."}</span>
                    </div>
                    <label style="font-weight:700; font-size:12px;">Tarifa de recogida / delivery</label>
                    <input id="pickup-quote-fee" type="number" min="0" step="0.01" class="swal2-input" value="${Number(order.delivery_fee || 0)}" placeholder="0.00" style="width:85%; margin-top:4px;">
                    <label style="font-weight:700; font-size:12px; display:block; margin-top:12px;">Nota para la clienta (opcional)</label>
                    <textarea id="pickup-quote-notes" class="swal2-textarea" placeholder="Ej. No se cobrara delivery por promocion, o tarifa aplica dentro de zona..." style="width:85%; min-height:76px;">${escapeHtml(order.quote_notes || "")}</textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Guardar y avisar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#0f172a",
            preConfirm: () => {
                const value = document.getElementById("pickup-quote-fee").value;
                const amount = Number(value);
                if (value === "" || !Number.isFinite(amount) || amount < 0) {
                    Swal.showValidationMessage("Captura una tarifa valida. Puede ser 0.00 si no se cobrara delivery.");
                    return false;
                }
                return {
                    fee: amount,
                    quoteNotes: document.getElementById("pickup-quote-notes").value
                };
            }
        });

        if (!quoteValues) return;

        try {
            const updatedOrder = await deliveryService.updatePickupQuote(order.id, quoteValues.fee, quoteValues.quoteNotes);
            if (updatedOrder._notificationResult?.customer?.success === false || updatedOrder._notificationResult?.success === false) {
                Swal.fire("Tarifa guardada", "La tarifa se guardo, pero no se pudo confirmar el envio del WhatsApp al cliente. El link de tracking ya muestra el costo.", "warning");
            } else {
                Swal.fire("Tarifa enviada", "La clienta ya puede verla y confirmar su preferencia de pago.", "success");
            }
            loadData();
        } catch (err) {
            console.error("Error guardando tarifa de recogida:", err);
            Swal.fire("Error", err.message || "No se pudo guardar la tarifa.", "error");
        }
    };

    // Registrar costo y completar pedido una vez traído a sucursal
    const handleProcessInStore = async (order) => {
        const isAutoQuoted = order.auto_quoted && Number(order.service_cost) > 0;
        const { value: formValues } = await Swal.fire({
            title: "Procesar Ropa en Sucursal",
            html: `
                <div style="text-align: left; font-family: sans-serif;">
                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <strong style="display:block; font-size:12px; color:#0f172a; margin-bottom:4px;">Solicitud de la clienta</strong>
                        <span style="font-size:13px; color:#334155;">${escapeHtml(order.customer_item_description || "Sin descripcion capturada por la clienta.")}</span>
                    </div>
                    <div style="background:#ecfeff; border:1px solid #a5f3fc; border-radius:8px; padding:10px; margin-bottom:12px;">
                        <strong style="display:block; font-size:12px; color:#155e75; margin-bottom:4px;">Tarifa de recogida / delivery ya cotizada</strong>
                        <span style="font-size:15px; font-weight:800; color:#0f172a;">${formatPickupQuote(order)}</span>
                        <p style="font-size:12px; color:#475569; margin:6px 0 0;">Este importe es independiente del costo del servicio de lavanderia.</p>
                    </div>
                    <label style="font-weight: bold; display: block; margin-bottom: 0.25rem;">Resumen de Prendas:</label>
                    <input id="swal-garments" class="swal2-input" style="width: 85%; margin-top:0;" value="${escapeHtml(order.garment_summary || '')}" placeholder="Ej. 5 camisas, 3 pantalones">
                    
                    <label style="font-weight: bold; display: block; margin-top: 1rem; margin-bottom: 0.25rem;">Costo del servicio de lavanderia ($):</label>
                    ${isAutoQuoted ? `<p style="font-size:11px; color:#16a34a; margin:0 0 4px;">Cotización automática del chatbot</p>` : ''}
                    <input id="swal-cost" type="number" step="0.01" class="swal2-input" style="width: 85%; margin-top:0;" value="${order.service_cost || 0}" placeholder="0.00">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: "Guardar y Notificar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#0f172a",
            preConfirm: () => {
                const serviceCost = document.getElementById("swal-cost").value;
                const parsedServiceCost = Number(serviceCost);
                if (serviceCost === "" || !Number.isFinite(parsedServiceCost) || parsedServiceCost < 0) {
                    Swal.showValidationMessage("Captura un costo de servicio valido. Puede ser 0.00 si aun no hay cargo.");
                    return false;
                }
                return {
                    garment_summary: document.getElementById("swal-garments").value,
                    service_cost: parsedServiceCost
                };
            }
        });

        if (formValues) {
            try {
                await deliveryService.updateOrderStatus(order.id, "delivered_to_store", formValues);
                Swal.fire("Actualizado", "Estatus actualizado a 'En Sucursal' y notificado al cliente.", "success");
                loadData();
            } catch (err) {
                console.error("Error al actualizar prendas en tienda:", err);
                Swal.fire("Error", "No se pudo actualizar el registro.", "error");
            }
        }
    };

    // Guardar configuración de pasarela en profiles
    const handleSaveConfig = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No authenticated user");

            const { error } = await supabase
                .from('profiles')
                .update({
                    whatsapp_gateway_type: gatewayType,
                    whatsapp_session_token: gatewayType === "qr_linked" ? sessionToken : null,
                    whatsapp_chatbot_enabled: chatbotEnabled,
                    whatsapp_auto_replies: autoReplies
                })
                .eq('id', user.id);

            if (error) throw error;

            Swal.fire("Guardado", "La configuración de mensajería se actualizó correctamente.", "success");
            setShowConfigModal(false);
            loadData();
        } catch (err) {
            console.error("Error guardando config de pasarela:", err);
            Swal.fire("Error", "No se pudo guardar la configuración.", "error");
        }
    };

    const handleTestConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus(null);
        try {
            const { data, error } = await supabase.functions.invoke('test-whatsapp-connection', {
                body: {
                    gateway_type: gatewayType,
                    session_token: sessionToken,
                    instance_name: undefined
                }
            });
            if (error) throw error;
            setConnectionStatus(data);
        } catch (err) {
            console.error("Error probando conexión:", err);
            setConnectionStatus({ success: false, connected: false, error: err.message || "Error al probar conexión" });
        } finally {
            setTestingConnection(false);
        }
    };

    const handleAutoReplyChange = (key, value) => {
        setAutoReplies(prev => ({ ...prev, [key]: value }));
    };

    const handleReconcilePayment = async (payment) => {
        const result = await Swal.fire({
            title: "Conciliar pago del chofer",
            text: `Confirmas que sucursal recibio $${Number(payment.amount).toFixed(2)} MXN por ${DELIVERY_PAYMENT_METHODS[payment.payment_method] || payment.payment_method}?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Si, conciliar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#10b981"
        });

        if (!result.isConfirmed) return;

        try {
            await deliveryService.reconcileDriverPayment(payment.id);
            Swal.fire("Conciliado", "El pago quedo confirmado por sucursal.", "success");
            loadData();
        } catch (err) {
            console.error("Error conciliando pago:", err);
            Swal.fire("Error", "No se pudo conciliar el pago.", "error");
        }
    };

    const handleViewPickupEvidence = async (order) => {
        if (!order.pickup_evidence_path) return;

        try {
            const signedUrl = await deliveryService.getPickupEvidenceSignedUrl(order);
            if (!signedUrl) throw new Error("No se pudo generar el enlace de evidencia.");

            Swal.fire({
                title: "Evidencia de recogida",
                imageUrl: signedUrl,
                imageAlt: "Foto tomada por el repartidor al recoger",
                showCloseButton: true,
                confirmButtonText: "Cerrar",
                confirmButtonColor: "#0f172a",
                width: 720
            });
        } catch (err) {
            console.error("Error abriendo evidencia de recogida:", err);
            Swal.fire("Error", err.message || "No se pudo abrir la evidencia.", "error");
        }
    };

    // Integración con Caja POS
    const handleLoadInCart = (order) => {
        // Redirigir a ventas y almacenar datos en SessionStorage temporalmente
        // para que la vista de Sales pueda leerlos y precargar el carrito automáticamente
        const deliveryCartData = {
            customer_name: order.customer_name,
            customer_phone: order.customer_phone,
            delivery_fee: order.delivery_fee,
            service_cost: order.service_cost,
            notes: order.notes,
            delivery_order_id: order.id,
            garment_summary: order.garment_summary,
            customer_item_description: order.customer_item_description,
            paid_amount: getPaymentSummary(order).reconciled
        };

        sessionStorage.setItem("delivery_preload_cart", JSON.stringify(deliveryCartData));
        
        Swal.fire({
            title: "Cargando en Caja",
            text: "Redireccionando al punto de venta para procesar el cobro...",
            icon: "info",
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            window.location.hash = "/ventas"; // Navegar mediante hash router
        });
    };

    // Clasificar pedidos para las columnas Kanban
    const pendingOrders = orders.filter(o => o.status === "requested");
    const activeRouteOrders = orders.filter(o => ["picked_up"].includes(o.status));
    const inStoreOrders = orders.filter(o => o.status === "delivered_to_store");

    // Calcular pagos pendientes de conciliación
    const pendingPaymentsCount = useMemo(() => {
        let count = 0;
        for (const order of orders) {
            for (const payment of (order.delivery_payments || [])) {
                if (payment.status === "driver_collected") count++;
            }
        }
        return count;
    }, [orders]);

    // Helper: agregar categoría
    const handleAddCategory = () => {
        if (!newCategoryName.trim()) return;
        const newCat = {
            id: `new_${Date.now()}`,
            name: newCategoryName.trim(),
            sort_order: priceCategories.length,
            _isNew: true,
        };
        setPriceCategories([...priceCategories, newCat]);
        setNewCategoryName("");
    };

    // Helper: eliminar categoría
    const handleDeleteCategory = (catId) => {
        setPriceCategories(priceCategories.filter(c => c.id !== catId));
        setPriceItems(priceItems.filter(i => i.category_id !== catId));
    };

    // Helper: agregar prenda a categoría
    const handleAddItem = (categoryId) => {
        const newItem = {
            id: `new_${Date.now()}`,
            category_id: categoryId,
            user_id: profile?.id,
            name: "",
            price: 0,
            unit: "pieza",
            sort_order: priceItems.filter(i => i.category_id === categoryId).length,
            active: true,
            _isNew: true,
        };
        setPriceItems([...priceItems, newItem]);
    };

    // Helper: actualizar prenda
    const handleUpdateItem = (itemId, field, value) => {
        setPriceItems(priceItems.map(i =>
            i.id === itemId ? { ...i, [field]: value } : i
        ));
    };

    // Helper: eliminar prenda
    const handleDeleteItem = (itemId) => {
        setPriceItems(priceItems.filter(i => i.id !== itemId));
    };

    // Guardar lista de precios
    const handleSavePriceList = async () => {
        try {
            setSavingPriceList(true);
            const storeId = profile?.id;
            if (!storeId) return;

            // Save categories
            const catsToSave = priceCategories.map((c, idx) => ({
                id: c._isNew ? undefined : c.id,
                name: c.name,
                sort_order: idx,
            }));
            await priceListService.saveCategories(storeId, catsToSave);

            // Reload categories to get IDs
            const freshData = await priceListService.getPriceList(storeId);
            setPriceCategories(freshData.categories);

            // Map old IDs to new IDs for items
            const itemsToSave = priceItems
                .filter(i => i.name.trim())
                .map(i => {
                    const catIndex = priceCategories.findIndex(c => c.id === i.category_id);
                    const newCat = freshData.categories[catIndex];
                    return {
                        id: i._isNew ? undefined : i.id,
                        user_id: storeId,
                        category_id: newCat?.id || i.category_id,
                        name: i.name,
                        price: Number(i.price) || 0,
                        unit: i.unit || "pieza",
                        sort_order: i.sort_order || 0,
                        active: i.active !== false,
                    };
                });
            await priceListService.saveItems(itemsToSave);

            // Upload image if a new file was selected
            let imageUrl = priceListImageUrl;
            if (priceListImageFile) {
                const ext = priceListImageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
                const filePath = `${storeId}/price-list.${ext}`;
                const { error: uploadError } = await supabase.storage
                    .from('price-list-images')
                    .upload(filePath, priceListImageFile, {
                        cacheControl: '3600',
                        contentType: priceListImageFile.type || 'image/jpeg',
                        upsert: true,
                    });
                if (uploadError) throw uploadError;
                const { data: urlData } = supabase.storage
                    .from('price-list-images')
                    .getPublicUrl(filePath);
                imageUrl = urlData.publicUrl;
                setPriceListImageUrl(imageUrl);
                setPriceListImageFile(null);
            } else if (priceListImageUrl === null && !priceListImageFile) {
                imageUrl = null;
            }

            // Save delivery settings with image URL
            await priceListService.saveDeliverySettings(storeId, {
                ...deliverySettings,
                price_list_image_url: imageUrl || null,
            });

            // Reload
            const finalData = await priceListService.getPriceList(storeId);
            setPriceCategories(finalData.categories);
            setPriceItems(finalData.items);

            Swal.fire("Guardado", "Lista de precios actualizada correctamente.", "success");
        } catch (err) {
            console.error("Error guardando lista de precios:", err);
            Swal.fire("Error", "No se pudo guardar la lista de precios.", "error");
        } finally {
            setSavingPriceList(false);
        }
    };

    // Conciliar todos los pagos
    const handleReconcileAll = async () => {
        const result = await Swal.fire({
            title: "Conciliar todos los pagos",
            html: `¿Confirmas que la sucursal recibió <strong>${pendingPaymentsCount} pago(s)</strong> pendiente(s) del chofer?`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#19956b",
            confirmButtonText: "Sí, conciliar todo",
            cancelButtonText: "Cancelar",
        });
        if (!result.isConfirmed) return;

        try {
            await deliveryService.reconcileAllPayments();
            Swal.fire("Conciliado", "Todos los pagos han sido conciliados.", "success");
            loadData();
        } catch (err) {
            console.error("Error conciliando pagos:", err);
            Swal.fire("Error", "No se pudieron conciliar los pagos.", "error");
        }
    };

    // Subir imagen de lista de precios
    const handleUploadPriceListImage = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
            Swal.fire("Formato inválido", "Solo se permiten archivos JPG o PNG.", "error");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            Swal.fire("Archivo muy grande", "El tamaño máximo es 5 MB.", "error");
            return;
        }
        setPriceListImageFile(file);
        setPriceListImageUrl(URL.createObjectURL(file));
    };

    // Eliminar imagen de lista de precios
    const handleRemovePriceListImage = () => {
        setPriceListImageFile(null);
        setPriceListImageUrl(null);
    };

    // Agregar zona de recogida
    const handleAddZone = async () => {
        if (!newZoneName.trim()) return;
        try {
            setSavingZones(true);
            const newZone = await deliveryService.savePickupZone({
                zone_name: newZoneName.trim(),
                is_active: true,
                sort_order: pickupZones.length,
                keywords: [],
                pickup_days: [],
                is_default: false
            });
            setPickupZones([...pickupZones, newZone]);
            setNewZoneName("");
        } catch (err) {
            console.error("Error agregando zona:", err);
            Swal.fire("Error", "No se pudo agregar la zona.", "error");
        } finally {
            setSavingZones(false);
        }
    };

    // Actualizar campo de zona
    const handleUpdateZone = (zoneId, field, value) => {
        setPickupZones(zones => zones.map(z => z.id === zoneId ? { ...z, [field]: value } : z));
    };

    const handleTogglePickupDay = (zoneId, dayIndex) => {
        setPickupZones(zones => zones.map(z => {
            if (z.id !== zoneId) return z;
            const days = z.pickup_days || [];
            const newDays = days.includes(dayIndex) 
                ? days.filter(d => d !== dayIndex) 
                : [...days, dayIndex].sort();
            return { ...z, pickup_days: newDays };
        }));
    };

    // Eliminar zona
    const handleDeleteZone = async (zoneId) => {
        const result = await Swal.fire({
            title: "¿Eliminar zona?",
            text: "Se eliminará esta zona de recogida.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#ef4444",
            confirmButtonText: "Sí, eliminar"
        });
        if (!result.isConfirmed) return;

        try {
            await deliveryService.deletePickupZone(zoneId);
            setPickupZones(zones => zones.filter(z => z.id !== zoneId));
        } catch (err) {
            console.error("Error eliminando zona:", err);
            Swal.fire("Error", "No se pudo eliminar la zona.", "error");
        }
    };

    // Guardar zonas
    const handleSaveZones = async () => {
        try {
            setSavingZones(true);
            for (const zone of pickupZones) {
                // Ensure keywords is array
                let parsedKeywords = zone.keywords;
                if (typeof parsedKeywords === 'string') {
                    parsedKeywords = parsedKeywords.split(',').map(k => k.trim()).filter(k => k);
                }
                
                await deliveryService.savePickupZone({
                    id: zone.id,
                    zone_name: zone.zone_name,
                    keywords: parsedKeywords,
                    pickup_days: zone.pickup_days,
                    is_default: zone.is_default,
                    is_active: zone.is_active,
                    sort_order: zone.sort_order
                });
            }
            Swal.fire("Guardado", "Zonas de recogida actualizadas correctamente.", "success");
            setShowZonesModal(false);
        } catch (err) {
            console.error("Error guardando zonas:", err);
            Swal.fire("Error", "No se pudieron guardar las zonas.", "error");
        } finally {
            setSavingZones(false);
        }
    };

    if (loading) {
        return (
            <div className="delivery-loader">
                <div className="spinner"></div>
                <p>Cargando panel de delivery...</p>
            </div>
        );
    }

    const renderScheduledBadge = (order) => {
        if (!order.scheduled_pickup_date) return null;
        
        // Obtenemos la fecha de hoy en formato YYYY-MM-DD en la zona horaria local
        const today = new Date();
        const todayIso = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        const isPastDue = order.scheduled_pickup_date < todayIso;
        return (
            <span style={{ 
                background: isPastDue ? '#fee2e2' : '#e0e7ff', 
                color: isPastDue ? '#991b1b' : '#3730a3', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontSize: '10px', 
                fontWeight: 'bold',
                marginLeft: '8px'
            }}>
                {isPastDue ? '⚠️ Atrasado' : '📅 Agendado'} {order.scheduled_pickup_date}
            </span>
        );
    };

    return (
        <div className="delivery-dashboard-container">
            
            {/* Header del Dashboard */}
            <header className="delivery-dash-header">
                <div>
                    <h1>Módulo de Delivery</h1>
                    <p className="text-slate-500 text-sm">Administra y despacha recogidas de prendas de lavandería en vivo.</p>
                </div>
                
                <div className="flex gap-2">
                    <button className="btn-secondary flex items-center gap-2" onClick={() => setShowZonesModal(true)}>
                        <FiMapPin /> Zonas de Recogida
                    </button>
                    <button className="btn-secondary flex items-center gap-2" onClick={() => setShowPriceListModal(true)}>
                        <FiDollarSign /> Lista de Precios
                    </button>
                    <button className="btn-secondary flex items-center gap-2" onClick={() => setShowConfigModal(true)}>
                        <FiSettings /> Mensajería
                    </button>
                    {pendingPaymentsCount > 0 && (
                        <button className="btn-primary flex items-center gap-2" onClick={handleReconcileAll} style={{ background: "#19956b" }}>
                            Conciliar todo ({pendingPaymentsCount})
                        </button>
                    )}
                    <button className="btn-primary flex items-center gap-2" onClick={loadData}>
                        Recargar
                    </button>
                </div>
            </header>

            {/* Kanban Columns */}
            <div className="kanban-grid">
                
                {/* 1. Pendientes de Aceptar */}
                <div className="kanban-column column-pending">
                    <div className="column-header">
                        <span className="badge-count bg-amber-500">{pendingOrders.length}</span>
                        <h2>Pendientes de Recogida</h2>
                    </div>
                    
                    <div className="column-body">
                        {pendingOrders.length === 0 ? (
                            <div className="empty-column-state">
                                <FiClock size={20} />
                                <p>Sin solicitudes pendientes</p>
                            </div>
                        ) : (
                            <div className="orders-grid">
                                {pendingOrders.map(order => (
                                    <div key={order.id} className="order-kanban-card">
                                        <div className="card-top">
                                            <span className="card-id">#ID: {order.id} {renderScheduledBadge(order)}</span>
                                            <span className="card-time">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        </div>
                                        <h3>{order.customer_name}</h3>
                                        <p className="phone-row"><FiUser size={10} /> {order.customer_phone}</p>
                                        <p className="address-row"><FiMapPin size={10} /> {order.customer_address}</p>
                                        {order.notes && <p className="notes-box">"{order.notes}"</p>}
                                        {order.customer_item_description ? (
                                            <p className="notes-box"><strong>Recoger:</strong> {order.customer_item_description}</p>
                                        ) : (
                                            <p className="payment-warning-box">Sin descripcion de prendas.</p>
                                        )}
                                        {order.payment_preference ? (
                                            <p className="payment-info-box"><strong>Pago:</strong> {DELIVERY_PAYMENT_PREFERENCES[order.payment_preference]}</p>
                                        ) : (
                                            <p className="payment-warning-box">Sin preferencia de pago.</p>
                                        )}
                                        <p className={hasPickupQuote(order) ? "payment-info-box" : "payment-warning-box"}>
                                            <strong>Tarifa:</strong> {formatPickupQuote(order)}
                                        </p>
                                        <div className="card-footer">
                                            <button className="btn-action-reject" onClick={() => handleRejectOrder(order.id)} title="Rechazar">
                                                <FiX />
                                            </button>
                                            <button className="btn-action-quote" onClick={() => handleQuotePickup(order)}>
                                                Cotizar
                                            </button>
                                            <button className="btn-action-accept" onClick={() => handleAcceptOrder(order.id)}>
                                                <FiCheck /> Asignar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Recogidas en Ruta */}
                <div className="kanban-column column-route">
                    <div className="column-header">
                        <span className="badge-count bg-blue-500">{activeRouteOrders.length}</span>
                        <h2>En Ruta de Recogida</h2>
                    </div>
                    
                    <div className="column-body">
                        {activeRouteOrders.length === 0 ? (
                            <div className="empty-column-state">
                                <FiTruck size={20} />
                                <p>Sin servicios en ruta</p>
                            </div>
                        ) : (
                            <div className="orders-grid">
                                {activeRouteOrders.map(order => (
                                    <div key={order.id} className={`order-kanban-card ${!order.accepted_at && order.status === 'picked_up' ? 'card-express' : ''}`}>
                                        <div className="card-top">
                                            <span className="card-id">#ID: {order.id} {renderScheduledBadge(order)}</span>
                                            <span>
                                                {!order.accepted_at && order.status === 'picked_up' && (
                                                    <span className="express-badge">Express</span>
                                                )}
                                                <span className={`status-pill pill-${order.status}`}>
                                                    {order.status === "assigned" ? "Asignado" : order.status === "accepted" ? "Aceptado" : "Recogido"}
                                                </span>
                                            </span>
                                        </div>
                                        <h3>{order.customer_name}</h3>
                                        <p className="address-row"><FiMapPin size={10} /> {order.customer_address}</p>
                                        <div className="driver-assigned-row">
                                            <span className="material-icons-outlined" style={{fontSize: '12px'}}>directions_car</span>
                                            <span>Repartidor: <strong>{order.driver?.name || "Asignado"}</strong></span>
                                        </div>
                                        {order.customer_item_description ? (
                                            <p className="notes-box"><strong>Recoger:</strong> {order.customer_item_description}</p>
                                        ) : (
                                            <p className={`payment-warning-box ${!order.accepted_at && order.status === 'picked_up' ? 'express-order' : ''}`}>
                                                {!order.accepted_at && order.status === 'picked_up' ? 'Recoleccion express' : 'Sin detalle de prendas.'}
                                            </p>
                                        )}
                                        {order.payment_preference && (
                                            <p className="payment-info-box"><strong>Pago:</strong> {DELIVERY_PAYMENT_PREFERENCES[order.payment_preference]}</p>
                                        )}
                                        <p className={hasPickupQuote(order) ? "payment-info-box" : "payment-warning-box"}>
                                            <strong>Tarifa:</strong> {formatPickupQuote(order)}
                                        </p>
                                        {Number(order.service_cost) > 0 && (
                                            <p className="payment-info-box">
                                                <strong>Servicio:</strong> ${Number(order.service_cost).toFixed(2)} MXN
                                                {order.auto_quoted && <span style={{fontSize:'10px', color:'#16a34a', marginLeft:4}}>auto</span>}
                                            </p>
                                        )}
                                        {order.pickup_evidence_path && (
                                            <button className="btn-action-quote btn-quote-full" onClick={() => handleViewPickupEvidence(order)}>
                                                Ver evidencia
                                            </button>
                                        )}
                                        {!hasPickupQuote(order) && (
                                            <button className="btn-action-quote btn-quote-full" onClick={() => handleQuotePickup(order)}>
                                                Definir tarifa
                                            </button>
                                        )}
                                        {(() => {
                                            const summary = getPaymentSummary(order);
                                            return summary.payments.length > 0 ? (
                                                <div className="payment-list-box">
                                                    {summary.payments.map(payment => (
                                                        <div key={payment.id} className="payment-row-box">
                                                            <span>${Number(payment.amount).toFixed(2)} · {DELIVERY_PAYMENT_METHODS[payment.payment_method] || payment.payment_method}</span>
                                                            {payment.status === "driver_collected" ? (
                                                                <button onClick={() => handleReconcilePayment(payment)}>Conciliar</button>
                                                            ) : (
                                                                <strong>Conciliado</strong>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}
                                        <div className="card-footer-single">
                                            <button className="btn-action-full" onClick={() => handleProcessInStore(order)}>
                                                Recibido en Lavanderia
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Recibidos en Lavandería */}
                <div className="kanban-column column-instore">
                    <div className="column-header">
                        <span className="badge-count bg-emerald-500">{inStoreOrders.length}</span>
                        <h2>En Sucursal (Listo para Cobro)</h2>
                    </div>
                    
                    <div className="column-body">
                        {inStoreOrders.length === 0 ? (
                            <div className="empty-column-state">
                                <span className="material-icons-outlined" style={{fontSize: '20px'}}>local_laundry_service</span>
                                <p>Sin prendas en sucursal</p>
                            </div>
                        ) : (
                            <div className="orders-grid">
                                {inStoreOrders.map(order => (
                                    <div key={order.id} className="order-kanban-card card-completed">
                                        <div className="card-top">
                                            <span className="card-id">#ID: {order.id}</span>
                                            <span className="price-tag">${(Number(order.service_cost) + Number(order.delivery_fee)).toFixed(2)} MXN</span>
                                        </div>
                                        <h3>{order.customer_name}</h3>
                                        <p className="garment-summary-box">
                                            <strong>Ropa:</strong> {order.garment_summary || "Sin detalle"}
                                        </p>
                                        {order.customer_item_description && (
                                            <p className="notes-box"><strong>Solicitud:</strong> {order.customer_item_description}</p>
                                        )}
                                        <p className={hasPickupQuote(order) ? "payment-info-box" : "payment-warning-box"}>
                                            <strong>Tarifa:</strong> {formatPickupQuote(order)}
                                        </p>
                                        {order.pickup_evidence_path && (
                                            <button className="btn-action-quote btn-quote-full" onClick={() => handleViewPickupEvidence(order)}>
                                                Ver evidencia
                                            </button>
                                        )}
                                        {(() => {
                                            const summary = getPaymentSummary(order);
                                            return (
                                                <p className={summary.balance > 0 ? "payment-warning-box" : "payment-info-box"}>
                                                    <strong>Pagado:</strong> ${summary.paid.toFixed(2)} · <strong>Saldo:</strong> ${summary.balance.toFixed(2)}
                                                </p>
                                            );
                                        })()}
                                        {getPaymentSummary(order).payments.length > 0 && (
                                            <div className="payment-list-box">
                                                {getPaymentSummary(order).payments.map(payment => (
                                                    <div key={payment.id} className="payment-row-box">
                                                        <span>${Number(payment.amount).toFixed(2)} · {DELIVERY_PAYMENT_METHODS[payment.payment_method] || payment.payment_method}</span>
                                                        {payment.status === "driver_collected" ? (
                                                            <button onClick={() => handleReconcilePayment(payment)}>Conciliar</button>
                                                        ) : (
                                                            <strong>Conciliado</strong>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="card-footer-single">
                                            <button className="btn-action-charge" onClick={() => handleLoadInCart(order)}>
                                                <span className="material-icons-outlined" style={{fontSize: '14px'}}>point_of_sale</span>
                                                Cargar en Caja / Cobrar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Modal de Configuración de Mensajería */}
            {showConfigModal && (
                <div className="config-modal-backdrop">
                    <div className="config-modal-card config-modal-wide">
                        <div className="modal-header">
                            <h2>Configuración de Mensajería</h2>
                            <button className="btn-close-modal" onClick={() => setShowConfigModal(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body modal-body-scroll">

                            {/* Sección: Tipo de Conexión */}
                            <div className="config-section">
                                <label className="input-label">Tipo de Conexión WhatsApp:</label>
                                <select 
                                    className="select-input" 
                                    value={gatewayType} 
                                    onChange={(e) => { setGatewayType(e.target.value); setConnectionStatus(null); }}
                                >
                                    <option value="central_saas">WhatsApp Centralizado (Línea Oficial SaaS)</option>
                                    <option value="qr_linked">WhatsApp Vinculado por QR (Evolution API)</option>
                                    <option value="sms_only">SMS Directo Transaccional (Respaldo)</option>
                                </select>
                            </div>

                            {/* Config QR / Evolution API */}
                            {gatewayType === "qr_linked" && (
                                <div className="config-section">
                                    <label className="input-label">API Key de Evolution API:</label>
                                    <div className="input-with-button">
                                        <input 
                                            type="password" 
                                            className="text-input" 
                                            value={sessionToken} 
                                            onChange={(e) => setSessionToken(e.target.value)}
                                            placeholder="apikey de Evolution API..."
                                        />
                                        <button 
                                            className="btn-test-connection" 
                                            onClick={handleTestConnection}
                                            disabled={testingConnection || !sessionToken}
                                        >
                                            {testingConnection ? "Probando..." : "Probar"}
                                        </button>
                                    </div>
                                    <p className="input-help">API Key de tu instancia Evolution API. Escanea el QR desde el panel de Evolution para vincular tu número.</p>
                                    
                                    {connectionStatus && (
                                        <div className={`connection-status-box ${connectionStatus.connected ? 'status-ok' : 'status-error'}`}>
                                            <span className="status-dot"></span>
                                            <div>
                                                <strong>{connectionStatus.connected ? 'Conectado' : 'Desconectado'}</strong>
                                                {connectionStatus.number && <span className="status-number"> · {connectionStatus.number}</span>}
                                                {connectionStatus.error && <p className="status-error-text">{connectionStatus.error}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Info Central SaaS */}
                            {gatewayType === "central_saas" && (
                                <div className="config-section">
                                    <p className="gateway-info-box">
                                        <FiMessageSquare size={16} />
                                        Los clientes recibirán alertas desde el número verificado de <strong>FoxSolid Central</strong>. No requieres configuración adicional.
                                    </p>
                                    <button 
                                        className="btn-test-connection" 
                                        onClick={handleTestConnection}
                                        disabled={testingConnection}
                                        style={{ marginTop: '0.5rem' }}
                                    >
                                        {testingConnection ? "Probando..." : "Probar Conexión Twilio"}
                                    </button>
                                    {connectionStatus && (
                                        <div className={`connection-status-box ${connectionStatus.connected ? 'status-ok' : 'status-error'}`}>
                                            <span className="status-dot"></span>
                                            <div>
                                                <strong>{connectionStatus.connected ? 'Conectado' : 'Error'}</strong>
                                                {connectionStatus.number && <span className="status-number"> · {connectionStatus.number}</span>}
                                                {connectionStatus.error && <p className="status-error-text">{connectionStatus.error}</p>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Info SMS */}
                            {gatewayType === "sms_only" && (
                                <div className="config-section">
                                    <p className="gateway-info-box">
                                        <FiMessageSquare size={16} />
                                        Los mensajes se envían por <strong>SMS transaccional</strong> vía Twilio. Úsalo como respaldo si WhatsApp no está disponible.
                                    </p>
                                </div>
                            )}

                            <div className="config-divider"></div>

                            {/* Sección: Chatbot */}
                            <div className="config-section">
                                <div className="config-row-between">
                                    <div>
                                        <label className="input-label">Chatbot Automático</label>
                                        <p className="input-help" style={{ margin: 0 }}>Responde automáticamente con menú y opciones cuando un cliente envía mensaje.</p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input 
                                            type="checkbox" 
                                            checked={chatbotEnabled}
                                            onChange={(e) => setChatbotEnabled(e.target.checked)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                </div>
                            </div>

                            {chatbotEnabled && (
                                <div className="chatbot-config">
                                    <div className="config-section">
                                        <label className="input-label">Mensaje de Bienvenida (menú principal):</label>
                                        <textarea 
                                            className="textarea-input"
                                            value={autoReplies.welcome || ""}
                                            onChange={(e) => handleAutoReplyChange("welcome", e.target.value)}
                                            placeholder="Hola {nombre}! Bienvenido a *{tienda}*.\n\n¿Qué deseas hacer?\n\n1️⃣ Solicitar recogida de ropa\n2️⃣ Ver lista de precios\n3️⃣ Consultar mi pedido\n4️⃣ Hablar con atención al cliente"
                                            rows={5}
                                        />
                                        <p className="input-help">Variables: {'{nombre}'}, {'{tienda}'}, {'{telefono}'}</p>
                                    </div>

                                    <div className="config-columns-2">
                                        <div className="config-section">
                                            <label className="input-label">Opción 1 - Recogida:</label>
                                            <textarea 
                                                className="textarea-input"
                                                value={autoReplies.menu_pickup || ""}
                                                onChange={(e) => handleAutoReplyChange("menu_pickup", e.target.value)}
                                                placeholder="Perfecto. Envía tu dirección..."
                                                rows={3}
                                            />
                                        </div>
                                        <div className="config-section">
                                            <label className="input-label">Opción 3 - Tracking:</label>
                                            <textarea 
                                                className="textarea-input"
                                                value={autoReplies.menu_tracking || ""}
                                                onChange={(e) => handleAutoReplyChange("menu_tracking", e.target.value)}
                                                placeholder="Envía tu folio o link..."
                                                rows={3}
                                            />
                                        </div>
                                    </div>

                                    <div className="config-columns-2">
                                        <div className="config-section">
                                            <label className="input-label">Opción 4 - Agente:</label>
                                            <textarea 
                                                className="textarea-input"
                                                value={autoReplies.menu_agent || ""}
                                                onChange={(e) => handleAutoReplyChange("menu_agent", e.target.value)}
                                                placeholder="Un momento, te comunicamos..."
                                                rows={2}
                                            />
                                        </div>
                                        <div className="config-section">
                                            <label className="input-label">Sin dirección detectada:</label>
                                            <textarea 
                                                className="textarea-input"
                                                value={autoReplies.no_address || ""}
                                                onChange={(e) => handleAutoReplyChange("no_address", e.target.value)}
                                                placeholder="Necesitamos tu dirección..."
                                                rows={2}
                                            />
                                        </div>
                                    </div>

                                    <div className="config-section">
                                        <label className="input-label">Confirmación de Orden Creada:</label>
                                        <textarea 
                                            className="textarea-input"
                                            value={autoReplies.order_confirmed || ""}
                                            onChange={(e) => handleAutoReplyChange("order_confirmed", e.target.value)}
                                            placeholder="¡Gracias! Hemos recibido tu solicitud..."
                                            rows={3}
                                        />
                                        <p className="input-help">Variables adicionales: {'{direccion}'}, {'{tracking_url}'}, {'{folio}'}, {'{estatus}'}</p>
                                    </div>

                                    <div className="config-columns-2">
                                        <div className="config-section">
                                            <label className="input-label">Tracking Encontrado:</label>
                                            <textarea 
                                                className="textarea-input"
                                                value={autoReplies.tracking_found || ""}
                                                onChange={(e) => handleAutoReplyChange("tracking_found", e.target.value)}
                                                placeholder="Tu pedido tiene estatus: {estatus}"
                                                rows={2}
                                            />
                                        </div>
                                        <div className="config-section">
                                            <label className="input-label">Tracking No Encontrado:</label>
                                            <textarea 
                                                className="textarea-input"
                                                value={autoReplies.tracking_not_found || ""}
                                                onChange={(e) => handleAutoReplyChange("tracking_not_found", e.target.value)}
                                                placeholder="No encontramos ese pedido..."
                                                rows={2}
                                            />
                                        </div>
                                    </div>

                                    <div className="config-section">
                                        <label className="input-label">Servicio Desactivado:</label>
                                        <textarea 
                                            className="textarea-input"
                                            value={autoReplies.disabled || ""}
                                            onChange={(e) => handleAutoReplyChange("disabled", e.target.value)}
                                            placeholder="Servicio no disponible..."
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            )}

                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowConfigModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveConfig}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Lista de Precios */}
            {showPriceListModal && (
                <div className="config-modal-backdrop">
                    <div className="config-modal-card config-modal-wide" style={{ maxWidth: "700px" }}>
                        <div className="modal-header">
                            <h2><FiDollarSign /> Lista de Precios</h2>
                            <button className="btn-close-modal" onClick={() => setShowPriceListModal(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body modal-body-scroll">
                            {/* Configuración de delivery */}
                            <div className="config-section" style={{ marginBottom: 16, padding: 14, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                                <label className="input-label" style={{ marginBottom: 10 }}>Configuración de Delivery</label>
                                <div className="config-columns-2" style={{ gap: 12 }}>
                                    <div>
                                        <label className="input-label" style={{ fontSize: 11 }}>Mínimo para delivery gratis ($)</label>
                                        <input
                                            type="number"
                                            className="text-input"
                                            value={deliverySettings.min_free_delivery}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, min_free_delivery: Number(e.target.value) })}
                                            min={0}
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label" style={{ fontSize: 11 }}>Tarifa pedidos pequeños ($)</label>
                                        <input
                                            type="number"
                                            className="text-input"
                                            value={deliverySettings.small_order_fee}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, small_order_fee: Number(e.target.value) })}
                                            min={0}
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label" style={{ fontSize: 11 }}>Recordatorio automático</label>
                                        <select
                                            className="select-input"
                                            value={deliverySettings.auto_reminder_enabled ? "on" : "off"}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, auto_reminder_enabled: e.target.value === "on" })}
                                        >
                                            <option value="on">Activado</option>
                                            <option value="off">Desactivado</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="input-label" style={{ fontSize: 11 }}>Minutos para recordatorio</label>
                                        <input
                                            type="number"
                                            className="text-input"
                                            value={deliverySettings.reminder_minutes}
                                            onChange={(e) => setDeliverySettings({ ...deliverySettings, reminder_minutes: Number(e.target.value) })}
                                            min={5}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Imagen de lista de precios */}
                            <div className="config-section" style={{ marginBottom: 16, padding: 14, background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
                                <label className="input-label" style={{ marginBottom: 10 }}>Imagen de Lista de Precios (WhatsApp)</label>
                                <p style={{ fontSize: 11, color: "#475569", margin: "0 0 8px" }}>Si subes una imagen, el chatbot enviará la imagen en lugar de texto cuando el cliente pida la lista de precios.</p>
                                {priceListImageUrl ? (
                                    <div style={{ position: "relative", display: "inline-block" }}>
                                        <img
                                            src={priceListImageUrl}
                                            alt="Lista de precios"
                                            style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #d1d5db" }}
                                        />
                                        <button
                                            className="btn-close-modal"
                                            onClick={handleRemovePriceListImage}
                                            style={{ position: "absolute", top: 4, right: 4, width: 24, height: 24, fontSize: 12, background: "#ef4444", color: "#fff" }}
                                        >
                                            <FiX />
                                        </button>
                                    </div>
                                ) : (
                                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20, border: "2px dashed #d1d5db", borderRadius: 8, cursor: "pointer", background: "#fff" }}>
                                        <FiPlus size={20} style={{ color: "#94a3b8", marginBottom: 4 }} />
                                        <span style={{ fontSize: 12, color: "#64748b" }}>Seleccionar imagen (JPG o PNG, max 5 MB)</span>
                                        <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png"
                                            onChange={handleUploadPriceListImage}
                                            style={{ display: "none" }}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Categorías y prendas */}
                            <div className="config-section">
                                <label className="input-label" style={{ marginBottom: 10 }}>Categorías y Prendas</label>

                                {priceCategories.map((cat) => (
                                    <div key={cat.id} style={{ marginBottom: 14, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                                            <strong style={{ fontSize: 13 }}>{cat.name}</strong>
                                            <button
                                                className="btn-close-modal"
                                                onClick={() => handleDeleteCategory(cat.id)}
                                                style={{ width: 28, height: 28, fontSize: 14 }}
                                            >
                                                <FiTrash2 />
                                            </button>
                                        </div>
                                        <div style={{ padding: 8 }}>
                                            {priceItems
                                                .filter(i => i.category_id === cat.id)
                                                .map((item) => (
                                                    <div key={item.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 70px 32px", gap: 6, alignItems: "center", marginBottom: 4, padding: "4px 0" }}>
                                                        <input
                                                            className="text-input"
                                                            value={item.name}
                                                            onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                                                            placeholder="Nombre"
                                                            style={{ padding: "4px 8px", fontSize: 13 }}
                                                        />
                                                        <input
                                                            type="number"
                                                            className="text-input"
                                                            value={item.price}
                                                            onChange={(e) => handleUpdateItem(item.id, "price", Number(e.target.value))}
                                                            min={0}
                                                            style={{ padding: "4px 8px", fontSize: 13 }}
                                                        />
                                                        <select
                                                            className="select-input"
                                                            value={item.unit}
                                                            onChange={(e) => handleUpdateItem(item.id, "unit", e.target.value)}
                                                            style={{ padding: "4px 4px", fontSize: 12 }}
                                                        >
                                                            <option value="pieza">Pieza</option>
                                                            <option value="kilo">Kilo</option>
                                                            <option value="docena">Docena</option>
                                                            <option value="servicio">Servicio</option>
                                                        </select>
                                                        <button
                                                            className="btn-close-modal"
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            style={{ width: 28, height: 28, fontSize: 12 }}
                                                        >
                                                            <FiTrash2 />
                                                        </button>
                                                    </div>
                                                ))
                                            }
                                            <button
                                                className="btn-secondary"
                                                onClick={() => handleAddItem(cat.id)}
                                                style={{ marginTop: 4, fontSize: 12, padding: "4px 10px" }}
                                            >
                                                <FiPlus /> Agregar prenda
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Agregar categoría */}
                                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                                    <input
                                        className="text-input"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="Nueva categoría..."
                                        onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                                        style={{ flex: 1 }}
                                    />
                                    <button className="btn-primary" onClick={handleAddCategory} style={{ padding: "6px 14px" }}>
                                        <FiPlus />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowPriceListModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSavePriceList} disabled={savingPriceList}>
                                {savingPriceList ? "Guardando..." : "Guardar Lista de Precios"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Zonas de Recogida */}
            {showZonesModal && (
                <div className="config-modal-backdrop">
                    <div className="config-modal-card config-modal-wide" style={{ maxWidth: "700px" }}>
                        <div className="modal-header">
                            <h2><FiMapPin /> Zonas de Recogida</h2>
                            <button className="btn-close-modal" onClick={() => setShowZonesModal(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body modal-body-scroll">
                            <div className="config-section" style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 13, color: "#475569", margin: "0 0 12px" }}>
                                    Configura las zonas o colonias y los días en los que pasas a recoger. 
                                    El chatbot usará las <strong>Palabras Clave</strong> para detectar la zona de la dirección que envíe el cliente.
                                </p>

                                {pickupZones.map((zone) => (
                                    <div key={zone.id} style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                                            <input 
                                                className="text-input"
                                                style={{ width: "200px", padding: "4px 8px", fontSize: 13, fontWeight: "bold" }}
                                                value={zone.zone_name}
                                                onChange={(e) => handleUpdateZone(zone.id, "zone_name", e.target.value)}
                                                placeholder="Nombre de la Zona"
                                            />
                                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={zone.is_default}
                                                        onChange={(e) => handleUpdateZone(zone.id, "is_default", e.target.checked)}
                                                    /> Por defecto
                                                </label>
                                                <button
                                                    className="btn-close-modal"
                                                    onClick={() => handleDeleteZone(zone.id)}
                                                    style={{ width: 28, height: 28, fontSize: 14 }}
                                                >
                                                    <FiTrash2 />
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ padding: 12 }}>
                                            <div style={{ marginBottom: 10 }}>
                                                <label className="input-label" style={{ fontSize: 11, marginBottom: 4 }}>Palabras Clave (separadas por coma):</label>
                                                <input
                                                    className="text-input"
                                                    style={{ fontSize: 13 }}
                                                    value={Array.isArray(zone.keywords) ? zone.keywords.join(", ") : zone.keywords}
                                                    onChange={(e) => handleUpdateZone(zone.id, "keywords", e.target.value)}
                                                    placeholder="Ej: centro, z1, sur, norte, plaza mayor"
                                                />
                                            </div>
                                            <div style={{ marginBottom: 10 }}>
                                                <label className="input-label" style={{ fontSize: 11, marginBottom: 4 }}>Chofer por defecto (Asignación automática):</label>
                                                <select
                                                    className="select-input"
                                                    style={{ width: "100%", padding: "4px 8px", fontSize: 13 }}
                                                    value={zone.default_driver_id || ""}
                                                    onChange={(e) => handleUpdateZone(zone.id, "default_driver_id", e.target.value ? parseInt(e.target.value) : null)}
                                                >
                                                    <option value="">Ninguno (Asignar manualmente)</option>
                                                    {drivers.map(driver => (
                                                        <option key={driver.id} value={driver.id}>{driver.name} - {driver.phone}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="input-label" style={{ fontSize: 11, marginBottom: 4 }}>Días de Recogida:</label>
                                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                    {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((dayName, idx) => {
                                                        const isSelected = (zone.pickup_days || []).includes(idx);
                                                        return (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => handleTogglePickupDay(zone.id, idx)}
                                                                style={{
                                                                    padding: "4px 8px",
                                                                    borderRadius: 12,
                                                                    border: `1px solid ${isSelected ? "#2563eb" : "#cbd5e1"}`,
                                                                    background: isSelected ? "#eff6ff" : "#f8fafc",
                                                                    color: isSelected ? "#1d4ed8" : "#475569",
                                                                    fontSize: 12,
                                                                    cursor: "pointer",
                                                                    fontWeight: isSelected ? "600" : "400"
                                                                }}
                                                            >
                                                                {dayName}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* Agregar Zona */}
                                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                                    <input
                                        className="text-input"
                                        value={newZoneName}
                                        onChange={(e) => setNewZoneName(e.target.value)}
                                        placeholder="Nueva zona (Ej. Norte)..."
                                        onKeyDown={(e) => e.key === "Enter" && handleAddZone()}
                                        style={{ flex: 1 }}
                                    />
                                    <button className="btn-primary" onClick={handleAddZone} style={{ padding: "6px 14px" }} disabled={savingZones}>
                                        <FiPlus />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowZonesModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveZones} disabled={savingZones}>
                                {savingZones ? "Guardando..." : "Guardar Zonas"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
