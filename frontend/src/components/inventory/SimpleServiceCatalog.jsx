import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { simpleCatalogService } from "../../services/simpleCatalogService";
import { useAuth } from "../../hooks/useAuth";
import { useSettings } from "../../contexts/SettingsContext";
import Swal from "sweetalert2";
import "./SimpleServiceCatalog.css";

const CATEGORIES = [
  "Lavado",
  "Planchado",
  "Tintorería",
  "Express",
  "General"
];

const PRICING_TYPES = [
  { value: "unit", label: "Por pieza" },
  { value: "kg", label: "Por kilo" },
  { value: "docena", label: "Por docena" }
];

export const SimpleServiceCatalog = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    cost: "",
    category: "General",
    pricing_type: "unit"
  });

  const { isAdmin } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();

  if (!settingsLoading && !settings?.service_catalog_enabled) {
    return <Navigate to="/" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await simpleCatalogService.getAll();
      setServices(data);
    } catch (error) {
      console.error("Error cargando servicios:", error);
      Swal.fire("Error", "No se pudieron cargar los servicios.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      cost: "",
      category: "General",
      pricing_type: "unit"
    });
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      Swal.fire("Atención", "El nombre del servicio es obligatorio.", "warning");
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      Swal.fire("Atención", "El precio debe ser mayor a 0.", "warning");
      return;
    }

    try {
      const payload = {
        ...formData,
        unit_type: formData.pricing_type === 'kg' ? 'KG' : formData.pricing_type === 'docena' ? 'DOC' : 'PZA',
        cost_price: parseFloat(formData.cost || 0)
      };

      if (editingId) {
        await simpleCatalogService.update(editingId, payload);
        Swal.fire("Actualizado", "Servicio actualizado correctamente.", "success");
      } else {
        await simpleCatalogService.create(payload);
        Swal.fire("Guardado", "Servicio creado correctamente.", "success");
      }
      resetForm();
      loadServices();
    } catch (error) {
      console.error("Error guardando servicio:", error);
      Swal.fire("Error", "No se pudo guardar el servicio.", "error");
    }
  };

  const handleEdit = (service) => {
    setEditingId(service.id);
    setFormData({
      name: service.name,
      price: service.price,
      cost: service.cost_price || "",
      category: service.category || "General",
      pricing_type: service.pricing_type || "unit"
    });
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "¿Eliminar servicio?",
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    });

    if (result.isConfirmed) {
      try {
        await simpleCatalogService.delete(id);
        Swal.fire("Eliminado", "Servicio eliminado correctamente.", "success");
        loadServices();
      } catch (error) {
        console.error("Error eliminando servicio:", error);
        Swal.fire("Error", "No se pudo eliminar el servicio.", "error");
      }
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN"
    }).format(parseFloat(amount || 0));
  };

  const getPricingLabel = (type) => {
    const found = PRICING_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  // Group services by category
  const groupedServices = services.reduce((acc, service) => {
    const cat = service.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  return (
    <div className="simple-catalog-container">
      <div className="simple-catalog-header">
        <h1>📋 Catálogo Express de Servicios</h1>
        <p>Administra tus servicios de lavandería de forma rápida y sencilla.</p>
      </div>

      <div className="simple-catalog-grid">
        {/* Form */}
        <div className="simple-catalog-card">
          <h2>{editingId ? "Editar Servicio" : "Nuevo Servicio"}</h2>
          <form onSubmit={handleSubmit} className="simple-catalog-form">
            <div className="form-group">
              <label>Nombre del servicio</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Ej. Lavado por kg, Planchado..."
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Precio de venta</label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label>Costo al negocio</label>
                <input
                  type="number"
                  name="cost"
                  value={formData.cost}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Categoría</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Tipo de cobro</label>
                <select
                  name="pricing_type"
                  value={formData.pricing_type}
                  onChange={handleInputChange}
                  required
                >
                  {PRICING_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingId ? "Actualizar" : "Agregar Servicio"}
              </button>
              {editingId && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Service list by category */}
        <div className="simple-catalog-card">
          <h2>Servicios Actuales ({services.length})</h2>
          {loading ? (
            <p className="loading-text">Cargando servicios...</p>
          ) : services.length === 0 ? (
            <p className="empty-text">No hay servicios registrados.</p>
          ) : (
            <div className="simple-catalog-list">
              {Object.entries(groupedServices).map(([category, items]) => (
                <div key={category} className="catalog-category-group">
                  <h3 className="category-title">{category}</h3>
                  {items.map((service) => (
                    <div key={service.id} className="catalog-item">
                      <div className="catalog-item-info">
                        <span className="catalog-item-name">{service.name}</span>
                        <span className="catalog-item-price">
                          {formatMoney(service.price)} {getPricingLabel(service.pricing_type)} &nbsp;
                          <span style={{ color: '#10b981', fontSize: '0.8rem' }}>
                            util: {formatMoney((service.price || 0) - (service.cost_price || 0))}
                          </span>
                        </span>
                      </div>
                      <div className="catalog-item-actions">
                        <button
                          className="btn-icon btn-edit"
                          onClick={() => handleEdit(service)}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon btn-delete"
                          onClick={() => handleDelete(service.id)}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleServiceCatalog;
