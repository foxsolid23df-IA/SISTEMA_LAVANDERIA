import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import { productService } from "../../services/productService";
import { salesService } from "../../services/salesService";
import { orderService } from "../../services/orderService";
import { customerService } from "../../services/customerService";
import { staffService } from "../../services/staffService";
import { cashCutService } from "../../services/cashCutService";
import { exportToExcel } from "../../utils/exportToExcel";
import Swal from "sweetalert2";
import "./AdminPanel.css";

import { KardexView } from "./KardexView";
import packageInfo from "../../../package.json";
const APP_VERSION = packageInfo.version;


export const AdminPanel = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const [products, sales, orders, todayOrders, customers, staff, cuts] =
        await Promise.all([
          productService.getProducts(),
          salesService.getTodaySales(),
          orderService.getOrders(),
          orderService.getTodayOrders(),
          customerService.getCustomers(),
          staffService.getStaff(),
          cashCutService.getCashCuts(10),
        ]);

      const totalTodaySales = sales.length + todayOrders.length;
      const totalTodayRevenue =
        sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0) +
        todayOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);

      setStats({
        totalProducts: products.length,
        lowStockProducts: products.filter((p) => p.stock < 5).length,
        todaySales: totalTodaySales,
        todayRevenue: totalTodayRevenue,
        activeOrders: orders.filter((o) => o.status !== "delivered").length,
        totalCustomers: customers.length,
        activeStaff: staff.filter((s) => s.active).length,
        recentCuts: cuts.length,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="admin-access-denied">
        <span className="material-icons-outlined">lock</span>
        <h2>Acceso Denegado</h2>
        <p>Solo administradores pueden acceder a este panel</p>
      </div>
    );
  }

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "products", label: "Productos", icon: "inventory_2" },
    { id: "sales", label: "Ventas", icon: "point_of_sale" },
    { id: "orders", label: "Órdenes", icon: "local_laundry_service" },
    { id: "customers", label: "Clientes", icon: "people" },
    { id: "staff", label: "Personal", icon: "badge" },
    { id: "cashcuts", label: "Cortes de Caja", icon: "account_balance_wallet" },
    { id: "kardex", label: "Kardex / Inventario", icon: "inventory" },
    { id: "ai", label: "IA Chatbot", icon: "smart_toy" },
    { id: "workflow", label: "Workflow Express", icon: "speed" },
    { id: "notifications", label: "Notificaciones Listo", icon: "notifications_active" },
    { id: "settings", label: "Configuración", icon: "settings" },
  ];

  return (
    <div className="admin-panel">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div className="p-1">
            <button 
                onClick={() => navigate('/configuracion')}
                className="ap-back-btn"
            >
                <span className="material-icons-outlined">arrow_back</span>
                Volver a Configuración
            </button>
        </div>
        <div className="admin-brand">
          <span className="material-icons-outlined">admin_panel_settings</span>
          <h2>Admin Panel</h2>
        </div>
        <nav className="admin-nav">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className={`admin-nav-item ${activeSection === item.id ? "active" : ""}`}
              onClick={() => setActiveSection(item.id)}
            >
              <span className="material-icons-outlined">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="admin-content">
        <header className="admin-header">
          <h1>
            {menuItems.find((m) => m.id === activeSection)?.label ||
              "Dashboard"}
          </h1>
          <div className="admin-header-actions">
            <button className="btn-icon" onClick={loadDashboardStats}>
              <span className="material-icons-outlined">refresh</span>
            </button>
          </div>
        </header>

        <div className="admin-body">
          {activeSection === "dashboard" && (
            <DashboardView stats={stats} loading={loading} />
          )}
          {activeSection === "products" && <ProductsView />}
          {activeSection === "sales" && <SalesView />}
          {activeSection === "orders" && <OrdersView />}
          {activeSection === "customers" && <CustomersView />}
          {activeSection === "staff" && <StaffView />}
          { activeSection === "cashcuts" && <CashCutsView /> }
          { activeSection === "kardex" && <KardexView /> }
          { activeSection === "ai" && (
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">  IA Chatbot</h2>
              <p className="text-gray-600 mb-6">Administra la base de conocimiento de tu chatbot IA</p>
              <button
                onClick={() => navigate('/admin/ia-conocimiento')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <span className="material-icons-outlined">smart_toy</span>
                Abrir Base de Conocimiento IA
              </button>
            </div>
          )}
          { activeSection === "workflow" && <WorkflowExpressView /> }
          { activeSection === "notifications" && <ReadyNotificationsView /> }
          { activeSection === "settings" && <SettingsView /> }
        </div>
      </main>
    </div>
  );
};

export { KardexView } from "./KardexView";

const DashboardView = ({ stats, loading }) => {
  if (loading) return <div className="loading">Cargando estadísticas...</div>;

  const cards = [
    {
      label: "Total Productos",
      value: stats?.totalProducts || 0,
      icon: "inventory_2",
      color: "blue",
    },
    {
      label: "Bajo Stock",
      value: stats?.lowStockProducts || 0,
      icon: "warning",
      color: "orange",
    },
    {
      label: "Ventas Hoy",
      value: stats?.todaySales || 0,
      icon: "shopping_cart",
      color: "green",
    },
    {
      label: "Ingresos Hoy",
      value: `$${(stats?.todayRevenue || 0).toFixed(2)}`,
      icon: "attach_money",
      color: "emerald",
    },
    {
      label: "Órdenes Activas",
      value: stats?.activeOrders || 0,
      icon: "local_laundry_service",
      color: "purple",
    },
    {
      label: "Clientes",
      value: stats?.totalCustomers || 0,
      icon: "people",
      color: "cyan",
    },
    {
      label: "Personal Activo",
      value: stats?.activeStaff || 0,
      icon: "badge",
      color: "pink",
    },
    {
      label: "Cortes Recientes",
      value: stats?.recentCuts || 0,
      icon: "account_balance_wallet",
      color: "indigo",
    },
  ];

  return (
    <div className="dashboard-grid">
      {cards.map((card, index) => (
        <div key={index} className={`stat-card stat-${card.color}`}>
          <div className="stat-icon">
            <span className="material-icons-outlined">{card.icon}</span>
          </div>
          <div className="stat-info">
            <p className="stat-label">{card.label}</p>
            <h3 className="stat-value">{card.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
};

const ProductsView = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const data = await productService.getProducts();
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) return <div className="loading">Cargando productos...</div>;

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <input
          type="text"
          placeholder="Buscar por nombre o código de barras..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <span className="table-count">{filteredProducts.length} productos</span>
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Código de Barras</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Fecha Creación</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td className="font-bold">{product.name}</td>
                <td>
                  <code>{product.barcode || "N/A"}</code>
                </td>
                <td className="text-emerald-400">
                  ${parseFloat(product.price).toFixed(2)}
                </td>
                <td>
                  <span
                    className={`badge ${product.stock < 5 ? "badge-danger" : "badge-success"}`}
                  >
                    {product.stock} unidades
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${product.stock > 0 ? "badge-success" : "badge-danger"}`}
                  >
                    {product.stock > 0 ? "Disponible" : "Agotado"}
                  </span>
                </td>
                <td className="text-slate-400">
                  {new Date(product.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SalesView = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const data = await salesService.getSales(100);
      setSales(data);
    } catch (error) {
      console.error("Error loading sales:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando ventas...</div>;

  const totalRevenue = sales.reduce(
    (sum, s) => sum + parseFloat(s.total || 0),
    0,
  );

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h3>Últimas 100 Ventas</h3>
        <span className="table-count">Total: ${totalRevenue.toFixed(2)}</span>
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Total</th>
              <th>Método de Pago</th>
              <th>Items</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>
                  <code>#{sale.id}</code>
                </td>
                <td className="text-emerald-400 font-bold">
                  ${parseFloat(sale.total).toFixed(2)}
                </td>
                <td>
                  <span className="badge badge-info">
                    {sale.payment_method || "efectivo"}
                  </span>
                </td>
                <td>{sale.sale_items?.length || 0} productos</td>
                <td className="text-slate-400">
                  {new Date(sale.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const OrdersView = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const data = await orderService.getOrders();
      setOrders(data);
    } catch (error) {
      console.error("Error loading orders:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando órdenes...</div>;

  const statusLabels = {
    received: { label: "Recibido", color: "blue" },
    processing: { label: "En Proceso", color: "orange" },
    ready: { label: "Listo", color: "green" },
    delivered: { label: "Entregado", color: "gray" },
    cancelled: { label: "Cancelado", color: "red" },
  };

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h3>Órdenes de Lavandería</h3>
        <span className="table-count">{orders.length} órdenes</span>
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Estado</th>
              <th>Pago</th>
              <th>Fecha Promesa</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const status =
                statusLabels[order.status] || statusLabels.received;
              return (
                <tr key={order.id}>
                  <td>
                    <code>#{order.id}</code>
                  </td>
                  <td className="font-bold">
                    {order.customers?.name || "N/A"}
                  </td>
                  <td className="text-emerald-400">
                    ${parseFloat(order.total).toFixed(2)}
                  </td>
                  <td className="text-cyan-400">
                    ${parseFloat(order.paid_amount || 0).toFixed(2)}
                  </td>
                  <td>
                    <span className={`badge badge-${status.color}`}>
                      {status.label}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${order.payment_status === "paid" ? "badge-success" : "badge-warning"}`}
                    >
                      {order.payment_status === "paid" ? "Pagado" : "Pendiente"}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    {order.promised_at
                      ? new Date(order.promised_at).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="text-slate-400">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CustomersView = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) return <div className="loading">Cargando clientes...</div>;

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <span className="table-count">{filteredCustomers.length} clientes</span>
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Dirección</th>
              <th>Notas</th>
              <th>Fecha Registro</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr key={customer.id}>
                <td className="font-bold">{customer.name}</td>
                <td>
                  <code>{customer.phone || "N/A"}</code>
                </td>
                <td className="text-cyan-400">{customer.email || "N/A"}</td>
                <td
                  className="text-slate-400 truncate max-w-[250px]"
                  title={customer.address}
                >
                  {customer.address || "N/A"}
                </td>
                <td
                  className="text-slate-400 italic truncate max-w-[150px]"
                  title={customer.notes}
                >
                  {customer.notes || "-"}
                </td>
                <td className="text-slate-400">
                  {new Date(customer.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StaffView = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const data = await staffService.getStaff();
      setStaff(data);
    } catch (error) {
      console.error("Error loading staff:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Cargando personal...</div>;

  const roleLabels = {
    admin: { label: "Administrador", icon: "⭐", color: "purple" },
    gerente: { label: "Gerente", icon: "👔", color: "blue" },
    cajero: { label: "Cajero", icon: "🛒", color: "green" },
    operador: { label: "Operador", icon: "🌀", color: "orange" },
    repartidor: { label: "Repartidor", icon: "🛵", color: "pink" },
  };

  return (
    <div className="admin-table-container">
      <div className="table-header">
        <h3>Personal del Sistema</h3>
        <span className="table-count">{staff.length} empleados</span>
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>PIN</th>
              <th>Estado</th>
              <th>Fecha Creación</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((member) => {
              const role = roleLabels[member.role] || roleLabels.cajero;
              return (
                <tr key={member.id}>
                  <td className="font-bold">{member.name}</td>
                  <td>
                    <span className={`badge badge-${role.color}`}>
                      {role.icon} {role.label}
                    </span>
                  </td>
                  <td>
                    <code>****</code>
                  </td>
                  <td>
                    <span
                      className={`badge ${member.active ? "badge-success" : "badge-danger"}`}
                    >
                      {member.active ? "✓ Activo" : "✗ Inactivo"}
                    </span>
                  </td>
                  <td className="text-slate-400">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CashCutsView = () => {
  const [cuts, setCuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [cutTypeFilter, setCutTypeFilter] = useState("all");

  useEffect(() => {
    loadCuts();
  }, [searchTerm, dateRange, cutTypeFilter]);

  const loadCuts = async () => {
    try {
      setLoading(true);
      const data = await cashCutService.getCashCuts({
        limit: 100,
        staffName: searchTerm,
        startDate: dateRange.start,
        endDate: dateRange.end,
        cutType: cutTypeFilter,
      });
      setCuts(data);
    } catch (error) {
      console.error("Error loading cash cuts:", error);
    } finally {
      setLoading(false);
    }
  };

  const cutTypeLabels = {
    turno: { label: "Turno", color: "blue" },
    dia: { label: "Día", color: "purple" },
    parcial: { label: "Parcial", color: "orange" },
  };

  return (
    <div className="admin-table-container">
      <div className="table-header ap-filters-wrapper">
        <div className="ap-filters-header">
          <h3>Historial de Cortes de Caja</h3>
          <span className="table-count">{cuts.length} cortes</span>
        </div>

        <div className="ap-filters-row">
          <div className="ap-search-box">
            <span className="material-symbols-outlined ap-search-icon">
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input ap-search-input"
            />
          </div>

          <div className="ap-date-filters">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="search-input ap-date-input"
            />
            <span className="text-muted">a</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="search-input ap-date-input"
            />
          </div>

          <select
            value={cutTypeFilter}
            onChange={(e) => setCutTypeFilter(e.target.value)}
            className="search-input ap-select-type"
          >
            <option value="all">Todos los Tipos</option>
            <option value="turno">Turno</option>
            <option value="dia">Día</option>
            <option value="parcial">Parcial</option>
          </select>

          <button
            className="btn btn-primary ap-btn-accent"
            onClick={() => {
              const dataToExport = cuts.map((cut) => ({
                Empleado: cut.staff_name,
                Tipo: cut.cut_type,
                Ventas: cut.sales_count,
                "Total Ventas ($)": parseFloat(cut.sales_total).toFixed(2),
                "Efectivo Esperado ($)": parseFloat(cut.expected_cash).toFixed(
                  2,
                ),
                "Efectivo Real ($)": parseFloat(cut.actual_cash || 0).toFixed(
                  2,
                ),
                "Diferencia ($)": parseFloat(cut.difference || 0).toFixed(2),
                Fecha: new Date(cut.created_at).toLocaleString(),
              }));
              exportToExcel(
                dataToExport,
                `cortes_caja_${new Date().toISOString().split("T")[0]}`,
                "Cortes de Caja",
              );
            }}
            title="Exportar a Excel"
            disabled={cuts.length === 0}
          >
            <span className="material-icons-outlined">file_download</span>
          </button>

          <button
            className="btn btn-secondary ap-btn-muted"
            onClick={() => {
              setSearchTerm("");
              setDateRange({ start: "", end: "" });
              setCutTypeFilter("all");
            }}
            title="Limpiar Filtros"
          >
            <span className="material-icons-outlined">filter_alt_off</span>
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Tipo</th>
              <th>Ventas</th>
              <th>Total Ventas</th>
              <th>Efectivo Esperado</th>
              <th>Efectivo Real</th>
              <th>Diferencia</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-10">
                  Cargando cortes...
                </td>
              </tr>
            ) : cuts.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-10 text-slate-400">
                  No se encontraron cortes que coincidan con los filtros
                </td>
              </tr>
            ) : (
              cuts.map((cut) => {
                const cutType =
                  cutTypeLabels[cut.cut_type] || cutTypeLabels.turno;
                const difference = parseFloat(cut.difference || 0);
                return (
                  <tr key={cut.id}>
                    <td className="font-bold">{cut.staff_name}</td>
                    <td>
                      <span className={`badge badge-${cutType.color}`}>
                        {cutType.label}
                      </span>
                    </td>
                    <td>{cut.sales_count}</td>
                    <td className="text-emerald-400">
                      ${parseFloat(cut.sales_total).toFixed(2)}
                    </td>
                    <td className="text-cyan-400">
                      ${parseFloat(cut.expected_cash).toFixed(2)}
                    </td>
                    <td className="text-blue-400">
                      ${parseFloat(cut.actual_cash || 0).toFixed(2)}
                    </td>
                    <td
                      className={
                        difference === 0
                          ? "text-slate-400"
                          : difference > 0
                            ? "text-emerald-400"
                            : "text-red-400"
                      }
                    >
                      {difference > 0 ? "+" : ""}
                      {difference.toFixed(2)}
                    </td>
                    <td className="text-slate-400">
                      {new Date(cut.created_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SettingsView = () => {
  const { user, storeName, logout, updateProfile } = useAuth();
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      // 1. Sincronizar Inventario (Nube -> Local)
      const invResult = await productService.syncWithLocal();

      // 2. Subir Ventas Pendientes (Local -> Nube)
      const salesResult = await salesService.syncPendingSales();

      Swal.fire({
        title: "Sincronización Exitosa",
        html: `
          <ul style="text-align: left; background: var(--admin-sidebar-bg); padding: 1rem; border-radius: 8px; border: 1px solid var(--admin-card-border); color: #fff;">
            <li>Inventario: ${invResult.created} nuevos, ${invResult.updated} actualizados.</li>
            <li>Ventas subidas: ${salesResult.count} pendientes procesadas.</li>
          </ul>
        `,
        icon: "success",
        confirmButtonColor: "#10b981",
      });
    } catch (error) {
      console.error("[Admin] Error en sincronización:", error);
      Swal.fire({
        title: "Error",
        text: "Ocurrió un fallo durante la sincronización remota.",
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleExportBackup = () => {
    try {
      const data = {
        store: storeName || user?.store_name,
        exportDate: new Date().toISOString(),
        version: APP_VERSION,
        user: user?.email,
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup_lavanderia_${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.fire({
        title: "Backup Generado",
        text: "La configuración básica ha sido descargada.",
        icon: "success",
        confirmButtonColor: "#10b981",
      });
    } catch (error) {
      Swal.fire("Error", "No se pudo generar el backup", "error");
    }
  };

  const handleGenerateReport = async () => {
    Swal.fire({
      title: "Generando Reporte...",
      text: "Espere un momento por favor",
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      const products = await productService.getProducts();
      const sales = await salesService.getTodaySales();

      const info = `TIENDA: ${storeName}\nFECHA: ${new Date().toLocaleDateString()}\n\nPRODUCTOS: ${products.length}\nVENTAS HOY: ${sales.length}\nTOTAL HOY: $${sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0).toFixed(2)}`;

      const blob = new Blob([info], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `reporte_administracion_${new Date().getTime()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.close();
      Swal.fire({
        title: "Reporte Listo",
        text: "El reporte administrativo ha sido descargado.",
        icon: "success",
        confirmButtonColor: "#10b981",
      });
    } catch (error) {
      Swal.close();
      Swal.fire("Error", "No se pudo generar el reporte", "error");
    }
  };

  const handleUpdateMasterPin = async () => {
    const { value: pin } = await Swal.fire({
      title: "Configurar PIN Maestro",
      text: "El PIN debe tener exactamente 6 dígitos",
      input: "password",
      inputAttributes: {
        maxlength: 6,
        autocapitalize: "off",
        autocorrect: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Guardar PIN",
      confirmButtonColor: "#10b981",
      inputValidator: (value) => {
        if (!value || value.length !== 6 || !/^\d+$/.test(value)) {
          return "Debes ingresar 6 números";
        }
      },
    });

    if (!pin) return;

    try {
      await updateProfile({ master_pin: pin });
      Swal.fire("Éxito", "PIN Maestro actualizado correctamente", "success");
    } catch (error) {
      Swal.fire("Error", "No se pudo actualizar el PIN", "error");
    }
  };

  const handleGenerateRecoveryCode = async () => {
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { isConfirmed } = await Swal.fire({
      title: "Generar Código de Recuperación",
      html: `
        <p>Tu nuevo código es: <strong style="font-size: 1.5rem; color: var(--admin-accent);">${newCode}</strong></p>
        <p style="font-size: 0.8rem; color: var(--admin-danger); margin-top: 1rem;">
          ⚠️ Guarda este código en un lugar seguro. <br/> 
          Se usará para desvincular el equipo si olvidas el PIN o la contraseña.
        </p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, Guardar Código",
      confirmButtonColor: "#10b981",
    });

    if (isConfirmed) {
      try {
        await updateProfile({ recovery_code: newCode });
        Swal.fire("Guardado", "Código de recuperación actualizado", "success");
      } catch (error) {
        Swal.fire("Error", "No se pudo guardar el código", "error");
      }
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h3>Información del Sistema</h3>
        <div className="settings-grid">
          <div className="setting-item">
            <span className="setting-label">Nombre de la Tienda</span>
            <span className="setting-value">
              {storeName || user?.store_name || user?.user_metadata?.store_name || "N/A"}
            </span>
          </div>

          <div className="setting-item">
            <span className="setting-label">Usuario Actual</span>
            <span className="setting-value">
              {user?.full_name || user?.email || "N/A"}
            </span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Email</span>
            <span className="setting-value">{user?.email || "N/A"}</span>
          </div>
          <div className="setting-item">
            <span className="setting-label">Versión del Sistema</span>
            <span className="setting-value">{APP_VERSION}</span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3>Acciones del Sistema</h3>
        <div className="settings-actions">
          <button
            className="btn-setting btn-primary"
            onClick={handleManualSync}
            disabled={syncing}
          >
            <span
              className={`material-icons-outlined ${syncing ? "animate-spin" : ""}`}
            >
              sync
            </span>
            {syncing ? "Sincronizando..." : "Sincronizar con Nube"}
          </button>
          <button
            className="btn-setting btn-warning"
            onClick={handleExportBackup}
          >
            <span className="material-icons-outlined">backup</span>
            Exportar Config
          </button>
          <button
            className="btn-setting btn-info"
            onClick={handleGenerateReport}
          >
            <span className="material-icons-outlined">analytics</span>
            Reporte Ejecutivo
          </button>
        </div>
      </div>

      <div className="settings-card security-card">
        <h3>Seguridad de la Cuenta (NexusProLavanderia 2026)</h3>
        <p className="text-slate-400 mb-4 font-size-sm">
          Protege tu cuenta maestra configurando métodos de acceso local que no
          requieran tu contraseña principal.
        </p>
        <div className="settings-actions">
          <button
            className="btn-setting btn-emerald"
            onClick={handleUpdateMasterPin}
          >
            <span className="material-icons-outlined">vpn_key</span>
            {user?.master_pin
              ? "Cambiar PIN Maestro"
              : "Configurar PIN Maestro"}
          </button>
          <button
            className="btn-setting btn-slate"
            onClick={handleGenerateRecoveryCode}
          >
            <span className="material-icons-outlined">lock_reset</span>
            Generar Código de Recuperación
          </button>
        </div>
        {user?.recovery_code && (
          <div className="p-4 rounded-xl ap-recovery-card flex items-center justify-between">
            <div>
              <div className="text-slate-400 ap-recovery-label mb-1">
                Código de Recuperación Activo:
              </div>
              <div className="text-xl font-mono font-bold tracking-wider text-emerald-400 ap-recovery-code">
                {user.recovery_code}
              </div>
            </div>
            <span
              className="material-icons-outlined text-slate-600"
              title="Usa este código para desvincular equipos"
            >
              help_outline
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const WorkflowExpressView = () => {
  const { settings, updateSettings } = useSettings();

  const handleToggleExpress = async () => {
    const newValue = !settings?.express_workflow_enabled;
    try {
      await updateSettings({ express_workflow_enabled: newValue });
      Swal.fire({
        title: newValue ? "Workflow Express Activado" : "Workflow Express Desactivado",
        text: newValue
          ? "Gastos y Vista Excel de Órdenes habilitados."
          : "Gastos y Vista Excel de Órdenes deshabilitados.",
        icon: newValue ? "success" : "info",
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: "top-end"
      });
    } catch (err) {
      Swal.fire("Error", "No se pudo guardar la configuración", "error");
    }
  };

  const handleToggleCatalog = async () => {
    const newValue = !settings?.service_catalog_enabled;
    try {
      await updateSettings({ service_catalog_enabled: newValue });
      Swal.fire({
        title: newValue ? "Catálogo Express Activado" : "Catálogo Express Desactivado",
        text: newValue
          ? "Catálogo simplificado de servicios habilitado."
          : "Catálogo simplificado de servicios deshabilitado.",
        icon: newValue ? "success" : "info",
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: "top-end"
      });
    } catch (err) {
      Swal.fire("Error", "No se pudo guardar la configuración", "error");
    }
  };

  const handleToggleProduction = async () => {
    const newValue = !settings?.employee_production_enabled;
    try {
      await updateSettings({ employee_production_enabled: newValue });
      Swal.fire({
        title: newValue ? "Rendimiento de Staff Activado" : "Rendimiento de Staff Desactivado",
        text: newValue
          ? "Asignación de empleados por servicio y reporte de ganancia neta habilitados."
          : "Asignación de empleados por servicio y reporte de ganancia neta deshabilitados.",
        icon: newValue ? "success" : "info",
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: "top-end"
      });
    } catch (err) {
      Swal.fire("Error", "No se pudo guardar la configuración", "error");
    }
  };

  const handleToggleProduccionDiaria = async () => {
    const newValue = !settings?.daily_production_enabled;
    try {
      await updateSettings({ daily_production_enabled: newValue });
      Swal.fire({
        title: newValue ? "Producción Diaria Activada" : "Producción Diaria Desactivada",
        text: newValue
          ? "Planilla diaria de producción por empleado disponible en el menú."
          : "Planilla diaria de producción por empleado deshabilitada.",
        icon: newValue ? "success" : "info",
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: "top-end"
      });
    } catch (err) {
      Swal.fire("Error", "No se pudo guardar la configuración", "error");
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h3>Workflow Express</h3>
        <p className="text-slate-400 mb-4 font-size-sm">
          Activa funciones estilo Excel: Gastos, Vista Excel de Órdenes y Catálogo Simplificado.
        </p>

        <div className="settings-grid">
          <div className="setting-item">
            <span className="setting-label">
              <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>receipt_long</span>
              Modo Express (Gastos + Vista Excel)
            </span>
            <span className="setting-value">
              <button
                className={`toggle-btn ${settings?.express_workflow_enabled ? 'active' : ''}`}
                onClick={handleToggleExpress}
              >
                <div className="toggle-knob" />
              </button>
            </span>
          </div>

          <div className="setting-item">
            <span className="setting-label">
              <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>inventory_2</span>
              Catálogo de Servicios Simplificado
            </span>
            <span className="setting-value">
              <button
                className={`toggle-btn ${settings?.service_catalog_enabled ? 'active' : ''}`}
                onClick={handleToggleCatalog}
              >
                <div className="toggle-knob" />
              </button>
            </span>
          </div>
          <div className="setting-item">
            <span className="setting-label">
              <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>groups</span>
              Rendimiento de Staff
            </span>
            <span className="setting-value">
              <button
                className={`toggle-btn ${settings?.employee_production_enabled ? 'active' : ''}`}
                onClick={handleToggleProduction}
              >
                <div className="toggle-knob" />
              </button>
            </span>
          </div>
          <div className="setting-item">
            <span className="setting-label">
              <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>assignment</span>
              Producción Diaria (Planilla)
            </span>
            <span className="setting-value">
              <button
                className={`toggle-btn ${settings?.daily_production_enabled ? 'active' : ''}`}
                onClick={handleToggleProduccionDiaria}
              >
                <div className="toggle-knob" />
              </button>
            </span>
          </div>
        </div>

        {settings?.employee_production_enabled && (
          <div className="p-4 mt-4 rounded-xl" style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <span className="material-icons-outlined" style={{ color: '#a855f7', verticalAlign: 'middle', marginRight: 8 }}>check_circle</span>
            <span style={{ color: '#a855f7', fontWeight: 500 }}>Rendimiento de Staff activo</span>
            <p className="text-slate-400 mt-2" style={{ fontSize: '0.8rem' }}>
              Asignación de empleados por servicio y reporte de ganancia neta están disponibles.
            </p>
          </div>
        )}

        {settings?.express_workflow_enabled && (
          <div className="p-4 mt-4 rounded-xl" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span className="material-icons-outlined" style={{ color: '#10b981', verticalAlign: 'middle', marginRight: 8 }}>check_circle</span>
            <span style={{ color: '#10b981', fontWeight: 500 }}>Modo Express activo</span>
            <p className="text-slate-400 mt-2" style={{ fontSize: '0.8rem' }}>
              Los módulos de Gastos y Vista Excel de Órdenes están disponibles en el menú lateral.
            </p>
          </div>
        )}

        {settings?.service_catalog_enabled && (
          <div className="p-4 mt-4 rounded-xl" style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <span className="material-icons-outlined" style={{ color: '#3b82f6', verticalAlign: 'middle', marginRight: 8 }}>check_circle</span>
            <span style={{ color: '#3b82f6', fontWeight: 500 }}>Catálogo Express activo</span>
            <p className="text-slate-400 mt-2" style={{ fontSize: '0.8rem' }}>
              El catálogo simplificado de servicios está disponible en el menú lateral.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const ReadyNotificationsView = () => {
  const { settings, updateSettings } = useSettings();
  const [templates, setTemplates] = useState({
    t1: settings?.ready_msg_template_1 || '',
    t2: settings?.ready_msg_template_2 || '',
    t3: settings?.ready_msg_template_3 || '',
  });
  const [saving, setSaving] = useState(false);
  const [previews, setPreviews] = useState({ t1: false, t2: false, t3: false });

  useEffect(() => {
    setTemplates({
      t1: settings?.ready_msg_template_1 || '',
      t2: settings?.ready_msg_template_2 || '',
      t3: settings?.ready_msg_template_3 || '',
    });
  }, [settings?.ready_msg_template_1, settings?.ready_msg_template_2, settings?.ready_msg_template_3]);

  const handleToggle = async () => {
    const newValue = !settings?.ready_notifications_enabled;
    try {
      await updateSettings({ ready_notifications_enabled: newValue });
      Swal.fire({
        title: newValue ? 'Notificaciones Activadas' : 'Notificaciones Desactivadas',
        text: newValue
          ? 'Se enviara WhatsApp automaticamente al marcar ordenes como Listas.'
          : 'No se enviaran notificaciones WhatsApp de ordenes listas.',
        icon: newValue ? 'success' : 'info',
        timer: 3000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (err) {
      Swal.fire('Error', 'No se pudo guardar la configuracion', 'error');
    }
  };

  const handleSaveTemplates = async () => {
    setSaving(true);
    try {
      await updateSettings({
        ready_msg_template_1: templates.t1,
        ready_msg_template_2: templates.t2,
        ready_msg_template_3: templates.t3,
      });
      Swal.fire({
        title: 'Plantillas Guardadas',
        text: 'Las plantillas de mensajes se actualizaron correctamente.',
        icon: 'success',
        timer: 2500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end',
      });
    } catch (err) {
      Swal.fire('Error', 'No se pudieron guardar las plantillas', 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePreview = (key) => {
    setPreviews((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resolvePreview = (template) => {
    if (!template || !template.trim()) {
      return null;
    }
    const parts = template.split(/(\{customer_name\}|\{store_name\}|\{order_folio\})/g);
    const map = {
      '{customer_name}': 'Maria Garcia',
      '{store_name}': 'Lavanderia Centro',
      '{order_folio}': '#A-1234',
    };
    return parts.map((part, i) => {
      if (map[part]) {
        return (
          <span key={i} className="rn-var-highlight">
            {map[part]}
          </span>
        );
      }
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
  };

  const MESSAGE_DEFS = [
    {
      key: 't1',
      variant: 'immediate',
      icon: 'check_circle',
      title: 'Mensaje 1 — Inmediato (ropa lista)',
      subtitle: 'Se envia al momento de marcar la orden como Lista.',
      placeholder:
        'Hola {customer_name}! Tu ropa ya esta lista para recoger en {store_name}. Folio: {order_folio}',
    },
    {
      key: 't2',
      variant: 'reminder',
      icon: 'schedule',
      title: 'Mensaje 2 — Recordatorio (24 h)',
      subtitle: 'Se envia si la orden sigue sin recogerse despues de 24 horas.',
      placeholder:
        'Recordatorio: tu ropa sigue lista en {store_name}. Folio: {order_folio}',
    },
    {
      key: 't3',
      variant: 'final',
      icon: 'warning',
      title: 'Mensaje 3 — Aviso Final (48 h / Dia 2)',
      subtitle:
        'Se envia si la orden lleva 48 h sin recogerse (24 h despues del segundo mensaje).',
      placeholder:
        'Tu pedido lleva 2 dias listo en {store_name}. Folio: {order_folio}. Por favor recoge pronto.',
    },
  ];

  const isActive = settings?.ready_notifications_enabled;
  const MAX_CHARS = 500;

  return (
    <div className="settings-container">
      <div className="settings-card">
        <h3>Notificaciones WhatsApp — Ordenes Listas</h3>
        <p className="text-slate-400 mb-4 font-size-sm">
          Envia automaticamente un mensaje WhatsApp al cliente cuando su orden se
          marca como Lista para entregar, con recordatorios a las 24 h y 48 h si
          no se recoge.
        </p>

        {/* ── Toggle row ── */}
        <div className="rn-toggle-row">
          <span className="rn-toggle-label">
            <span className="material-icons-outlined">notifications_active</span>
            Notificaciones de Ordenes Listas
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className={`rn-toggle-status ${isActive ? 'rn-toggle-status--on' : 'rn-toggle-status--off'}`}
            >
              {isActive && <span className="rn-pulse-dot" />}
              {isActive ? 'Activado' : 'Desactivado'}
            </span>
            <button
              className={`toggle-btn ${isActive ? 'active' : ''}`}
              onClick={handleToggle}
              role="switch"
              aria-checked={isActive}
              aria-label="Activar notificaciones de ordenes listas"
            >
              <div className="toggle-knob" />
            </button>
          </div>
        </div>

        {/* ── Status banner ── */}
        <div
          className={`rn-status-banner ${isActive ? 'rn-status-banner--active' : 'rn-status-banner--inactive'}`}
        >
          <span
            className={`material-icons-outlined rn-status-icon ${isActive ? 'rn-status-icon--active' : 'rn-status-icon--inactive'}`}
          >
            {isActive ? 'check_circle' : 'notifications_off'}
          </span>
          <div className="rn-status-text">
            <div className="rn-status-title">
              {isActive ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
            </div>
            <div className="rn-status-desc">
              {isActive
                ? 'Los clientes recibiran WhatsApp al estar lista su ropa + recordatorios automaticos.'
                : 'Activa el interruptor para empezar a enviar notificaciones WhatsApp automaticas.'}
            </div>
          </div>
        </div>

        {/* ── Message cards ── */}
        {isActive && (
          <>
            <div className="rn-timeline">
              {MESSAGE_DEFS.map((def) => (
                <div
                  key={def.key}
                  className={`rn-message-card rn-message-card--${def.variant}`}
                >
                  <div className="rn-message-card__accent" />
                  <div className="rn-message-card__header">
                    <div className="rn-message-card__icon">
                      <span className="material-icons-outlined">{def.icon}</span>
                    </div>
                    <div>
                      <div className="rn-message-card__title">{def.title}</div>
                      <div className="rn-message-card__subtitle">
                        {def.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="rn-message-card__body">
                    <label
                      htmlFor={`rn-template-${def.key}`}
                      className="ui-label"
                      style={{ marginBottom: 6 }}
                    >
                      Plantilla del mensaje
                    </label>
                    <textarea
                      id={`rn-template-${def.key}`}
                      className="rn-textarea"
                      value={templates[def.key]}
                      onChange={(e) =>
                        setTemplates((prev) => ({
                          ...prev,
                          [def.key]: e.target.value,
                        }))
                      }
                      rows={3}
                      maxLength={MAX_CHARS}
                      placeholder={def.placeholder}
                    />
                    <div className="rn-char-counter">
                      {templates[def.key].length}/{MAX_CHARS}
                    </div>

                    <button
                      type="button"
                      className="rn-preview-toggle"
                      onClick={() => togglePreview(def.key)}
                      aria-expanded={previews[def.key]}
                    >
                      <span className="material-icons-outlined">
                        {previews[def.key] ? 'visibility_off' : 'visibility'}
                      </span>
                      {previews[def.key]
                        ? 'Ocultar vista previa'
                        : 'Ver vista previa'}
                    </button>

                    {previews[def.key] && (
                      <div className="rn-preview-content">
                        {resolvePreview(templates[def.key]) || (
                          <span
                            style={{
                              color: 'var(--admin-text-muted)',
                              fontStyle: 'italic',
                            }}
                          >
                            La plantilla esta vacia. Escribe un mensaje para
                            previsualizarlo.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Variables hint ── */}
            <div className="rn-variables-hint">
              <strong>Variables disponibles:</strong>{' '}
              <code className="rn-var-code">{'{customer_name}'}</code>,{' '}
              <code className="rn-var-code">{'{store_name}'}</code>,{' '}
              <code className="rn-var-code">{'{order_folio}'}</code>
            </div>

            {/* ── Save ── */}
            <div className="rn-save-bar">
              <button
                className="ui-btn ui-btn--primary ui-btn--lg"
                onClick={handleSaveTemplates}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="material-icons-outlined ui-btn-spinner">
                      sync
                    </span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <span className="material-icons-outlined ui-btn-icon">
                      save
                    </span>
                    Guardar Plantillas
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
