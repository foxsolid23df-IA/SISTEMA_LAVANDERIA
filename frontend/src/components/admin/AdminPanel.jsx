import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { productService } from "../../services/productService";
import { salesService } from "../../services/salesService";
import { orderService } from "../../services/orderService";
import { customerService } from "../../services/customerService";
import { staffService } from "../../services/staffService";
import { cashCutService } from "../../services/cashCutService";
import { exportToExcel } from "../../utils/exportToExcel";
import Swal from "sweetalert2";
import "./AdminPanel.css";

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
    { id: "settings", label: "Configuración", icon: "settings" },
  ];

  return (
    <div className="admin-panel">
      {/* Sidebar */}
      <aside className="admin-sidebar">
        <div style={{ padding: '1rem' }}>
            <button 
                onClick={() => navigate('/configuracion')}
                style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', width: '100%', padding: '0.5rem 0' }}>
                <span className="material-icons-outlined">arrow_back</span>
                Atrás
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
          {activeSection === "cashcuts" && <CashCutsView />}
          {activeSection === "settings" && <SettingsView />}
        </div>
      </main>
    </div>
  );
};

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
      <div
        className="table-header"
        style={{ flexDirection: "column", alignItems: "stretch", gap: "1rem" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3>Historial de Cortes de Caja</h3>
          <span className="table-count">{cuts.length} cortes</span>
        </div>

        <div
          className="filters-row"
          style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}
        >
          <div
            className="search-group"
            style={{ flex: 1, minWidth: "200px", position: "relative" }}
          >
            <span
              className="material-icons-outlined"
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#64748b",
                fontSize: "18px",
              }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Buscar por empleado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ paddingLeft: "35px", width: "100%" }}
            />
          </div>

          <div
            className="date-group"
            style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          >
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange({ ...dateRange, start: e.target.value })
              }
              className="search-input"
              style={{ padding: "0.5rem" }}
            />
            <span style={{ color: "#64748b" }}>a</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange({ ...dateRange, end: e.target.value })
              }
              className="search-input"
              style={{ padding: "0.5rem" }}
            />
          </div>

          <select
            value={cutTypeFilter}
            onChange={(e) => setCutTypeFilter(e.target.value)}
            className="search-input"
            style={{ minWidth: "150px" }}
          >
            <option value="all">Todos los Tipos</option>
            <option value="turno">Turno</option>
            <option value="dia">Día</option>
            <option value="parcial">Parcial</option>
          </select>

          <button
            className="btn-icon"
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
            style={{ background: "#10b981", color: "#fff" }}
            disabled={cuts.length === 0}
          >
            <span className="material-icons-outlined">file_download</span>
          </button>

          <button
            className="btn-icon"
            onClick={() => {
              setSearchTerm("");
              setDateRange({ start: "", end: "" });
              setCutTypeFilter("all");
            }}
            title="Limpiar Filtros"
            style={{ background: "#f1f5f9", color: "#64748b" }}
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
          <ul style="text-align: left; background: #0f172a; padding: 1rem; border-radius: 8px; color: #fff;">
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
        <p>Tu nuevo código es: <strong style="font-size: 1.5rem; color: #10b981;">${newCode}</strong></p>
        <p style="font-size: 0.8rem; color: #ef4444; margin-top: 1rem;">
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
        <p className="text-slate-400 mb-4" style={{ fontSize: "0.85rem" }}>
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
          <div
            className="mt-4 p-3 bg-slate-800 rounded-lg flex justify-between items-center"
            style={{ border: "1px solid #1e293b" }}
          >
            <div>
              <span
                className="block text-slate-500"
                style={{ fontSize: "0.7rem", textTransform: "uppercase" }}
              >
                Código de Recuperación Activo:
              </span>
              <code
                className="text-emerald-400 font-bold"
                style={{ fontSize: "1.1rem" }}
              >
                {user.recovery_code}
              </code>
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
