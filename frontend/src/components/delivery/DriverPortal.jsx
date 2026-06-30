import React, { useEffect, useMemo, useState } from "react";
import { storage } from "../../utils/storage";
import {
    FiArrowLeft,
    FiArrowRight,
    FiCamera,
    FiCheckSquare,
    FiChevronRight,
    FiClock,
    FiDollarSign,
    FiLock,
    FiLogOut,
    FiMapPin,
    FiMessageCircle,
    FiPackage,
    FiPhone,
    FiPlus,
    FiPrinter,
    FiRefreshCw,
    FiTruck,
    FiX
} from "react-icons/fi";
import Swal from "sweetalert2";
import { DELIVERY_PAYMENT_METHODS, DELIVERY_PAYMENT_PREFERENCES, deliveryService } from "../../services/deliveryService";
import { printerService } from "../../services/printerService";
import { supabase } from "../../supabase";
import "./DriverPortal.css";

const DELIVERY_DRIVER_ROLES = ["repartidor", "chofer"];

const isDeliveryDriver = (staffMember) =>
    staffMember?.active && DELIVERY_DRIVER_ROLES.includes(staffMember.role?.toLowerCase());

const money = (value) => `$${Number(value || 0).toFixed(2)} MXN`;

const getStatusLabel = (status) => {
    if (status === "assigned") return "Asignado";
    if (status === "accepted") return "Aceptado";
    if (status === "picked_up") return "Recogido";
    return status || "Ruta";
};

const getNextActionLabel = (status) => {
    if (["assigned", "accepted"].includes(status)) return "Marcar recogido";
    if (status === "picked_up") return "Entregar en sucursal";
    return "Ver detalle";
};

const getShortAddress = (address = "") => {
    const parts = String(address).split(",").map((part) => part.trim()).filter(Boolean);
    return parts.slice(0, 2).join(", ") || address || "Sin direccion";
};

const getWhatsappUrl = (order) => {
    const cleanPhone = String(order.customer_phone || "").replace(/\D/g, "");
    const phone = cleanPhone.startsWith("52") ? cleanPhone : `52${cleanPhone}`;
    const message = `Hola ${order.customer_name}, soy tu repartidor de la lavanderia. Voy en camino a tu domicilio.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

const initialExpressForm = {
    customer_name: "",
    customer_phone: "",
    customer_address: "",
    garment_summary: "",
    notes: "",
    delivery_fee: 0,
    payment_preference: "",
    register_payment: false,
    payment_amount: 0,
    payment_method: "efectivo",
    payment_reference: "",
    evidenceFile: null
};

export const DriverPortal = ({ desktopPreview = false, onExitPreview }) => {
    const [pin, setPin] = useState("");
    const [driver, setDriver] = useState(null);
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);
    const [showExpressForm, setShowExpressForm] = useState(false);
    const [expressForm, setExpressForm] = useState(initialExpressForm);
    const [expressLoading, setExpressLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const selectedOrder = useMemo(
        () => orders.find((order) => order.id === selectedOrderId) || null,
        [orders, selectedOrderId]
    );

    const loadDriverOrders = async (driverId, sessionToken = driver?.session_token) => {
        try {
            setLoading(true);
            const data = await deliveryService.getDriverOrders(driverId, sessionToken);
            setOrders(data);
            setSelectedOrderId((currentId) => {
                if (!currentId) return null;
                return data.some((order) => order.id === currentId) ? currentId : null;
            });
        } catch (err) {
            console.error("Error al cargar pedidos del repartidor:", err);
            Swal.fire("Error", "No pudimos cargar tus pedidos asignados.", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        if (!driver) return;
        try {
            setStatsLoading(true);
            const s = await deliveryService.getDriverStats(driver);
            setStats(s);
        } catch (err) {
            console.error("Error al cargar estadisticas:", err);
        } finally {
            setStatsLoading(false);
        }
    };

    const handleLogin = async (event) => {
        if (event) event.preventDefault();
        if (pin.length < 4) {
            Swal.fire("PIN incompleto", "Ingresa un PIN valido de 4 o mas digitos.", "warning");
            return;
        }

        setLoading(true);
        try {
            const verifiedDriver = await deliveryService.verifyDriverPin(pin);

            if (!verifiedDriver || !isDeliveryDriver({ ...verifiedDriver, active: true })) {
                Swal.fire("Acceso denegado", "PIN incorrecto o empleado no registrado como repartidor activo.", "error");
                setPin("");
                return;
            }

            setDriver(verifiedDriver);
            setAuthenticated(true);
            await storage.setObject("driver_session", verifiedDriver);
            await loadDriverOrders(verifiedDriver.id, verifiedDriver.session_token);
            await loadStats();
            setPin("");
        } catch (err) {
            console.error("Error al validar PIN:", err);
            Swal.fire("Error", "Error al intentar iniciar sesion.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        storage.getObject("driver_session").then((savedSession) => {
            if (savedSession) {
                if (!savedSession?.session_token) {
                    storage.remove("driver_session");
                    return;
                }
                setDriver(savedSession);
                setAuthenticated(true);
                loadDriverOrders(savedSession.id, savedSession.session_token);
                loadStats();
            }
        });
    }, []);

    useEffect(() => {
        if (!driver) return undefined;

        const channel = supabase
            .channel(`driver-orders-realtime:${driver.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "delivery_orders", filter: `driver_id=eq.${driver.id}` },
                () => {
                    loadDriverOrders(driver.id, driver.session_token);
                    loadStats();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [driver]);

    const handleLogout = () => {
        storage.remove("driver_session");
        setDriver(null);
        setAuthenticated(false);
        setSelectedOrderId(null);
        setOrders([]);
        setStats(null);
    };

    const handlePickupReport = async (order) => {
        const { value } = await Swal.fire({
            title: "Reporte de recogida",
            html: `
                <div class="driver-swal-form">
                    <label>Que recogiste</label>
                    <textarea id="pickup-summary" class="swal2-textarea driver-pickup-textarea" rows="5" placeholder="Ej. 2 bolsas negras, 1 cobertor matrimonial, ropa delicada aparte">${order.garment_summary || ""}</textarea>
                    <label>Evidencia fotografica opcional</label>
                    <input id="pickup-evidence" type="file" accept="image/*" capture="environment" class="swal2-file driver-pickup-file">
                    <small>La foto queda privada para revision de sucursal.</small>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Guardar recogida",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#0891b2",
            focusConfirm: false,
            preConfirm: () => {
                const summary = document.getElementById("pickup-summary").value.trim();
                const file = document.getElementById("pickup-evidence").files?.[0] || null;

                if (!summary) {
                    Swal.showValidationMessage("Describe que recogiste antes de continuar.");
                    return false;
                }

                if (file && !file.type.startsWith("image/")) {
                    Swal.showValidationMessage("La evidencia debe ser una imagen.");
                    return false;
                }

                if (file && file.size > 8 * 1024 * 1024) {
                    Swal.showValidationMessage("La imagen no debe pesar mas de 8 MB.");
                    return false;
                }

                return { summary, file };
            }
        });

        if (!value) return;

        try {
            setLoading(true);
            const evidencePath = value.file
                ? await deliveryService.uploadPickupEvidence(order, value.file)
                : order.pickup_evidence_path || null;

            await deliveryService.updateOrderStatus(order.id, "picked_up", {
                driver_id: driver.id,
                driver_session_token: driver.session_token,
                driver_name: driver.name,
                garment_summary: value.summary,
                pickup_evidence_path: evidencePath
            });

            Swal.fire("Recogida registrada", "La ruta se actualizo correctamente.", "success");
            await loadDriverOrders(driver.id, driver.session_token);
        } catch (err) {
            console.error("Error registrando recogida:", err);
            Swal.fire("Error", err.message || "No se pudo registrar la recogida.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeliverToStore = async (order) => {
        const result = await Swal.fire({
            title: "Entregar en lavanderia",
            text: "Confirma que entregaste estas prendas en sucursal.",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Confirmar entrega",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#10b981"
        });

        if (!result.isConfirmed) return;

        try {
            setLoading(true);
            await deliveryService.updateOrderStatus(order.id, "delivered_to_store", {
                driver_id: driver.id,
                driver_session_token: driver.session_token,
                driver_name: driver.name
            });
            Swal.fire("Entregado", "Pedido marcado como entregado en lavanderia.", "success");
            await loadDriverOrders(driver.id, driver.session_token);
        } catch (err) {
            console.error("Error entregando en sucursal:", err);
            Swal.fire("Error", "No se pudo actualizar el estatus.", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleNextAction = (order) => {
        if (["assigned", "accepted"].includes(order.status)) {
            handlePickupReport(order);
            return;
        }
        if (order.status === "picked_up") {
            handleDeliverToStore(order);
        }
    };

    const handleRegisterPayment = async (order) => {
        const { value: formValues } = await Swal.fire({
            title: "Registrar pago o abono",
            html: `
                <div style="text-align:left">
                    <label style="font-weight:700; font-size:12px;">Monto recibido</label>
                    <input id="driver-payment-amount" type="number" min="0" step="0.01" class="swal2-input" placeholder="0.00" style="width:85%; margin-top:4px;">

                    <label style="font-weight:700; font-size:12px; display:block; margin-top:10px;">Metodo</label>
                    <select id="driver-payment-method" class="swal2-select" style="width:85%; margin-top:4px;">
                        <option value="efectivo">Efectivo</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="tarjeta">Tarjeta</option>
                    </select>

                    <label style="font-weight:700; font-size:12px; display:block; margin-top:10px;">Referencia / autorizacion</label>
                    <input id="driver-payment-reference" class="swal2-input" placeholder="Obligatoria en transferencia/tarjeta" style="width:85%; margin-top:4px;">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: "Registrar pago",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#10b981",
            preConfirm: () => {
                const amount = document.getElementById("driver-payment-amount").value;
                const payment_method = document.getElementById("driver-payment-method").value;
                const reference = document.getElementById("driver-payment-reference").value;
                if (!amount || Number(amount) <= 0) {
                    Swal.showValidationMessage("Ingresa un monto valido.");
                    return false;
                }
                if (["transferencia", "tarjeta"].includes(payment_method) && !reference.trim()) {
                    Swal.showValidationMessage("La referencia es obligatoria para transferencia o tarjeta.");
                    return false;
                }
                return { amount, payment_method, reference };
            }
        });

        if (!formValues) return;

        try {
            setLoading(true);
            await deliveryService.createDriverPayment(order, formValues, driver);
            Swal.fire("Pago registrado", "El pago quedo pendiente de conciliacion en sucursal.", "success");
            await loadDriverOrders(driver.id, driver.session_token);
        } catch (err) {
            console.error("Error registrando pago del chofer:", err);
            Swal.fire("Error", err.message || "No se pudo registrar el pago.", "error");
        } finally {
            setLoading(false);
        }
    };

    // ─── IMPRIMIR COMPROBANTE ────────────────────────────────────────

    const handlePrintReceipt = async (order) => {
        try {
            await printerService.printDeliveryReceipt({
                storeName: order.store_name || "Lavanderia",
                driverName: driver?.name || "Repartidor",
                orderId: order.id,
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                customerAddress: order.customer_address,
                garments: order.garment_summary || order.customer_item_description || "",
                deliveryFee: order.delivery_fee || 0,
                payment: order.payment_status !== "unpaid" ? null : null,
                date: new Date()
            });
        } catch (err) {
            console.error("Error al imprimir:", err);
            Swal.fire("Error", "No se pudo imprimir el comprobante. " + (err.message || ""), "error");
        }
    };

    // ─── RECOLECCIÓN EXPRÉS ───────────────────────────────────────────

    const handleExpressFormChange = (field, value) => {
        setExpressForm(prev => ({ ...prev, [field]: value }));
    };

    const handleExpressFileChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (file && !file.type.startsWith("image/")) {
            Swal.fire("Formato invalido", "La evidencia debe ser una imagen.", "warning");
            e.target.value = "";
            return;
        }
        if (file && file.size > 8 * 1024 * 1024) {
            Swal.fire("Archivo muy grande", "La imagen no debe pesar mas de 8 MB.", "warning");
            e.target.value = "";
            return;
        }
        setExpressForm(prev => ({ ...prev, evidenceFile: file }));
    };

    const handleSubmitExpressPickup = async () => {
        const f = expressForm;
        if (!f.customer_name.trim() || !f.customer_phone.trim() || !f.customer_address.trim()) {
            Swal.fire("Campos obligatorios", "Nombre, telefono y direccion del cliente son requeridos.", "warning");
            return;
        }
        if (!f.garment_summary.trim()) {
            Swal.fire("Describe las prendas", "Indica que recogiste del cliente.", "warning");
            return;
        }

        setExpressLoading(true);
        try {
            // 1. Create express pickup first (without evidence)
            const result = await deliveryService.createExpressPickup({
                driver: driver,
                customer_name: f.customer_name.trim(),
                customer_phone: f.customer_phone.trim(),
                customer_address: f.customer_address.trim(),
                garment_summary: f.garment_summary.trim(),
                notes: f.notes.trim(),
                delivery_fee: Number(f.delivery_fee) || 0,
                payment_preference: f.payment_preference,
                pickup_evidence_path: null,
                create_pos_order: false,
                folio: null,
                register_payment: f.register_payment && Number(f.payment_amount) > 0,
                payment_amount: Number(f.payment_amount) || 0,
                payment_method: f.payment_method,
                payment_reference: f.payment_reference.trim()
            });

            // 2. Upload evidence with real order ID if provided (may fail on phone without store auth)
            if (f.evidenceFile && result.order) {
                try {
                    const evidencePath = await deliveryService.uploadPickupEvidence(result.order, f.evidenceFile);
                    if (evidencePath) {
                        // Update evidence path via direct supabase update (works when store is authenticated)
                        const { error: updErr } = await supabase
                            .from('delivery_orders')
                            .update({ pickup_evidence_path: evidencePath })
                            .eq('id', result.order.id);
                        if (updErr) console.warn("No se pudo guardar ruta de evidencia:", updErr);
                    }
                } catch (err) {
                    console.warn("Foto no subida (puedes agregarla después desde sucursal):", err);
                }
            }

            setShowExpressForm(false);
            setExpressForm(initialExpressForm);

            // Offer to print
            const printResult = await Swal.fire({
                title: "Recoleccion registrada",
                text: `Pedido #${result.order.id} creado correctamente.`,
                icon: "success",
                showCancelButton: true,
                confirmButtonText: "Imprimir comprobante",
                cancelButtonText: "Cerrar",
                confirmButtonColor: "#0891b2"
            });

            if (printResult.isConfirmed && result.order) {
                await printerService.printDeliveryReceipt({
                    storeName: "Lavanderia",
                    driverName: driver?.name || "Repartidor",
                    orderId: result.order.id,
                    customerName: result.order.customer_name,
                    customerPhone: result.order.customer_phone,
                    customerAddress: result.order.customer_address,
                    garments: result.order.garment_summary || "",
                    deliveryFee: result.order.delivery_fee || 0,
                    payment: f.register_payment ? f.payment_amount : null,
                    date: new Date()
                });
            }

            await loadDriverOrders(driver.id, driver.session_token);
            await loadStats();
        } catch (err) {
            console.error("Error creando recoleccion express:", err);
            Swal.fire("Error", err.message || "No se pudo crear la recoleccion.", "error");
        } finally {
            setExpressLoading(false);
        }
    };

    if (!authenticated) {
        return (
            <div className="driver-auth-wrapper">
                <form className="driver-auth-card" onSubmit={handleLogin}>
                    {desktopPreview && (
                        <button type="button" className="driver-preview-pos-link" onClick={onExitPreview}>
                            POS
                        </button>
                    )}
                    <div className="driver-icon-header">
                        <FiTruck size={36} />
                    </div>
                    <h1>Portal repartidor</h1>
                    <p>Ingresa tu PIN para ver tus rutas asignadas.</p>

                    <div className="pin-input-field">
                        <FiLock className="input-icon" />
                        <input
                            type="password"
                            pattern="[0-9]*"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="0000"
                            value={pin}
                            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="btn-driver-login" disabled={loading}>
                        {loading ? "Validando..." : "Entrar"} <FiArrowRight />
                    </button>
                </form>
            </div>
        );
    }

    const activeCount = orders.length;

    return (
        <main className="driver-portal-wrapper">
            <header className="driver-portal-header">
                <div className="driver-meta">
                    <span className="driver-avatar">{driver.name.charAt(0)}</span>
                    <div>
                        <h1>{driver.name}</h1>
                        <p>{activeCount} {activeCount === 1 ? "ruta activa" : "rutas activas"}</p>
                    </div>
                </div>
                <div className="driver-header-actions">
                    {desktopPreview && (
                        <button className="driver-pos-button" onClick={onExitPreview} title="Volver al POS">
                            POS
                        </button>
                    )}
                    <button className="driver-icon-button" onClick={() => {
                        loadDriverOrders(driver.id, driver.session_token);
                        loadStats();
                    }} title="Actualizar">
                        <FiRefreshCw />
                    </button>
                    <button className="driver-icon-button" onClick={handleLogout} title="Salir">
                        <FiLogOut />
                    </button>
                </div>
            </header>

            {selectedOrder ? (
                <DriverOrderDetail
                    order={selectedOrder}
                    loading={loading}
                    onBack={() => setSelectedOrderId(null)}
                    onPayment={() => handleRegisterPayment(selectedOrder)}
                    onNextAction={() => handleNextAction(selectedOrder)}
                    onPrint={() => handlePrintReceipt(selectedOrder)}
                />
            ) : (
                <>
                    <section className="driver-task-list">
                        <div className="driver-section-title">
                            <span>Rutas de hoy</span>
                            {loading && <small>Actualizando...</small>}
                        </div>

                        {loading && orders.length === 0 ? (
                            <div className="driver-portal-loader">Cargando rutas...</div>
                        ) : orders.length === 0 ? (
                            <div className="driver-empty-state">
                                <FiCheckSquare size={44} />
                                <h2>Todo al dia</h2>
                                <p>No tienes rutas asignadas por el momento.</p>
                                <div className="driver-stats-mini">
                                    {statsLoading ? (
                                        <p>Cargando resumen...</p>
                                    ) : stats ? (
                                        <div className="driver-stats-grid">
                                            <div className="stat-item">
                                                <strong>{stats.total_today}</strong>
                                                <small>Recolecciones hoy</small>
                                            </div>
                                            <div className="stat-item">
                                                <strong>{stats.delivered_to_store}</strong>
                                                <small>Entregadas</small>
                                            </div>
                                            <div className="stat-item">
                                                <strong>{money(stats.total_collected)}</strong>
                                                <small>Total recolectado</small>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                <button className="btn-driver-refresh" onClick={() => {
                                    loadDriverOrders(driver.id, driver.session_token);
                                    loadStats();
                                }}>
                                    Actualizar
                                </button>
                            </div>
                        ) : (
                            orders.map((order) => (
                                <button
                                    key={order.id}
                                    type="button"
                                    className={`driver-task-card ${order.status}`}
                                    onClick={() => setSelectedOrderId(order.id)}
                                >
                                    <div className="task-main">
                                        <div className="task-status-row">
                                            <span className={`task-status ${order.status}`}>{getStatusLabel(order.status)}</span>
                                            <span className="task-id">#{order.id}</span>
                                        </div>
                                        <strong>{order.customer_name}</strong>
                                        <span className="task-address">
                                            <FiMapPin />
                                            {getShortAddress(order.customer_address)}
                                        </span>
                                        <div className="task-chips">
                                            <span>{money(order.delivery_fee)}</span>
                                            <span>{order.payment_preference ? "Pago definido" : "Pago pendiente"}</span>
                                        </div>
                                    </div>
                                    <div className="task-next">
                                        <span>{getNextActionLabel(order.status)}</span>
                                        <FiChevronRight />
                                    </div>
                                </button>
                            ))
                        )}
                    </section>

                    {/* Stats section when there are orders */}
                    {orders.length > 0 && stats && (
                        <section className="driver-stats-bar">
                            <div className="driver-stats-grid">
                                <div className="stat-item">
                                    <strong>{stats.total_today}</strong>
                                    <small>Hoy</small>
                                </div>
                                <div className="stat-item">
                                    <strong>{stats.picked_up}</strong>
                                    <small>Recogidas</small>
                                </div>
                                <div className="stat-item">
                                    <strong>{stats.delivered_to_store}</strong>
                                    <small>Entregadas</small>
                                </div>
                                <div className="stat-item">
                                    <strong>{money(stats.total_collected)}</strong>
                                    <small>Total</small>
                                </div>
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* FAB: Nueva recoleccion */}
            {!selectedOrder && (
                <button
                    className="driver-fab"
                    onClick={() => setShowExpressForm(true)}
                    title="Nueva recoleccion express"
                >
                    <FiPlus size={28} />
                </button>
            )}

            {/* Modal: Express Pickup Form */}
            {showExpressForm && (
                <div className="driver-modal-backdrop" onClick={() => !expressLoading && setShowExpressForm(false)}>
                    <div className="driver-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="driver-modal-header">
                            <h2>Nueva recoleccion express</h2>
                            <button className="driver-modal-close" onClick={() => setShowExpressForm(false)} disabled={expressLoading}>
                                <FiX />
                            </button>
                        </div>

                        <div className="driver-modal-body">
                            <label className="driver-form-label">Nombre del cliente *</label>
                            <input className="driver-form-input" type="text" placeholder="Maria Perez"
                                value={expressForm.customer_name}
                                onChange={(e) => handleExpressFormChange("customer_name", e.target.value)}
                                disabled={expressLoading} />

                            <label className="driver-form-label">Telefono *</label>
                            <input className="driver-form-input" type="tel" placeholder="5551234567"
                                value={expressForm.customer_phone}
                                onChange={(e) => handleExpressFormChange("customer_phone", e.target.value)}
                                disabled={expressLoading} />

                            <label className="driver-form-label">Direccion *</label>
                            <input className="driver-form-input" type="text" placeholder="Calle, colonia, numero"
                                value={expressForm.customer_address}
                                onChange={(e) => handleExpressFormChange("customer_address", e.target.value)}
                                disabled={expressLoading} />

                            <label className="driver-form-label">Prendas recolectadas *</label>
                            <textarea className="driver-form-textarea" rows="3" placeholder="Ej. 2 bolsas negras, 1 cobertor matrimonial"
                                value={expressForm.garment_summary}
                                onChange={(e) => handleExpressFormChange("garment_summary", e.target.value)}
                                disabled={expressLoading} />

                            <label className="driver-form-label">Notas (opcional)</label>
                            <input className="driver-form-input" type="text" placeholder="Indicaciones adicionales"
                                value={expressForm.notes}
                                onChange={(e) => handleExpressFormChange("notes", e.target.value)}
                                disabled={expressLoading} />

                            <label className="driver-form-label">Tarifa de delivery ($)</label>
                            <input className="driver-form-input" type="number" min="0" step="0.01" placeholder="0.00"
                                value={expressForm.delivery_fee}
                                onChange={(e) => handleExpressFormChange("delivery_fee", e.target.value)}
                                disabled={expressLoading} />

                            <label className="driver-form-label">Evidencia fotografica (opcional)</label>
                            <input className="driver-form-file" type="file" accept="image/*" capture="environment"
                                onChange={handleExpressFileChange}
                                disabled={expressLoading} />

                            <div className="driver-form-divider" />

                            <label className="driver-form-checkbox">
                                <input type="checkbox"
                                    checked={expressForm.register_payment}
                                    onChange={(e) => handleExpressFormChange("register_payment", e.target.checked)}
                                    disabled={expressLoading} />
                                <span>Registrar pago / anticipo</span>
                            </label>

                            {expressForm.register_payment && (
                                <div className="driver-form-payment-fields">
                                    <label className="driver-form-label">Monto recibido ($)</label>
                                    <input className="driver-form-input" type="number" min="0" step="0.01" placeholder="0.00"
                                        value={expressForm.payment_amount}
                                        onChange={(e) => handleExpressFormChange("payment_amount", e.target.value)}
                                        disabled={expressLoading} />

                                    <label className="driver-form-label">Metodo de pago</label>
                                    <select className="driver-form-select"
                                        value={expressForm.payment_method}
                                        onChange={(e) => handleExpressFormChange("payment_method", e.target.value)}
                                        disabled={expressLoading}>
                                        <option value="efectivo">Efectivo</option>
                                        <option value="transferencia">Transferencia</option>
                                        <option value="tarjeta">Tarjeta</option>
                                    </select>

                                    {["transferencia", "tarjeta"].includes(expressForm.payment_method) && (
                                        <>
                                            <label className="driver-form-label">Referencia</label>
                                            <input className="driver-form-input" type="text" placeholder="Autorizacion / referencia"
                                                value={expressForm.payment_reference}
                                                onChange={(e) => handleExpressFormChange("payment_reference", e.target.value)}
                                                disabled={expressLoading} />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="driver-modal-footer">
                            <button className="driver-modal-btn-secondary" onClick={() => setShowExpressForm(false)} disabled={expressLoading}>
                                Cancelar
                            </button>
                            <button className="driver-modal-btn-primary" onClick={handleSubmitExpressPickup} disabled={expressLoading}>
                                {expressLoading ? "Guardando..." : "Guardar y recoger"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

const DriverOrderDetail = ({ order, loading, onBack, onPayment, onNextAction, onPrint }) => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address || "")}`;
    const canAdvance = ["assigned", "accepted", "picked_up"].includes(order.status);

    return (
        <section className="driver-detail-view">
            <button type="button" className="driver-back-button" onClick={onBack}>
                <FiArrowLeft /> Rutas
            </button>

            <article className="driver-detail-hero">
                <div className="detail-status-row">
                    <span className={`task-status ${order.status}`}>{getStatusLabel(order.status)}</span>
                    <span>Orden #{order.id}</span>
                </div>
                <h2>{order.customer_name}</h2>
                <p>
                    <FiMapPin />
                    {order.customer_address}
                </p>
            </article>

            <div className="driver-quick-actions">
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="quick-action map">
                    <FiMapPin /> Mapa
                </a>
                <a href={`tel:${order.customer_phone}`} className="quick-action call">
                    <FiPhone /> Llamar
                </a>
                <a href={getWhatsappUrl(order)} target="_blank" rel="noreferrer" className="quick-action whats">
                    <FiMessageCircle /> WhatsApp
                </a>
            </div>

            <button type="button" className="driver-print-button" onClick={onPrint}>
                <FiPrinter /> Imprimir comprobante
            </button>

            <div className="driver-info-grid">
                <InfoBlock icon={<FiPackage />} label="Cliente entregara" value={order.customer_item_description || "Sin detalle capturado"} />
                {order.notes && <InfoBlock icon={<FiClock />} label="Indicaciones" value={order.notes} tone="warning" />}
                <InfoBlock icon={<FiTruck />} label="Tarifa delivery" value={money(order.delivery_fee)} />
                <InfoBlock
                    icon={<FiPackage />}
                    label="Servicio lavanderia"
                    value={Number(order.service_cost || 0) > 0 ? money(order.service_cost) : "Pendiente de pesaje en sucursal"}
                />
                {order.garment_summary && (
                    <InfoBlock icon={<FiCheckSquare />} label="Recogido / validado" value={order.garment_summary} tone="success" />
                )}
                {order.pickup_evidence_path && (
                    <InfoBlock icon={<FiCamera />} label="Evidencia" value="Foto registrada para sucursal" tone="success" />
                )}
                {order.payment_preference && (
                    <InfoBlock
                        icon={<FiDollarSign />}
                        label="Preferencia de pago"
                        value={DELIVERY_PAYMENT_PREFERENCES[order.payment_preference] || order.payment_preference}
                    />
                )}
            </div>

            {order.delivery_payments?.length > 0 && (
                <section className="driver-payments-panel">
                    <h3>Pagos registrados</h3>
                    {order.delivery_payments.filter((payment) => payment.status !== "voided").map((payment) => (
                        <div key={payment.id} className="driver-payment-row">
                            <span>{money(payment.amount)}</span>
                            <small>
                                {DELIVERY_PAYMENT_METHODS[payment.payment_method] || payment.payment_method}
                                {" - "}
                                {payment.status === "reconciled" ? "conciliado" : "pendiente"}
                            </small>
                        </div>
                    ))}
                </section>
            )}

            <div className="driver-bottom-actions">
                <button type="button" className="driver-secondary-action" onClick={onPayment} disabled={loading}>
                    <FiDollarSign /> Registrar pago / abono
                </button>
                {canAdvance && (
                    <button type="button" className="driver-primary-action" onClick={onNextAction} disabled={loading}>
                        <FiCheckSquare /> {getNextActionLabel(order.status)}
                    </button>
                )}
            </div>
        </section>
    );
};

const InfoBlock = ({ icon, label, value, tone = "" }) => (
    <div className={`driver-info-block ${tone}`}>
        <span className="driver-info-icon">{icon}</span>
        <div>
            <small>{label}</small>
            <strong>{value}</strong>
        </div>
    </div>
);
