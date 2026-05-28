import React, { useState, useEffect } from "react";
import { adminLicenseService } from "../../services/adminLicenseService";
import { invitationService } from "../../services/invitationService";
import { supabase } from "../../supabase";
import Swal from "sweetalert2";

export const MasterLicenseManager = () => {
  const [masterPin, setMasterPin] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("licenses"); // 'licenses' | 'invitations' | 'admins' | 'preferences'

  // Estado para nueva invitación
  const [invitationNote, setInvitationNote] = useState("");
  const [generatedCode, setGeneratedCode] = useState(null);

  // Estado para administradores
  const [admins, setAdmins] = useState([]);

  // Estado para Super Admin Actual
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Intentar obtener perfiles para validar el PIN y el Rol
    const response = await adminLicenseService.getProfiles(masterPin);
    setLoading(false);

    if (response.success) {
      setProfiles(response.data);
      setIsAuthenticated(true);

      // Fetch current user email for preferences
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUserEmail(user.email);
      });

      const Toast = Swal.mixin({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,
      });
      Toast.fire({
        icon: "success",
        title: "Acceso concedido",
      });
    } else {
      Swal.fire({
        icon: "error",
        title: "Acceso Denegado",
        text: response.error || "PIN incorrecto o falta de permisos.",
      });
    }
  };

  const refreshProfiles = async () => {
    setLoading(true);
    const response = await adminLicenseService.getProfiles(masterPin);
    if (response.success) {
      setProfiles(response.data);
    }
    setLoading(false);
  };

  const refreshAdmins = async () => {
    setLoading(true);
    const response = await adminLicenseService.getSuperAdmins();
    if (response.success) {
      setAdmins(response.data);
    }
    setLoading(false);
  };

  const handleUpdateLicense = async (profile, daysToAdd) => {
    const currentExpiry = profile.license_expires_at
      ? new Date(profile.license_expires_at)
      : new Date();
    // Si ya venció, usar fecha actual como base. Si no, usar la fecha de vencimiento.
    const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();

    const newDate = new Date(baseDate);
    newDate.setDate(newDate.getDate() + daysToAdd); // Sumar días

    const result = await Swal.fire({
      title: "¿Confirmar renovación?",
      html: `Cliente: <b>${profile.store_name || "Sin nombre"}</b><br/>
                   Nueva fecha: <b>${newDate.toLocaleDateString()}</b>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, renovar",
      cancelButtonText: "Cancelar",
    });

    if (result.isConfirmed) {
      setLoading(true);
      const response = await adminLicenseService.updateLicense(
        profile.id,
        newDate.toISOString(),
        masterPin,
      );
      setLoading(false);

      if (response.success) {
        Swal.fire("Renovado", "La licencia ha sido actualizada.", "success");
        refreshProfiles();
      } else {
        Swal.fire("Error", "No se pudo actualizar la licencia.", "error");
      }
    }
  };

  const handleToggleAdmin = async (profile) => {
    const isCurrentlyAdmin = profile.role === "super_admin";
    const actionText = isCurrentlyAdmin
      ? "Quitar privilegios de Super Admin"
      : "Hacer Super Admin";
    const confirmText = isCurrentlyAdmin ? "Sí, degradar" : "Sí, ascender";

    const result = await Swal.fire({
      title: `¿${actionText}?`,
      html: `Usuario: <b>${profile.full_name}</b><br/>Tienda: ${profile.store_name}`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#7c3aed",
      confirmButtonText: confirmText,
    });

    if (result.isConfirmed) {
      setLoading(true);
      const response = await adminLicenseService.toggleSuperAdmin(
        profile.id,
        !isCurrentlyAdmin,
        masterPin,
      );
      setLoading(false);

      if (response.success) {
        Swal.fire("Éxito", "Permisos actualizados correctamente", "success");
        refreshProfiles();
      } else {
        Swal.fire("Error", "No se pudo actualizar los permisos", "error");
      }
    }
  };

  const handleToggleDelivery = async (profile) => {
    const willEnable = !profile.delivery_enabled;
    const result = await Swal.fire({
      title: willEnable ? "Activar Delivery" : "Desactivar Delivery",
      html: `Tienda: <b>${profile.store_name || "Sin nombre"}</b><br/>${
        willEnable
          ? "Se mostraran Delivery y Portal Repartidor para este cliente."
          : "Se ocultara el modulo sin borrar pedidos historicos."
      }`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: willEnable ? "#0891b2" : "#64748b",
      confirmButtonText: willEnable ? "Activar" : "Desactivar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    const response = await adminLicenseService.toggleDeliveryModule(
      profile.id,
      willEnable,
      masterPin,
    );
    setLoading(false);

    if (response.success) {
      Swal.fire(
        "Actualizado",
        willEnable ? "Delivery fue activado para esta tienda." : "Delivery fue desactivado para esta tienda.",
        "success",
      );
      refreshProfiles();
    } else {
      Swal.fire("Error", response.error || "No se pudo actualizar el modulo.", "error");
    }
  };

  const handleSuspend = async (profile) => {
    const result = await Swal.fire({
      title: "¿Suspender Servicio?",
      text: `Esto bloqueará el acceso a ${profile.store_name} inmediatamente.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, suspender",
    });

    if (result.isConfirmed) {
      // Establecer fecha en el pasado (-1 día)
      const newDate = new Date();
      newDate.setDate(newDate.getDate() - 1);

      setLoading(true);
      const response = await adminLicenseService.updateLicense(
        profile.id,
        newDate.toISOString(),
        masterPin,
      );
      setLoading(false);

      if (response.success) {
        Swal.fire("Suspendido", "El servicio ha sido suspendido.", "success");
        refreshProfiles();
      } else {
        Swal.fire("Error", "No se pudo suspender el servicio.", "error");
      }
    }
  };

  const handleDeleteClient = async (profile) => {
    // PASO 1: Primera advertencia
    const firstConfirm = await Swal.fire({
      title: "⚠️ ELIMINAR CLIENTE",
      html: `
                <div style="text-align: left; background: #fee2e2; padding: 1rem; border-radius: 8px; border: 2px solid #ef4444;">
                    <p style="font-weight: bold; color: #991b1b; margin-bottom: 0.5rem;">¡ACCIÓN IRREVERSIBLE!</p>
                    <p style="color: #7f1d1d; font-size: 0.9rem;">
                        Estás a punto de eliminar permanentemente:<br/>
                        <strong>${profile.store_name || "Sin Nombre"}</strong><br/>
                        (${profile.full_name} - ${profile.email})
                    </p>
                </div>
            `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Continuar con eliminación",
      cancelButtonText: "Cancelar",
    });

    if (!firstConfirm.isConfirmed) return;

    // PASO 2: Segunda confirmación con texto de verificación
    const secondConfirm = await Swal.fire({
      title: "🔴 CONFIRMACIÓN FINAL",
      html: `
                <div style="text-align: center;">
                    <p style="color: #dc2626; font-weight: bold; font-size: 1.1rem; margin-bottom: 1rem;">
                        Esta acción NO se puede deshacer
                    </p>
                    <p style="color: #374151; margin-bottom: 1rem;">
                        Se eliminarán TODOS los datos asociados:<br/>
                        • Perfil del usuario<br/>
                        • Historial de órdenes<br/>
                        • Configuraciones<br/>
                        • Ventas y registros
                    </p>
                    <p style="font-weight: bold; color: #1f2937;">
                        Escribe <span style="color: #dc2626;">ELIMINAR</span> para confirmar:
                    </p>
                </div>
            `,
      input: "text",
      inputPlaceholder: "Escribe ELIMINAR",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "ELIMINAR PERMANENTEMENTE",
      cancelButtonText: "Cancelar",
      inputValidator: (value) => {
        if (value !== "ELIMINAR") {
          return "Debes escribir ELIMINAR exactamente para confirmar";
        }
      },
    });

    if (!secondConfirm.isConfirmed) return;

    // PASO 3: Ejecutar eliminación
    setLoading(true);
    try {
      const response = await adminLicenseService.deleteClient(
        profile.id,
        masterPin,
      );

      if (response.success) {
        Swal.fire({
          title: "Cliente Eliminado",
          text: `${profile.store_name || profile.full_name} ha sido eliminado permanentemente del sistema.`,
          icon: "success",
          confirmButtonColor: "#10b981",
        });
        refreshProfiles();
      } else {
        throw new Error(response.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error eliminando cliente:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo eliminar el cliente.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (profile) => {
    // Pedir la nueva contraseña
    const { value: newPassword } = await Swal.fire({
      title: "🔐 Cambiar Contraseña",
      html: `
                <div style="text-align: left; margin-bottom: 1rem;">
                    <p><strong>Cliente:</strong> ${profile.store_name || "Sin nombre"}</p>
                    <p><strong>Email:</strong> ${profile.email}</p>
                </div>
            `,
      input: "password",
      inputLabel: "Nueva Contraseña",
      inputPlaceholder: "Mínimo 6 caracteres",
      inputAttributes: {
        minlength: 6,
        autocapitalize: "off",
        autocorrect: "off",
      },
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Cambiar Contraseña",
      cancelButtonText: "Cancelar",
      inputValidator: (value) => {
        if (!value || value.length < 6) {
          return "La contraseña debe tener al menos 6 caracteres";
        }
      },
    });

    if (!newPassword) return;

    // Confirmar el cambio
    const confirmResult = await Swal.fire({
      title: "¿Confirmar cambio?",
      html: `
                <p>Se cambiará la contraseña de:</p>
                <p><strong>${profile.email}</strong></p>
                <p style="color: #dc2626; margin-top: 1rem; font-size: 0.9rem;">
                    ⚠️ El cliente deberá usar la nueva contraseña para iniciar sesión.
                </p>
            `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      confirmButtonText: "Sí, cambiar",
      cancelButtonText: "Cancelar",
    });

    if (!confirmResult.isConfirmed) return;

    setLoading(true);
    try {
      const response = await adminLicenseService.updateClientPassword(
        profile.id,
        newPassword,
        masterPin,
      );

      if (response.success) {
        Swal.fire({
          title: "✅ Contraseña Actualizada",
          html: `
                        <p>La contraseña de <strong>${profile.email}</strong> ha sido cambiada exitosamente.</p>
                    `,
          icon: "success",
          confirmButtonColor: "#10b981",
        });
      } else {
        throw new Error(response.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error cambiando contraseña:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo cambiar la contraseña.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearCatalog = async (profile) => {
    const result = await Swal.fire({
      title: "⚠️ ¿Borrar Catálogo Completo?",
      html: `
                <div style="text-align: left;">
                    <p>Se eliminarán <strong>TODOS</strong> los productos y servicios de:</p>
                    <p><strong>${profile.store_name || profile.full_name}</strong></p>
                    <p style="color: #dc2626; margin-top: 10px;">¡Esta acción no se puede deshacer!</p>
                    <p>Escribe <strong>BORRAR</strong> para confirmar:</p>
                </div>
            `,
      input: "text",
      inputPlaceholder: "Escribe BORRAR",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, borrar todo",
      cancelButtonText: "Cancelar",
      inputValidator: (value) => {
        if (value !== "BORRAR") {
          return "Debes escribir BORRAR para confirmar";
        }
      },
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const response = await adminLicenseService.clearClientCatalog(
        profile.id,
        masterPin,
      );

      if (response.success) {
        Swal.fire({
          title: "Catálogo Eliminado",
          text: `Se eliminaron ${response.count} ítems correctamente.`,
          icon: "success",
        });
      } else {
        throw new Error(response.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error clearing catalog:", error);
      Swal.fire(
        "Error",
        error.message || "No se pudo limpiar el catálogo.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const generateInvitation = async () => {
    if (!invitationNote.trim()) {
      return Swal.fire(
        "Requerido",
        "Ingresa una nota o nombre del cliente",
        "warning",
      );
    }

    // Generar código aleatorio: CLIENTE-XXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const code = `CLIENTE-${randomSuffix}`;

    try {
      // Usar RPC seguro a través del servicio de admin
      const response = await adminLicenseService.createInvitationCode(
        code,
        invitationNote,
        masterPin,
      );

      if (!response.success) {
        throw new Error(response.error || "No se pudo crear el código");
      }

      setGeneratedCode({
        code: code,
        link: `${window.location.origin}/#/register/${code}`,
      });
      setInvitationNote("");

      Swal.fire({
        icon: "success",
        title: "¡Código Generado!",
        text: `Código: ${code}`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error(error);
      Swal.fire(
        "Error",
        error.message || "No se pudo generar el código.",
        "error",
      );
    }
  };

  const handleCreateAdmin = async () => {
    const { value: formValues } = await Swal.fire({
      title: "Alta de Administrador",
      html:
        '<input id="swal-input-email" class="swal2-input" placeholder="Correo electrónico" type="email">' +
        '<input id="swal-input-pwd" class="swal2-input" placeholder="Contraseña temporal" type="password">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Crear",
      preConfirm: () => {
        const email = document.getElementById("swal-input-email").value;
        const pwd = document.getElementById("swal-input-pwd").value;
        if (!email || !pwd) {
          Swal.showValidationMessage("Ambos campos son obligatorios");
        }
        if (pwd.length < 6) {
          Swal.showValidationMessage(
            "La contraseña debe tener al menos 6 caracteres",
          );
        }
        return { email, pwd };
      },
    });

    if (formValues) {
      setLoading(true);
      const { email, pwd } = formValues;
      const res = await adminLicenseService.createSuperAdmin(
        email,
        pwd,
        masterPin,
      );
      setLoading(false);

      if (res.success) {
        Swal.fire("Éxito", "Administrador creado correctamente.", "success");
        refreshAdmins();
      } else {
        Swal.fire(
          "Error",
          res.error || "No se pudo crear el administrador.",
          "error",
        );
      }
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      return Swal.fire(
        "Error",
        "La contraseña debe tener al menos 6 caracteres.",
        "error",
      );
    }

    const result = await Swal.fire({
      title: "¿Confirmar Cambio?",
      text: "Se cerrarán todas tus sesiones activas por seguridad.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, cambiar",
    });

    if (result.isConfirmed) {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      setLoading(false);

      if (error) {
        Swal.fire("Error", error.message, "error");
      } else {
        await Swal.fire(
          "Éxito",
          "Contraseña actualizada. Deberás iniciar sesión de nuevo.",
          "success",
        );
        await supabase.auth.signOut();
        window.location.reload();
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 w-full max-w-md">
          <div className="flex justify-center mb-4">
            <span className="material-icons-outlined text-4xl text-blue-600">
              lock_open
            </span>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-center text-gray-800">
            Desbloqueo de Seguridad
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            Ingresa tu PIN Maestro para interactuar con la base de datos
            corporativa.
          </p>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                PIN Maestro de Operaciones
              </label>
              <input
                type="password"
                value={masterPin}
                onChange={(e) => setMasterPin(e.target.value)}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-gray-50 text-center text-xl tracking-widest"
                placeholder="••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {loading ? "Verificando Credencial..." : "Desbloquear Portal"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-transparent">
      <header className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Base de Datos Corporativa
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Gestión de licencias, usuarios y configuraciones maestras
          </p>
        </div>
      </header>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("licenses")}
              className={`${activeTab === "licenses" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Clientes Activos
            </button>
            <button
              onClick={() => setActiveTab("invitations")}
              className={`${activeTab === "invitations" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Generar Invitaciones
            </button>
            <button
              onClick={() => {
                setActiveTab("admins");
                refreshAdmins();
              }}
              className={`${activeTab === "admins" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Administradores
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`${activeTab === "preferences" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Preferencias
            </button>
          </nav>
        </div>
      </div>

      {activeTab === "licenses" && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Listado de Tiendas
            </h3>
            <button
              onClick={refreshProfiles}
              className="text-sm text-blue-600 hover:text-blue-900"
            >
              Actualizar
            </button>
          </div>
          <ul className="divide-y divide-gray-200">
            {profiles.map((profile) => {
              const expiresAt = profile.license_expires_at
                ? new Date(profile.license_expires_at)
                : null;
              const isExpired = expiresAt && expiresAt < new Date();
              const statusColor = !expiresAt
                ? "gray"
                : isExpired
                  ? "red"
                  : "green";

              return (
                <li
                  key={profile.id}
                  className="px-4 py-4 sm:px-6 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-lg font-bold text-gray-900 truncate">
                        {profile.store_name || "Sin Nombre"}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {profile.full_name} • {profile.email}
                      </p>
                      <div className="mt-2 flex items-center text-sm text-gray-500 space-x-2">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${statusColor}-100 text-${statusColor}-800`}
                        >
                          {expiresAt
                            ? `Vence: ${expiresAt.toLocaleDateString()}`
                            : "Sin Licencia"}
                        </span>
                        {profile.role === "super_admin" && (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            SUPER ADMIN
                          </span>
                        )}
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${
                            profile.delivery_enabled
                              ? "bg-cyan-100 text-cyan-800 border-cyan-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {profile.delivery_enabled ? "DELIVERY ACTIVO" : "DELIVERY OFF"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={() => handleUpdateLicense(profile, 30)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 shadow-sm"
                      >
                        +30 Días
                      </button>
                      <button
                        onClick={() => handleUpdateLicense(profile, 365)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                      >
                        +1 Año
                      </button>
                      <button
                        onClick={() => handleToggleAdmin(profile)}
                        className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white shadow-sm ${
                          profile.role === "super_admin"
                            ? "bg-gray-600 hover:bg-gray-700"
                            : "bg-purple-600 hover:bg-purple-700"
                        }`}
                      >
                        {profile.role === "super_admin"
                          ? "Degradar"
                          : "Hacer Admin"}
                      </button>
                      <button
                        onClick={() => handleToggleDelivery(profile)}
                        className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white shadow-sm ${
                          profile.delivery_enabled
                            ? "bg-slate-600 hover:bg-slate-700"
                            : "bg-cyan-600 hover:bg-cyan-700"
                        }`}
                      >
                        {profile.delivery_enabled ? "Desactivar Delivery" : "Activar Delivery"}
                      </button>
                      <button
                        onClick={() => handleSuspend(profile)}
                        className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                      >
                        Suspender
                      </button>
                      <button
                        onClick={() => handleResetPassword(profile)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                        title="Enviar correo para resetear contraseña"
                      >
                        🔑 Reset Pass
                      </button>
                      <button
                        onClick={() => handleClearCatalog(profile)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 shadow-sm"
                        title="Borrar todos los productos/servicios"
                      >
                        🧹 Limpiar Catálogo
                      </button>
                      <button
                        onClick={() => handleDeleteClient(profile)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 shadow-sm"
                        title="Eliminar permanentemente"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
            {profiles.length === 0 && (
              <li className="px-4 py-8 text-center text-gray-500">
                No se encontraron clientes registrados.
              </li>
            )}
          </ul>
        </div>
      )}

      {activeTab === "invitations" && (
        <div className="bg-white shadow sm:rounded-lg p-6 max-w-2xl mx-auto mt-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Nueva Invitación de Registro
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nota / Cliente
              </label>
              <input
                type="text"
                value={invitationNote}
                onChange={(e) => setInvitationNote(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
                placeholder="Ej: Lavandería El Sol - Sucursal Norte"
              />
            </div>
            <button
              onClick={generateInvitation}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Generar Código y Enlace
            </button>
          </div>

          {generatedCode && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
              <h4 className="text-sm font-bold text-green-800 mb-2">
                ¡Invitación Generada!
              </h4>
              <p className="text-sm text-gray-700 mb-1">
                Código:{" "}
                <span className="font-mono font-bold">
                  {generatedCode.code}
                </span>
              </p>
              <div className="flex items-center content-center gap-2">
                <input
                  readOnly
                  value={generatedCode.link}
                  className="flex-1 p-2 text-xs bg-white border border-gray-300 rounded text-black"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCode.link);
                    const Toast = Swal.mixin({
                      toast: true,
                      position: "top-end",
                      showConfirmButton: false,
                      timer: 1500,
                    });
                    Toast.fire({ icon: "success", title: "Copiado" });
                  }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "admins" && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Administradores del Portal
            </h3>
            <div className="space-x-2">
              <button
                onClick={refreshAdmins}
                className="text-sm text-blue-600 hover:text-blue-900 border border-blue-600 px-3 py-1 rounded"
              >
                Actualizar
              </button>
              <button
                onClick={handleCreateAdmin}
                className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded shadow-sm"
              >
                + Dar de Alta Administrador
              </button>
            </div>
          </div>
          <ul className="divide-y divide-gray-200">
            {admins.map((admin) => (
              <li key={admin.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {admin.email}
                    </p>
                    <p className="text-xs text-gray-500">
                      Agregado el{" "}
                      {new Date(admin.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      SUPER ADMIN
                    </span>
                  </div>
                </div>
              </li>
            ))}
            {admins.length === 0 && !loading && (
              <li className="px-4 py-8 text-center text-gray-500">
                No hay administradores adicionales.
              </li>
            )}
          </ul>
        </div>
      )}

      {activeTab === "preferences" && (
        <div className="bg-white shadow sm:rounded-lg p-6 max-w-2xl mx-auto mt-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Ajustes de Cuenta
          </h3>
          <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200">
            <p className="text-sm text-gray-500">
              Sesión actual conectada como:
            </p>
            <p className="font-bold text-gray-900">{currentUserEmail}</p>
          </div>

          <form
            onSubmit={handleChangePassword}
            className="space-y-4 border-t pt-4"
          >
            <h4 className="text-md font-medium text-gray-800">
              Cambiar Contraseña
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nueva Contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <p className="text-xs text-red-500">
              Nota: Al guardar la nueva contraseña, se cerrarán todas sus
              sesiones activas por seguridad.
            </p>
            <button
              type="submit"
              disabled={loading || newPassword.length < 6}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "Guardando..."
                : "Actualizar Contraseña y Cerrar Sesión"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
