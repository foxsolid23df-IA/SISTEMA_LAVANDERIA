import React, { useState, useEffect } from "react";
import { customerService } from "../../services/customerService";
import Swal from "sweetalert2";
import BulkCustomerImportModal from "./BulkCustomerImportModal";
import "./ClientManager.css";

export const ClientManager = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    email: "",
    notes: "",
  });

  // Estado para el modal de historial
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [clientHistory, setClientHistory] = useState({
    orders: [],
    stats: null,
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedClientForHistory, setSelectedClientForHistory] =
    useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await customerService.getCustomers();
      setClients(data);
    } catch (error) {
      console.error("Error loading clients:", error);
      Swal.fire("Error", "No se pudieron cargar los clientes", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name || "",
        phone: client.phone || "",
        address: client.address || "",
        email: client.email || "",
        notes: client.notes || "",
      });
    } else {
      setEditingClient(null);
      setFormData({
        name: "",
        phone: "",
        address: "",
        email: "",
        notes: "",
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClient(null);
    setFormData({ name: "", phone: "", address: "", email: "", notes: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validación de duplicados (Bug 1)
    try {
      if (formData.phone) {
        const duplicatePhone = await customerService.checkDuplicate(
          "phone",
          formData.phone,
          editingClient?.id,
        );
        if (duplicatePhone) {
          const result = await Swal.fire({
            title: "⚠️ Teléfono Duplicado",
            text: `El número ${formData.phone} ya pertenece al cliente "${duplicatePhone.name}". ¿Deseas continuar?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, continuar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#f59e0b",
            cancelButtonColor: "#64748b",
          });
          if (!result.isConfirmed) return;
        }
      }

      if (formData.email) {
        const duplicateEmail = await customerService.checkDuplicate(
          "email",
          formData.email,
          editingClient?.id,
        );
        if (duplicateEmail) {
          const result = await Swal.fire({
            title: "⚠️ Email Duplicado",
            text: `El email ${formData.email} ya pertenece al cliente "${duplicateEmail.name}". ¿Deseas continuar?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, continuar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#f59e0b",
            cancelButtonColor: "#64748b",
          });
          if (!result.isConfirmed) return;
        }
      }

      if (editingClient) {
        await customerService.updateCustomer(editingClient.id, formData);
        Swal.fire("Éxito", "Cliente actualizado correctamente", "success");
      } else {
        await customerService.createCustomer(formData);
        Swal.fire("Éxito", "Cliente creado correctamente", "success");
      }
      handleCloseModal();
      loadClients();
    } catch (error) {
      console.error("Error saving client:", error);
      Swal.fire("Error", "No se pudo guardar el cliente", "error");
    }
  };

  // Manejador para ver historial (Bug 4)
  const handleViewHistory = async (client) => {
    setSelectedClientForHistory(client);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const data = await customerService.getCustomerStats(client.id);
      setClientHistory(data);
    } catch (error) {
      console.error("Error loading history:", error);
      Swal.fire("Error", "No se pudo cargar el historial del cliente", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedClientForHistory(null);
    setClientHistory({ orders: [], stats: null });
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: "Esta acción no se puede deshacer",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      try {
        await customerService.deleteCustomer(id);
        Swal.fire("Eliminado", "El cliente ha sido eliminado", "success");
        loadClients();
      } catch (error) {
        console.error("Error deleting client:", error);
        Swal.fire("Error", "No se pudo eliminar el cliente", "error");
      }
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone?.includes(searchTerm) ||
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Cargando clientes...</p>
      </div>
    );

  return (
    <div className="client-manager-container">
      <div className="client-manager-header">
        <div className="search-container">
          <span className="material-symbols-outlined search-icon">search</span>
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="header-actions">
          <button
            className="btn-client btn-bulk"
            onClick={() => setShowBulkModal(true)}
          >
            <span className="material-symbols-outlined">upload_file</span>
            Carga Masiva
          </button>
          <button
            className="btn-client btn-new"
            onClick={() => handleOpenModal()}
          >
            <span className="material-symbols-outlined">person_add</span>
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="client-table-card">
        <div className="client-table-scroll">
          <table className="client-table">
            <thead>
              <tr>
                <th>Cliente / Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Dirección</th>
                <th>Notas</th>
                <th style={{ textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div className="name-cell">
                        <div className="avatar-initial">
                          {(client.name || "C").charAt(0).toUpperCase()}
                        </div>
                        <div className="client-info">
                          <h4>{client.name}</h4>
                          <span>
                            Registrado el{" "}
                            {new Date(client.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {client.phone ? (
                        <div className="phone-badge">
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "14px" }}
                          >
                            call
                          </span>
                          {client.phone}
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td>
                      {client.email ? (
                        <a
                          href={`mailto:${client.email}`}
                          className="email-link"
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "14px" }}
                          >
                            mail
                          </span>
                          {client.email}
                        </a>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td>
                      <div className="address-text" title={client.address}>
                        {client.address || "Sin dirección"}
                      </div>
                    </td>
                    <td>
                      <div className="notes-text" title={client.notes}>
                        {client.notes || "-"}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div className="actions-row">
                        <button
                          className="btn-action btn-history"
                          onClick={() => handleViewHistory(client)}
                          title="Ver Historial"
                        >
                          <span className="material-symbols-outlined">
                            history
                          </span>
                        </button>
                        <button
                          className="btn-action btn-edit"
                          onClick={() => handleOpenModal(client)}
                          title="Editar"
                        >
                          <span className="material-symbols-outlined">
                            edit_square
                          </span>
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(client.id)}
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined">
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="6"
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "#64748b",
                    }}
                  >
                    No se encontraron clientes que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="client-modal-overlay">
          <div className="client-modal">
            <div className="modal-head">
              <h2>{editingClient ? "Editar Cliente" : "Nuevo Cliente"}</h2>
              <button className="btn-close" onClick={handleCloseModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="input-group full-width">
                    <label>Nombre Completo*</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Nombre completo del cliente"
                    />
                  </div>
                  <div className="input-group">
                    <label>Teléfono</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="000 000 0000"
                    />
                  </div>
                  <div className="input-group">
                    <label>Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                  <div className="input-group full-width">
                    <label>Dirección</label>
                    <textarea
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="Calle, Número, Colonia, Municipio..."
                      rows="2"
                    ></textarea>
                  </div>
                  <div className="input-group full-width">
                    <label>Notas / Observaciones</label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Información relevante para pedidos..."
                      rows="2"
                    ></textarea>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-client btn-cancel"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-client btn-save">
                  {editingClient ? "Actualizar Cliente" : "Registrar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showBulkModal && (
        <BulkCustomerImportModal
          onClose={() => setShowBulkModal(false)}
          onSuccess={() => loadClients()}
        />
      )}

      {/* Modal de Historial (Bug 4) */}
      {showHistoryModal && selectedClientForHistory && (
        <div className="client-modal-overlay">
          <div
            className="client-modal history-modal"
            style={{ maxWidth: "800px" }}
          >
            <div className="modal-head">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Historial del Cliente
                </span>
                <h2 className="text-xl font-black">
                  {selectedClientForHistory.name}
                </h2>
              </div>
              <button className="btn-close" onClick={closeHistoryModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="modal-body">
              {loadingHistory ? (
                <div className="flex justify-center p-8">
                  <div className="loader"></div>
                </div>
              ) : (
                <div className="history-content">
                  {/* Stats Cards */}
                  <div
                    className="stats-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div className="stat-card p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        Total Gastado
                      </span>
                      <span className="block text-xl font-black text-emerald-600">
                        ${clientHistory.stats?.totalSpent?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="stat-card p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        Órdenes Totales
                      </span>
                      <span className="block text-xl font-black text-blue-600">
                        {clientHistory.stats?.totalOrders || 0}
                      </span>
                    </div>
                    <div className="stat-card p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <span className="block text-xs font-bold text-slate-400 uppercase mb-1">
                        Saldo Pendiente
                      </span>
                      <span
                        className={`block text-xl font-black ${clientHistory.stats?.pendingPayment > 0 ? "text-red-500" : "text-slate-500"}`}
                      >
                        $
                        {clientHistory.stats?.pendingPayment?.toFixed(2) ||
                          "0.00"}
                      </span>
                    </div>
                  </div>

                  {/* Orders List */}
                  <div className="orders-list-container bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Fecha</th>
                          <th className="p-3"># Orden</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3 text-right">Total</th>
                          <th className="p-3 text-right">Pagado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {clientHistory.orders.length > 0 ? (
                          clientHistory.orders.map((order) => (
                            <tr
                              key={order.id}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            >
                              <td className="p-3">
                                {new Date(
                                  order.created_at,
                                ).toLocaleDateString()}
                              </td>
                              <td className="p-3 font-mono">
                                #{order.id.toString().slice(-6)}
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold 
                                                                    ${
                                                                      order.status ===
                                                                      "delivered"
                                                                        ? "bg-slate-100 text-slate-600"
                                                                        : order.status ===
                                                                            "ready"
                                                                          ? "bg-emerald-100 text-emerald-600"
                                                                          : "bg-blue-100 text-blue-600"
                                                                    }`}
                                >
                                  {order.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-bold">
                                ${order.total?.toFixed(2)}
                              </td>
                              <td className="p-3 text-right text-emerald-600">
                                ${order.paid_amount?.toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan="5"
                              className="p-8 text-center text-slate-400"
                            >
                              No hay órdenes registradas para este cliente.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn-client btn-save"
                onClick={closeHistoryModal}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
