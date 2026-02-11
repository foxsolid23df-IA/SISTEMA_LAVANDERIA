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
import { formatearDinero } from "../../utils";
import Swal from "sweetalert2";
import TicketVenta from "./TicketVenta";
import Modal from "../common/Modal";
import { ClientRegistrationModal } from "./ClientRegistrationModal";
import VisionAIModal from "../ai/VisionAIModal";
import "./Sales.css";
import { useScale } from "../../hooks/useScale";

// Componente de Punto de Venta específico para Lavandería
export const Sales = () => {
    const { user, cashSession } = useAuth();
    const { weight, isConnected: isScaleConnected, connect: connectScale, connectSimulation, error: scaleError, lastDataTime } = useScale();
    
    // Estado para detectar si la báscula está conectada pero no envía datos
    const [isStalled, setIsStalled] = useState(false);

    useEffect(() => {
        if (!isScaleConnected) {
            setIsStalled(false);
            return;
        }
        
        // Si no hay lastDataTime inicial, asumimos que está esperando datos
        // pero si ya está conectado un rato y no llega nada...
        if (!lastDataTime) return;

        const interval = setInterval(() => {
            const stalled = Date.now() - lastDataTime > 4000;
            setIsStalled(stalled);
        }, 1000);

        return () => clearInterval(interval);
    }, [lastDataTime, isScaleConnected]);

    const { productos, loading: loadingProducts, loadProducts } = useProducts();
    const { 
        carrito, 
        agregarProducto, 
        cambiarCantidad, 
        quitarProducto, 
        vaciarCarrito, 
        total 
    } = useCart((msg) => Swal.fire('Error', msg, 'error'));

    // Estados de búsqueda
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    
    // Estados de Cliente y Orden
    const [busquedaCliente, setBusquedaCliente] = useState("");
    const [clientes, setClientes] = useState([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [fechaEntrega, setFechaEntrega] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    });
    const [notas, setNotas] = useState("");
    const [anticipo, setAnticipo] = useState(0);

    // Estados de Pago
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [metodoPago, setMetodoPago] = useState("cash");
    const [ventaCompletada, setVentaCompletada] = useState(null);
    const [isPrinting, setIsPrinting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [montoRecibido, setMontoRecibido] = useState(""); /* State for Change Calculator */
    const [montoRecibidoUSD, setMontoRecibidoUSD] = useState("");
    const [usarUSD, setUsarUSD] = useState(false);
    
    // IA States
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    
    // Modo de Venta (Filtro Principal)
    const [saleMode, setSaleMode] = useState('SERVICE'); // 'SERVICE' o 'PRODUCT'

    
    // Referencias
    const ticketRef = useRef(null);

    // Filtrado de productos/servicios
    const filteredProducts = useMemo(() => {
        return productos.filter(p => {
            // Filtro de Modo (Servicio vs Producto)
            const productType = p.type || 'SERVICE';
            if (productType !== saleMode) return false;

            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 (p.barcode && p.barcode.includes(searchTerm));
            const matchesCategory = filterCategory === "all" || p.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [productos, searchTerm, filterCategory, saleMode]);


    // Estados de configuración
    const [businessSettings, setBusinessSettings] = useState(null);
    const [exchangeRate, setExchangeRate] = useState(null);

    // Cargar configuración al iniciar
    useEffect(() => {
        businessSettingsService.getSettings()
            .then(setBusinessSettings)
            .catch(err => console.error("Error loading business settings:", err));
        
        exchangeRateService.getActiveRate()
            .then(rate => {
                if (rate && rate.is_active) {
                    setExchangeRate(rate);
                }
            })
            .catch(err => console.error("Error loading exchange rate:", err));
    }, []);

    // Búsqueda de clientes
    useEffect(() => {
        if (busquedaCliente.length >= 2) {
            customerService.searchCustomers(busquedaCliente)
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

    // Procesar Orden
    const handleProcessOrder = async () => {
        if (carrito.length === 0) {
            Swal.fire('Carrito vacío', 'Agrega al menos un servicio o producto', 'warning');
            return;
        }
        if (!clienteSeleccionado) {
            Swal.fire('Cliente requerido', 'Selecciona un cliente para la orden', 'warning');
            return;
        }

        setMontoRecibido(""); // Reset change calculator
        setMontoRecibidoUSD("");
        setUsarUSD(false);
        setIsPaymentModalOpen(true);
    };

    const finalizeOrder = async () => {
        setIsProcessing(true);
        try {
            const orderData = {
                customer_id: clienteSeleccionado.id,
                items: carrito.map(item => ({
                    product_id: item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    price: item.price,
                    pricing_type: item.pricing_type || 'unit'
                })),
                total: total,
                paid_amount: parseFloat(anticipo) || 0,
                payment_method: usarUSD ? 'usd_cash' : metodoPago,
                payment_status: (parseFloat(anticipo) || 0) >= total ? 'paid' : 'pending',
                promised_at: new Date(fechaEntrega).toISOString(),
                notes: notas,
                status: 'processing', // Auto-send to washing
                cash_session_id: cashSession?.id
            };

            const result = await orderService.createOrder(orderData);
            
            setVentaCompletada({
                ...result,
                productos: carrito,
                cliente: clienteSeleccionado,
                monto_recibido: usarUSD ? parseFloat(montoRecibidoUSD) : parseFloat(montoRecibido),
                usar_usd: usarUSD,
                exchange_rate: exchangeRate?.rate,
                metodo_pago: metodoPago
            });
            
            Swal.fire('¡Éxito!', 'Orden registrada correctamente', 'success');
            loadProducts(true); // Refrescar stock
            setIsPaymentModalOpen(false);
            vaciarCarrito();
            setClienteSeleccionado(null);
            setBusquedaCliente("");
            setNotas("");
            setAnticipo(0);
            setMontoRecibido("");
            setMontoRecibidoUSD("");
        } catch (error) {
            console.error('Error al finalizar orden:', error);
            Swal.fire('Error', 'No se pudo registrar la orden', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const imprimirTicket = async () => {
        if (!ventaCompletada || !businessSettings || isPrinting) return;

        setIsPrinting(true);
        try {
            if (ticketRef.current) {
                const printContent = ticketRef.current.innerHTML;
                
                const fullHtml = `
                    <html>
                        <head>
                            <title>Ticket #${ventaCompletada.id}</title>
                            <style>
                                body { font-family: 'Courier New', Courier, monospace; margin: 0; padding: 0; width: auto; }
                                .linea { border-bottom: 1px dashed #000; margin: 5px 0; }
                                .text-center { text-align: center; }
                                .text-right { text-align: right; }
                                .font-bold { font-weight: bold; }
                                table { width: 100%; border-collapse: collapse; }
                                td, th { vertical-align: top; }
                                ${businessSettings.printer_is_bold ? 'body { font-weight: bold; }' : ''}
                                @page { margin: 0; size: auto; }
                            </style>
                        </head>
                        <body>${printContent}</body>
                    </html>
                `;

                const copies = businessSettings.ticket_double_print ? 2 : 1;
                
                await printService.print(fullHtml, businessSettings.printer_name, { copies });
            }
        } catch (error) {
            console.error("Error al imprimir:", error);
        } finally {
            setIsPrinting(false);
        }
    };

    return (
        <div className="pos-container flex flex-col h-[calc(100vh-64px)] lg:flex-row overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* PANEL IZQUIERDO: PRODUCTOS Y SERVICIOS */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
                {/* Cash Session Banner */}
                <div className={`mb-4 p-3 rounded-2xl border flex items-center justify-between transition-all ${
                    cashSession 
                    ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-500/5 dark:border-emerald-500/20' 
                    : 'bg-amber-50/50 border-amber-100 dark:bg-amber-500/5 dark:border-amber-500/20'
                }`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            cashSession ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                            <span className="material-symbols-outlined">
                                {cashSession ? 'lock_open' : 'lock'}
                            </span>
                        </div>
                        <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${
                                cashSession ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                                {cashSession ? 'Sesión Iniciada' : 'Sesión Cerrada'}
                            </p>
                            <h4 className="text-sm font-bold dark:text-white">
                                {cashSession 
                                    ? `Atiende: ${cashSession.staff_name}` 
                                    : 'Inicie turno para realizar ventas'}
                            </h4>
                        </div>
                    </div>
                    {cashSession && (
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Fondo Inicial</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">{formatearDinero(cashSession.opening_fund)}</p>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                     <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <button 
                            onClick={() => setSaleMode('SERVICE')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                                saleMode === 'SERVICE' 
                                ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-lg' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm">local_laundry_service</span>
                            SERVICIOS
                        </button>
                        <button 
                            onClick={() => setSaleMode('PRODUCT')}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${
                                saleMode === 'PRODUCT' 
                                ? 'bg-white dark:bg-slate-800 text-emerald-600 shadow-lg' 
                                : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <span className="material-symbols-outlined text-sm">shopping_bag</span>
                            PRODUCTOS
                        </button>
                     </div>

                     <button
                        onClick={(e) => {
                            if (e.altKey || e.ctrlKey) {
                                connectSimulation();
                            } else {
                                connectScale();
                            }
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            isScaleConnected 
                                ? (isStalled 
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' 
                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                                : 'bg-slate-100 text-black border border-slate-300 hover:bg-slate-200'
                        }`}
                        title={isScaleConnected 
                            ? (isStalled ? "Conectada pero sin recibir datos recientes (¿Báscula apagada?)" : "Báscula Conectada y enviando datos") 
                            : "Conectar Báscula USB (Alt+Click para Simular)"}
                    >
                        <span className="material-symbols-outlined text-sm">
                            {isScaleConnected ? (isStalled ? 'comments_disabled' : 'scale') : 'link_off'}
                        </span>
                        {isScaleConnected 
                            ? (isStalled ? 'Sin Datos...' : `Peso: ${weight}kg`)
                            : 'Conectar Báscula'}
                    </button>
                </div>
                {scaleError && <div className="text-xs text-red-600 font-bold mb-2">{scaleError}</div>}

                <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="relative flex-1">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10">search</span>
                        <input 
                            type="text" 
                            className="w-full pl-16 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-900 font-bold dark:text-white"
                            placeholder={saleMode === 'SERVICE' ? "Buscar servicio (Lavado, Secado, Planchado)..." : "Buscar producto por nombre o código..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                    {loadingProducts ? (
                        <div className="col-span-full flex justify-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                        </div>
                    ) : filteredProducts.map(p => {
                        // Detección Inteligente de Servicio (Incluso si la DB aún dice PRODUCT)
                        const isService = p.type === 'SERVICE' || 
                                         p.stock >= 9999 || 
                                         (p.name && p.name.toLowerCase().includes('carga')) || 
                                         (p.name && p.name.toLowerCase().includes('lavado')) ||
                                         (p.name && p.name.toLowerCase().includes('planchado')) ||
                                         p.category?.toLowerCase().includes('ropa');

                        return (
                            <button 
                                key={p.id}
                                onClick={() => agregarProducto(p)}
                                disabled={!isService && p.stock <= 0}
                                className={`flex flex-col text-left bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all shadow-sm hover:shadow-xl group relative min-h-[140px] ${
                                    !isService && p.stock <= 0 
                                        ? 'opacity-50 grayscale cursor-not-allowed border-slate-100' 
                                        : isService 
                                            ? 'border-indigo-100 dark:border-indigo-900/30 hover:border-indigo-500 bg-indigo-50/5' 
                                            : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500'
                                }`}
                            >
                                {/* Badge de Tipo - Más compacto */}
                                <div className="absolute top-2 right-2 z-10">
                                    {isService ? (
                                        <span className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm">
                                            Servicio
                                        </span>
                                    ) : (
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter shadow-sm ${
                                            p.stock <= p.min_stock 
                                                ? 'bg-rose-500 text-white' 
                                                : 'bg-emerald-500 text-white'
                                        }`}>
                                            Stock: {p.stock}
                                        </span>
                                    )}
                                </div>

                                <div className={`mb-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                    isService
                                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-600'
                                        : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600'
                                } group-hover:text-white`}>
                                    <span className="material-symbols-outlined text-xl">
                                        {isService ? 'dry_cleaning' : 'inventory_2'}
                                    </span>
                                </div>

                                <h3 className="text-xs lg:text-sm font-bold text-slate-800 dark:text-white leading-tight mb-2 pr-1 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                    {p.name || 'Sin nombre'}
                                </h3>

                                <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between">
                                    <p className="text-xs lg:text-sm font-black">
                                        <span className={isService ? 'text-indigo-600' : 'text-emerald-600'}>
                                            {formatearDinero(p.price)}
                                        </span>
                                        <span className="text-[9px] ml-1 text-slate-400 font-bold opacity-70">
                                            / {p.unit_type || (p.pricing_type === 'kg' ? 'kg' : 'pza')}
                                        </span>
                                    </p>
                                    <span className={`material-symbols-outlined text-sm transition-all ${isService ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                        add_circle
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* PANEL DERECHO: CARRITO Y ORDEN */}
            <div className="w-full lg:w-[450px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-10">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-emerald-500">shopping_basket</span>
                        Nueva Orden
                    </h2>
                </div>



                {/* SECCIÓN CLIENTE (Movido arriba) */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-20">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-black uppercase tracking-widest">Cliente (OBLIGATORIO)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    type="text"
                                    className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-black dark:text-white font-bold placeholder:text-slate-400"
                                    placeholder="Nombre o teléfono..."
                                    value={clienteSeleccionado ? clienteSeleccionado.name : busquedaCliente}
                                    onChange={(e) => {
                                        setBusquedaCliente(e.target.value);
                                        if (clienteSeleccionado) setClienteSeleccionado(null);
                                    }}
                                />
                                {clientes.length > 0 && !clienteSeleccionado && (
                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden mt-1">
                                        {clientes.map(c => (
                                            <button 
                                                key={c.id} 
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:text-white border-b last:border-0 border-slate-100 dark:border-slate-800"
                                                onClick={() => {
                                                    setClienteSeleccionado(c);
                                                    setBusquedaCliente(c.name);
                                                    setClientes([]);
                                                }}
                                            >
                                                <span className="font-bold text-black dark:text-white">{c.name}</span>
                                                <span className="ml-2 text-xs text-slate-400">{c.phone}</span>
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

                {/* Lista de Carrito */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {carrito.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-50">
                            <span className="material-symbols-outlined text-6xl">add_shopping_cart</span>
                            <p className="font-medium">El carrito está vacío</p>
                        </div>
                    ) : carrito.map(item => (
                        <div key={item.id} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</h4>
                                    <span className={`text-[8px] font-black px-1 rounded uppercase ${item.type === 'SERVICE' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                        {item.type === 'SERVICE' ? 'S' : 'P'}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-emerald-600">{formatearDinero(item.price)} {item.pricing_type === 'kg' ? '/ kg' : '/ pza'}</p>
                            </div>
                            <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-1">
                                <button onClick={() => cambiarCantidad(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500">
                                    <span className="material-symbols-outlined text-lg">remove</span>
                                </button>
                                <input 
                                    type="number" 
                                    className="w-12 text-center bg-transparent font-bold text-sm text-black dark:text-white border-none focus:ring-0"
                                    value={item.quantity}
                                    onChange={(e) => cambiarCantidad(item.id, parseFloat(e.target.value) || 0)}
                                />
                                <button onClick={() => cambiarCantidad(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-500">
                                    <span className="material-symbols-outlined text-lg">add</span>
                                </button>
                            </div>

                            {isScaleConnected && item.pricing_type === 'kg' && (
                                <button 
                                    onClick={() => cambiarCantidad(item.id, parseFloat(weight) || 0)}
                                    className="w-8 h-8 flex items-center justify-center bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors"
                                    title="Usar peso de báscula"
                                >
                                    <span className="material-symbols-outlined text-lg">scale</span>
                                </button>
                            )}
                            <button onClick={() => quitarProducto(item.id)} className="text-rose-400 hover:text-rose-600">
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    ))}
                </div>

                {/* Detalles de la Orden */}
                <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-black uppercase tracking-widest">Notas de la Orden</label>
                            <button 
                                onClick={() => setIsAIModalOpen(true)}
                                className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 flex items-center gap-1 transition-all"
                            >
                                <span className="material-symbols-outlined text-xs">auto_awesome</span>
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

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-black uppercase tracking-widest">Entrega</label>
                            <input 
                                type="date" 
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-black dark:text-white font-black shadow-md cursor-pointer date-input-highlight transition-all"
                                value={fechaEntrega}
                                onChange={(e) => setFechaEntrega(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-black uppercase tracking-widest">Paga con (Anticipo)</label>
                            <input 
                                type="number" 
                                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white font-bold text-emerald-600"
                                value={anticipo}
                                onChange={(e) => setAnticipo(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400 font-bold">Total a Pagar</span>
                        <span className="text-3xl font-black text-slate-800 dark:text-white">{formatearDinero(total)}</span>
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
                            <h3 className="font-bold text-lg dark:text-white">Confirmar Pago</h3>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="text-center">
                                <p className="text-black text-sm mb-1 uppercase tracking-tighter font-bold">Monto Total</p>
                                <h4 className="text-4xl font-black text-black dark:text-white">{formatearDinero(total)}</h4>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => {setMetodoPago("cash"); setUsarUSD(false);}}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === 'cash' && !usarUSD ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                                >
                                    <span className="material-symbols-outlined text-3xl">payments</span>
                                    <span className="text-xs font-bold uppercase">Efectivo</span>
                                </button>
                                <button 
                                    onClick={() => {setMetodoPago("card"); setUsarUSD(false);}}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === 'card' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                                >
                                    <span className="material-symbols-outlined text-3xl">credit_card</span>
                                    <span className="text-xs font-bold uppercase">Tarjeta</span>
                                </button>
                                
                                {exchangeRate && (
                                    <button 
                                        onClick={() => {setMetodoPago("cash"); setUsarUSD(true);}}
                                        className={`col-span-2 flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all ${usarUSD ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                                    >
                                        <span className="material-symbols-outlined text-xl">currency_exchange</span>
                                        <span className="text-xs font-bold uppercase">Pagar con Dólares (USD @ ${exchangeRate.rate})</span>
                                    </button>
                                )}
                            </div>

                            {/* CALCULADORA DE CAMBIO (Solo Efectivo / USD) */}
                            {metodoPago === 'cash' && (
                                <div className={`p-4 rounded-xl border ${usarUSD ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'}`}>
                                    <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ${usarUSD ? 'text-blue-700 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                                        {usarUSD ? 'Dólares Recibidos (USD)' : 'Dinero Recibido (MXN)'}
                                    </label>
                                    
                                    {usarUSD && (
                                        <div className="mb-3 p-2 bg-blue-100/50 dark:bg-blue-500/20 rounded-lg border border-blue-200 dark:border-blue-500/30">
                                            <p className="text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase">
                                                Cobrar al menos: <span className="text-sm">U$ {((parseFloat(anticipo) || total) / exchangeRate.rate).toFixed(2)}</span>
                                            </p>
                                            <p className="text-[9px] text-blue-500 font-bold uppercase mt-1">Para cubrir {formatearDinero(parseFloat(anticipo) || total)}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-4 items-center">
                                        <div className="relative flex-1">
                                            <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold ${usarUSD ? 'text-blue-600' : 'text-emerald-600'}`}>
                                                {usarUSD ? 'U$' : '$'}
                                            </span>
                                            <input 
                                                type="number" 
                                                className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border rounded-xl outline-none focus:ring-2 text-xl font-bold text-black dark:text-white ${usarUSD ? 'border-blue-200 focus:ring-blue-500' : 'border-emerald-200 focus:ring-emerald-500'}`}
                                                value={usarUSD ? montoRecibidoUSD : montoRecibido}
                                                onChange={(e) => usarUSD ? setMontoRecibidoUSD(e.target.value) : setMontoRecibido(e.target.value)}
                                                placeholder="0.00"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-xs mb-1 ${usarUSD ? 'text-blue-600' : 'text-emerald-600'}`}>Cambio (MXN)</p>
                                            <p className={`text-2xl font-black ${usarUSD ? 'text-blue-600' : 'text-blue-400'}`}>
                                                {(() => {
                                                    const recibidoMXN = usarUSD 
                                                        ? (parseFloat(montoRecibidoUSD) || 0) * exchangeRate.rate 
                                                        : (parseFloat(montoRecibido) || 0);
                                                    const totalACobrar = parseFloat(anticipo) || total;
                                                    return formatearDinero(Math.max(0, recibidoMXN - totalACobrar));
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                    {usarUSD && (
                                        <p className="text-[10px] mt-2 font-bold text-blue-500 uppercase">
                                            Equivalente: {formatearDinero((parseFloat(montoRecibidoUSD) || 0) * exchangeRate.rate)} MXN
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-black font-bold">Anticipo recibido:</span>
                                    <span className="font-bold text-emerald-600">{formatearDinero(anticipo || 0)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-black font-bold">Saldo pendiente:</span>
                                    <span className="font-bold text-rose-500">{formatearDinero(Math.max(0, total - anticipo))}</span>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-950 flex gap-3">
                            <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancelar</button>
                            <button 
                                onClick={finalizeOrder} 
                                disabled={isProcessing}
                                className="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                {isProcessing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                                FINALIZAR ORDEN
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL TICKET */}
            {ventaCompletada && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
                    <div className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
                        <div id="printable-ticket" className="overflow-hidden">
                             <TicketVenta venta={ventaCompletada} settings={businessSettings} ref={ticketRef} />
                        </div>
                        <div className="mt-8 space-y-3">
                            <button 
                                onClick={imprimirTicket}
                                disabled={isPrinting}
                                className={`w-full py-4 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all ${isPrinting ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 shadow-slate-900/20'}`}
                            >
                                <span className={`material-symbols-outlined ${isPrinting ? 'animate-spin' : ''}`}>
                                    {isPrinting ? 'sync' : 'print'}
                                </span>
                                {isPrinting ? 'IMPRIMIENDO...' : 'IMPRIMIR TICKET'}
                            </button>
                            <button 
                                onClick={() => setVentaCompletada(null)}
                                className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors"
                            >
                                CONTINUAR VENDIENDO
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL NUEVO CLIENTE */}
            <ClientRegistrationModal 
                isOpen={isClientModalOpen}
                onClose={() => setIsClientModalOpen(false)}
                onClientRegistered={handleClientRegistered}
            />

            {/* MODAL IA VISION */}
            {isAIModalOpen && (
                <VisionAIModal 
                    isOpen={isAIModalOpen}
                    onClose={() => setIsAIModalOpen(false)}
                    onAccept={(report) => {
                        setNotas(prev => prev ? `${prev}\n${report}` : report);
                    }}
                />
            )}
        </div>
    );
};
