import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { staffService } from "../../services/staffService";
import Swal from "sweetalert2";
import { UiButton, UiCard, UiBadge, UiPageHeader } from "../common/ui";
import "../common/ui/ui-kit.css";
import "./UserManager.css";

const ROLES = {
  admin: {
    id: "admin",
    icon: "⭐",
    label: "Administrador",
    class: "role-admin",
    desc: "Acceso total a todas las funciones y configuraciones.",
    permissions: {
      can_access_sales: true,
      can_manage_orders: true,
      can_delete_orders: true,
      can_access_services: true,
      can_access_products: true,
      can_manage_supplies: true,
      can_see_reports: true,
      can_view_cash_reports: true,
      can_view_cancellations: true,
      can_view_dashboard: true,
      can_manage_inventory: true,
      can_view_supplies: true,
      can_manage_staff: true,
      can_manage_clients: true,
      can_view_audit: true,
      can_access_settings: true,
      can_use_ia_vision: true,
      can_manage_cash: true,
      can_lock_terminal: true,
      can_restart_cash: true,
      can_logout: true,
      can_process_orders: true,
      can_deliver_orders: true,
      can_void_sales: true,
      can_access_produccion_diaria: true,
    },
  },
  gerente: {
    id: "gerente",
    icon: "👔",
    label: "Gerente",
    class: "role-gerente",
    desc: "Gestión operativa, reportes y supervisión.",
    permissions: {
      can_access_sales: true,
      can_manage_orders: true,
      can_delete_orders: false,
      can_access_services: true,
      can_access_products: true,
      can_manage_supplies: true,
      can_see_reports: true,
      can_view_cash_reports: true,
      can_view_cancellations: true,
      can_view_dashboard: true,
      can_manage_inventory: true,
      can_view_supplies: true,
      can_manage_staff: false,
      can_manage_clients: true,
      can_view_audit: true,
      can_access_settings: false,
      can_use_ia_vision: true,
      can_manage_cash: true,
      can_lock_terminal: true,
      can_restart_cash: false,
      can_logout: true,
      can_process_orders: true,
      can_deliver_orders: true,
      can_void_sales: false,
      can_access_produccion_diaria: true,
    },
  },
  cajero: {
    id: "cajero",
    icon: "🛒",
    label: "Cajero",
    class: "role-cajero",
    desc: "Ventas, cobros y atención al cliente.",
    permissions: {
      can_access_sales: true,
      can_manage_orders: true,
      can_delete_orders: false,
      can_access_services: false,
      can_access_products: false,
      can_manage_supplies: false,
      can_see_reports: false,
      can_view_dashboard: false,
      can_manage_inventory: false,
      can_manage_staff: false,
      can_manage_clients: true,
      can_view_audit: false,
      can_access_settings: false,
      can_use_ia_vision: true,
      can_manage_cash: true,
      can_lock_terminal: true,
      can_restart_cash: false,
      can_logout: true,
      can_deliver_orders: true,
      can_void_sales: false,
      can_view_supplies: true,
      can_view_cancellations: true,
      can_access_produccion_diaria: false,
    },
  },
  operador: {
    id: "operador",
    icon: "🌀",
    label: "Operador",
    class: "role-operador",
    desc: "Procesamiento de prendas (Lavado/Secado).",
    permissions: {
      can_access_sales: false,
      can_manage_orders: true,
      can_delete_orders: false,
      can_access_services: false,
      can_access_products: false,
      can_manage_supplies: false,
      can_see_reports: false,
      can_view_dashboard: false,
      can_manage_inventory: false,
      can_view_supplies: false,
      can_manage_staff: false,
      can_manage_clients: false,
      can_view_audit: false,
      can_access_settings: false,
      can_use_ia_vision: false,
      can_manage_cash: false,
      can_lock_terminal: true,
      can_restart_cash: false,
      can_logout: true,
      can_process_orders: true,
      can_deliver_orders: false,
      can_void_sales: false,
      can_view_cancellations: false,
      can_access_produccion_diaria: false,
    },
  },
  repartidor: {
    id: "repartidor",
    icon: "🛵",
    label: "Repartidor",
    class: "role-repartidor",
    desc: "Entrega de pedidos a domicilio.",
    permissions: {
      can_access_sales: false,
      can_manage_orders: true,
      can_delete_orders: false,
      can_access_services: false,
      can_access_products: false,
      can_manage_supplies: false,
      can_see_reports: false,
      can_view_dashboard: false,
      can_manage_inventory: false,
      can_view_supplies: false,
      can_manage_staff: false,
      can_manage_clients: false,
      can_view_audit: false,
      can_access_settings: false,
      can_use_ia_vision: false,
      can_manage_cash: false,
      can_lock_terminal: true,
      can_restart_cash: false,
      can_logout: true,
      can_process_orders: false,
      can_deliver_orders: true,
      can_void_sales: false,
      can_view_cancellations: false,
      can_access_produccion_diaria: false,
    },
  },
};

const DELIVERY_DRIVER_ROLES = ["repartidor", "chofer"];

const isDeliveryDriverRole = (role) =>
  DELIVERY_DRIVER_ROLES.includes(role?.toLowerCase());

const PERMISSION_LABELS = {
  can_access_sales: {
    label: "Ventas",
    desc: "Acceso a caja y realizar ventas",
  },
  can_manage_orders: {
    label: "Gestión de Órdenes",
    desc: "Ver y gestionar el listado de pedidos",
  },
  can_access_services: {
    label: "Catálogo de Servicios",
    desc: "Administrar servicios y precios",
  },
  can_access_products: {
    label: "Catálogo de Productos",
    desc: "Administrar productos y precios",
  },
  can_manage_supplies: {
    label: "Administrar Insumos Internos",
    desc: "Control total: stock, catálogo e historial",
  },
  can_view_supplies: {
    label: "Insumos: Libreta Digital",
    desc: "Solo registrar uso de detergentes y ver existencias",
  },
  can_manage_clients: {
    label: "Clientes",
    desc: "Gestionar base de datos de clientes",
  },
  can_view_audit: {
    label: "Auditoría",
    desc: "Acceso al historial de movimientos",
  },
  can_see_reports: {
    label: "Reportes",
    desc: "Acceso a reportes generales del sistema",
  },
  can_view_cash_reports: {
    label: "Reportes de Caja",
    desc: "Ver reportes y cortes de caja",
  },
  can_view_cancellations: {
    label: "Reporte de Cancelaciones",
    desc: "Ver reporte de órdenes canceladas",
  },
  can_view_dashboard: {
    label: "Dashboard",
    desc: "Ver estadísticas dinámicas",
  },
  can_access_settings: {
    label: "Configuración",
    desc: "Acceso ajustes generales del sistema",
  },
  can_use_ia_vision: {
    label: "IA Vision",
    desc: "Uso de reconocimiento de prendas por IA",
  },
  can_manage_cash: {
    label: "Caja",
    desc: "Aperturas, retiros y cortes de caja",
  },
  can_lock_terminal: {
    label: "Bloquear",
    desc: "Posibilidad de bloquear la pantalla",
  },
  can_restart_cash: {
    label: "Reiniciar Caja/Terminal",
    desc: "Borrar ajustes locales de conexión (Soporte)",
  },
  can_logout: {
    label: "Cerrar Sesión (Desvincular)",
    desc: "Desvincular cuenta de la terminal/dispositivo",
  },
  can_delete_orders: {
    label: "Eliminar Órdenes",
    desc: "Permite borrar registros de órdenes",
  },
  can_void_sales: {
    label: "Anular Ventas",
    desc: "Cancelar ventas ya cobradas",
  },
  can_manage_staff: {
    label: "Persona & Seguridad",
    desc: "Crear o editar usuarios",
  },
  can_access_produccion_diaria: {
    label: "Produccion Diaria",
    desc: "Acceso a la planilla diaria de produccion por empleado",
  },
};

export const UserManager = () => {
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    role: "cajero",
    pin: "",
    phone: "",
    permissions: ROLES.cajero.permissions,
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await staffService.getStaff();
      setStaff(data);
    } catch (error) {
      console.error("Error al cargar empleados:", error);
      Swal.fire("Error", "No se pudieron cargar los empleados", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      role: "cajero",
      pin: "",
      phone: "",
      permissions: ROLES.cajero.permissions,
    });
    setEditingStaff(null);
  };

  const handleOpenModal = (staffMember = null) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        name: staffMember.name,
        role: staffMember.role,
        pin: staffMember.pin,
        phone: staffMember.phone || "",
        permissions: {
          ...(ROLES[staffMember.role]?.permissions || ROLES.cajero.permissions),
          ...staffMember.permissions,
        },
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleRoleSelect = (roleId) => {
    setFormData({
      ...formData,
      role: roleId,
      permissions: ROLES[roleId].permissions,
    });
  };

  const handlePermissionToggle = (permKey) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [permKey]: !formData.permissions[permKey],
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.pin) {
      Swal.fire("Error", "Nombre y PIN son obligatorios", "warning");
      return;
    }

    if (formData.pin.length < 4 || formData.pin.length > 6) {
      Swal.fire("Error", "El PIN debe tener entre 4 y 6 dígitos", "warning");
      return;
    }

    if (isDeliveryDriverRole(formData.role) && !formData.phone?.trim()) {
      Swal.fire("Error", "El telefono es obligatorio para repartidores.", "warning");
      return;
    }

    try {
      // Validar PIN duplicado
      const isDuplicate = await staffService.checkPinDuplicate(
        formData.pin,
        editingStaff?.id,
      );

      if (isDuplicate) {
        Swal.fire({
          title: "PIN Duplicado",
          text: "Este PIN ya está siendo usado por otro empleado. Por razones de seguridad, cada empleado debe tener un PIN único.",
          icon: "error",
        });
        return;
      }

      if (editingStaff) {
        await staffService.updateStaff(editingStaff.id, formData);
        Swal.fire(
          "Actualizado",
          "Empleado actualizado correctamente",
          "success",
        );
      } else {
        await staffService.createStaff(formData);
        Swal.fire("Creado", "Empleado creado correctamente", "success");
      }
      handleCloseModal();
      loadStaff();
    } catch (error) {
      console.error("Error al guardar:", error);

      if (error.code === "23505" || error.message?.includes("duplicate key")) {
        Swal.fire({
          title: "¡PIN ya en uso!",
          html: `El PIN <strong>${formData.pin}</strong> ya está registrado para otro empleado.<br><br>Por favor, asigna un código diferente para mantener la seguridad.`,
          icon: "warning",
          confirmButtonColor: "#3085d6",
        });
      } else {
        Swal.fire({
          title: "Error de Guardado",
          text:
            "No pudimos registrar los cambios: " +
            (error.message || "Error de conexión"),
          icon: "error",
        });
      }
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: "¿Eliminar empleado?",
      text: `Se eliminará a "${name}" del sistema`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await staffService.deleteStaff(id);
        Swal.fire("Eliminado", "Empleado eliminado", "success");
        loadStaff();
      } catch (error) {
        console.error("Error al eliminar:", error);
        Swal.fire("Error", "No se pudo eliminar el empleado", "error");
      }
    }
  };

  const toggleActive = async (staffMember) => {
    try {
      await staffService.updateStaff(staffMember.id, {
        ...staffMember,
        active: !staffMember.active,
      });
      loadStaff();
    } catch (error) {
      console.error("Error al cambiar estado:", error);
    }
  };

  const getRoleBadge = (role) => {
    return ROLES[role] || ROLES.cajero;
  };

  if (loading)
    return <div className="loading-state">Cargando empleados...</div>;

  return (
    <div className="user-manager-container">
      <UiPageHeader
        title="Gestión de Usuarios"
        description="Administra roles y permisos para el acceso al punto de venta"
        backTo="/configuracion"
        backLabel="Volver a Configuración"
        actions={
          <UiButton
            variant="primary"
            icon="person_add"
            onClick={() => handleOpenModal()}
          >
            Nuevo Empleado
          </UiButton>
        }
      />

      <UiCard>
        <UiCard.Body flush>
        {staff.length === 0 ? (
          <div className="empty-state">
            <p>No hay empleados registrados</p>
            <small>Haz clic en "Nuevo Empleado" para agregar uno</small>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Telefono</th>
                <th>PIN</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const roleInfo = getRoleBadge(s.role);
                return (
                  <tr key={s.id}>
                    <td className="font-bold-700">{s.name}</td>
                    <td>
                      <UiBadge variant={roleInfo.id} icon={roleInfo.icon}>
                        {roleInfo.label}
                      </UiBadge>
                    </td>
                    <td>{s.phone || "-"}</td>
                    <td>
                      <code className="um-code-pin">****</code>
                    </td>
                    <td>
                      <UiBadge
                        variant={s.active ? 'success' : 'danger'}
                        onClick={() => toggleActive(s)}
                        className="cursor-pointer"
                      >
                        {s.active ? '✓ Activo' : '✗ Inactivo'}
                      </UiBadge>
                    </td>
                    <td className="actions-cell">
                      <UiButton
                        variant="outline"
                        size="sm"
                        icon="edit"
                        onClick={() => handleOpenModal(s)}
                      >
                        Editar
                      </UiButton>
                      <UiButton
                        variant="danger"
                        size="sm"
                        icon="delete"
                        onClick={() => handleDelete(s.id, s.name)}
                      >
                        Eliminar
                      </UiButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </UiCard.Body>
      </UiCard>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingStaff ? "Editar Empleado" : "Nuevo Empleado"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group mb-1-5">
                <label className="ui-label">Nombre completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Juan Pérez"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="ui-input"
                />
              </div>

              <div className="form-group mb-1-5">
                <label className="ui-label">
                  Telefono {isDeliveryDriverRole(formData.role) ? "*" : ""}
                </label>
                <input
                  type="tel"
                  placeholder="Ej: 5512345678"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target.value.replace(/[^\d+]/g, ""),
                    })
                  }
                  className="ui-input"
                />
              </div>

              <label className="ui-label d-block mb-1">
                Seleccionar Rol del Sistema
              </label>
              <div className="role-cards-grid">
                {Object.values(ROLES).map((role) => (
                  <div
                    key={role.id}
                    className={`role-card ${formData.role === role.id ? "selected" : ""}`}
                    onClick={() => handleRoleSelect(role.id)}
                  >
                    <span className="role-icon">{role.icon}</span>
                    <span className="role-name">{role.label}</span>
                    <span className="role-desc">{role.desc}</span>
                  </div>
                ))}
              </div>

              <div className="form-group mb-1-5">
                <label className="ui-label">PIN de acceso * (4-6 dígitos)</label>
                <input
                  type="password"
                  required
                  maxLength="6"
                  placeholder="Ej: 1234"
                  value={formData.pin}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pin: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="ui-input um-pin-input"
                />
              </div>

              <div className="mt-2">
                <label className="ui-label font-size-lg font-bold-800">
                  Panel de Control de Permisos
                </label>

                {[
                  {
                    title: "Ventas y Operaciones",
                    icon: "shopping_cart",
                    keys: [
                      "can_access_sales",
                      "can_manage_orders",
                      "can_delete_orders",
                      "can_void_sales",
                      "can_manage_clients",
                      "can_use_ia_vision",
                    ],
                  },
                  {
                    title: "Catálogos e Inventario",
                    icon: "inventory_2",
                    keys: [
                      "can_access_services",
                      "can_access_products",
                      "can_manage_supplies",
                      "can_view_supplies",
                      "can_manage_inventory",
                    ],
                  },
                  {
                    title: "Administraci\u00f3n y Reportes",
                    icon: "analytics",
                    keys: [
                      "can_view_dashboard",
                      "can_view_audit",
                      "can_manage_staff",
                      "can_see_reports",
                      "can_view_cash_reports",
                      "can_view_cancellations",
                      "can_access_produccion_diaria",
                    ],
                  },
                  {
                    title: "Sistema y Terminal",
                    icon: "settings",
                    keys: [
                      "can_access_settings",
                      "can_manage_cash",
                      "can_lock_terminal",
                      "can_restart_cash",
                      "can_logout",
                    ],
                  },
                ].map((category) => (
                  <div key={category.title} className="um-permissions-category">
                    <h4 className="text-accent font-size-md mb-1">
                      <span
                        className="material-icons-outlined icon-18"
                      >
                        {category.icon}
                      </span>
                      {category.title}
                    </h4>
                    <div className="um-permissions-grid">
                      {category.keys.map((key) => {
                        const info = PERMISSION_LABELS[key];
                        if (!info) return null;
                        return (
                          <div
                            key={key}
                            className="um-permission-item"
                          >
                            <div className="um-no-events">
                              <div className="text-main font-size-sm">
                                {info.label}
                              </div>
                              <div className="text-muted font-size-xs">
                                {info.desc}
                              </div>
                            </div>
                            <label className="ui-toggle">
                              <input
                                type="checkbox"
                                checked={formData.permissions[key] || false}
                                onChange={() => handlePermissionToggle(key)}
                              />
                              <span className="ui-toggle__slider"></span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="d-flex gap-1 mt-2">
                <UiButton
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </UiButton>
                <UiButton
                  type="submit"
                  variant="primary"
                  className="flex-1"
                >
                  {editingStaff ? "Guardar Cambios" : "Crear Empleado"}
                </UiButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
