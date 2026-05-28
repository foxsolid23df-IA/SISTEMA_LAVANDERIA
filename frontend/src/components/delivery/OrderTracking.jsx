import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
    FiCheckCircle,
    FiClock,
    FiCornerDownRight,
    FiMapPin,
    FiPackage,
    FiRefreshCw,
    FiTruck
} from "react-icons/fi";
import { DELIVERY_PAYMENT_METHODS, DELIVERY_PAYMENT_PREFERENCES, deliveryService } from "../../services/deliveryService";
import "./OrderTracking.css";

const POLL_INTERVAL_MS = 15000;

const statusSteps = [
    { key: "requested", label: "Solicitado", short: "Solicitud recibida", icon: <FiClock /> },
    { key: "accepted", label: "Aceptado", short: "La sucursal acepto tu pedido", icon: <FiCheckCircle /> },
    { key: "assigned", label: "Repartidor en camino", short: "Vamos hacia tu domicilio", icon: <FiTruck /> },
    { key: "picked_up", label: "Ropa recogida", short: "Tus prendas van a la sucursal", icon: <FiCornerDownRight /> },
    { key: "delivered_to_store", label: "En lavanderia", short: "Tu ropa esta en proceso", icon: <FiPackage /> },
    { key: "completed", label: "Completado", short: "Pedido entregado", icon: <FiCheckCircle /> }
];

const statusCopy = {
    requested: {
        title: "Solicitud recibida",
        detail: "Estamos revisando tu pedido para asignar un repartidor."
    },
    accepted: {
        title: "Pedido aceptado",
        detail: "La sucursal ya acepto tu solicitud de recogida."
    },
    assigned: {
        title: "Repartidor en camino",
        detail: "Tu repartidor ya fue asignado y va hacia tu domicilio."
    },
    picked_up: {
        title: "Ropa recogida",
        detail: "Tus prendas ya fueron recogidas y van camino a la sucursal."
    },
    delivered_to_store: {
        title: "En lavanderia",
        detail: "Tu ropa ya esta en la sucursal para su proceso de lavado."
    },
    completed: {
        title: "Pedido completado",
        detail: "Gracias por confiar en nosotros."
    }
};

const money = (value) => `$${Number(value || 0).toFixed(2)} MXN`;

const isServicePending = (status) => ["requested", "accepted", "assigned"].includes(status);

export const OrderTracking = () => {
    const { token } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [itemDescription, setItemDescription] = useState("");
    const [paymentPreference, setPaymentPreference] = useState("");
    const [savingPreference, setSavingPreference] = useState(false);
    const formDirtyRef = useRef(false);

    useEffect(() => {
        if (!token) {
            setError("No se proporciono un token de seguimiento.");
            setLoading(false);
            return undefined;
        }

        let alive = true;

        const fetchOrder = async ({ initial = false } = {}) => {
            try {
                if (initial) setLoading(true);
                const data = await deliveryService.getOrderByTrackingToken(token);
                if (!alive) return;
                setOrder(data);
                if (initial || !formDirtyRef.current || data?.payment_preference_confirmed_at) {
                    setItemDescription(data?.customer_item_description || data?.garment_summary || "");
                    setPaymentPreference(data?.payment_preference || "");
                }
                setError(null);
                setSyncError(null);
                setLastUpdated(new Date());
            } catch (err) {
                console.error("Error al obtener pedido:", err);
                if (!alive) return;

                if (initial) {
                    setError("No pudimos encontrar la informacion de este pedido. Verifica tu enlace.");
                } else {
                    setSyncError("No se pudo actualizar en este momento. Reintentaremos automaticamente.");
                }
            } finally {
                if (alive && initial) setLoading(false);
            }
        };

        fetchOrder({ initial: true });
        const intervalId = window.setInterval(() => fetchOrder(), POLL_INTERVAL_MS);

        return () => {
            alive = false;
            window.clearInterval(intervalId);
        };
    }, [token]);

    const activeIndex = useMemo(() => {
        const index = statusSteps.findIndex((step) => step.key === order?.status);
        return index >= 0 ? index : 0;
    }, [order?.status]);

    const currentStep = statusSteps[activeIndex] || statusSteps[0];
    const currentCopy = statusCopy[order?.status] || {
        title: currentStep.label,
        detail: "Tu pedido esta en seguimiento."
    };
    const totalPaid = Number(order?.paid_amount || 0);
    const balanceDue = Number(order?.balance_due ?? Math.max(0, Number(order?.total_cost || 0) - totalPaid));
    const pickupFee = Number(order?.delivery_fee || 0);
    const hasPickupQuote = Boolean(order?.pickup_quote_confirmed_at);
    const canConfirmPreference = hasPickupQuote;
    const needsPreference = order && !order.payment_preference_confirmed_at && !["completed", "cancelled"].includes(order.status);

    const handleSavePreference = async (event) => {
        event.preventDefault();
        if (!canConfirmPreference) {
            setSyncError("La sucursal aun no ha capturado la tarifa de recogida. Espera la cotizacion antes de confirmar.");
            return;
        }
        if (!paymentPreference) {
            setSyncError("Selecciona cuando prefieres pagar.");
            return;
        }

        try {
            setSavingPreference(true);
            await deliveryService.updatePublicDeliveryRequest(token, {
                customer_item_description: itemDescription,
                payment_preference: paymentPreference
            });
            const refreshed = await deliveryService.getOrderByTrackingToken(token);
            formDirtyRef.current = false;
            setOrder(refreshed);
            setItemDescription(refreshed?.customer_item_description || refreshed?.garment_summary || "");
            setPaymentPreference(refreshed?.payment_preference || "");
            setSyncError(null);
        } catch (err) {
            console.error("Error guardando preferencia:", err);
            setSyncError("No pudimos guardar tu preferencia. Intentalo de nuevo.");
        } finally {
            setSavingPreference(false);
        }
    };

    if (loading) {
        return (
            <main className="tracking-page tracking-page-centered">
                <section className="tracking-loader-card">
                    <div className="tracking-spinner" />
                    <p>Cargando seguimiento...</p>
                </section>
            </main>
        );
    }

    if (error || !order) {
        return (
            <main className="tracking-page tracking-page-centered">
                <section className="tracking-error-card">
                    <span className="tracking-error-icon">!</span>
                    <h1>Enlace no valido</h1>
                    <p>{error || "No se ha proporcionado un token correcto."}</p>
                    <Link to="/" className="tracking-home-link">Ir al inicio</Link>
                </section>
            </main>
        );
    }

    return (
        <main className="tracking-page">
            <section className="tracking-shell">
                <header className="tracking-hero">
                    <div>
                        <p className="tracking-store">{order.store_name || "Lavanderia"}</p>
                        <h1>{currentCopy.title}</h1>
                        <p className="tracking-hero-detail">{currentCopy.detail}</p>
                    </div>
                    <div className="tracking-order-pill">
                        <span>Orden</span>
                        <strong>#{order.id}</strong>
                    </div>
                </header>

                <section className="tracking-status-card">
                    <div className="tracking-current-icon">{currentStep.icon}</div>
                    <div>
                        <span className="tracking-live-badge">
                            <span className="tracking-live-dot" />
                            Seguimiento activo
                        </span>
                        <h2>{currentStep.short}</h2>
                        <p>
                            {lastUpdated
                                ? `Ultima actualizacion: ${lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`
                                : "Actualizando estatus..."}
                        </p>
                    </div>
                </section>

                {syncError && (
                    <div className="tracking-sync-warning">
                        <FiRefreshCw />
                        <span>{syncError}</span>
                    </div>
                )}

                {needsPreference && (
                    <section className="tracking-preference-card">
                        <div>
                            <span className="tracking-section-kicker">Antes de enviar al repartidor</span>
                            <h2>Confirma que entregaras y como prefieres pagar</h2>
                            <p>
                                Revisa la tarifa de recogida antes de confirmar. El costo final del lavado se calcula en sucursal al pesar o revisar tus prendas.
                            </p>
                            <div className={hasPickupQuote ? "tracking-quote-box" : "tracking-quote-box pending"}>
                                <span>Tarifa de recogida</span>
                                <strong>{hasPickupQuote ? money(pickupFee) : "Pendiente de cotizar"}</strong>
                                <small>
                                    {hasPickupQuote
                                        ? "Esta es la tarifa que apruebas para enviar al repartidor."
                                        : "La sucursal debe capturar la tarifa para que puedas confirmar."}
                                </small>
                                {order.quote_notes && <small>{order.quote_notes}</small>}
                            </div>
                        </div>
                        <form onSubmit={handleSavePreference} className="tracking-preference-form">
                            <label>
                                <span>Que vamos a recoger</span>
                                <textarea
                                    value={itemDescription}
                                    onChange={(event) => {
                                        formDirtyRef.current = true;
                                        setItemDescription(event.target.value);
                                    }}
                                    placeholder="Ej. 2 bolsas negras, 1 cobertor matrimonial, 5 camisas, ropa delicada en bolsa aparte..."
                                    rows={5}
                                />
                            </label>

                            <div className="tracking-payment-options">
                                {Object.entries(DELIVERY_PAYMENT_PREFERENCES).map(([value, label]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={paymentPreference === value ? "selected" : ""}
                                        onClick={() => {
                                            formDirtyRef.current = true;
                                            setPaymentPreference(value);
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <button type="submit" className="tracking-save-preference" disabled={savingPreference || !canConfirmPreference}>
                                {savingPreference ? "Guardando..." : canConfirmPreference ? "Confirmar preferencia" : "Esperando cotizacion"}
                            </button>
                        </form>
                    </section>
                )}

                <section className="tracking-layout">
                    <div className="tracking-progress-card">
                        <h2>Avance del pedido</h2>
                        <div className="tracking-timeline">
                            {statusSteps.map((step, index) => {
                                const done = index < activeIndex;
                                const active = index === activeIndex;
                                const pending = index > activeIndex;

                                return (
                                    <div
                                        key={step.key}
                                        className={`tracking-step ${done ? "done" : ""} ${active ? "active" : ""} ${pending ? "pending" : ""}`}
                                    >
                                        <div className="tracking-step-marker">
                                            {done ? <FiCheckCircle /> : step.icon}
                                        </div>
                                        <div className="tracking-step-body">
                                            <strong>{step.label}</strong>
                                            <span>{step.short}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <aside className="tracking-details">
                        <section className="tracking-panel">
                            <h2>Resumen</h2>
                            <dl className="tracking-data-list">
                                <div>
                                    <dt>Cliente</dt>
                                    <dd>{order.customer_name}</dd>
                                </div>
                                <div>
                                    <dt>Repartidor</dt>
                                    <dd>{order.driver_name || "Pendiente de asignacion"}</dd>
                                </div>
                                <div>
                                    <dt>Direccion</dt>
                                    <dd className="tracking-address">
                                        <FiMapPin />
                                        <span>{order.customer_address}</span>
                                    </dd>
                                </div>
                                {order.notes && (
                                    <div>
                                        <dt>Notas</dt>
                                        <dd>{order.notes}</dd>
                                    </div>
                                )}
                                {order.garment_summary && (
                                    <div>
                                        <dt>Prendas</dt>
                                        <dd>{order.garment_summary}</dd>
                                    </div>
                                )}
                                {order.customer_item_description && (
                                    <div>
                                        <dt>La clienta entregara</dt>
                                        <dd>{order.customer_item_description}</dd>
                                    </div>
                                )}
                                {order.payment_preference && (
                                    <div>
                                        <dt>Preferencia de pago</dt>
                                        <dd>{DELIVERY_PAYMENT_PREFERENCES[order.payment_preference] || order.payment_preference}</dd>
                                    </div>
                                )}
                            </dl>
                        </section>

                        <section className="tracking-panel">
                            <h2>Costos</h2>
                            <div className="tracking-cost-row">
                                <span>Servicio</span>
                                <strong>{isServicePending(order.status) ? "Pendiente de pesaje" : money(order.service_cost)}</strong>
                            </div>
                            <div className="tracking-cost-row">
                                <span>Delivery</span>
                                <strong>{hasPickupQuote ? money(order.delivery_fee) : "Pendiente de cotizar"}</strong>
                            </div>
                            <div className="tracking-cost-total">
                                <span>Total estimado</span>
                                <strong>
                                    {isServicePending(order.status)
                                        ? (hasPickupQuote ? `${money(order.delivery_fee)} + servicio` : "Pendiente de cotizar")
                                        : money(order.total_cost)}
                                </strong>
                            </div>
                            <div className="tracking-cost-row">
                                <span>Abonado</span>
                                <strong>{money(totalPaid)}</strong>
                            </div>
                            <div className="tracking-cost-total">
                                <span>Saldo pendiente</span>
                                <strong>{isServicePending(order.status) ? "Por definir" : money(balanceDue)}</strong>
                            </div>
                        </section>

                        <section className="tracking-panel">
                            <h2>Pagos y comprobantes</h2>
                            {order.payments?.length > 0 ? (
                                <div className="tracking-payments-list">
                                    {order.payments.map((payment, index) => (
                                        <div key={`${payment.receipt_token || index}`} className="tracking-payment-item">
                                            <div>
                                                <strong>{money(payment.amount)}</strong>
                                                <span>{DELIVERY_PAYMENT_METHODS[payment.payment_method] || payment.payment_method}</span>
                                            </div>
                                            <small>
                                                {payment.status === "reconciled" ? "Confirmado por sucursal" : "Recibido por chofer"}
                                            </small>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="tracking-empty-copy">Aun no hay pagos o abonos registrados.</p>
                            )}
                        </section>
                    </aside>
                </section>

                <footer className="tracking-footer">
                    <span>FoxSolid Laundry System</span>
                    <span>Actualizacion automatica cada 15 segundos</span>
                </footer>
            </section>
        </main>
    );
};
