import React, { useEffect, useMemo, useState } from "react";
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
    FiRefreshCw,
    FiTruck
} from "react-icons/fi";
import Swal from "sweetalert2";
import { DELIVERY_PAYMENT_METHODS, DELIVERY_PAYMENT_PREFERENCES, deliveryService } from "../../services/deliveryService";
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

export const DriverPortal = ({ desktopPreview = false, onExitPreview }) => {
    const [pin, setPin] = useState("");
    const [driver, setDriver] = useState(null);
    const [orders, setOrders] = useState([]);
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(false);

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
            localStorage.setItem("driver_session", JSON.stringify(verifiedDriver));
            await loadDriverOrders(verifiedDriver.id, verifiedDriver.session_token);
            setPin("");
        } catch (err) {
            console.error("Error al validar PIN:", err);
            Swal.fire("Error", "Error al intentar iniciar sesion.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const savedSession = localStorage.getItem("driver_session");
        if (savedSession) {
            const parsedDriver = JSON.parse(savedSession);
            if (!parsedDriver?.session_token) {
                localStorage.removeItem("driver_session");
                return;
            }
            setDriver(parsedDriver);
            setAuthenticated(true);
            loadDriverOrders(parsedDriver.id, parsedDriver.session_token);
        }
    }, []);

    useEffect(() => {
        if (!driver) return undefined;

        const channel = supabase
            .channel(`driver-orders-realtime:${driver.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "delivery_orders", filter: `driver_id=eq.${driver.id}` },
                () => loadDriverOrders(driver.id, driver.session_token)
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [driver]);

    const handleLogout = () => {
        localStorage.removeItem("driver_session");
        setDriver(null);
        setAuthenticated(false);
        setSelectedOrderId(null);
        setOrders([]);
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
                        <button className="driver-icon-button" onClick={() => loadDriverOrders(driver.id, driver.session_token)} title="Actualizar">
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
                />
            ) : (
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
                            <button className="btn-driver-refresh" onClick={() => loadDriverOrders(driver.id, driver.session_token)}>
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
            )}
        </main>
    );
};

const DriverOrderDetail = ({ order, loading, onBack, onPayment, onNextAction }) => {
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
