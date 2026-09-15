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
import { simpleCatalogService } from "../../services/simpleCatalogService";
import { supabase } from "../../supabase";
import { App } from "@capacitor/app";
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
    payment_option: "dejar_todo",
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
    const [availableServices, setAvailableServices] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [foundCustomer, setFoundCustomer] = useState(null);
    const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
    const [customerCandidates, setCustomerCandidates] = useState([]);

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

    const loadAvailableServices = async () => {
        try {
            const services = await simpleCatalogService.getAll();
            setAvailableServices(services);
        } catch (err) {
            console.error("Error al cargar servicios:", err);
        }
    };

    const addServiceToSelection = (service) => {
        setSelectedItems(prev => {
            const existing = prev.find(item => item.service.id === service.id);
            if (existing) {
                return prev.map(item =>
                    item.service.id === service.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { service, quantity: 1 }];
        });
    };

    const updateItemQuantity = (serviceId, delta) => {
        setSelectedItems(prev => {
            return prev.map(item => {
                if (item.service.id === serviceId) {
                    const newQty = item.quantity + delta;
                    return newQty > 0 ? { ...item, quantity: newQty } : item;
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const removeItemFromSelection = (serviceId) => {
        setSelectedItems(prev => prev.filter(item => item.service.id !== serviceId));
    };

    const generateGarmentSummary = () => {
        if (selectedItems.length === 0) return "";
        return selectedItems.map(item => {
            const unit = item.service.pricing_type === 'kg' ? 'kg' : 'pza';
            return `${item.quantity}x ${item.service.name} ($${(item.service.price * item.quantity).toFixed(2)})`;
        }).join(", ");
    };

    const calculateServiceCost = () => {
        return selectedItems.reduce((sum, item) => {
            return sum + (item.service.price * item.quantity);
        }, 0);
    };

    const getServicesByCategory = () => {
        const categories = {};
        availableServices.forEach(service => {
            const cat = service.category || "General";
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(service);
        });
        return categories;
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
            await loadAvailableServices();
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
                loadAvailableServices();
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

    useEffect(() => {
        const IS_DRIVER = import.meta.env?.VITE_BUILD_MODE === "driver";
        if (!IS_DRIVER) return undefined;

        const handler = App.addListener("backButton", ({ canGoBack }) => {
            if (showExpressForm) {
                setShowExpressForm(false);
            } else if (selectedOrderId) {
                setSelectedOrderId(null);
            } else if (authenticated) {
                Swal.fire({
                    title: "Salir de la app?",
                    icon: "question",
                    showCancelButton: true,
                    confirmButtonColor: "#0891b2",
                    cancelButtonColor: "#64748b",
                    confirmButtonText: "Si, salir",
                    cancelButtonText: "Cancelar"
                }).then((result) => {
                    if (result.isConfirmed) App.exitApp();
                });
            } else {
                App.exitApp();
            }
        });

        return () => handler.remove();
    }, [showExpressForm, selectedOrderId, authenticated]);

    // Seleccionar un cliente de la lista de candidatos
    const selectCustomer = (customer) => {
        setFoundCustomer(customer);
        setCustomerCandidates([]);
        handleExpressFormChange('customer_name', customer.name || '');
        handleExpressFormChange('customer_phone', customer.phone || '');
        handleExpressFormChange('customer_address', customer.address || '');
    };

    // Buscar cliente por nombre o teléfono con debounce
    useEffect(() => {
        const name = expressForm.customer_name || "";
        const phone = expressForm.customer_phone || "";
        
        // Determinar qué buscar: teléfono (10+) o nombre (2+)
        const searchQuery = phone.length >= 10 ? phone : name;
        
        if (searchQuery.length < 2) {
            setFoundCustomer(null);
            setCustomerCandidates([]);
            return;
        }

        let cancelled = false;
        setCustomerLookupLoading(true);

        const timer = setTimeout(async () => {
            try {
                const results = await deliveryService.searchCustomers(searchQuery, driver);
                
                if (!cancelled) {
                    if (results.length === 0) {
                        setFoundCustomer(null);
                        setCustomerCandidates([]);
                    } else if (results.length === 1) {
                        // Un solo resultado → autocompletar
                        setFoundCustomer(results[0]);
                        setCustomerCandidates([]);
                        // Autocompletar si los campos están vacíos
                        if (!name || name === results[0].name) {
                            handleExpressFormChange('customer_name', results[0].name || '');
                        }
                        if (results[0].phone) handleExpressFormChange('customer_phone', results[0].phone);
                        if (results[0].address) handleExpressFormChange('customer_address', results[0].address);
                    } else {
                        // Múltiples resultados → mostrar lista de selección
                        setFoundCustomer(null);
                        setCustomerCandidates(results);
                    }
                }
            } catch (err) {
                console.error("Error buscando cliente:", err);
                if (!cancelled) {
                    setFoundCustomer(null);
                    setCustomerCandidates([]);
                }
            } finally {
                if (!cancelled) setCustomerLookupLoading(false);
            }
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [expressForm.customer_name, expressForm.customer_phone, driver]);

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

                    <label style="font-weight:700; font-size:12px; display:block; margin-top:10px;">Foto comprobante (opcional)</label>
                    <input id="driver-payment-proof" type="file" accept="image/*" capture="environment" style="width:85%; margin-top:4px;">
                    <small style="color:#64748b;">Adjunta foto de transferencia, deposito o referencia.</small>
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
                const proofFile = document.getElementById("driver-payment-proof").files?.[0] || null;
                if (!amount || Number(amount) <= 0) {
                    Swal.showValidationMessage("Ingresa un monto valido.");
                    return false;
                }
                if (["transferencia", "tarjeta"].includes(payment_method) && !reference.trim()) {
                    Swal.showValidationMessage("La referencia es obligatoria para transferencia o tarjeta.");
                    return false;
                }
                if (proofFile && proofFile.size > 8 * 1024 * 1024) {
                    Swal.showValidationMessage("La imagen no debe pesar mas de 8 MB.");
                    return false;
                }
                return { amount, payment_method, reference, proofFile };
            }
        });

        if (!formValues) return;

        try {
            setLoading(true);
            // Upload proof photo if provided
            let proofPhotoPath = null;
            if (formValues.proofFile) {
                try {
                    const fileExt = formValues.proofFile.name.split('.').pop() || 'jpg';
                    const fileName = `payment-proof-${order.id}-${Date.now()}.${fileExt}`;
                    const { data: uploadData, error: uploadErr } = await supabase.storage
                        .from('delivery-evidence')
                        .upload(fileName, formValues.proofFile, { upsert: false });
                    if (uploadErr) {
                        console.warn("Error subiendo foto comprobante:", uploadErr);
                    } else {
                        proofPhotoPath = uploadData?.path || fileName;
                    }
                } catch (uploadErr) {
                    console.warn("No se pudo subir foto comprobante:", uploadErr);
                }
            }
            await deliveryService.createDriverPayment(order, {
                amount: formValues.amount,
                payment_method: formValues.payment_method,
                reference: formValues.reference,
                proof_photo_path: proofPhotoPath
            }, driver);
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
        if (selectedItems.length === 0) {
            Swal.fire("Selecciona servicios", "Agrega al menos un servicio recolectado.", "warning");
            return;
        }

        const garmentSummary = generateGarmentSummary();
        const serviceCost = calculateServiceCost();
        const orderItems = selectedItems.map(item => ({
            product_id: item.service.id,
            product_name: item.service.name,
            quantity: item.quantity,
            price: item.service.price,
            pricing_type: item.service.pricing_type || 'unit',
            category: item.service.category || null,
            cost_price: item.service.cost_price || null
        }));

        setExpressLoading(true);
        try {
            const result = await deliveryService.createExpressPickup({
                driver: driver,
                customer_name: f.customer_name.trim(),
                customer_phone: f.customer_phone.trim(),
                customer_address: f.customer_address.trim(),
                garment_summary: garmentSummary,
                notes: f.notes.trim(),
                delivery_fee: Number(f.delivery_fee) || 0,
                service_cost: serviceCost,
                order_items: orderItems,
                payment_preference: f.payment_preference,
                pickup_evidence_path: null,
                create_pos_order: true,
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
            setSelectedItems([]);

            // Verificar si la orden POS se creó correctamente
            const posOrderCreated = result.pos_order != null;
            const posWarning = result.pos_order_warning || (!posOrderCreated && "La orden POS no se pudo generar. Procese desde el panel de Delivery.");

            // Offer to print
            const successText = posOrderCreated
                ? `Pedido #${result.order.id} y orden POS Folio #${result.pos_order.folio} creados correctamente.`
                : `Pedido #${result.order.id} creado correctamente.${posWarning ? '\n' + posWarning : ''}`;

            const printResult = await Swal.fire({
                title: "Recoleccion registrada",
                text: successText,
                icon: posOrderCreated ? "success" : "warning",
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
                    <button className="driver-icon-button driver-logout-button" onClick={handleLogout} title="Cerrar sesión">
                        <FiLogOut />
                        <span>Salir</span>
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
                            
                            {/* Indicador de carga */}
                            {customerLookupLoading && (
                                <div className="driver-customer-lookup-loading">
                                    <span className="driver-lookup-spinner" /> Buscando cliente...
                                </div>
                            )}

                            {/* Cliente encontrado (único) */}
                            {!customerLookupLoading && foundCustomer && (
                                <div className="driver-customer-found">
                                    <span className="driver-customer-found-icon">✓</span>
                                    <div className="driver-customer-found-info">
                                        <span className="driver-customer-found-name">Cliente: {foundCustomer.name}</span>
                                        <span className="driver-customer-found-visits">
                                            {foundCustomer.delivery_visit_count || 0} visita{(foundCustomer.delivery_visit_count || 0) !== 1 ? 's' : ''} previa{(foundCustomer.delivery_visit_count || 0) !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Múltiples candidatos - lista de selección */}
                            {!customerLookupLoading && customerCandidates.length > 0 && (
                                <div className="driver-customer-candidates">
                                    <span className="driver-candidates-label">
                                        Selecciona un cliente ({customerCandidates.length} encontrado{customerCandidates.length !== 1 ? 's' : ''}):
                                    </span>
                                    <div className="driver-candidates-list">
                                        {customerCandidates.map(customer => (
                                            <button
                                                key={customer.id}
                                                type="button"
                                                className="driver-candidate-item"
                                                onClick={() => selectCustomer(customer)}
                                                disabled={expressLoading}
                                            >
                                                <div className="driver-candidate-main">
                                                    <span className="driver-candidate-name">{customer.name}</span>
                                                    <span className="driver-candidate-phone">{customer.phone || 'Sin teléfono'}</span>
                                                </div>
                                                <div className="driver-candidate-meta">
                                                    <span className="driver-candidate-visits">
                                                        {customer.delivery_visit_count || 0} visita{(customer.delivery_visit_count || 0) !== 1 ? 's' : ''}
                                                    </span>
                                                    {customer.address && (
                                                        <span className="driver-candidate-address">{customer.address}</span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Nuevo cliente */}
                            {!customerLookupLoading && !foundCustomer && customerCandidates.length === 0 && 
                             (expressForm.customer_name.length >= 2 || expressForm.customer_phone.length >= 10) && (
                                <div className="driver-customer-new">
                                    <span className="driver-customer-new-icon">+</span>
                                    <span>Nuevo cliente</span>
                                </div>
                            )}

                            <label className="driver-form-label">Direccion *</label>
                            <input className="driver-form-input" type="text" placeholder="Calle, colonia, numero"
                                value={expressForm.customer_address}
                                onChange={(e) => handleExpressFormChange("customer_address", e.target.value)}
                                disabled={expressLoading} />

                            <label className="driver-form-label">Servicios recolectados *</label>
                            
                            {/* Resumen de servicios seleccionados */}
                            {selectedItems.length > 0 && (
                                <div className="driver-selected-items">
                                    {selectedItems.map(item => (
                                        <div key={item.service.id} className="driver-selected-item">
                                            <div className="driver-selected-item-info">
                                                <span className="driver-selected-item-name">{item.service.name}</span>
                                                <span className="driver-selected-item-price">${(item.service.price * item.quantity).toFixed(2)}</span>
                                            </div>
                                            <div className="driver-selected-item-controls">
                                                <button type="button" className="driver-qty-btn" 
                                                    onClick={() => updateItemQuantity(item.service.id, -1)}
                                                    disabled={expressLoading}>-</button>
                                                <span className="driver-qty-value">{item.quantity} {item.service.pricing_type === 'kg' ? 'kg' : 'pza'}</span>
                                                <button type="button" className="driver-qty-btn"
                                                    onClick={() => updateItemQuantity(item.service.id, 1)}
                                                    disabled={expressLoading}>+</button>
                                                <button type="button" className="driver-remove-item-btn"
                                                    onClick={() => removeItemFromSelection(item.service.id)}
                                                    disabled={expressLoading}>
                                                    <FiX size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="driver-selected-total">
                                        <span>Servicio total:</span>
                                        <strong>${calculateServiceCost().toFixed(2)}</strong>
                                    </div>
                                </div>
                            )}

                            <div className="driver-form-divider" />

                            {/* Lista de servicios disponibles */}
                            <div className="driver-services-header">
                                <span className="driver-services-count">{availableServices.length} servicios disponibles</span>
                            </div>
                            {availableServices.length > 0 ? (
                                <div className="driver-services-grid">
                                    {Object.entries(getServicesByCategory()).map(([category, services]) => (
                                        <div key={category} className="driver-service-category">
                                            <span className="driver-category-label">{category}</span>
                                            <div className="driver-service-chips">
                                                {services.map(service => (
                                                    <button key={service.id} type="button" className="driver-service-chip"
                                                        onClick={() => addServiceToSelection(service)}
                                                        disabled={expressLoading}>
                                                        <span className="driver-chip-name">{service.name}</span>
                                                        <span className="driver-chip-price">${service.price.toFixed(2)} / {service.pricing_type === 'kg' ? 'kg' : 'pza'}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="driver-no-services">
                                    <p>No hay servicios configurados en el sistema.</p>
                                </div>
                            )}

                            <label className="driver-form-label">Notas adicionales (opcional)</label>
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

                            <label className="driver-form-label">Monto a pagar ahora</label>
                            <div className="driver-payment-options">
                                {[
                                    { key: "completo", label: "Completo", sub: "100%" },
                                    { key: "50", label: "50%", sub: "mitad" },
                                    { key: "dejar_todo", label: "Dejar todo", sub: "despues" }
                                ].map(opt => (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        className={`driver-payment-option-btn ${expressForm.payment_option === opt.key ? 'active' : ''}`}
                                        onClick={() => {
                                            const fee = Number(expressForm.delivery_fee) || 0;
                                            let amount = 0;
                                            let register = false;
                                            if (opt.key === "completo") { amount = fee; register = fee > 0; }
                                            else if (opt.key === "50") { amount = Math.round(fee * 0.5 * 100) / 100; register = fee > 0; }
                                            handleExpressFormChange("payment_option", opt.key);
                                            handleExpressFormChange("payment_amount", amount);
                                            handleExpressFormChange("register_payment", register);
                                        }}
                                        disabled={expressLoading}
                                    >
                                        <div className="driver-payment-option-label">{opt.label}</div>
                                        <div className="driver-payment-option-sub">{opt.sub}</div>
                                    </button>
                                ))}
                            </div>

                            {expressForm.payment_option !== "dejar_todo" && (
                                <div className="driver-form-payment-fields">
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
                    value={Number(order.service_cost || 0) > 0
                        ? `${money(order.service_cost)}${order.auto_quoted ? ' (auto)' : ''}`
                        : "Pendiente de pesaje en sucursal"}
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
