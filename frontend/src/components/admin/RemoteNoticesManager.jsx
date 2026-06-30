import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { adminLicenseService } from "../../services/adminLicenseService";

const DEFAULT_FORM = {
  id: null,
  notice_key: "",
  title: "Licencia próxima a vencer",
  message: "Hola recuerda que tu licencia esta próxima a vencer, favor de contactar a tu administrador de cuenta y evites suspensión.",
  openEvent: true,
  closeEvent: true,
  active: true,
  starts_at: "",
  ends_at: "",
  button_text: "Contactar por WhatsApp",
  button_url: "https://wa.me/5215650607108",
};

const toDatetimeLocal = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDatetimeLocal = (value) => value ? new Date(value).toISOString() : null;

const createNoticeKey = (userId) => {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `aviso-${Date.now()}-${String(userId).slice(0, 8)}-${suffix}`;
};

export const RemoteNoticesManager = ({ profiles = [], masterPin = '' }) => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [noticeSearch, setNoticeSearch] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState([]);
  const [form, setForm] = useState(DEFAULT_FORM);

  const profileMap = useMemo(() => {
    return profiles.reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {});
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    const term = clientSearch.trim().toLowerCase();
    return profiles
      .filter((profile) => {
        if (!term) return true;
        return [profile.store_name, profile.full_name, profile.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => String(a.store_name || "").localeCompare(String(b.store_name || "")));
  }, [profiles, clientSearch]);

  const filteredNotices = useMemo(() => {
    const term = noticeSearch.trim().toLowerCase();
    return notices.filter((notice) => {
      const profile = profileMap[notice.user_id] || {};
      if (!term) return true;
      return [notice.title, notice.message, profile.store_name, profile.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [notices, noticeSearch, profileMap]);

  const activeCount = notices.filter((notice) => notice.active).length;

  const loadNotices = async () => {
    setLoading(true);
    const response = await adminLicenseService.getRemoteNotices();
    setLoading(false);

    if (response.success) {
      setNotices(response.data);
    } else {
      Swal.fire("Error", response.error || "No se pudieron cargar los avisos.", "error");
    }
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setSelectedClientIds([]);
    setClientSearch("");
  };

  const toggleClient = (clientId) => {
    if (form.id) return;
    setSelectedClientIds((current) => (
      current.includes(clientId)
        ? current.filter((id) => id !== clientId)
        : [...current, clientId]
    ));
  };

  const selectVisibleClients = () => {
    if (form.id) return;
    setSelectedClientIds(filteredProfiles.map((profile) => profile.id));
  };

  const clearClientSelection = () => {
    if (form.id) return;
    setSelectedClientIds([]);
  };

  const handleEdit = (notice) => {
    setForm({
      id: notice.id,
      notice_key: notice.notice_key,
      title: notice.title || "",
      message: notice.message || "",
      openEvent: Array.isArray(notice.events) && notice.events.includes("abrir_caja"),
      closeEvent: Array.isArray(notice.events) && notice.events.includes("cerrar_caja"),
      active: notice.active === true,
      starts_at: toDatetimeLocal(notice.starts_at),
      ends_at: toDatetimeLocal(notice.ends_at),
      button_text: notice.button_text || "",
      button_url: notice.button_url || "",
    });
    setSelectedClientIds([notice.user_id]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateForm = () => {
    if (selectedClientIds.length === 0) return "Selecciona al menos un cliente.";
    if (!form.title.trim()) return "El título es obligatorio.";
    if (!form.message.trim()) return "El mensaje es obligatorio.";
    if (!form.openEvent && !form.closeEvent) return "Selecciona al menos un evento.";
    if ((form.button_text.trim() && !form.button_url.trim()) || (!form.button_text.trim() && form.button_url.trim())) {
      return "Completa texto y URL del botón, o deja ambos vacíos.";
    }
    return null;
  };

  const buildPayload = (userId) => ({
    id: form.id,
    user_id: userId,
    notice_key: form.notice_key || createNoticeKey(userId),
    title: form.title.trim(),
    message: form.message.trim(),
    events: [
      ...(form.openEvent ? ["abrir_caja"] : []),
      ...(form.closeEvent ? ["cerrar_caja"] : []),
    ],
    active: form.active,
    starts_at: fromDatetimeLocal(form.starts_at),
    ends_at: fromDatetimeLocal(form.ends_at),
    button_text: form.button_text.trim() || null,
    button_url: form.button_url.trim() || null,
  });

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      Swal.fire("Falta información", validationError, "warning");
      return;
    }

    setSaving(true);
    const targets = form.id ? selectedClientIds.slice(0, 1) : selectedClientIds;
    const results = [];

    for (const clientId of targets) {
      const response = await adminLicenseService.saveRemoteNotice(buildPayload(clientId), masterPin);
      results.push(response);
    }

    setSaving(false);

    const failed = results.filter((result) => !result.success);
    if (failed.length > 0) {
      Swal.fire("Error", failed[0].error || "No se pudo guardar uno de los avisos.", "error");
      return;
    }

    await loadNotices();
    resetForm();
    Swal.fire("Guardado", targets.length === 1 ? "Aviso guardado correctamente." : `${targets.length} avisos guardados correctamente.`, "success");
  };

  const handleToggle = async (notice) => {
    const response = await adminLicenseService.toggleRemoteNotice(notice.id, !notice.active, masterPin);
    if (response.success) {
      setNotices((current) => current.map((item) => item.id === notice.id ? response.data : item));
    } else {
      Swal.fire("Error", response.error || "No se pudo actualizar el aviso.", "error");
    }
  };

  const handleDelete = async (notice) => {
    const profile = profileMap[notice.user_id];
    const result = await Swal.fire({
      title: "Eliminar aviso",
      html: `Se eliminará el aviso de <b>${profile?.store_name || "cliente sin nombre"}</b>.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    const response = await adminLicenseService.deleteRemoteNotice(notice.id, masterPin);
    if (response.success) {
      setNotices((current) => current.filter((item) => item.id !== notice.id));
      if (form.id === notice.id) resetForm();
      Swal.fire("Eliminado", "El aviso fue eliminado.", "success");
    } else {
      Swal.fire("Error", response.error || "No se pudo eliminar el aviso.", "error");
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(360px,420px)_1fr] gap-6 mt-6">
      <section className="bg-white shadow sm:rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{form.id ? "Editar aviso" : "Nuevo aviso"}</h3>
            <p className="text-xs text-gray-500 mt-1">Los cambios se aplican sin publicar otra versión.</p>
          </div>
          {form.id && (
            <button onClick={resetForm} className="text-xs font-semibold text-slate-600 border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-100">
              Nuevo
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Título</label>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Licencia próxima a vencer"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mensaje</label>
            <textarea
              value={form.message}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={form.openEvent} onChange={(event) => setForm((current) => ({ ...current, openEvent: event.target.checked }))} />
              Abrir caja
            </label>
            <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={form.closeEvent} onChange={(event) => setForm((current) => ({ ...current, closeEvent: event.target.checked }))} />
              Cerrar caja
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Activo desde</label>
              <input type="datetime-local" value={form.starts_at} onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Activo hasta</label>
              <input type="datetime-local" value={form.ends_at} onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Texto botón</label>
              <input value={form.button_text} onChange={(event) => setForm((current) => ({ ...current, button_text: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">URL botón</label>
              <input value={form.button_url} onChange={(event) => setForm((current) => ({ ...current, button_url: event.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" placeholder="https://wa.me/..." />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
            Aviso activo
          </label>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-800">Clientes</p>
                <p className="text-xs text-gray-500">{selectedClientIds.length} seleccionados</p>
              </div>
              {!form.id && (
                <div className="flex gap-2">
                  <button onClick={selectVisibleClients} className="text-xs text-blue-700 font-semibold">Todos visibles</button>
                  <button onClick={clearClientSelection} className="text-xs text-gray-500 font-semibold">Limpiar</button>
                </div>
              )}
            </div>
            <div className="p-3 border-b border-gray-100">
              <input
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                placeholder="Buscar cliente..."
                disabled={Boolean(form.id)}
              />
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100">
              {filteredProfiles.map((profile) => (
                <label key={profile.id} className={`flex items-start gap-3 px-3 py-2 text-sm ${form.id ? "cursor-not-allowed bg-gray-50" : "cursor-pointer hover:bg-blue-50"}`}>
                  <input
                    type="checkbox"
                    checked={selectedClientIds.includes(profile.id)}
                    onChange={() => toggleClient(profile.id)}
                    disabled={Boolean(form.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-gray-800 truncate">{profile.store_name || "Sin nombre"}</span>
                    <span className="block text-xs text-gray-500 truncate">{profile.email || profile.full_name || profile.id}</span>
                  </span>
                </label>
              ))}
              {filteredProfiles.length === 0 && <div className="px-3 py-6 text-center text-sm text-gray-500">No hay clientes con ese filtro.</div>}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg shadow-sm"
          >
            {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear aviso"}
          </button>
        </div>
      </section>

      <section className="bg-white shadow sm:rounded-lg border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Avisos configurados</h3>
            <p className="text-xs text-gray-500 mt-1">{activeCount} activos de {notices.length} avisos</p>
          </div>
          <div className="flex gap-2">
            <input value={noticeSearch} onChange={(event) => setNoticeSearch(event.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white" placeholder="Buscar aviso..." />
            <button onClick={loadNotices} className="px-3 py-2 text-sm font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50">
              Actualizar
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {loading && <div className="p-8 text-center text-sm text-gray-500">Cargando avisos...</div>}
          {!loading && filteredNotices.map((notice) => {
            const profile = profileMap[notice.user_id] || {};
            return (
              <article key={notice.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${notice.active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                        {notice.active ? "Activo" : "Inactivo"}
                      </span>
                      {(notice.events || []).map((eventName) => (
                        <span key={eventName} className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                          {eventName === "abrir_caja" ? "Abrir caja" : "Cerrar caja"}
                        </span>
                      ))}
                    </div>
                    <h4 className="text-base font-bold text-gray-900">{notice.title}</h4>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{notice.message}</p>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-500">
                      <span><b>Cliente:</b> {profile.store_name || "Sin nombre"}</span>
                      <span><b>Email:</b> {profile.email || "N/A"}</span>
                      <span><b>Desde:</b> {notice.starts_at ? new Date(notice.starts_at).toLocaleString() : "Sin inicio"}</span>
                      <span><b>Hasta:</b> {notice.ends_at ? new Date(notice.ends_at).toLocaleString() : "Sin vencimiento"}</span>
                      {notice.button_url && <span className="md:col-span-2"><b>Botón:</b> {notice.button_text} - {notice.button_url}</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap lg:flex-col gap-2 lg:w-36">
                    <button onClick={() => handleEdit(notice)} className="px-3 py-2 text-sm font-semibold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">
                      Editar
                    </button>
                    <button onClick={() => handleToggle(notice)} className={`px-3 py-2 text-sm font-semibold rounded-lg border ${notice.active ? "border-gray-300 text-gray-700 hover:bg-gray-100" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                      {notice.active ? "Apagar" : "Activar"}
                    </button>
                    <button onClick={() => handleDelete(notice)} className="px-3 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50">
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {!loading && filteredNotices.length === 0 && (
            <div className="p-8 text-center text-sm text-gray-500">No hay avisos con ese filtro.</div>
          )}
        </div>
      </section>
    </div>
  );
};
