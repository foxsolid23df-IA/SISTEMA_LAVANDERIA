import React, { useState, useEffect, useRef, useMemo } from "react";
import { useProducts } from "../../contexts/ProductContext";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useApi } from "../../hooks/useApi";
import { customerService } from "../../services/customerService";
import { orderService } from "../../services/orderService";
import { productService } from "../../services/productService";
import { businessSettingsService } from "../../services/businessSettingsService";
import { exchangeRateService } from "../../services/exchangeRateService";
import { printService } from "../../services/printService";
import { expressServicesService } from "../../services/expressServicesService";
import { deliveryService } from "../../services/deliveryService";
import { shelvingService } from "../../services/shelvingService";
import { staffService } from "../../services/staffService";
import { useKeepAwake } from "../../hooks/useKeepAwake";

import { useSettings } from "../../contexts/SettingsContext";
import { formatearDinero } from "../../utils";
import Swal from "sweetalert2";
import TicketVenta from "./TicketVenta";
import RemisionPreviewModal from "./RemisionPreviewModal";
import Modal from "../common/Modal";
import { CashFundModal } from "../auth/CashFundModal";
import { ClientRegistrationModal } from "./ClientRegistrationModal";
import VisionAIModal from "../ai/VisionAIModal";
import "./Sales.css";
import KgQuantityModal from "./KgQuantityModal";

// Componente de Punto de Venta especifico para Lavanderia
export const Sales = () => {
  useKeepAwake(true)

  const {
    user,
    cashSession,
    activeStaff,
    storeName,
    checkCashSession,
    adminMode,
  } = useAuth();
  const [showCashFundModal, setShowCashFundModal] = useState(false);

  // Estado para el modal de cantidad KG (reemplazo de bascula)
  const [kgModalProduct, setKgModalProduct] = useState(null);

  const { productos, loading: loadingProducts, loadProducts } = useProducts();
  const {
    carrito,
    agregarProducto,
    cambiarCantidad,
    quitarProducto,
    vaciarCarrito,
    total,
  } = useCart((msg) => Swal.fire("Error", msg, "error"));

  // Estados de busqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Estados de Cliente y Orden
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isExpressModalOpen, setIsExpressModalOpen] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [notas, setNotas] = useState("");
  const [anticipo, setAnticipo] = useState(0);
  const [deliveryContext, setDeliveryContext] = useState(null);

  // Estados de Pago
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [metodoPago, setMetodoPago] = useState("cash");
  const [ventaCompletada, setVentaCompletada] = useState(null);
  const autoPrintStarted = useRef(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cashPayments, setCashPayments] = useState({});
  const [activeCurrencies, setActiveCurrencies] = useState([{ currency_code: 'MXN', rate: 1 }]);

  // Impuestos
  const [wantsInvoice, setWantsInvoice] = useState(false);

  // IA States
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Modo de Venta (Filtro Principal)
  const [saleMode, setSaleMode] = useState("SERVICE"); // 'SERVICE', 'PRODUCT', 'COMMON' o 'EXPRESS'

  // Estado para Producto Comun
  const [commonProductForm, setCommonProductForm] = useState({
    description: "",
    quantity: 1,
    price: "",
  });

  const [expressForm, setExpressForm] = useState({
    name: "",
    price: "",
    notes: "",
  });

  const { settings } = useSettings();
  const [staffList, setStaffList] = useState([]);
  const [assignedStaffId, setAssignedStaffId] = useState("");

  useEffect(() => {
    if (settings?.employee_production_enabled) {
      staffService.getStaff()
        .then(data => setStaffList(data || []))
        .catch(console.error);
    }
  }, [settings?.employee_production_enabled]);

  const activeStaffList = staffList.filter(s => s.active);

  const [configuredExpressServices, setConfiguredExpressServices] = useState([]);

  useEffect(() => {
    expressServicesService.getExpressServices()
      .then(data => {
        if (data && data.length > 0) {
          setConfiguredExpressServices(data);
        }
      })
      .catch(err => console.error("Error loading express services:", err));
  }, []);

  // Efecto para precargar carrito desde delivery
  useEffect(() => {
    const deliveryPreload = sessionStorage.getItem("delivery_preload_cart");
    if (deliveryPreload) {
      try {
        const data = JSON.parse(deliveryPreload);
        setDeliveryContext(data);
        
        // 1. Limpiar carrito existente para evitar mezclas
        vaciarCarrito();
        setAssignedStaffId("");
        
        // 2. Crear item ficticio para representar el servicio de lavanderia del pedido delivery.
        const garmentDetail = data.garment_summary || data.customer_item_description || 'PRENDAS';
        const deliveryItem = {
          id: `delivery-service-${data.delivery_order_id}`,
          name: `SERVICIO DE LAVANDERIA: ${garmentDetail.toUpperCase()}`,
          price: parseFloat(data.service_cost) || 0,
          type: "SERVICE",
          pricing_type: "unit",
          is_common: true,
          stock: 999999
        };
        
        // Agregar el servicio de ropa al carrito
        agregarProducto(deliveryItem, 1);
        
        // Si hay una tarifa de envio, agregarla como item
        if (parseFloat(data.delivery_fee) > 0) {
          const feeItem = {
            id: `delivery-fee-${data.delivery_order_id}`,
            name: "TARIFA DE RECOGIDA / DELIVERY",
            price: parseFloat(data.delivery_fee),
            type: "PRODUCT",
            pricing_type: "unit",
            is_common: true,
            stock: 999999
          };
          agregarProducto(feeItem, 1);
        }
        
        // 3. Cargar datos del cliente
        customerService.searchCustomers(data.customer_phone)
          .then(results => {
            if (results && results.length > 0) {
              setClienteSeleccionado(results[0]);
              setBusquedaCliente(results[0].name);
            } else {
              const tempClient = { id: null, name: data.customer_name, phone: data.customer_phone };
              setClienteSeleccionado(tempClient);
              setBusquedaCliente(data.customer_name);
            }
          })
          .catch(err => {
            console.error("Error buscando cliente de delivery:", err);
            const tempClient = { id: null, name: data.customer_name, phone: data.customer_phone };
            setClienteSeleccionado(tempClient);
            setBusquedaCliente(data.customer_name);
          });
          
        // 4. Copiar notas e inyectar ID del delivery en las notas
        setNotas(`[Delivery #${data.delivery_order_id}] ${data.customer_item_description ? `Cliente entrego: ${data.customer_item_description}. ` : ''}${data.notes || ''}`);
        setAnticipo(Number(data.paid_amount) || 0);
        
        // 5. Mostrar confirmacion de carga
        Swal.fire({
          icon: "success",
          title: "Datos de Delivery Cargados",
          text: `Pedido #${data.delivery_order_id} cargado con exito en caja.`,
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: "top-end"
        });
        
      } catch (err) {
        console.error("Error al parsear preload de delivery:", err);
      } finally {
        sessionStorage.removeItem("delivery_preload_cart");
      }
    }
  }, [productos]);

  // Mobile Cart State
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Referencias
  const ticketRef = useRef(null);
  const [showRemisionPreview, setShowRemisionPreview] = useState(false);



  // Handler para agregar servicio express manual
  const handleAddExpressService = () => {
    if (!expressForm.name.trim()) {
      Swal.fire("Incompleto", "Ingresa el nombre del servicio express", "warning");
      return;
    }
    const price = parseFloat(expressForm.price);
    if (isNaN(price) || price <= 0) {
      Swal.fire("Precio Invalido", "El precio debe ser un numero mayor a 0", "error");
      return;
    }

    const item = {
      id: `express-${Date.now()}`,
      name: `Express: ${expressForm.name.trim().toUpperCase()}`,
      price: price,
      type: "EXPRESS",
      pricing_type: "unit",
      is_common: true,
      express_notes: expressForm.notes.trim() || "",
      stock: 999999,
    };

    agregarProducto(item, 1);

    // Si hay notas del express, anexarlas a las notas de la orden
    if (expressForm.notes.trim()) {
      setNotas(prev => {
        const separator = prev.trim() ? "\n" : "";
        return `${prev}${separator}[Express: ${expressForm.name.trim().toUpperCase()}] ${expressForm.notes.trim()}`;
      });
    }

    setExpressForm({ name: "", price: "", notes: "" });
    setIsExpressModalOpen(false);

    Swal.fire({
      icon: "success",
      title: "Servicio Express Agregado",
      text: `${expressForm.name.trim().toUpperCase()} anadido a la orden`,
      timer: 1500,
      showConfirmButton: false,
      position: "top-end",
      toast: true,
    });
  };

  // Filtrado de productos/servicios
  const filteredProducts = useMemo(() => {
    // EXPRESS se maneja con formulario manual, no necesita filtrado
    if (saleMode === "EXPRESS") return [];

    return productos.filter((p) => {
      // Filtro de Modo (Servicio vs Producto)
      const productType = p.type || "SERVICE";
      if (productType !== saleMode) return false;

      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm));
      const matchesCategory =
        filterCategory === "all" || p.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [productos, searchTerm, filterCategory, saleMode]);

  // Estados de configuracion (Settings vaticano desde Context)
  const { settings: businessSettings, loading: loadingSettings } =
    useSettings();
  // Cargar monedas activas al iniciar
  useEffect(() => {
    exchangeRateService
      .getActiveRates()
      .then((rates) => {
        if (rates && rates.length > 0) {
          setActiveCurrencies([{ currency_code: 'MXN', rate: 1 }, ...rates]);
        } else {
          setActiveCurrencies([{ currency_code: 'MXN', rate: 1 }]);
        }
      })
      .catch((err) => console.error("Error loading exchange rates:", err));
  }, []);

  // Efecto para auto-impresion
  useEffect(() => {
    if (ventaCompletada && businessSettings?.ticket_preview === false && !isPrinting) {
      if (!autoPrintStarted.current) {
        autoPrintStarted.current = true;
        const autoPrint = async () => {
          setTimeout(async () => {
             // Solo llamamos imprimir si aun esta activo el ref
             if (ticketRef.current) {
                await imprimirTicket();
             }
             setVentaCompletada(null); 
          }, 300);
        };
        autoPrint();
      }
    } else if (!ventaCompletada) {
       autoPrintStarted.current = false;
    }
  }, [ventaCompletada, businessSettings, isPrinting]);

  // Busqueda de clientes
  useEffect(() => {
    if (busquedaCliente.length >= 2) {
      customerService
        .searchCustomers(busquedaCliente)
        .then(setClientes)
        .catch(console.error);
    } else {
      setClientes([]);
    }
  }, [busquedaCliente]);

  const handleClientRegistered = (newClient) => {
    setClienteSeleccionado(newClient);
    setBusquedaCliente(newClient.name);
    setIsClientModalOpen(false);
  };

  const handleAddCommonProduct = () => {
    if (!commonProductForm.description || !commonProductForm.price) {
      Swal.fire("Incompleto", "Favor de llenar todos los campos", "warning");
      return;
    }

    const price = parseFloat(commonProductForm.price);
    const quantity = parseFloat(commonProductForm.quantity) || 1;

    if (isNaN(price) || price <= 0) {
      Swal.fire(
        "Precio Invalido",
        "El precio debe ser un numero mayor a 0",
        "error",
      );
      return;
    }

    const item = {
      id: `common-${Date.now()}`,
      name: commonProductForm.description.toUpperCase(),
      price: price,
      type: "PRODUCT",
      pricing_type: "unit",
      is_common: true,
      stock: 999999,
    };

    agregarProducto(item, quantity);
    setCommonProductForm({ description: "", quantity: 1, price: "" });

    Swal.fire({
      icon: "success",
      title: "Agregado",
      text: "Producto anadido a la orden",
      timer: 1500,
      showConfirmButton: false,
      position: "top-end",
      toast: true,
    });
  };

  // Calculo de totales con impuestos
  const globalTaxRate =
    businessSettings?.tax_percentage !== undefined &&
    businessSettings?.tax_percentage !== null
      ? parseFloat(businessSettings.tax_percentage)
      : 16;
  const taxAmount = wantsInvoice ? total * (globalTaxRate / 100) : 0;
  const finalTotal = total + taxAmount;

  // Procesar Orden
  const handleProcessOrder = async () => {
    if (!cashSession) {
      Swal.fire({
        title: "Caja Cerrada",
        text: "No puedes realizar esta accion, primero debes de abrir caja",
        icon: "warning",
        confirmButtonColor: "#0f172a",
      });
      return;
    }

    if (carrito.length === 0) {
      Swal.fire(
        "Carrito vacio",
        "Agrega al menos un servicio o producto",
        "warning",
      );
      return;
    }
    if (!clienteSeleccionado) {
      Swal.fire(
        "Cliente requerido",
        "Selecciona un cliente para la orden",
        "warning",
      );
      return;
    }

    if (settings?.employee_production_enabled && !assignedStaffId) {
      Swal.fire(
        "Encargado requerido",
        "Selecciona un encargado para la orden",
        "warning",
      );
      return;
    }

    setCashPayments({}); // Reset change calculator
    setWantsInvoice(false);
    if (!deliveryContext) {
      setAnticipo(finalTotal);
    }
    setIsPaymentModalOpen(true);
  };

  const finalizeOrder = async () => {
    setIsProcessing(true);
    try {
      const orderData = {
        customer_id: clienteSeleccionado.id,
        items: carrito.map((item) => {
          const prod = productos.find(p => p.id === item.id);
          return {
            product_id: (String(item.id).startsWith("common-") || String(item.id).startsWith("express-") || String(item.id).startsWith("delivery-")) ? null : item.id,
            product_name: item.name,
            quantity: item.quantity,
            price: item.price,
            pricing_type: item.pricing_type || "unit",
            cost_price: prod?.cost_price || 0,
            category: prod?.category || null,
          };
        }),
        total: finalTotal,
        has_tax: wantsInvoice,
        tax_amount: taxAmount,
        invoice_requested: wantsInvoice,
        paid_amount: parseFloat(anticipo) || 0,
        payment_method: (metodoPago === "cash" && Object.keys(cashPayments).length === 1 && cashPayments.USD) ? "usd_cash" : metodoPago,
        payment_status:
          (parseFloat(anticipo) || 0) >= finalTotal ? "paid" : "pending",
        promised_at: (() => {
          const [year, month, day] = fechaEntrega.split("-");
          return new Date(year, month - 1, day, 12, 0, 0).toISOString();
        })(),
        notes: notas,
        status: "processing", // Auto-send to washing
        cash_session_id: cashSession?.id,
        // Registrar que empleado creo la orden
        created_by_staff_id: activeStaff?.id || null,
        // Encargado de la orden (para Rendimiento de Staff)
        assigned_staff_id: settings?.employee_production_enabled ? (assignedStaffId || null) : null,
      };

      const result = await orderService.createOrder(orderData);

      if (deliveryContext?.delivery_order_id) {
        try {
          await deliveryService.linkDeliveryToPosOrder(deliveryContext.delivery_order_id, result.id);
        } catch (deliveryLinkError) {
          console.warn("No se pudo vincular delivery con orden POS:", deliveryLinkError);
        }
      }

      // AUTO-ASIGNAR ESTANTERIA (si esta habilitado)
      let shelfAssignment = null;
      if (businessSettings?.shelving_enabled && businessSettings?.shelving_auto_assign) {
        try {
          await shelvingService.autoAssignShelf(result.id, activeStaff?.name || "Sistema");
          shelfAssignment = await shelvingService.getOrderShelf(result.id);
        } catch (shelfErr) {
          console.warn("Error auto-asignando estanteria:", shelfErr);
        }
      } else if (businessSettings?.shelving_enabled) {
        try {
          shelfAssignment = await shelvingService.getOrderShelf(result.id);
        } catch (e) {
          // No assignment yet, that's fine
        }
      }

      const recibidoMXN = activeCurrencies.reduce((acc, curr) => {
        return acc + (parseFloat(cashPayments[curr.currency_code]) || 0) * curr.rate;
      }, 0);

      setVentaCompletada({
        ...result,
        productos: carrito,
        cliente: clienteSeleccionado,
        monto_recibido: recibidoMXN || (parseFloat(anticipo) || finalTotal),
        pagos_multimoneda: cashPayments,
        metodo_pago: metodoPago,
        shelfAssignment: shelfAssignment || null,
      });

      Swal.fire("Exito!", "Orden registrada correctamente", "success");
      loadProducts(true); // Refrescar stock
      setIsPaymentModalOpen(false);
      vaciarCarrito();
      setAssignedStaffId("");
      setClienteSeleccionado(null);
      setBusquedaCliente("");
      setNotas("");
      setDeliveryContext(null);
      setAnticipo(0);
      setCashPayments({});
    } catch (error) {
      console.error("Error al finalizar orden:", error);
      Swal.fire("Error", "No se pudo registrar la orden", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const imprimirTicket = async () => {
    if (!ventaCompletada || !businessSettings || isPrinting) return;

    setIsPrinting(true);
    try {
      if (ticketRef.current) {
        const copies = businessSettings.ticket_double_print ? 2 : 1;

        await printService.print(ticketRef.current, businessSettings.printer_name, {
          copies,
          settings: businessSettings,
        });
      }
    } catch (error) {
      console.error("Error al imprimir:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleOpenRemisionPreview = () => {
    if (!ventaCompletada || !businessSettings) return;
    setShowRemisionPreview(true);
  };

  return (
    <div className="pos-container flex flex-col h-[calc(100dvh-64px)] lg:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* PANEL IZQUIERDO: PRODUCTOS Y SERVICIOS */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden">
        {/* Cash Session / Admin Mode Banner */}
        {adminMode && !cashSession ? (
          <div className="mb-4 p-3 rounded-2xl border bg-slate-50/50 border-slate-200 dark:bg-slate-500/5 dark:border-slate-500/20 flex items-center justify-between transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 text-slate-600">
                <span className="material-symbols-outlined">
                  admin_panel_settings
                </span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  Modo Administrador
                </p>
                <h4 className="text-sm font-bold dark:text-white">
                  Acceso de gestion - sin caja configurada
                </h4>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                Solo lectura
              </p>
              <p className="text-xs font-black text-slate-500">
                Ventas deshabilitadas
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`mb-4 p-3 rounded-2xl border flex items-center justify-between transition-all ${
              cashSession
                ? "bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20"
                : "bg-amber-50/50 border-amber-100 dark:bg-amber-500/5 dark:border-amber-500/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  cashSession
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-amber-100 text-amber-600"
                }`}
              >
                <span className="material-symbols-outlined">
                  {cashSession ? "lock_open" : "lock"}
                </span>
              </div>
              <div>
                <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                    cashSession ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {cashSession ? "Sesion Iniciada" : "Sesion Cerrada"}
                </p>
                <h4 className="text-sm font-bold dark:text-white">
                  {cashSession
                    ? `Atiende: ${cashSession.staff_name}`
                    : "Inicie turno para realizar ventas"}
                </h4>
              </div>
            </div>
            {cashSession ? (
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  Fondo Inicial
                </p>
                <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                  {formatearDinero(cashSession.opening_fund)}
                </p>
              </div>
            ) : (
              <button
                className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg shadow-amber-600/20 flex items-center gap-2 active:scale-95"
                onClick={() => setShowCashFundModal(true)}
              >
                <span className="material-symbols-outlined text-sm">key</span>
                ABRIR CAJA AHORA
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="mobile-sale-tabs flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSaleMode("SERVICE")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                saleMode === "SERVICE"
                  ? "bg-white dark:bg-slate-800 text-indigo-600 shadow-lg"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                local_laundry_service
              </span>
              SERVICIOS
            </button>
            <button
              onClick={() => setSaleMode("PRODUCT")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                saleMode === "PRODUCT"
                  ? "bg-white dark:bg-slate-800 text-emerald-600 shadow-lg"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                shopping_bag
              </span>
              PRODUCTOS
            </button>
            <button
              onClick={() => setSaleMode("COMMON")}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                saleMode === "COMMON"
                  ? "bg-white dark:bg-slate-800 text-rose-600 shadow-lg"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">add_box</span>
              COMUN
            </button>
            <button
              onClick={() => setIsExpressModalOpen(true)}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                isExpressModalOpen
                  ? "bg-white dark:bg-slate-800 text-teal-600 shadow-lg"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="material-symbols-outlined text-sm">bolt</span>
              EXPRESS
            </button>
          </div>
        </div>

        {saleMode !== "COMMON" && saleMode !== "EXPRESS" && (
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">
                search
              </span>
              <input
                type="text"
                className="w-full pl-16 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-900 font-bold dark:text-white"
                placeholder={
                  saleMode === "SERVICE"
                    ? "Buscar servicio (Lavado, Secado, Planchado)..."
                    : "Buscar producto por nombre o codigo..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="mobile-sales-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-24 lg:pb-0 custom-scrollbar">
          {saleMode === "COMMON" ? (
            <div className="col-span-full bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
              <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/10 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-4xl">
                      add_shopping_cart
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white">
                    Agregar Producto Comun
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-tight">
                    Item que no figura en el catalogo
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Descripcion del Producto
                    </label>
                    <input
                      type="text"
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white font-bold transition-all transition-all"
                      placeholder="Ej. Jabon extra, Suavizante especial..."
                      value={commonProductForm.description}
                      onChange={(e) =>
                        setCommonProductForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Cantidad
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white font-bold transition-all"
                        value={commonProductForm.quantity}
                        onChange={(e) =>
                          setCommonProductForm((prev) => ({
                            ...prev,
                            quantity: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Precio Unitario
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                          $
                        </span>
                        <input
                          type="number"
                          className="w-full pl-8 pr-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white font-bold transition-all"
                          placeholder="0.00"
                          value={commonProductForm.price}
                          onChange={(e) =>
                            setCommonProductForm((prev) => ({
                              ...prev,
                              price: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() =>
                      setCommonProductForm({
                        description: "",
                        quantity: 1,
                        price: "",
                      })
                    }
                    className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddCommonProduct}
                    className="flex-[2] px-6 py-4 rounded-2xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/30 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-sm">
                      add_circle
                    </span>
                    Aceptar y Agregar
                  </button>
                </div>
              </div>
            </div>
          ) : loadingProducts ? (
            <div className="col-span-full flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            </div>
          ) : (
            filteredProducts.map((p) => {
              // Deteccion Inteligente de Servicio (Incluso si la DB aun dice PRODUCT)
              const isService =
                p.type === "SERVICE" ||
                p.type === "EXPRESS" ||
                p.stock >= 9999 ||
                (p.name && p.name.toLowerCase().includes("carga")) ||
                (p.name && p.name.toLowerCase().includes("lavado")) ||
                (p.name && p.name.toLowerCase().includes("planchado")) ||
                p.category?.toLowerCase().includes("ropa");

              const isExpressItem = p.type === "EXPRESS" || p.category === 'Express' || p.category === 'EXPRESS';

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    // Servicios de tipo KG: abrir modal para pesar en tandas
                    if (p.pricing_type === "kg") {
                      setKgModalProduct(p);
                      return;
                    }

                    // Servicios unitarios: permitir seleccionar multiples veces (incrementa cantidad)
                    if (isService) {
                      agregarProducto(p);
                      return;
                    }

                    // Productos fisicos: si ya esta en carrito, guiar al usuario a usar +/-
                    const itemExistente = carrito.find(
                      (item) => item.id === p.id,
                    );
                    if (itemExistente) {
                      Swal.fire({
                        icon: "info",
                        title: "Ya en la comanda",
                        text: `El producto "${p.name}" ya ha sido agregado. Use los botones (+) y (-) del carrito para ajustar la cantidad.`,
                        confirmButtonColor: "#4f46e5",
                      });
                      return;
                    }

                    agregarProducto(p);
                  }}
                  disabled={!isService && p.stock <= 0}
                  className={`flex flex-col text-left bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all shadow-sm hover:shadow-xl group relative min-h-[190px] ${
                    !isService && p.stock <= 0
                      ? "opacity-50 grayscale cursor-not-allowed border-slate-100"
                      : isService
                        ? "border-indigo-100 dark:border-indigo-900/30 hover:border-indigo-500 bg-indigo-50/5"
                        : "border-slate-200 dark:border-slate-800 hover:border-emerald-500"
                  }`}
                >
                  {/* Badge - top right */}
                  <div className="absolute top-2.5 right-2.5 z-10">
                    {isExpressItem ? (
                      <span className="bg-teal-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm">
                        Express
                      </span>
                    ) : isService ? (
                      <span className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm">
                        Servicio
                      </span>
                    ) : (
                      <span
                        className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm ${
                          p.stock <= p.min_stock
                            ? "bg-rose-500 text-white"
                            : "bg-emerald-500 text-white"
                        }`}
                      >
                        Stock: {p.stock}
                      </span>
                    )}
                  </div>

                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isExpressItem
                        ? "bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400"
                        : isService
                        ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                        : "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {isExpressItem ? "bolt" : isService ? "dry_cleaning" : "inventory_2"}
                    </span>
                  </div>

                  {/* Name */}
                  <h3 
                    className="text-sm lg:text-base font-extrabold text-slate-900 dark:text-white leading-tight mt-3 flex-1 pr-1 line-clamp-2 min-h-[2rem]"
                    title={p.name}
                  >
                    {p.name && p.name.trim() !== "" ? p.name : "PRODUCTO SIN NOMBRE"}
                  </h3>

                  {/* Price - anchored bottom */}
                  <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                    <p className="text-sm lg:text-base font-extrabold text-slate-800 dark:text-white">
                      {isExpressItem ? "Precio Abierto" : formatearDinero(p.price)}
                      <span className="text-[10px] ml-1 text-slate-400 dark:text-slate-500 font-semibold">
                        / {p.unit_type || (p.pricing_type === "kg" ? "kg" : "unit")}
                      </span>
                    </p>
                    <span className="material-symbols-outlined text-base text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                      add_circle
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Boton Flotante para Carrito en Moviles */}
      {!showMobileCart && (
        <div className="mobile-cart-toggle lg:hidden fixed bottom-4 left-4 right-4 z-[90]">
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-full bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl p-4 shadow-2xl flex items-center justify-between font-black active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl">
                shopping_cart
              </span>
              <span>
                Ver Orden (
                {carrito.reduce((acc, item) => acc + item.quantity, 0)})
              </span>
            </div>
            <span className="text-xl">{formatearDinero(total)}</span>
          </button>
        </div>
      )}

      {/* OVERLAY PARA MOVILES */}
      {showMobileCart && (
        <div
          className="fixed inset-0 bg-black/60 z-[95] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      {/* PANEL DERECHO: CARRITO Y ORDEN */}
      <div
        className={`
        mobile-cart-drawer fixed inset-x-0 bottom-0 z-[100] bg-white dark:bg-slate-900 flex-col h-[85vh] rounded-t-3xl shadow-2xl
        transition-transform duration-300 ease-in-out
        ${showMobileCart ? "translate-y-0" : "translate-y-full"}
        lg:static lg:translate-y-0 lg:w-[450px] lg:h-full lg:border-l lg:border-slate-200 dark:border-slate-800 lg:flex lg:rounded-none lg:shadow-none lg:z-10
      `}
      >
        {/* Agarradera para moviles */}
        <div
          className="lg:hidden flex justify-center py-3 cursor-pointer"
          onClick={() => setShowMobileCart(false)}
        >
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
        </div>

        <div className="p-4 lg:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10 rounded-t-3xl lg:rounded-none">
          <h2 className="text-lg lg:text-xl font-bold text-black dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-500">
              shopping_basket
            </span>
            Nueva Orden
          </h2>
          <button
            className="lg:hidden p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-full bg-slate-100 dark:bg-slate-800"
            onClick={() => setShowMobileCart(false)}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* SECCION CLIENTE (Movido arriba) */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-black dark:text-slate-400 uppercase tracking-widest">
              Cliente (OBLIGATORIO)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-black dark:text-white font-bold placeholder:text-slate-400"
                  placeholder="Nombre o telefono..."
                  value={
                    clienteSeleccionado
                      ? clienteSeleccionado.name
                      : busquedaCliente
                  }
                  onChange={(e) => {
                    setBusquedaCliente(e.target.value);
                    if (clienteSeleccionado) setClienteSeleccionado(null);
                  }}
                />
                {clientes.length > 0 && !clienteSeleccionado && (
                  <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden mt-1">
                    {clientes.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:text-white border-b last:border-0 border-slate-100 dark:border-slate-800"
                        onClick={() => {
                          setClienteSeleccionado(c);
                          setBusquedaCliente(c.name);
                          setClientes([]);
                        }}
                      >
                        <span className="font-bold text-black dark:text-white">
                          {c.name}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">
                          {c.phone}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsClientModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl w-10 h-10 flex items-center justify-center shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                title="Registrar Nuevo Cliente"
              >
                <span className="material-symbols-outlined">person_add</span>
              </button>
            </div>
          </div>
        </div>

        {settings?.employee_production_enabled && (
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20 z-20">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                Encargado (OBLIGATORIO)
              </label>
              {activeStaffList.length === 0 ? (
                <p className="text-[11px] text-amber-600 italic">
                  No hay empleados activos. Cree uno en Admin → Staff.
                </p>
              ) : (
                <select
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-600 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-black dark:text-white font-bold"
                  value={assignedStaffId}
                  onChange={(e) => setAssignedStaffId(e.target.value)}
                >
                  <option value="">Seleccionar encargado...</option>
                  {activeStaffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Lista de Carrito */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {carrito.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50">
              <span className="material-symbols-outlined text-6xl">
                add_shopping_cart
              </span>
              <p className="font-medium">El carrito esta vacio</p>
            </div>
          ) : (
            carrito.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.name}
                    </h4>
                    <span
                      className={`text-[8px] font-black px-1 rounded uppercase ${item.type === "SERVICE" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}`}
                    >
                      {item.type === "SERVICE" ? "S" : "P"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-emerald-600">
                    {formatearDinero(item.price)}{" "}
                    {item.pricing_type === "kg" ? "/ kg" : "/ pza"}
                  </p>
                </div>
                <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
                  <button
                    onClick={() => cambiarCantidad(item.id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500"
                  >
                    <span className="material-symbols-outlined text-lg">
                      remove
                    </span>
                  </button>
                  <input
                    type="number"
                    className="w-12 text-center bg-transparent font-bold text-sm text-black dark:text-white border-none focus:ring-0"
                    value={item.quantity}
                    onChange={(e) =>
                      cambiarCantidad(item.id, parseFloat(e.target.value) || 0)
                    }
                  />
                  <button
                    onClick={() => cambiarCantidad(item.id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-500"
                  >
                    <span className="material-symbols-outlined text-lg">
                      add
                    </span>
                  </button>
                </div>

                <button
                  onClick={() => quitarProducto(item.id)}
                  className="text-rose-400 hover:text-rose-600"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))
          )}
        </div>

        {/* Detalles de la Orden */}
        <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-black dark:text-slate-400 uppercase tracking-widest">
                Notas de la Orden
              </label>
              <button
                onClick={() => setIsAIModalOpen(true)}
                className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 flex items-center gap-1 transition-all"
              >
                <span className="material-symbols-outlined text-xs">
                  auto_awesome
                </span>
                IA VISION Scan
              </button>
            </div>
            <textarea
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-600 dark:text-slate-400 min-h-[60px]"
              placeholder="Ej. Mancha de grasa en manga derecha..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-black dark:text-slate-400 uppercase tracking-widest">
              Entrega
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-black dark:text-white font-black shadow-md cursor-pointer date-input-highlight transition-all"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className="text-black dark:text-slate-400 font-black uppercase text-[10px] tracking-widest">
              Total a Pagar
            </span>
            <span className="text-3xl font-black text-slate-800 dark:text-white">
              {formatearDinero(total)}
            </span>
          </div>

          <button
            onClick={handleProcessOrder}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">check_circle</span>
            REGISTRAR ORDEN
          </button>
        </div>
      </div>

      {/* MODAL DE PAGO */}
      {isPaymentModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white">
                Confirmar Pago
              </h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-black text-sm mb-1 uppercase tracking-tighter font-bold">
                  Monto Total
                </p>
                <h4 className="text-4xl font-black text-black dark:text-white mb-4">
                  {formatearDinero(finalTotal)}
                </h4>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl mb-6">
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">
                      Desea Facturar?
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      El impuesto configurado es de <span className="font-bold text-slate-700 dark:text-slate-300">{globalTaxRate}%</span>.
                      <br/>
                      {wantsInvoice
                        ? "Este cargo ha sido sumado al total."
                        : "Active el boton para aplicar el cargo."}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={wantsInvoice}
                      onChange={(e) => setWantsInvoice(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                {/* Desglose de impuestos siempre visible para evitar confusion */}
                <div className="flex flex-col gap-1 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl mb-4 text-left">
                  <div className="flex justify-between font-bold text-slate-600 dark:text-slate-400">
                    <span>Subtotal:</span>
                    <span>{formatearDinero(total)}</span>
                  </div>
                  <div
                    className={`flex justify-between font-bold ${wantsInvoice ? "text-rose-500" : "text-slate-500"}`}
                  >
                    <span>
                      Impuestos ({wantsInvoice ? globalTaxRate : "0"}%):
                    </span>
                    <span>
                      {wantsInvoice ? "+" : ""}{" "}
                      {formatearDinero(wantsInvoice ? taxAmount : 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setMetodoPago("cash");
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === "cash" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "border-slate-100 dark:border-slate-800 text-slate-400"}`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    payments
                  </span>
                  <span className="text-[10px] font-bold uppercase">
                    Efectivo
                  </span>
                </button>
                <button
                  onClick={() => {
                    setMetodoPago("card");
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === "card" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "border-slate-100 dark:border-slate-800 text-slate-400"}`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    credit_card
                  </span>
                  <span className="text-[10px] font-bold uppercase">
                    Tarjeta
                  </span>
                </button>
                <button
                  onClick={() => {
                    setMetodoPago("transferencia");
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === "transferencia" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "border-slate-100 dark:border-slate-800 text-slate-400"}`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    account_balance
                  </span>
                  <span className="text-[10px] font-bold uppercase">
                    Transf.
                  </span>
                </button>


              </div>

              {/* CALCULADORA DE CAMBIO MULTIMONEDA */}
              {metodoPago === "cash" && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800">
                  {(() => {
                    const totalACobrar = parseFloat(anticipo) || finalTotal;
                    const recibidoMXN = activeCurrencies.reduce((acc, curr) => {
                      return acc + (parseFloat(cashPayments[curr.currency_code]) || 0) * curr.rate;
                    }, 0);
                    const faltanteMXN = Math.max(0, totalACobrar - recibidoMXN);
                    const cambioMXN = Math.max(0, recibidoMXN - totalACobrar);

                    return (
                      <>
                        {activeCurrencies.map((currency) => {
                          const isMXN = currency.currency_code === 'MXN';
                          const symbol = isMXN ? "$" : currency.currency_code === 'USD' ? "U$" : currency.currency_code === 'EUR' ? "EUR" : currency.currency_code;
                          const rate = currency.rate;
                          const sugerido = faltanteMXN > 0 ? (faltanteMXN / rate).toFixed(2) : "0.00";
                          const isBlocked = faltanteMXN === 0 && !cashPayments[currency.currency_code];

                          return (
                            <div key={currency.currency_code} className="flex justify-between items-center text-sm mb-2">
                              <div className="flex flex-col">
                                <span className="text-black font-bold">
                                  Pago Con {currency.currency_code}:
                                </span>
                                {!isMXN && (
                                  <span className="text-[10px] text-slate-500">Tipo de cambio: ${rate}</span>
                                )}
                              </div>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">
                                  {symbol}
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  className="w-32 pl-7 pr-3 py-2 text-sm text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-black dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 transition-colors"
                                  value={cashPayments[currency.currency_code] || ""}
                                  onChange={(e) => {
                                    setCashPayments(prev => ({
                                      ...prev,
                                      [currency.currency_code]: e.target.value
                                    }));
                                  }}
                                  placeholder={sugerido}
                                  disabled={isBlocked}
                                  autoFocus={isMXN}
                                />
                              </div>
                            </div>
                          );
                        })}

                        {/* Mostrar Cambio */}
                        <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-200 dark:border-slate-800">
                          <span className="text-black font-bold">Su Cambio (MXN):</span>
                          <span className="text-lg font-black text-emerald-600">
                            {formatearDinero(cambioMXN)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Monto a pagar ahora
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setAnticipo(finalTotal)}
                      className="text-[10px] px-2 py-1 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                    >
                      Completo
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnticipo(Math.round(finalTotal * 0.5 * 100) / 100)}
                      className="text-[10px] px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnticipo(0)}
                      className="text-[10px] px-2 py-1 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 font-bold hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                    >
                      Dejar todo
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    max={finalTotal}
                    step="0.01"
                    className="w-full pl-8 pr-3 py-2 text-lg font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={anticipo}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setAnticipo(!isNaN(val) && val >= 0 ? Math.min(val, finalTotal) : 0);
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">Saldo pendiente:</span>
                  <span className="font-bold text-rose-500">
                    {formatearDinero(Math.max(0, finalTotal - (parseFloat(anticipo) || 0)))}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-3 text-slate-500 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={finalizeOrder}
                disabled={isProcessing}
                className="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                )}
                FINALIZAR ORDEN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TICKET */}
      {ventaCompletada && (
        businessSettings?.ticket_preview === false ? (
          <div className="hidden" id="printable-ticket-hidden">
            <TicketVenta
              venta={ventaCompletada}
              settings={businessSettings}
              ref={ticketRef}
            />
          </div>
        ) : (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
              <div id="printable-ticket" className="overflow-hidden">
                <TicketVenta
                  venta={ventaCompletada}
                  settings={businessSettings}
                  ref={ticketRef}
                />
              </div>
              <div className="mt-8 space-y-3">
                <button
                  onClick={imprimirTicket}
                  disabled={isPrinting}
                  className={`w-full py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all ${isPrinting ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 shadow-slate-900/20"}`}
                >
                  <span
                    className={`material-symbols-outlined ${isPrinting ? "animate-spin" : ""}`}
                  >
                    {isPrinting ? "sync" : "print"}
                  </span>
                  {isPrinting ? "IMPRIMIENDO..." : "IMPRIMIR TICKET"}
                </button>
                {businessSettings?.enable_remision_print && (
                  <button
                    onClick={handleOpenRemisionPreview}
                    className="w-full py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all bg-amber-600 shadow-amber-600/20"
                  >
                    <span className="material-symbols-outlined">
                      receipt_long
                    </span>
                    NOTA DE REMISIÓN
                  </button>
                )}
                <button
                  onClick={() => setVentaCompletada(null)}
                  className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                >
                  CONTINUAR VENDIENDO
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* MODAL NOTA DE REMISIÓN */}
      {showRemisionPreview && ventaCompletada && (
        <RemisionPreviewModal
          venta={ventaCompletada}
          settings={businessSettings}
          onClose={() => setShowRemisionPreview(false)}
        />
      )}

      {/* MODAL NUEVO CLIENTE */}
      {isClientModalOpen && (
        <ClientRegistrationModal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          onClientRegistered={handleClientRegistered}
        />
      )}

      {/* MODAL SERVICIO EXPRESS */}
      {isExpressModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl max-w-md w-full shadow-2xl animate-in zoom-in duration-300 relative border border-slate-200 dark:border-slate-800">
            <button 
              onClick={() => setIsExpressModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
            <div className="w-full space-y-6">
              <div className="text-center space-y-2 mt-2">
                <div className="w-16 h-16 bg-teal-100 dark:bg-teal-500/10 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl">bolt</span>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">
                  Agregar Servicio Express
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-tight">
                  Servicio libre - ingresa nombre, costo y notas
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Nombre del Servicio Express
                  </label>
                  {configuredExpressServices.length > 0 ? (
                    <select
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white font-bold transition-all"
                      value={expressForm.name}
                      onChange={(e) =>
                        setExpressForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                    >
                      <option value="">-- Selecciona o ingresa manual --</option>
                      {configuredExpressServices.map(svc => (
                        <option key={svc.id} value={svc.name}>
                          {svc.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {configuredExpressServices.length === 0 || expressForm.name === "" || configuredExpressServices.findIndex(s => s.name === expressForm.name) === -1 ? (
                  <input
                    type="text"
                    className={`w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white font-bold transition-all ${configuredExpressServices.length > 0 ? 'mt-2' : ''}`}
                    placeholder="Ej. LAVADO URGENTE, PLANCHADO ESPECIAL..."
                    value={expressForm.name}
                    onChange={(e) =>
                      setExpressForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Costo del Servicio
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full pl-8 pr-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white font-bold transition-all"
                      placeholder="0.00"
                      value={expressForm.price}
                      onChange={(e) =>
                        setExpressForm((prev) => ({
                          ...prev,
                          price: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Notas del Servicio <span className="text-slate-300 dark:text-slate-600">(opcional)</span>
                  </label>
                  <textarea
                    rows="3"
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white font-bold transition-all resize-none"
                    placeholder="Ej. Cliente pide entrega antes de las 3pm, tipo de tela delicada..."
                    value={expressForm.notes}
                    onChange={(e) =>
                      setExpressForm((prev) => ({
                        ...prev,
                        notes: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsExpressModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddExpressService}
                  className="flex-[2] px-6 py-4 rounded-2xl bg-teal-600 text-white font-black text-xs uppercase tracking-widest hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/30 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    bolt
                  </span>
                  Agregar Express
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IA VISION */}
      {isAIModalOpen && (
        <VisionAIModal
          isOpen={isAIModalOpen}
          onClose={() => setIsAIModalOpen(false)}
          onAccept={(report) => {
            setNotas((prev) => (prev ? `${prev}\n${report}` : report));
          }}
        />
      )}

      {/* MODAL DE FONDO DE CAJA */}
      {showCashFundModal && (
        <CashFundModal
          staffName={activeStaff?.name || storeName || "Operador"}
          staffId={activeStaff?.id}
          onSessionCreated={() => {
            checkCashSession();
            setShowCashFundModal(false);
          }}
          onClose={() => setShowCashFundModal(false)}
        />
      )}

      {/* MODAL DE CANTIDAD KG */}
      {kgModalProduct && (
        <KgQuantityModal
          product={kgModalProduct}
          onAccept={(quantity) => {
            const existente = carrito.find(item => item.id === kgModalProduct.id);
            if (existente) {
              // Ya existe en el carrito -> SUMAR la nueva pesada al peso anterior
              cambiarCantidad(kgModalProduct.id, existente.quantity + quantity);
            } else {
              // Primera vez -> agregar con cantidad inicial del peso
              agregarProducto(kgModalProduct, quantity);
            }
            setKgModalProduct(null);
          }}
          onCancel={() => setKgModalProduct(null)}
        />
      )}
    </div>
  );
};

