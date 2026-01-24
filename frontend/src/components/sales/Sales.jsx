// ===== COMPONENTE PUNTO DE VENTA OPTIMIZADO =====
import React, { useState, useEffect, useRef } from "react";
import TicketVenta from "./TicketVenta";
import CameraScanner from "../common/CameraScanner";
import { formatearDinero, validarCodigoBarras } from "../../utils";
import { buscarProductoPorCodigo } from "../../utils/api";
import { productService } from "../../services/productService";
import { salesService } from "../../services/salesService";
import { activeCartService } from "../../services/activeCartService";
import { useApi } from "../../hooks/useApi";
import { useCart } from "../../hooks/useCart";
import { useAuth } from "../../hooks/useAuth";
import { useGlobalScanner } from "../../hooks/scanner";
import { useIsMobile } from "../../hooks/useIsMobile";
import { exchangeRateService } from "../../services/exchangeRateService";
import { supabase } from "../../supabase";
import { customerService } from "../../services/customerService";
import { orderService } from "../../services/orderService";
import "./Sales.css";

export const Sales = () => {
  // HOOKS PERSONALIZADOS
  const { user, cashSession } = useAuth();
  const { cargando, ejecutarPeticion } = useApi();
  const { isMobile, isTouchDevice } = useIsMobile();
  
  // USAR CONTEXTO GLOBAL DE PRODUCTOS
  const { 
    productos, 
    loading: loadingProducts, 
    error: errorProducts,
    loadProducts: cargarDatos,
    updateProduct
  } = useProducts();

  const mostrarError = (mensaje, esAdvertencia = false) => {
    if (mensaje.includes("sin stock") || mensaje.includes("No hay más stock") || mensaje.includes("Máximo disponible")) {
      mostrarModalPersonalizado("Stock insuficiente", mensaje, "warning");
    } else if (esAdvertencia) {
      mostrarModalPersonalizado("Advertencia", mensaje, "warning");
    } else {
      mostrarModalPersonalizado("Producto no encontrado", mensaje, "error");
    }
  };
  const {
    carrito,
    agregarProducto,
    cambiarCantidad,
    quitarProducto,
    vaciarCarrito,
    total,
  } = useCart(mostrarError);

  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info", // 'info', 'error', 'success', 'warning'
  });

  // REFERENCIAS
  const campoCodigoRef = useRef(null);

  // FUNCIONES PARA EL MODAL DE ERRORES
  const mostrarModalPersonalizado = (title, message, type = "info") => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const cerrarModalPersonalizado = () => {
    setModal({
      isOpen: false,
      title: "",
      message: "",
      type: "info",
    });
  };

  // ESTADOS PARA LAVANDERÍA
  const [clientes, setClientes] = useState([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [mostrarSugerenciasClientes, setMostrarSugerenciasClientes] = useState(false);
  const [fechaEntrega, setFechaEntrega] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Por defecto mañana
    return d.toISOString().split('T')[0];
  });
  const [notasOrden, setNotasOrden] = useState("");
  const [anticipo, setAnticipo] = useState(0);

  // ESTADO PARA NUEVO CLIENTE (MODAL)
  const [mostrarModalNuevoCliente, setMostrarModalNuevoCliente] = useState(false);
  const [nuevoCliente, setNuevoCliente] = useState({ name: "", phone: "", address: "" });

  // ID temporal de transacción estable para el modal de pago
  const [transactionId, setTransactionId] = useState("");
  // Estado para evitar que el primer ENTER abra y el segundo cierre instantáneamente
  const [modalReady, setModalReady] = useState(false);

  // Cargar tipo de cambio al montar
  useEffect(() => {
    let isMounted = true;
    
    const loadExchangeRate = async () => {
      try {
        const rate = await exchangeRateService.getActiveRate();
        if (isMounted && rate && rate.is_active) {
          setTipoCambio(parseFloat(rate.rate));
        }
      } catch (error) {
        // Ignorar errores de señales abortadas
        if (error?.message?.includes('aborted') || error?.name === 'AbortError') {
          return;
        }
        if (isMounted) {
          console.error('[Sales] Error cargando tipo de cambio:', error);
        }
      }
    };
    
    loadExchangeRate();
    
    return () => {
      isMounted = false;
    };
  }, []);

  // DEBUG: Verificar si llegan productos
  useEffect(() => {
    // Solo loguear si hay cambio significativo para no saturar consola
    if (productos.length > 0) {
       console.log('[Sales Component] Productos disponibles:', productos.length);
    }
  }, [productos.length]);

  // SINCRONIZACIÓN CON PANTALLA CLIENTE
  // Cada vez que cambia el carrito, total o sesión, actualizamos la tabla active_carts
  useEffect(() => {
    // Validación estricta: No intentar nada si no hay sesión válida o usuario
    if (!cashSession?.id || cashSession.status !== 'open' || !user?.id) {
        return;
    }

    // Debounce: Esperar 500ms antes de enviar a la DB para evitar saturación y AbortErrors
    const syncTimer = setTimeout(() => {
        activeCartService.updateCart(carrito, total, cashSession.id)
            .then(() => {
                // Log discreto solo para debug
                // console.log('[Sync] Carrito sincronizado');
            })
            .catch(err => {
                // Ignorar errores de abort (ya se manejan en el servicio, pero doble check)
                if (!err?.message?.includes('aborted') && err?.name !== 'AbortError') {
                    console.error('Error sincronizando carrito:', err);
                }
            });
    }, 500);

    // Limpiar timer si el carrito cambia antes de los 500ms
    return () => clearTimeout(syncTimer);
  }, [carrito, total, cashSession, user]);



  // BÚSQUEDA POR NOMBRE Y SKU - Filtrar sugerencias cuando cambia el texto
  useEffect(() => {
    const query = codigoEscaneado.toLowerCase().trim();
    if (query.length >= 2) {
      // Buscar por nombre o por código de barras (SKU)
      const resultados = productos
        .filter((p) =>
          p.name.toLowerCase().includes(query) || 
          (p.barcode && p.barcode.toLowerCase().includes(query))
        )
        .slice(0, 5); // Máximo 5 sugerencias
      setSugerencias(resultados);
      setMostrarSugerencias(resultados.length > 0);
      setIndexSugerencia(0); // Resetear índice al cambiar resultados
    } else {
      setSugerencias([]);
      setMostrarSugerencias(false);
      setIndexSugerencia(0);
    }
  }, [codigoEscaneado, productos]);

  // BUSCAR CLIENTES
  useEffect(() => {
    if (busquedaCliente.length >= 2) {
      customerService.searchCustomers(busquedaCliente)
        .then(setClientes)
        .catch(console.error);
      setMostrarSugerenciasClientes(true);
    } else {
      setClientes([]);
      setMostrarSugerenciasClientes(false);
    }
  }, [busquedaCliente]);

  // Sincronizar info de pago cuando cambia
  useEffect(() => {
    let isMounted = true;

    const syncPayment = async () => {
      if (user && mostrarModalPago && isMounted) {
        try {
          await activeCartService.updatePaymentInfo({
            method: metodoPago,
            received: parseFloat(montoRecibido) || 0,
            change: calcularCambio(),
            status: "processing",
            sessionId: cashSession?.id
          });
        } catch (err) {
          // Silenciar errores si el componente se desmontó
          if (isMounted && err.name !== 'AbortError') {
            console.error("Error sincronizando pago:", err);
          }
        }
      }
    };

    syncPayment();

    return () => {
      isMounted = false;
    };
  }, [metodoPago, montoRecibido, mostrarModalPago, user, total]);

  const handleCrearCliente = async (e) => {
    e.preventDefault();
    if (!nuevoCliente.name) return;
    try {
      const creado = await customerService.createCustomer(nuevoCliente);
      setClienteSeleccionado(creado);
      setMostrarModalNuevoCliente(false);
      setNuevoCliente({ name: "", phone: "", address: "" });
      mostrarModalPersonalizado("Éxito", "Cliente creado y seleccionado.", "success");
    } catch (error) {
      console.error(error);
      mostrarModalPersonalizado("Error", "No se pudo crear el cliente.", "error");
    }
  };

  // Seleccionar producto de las sugerencias
  const seleccionarProducto = (producto) => {
    // Mapear image_url a image para compatibilidad con el carrito
    const productoConImagen = {
      ...producto,
      image: producto.image_url,
    };
    agregarProducto(productoConImagen);
    setCodigoEscaneado("");
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  // HOOK SCANNER
  const manejarCodigoEscaneado = async (codigo) => {
    if (!validarCodigoBarras(codigo)) {
      mostrarModalPersonalizado(
        "Código inválido",
        "El código escaneado no tiene un formato válido.",
        "error",
      );
      return;
    }

    // Buscar en productos locales primero
    const productoLocal = productos.find((p) => p.barcode === codigo);
    if (productoLocal) {
      const productoConImagen = {
        ...productoLocal,
        image: productoLocal.image_url,
      };
      agregarProducto(productoConImagen);
      return;
    }

    try {
      await ejecutarPeticion(async (signal) => {
        const producto = await buscarProductoPorCodigo(codigo, signal);
        agregarProducto(producto);
      });
    } catch (error) {
      if (error.message && error.message.includes("404")) {
        mostrarModalPersonalizado(
          "Producto no encontrado",
          `No se encontró un producto con el código escaneado: ${codigo}`,
          "error",
        );
      } else {
        mostrarModalPersonalizado(
          "Error",
          "Ocurrió un error al buscar el producto. Intenta nuevamente.",
          "error",
        );
      }
    }
  };

  const { isScanning } = useGlobalScanner(manejarCodigoEscaneado, {
    minLength: 8,
    timeout: 100,
    enabled: !mostrarModalPago && !modal.isOpen && !mostrarModal,
    preventOnModal: true,
  });

  // FUNCIONES
  const buscarProductoManual = async (codigo) => {
    if (!validarCodigoBarras(codigo)) {
      mostrarModalPersonalizado(
        "Código inválido",
        "El código ingresado no tiene un formato válido. Por favor, verifica el código e intenta nuevamente.",
        "error",
      );
      return;
    }

    try {
      await ejecutarPeticion(async (signal) => {
        const producto = await buscarProductoPorCodigo(codigo, signal);
        agregarProducto(producto);
        // Producto agregado exitosamente - no necesitamos notificación ya que se ve en el carrito
      });
    } catch (error) {
      // Manejar error de producto no encontrado
      if (error.message && error.message.includes("404")) {
        mostrarModalPersonalizado(
          "Producto no encontrado",
          `No se encontró un producto con el código ingresado: ${codigo}`,
          "error",
        );
      } else {
        // Los errores de stock se manejan en el hook useCart
        // Otros errores generales
        mostrarModalPersonalizado(
          "Error",
          "Ocurrió un error al buscar el producto. Intenta nuevamente.",
          "error",
        );
      }
    }
  };

  // FUNCIONES PARA MODAL DE PAGO
  const abrirModalPago = () => {
    if (carrito.length === 0) {
      mostrarModalPersonalizado(
        "Carrito vacío",
        "No puedes procesar el pago sin productos en el carrito.",
        "warning",
      );
      return;
    }
    // Generar ID estable para esta sesión de pago
    setTransactionId((Math.floor(Math.random() * 90000) + 10000).toString());
    setMontoRecibido("");
    setMetodoPago("efectivo");
    setModalReady(false);
    setMostrarModalPago(true);
    // Aumentar el tiempo de seguridad a 500ms para evitar capturas accidentales del primer ENTER
    setTimeout(() => {
      setModalReady(true);
    }, 500);
  };

  const cerrarModalPago = () => {
    setMostrarModalPago(false);
    setModalReady(false);
    setMontoRecibido("");
    setMetodoPago("efectivo");
  };

  const manejarTecladoNumerico = (valor) => {
    setMontoRecibido((prev) => {
      if (valor === "backspace") {
        return prev.slice(0, -1);
      } else if (valor === ".") {
        // Permitir punto si no existe ya uno
        if (!prev.includes(".")) {
          return prev + ".";
        }
        return prev;
      } else {
        return prev + valor;
      }
    });
  };

  const calcularCambio = () => {
    const valMonto = montoRecibidoRef?.current || montoRecibido;
    if (!valMonto) return 0;
    const monto = parseFloat(valMonto) || 0;

    if (metodoPago === "dolares" && tipoCambio) {
      // Convertir dólares recibidos a pesos
      const totalEnPesos = monto * tipoCambio;
      // Calcular cambio en pesos
      return totalEnPesos - total;
    }

    if (metodoPago !== "efectivo" && metodoPago !== "dolares") return 0;

    return monto - total;
  };

  const formatearMontoRecibido = () => {
    if (metodoPago === "efectivo" || metodoPago === "dolares") {
      return montoRecibido || "0.00";
    } else {
      return total.toFixed(2);
    }
  };

  const finalizarVenta = async () => {
    if (!mostrarModalPago) return;
    if (carrito.length === 0) {
      mostrarModalPersonalizado("Carrito vacío", "Agrega servicios al carrito.", "warning");
      return;
    }
    if (!clienteSeleccionado) {
      mostrarModalPersonalizado("Cliente requerido", "Debes seleccionar un cliente para la orden.", "warning");
      return;
    }

    setVendiendo(true);
    cerrarModalPago();

    try {
      const orderData = {
        customer_id: clienteSeleccionado.id,
        total: total,
        paid_amount: parseFloat(anticipo) || 0,
        status: 'received',
        payment_status: anticipo >= total ? 'paid' : (anticipo > 0 ? 'partial' : 'pending'),
        notes: notasOrden,
        promised_at: fechaEntrega,
        items: carrito
      };

      const orderCreated = await orderService.createOrder(orderData);

      setVentaCompletada({
        ...orderCreated,
        productos: carrito,
        cliente: clienteSeleccionado,
        anticipo: anticipo,
        cambio: calcularCambio()
      });

      vaciarCarrito();
      setClienteSeleccionado(null);
      setBusquedaCliente("");
      setAnticipo(0);
      setNotasOrden("");
      setMostrarModal(true);
      await cargarDatos(true);
    } catch (error) {
      console.error("Error al crear orden:", error);
      mostrarModalPersonalizado("Error", "No se pudo crear la orden de lavandería.", "error");
    } finally {
      setVendiendo(false);
    }
  };

  const manejarCambioCodigo = (e) => {
    setCodigoEscaneado(e.target.value);
  };

  // Ref para el monto, permitiendo acceso en el listener sin reiniciar el efecto
  const montoRecibidoRef = useRef(montoRecibido);
  useEffect(() => {
    montoRecibidoRef.current = montoRecibido;
  }, [montoRecibido]);

  const manejarEnter = (e) => {
    if (e.key === "Enter") {
      // Si hay sugerencias visibles, seleccionar la que está marcada (indexSugerencia)
      if (mostrarSugerencias && sugerencias.length > 0) {
        e.preventDefault();
        seleccionarProducto(sugerencias[indexSugerencia]);
        return;
      }

      // Si no, búsqueda manual estándar
      if (codigoEscaneado.trim()) {
        e.preventDefault();
        buscarProductoManual(codigoEscaneado.trim());
        setCodigoEscaneado("");
      } else if (carrito.length > 0 && !mostrarModalPago && !modal.isOpen && !mostrarModal) {
        // SI EL INPUT ESTÁ VACÍO Y HAY PRODUCTOS, ABRIR PAGO
        e.preventDefault();
        e.target.blur();
        // Usar un timeout ligeramente mayor para asegurar que el foco se limpie y el estado se estabilice
        setTimeout(() => {
          abrirModalPago();
        }, 150);
      }
    } else if (e.key === "ArrowDown") {
      if (mostrarSugerencias && sugerencias.length > 0) {
        e.preventDefault();
        setIndexSugerencia((prev) => (prev + 1) % sugerencias.length);
      }
    } else if (e.key === "ArrowUp") {
      if (mostrarSugerencias && sugerencias.length > 0) {
        e.preventDefault();
        setIndexSugerencia((prev) => (prev - 1 + sugerencias.length) % sugerencias.length);
      }
    }
  };

  const manejarFocus = () => {
    if (campoCodigoRef.current) {
      campoCodigoRef.current.focus();
    }
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setVentaCompletada(null);
  };

  // MANEJAR TECLADO FÍSICO EN MODAL DE PAGO
  useEffect(() => {
    if (!mostrarModalPago) return;

    const handleKeyDown = (e) => {
      // Enter o "+" del teclado numérico: Finalizar venta
      if (e.key === "Enter" || e.key === "+") {
        e.preventDefault();
        // Si el modal no está listo (acaba de abrirse), ignoramos el ENTER
        if (!modalReady) return;
        
        // Dispara la finalización
        finalizarVenta();
        return;
      }

      // Escape: Cerrar modal
      if (e.key === "Escape") {
        e.preventDefault();
        cerrarModalPago();
        return;
      }

      // Atajos para cambiar método de pago
      if (e.key === "F1") {
        e.preventDefault();
        setMetodoPago("efectivo");
        setMontoRecibido("");
        return;
      }
      if (e.key === "F2") {
        e.preventDefault();
        setMetodoPago("tarjeta");
        setMontoRecibido(total.toFixed(2));
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        setMetodoPago("transferencia");
        setMontoRecibido(total.toFixed(2));
        return;
      }
      if (e.key === "F4" && tipoCambio) {
        e.preventDefault();
        setMetodoPago("dolares");
        setMontoRecibido("");
        return;
      }

      // Números para pago en efectivo o dólares
      if (metodoPago === "efectivo" || metodoPago === "dolares") {
        // Aceptar números normales y del teclado numérico
        if (/^[0-9]$/.test(e.key)) {
          manejarTecladoNumerico(e.key);
        } else if (e.key === "." || e.key === "," || e.key === "Decimal" || e.key === "Separator") {
          manejarTecladoNumerico(".");
        } else if (e.key === "Backspace" || e.key === "Delete") {
          manejarTecladoNumerico("backspace");
        }
      }
    };

    // Usar capture: false para permitir que otros elementos reciban el evento si es necesario.
    // El scanner usa capture: true, por eso lo desactivamos arriba con 'enabled'.
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mostrarModalPago, metodoPago, total, modalReady, tipoCambio, montoRecibido]);

  // MANEJAR ENTER GLOBAL PARA MODALES Y PAGO
  useEffect(() => {
    const handleGlobalEnter = (e) => {
      if (e.key === "Enter") {
        // 1. Si hay modal de error/aviso abierto, cerrarlo
        if (modal.isOpen) {
          e.preventDefault();
          cerrarModalPersonalizado();
          return;
        } 
        
        // 2. Si hay modal de venta completada (ticket), cerrarlo
        if (mostrarModal) {
          e.preventDefault();
          cerrarModal();
          return;
        }

        // 3. Si no hay modales abiertos y el carrito tiene productos, abrir pago
        // Solo si no estamos ya en el modal de pago (finalizarVenta tiene su propio listener)
        if (carrito.length > 0 && !mostrarModalPago && !modal.isOpen && !mostrarModal) {
          const activeElement = document.activeElement;
          const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';
          
          // Si el foco está en un input, dejar que el listener del input decida (manejarEnter)
          // Pero si es el cuerpo de la página u otro elemento no-input, abrir pago directamente
          if (!isInput) {
            e.preventDefault();
            abrirModalPago();
          }
        }
      }
    };

    window.addEventListener("keydown", handleGlobalEnter);
    return () => window.removeEventListener("keydown", handleGlobalEnter);
  }, [modal.isOpen, mostrarModal, mostrarModalPago, carrito.length, abrirModalPago, cerrarModal, cerrarModalPersonalizado]);

  // MANEJAR ESCANEO POR CÁMARA
  const manejarEscaneoCamara = async (codigo) => {
    // Limpiar el código (remover espacios)
    const codigoLimpio = codigo.trim();

    if (!codigoLimpio) return;

    // Validar formato de código de barras
    if (!validarCodigoBarras(codigoLimpio)) {
      mostrarModalPersonalizado(
        "Código inválido",
        "El código escaneado no tiene un formato válido.",
        "error",
      );
      return;
    }

    // Buscar primero en productos locales
    const productoLocal = productos.find(
      (p) =>
        p.barcode === codigoLimpio ||
        p.barcode === codigoLimpio.replace(/^0+/, ""), // Sin ceros iniciales
    );

    if (productoLocal) {
      const productoConImagen = {
        ...productoLocal,
        image: productoLocal.image_url,
      };
      agregarProducto(productoConImagen);
      mostrarModalPersonalizado(
        "Producto agregado",
        `${productoLocal.name} añadido al carrito`,
        "success",
      );
      return;
    }

    // Si no se encuentra localmente, buscar en el servidor
    try {
      await ejecutarPeticion(async () => {
        const producto = await productService.getProductByBarcode(codigoLimpio);
        if (producto) {
          const productoConImagen = { ...producto, image: producto.image_url };
          agregarProducto(productoConImagen);
          mostrarModalPersonalizado(
            "Producto agregado",
            `${producto.name} añadido al carrito`,
            "success",
          );
        } else {
          mostrarModalPersonalizado(
            "Producto no encontrado",
            `No se encontró un producto con el código: ${codigoLimpio}`,
            "error",
          );
        }
      });
    } catch (error) {
      mostrarModalPersonalizado(
        "Producto no encontrado",
        `No se encontró un producto con el código escaneado: ${codigoLimpio}`,
        "error",
      );
    }
  };

  // Referencia para el ticket
  const ticketRef = useRef(null);

  // Imprimir el ticket usando el nuevo componente
  const imprimirTicket = () => {
    if (!ticketRef.current) return;
    imprimirTicketTérmico(ticketRef.current.innerHTML, ventaCompletada);
  };

  // Función mejorada para imprimir tickets térmicos POS
  const imprimirTicketTérmico = (ticketHTML, ventaData) => {
    const printWindow = window.open("", "_blank", "width=400,height=600");

    const ticketContent = ventaData ? ticketHTML : generarHTMLTicketPago();

    printWindow.document.write("<!DOCTYPE html>");
    printWindow.document.write(
      '<html><head><title>Ticket de Venta</title><meta charset="UTF-8">',
    );
    printWindow.document.write(`
            <style>
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 8mm;
                        width: 64mm;
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 10pt;
                        line-height: 1.2;
                    }
                    * {
                        box-sizing: border-box;
                    }
                }
                @media screen {
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        padding: 20px;
                        max-width: 300px;
                        margin: 0 auto;
                        font-size: 12px;
                    }
                }
                .ticket-container {
                    width: 100%;
                    text-align: center;
                }
                .ticket-header {
                    text-align: center;
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px dashed #000;
                }
                .ticket-title {
                    font-size: 14pt;
                    font-weight: bold;
                    margin-bottom: 4px;
                }
                .ticket-fecha {
                    font-size: 9pt;
                }
                .ticket-linea {
                    border-top: 1px dashed #000;
                    margin: 8px 0;
                }
                .ticket-producto {
                    margin-bottom: 6px;
                    text-align: left;
                }
                .ticket-producto-nombre {
                    font-weight: bold;
                    margin-bottom: 2px;
                }
                .ticket-producto-detalle {
                    display: flex;
                    justify-content: space-between;
                    font-size: 9pt;
                }
                .ticket-total {
                    font-size: 12pt;
                    font-weight: bold;
                    text-align: right;
                    margin-top: 10px;
                    padding-top: 8px;
                    border-top: 1px dashed #000;
                }
                .ticket-footer {
                    text-align: center;
                    font-size: 9pt;
                    margin-top: 12px;
                    padding-top: 8px;
                    border-top: 1px dashed #000;
                }
                .ticket-method {
                    font-size: 9pt;
                    margin-top: 4px;
                }
                .ticket-change {
                    font-size: 9pt;
                    margin-top: 4px;
                }
            </style>
        `);
    printWindow.document.write("</head><body>");
    printWindow.document.write(ticketContent);
    printWindow.document.write("</body></html>");
    printWindow.document.close();

    // Esperar a que el contenido se cargue antes de imprimir
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // No cerrar automáticamente para permitir selección de impresora
    }, 250);
  };

  // Generar HTML del ticket desde el modal de pago (antes de finalizar)
  const generarHTMLTicketPago = () => {
    const fecha = new Date().toLocaleString("es-ES", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    let html = '<div class="ticket-container">';
    html += '<div class="ticket-header">';
    html += '<div class="ticket-title">TICKET DE VENTA</div>';
    html += `<div class="ticket-fecha">${fecha}</div>`;
    html += "</div>";
    html += '<div class="ticket-linea"></div>';

    // Productos
    carrito.forEach((item) => {
      html += '<div class="ticket-producto">';
      html += `<div class="ticket-producto-nombre">${item.name}</div>`;
      html += '<div class="ticket-producto-detalle">';
      html += `<span>Cant: ${item.quantity} x ${formatearDinero(item.price)}</span>`;
      html += `<span>${formatearDinero(item.price * item.quantity)}</span>`;
      html += "</div></div>";
    });

    html += '<div class="ticket-linea"></div>';

    // Totales
    html += '<div class="ticket-total">';
    html += `<div>Subtotal: ${formatearDinero(total)}</div>`;
    html += `<div>Total: ${formatearDinero(total)}</div>`;

    // Método de pago y cambio
    if (metodoPago) {
      const metodoTexto =
        metodoPago === "efectivo"
          ? "Efectivo"
          : metodoPago === "tarjeta"
            ? "Tarjeta"
            : "Transferencia";
      html += `<div class="ticket-method">Método: ${metodoTexto}</div>`;

      if (metodoPago === "efectivo" && montoRecibido) {
        const monto = parseFloat(montoRecibido) || 0;
        const cambio = calcularCambio();
        html += `<div class="ticket-method">Recibido: ${formatearDinero(monto)}</div>`;
        if (cambio > 0) {
          html += `<div class="ticket-change">Cambio: ${formatearDinero(cambio)}</div>`;
        }
      }
    }

    html += "</div>";
    html += '<div class="ticket-footer">¡Gracias por su compra!</div>';
    html += "</div>";

    return html;
  };

  // Función para imprimir desde el modal de pago
  const imprimirTicketPago = () => {
    const ticketHTML = generarHTMLTicketPago();
    imprimirTicketTérmico(ticketHTML, null);
  };

  return (
    <div className="sales-view">
      <div className="sales-content-wrapper">
        <div className="sales-main-area">
          <div className="sales-area-header">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center w-full gap-4">
              <div>
                <h1 className="sales-title">RECEPCIÓN DE LAVANDERÍA</h1>
                <p className="sales-subtitle">
                  Registra prendas, pesa y asigna clientes a las órdenes
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#/customer-display?u=${user?.id}&s=${cashSession?.id}`;
                    window.open(url, "_blank", "width=1024,height=768");
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-xl shadow-sm hover:bg-emerald-600 transition-all font-bold text-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    monitor
                  </span>
                  <span className="hidden sm:inline">Pantalla Cliente</span>
                </button>
                <button
                  onClick={() => {
                    console.log('[Sales] Recarga manual solicitada');
                    cargarDatos(true);
                  }}
                  disabled={loadingProducts}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-xl shadow-sm hover:bg-blue-600 transition-all font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Recargar productos"
                >
                  <span className={`material-symbols-outlined text-[18px] ${loadingProducts ? 'animate-spin' : ''}`}>
                    refresh
                  </span>
                  <span className="hidden sm:inline">{loadingProducts ? 'Cargando...' : 'Recargar'}</span>
                </button>
                <button
                  onClick={() => {
                    document.documentElement.classList.toggle("dark");
                    localStorage.setItem(
                      "theme",
                      document.documentElement.classList.contains("dark")
                        ? "dark"
                        : "light",
                    );
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md transition-all text-slate-600 dark:text-slate-300 font-bold text-xs"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    dark_mode
                  </span>
                  <span className="hidden sm:inline">Modo Oscuro</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECCIÓN DE CLIENTE */}
          <div className="search-section-modern mb-4">
            <label className="text-xs font-bold text-slate-500 mb-2 block">CLIENTE (OBLIGATORIO)</label>
            <div className="search-input-wrapper">
              <div className="search-input-container">
                <div className="search-icon-wrapper">
                  <span className="material-symbols-outlined">person_search</span>
                </div>
                <input
                  type="text"
                  placeholder="Buscar cliente por nombre o teléfono..."
                  value={clienteSeleccionado ? clienteSeleccionado.name : busquedaCliente}
                  onChange={(e) => {
                    setBusquedaCliente(e.target.value);
                    if (clienteSeleccionado) setClienteSeleccionado(null);
                  }}
                  className="barcode-input-modern flex-grow"
                />
                {!clienteSeleccionado && (
                  <button 
                    onClick={() => setMostrarModalNuevoCliente(true)}
                    className="ml-2 p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm transition-all"
                    title="Nuevo Cliente"
                  >
                    <span className="material-symbols-outlined">person_add</span>
                  </button>
                )}
              </div>
              {clienteSeleccionado && (
                <button 
                  onClick={() => setClienteSeleccionado(null)}
                  className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <span className="material-symbols-outlined">person_remove</span>
                </button>
              )}
            </div>

            {/* SUGERENCIAS DE CLIENTES */}
            {mostrarSugerenciasClientes && clientes.length > 0 && (
              <div className="suggestions-dropdown">
                {clientes.map((c) => (
                  <div
                    key={c.id}
                    className="suggestion-item"
                    onClick={() => {
                      setClienteSeleccionado(c);
                      setMostrarSugerenciasClientes(false);
                      setBusquedaCliente("");
                    }}
                  >
                    <div className="suggestion-info">
                      <span className="suggestion-name font-bold">{c.name}</span>
                      <span className="suggestion-price text-xs opacity-70">{c.phone || 'Sin teléfono'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DETALLES DE LA ORDEN */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="search-section-modern">
               <label className="text-xs font-bold text-slate-500 mb-2 block">FECHA DE ENTREGA PROMETIDA</label>
               <input 
                 type="date" 
                 value={fechaEntrega}
                 onChange={(e) => setFechaEntrega(e.target.value)}
                 className="barcode-input-modern w-full"
               />
            </div>
            <div className="search-section-modern">
               <label className="text-xs font-bold text-slate-500 mb-2 block">DETERMINAR ANTICIPO</label>
               <input 
                 type="number" 
                 placeholder="Ej. 100.00"
                 value={anticipo}
                 onChange={(e) => setAnticipo(e.target.value)}
                 className="barcode-input-modern w-full"
               />
            </div>
          </div>

          <div className="search-section-modern mb-4">
            <label className="text-xs font-bold text-slate-500 mb-2 block">NOTAS / OBSERVACIONES (PRENDAS, MANCHAS, ETC.)</label>
            <textarea 
              value={notasOrden}
              onChange={(e) => setNotasOrden(e.target.value)}
              placeholder="Ej. Saco con mancha en cuello, cobija king size..."
              className="barcode-input-modern w-full h-20 p-3"
            />
          </div>

          <hr className="my-6 border-slate-200" />
          <label className="text-xs font-bold text-slate-500 mb-2 block uppercase">Añadir Servicios / Productos</label>

          {/* SCANNER Y BÚSQUEDA */}
          <div
            className="search-section-modern"
            style={{ position: "relative" }}
          >
            <div className="search-input-wrapper">
              <div className="search-input-container">
                <div className="search-icon-wrapper">
                  <span className="material-symbols-outlined">search</span>
                </div>
                <input
                  ref={campoCodigoRef}
                  type="text"
                  placeholder="Buscar por nombre o código de..."
                  value={codigoEscaneado}
                  onChange={manejarCambioCodigo}
                  onKeyDown={manejarEnter}
                  onBlur={() =>
                    setTimeout(() => setMostrarSugerencias(false), 200)
                  }
                  className="barcode-input-modern"
                />
              </div>
              <button
                onClick={() => setMostrarCameraScanner(true)}
                className="btn-camera-modern"
                type="button"
                title="Escanear código con cámara"
              >
                <span className="material-symbols-outlined">photo_camera</span>
                <span>Cámara</span>
              </button>
            </div>

            {/* LISTA DE SUGERENCIAS */}
            {mostrarSugerencias && (
              <div className="suggestions-dropdown">
                {sugerencias.map((producto, index) => (
                  <div
                    key={producto.id}
                    className={`suggestion-item ${index === indexSugerencia ? "active" : ""}`}
                    onClick={() => seleccionarProducto(producto)}
                    onMouseEnter={() => setIndexSugerencia(index)}
                  >
                    <div className="suggestion-image">
                      {producto.image_url ? (
                        <img src={producto.image_url} alt={producto.name} />
                      ) : (
                        <div className="no-img">📦</div>
                      )}
                    </div>
                    <div className="suggestion-info">
                      <span className="suggestion-name">{producto.name}</span>
                      <span className="suggestion-price">
                        {formatearDinero(producto.price)}
                      </span>
                    </div>
                    <span className="suggestion-stock">
                      Stock: {producto.stock}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ESTADO VACÍO O CARGANDO */}
          {loadingProducts ? (
            <div className="empty-scan-area">
              <div className="empty-scan-icon spin">
                <span className="material-symbols-outlined">sync</span>
              </div>
              <h3 className="empty-scan-title">Cargando productos...</h3>
              <p className="empty-scan-text">Por favor espera un momento.</p>
            </div>
          ) : errorProducts ? (
            <div className="empty-scan-area error">
              <div className="empty-scan-icon text-red-500">
                <span className="material-symbols-outlined">error</span>
              </div>
              <h3 className="empty-scan-title text-red-500">Error de carga</h3>
              <p className="empty-scan-text">{errorProducts}</p>
              <button
                onClick={() => cargarDatos(true)}
                className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : (
            !cargando &&
            !isScanning &&
            carrito.length === 0 && (
              <div className="empty-scan-area">
                <div className="empty-scan-icon">
                  <span className="material-symbols-outlined">
                    qr_code_scanner
                  </span>
                </div>
                <h3 className="empty-scan-title">Listo para escanear</h3>
                <p className="empty-scan-text">
                  Usa la búsqueda o el botón de cámara para agregar productos a
                  la venta.
                </p>
              </div>
            )
          )}

          {/* INDICADOR DE CARGA */}
          {cargando && <div className="notification info">Procesando...</div>}

          {/* INDICADOR DE ESCANEADO */}
          {isScanning && (
            <div className="notification info">Escaneando código...</div>
          )}
        </div>

        {/* CARRITO LATERAL */}
        <div className="cart-sidebar">
          <div className="cart-sidebar-header">
            <h2 className="cart-sidebar-title">Carrito de Compras</h2>
          </div>

          {carrito.length === 0 ? (
            <div className="empty-cart-modern">
              <div className="empty-cart-icon">
                <span className="material-symbols-outlined">
                  shopping_cart_off
                </span>
              </div>
              <p className="empty-cart-text">El carrito está vacío</p>
              <p className="empty-cart-subtext">
                Agrega productos para comenzar
              </p>
            </div>
          ) : (
            <div className="cart-items-modern">
              {carrito.map((item) => (
                <div key={item.id} className="cart-item-modern">
                  <div className="item-image-modern">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : (
                      <div className="item-image-placeholder">
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          ></rect>
                          <circle cx="8.5" cy="8.5" r="1.5"></circle>
                          <path d="M21 15l-5-5L5 21"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="item-info-modern">
                    <h3 className="item-name-modern">{item.name}</h3>
                    <div className="item-price-modern">
                      {formatearDinero(item.price)}
                    </div>
                  </div>
                  <div className="quantity-controls-modern">
                    <button
                      className="qty-btn-modern"
                      onClick={() =>
                        cambiarCantidad(item.id, item.quantity - 1)
                      }
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      className="quantity-input-modern"
                      value={item.quantity === 0 ? "" : item.quantity}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 0) {
                          cambiarCantidad(item.id, val);
                        } else if (e.target.value === "") {
                          cambiarCantidad(item.id, 0);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      onBlur={(e) => {
                        if (item.quantity <= 0) {
                          cambiarCantidad(item.id, 1);
                        }
                      }}
                    />
                    <button
                      className="qty-btn-modern"
                      onClick={() =>
                        cambiarCantidad(item.id, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <div className="item-total-modern">
                    Total: {formatearDinero(item.price * item.quantity)}
                  </div>
                  <button
                    className="remove-btn-modern"
                    onClick={() => quitarProducto(item.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TOTAL Y FINALIZAR */}
          <div className="cart-footer-modern">
            <div className="cart-summary-modern">
              <div className="summary-row">
                <span className="summary-label">Subtotal</span>
                <span className="summary-value">{formatearDinero(total)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Impuestos</span>
                <span className="summary-value">$0.00</span>
              </div>
              <div className="summary-row summary-total">
                <span className="summary-label">Total</span>
                <span className="summary-value">{formatearDinero(total)}</span>
              </div>
            </div>
            <button
              onClick={abrirModalPago}
              disabled={vendiendo || carrito.length === 0 || !clienteSeleccionado}
              className="btn-process-payment"
            >
              {!clienteSeleccionado ? 'Selecciona un Cliente' : 'Registrar Orden'}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE PAGO */}
      {mostrarModalPago && (
        <div
          className="payment-modal-overlay modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarModalPago();
          }}
        >
          <div
            className="payment-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="payment-modal-close" onClick={cerrarModalPago}>
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="payment-modal-content">
              {/* LADO IZQUIERDO - RESUMEN */}
              <div className="payment-summary-section">
                <div className="payment-summary-header">
                  <h3 className="payment-summary-title">
                    <span className="material-symbols-outlined">
                      assignment
                    </span>
                    Detalles de Orden
                  </h3>
                  <span className="payment-transaction-id">
                    #{transactionId}
                  </span>
                </div>

                <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                   <p className="text-xs font-bold text-slate-500 uppercase">Cliente</p>
                   <p className="text-sm font-bold text-slate-900">{clienteSeleccionado?.name}</p>
                   <p className="text-xs text-slate-500">Promrometido: {fechaEntrega}</p>
                </div>

                <div className="payment-items-list">
                  {carrito.map((item) => (
                    <div key={item.id} className="payment-item-row">
                      <div className="payment-item-info">
                        <p className="payment-item-name">
                          {item.name} (x{item.quantity})
                        </p>
                        <p className="payment-item-category">
                          ${formatearDinero(item.price)} c/u
                        </p>
                      </div>
                      <span className="payment-item-price">
                        {formatearDinero(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="payment-summary-footer">
                  <div className="payment-summary-totals">
                    <div className="payment-summary-row">
                      <span>Subtotal</span>
                      <span>{formatearDinero(total)}</span>
                    </div>
                    <div className="payment-summary-row">
                      <span>Impuestos (16%)</span>
                      <span>$0.00</span>
                    </div>
                  </div>
                  <div className="payment-total-final">
                    <span className="payment-total-label">Total</span>
                    <span className="payment-total-amount">
                      {formatearDinero(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* LADO DERECHO - MÉTODO DE PAGO */}
              <div className="payment-method-section">
                <div className="payment-method-content">
                  <h3 className="payment-method-title">MÉTODO DE PAGO</h3>

                  <div className="payment-method-buttons">
                    <button
                      className={`payment-method-btn ${metodoPago === "efectivo" ? "active" : ""}`}
                      onClick={() => {
                        setMetodoPago("efectivo");
                        setMontoRecibido("");
                      }}
                    >
                      <span className="material-symbols-outlined">
                        payments
                      </span>
                      <span>Efectivo</span>
                    </button>
                    <button
                      className={`payment-method-btn ${metodoPago === "tarjeta" ? "active" : ""}`}
                      onClick={() => {
                        setMetodoPago("tarjeta");
                        setMontoRecibido(total.toFixed(2));
                      }}
                    >
                      <span className="material-symbols-outlined">
                        credit_card
                      </span>
                      <span>Tarjeta</span>
                    </button>
                    <button
                      className={`payment-method-btn ${metodoPago === "transferencia" ? "active" : ""}`}
                      onClick={() => {
                        setMetodoPago("transferencia");
                        setMontoRecibido(total.toFixed(2));
                      }}
                    >
                      <span className="material-symbols-outlined">
                        account_balance
                      </span>
                      <span>Transferencia</span>
                    </button>

                    {tipoCambio && (
                      <button
                        className={`payment-method-btn ${metodoPago === "dolares" ? "active" : ""}`}
                        onClick={() => {
                          setMetodoPago("dolares");
                          setMontoRecibido("");
                        }}
                      >
                        <span className="material-symbols-outlined">
                          currency_exchange
                        </span>
                        <span>Dólares</span>
                      </button>
                    )}
                  </div>

                  <div className="payment-amount-section">
                    <div className="payment-amount-input-section">
                      <label className="payment-amount-label">
                        {metodoPago === "dolares"
                          ? "ANTICIPO RECIBIDO (USD)"
                          : "ANTICIPO RECIBIDO"}
                      </label>
                      <div className="payment-amount-display">
                        <span className="payment-amount-value">
                          ${formatearMontoRecibido()}
                        </span>
                      </div>

                      <div className="mt-4 p-2 bg-blue-50 text-blue-800 rounded text-center text-xs">
                         <span className="font-bold">Saldo Pendiente:</span> {formatearDinero(total - (parseFloat(montoRecibido) || 0))}
                      </div>

                      {metodoPago === "dolares" && (
                        <div className="text-center mt-2 text-sm text-slate-500 font-bold">
                          Tipo de cambio: ${tipoCambio} MXN
                          <div className="text-emerald-600 mt-1">
                            Total a cubrir: ${(total / tipoCambio).toFixed(2)}{" "}
                            USD
                          </div>
                        </div>
                      )}

                      {(metodoPago === "efectivo" ||
                        metodoPago === "dolares") && (
                          <div className="payment-keypad">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0, ".", "backspace"].map(
                              (num) => (
                                <button
                                  key={num}
                                  className={`payment-key ${num === "backspace" ? "backspace" : ""}`}
                                  onClick={() => manejarTecladoNumerico(num)}
                                >
                                  {num === "backspace" ? (
                                    <span className="material-symbols-outlined">
                                      backspace
                                    </span>
                                  ) : (
                                    num
                                  )}
                                </button>
                              ),
                            )}
                          </div>
                        )}
                    </div>

                    {(metodoPago === "efectivo" ||
                      metodoPago === "dolares") && (
                        <div className="payment-change-section">
                          <div className="payment-change-box">
                            <p className="payment-change-label">CAMBIO</p>
                            <p className="payment-change-amount">
                              {formatearDinero(Math.max(0, calcularCambio()))}
                            </p>
                          </div>
                          <div className="payment-receipt-actions">
                            <button
                              className="payment-receipt-btn"
                              onClick={imprimirTicketPago}
                            >
                              <span className="material-symbols-outlined">
                                print
                              </span>
                              Imprimir Ticket
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                <div className="payment-modal-actions">
                  <button
                    className="payment-finalize-btn"
                    onClick={finalizarVenta}
                    disabled={!modalReady}
                  >
                    Registrar Orden
                  </button>
                  <button
                    className="payment-cancel-btn"
                    onClick={cerrarModalPago}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL VENTA COMPLETADA */}
      {mostrarModal && ventaCompletada && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-ticket-container">
              <TicketVenta venta={ventaCompletada} ref={ticketRef} />
              <div className="modal-footer modal-footer-ticket">
                <button
                  className="btn-imprimir-ticket"
                  onClick={imprimirTicket}
                >
                  Imprimir ticket
                </button>
                <button className="btn-cerrar-modal" onClick={cerrarModal}>
                  Continuar Vendiendo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERSONALIZADO PARA ERRORES */}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={cerrarModalPersonalizado}>
          <div
            className={`modal-content ${modal.type}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close-btn"
              onClick={cerrarModalPersonalizado}
            >
              ×
            </button>
            <div className={`modal-title ${modal.type}`}>{modal.title}</div>
            <div className="modal-message">{modal.message}</div>
            <div className="modal-footer">
              <button
                className="btn-modal-ok"
                onClick={cerrarModalPersonalizado}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO CLIENTE */}
      {mostrarModalNuevoCliente && (
        <div className="modal-overlay" onClick={() => setMostrarModalNuevoCliente(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Registrar Nuevo Cliente</h3>
              <button 
                onClick={() => setMostrarModalNuevoCliente(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleCrearCliente} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">NOMBRE COMPLETO</label>
                <input 
                  type="text" 
                  required
                  className="barcode-input-modern w-full"
                  value={nuevoCliente.name}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, name: e.target.value})}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">TELÉFONO</label>
                <input 
                  type="text" 
                  className="barcode-input-modern w-full"
                  value={nuevoCliente.phone}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, phone: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">DIRECCIÓN</label>
                <textarea 
                  className="barcode-input-modern w-full h-20 p-2"
                  value={nuevoCliente.address}
                  onChange={(e) => setNuevoCliente({...nuevoCliente, address: e.target.value})}
                ></textarea>
              </div>
              <div className="modal-footer pt-4">
                <button type="submit" className="btn-modal-ok w-full bg-emerald-500">
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SCANNER DE CÁMARA */}
      <CameraScanner
        isOpen={mostrarCameraScanner}
        onClose={() => setMostrarCameraScanner(false)}
        onScan={manejarEscaneoCamara}
      />
    </div>
  );
};
