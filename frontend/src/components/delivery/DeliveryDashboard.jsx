import React, { useEffect, useState } from "react";
import { DELIVERY_PAYMENT_METHODS, DELIVERY_PAYMENT_PREFERENCES, deliveryService } from "../../services/deliveryService";
import { staffService } from "../../services/staffService";
import { supabase } from "../../supabase";
import { FiTruck, FiClock, FiCheck, FiX, FiSettings, FiUser, FiMapPin, FiMessageSquare } from "react-icons/fi";
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

const hasPickupQuote = (order) => Boolean(order?.pickup_quote_confirmed_at);

const formatPickupQuote = (order) =>
    hasPickupQuote(order) ? `$${Number(order.delivery_fee || 0).toFixed(2)} MXN` : "Pendiente de cotizar";

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

    // Variables de configuración de la tienda
    const [gatewayType, setGatewayType] = useState("central_saas");
    const [sessionToken, setSessionToken] = useState("");

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
                    <input id="swal-garments" class="swal2-input" style="width: 85%; margin-top:0;" value="${order.garment_summary || ''}" placeholder="Ej. 5 camisas, 3 pantalones">
                    
                    <label style="font-weight: bold; display: block; margin-top: 1rem; margin-bottom: 0.25rem;">Costo del servicio de lavanderia ($):</label>
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
                    whatsapp_session_token: gatewayType === "qr_linked" ? sessionToken : null
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
            const signedUrl = await deliveryService.getPickupEvidenceSignedUrl(order.pickup_evidence_path);
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
    const activeRouteOrders = orders.filter(o => ["accepted", "assigned", "picked_up"].includes(o.status));
    const inStoreOrders = orders.filter(o => o.status === "delivered_to_store");

    if (loading) {
        return (
            <div className="delivery-loader">
                <div className="spinner"></div>
                <p>Cargando panel de delivery...</p>
            </div>
        );
    }

    return (
        <div className="delivery-dashboard-container">
            
            {/* Header del Dashboard */}
            <header className="delivery-dash-header">
                <div>
                    <h1>Módulo de Delivery</h1>
                    <p className="text-slate-500 text-sm">Administra y despacha recogidas de prendas de lavandería en vivo.</p>
                </div>
                
                <div className="flex gap-2">
                    <button className="btn-secondary flex items-center gap-2" onClick={() => setShowConfigModal(true)}>
                        <FiSettings /> Mensajería
                    </button>
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
                                <FiClock size={36} className="text-slate-300" />
                                <p>Sin solicitudes pendientes</p>
                            </div>
                        ) : (
                            pendingOrders.map(order => (
                                <div key={order.id} className="order-kanban-card">
                                    <div className="card-top">
                                        <span className="card-id">#ID: {order.id}</span>
                                        <span className="card-time">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <h3>{order.customer_name}</h3>
                                    <p className="phone-row"><FiUser size={12} /> {order.customer_phone}</p>
                                    <p className="address-row"><FiMapPin size={12} /> {order.customer_address}</p>
                                    {order.notes && <p className="notes-box">"{order.notes}"</p>}
                                    {order.customer_item_description ? (
                                        <p className="notes-box"><strong>Que se va a recoger:</strong> {order.customer_item_description}</p>
                                    ) : (
                                        <p className="payment-warning-box">La clienta aun no describe que prendas entregara.</p>
                                    )}
                                    {order.payment_preference ? (
                                        <p className="payment-info-box"><strong>Pago:</strong> {DELIVERY_PAYMENT_PREFERENCES[order.payment_preference]}</p>
                                    ) : (
                                        <p className="payment-warning-box">La clienta aun no confirma como pagara.</p>
                                    )}
                                    <p className={hasPickupQuote(order) ? "payment-info-box" : "payment-warning-box"}>
                                        <strong>Tarifa de recogida:</strong> {formatPickupQuote(order)}
                                    </p>
                                    <div className="card-footer">
                                        <button className="btn-action-reject" onClick={() => handleRejectOrder(order.id)} title="Rechazar">
                                            <FiX />
                                        </button>
                                        <button className="btn-action-quote" onClick={() => handleQuotePickup(order)}>
                                            Cotizar
                                        </button>
                                        <button className="btn-action-accept" onClick={() => handleAcceptOrder(order.id)}>
                                            <FiCheck /> Aceptar y Asignar
                                        </button>
                                    </div>
                                </div>
                            ))
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
                                <FiTruck size={36} className="text-slate-300" />
                                <p>Sin servicios en ruta</p>
                            </div>
                        ) : (
                            activeRouteOrders.map(order => (
                                <div key={order.id} className="order-kanban-card">
                                    <div className="card-top">
                                        <span className="card-id">#ID: {order.id}</span>
                                        <span className={`status-pill pill-${order.status}`}>
                                            {order.status === "assigned" ? "Asignado" : order.status === "accepted" ? "Aceptado" : "Recogido"}
                                        </span>
                                    </div>
                                    <h3>{order.customer_name}</h3>
                                    <p className="address-row"><FiMapPin size={12} /> {order.customer_address}</p>
                                    <div className="driver-assigned-row">
                                        <span className="material-icons-outlined text-[14px]">directions_car</span>
                                        <span>Repartidor: <strong>{order.driver?.name || "Asignado"}</strong></span>
                                    </div>
                                    {order.customer_item_description ? (
                                        <p className="notes-box"><strong>Que se recogera:</strong> {order.customer_item_description}</p>
                                    ) : (
                                        <p className="payment-warning-box">Sin detalle de prendas capturado por la clienta.</p>
                                    )}
                                    {order.payment_preference && (
                                        <p className="payment-info-box"><strong>Pago:</strong> {DELIVERY_PAYMENT_PREFERENCES[order.payment_preference]}</p>
                                    )}
                                    <p className={hasPickupQuote(order) ? "payment-info-box" : "payment-warning-box"}>
                                        <strong>Tarifa de recogida:</strong> {formatPickupQuote(order)}
                                    </p>
                                    {order.pickup_evidence_path && (
                                        <button className="btn-action-quote btn-quote-full" onClick={() => handleViewPickupEvidence(order)}>
                                            Ver evidencia de recogida
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
                                            Recibido en Lavandería
                                        </button>
                                    </div>
                                </div>
                            ))
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
                                <span className="material-icons-outlined text-[36px] text-slate-300">local_laundry_service</span>
                                <p>Sin prendas en sucursal</p>
                            </div>
                        ) : (
                            inStoreOrders.map(order => (
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
                                        <p className="notes-box"><strong>Solicitud original:</strong> {order.customer_item_description}</p>
                                    )}
                                    <p className={hasPickupQuote(order) ? "payment-info-box" : "payment-warning-box"}>
                                        <strong>Tarifa de recogida:</strong> {formatPickupQuote(order)}
                                    </p>
                                    {order.pickup_evidence_path && (
                                        <button className="btn-action-quote btn-quote-full" onClick={() => handleViewPickupEvidence(order)}>
                                            Ver evidencia de recogida
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
                                            <span className="material-icons-outlined text-[16px]">point_of_sale</span>
                                            Cargar en Caja / Cobrar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>

            {/* Modal de Configuración de Pasarela */}
            {showConfigModal && (
                <div className="config-modal-backdrop">
                    <div className="config-modal-card">
                        <div className="modal-header">
                            <h2>Configuración de Mensajería</h2>
                            <button className="btn-close-modal" onClick={() => setShowConfigModal(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="modal-body">
                            <label className="input-label">Tipo de Pasarela Multi-tenant:</label>
                            <select 
                                className="select-input" 
                                value={gatewayType} 
                                onChange={(e) => setGatewayType(e.target.value)}
                            >
                                <option value="central_saas">WhatsApp Centralizado (Línea Oficial SaaS)</option>
                                <option value="qr_linked">WhatsApp Vinculado por QR (Evolution API / Wassenger)</option>
                                <option value="sms_only">SMS Directo Transaccional (Respaldo Completo)</option>
                            </select>

                            {gatewayType === "qr_linked" && (
                                <div className="qr-config-inputs">
                                    <label className="input-label mt-4">API Token de la Sesión QR:</label>
                                    <input 
                                        type="password" 
                                        className="text-input" 
                                        value={sessionToken} 
                                        onChange={(e) => setSessionToken(e.target.value)}
                                        placeholder="Ingresa tu apikey de Wassenger/Evolution..."
                                    />
                                    <p className="input-help">Escanea el QR en tu portal Evolution API para obtener este token y vincular tu número celular propio.</p>
                                </div>
                            )}

                            {gatewayType === "central_saas" && (
                                <p className="gateway-info-box">
                                    <FiMessageSquare size={16} />
                                    Los clientes recibirán las alertas automáticas desde el número verificado de <strong>FoxSolid Central</strong>. No requieres configuraciones adicionales.
                                </p>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setShowConfigModal(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveConfig}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
