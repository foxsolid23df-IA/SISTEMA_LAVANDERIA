import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import { orderService } from "../../services/orderService";
import { staffService } from "../../services/staffService";
import { exchangeRateService } from "../../services/exchangeRateService";
import { businessSettingsService } from "../../services/businessSettingsService";
import { printService } from "../../services/printService";
import { shelvingService } from "../../services/shelvingService";
import ShelfAssignmentModal from "../shelving/ShelfAssignmentModal";
import TicketVenta from "./TicketVenta";
import RemisionPreviewModal from "./RemisionPreviewModal";
import { formatearDinero } from "../../utils";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";
import "./Orders.css";
import { supabase } from "../../supabase";
import { platform } from "../../utils/platform";

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
    console.warn("[Orders] No se pudo reproducir alerta sonora:", err);
  }
};

export const Orders = () => {
  const { activeStaff } = useAuth();
  const { settings } = useSettings();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, received, processing, ready, delivered

  // Nuevos estados para filtros y busqueda
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);

  // New States for Enhancements
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'kanban' | 'excel'
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterServiceType, setFilterServiceType] = useState(""); // 'kg' | 'unit'
  const [employees, setEmployees] = useState([]);

  // Filtros avanzados (Bug 3)
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(""); // efectivo, tarjeta, transferencia
  const [paymentStatus, setPaymentStatus] = useState(""); // pending, paid

  // Estados para liquidacion de pago
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderToLiquidate, setOrderToLiquidate] = useState(null);
  const [metodoPago, setMetodoPago] = useState("cash");
  const [montoRecibido, setMontoRecibido] = useState("");
  const [montoRecibidoUSD, setMontoRecibidoUSD] = useState("");
  const [usarUSD, setUsarUSD] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estados para reimpresion
  const [businessSettings, setBusinessSettings] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [orderToPrint, setOrderToPrint] = useState(null);
  const ticketRef = useRef(null);
  const [showRemisionPreview, setShowRemisionPreview] = useState(false);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false);
  const [orderToUpdateMethod, setOrderToUpdateMethod] = useState(null);
  const [newMethodSelection, setNewMethodSelection] = useState("");

  // Estados para estanterías
  const [shelfAssignments, setShelfAssignments] = useState([]);
  const [showShelfModal, setShowShelfModal] = useState(false);
  const [selectedOrderForShelf, setSelectedOrderForShelf] = useState(null);
  const [shelvingEnabled, setShelvingEnabled] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const resp = await Promise.all([
        orderService.getOrders(),
        exchangeRateService.getActiveRate(),
        businessSettingsService.getSettings(),
        staffService.getStaff(),
      ]);
      setOrders(resp[0]);
      if (resp[1] && resp[1].is_active) {
        setExchangeRate(resp[1]);
      }
      setBusinessSettings(resp[2]);
      setEmployees(resp[3] || []);
      setShelvingEnabled(resp[2]?.shelving_enabled || false);

      // Cargar asignaciones de estanterías si está habilitado
      if (resp[2]?.shelving_enabled) {
        try {
          const assignments = await shelvingService.getShelfAssignments();
          setShelfAssignments(assignments);
        } catch (e) {
          console.warn("Error loading shelf assignments:", e);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const reloadOrdersSilent = async () => {
    try {
      const updatedOrders = await orderService.getOrders();
      setOrders(updatedOrders);
    } catch (error) {
      console.error("Error silently reloading orders:", error);
    }
  };

  useEffect(() => {
    loadOrders();

    // Suscribirse a cambios en tiempo real en la tabla orders
    const channel = supabase
      .channel('orders-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log("[Realtime] Cambio detectado en orders:", payload);
          
          // Recargar silenciosamente la lista de ordenes
          reloadOrdersSilent();

          // Si es una insercion y no estamos en electron (.exe)
          if (payload.eventType === 'INSERT' && !platform.isElectron) {
            playNewOrderSound();
            Swal.fire({
              title: "Nueva Orden Recibida",
              text: `Se ha creado una nueva orden (Folio: ${payload.new.folio ? payload.new.folio.toString().padStart(6, '0') : payload.new.id}).`,
              icon: "info",
              toast: true,
              position: "top-end",
              timer: 4000,
              showConfirmButton: false,
              timerProgressBar: true
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStatusChange = async (order, newStatus) => {
    const orderId = order.id;
    const orderNumber = order.folio
      ? order.folio.toString().padStart(6, "0")
      : order.id.toString().slice(-6).toUpperCase();
    const balance = order.total - (order.paid_amount || 0);
    const isPaid = order.payment_status === "paid" || balance <= 0;

    if (newStatus === "cancelled") {
      const firstConfirm = await Swal.fire({
        title: "Iniciar Cancelacion?",
        text: "Se iniciara el proceso de cancelacion de la orden. Deseas continuar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748B",
        confirmButtonText: "Continuar",
        cancelButtonText: "Volver",
      });

      if (!firstConfirm.isConfirmed) return;

      const secondConfirm = await Swal.fire({
        title: "Confirmacion de Seguridad",
        text: "Estas seguro que quieren cancelar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#ef4444",
        cancelButtonColor: "#64748B",
        confirmButtonText: "SI",
        cancelButtonText: "NO",
      });

      if (!secondConfirm.isConfirmed) return;
    }

    if (newStatus === "ready" || newStatus === "delivered") {
      const actionText =
        newStatus === "ready"
          ? "marcada como LISTA"
          : "registrada como ENTREGADA";

      if (isPaid) {
        Swal.fire({
          title: "Orden Pagada",
          text: `La orden #${orderNumber} ha sido ${actionText}. El pago esta completo.`,
          icon: "success",
          timer: 3000,
          toast: true,
          position: "top-end",
          showConfirmButton: false,
        });
      } else {
        if (newStatus === "delivered") {
          const result = await Swal.fire({
            title: "Saldo Pendiente!",
            text: `La orden #${orderNumber} tiene un saldo de ${formatearDinero(balance)}. Confirmar entrega sin liquidar?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Si, entregar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#f43f5e",
          });
          if (!result.isConfirmed) return;
        } else {
          Swal.fire({
            title: "Saldo Pendiente",
            text: `Orden ${actionText}. Recordatorio: Falta cobrar ${formatearDinero(balance)}.`,
            icon: "warning",
            timer: 4000,
            toast: true,
            position: "top-end",
            showConfirmButton: false,
          });
        }
      }
    }

    try {
      await orderService.updateOrderStatus(
        orderId,
        newStatus,
        activeStaff?.id || null,
      );
      // Actualizar estado localmente para rapidez
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
      );

      // Enviar notificacion WhatsApp cuando la orden esta lista (no bloqueante)
      if (newStatus === 'ready') {
        orderService.notifyOrderReady(orderId).catch((e) =>
          console.warn('[Orders] No se pudo enviar notificacion WhatsApp de orden lista:', e)
        );
      }

      // Auto-desasignar estantería al entregar
      if (newStatus === 'delivered' && shelvingEnabled) {
        try {
          await shelvingService.unassignOrder(orderId, activeStaff?.name || 'Sistema');
          const updatedAssignments = await shelvingService.getShelfAssignments();
          setShelfAssignments(updatedAssignments);
        } catch (e) {
          console.warn("Error auto-desasignando estantería:", e);
        }
      }
    } catch (error) {
      Swal.fire("Error", "No se pudo actualizar el estado", "error");
    }
  };

  const handleOrderDelete = async (orderId) => {
    const { value: password } = await Swal.fire({
      title: "Seguridad del Sistema",
      text: "Ingresa la contrasena del administrador para eliminar esta orden:",
      input: "password",
      inputPlaceholder: "Contrasena de Seguridad",
      showCancelButton: true,
      confirmButtonText: "Confirmar Eliminacion",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#000000",
    });

    if (password) {
      const isValidAdmin = await staffService.validateAdminPin(password);

      if (isValidAdmin) {
        const confirm = await Swal.fire({
          title: "Eliminar esta orden?",
          text: "La orden sera removida de la vista activa. El stock se restaurara automaticamente.",
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#ef4444",
          cancelButtonColor: "#000000",
          confirmButtonText: "Si, eliminar",
          cancelButtonText: "Cancelar",
        });

        if (confirm.isConfirmed) {
          try {
            await orderService.deleteOrder(orderId, activeStaff?.id || null, 'Eliminada desde panel de ordenes');
            setOrders((prev) => prev.filter((o) => o.id !== orderId));
            Swal.fire({
              title: "Orden Eliminada",
              icon: "success",
              timer: 2000,
              showConfirmButton: false,
            });
          } catch (error) {
            Swal.fire(
              "Error",
              "No se pudo eliminar la orden: " + error.message,
              "error",
            );
          }
        }
      } else {
        Swal.fire("Error", "PIN de administrador incorrecto", "error");
      }
    }
  };

  const handleLiquidatePayment = (order) => {
    setOrderToLiquidate(order);
    setMetodoPago("cash");
    setMontoRecibido("");
    setMontoRecibidoUSD("");
    setUsarUSD(false);
    setIsPaymentModalOpen(true);
  };

  const finalizeLiquidation = async () => {
    if (!orderToLiquidate) return;

    setIsProcessing(true);
    try {
      const finalMethod = usarUSD ? "usd_cash" : metodoPago;

      await orderService.updateOrderPayment(orderToLiquidate.id, {
        paid_amount: orderToLiquidate.total,
        payment_status: "paid",
        payment_method: finalMethod,
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderToLiquidate.id
            ? {
                ...o,
                paid_amount: o.total,
                payment_status: "paid",
                payment_method: finalMethod,
              }
            : o,
        ),
      );

      Swal.fire({
        title: "Pago Liquidado!",
        text: `La orden #${orderToLiquidate.folio ? orderToLiquidate.folio.toString().padStart(6, "0") : orderToLiquidate.id.toString().slice(-6).toUpperCase()} ha sido pagada totalmente.`,
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });

      setIsPaymentModalOpen(false);
      setOrderToLiquidate(null);
    } catch (error) {
      console.error("Error finalizing liquidation:", error);
      Swal.fire("Error", "No se pudo registrar el pago", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReprint = (order) => {
    const assignment = shelfAssignments.find(a => a.order_id === order.id);
    const ventaData = {
      ...order,
      cliente: order.customers,
      metodo_pago: order.payment_method,
      productos: order.order_items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        price: i.price,
        pricing_type: i.pricing_type,
        category: i.category || null,
      })),
      shelfAssignment: assignment || null,
    };
    setOrderToPrint(ventaData);
  };

  const handleReprintNota = (order) => {
    const assignment = shelfAssignments.find(a => a.order_id === order.id);
    const ventaData = {
      ...order,
      cliente: order.customers,
      metodo_pago: order.payment_method,
      productos: order.order_items.map((i) => ({
        name: i.product_name,
        quantity: i.quantity,
        price: i.price,
        pricing_type: i.pricing_type,
        category: i.category || null,
      })),
      shelfAssignment: assignment || null,
    };
    setOrderToPrint(ventaData);
    setShowRemisionPreview(true);
  };

  const handleUpdateMethod = (order) => {
    if (order.status === "delivered") {
      Swal.fire({
        title: "Accion no permitida",
        text: "No se puede cambiar el metodo de pago de una orden que ya ha sido entregada.",
        icon: "error",
        confirmButtonColor: "#10b981",
      });
      return;
    }
    setOrderToUpdateMethod(order);
    setNewMethodSelection(order.payment_method || "cash");
    setIsMethodModalOpen(true);
  };

  const finalizeMethodUpdate = async () => {
    if (!orderToUpdateMethod || !newMethodSelection) return;
    setIsProcessing(true);
    try {
      await orderService.updateOrderPaymentMethod(
        orderToUpdateMethod.id,
        newMethodSelection,
      );
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderToUpdateMethod.id
            ? { ...o, payment_method: newMethodSelection }
            : o,
        ),
      );
      Swal.fire({
        title: "Metodo de Pago Actualizado",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
      setIsMethodModalOpen(false);
      setOrderToUpdateMethod(null);
    } catch (error) {
      console.error("Error updating method:", error);
      Swal.fire("Error", "No se pudo actualizar el metodo de pago", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== FUNCIONES DE ESTANTERÍAS ====================

  const getShelfForOrder = (orderId) => {
    return shelfAssignments.find(a => a.order_id === orderId);
  };

  const handleOpenShelfModal = (order) => {
    setSelectedOrderForShelf(order);
    setShowShelfModal(true);
  };

  const handleAssignShelf = async (shelfId) => {
    if (!selectedOrderForShelf || !shelfId) return;
    try {
      await shelvingService.assignOrderToShelf(
        selectedOrderForShelf.id,
        shelfId,
        activeStaff?.name || 'Sistema'
      );
      const assignments = await shelvingService.getShelfAssignments();
      setShelfAssignments(assignments);
      setShowShelfModal(false);
      setSelectedOrderForShelf(null);
      Swal.fire({
        title: "¡Asignada!",
        text: "Orden asignada a la estantería correctamente",
        icon: "success",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const handleUnassignShelf = async (orderId) => {
    const result = await Swal.fire({
      title: "¿Quitar asignación?",
      text: "La ropa se marcará como retirada",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Sí, quitar"
    });
    if (!result.isConfirmed) return;
    try {
      await shelvingService.unassignOrder(orderId);
      const assignments = await shelvingService.getShelfAssignments();
      setShelfAssignments(assignments);
      Swal.fire({
        title: "Desasignada",
        icon: "success",
        timer: 2000,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire("Error", err.message, "error");
    }
  };

  const imprimirTicket = async () => {
    if (!ticketRef.current || !businessSettings || isPrinting) return;
    setIsPrinting(true);
    try {
      await printService.print(ticketRef.current, businessSettings.printer_name, {
        copies: 1,
        settings: businessSettings,
      });
    } catch (error) {
      console.error("Error al imprimir:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const statusLabels = {
    received: {
      label: "Recibido",
      color: "bg-blue-100 text-blue-700 border-blue-200",
    },
    processing: {
      label: "En Lavado/Proceso",
      color: "bg-orange-100 text-orange-700 border-orange-200",
    },
    ready: {
      label: "Listo para Entrega",
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    },
    delivered: {
      label: "Entregado",
      color: "bg-slate-100 text-slate-700 border-slate-200",
    },
    cancelled: {
      label: "Cancelado",
      color: "bg-red-100 text-red-700 border-red-200",
    },
  };

  // Logica de filtrado avanzada
  const filteredOrders = orders.filter((order) => {
    // 1. Filtro por Estado
    if (filter !== "all" && order.status !== filter) return false;

    // 2. Filtro por Busqueda de Texto (ID o Nombre Cliente)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const clientName = order.customers?.name?.toLowerCase() || "";
      const orderId = order.id.toString();
      if (!clientName.includes(term) && !orderId.includes(term)) {
        return false;
      }
    }

    // 3. Filtro por Rango de Fechas (Fecha de creacion)
    if (dateRange.start) {
      const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0);
      const startDate = new Date(dateRange.start).setHours(0, 0, 0, 0);
      if (orderDate < startDate) return false;
    }
    if (dateRange.end) {
      const orderDate = new Date(order.created_at).setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.end).setHours(0, 0, 0, 0);
      if (orderDate > endDate) return false;
    }

    // 4. Filtro por Monto
    if (minAmount && order.total < parseFloat(minAmount)) return false;
    if (maxAmount && order.total > parseFloat(maxAmount)) return false;

    // 5. Filtro por Metodo de Pago
    if (paymentMethod && order.payment_method !== paymentMethod) return false;

    // 6. Filtro por Estado de Pago
    if (paymentStatus) {
      const balance = order.total - (order.paid_amount || 0);
      const isPaid = order.payment_status === "paid" || balance <= 0;
      if (paymentStatus === "paid" && !isPaid) return false;
      if (paymentStatus === "pending" && isPaid) return false;
    }

    // 7. Filtro por Empleado
    if (filterEmployee) {
      if (order.user_id !== filterEmployee) return false;
    }

    // 8. Filtro por Tipo de Servicio
    if (filterServiceType) {
      const hasType = order.order_items?.some(
        (item) => item.pricing_type === filterServiceType,
      );
      if (!hasType) return false;
    }

    return true;
  });

  const getEmployeeName = (order) => {
    if (order.assigned_staff && order.assigned_staff.name) {
      return order.assigned_staff.name;
    }
    if (order.staff && order.staff.name) {
      return order.staff.name;
    }
    return "Sistema";
  };

  // Kanban Logic
  const handleDragStart = (e, order) => {
    e.dataTransfer.setData("orderId", order.id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    const orderId = parseInt(e.dataTransfer.getData("orderId"));
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return;
    await handleStatusChange(order, newStatus);
  };

  const KanbanColumn = ({ status, title }) => {
    const columnOrders = filteredOrders.filter((o) => o.status === status);
    return (
      <div
        className="kanban-column bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 min-w-[280px] flex-1 flex flex-col h-full border border-slate-200 dark:border-slate-700"
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, status)}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-slate-700 dark:text-slate-300 uppercase text-xs tracking-wider">
            {title}
          </h3>
          <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {columnOrders.length}
          </span>
        </div>
        <div className="space-y-3 overflow-y-auto flex-1 pr-1 custom-scrollbar">
          {columnOrders.map((order) => (
            <div
              key={order.id}
              className="kanban-card bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm cursor-move hover:shadow-md transition-all active:cursor-grabbing"
              draggable
              onDragStart={(e) => handleDragStart(e, order)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-xs">
                    #
                    {order.folio
                      ? order.folio.toString().padStart(6, "0")
                      : order.id.toString().slice(-6).toUpperCase()}{" "}
                    - {order.customers?.name.split(" ")[0]}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    {order.order_items?.length} items -{" "}
                    {formatearDinero(order.total)}
                  </p>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">                    {getEmployeeName(order)}
                  </p>
                </div>
              </div>
              {order.notes && (
                <div className="text-[10px] text-slate-400 italic bg-slate-50 dark:bg-slate-900 rounded p-1 mb-2">
                  "{order.notes.substring(0, 30)}..."
                </div>
              )}
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => handleReprint(order)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400"
                  title="Imprimir ticket"
                >
                  <span className="material-symbols-outlined text-sm">
                    print
                  </span>
                </button>
                {businessSettings?.enable_remision_print && (
                  <button
                    onClick={() => handleReprintNota(order)}
                    className="p-1 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded text-amber-500"
                    title="Imprimir nota de remisión"
                  >
                    <span className="material-symbols-outlined text-sm">
                      receipt_long
                    </span>
                  </button>
                )}
                {order.status !== "delivered" && (
                  <button
                    onClick={() => handleUpdateMethod(order)}
                    className="p-1 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded text-emerald-500"
                    title="Cambiar metodo de pago"
                  >
                    <span className="material-symbols-outlined text-sm">
                      currency_exchange
                    </span>
                  </button>
                )}
              </div>
            </div>
          ))}
          {columnOrders.length === 0 && (
            <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              <span className="text-xs text-slate-400">Sin ordenes</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Funcion para exportar a Excel detallado
  const exportToExcel = () => {
    const dataToExport = [];

    filteredOrders.forEach((order) => {
      // Si por alguna razon la orden no tiene items, crear una fila basica
      if (!order.order_items || order.order_items.length === 0) {
        dataToExport.push({
          "ID Orden": order.id,
          Cliente: order.customers?.name || "Cliente General",
          "Telefono": order.customers?.phone || "",
          Estado: statusLabels[order.status]?.label || order.status,
          "Fecha Creacion": new Date(order.created_at).toLocaleDateString(),
          "Fecha Prometida": new Date(order.promised_at).toLocaleDateString(),
          Cantidad: "",
          Unidad: "",
          "Articulo": "Sin articulos",
          Total: order.total,
          Pagado: order.paid_amount,
          Debe: Math.max(0, order.total - (order.paid_amount || 0)),
          Notas: order.notes || "",
        });
      } else {
        // Crear una fila por cada articulo de la orden
        order.order_items.forEach((item, index) => {
          dataToExport.push({
            "ID Orden": order.id,
            Cliente: order.customers?.name || "Cliente General",
            "Telefono": order.customers?.phone || "",
            Estado: statusLabels[order.status]?.label || order.status,
            "Fecha Creacion": new Date(order.created_at).toLocaleDateString(),
            "Fecha Prometida": new Date(order.promised_at).toLocaleDateString(),
            Cantidad: item.quantity,
            Unidad: item.pricing_type === "kg" ? "kg" : "pza",
            "Articulo": item.product_name,
            // Montos monetarios y notas solo en la primera fila para evitar duplicidad en sumas de Excel
            Total: index === 0 ? order.total : "",
            Pagado: index === 0 ? order.paid_amount || 0 : "",
            Debe:
              index === 0
                ? Math.max(0, order.total - (order.paid_amount || 0))
                : "",
            Notas: index === 0 ? order.notes || "" : "",
          });
        });
      }
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ordenes Detalladas");
    XLSX.writeFile(
      wb,
      `Reporte_Detallado_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
  };

  return (
    <div className="orders-container p-6 bg-white dark:bg-slate-950 min-h-screen transition-colors duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
            Gestion de Lavanderia
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Administra el ciclo de vida de las prendas
          </p>
        </div>

        <div className="orders-status-tabs flex gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-x-auto max-w-full">
          {["all", "received", "processing", "ready", "delivered"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-emerald-500 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              {f === "all" ? "Todos" : statusLabels[f]?.label}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-emerald-100 text-emerald-600" : "text-slate-400 hover:text-emerald-500"}`}
            title="Vista Grid"
          >
            <span className="material-symbols-outlined text-xl">grid_view</span>
          </button>
          <button
            onClick={() => setViewMode("kanban")}
            className={`p-2 rounded-lg transition-all ${viewMode === "kanban" ? "bg-emerald-100 text-emerald-600" : "text-slate-400 hover:text-emerald-500"}`}
            title="Vista Kanban"
          >
            <span className="material-symbols-outlined text-xl">
              view_kanban
            </span>
          </button>
          {settings?.express_workflow_enabled && (
            <button
              onClick={() => setViewMode("excel")}
              className={`p-2 rounded-lg transition-all ${viewMode === "excel" ? "bg-emerald-100 text-emerald-600" : "text-slate-400 hover:text-emerald-500"}`}
              title="Vista Excel"
            >
              <span className="material-symbols-outlined text-xl">
                table_view
              </span>
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE HERRAMIENTAS DE FILTROS Y EXPORTACION */}
      <div className="orders-toolbar bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 animate-fade-in-down">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Buscador */}
          <div className="relative w-full md:w-auto md:flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 z-10">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por Cliente o # Orden..."
              className="w-full pl-14 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Acciones */}
          <div className="orders-toolbar-actions flex gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${showFilters ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
            >
              <span className="material-symbols-outlined text-lg">
                filter_list
              </span>
              Filtros
            </button>

            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">
                download
              </span>
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Filtros Expandibles (Rango de Fechas) */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Desde
              </label>
              <input
                type="date"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold black-calendar-icon"
                value={dateRange.start}
                onChange={(e) =>
                  setDateRange({ ...dateRange, start: e.target.value })
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Hasta
              </label>
              <input
                type="date"
                className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-bold black-calendar-icon"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange({ ...dateRange, end: e.target.value })
                }
              />
            </div>

            {/* Filtros avanzados (Bug 3) */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Monto
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Max"
                  className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Pago
              </label>
              <div className="flex gap-2">
                <select
                  className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="">Metodo...</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
                <select
                  className="w-1/2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                >
                  <option value="">Estado...</option>
                  <option value="paid">Pagado</option>
                  <option value="pending">Pendiente</option>
                </select>
              </div>
            </div>
            {/* Nuevos Filtros: Empleado y Tipo de Servicio */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Empleado
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                value={filterEmployee}
                onChange={(e) => setFilterEmployee(e.target.value)}
              >
                <option value="" className="text-slate-900 dark:text-white">
                  Todos
                </option>
                {employees.map((emp) => (
                  <option
                    key={emp.id}
                    value={emp.user_id}
                    className="text-slate-900 bg-white"
                  >
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">
                Tipo Servicio
              </label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                value={filterServiceType}
                onChange={(e) => setFilterServiceType(e.target.value)}
              >
                <option value="" className="text-slate-900 dark:text-white">
                  Todos
                </option>
                <option value="kg" className="text-slate-900 dark:text-white">
                  Por Kilo
                </option>
                <option value="unit" className="text-slate-900 dark:text-white">
                  Por Pieza
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      ) : viewMode === "kanban" ? (
        <div className="orders-kanban flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-280px)] items-start">
          <KanbanColumn status="received" title="Recibido" />
          <KanbanColumn status="processing" title="En Lavado" />
          <KanbanColumn status="ready" title="Listo P/ Entrega" />
          <KanbanColumn status="delivered" title="Entregado" />
        </div>
      ) : viewMode === "excel" ? (
        <div className="orders-excel-view">
          <div className="orders-excel-table-wrapper">
            <table className="orders-excel-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th>Servicio</th>
                  <th>Total</th>
                  <th>A Cuenta</th>
                  <th>Resta</th>
                  <th>Día Entrega</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-cell">
                      No hay órdenes que coincidan con los filtros.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const firstItem = order.order_items?.[0];
                    const serviceName = firstItem?.product_name || "-";
                    const paid = parseFloat(order.paid_amount || 0);
                    const total = parseFloat(order.total || 0);
                    const reste = total - paid;
                    const promisedDate = order.promised_at
                      ? new Date(order.promised_at).toLocaleDateString("es-MX")
                      : "-";

                    return (
                      <tr key={order.id}>
                        <td className="folio-cell">{order.folio}</td>
                        <td>{order.customers?.name || "-"}</td>
                        <td>{serviceName}</td>
                        <td className="amount-cell">{formatearDinero(total)}</td>
                        <td className="paid-cell">{formatearDinero(paid)}</td>
                        <td className={`balance-cell ${reste > 0 ? "text-red" : ""}`}>
                          {formatearDinero(reste)}
                        </td>
                        <td>{promisedDate}</td>
                        <td>
                          <span className={`status-badge status-${order.status}`}>
                            {statusLabels[order.status]?.label || order.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="orders-list flex flex-col gap-4">
          {filteredOrders.length === 0 ? (
            <div className="w-full py-20 text-center bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">
                inventory_2
              </span>
              <p className="text-slate-500">
                No hay ordenes que coincidan con los filtros
              </p>
              <button
                onClick={() => {
                  setFilter("all");
                  setSearchTerm("");
                  setDateRange({ start: "", end: "" });
                  setMinAmount("");
                  setMaxAmount("");
                  setPaymentMethod("");
                  setPaymentStatus("");
                }}
                className="mt-4 text-emerald-500 font-bold hover:underline"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col md:flex-row items-stretch"
              >
                {/* Left Section: Info & Customer */}
                <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 flex flex-col justify-between w-full md:w-1/4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusLabels[order.status]?.color}`}
                      >
                        {statusLabels[order.status]?.label}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-white uppercase tracking-tight">
                      #
                      {order.folio
                        ? order.folio.toString().padStart(6, "0")
                        : order.id.toString().slice(-6).toUpperCase()}{" "}
                      - {order.customers?.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">
                        calendar_today
                      </span>
                      Prometido:{" "}
                      <span
                        className={`font-bold ${new Date(order.promised_at) < new Date() && order.status !== "delivered" ? "text-red-500" : "text-slate-700 dark:text-slate-300"}`}
                      >
                        {new Date(order.promised_at).toLocaleDateString()}
                      </span>
                    </p>
                  </div>
                  <div className="mt-4">
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">
                        person
                      </span>
                      {getEmployeeName(order)}
                    </p>
                  </div>
                </div>

                {/* Middle Section: Items & Notes */}
                <div className="p-5 flex-1 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                  <div className="space-y-1">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex justify-between items-center text-sm"
                      >
                        <span className="text-slate-600 dark:text-slate-300 font-medium">
                          {item.product_name}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-white text-xs bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">
                          {item.quantity}{" "}
                          {item.pricing_type === "kg" ? "kg" : "pza"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="mt-3 bg-amber-50 dark:bg-slate-900/50 border border-amber-100 dark:border-slate-700 p-2 rounded-lg text-xs text-slate-600 dark:text-slate-400 italic flex gap-2 items-start">
                      <span className="material-symbols-outlined text-amber-500 dark:text-slate-500 text-sm">
                        sticky_note_2
                      </span>
                      <p>{order.notes}</p>
                    </div>
                  )}
                </div>

                {/* Right Section: Totals & Actions */}
                <div className="p-5 w-full md:w-1/3 flex flex-col justify-between bg-slate-50 dark:bg-slate-900/20">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium text-slate-500">
                      Total:{" "}
                      <span className="font-bold text-slate-800 dark:text-white text-lg">
                        {formatearDinero(order.total)}
                      </span>
                    </span>
                    {(() => {
                      const balance = order.total - (order.paid_amount || 0);
                      const isPaid =
                        order.payment_status === "paid" || balance <= 0;
                      return (
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${isPaid ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
                        >
                          {isPaid
                            ? "Pagado"
                            : `Debe ${formatearDinero(balance)}`}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Badge de estantería */}
                  {shelvingEnabled && (() => {
                    const assignment = getShelfForOrder(order.id);
                    return (
                      <div className="flex items-center justify-between mt-3 mb-2">
                        {assignment ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">
                              <span className="material-symbols-outlined text-[12px]">shelves</span>
                              {assignment.shelf?.label}
                            </span>
                            <button
                              onClick={() => handleUnassignShelf(order.id)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Quitar de estantería"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleOpenShelfModal(order)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-full text-xs font-bold transition-colors border border-dashed border-slate-300 dark:border-slate-600"
                          >
                            <span className="material-symbols-outlined text-[12px]">add_location</span>
                            Asignar estantería
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-2 flex-wrap items-end justify-end mt-auto">
                    {order.status === "received" && (
                      <button
                        onClick={() => handleStatusChange(order, "processing")}
                        className="flex-1 py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                      >
                        Empezar Lavado
                      </button>
                    )}
                    {order.status === "processing" && (
                      <button
                        onClick={() => handleStatusChange(order, "ready")}
                        className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                      >
                        Marcar Listo
                      </button>
                    )}
                    {order.status === "ready" && (
                      <button
                        onClick={() => handleStatusChange(order, "delivered")}
                        className="flex-1 py-2 px-3 bg-slate-800 dark:bg-slate-700 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                      >
                        Entregar
                      </button>
                    )}

                    {order.total - (order.paid_amount || 0) > 0 && (
                      <button
                        onClick={() => handleLiquidatePayment(order)}
                        className="p-2 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-lg transition-colors"
                        title="Liquidar saldo pendiente"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          payments
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => handleReprint(order)}
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-emerald-500 rounded-lg transition-colors"
                      title="Reimprimir Ticket"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        print
                      </span>
                    </button>
                    {businessSettings?.enable_remision_print && (
                      <button
                        onClick={() => handleReprintNota(order)}
                        className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Nota de Remisión"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          receipt_long
                        </span>
                      </button>
                    )}

                    {order.status !== "delivered" &&
                      order.status !== "cancelled" && (
                        <button
                          onClick={() => handleStatusChange(order, "cancelled")}
                          className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Cancelar Orden"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            cancel
                          </span>
                        </button>
                      )}

                    <button
                      onClick={() => handleOrderDelete(order.id)}
                      className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar permanentemente"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        delete
                      </span>
                    </button>

                    {order.status !== "delivered" && (
                      <button
                        onClick={() => handleUpdateMethod(order)}
                        className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                        title="Cambiar metodo de pago"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          currency_exchange
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL DE PAGO (Liquidacion) */}
      {isPaymentModalOpen && orderToLiquidate && (
        <div className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white uppercase tracking-tighter">
                Liquidar Saldo Pendiente
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
                <p className="text-black text-[10px] mb-1 uppercase tracking-widest font-bold">
                  Saldo a Cobrar
                </p>
                <h4 className="text-4xl font-black text-slate-900 dark:text-white">
                  {formatearDinero(
                    orderToLiquidate.total - orderToLiquidate.paid_amount,
                  )}
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setMetodoPago("cash");
                    setUsarUSD(false);
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === "cash" && !usarUSD ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "border-slate-100 dark:border-slate-800 text-slate-400"}`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    payments
                  </span>
                  <span className="text-[10px] font-bold uppercase">Efec.</span>
                </button>
                <button
                  onClick={() => {
                    setMetodoPago("card");
                    setUsarUSD(false);
                  }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${metodoPago === "card" ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "border-slate-100 dark:border-slate-800 text-slate-400"}`}
                >
                  <span className="material-symbols-outlined text-3xl">
                    credit_card
                  </span>
                  <span className="text-[10px] font-bold uppercase">Tarj.</span>
                </button>
                <button
                  onClick={() => {
                    setMetodoPago("transferencia");
                    setUsarUSD(false);
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

                {exchangeRate && (
                  <button
                    onClick={() => {
                      setMetodoPago("cash");
                      setUsarUSD(true);
                    }}
                    className={`col-span-3 flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all ${usarUSD ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-600" : "border-slate-100 dark:border-slate-800 text-slate-400"}`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      currency_exchange
                    </span>
                    <span className="text-[10px] font-bold uppercase text-center">
                      Pagar con Dolares (USD @ ${exchangeRate.rate})
                    </span>
                  </button>
                )}
              </div>

              {/* CALCULADORA DE CAMBIO */}
              {/* CALCULADORA DE CAMBIO */}
              {metodoPago === "cash" && (
                <div
                  className={`p-4 rounded-xl border ${usarUSD ? "bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20" : "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20"}`}
                >
                  <label
                    className={`text-xs font-bold uppercase tracking-wider mb-2 block ${usarUSD ? "text-blue-700 dark:text-blue-400" : "text-emerald-700 dark:text-emerald-400"}`}
                  >
                    {usarUSD
                      ? "Dolares Recibidos (USD)"
                      : "Dinero Recibido (MXN)"}
                  </label>

                  {usarUSD && (
                    <div className="mb-3 p-2 bg-blue-100/50 dark:bg-blue-500/20 rounded-lg border border-blue-200 dark:border-blue-500/30">
                      <p className="text-[11px] font-black text-blue-700 dark:text-blue-300 uppercase">
                        Cobrar al menos:{" "}
                        <span className="text-sm">
                          U${" "}
                          {(
                            (orderToLiquidate.total -
                              orderToLiquidate.paid_amount) /
                            exchangeRate.rate
                          ).toFixed(2)}
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 items-center">
                    <div className="relative flex-1">
                      <span
                        className={`absolute left-3 top-1/2 -translate-y-1/2 font-bold ${usarUSD ? "text-blue-600" : "text-emerald-600"}`}
                      >
                        {usarUSD ? "U$" : "$"}
                      </span>
                      <input
                        type="number"
                        className={`w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border rounded-xl outline-none focus:ring-2 text-xl font-bold text-slate-900 dark:text-white ${usarUSD ? "border-blue-200 focus:ring-blue-500" : "border-emerald-200 focus:ring-emerald-500"}`}
                        value={usarUSD ? montoRecibidoUSD : montoRecibido}
                        onChange={(e) =>
                          usarUSD
                            ? setMontoRecibidoUSD(e.target.value)
                            : setMontoRecibido(e.target.value)
                        }
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-xs mb-1 ${usarUSD ? "text-blue-600" : "text-emerald-600"}`}
                      >
                        Cambio (MXN)
                      </p>
                      <p
                        className={`text-2xl font-black ${usarUSD ? "text-blue-600" : "text-blue-400"}`}
                      >
                        {(() => {
                          const saldoPendiente =
                            orderToLiquidate.total -
                            orderToLiquidate.paid_amount;
                          const recibidoMXN = usarUSD
                            ? (parseFloat(montoRecibidoUSD) || 0) *
                              exchangeRate.rate
                            : parseFloat(montoRecibido) || 0;
                          return formatearDinero(
                            Math.max(0, recibidoMXN - saldoPendiente),
                          );
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-3 text-slate-500 font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={finalizeLiquidation}
                disabled={isProcessing}
                className="flex-[2] py-3 bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing && (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                )}
                LIQUIDAR PAGO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CAMBIO DE METODO DE PAGO */}
      {isMethodModalOpen && orderToUpdateMethod && (
        <div className="modal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg dark:text-white uppercase tracking-tighter">
                Cambiar Metodo
              </h3>
              <button
                onClick={() => setIsMethodModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-center mb-4">
                <p className="text-[10px] text-slate-500 uppercase font-bold">
                  Orden # {orderToUpdateMethod.folio || orderToUpdateMethod.id}
                </p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Selecciona el nuevo metodo de pago
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { id: "cash", label: "Efectivo", icon: "payments" },
                  { id: "card", label: "Tarjeta", icon: "credit_card" },
                  {
                    id: "transferencia",
                    label: "Transferencia",
                    icon: "account_balance",
                  },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setNewMethodSelection(m.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${newMethodSelection === m.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600" : "border-slate-100 dark:border-slate-800 text-slate-400"}`}
                  >
                    <span className="material-symbols-outlined text-2xl">
                      {m.icon}
                    </span>
                    <span className="text-sm font-bold uppercase">
                      {m.label}
                    </span>
                    {newMethodSelection === m.id && (
                      <span className="material-symbols-outlined ml-auto text-emerald-500">
                        check_circle
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-950 flex gap-3">
              <button
                onClick={() => setIsMethodModalOpen(false)}
                className="flex-1 py-3 text-slate-500 font-bold uppercase text-xs text-center"
              >
                Cancelar
              </button>
              <button
                onClick={finalizeMethodUpdate}
                disabled={isProcessing}
                className="flex-[2] py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-2"
              >
                {isProcessing && (
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                )}
                GUARDAR CAMBIO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REIMPRESION */}
      {orderToPrint && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl max-w-sm w-full shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
            <div id="printable-ticket" className="overflow-hidden">
              <TicketVenta
                venta={orderToPrint}
                settings={businessSettings}
                ref={ticketRef}
              />
            </div>
            <div className="mt-8 space-y-3">
              <button
                className={`flex-1 py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${isPrinting ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-black active:scale-95"}`}
                onClick={imprimirTicket}
                disabled={isPrinting}
              >
                <span className={`material-symbols-outlined ${isPrinting ? "animate-spin" : ""}`}>
                  {isPrinting ? "sync" : "print"}
                </span>
                {isPrinting ? "IMPRIMIENDO..." : "IMPRIMIR TICKET"}
              </button>
              <button
                onClick={() => setOrderToPrint(null)}
                className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTA DE REMISIÓN */}
      {showRemisionPreview && orderToPrint && (
        <RemisionPreviewModal
          venta={orderToPrint}
          settings={businessSettings}
          onClose={() => setShowRemisionPreview(false)}
        />
      )}

      {/* MODAL DE ASIGNACIÓN DE ESTANTERÍA */}
      {showShelfModal && selectedOrderForShelf && (
        <ShelfAssignmentModal
          isOpen={showShelfModal}
          onClose={() => { setShowShelfModal(false); setSelectedOrderForShelf(null); }}
          onAssign={(shelfId) => handleAssignShelf(shelfId)}
          orderId={selectedOrderForShelf.id}
        />
      )}
    </div>
  );
};


