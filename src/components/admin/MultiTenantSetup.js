/**
 * Componente de configuracion inicial del sistema multi-tenant
 * Panel de administracion para crear, listar y actualizar tenants
 * Protegido por contrasena maestra (TENANT_SETUP_PASSWORD)
 */

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContextMultiTenant";
import { db } from "../../lib/firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { createNewTenant } from "../../lib/helpers/migrationHelper";

const tabs = [
  { id: "crear", label: "Nuevo tenant", caption: "Provisiona una nueva cuenta" },
  { id: "tenants", label: "Directorio", caption: "Consulta y actualiza tenants" },
];

const metricCards = [
  {
    key: "total",
    label: "Tenants activos",
    description: "Empresas disponibles en la instancia",
  },
  {
    key: "recent",
    label: "Alta reciente",
    description: "Creado en los ultimos 30 dias",
  },
  {
    key: "owners",
    label: "Admins con correo",
    description: "Registros listos para acceso",
  },
];

const cardClassName =
  "rounded-[28px] border border-white/70 bg-white/80 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl";

const inputClassName =
  "w-full rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5";

const buttonBaseClassName =
  "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition duration-200 focus:outline-none focus:ring-4 focus:ring-slate-900/10 disabled:cursor-not-allowed disabled:opacity-50";

const formatCreatedAt = (date) => {
  if (!date) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getMessageTone = (message) => {
  if (!message) return null;
  return message.startsWith("OK:") ? "success" : "error";
};

const getTenantInitials = (name) =>
  (name || "Tenant")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

const Spinner = ({ light = false, size = "h-4 w-4" }) => (
  <svg
    className={`animate-spin ${size} ${light ? "text-white" : "text-slate-500"}`}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      className="opacity-20"
    />
    <path
      d="M22 12a10 10 0 0 0-10-10"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      className="opacity-90"
    />
  </svg>
);

const TenantEditModal = ({ tenant, onClose, onSave, saving }) => {
  const [formData, setFormData] = useState({
    nombreEmpresa: tenant?.nombreEmpresa || "",
    adminName: tenant?.adminName === "—" ? "" : tenant?.adminName || "",
    adminEmail: tenant?.adminEmail === "—" ? "" : tenant?.adminEmail || "",
  });
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.nombreEmpresa.trim() || !formData.adminEmail.trim()) {
      setError("El nombre de la empresa y el correo del administrador son obligatorios.");
      return;
    }

    const result = await onSave({
      tenantId: tenant.id,
      ownerUid: tenant.ownerUid,
      nombreEmpresa: formData.nombreEmpresa.trim(),
      adminName: formData.adminName.trim(),
      adminEmail: formData.adminEmail.trim(),
    });

    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 px-4 backdrop-blur-md">
      <div className={`${cardClassName} w-full max-w-2xl p-6 sm:p-8`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Editar tenant</p>
            <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              Actualizar datos del tenant
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              El correo del admin se actualiza con cuenta de servicio sin cambiar el UID del
              usuario.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Empresa
            </label>
            <input
              type="text"
              name="nombreEmpresa"
              value={formData.nombreEmpresa}
              onChange={handleChange}
              className={inputClassName}
              placeholder="Nombre comercial"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Nombre del admin
              </label>
              <input
                type="text"
                name="adminName"
                value={formData.adminName}
                onChange={handleChange}
                className={inputClassName}
                placeholder="Nombre para mostrar"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Correo del admin
              </label>
              <input
                type="email"
                name="adminEmail"
                value={formData.adminEmail}
                onChange={handleChange}
                className={inputClassName}
                placeholder="admin@empresa.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-slate-500">
              Si el nuevo correo ya existe en otro usuario, el sistema bloqueara la actualizacion.
            </p>
            <button
              type="submit"
              disabled={saving}
              className={`${buttonBaseClassName} bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800`}
            >
              {saving ? (
                <>
                  <Spinner light />
                  Guardando cambios
                </>
              ) : (
                "Guardar cambios"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MultiTenantSetup = () => {
  const { user } = useAuth();

  const [sessionChecking, setSessionChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [accessError, setAccessError] = useState("");
  const [accessLoading, setAccessLoading] = useState(false);

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("crear");
  const [message, setMessage] = useState("");
  const [editingTenant, setEditingTenant] = useState(null);
  const [savingTenant, setSavingTenant] = useState(false);

  const [tenantForm, setTenantForm] = useState({
    ownerEmail: "",
    ownerPassword: "",
    ownerName: "",
    nombreEmpresa: "",
  });

  useEffect(() => {
    const checkSession = async () => {
      setSessionChecking(true);
      try {
        const response = await fetch("/api/admin/setup-session");
        const data = await response.json();
        setIsAuthenticated(Boolean(data.authorized));
      } catch (error) {
        console.error("Error validando sesión de setup:", error);
        setIsAuthenticated(false);
      } finally {
        setSessionChecking(false);
      }
    };

    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadTenants();
    }
  }, [isAuthenticated]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const recentThreshold = 1000 * 60 * 60 * 24 * 30;

    return {
      total: tenants.length,
      recent: tenants.filter(
        (tenant) => tenant.createdAt && now - tenant.createdAt.getTime() <= recentThreshold
      ).length,
      owners: tenants.filter((tenant) => tenant.adminEmail && tenant.adminEmail !== "—").length,
    };
  }, [tenants]);

  const messageTone = getMessageTone(message);

  const handleAccessSubmit = async (event) => {
    event.preventDefault();
    setAccessLoading(true);
    setAccessError("");

    try {
      const response = await fetch("/api/admin/verify-setup-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: accessPassword }),
      });

      const data = await response.json();

      if (response.ok && data.authorized) {
        setIsAuthenticated(true);
        setAccessPassword("");
      } else {
        setAccessError(data.message || "Contrasena incorrecta");
      }
    } catch (error) {
      setAccessError("Error al verificar la contrasena. Intenta de nuevo.");
    } finally {
      setAccessLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/setup-session", { method: "DELETE" });
    } catch (error) {
      console.error("Error cerrando sesión de setup:", error);
    } finally {
      setIsAuthenticated(false);
      setEditingTenant(null);
      setAccessPassword("");
    }
  };

  const loadTenants = async () => {
    setLoading(true);
    try {
      const tenantsRef = collection(db, "tenants");
      const tenantsSnap = await getDocs(tenantsRef);
      const tenantsList = [];

      for (const tenantDoc of tenantsSnap.docs) {
        const tenantData = tenantDoc.data();

        let adminEmail = "—";
        let adminName = "—";
        let adminUid = tenantData.ownerUid || "";

        try {
          const membersRef = collection(db, `tenants/${tenantDoc.id}/members`);
          const membersSnap = await getDocs(membersRef);
          const adminMember = membersSnap.docs.find((member) => member.data().role === "admin");

          if (adminMember) {
            const memberData = adminMember.data();
            adminUid = adminMember.id;
            adminEmail = memberData.email || "—";
            adminName = memberData.displayName || memberData.email || "—";
          }
        } catch (err) {
          console.error("Error obteniendo miembros:", err);
        }

        tenantsList.push({
          id: tenantDoc.id,
          ownerUid: adminUid,
          nombreEmpresa: tenantData.nombreEmpresa || "Sin nombre",
          adminEmail,
          adminName,
          createdAt: tenantData.createdAt?.toDate?.() || null,
        });
      }

      tenantsList.sort((a, b) => {
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt - a.createdAt;
      });

      setTenants(tenantsList);
    } catch (error) {
      console.error("Error cargando tenants:", error);
      setMessage(`ERROR: Error cargando tenants: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (
      !tenantForm.ownerEmail ||
      !tenantForm.ownerPassword ||
      !tenantForm.ownerName ||
      !tenantForm.nombreEmpresa
    ) {
      setMessage("ERROR: Todos los campos son obligatorios.");
      return;
    }

    if (tenantForm.ownerPassword.length < 6) {
      setMessage("ERROR: La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const result = await createNewTenant(
        tenantForm.ownerEmail,
        tenantForm.ownerPassword,
        tenantForm.ownerName,
        tenantForm.nombreEmpresa
      );

      if (result.success) {
        setMessage(
          `OK: Tenant creado correctamente.\nID: ${result.tenantId}\nAdmin: ${result.user.email}\nEmpresa: ${result.nombreEmpresa}`
        );
        setTenantForm({
          ownerEmail: "",
          ownerPassword: "",
          ownerName: "",
          nombreEmpresa: "",
        });
        loadTenants();
      } else {
        setMessage(`ERROR: ${result.error}`);
      }
    } catch (error) {
      setMessage(`ERROR: Error inesperado: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTenantUpdate = async (payload) => {
    setSavingTenant(true);

    try {
      const response = await fetch("/api/admin/update-tenant-setup", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setIsAuthenticated(false);
          return { error: data.message || "La sesión de configuración expiró." };
        }

        return { error: data.message || "No se pudo actualizar el tenant." };
      }

      setEditingTenant(null);
      setMessage(
        `OK: Tenant actualizado correctamente.\nEmpresa: ${payload.nombreEmpresa}\nAdmin: ${payload.adminEmail}`
      );
      await loadTenants();
      return { success: true };
    } catch (error) {
      return { error: "Error de conexión al actualizar el tenant." };
    } finally {
      setSavingTenant(false);
    }
  };

  const renderAccessScreen = () => (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f1ea] px-4 py-10 text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.14),_transparent_26%)]" />
      <div className="absolute inset-x-0 top-0 h-48 bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0))]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Tenant Control Room
          </div>

          <div className="max-w-2xl space-y-6">
            <h1 className="text-5xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-6xl">
              Provisiona tenants con una interfaz sobria, precisa y lista para operar.
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Este panel concentra el alta de nuevas empresas, valida el acceso maestro y
              mantiene visible el directorio completo en una sola vista.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className={`${cardClassName} p-5`}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Seguridad</p>
              <p className="mt-3 text-lg font-medium text-slate-900">Acceso protegido</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sesion protegida y persistente por 10 minutos despues del acceso maestro.
              </p>
            </div>
            <div className={`${cardClassName} p-5`}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Alta rapida</p>
              <p className="mt-3 text-lg font-medium text-slate-900">Provision inmediata</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Crea empresa y administrador principal desde el mismo flujo.
              </p>
            </div>
            <div className={`${cardClassName} p-5`}>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Edicion</p>
              <p className="mt-3 text-lg font-medium text-slate-900">Actualizacion visible</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Desde el directorio ahora puedes editar nombre y correo del admin.
              </p>
            </div>
          </div>
        </section>

        <section className={`${cardClassName} p-6 sm:p-8`}>
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.25)]">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 3l7 4v5c0 4.2-2.8 8.07-7 9-4.2-.93-7-4.8-7-9V7l7-4z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.25 12.25L11 14l3.75-4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                Acceso maestro
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Usa la clave configurada en el entorno para abrir el panel de administracion
                de tenants.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              10 min
            </div>
          </div>

          <form onSubmit={handleAccessSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                Contrasena de acceso
              </label>
              <input
                type="password"
                value={accessPassword}
                onChange={(event) => setAccessPassword(event.target.value)}
                className={inputClassName}
                placeholder="Ingresa la clave maestra"
                autoFocus
                required
              />
            </div>

            {accessError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {accessError}
              </div>
            )}

            <button
              type="submit"
              disabled={accessLoading || !accessPassword}
              className={`${buttonBaseClassName} w-full bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800`}
            >
              {accessLoading ? (
                <>
                  <Spinner light />
                  Verificando acceso
                </>
              ) : (
                <>
                  Entrar al panel
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12h14M13 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  );

  const renderSessionChecking = () => (
    <div className="relative min-h-screen overflow-hidden bg-[#f5f1ea] px-4 py-10 text-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_24%),radial-gradient(circle_at_bottom_left,_rgba(14,165,233,0.14),_transparent_26%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center">
        <div className={`${cardClassName} flex items-center gap-4 px-6 py-5 text-slate-600`}>
          <Spinner size="h-5 w-5" />
          Validando sesion de configuracion...
        </div>
      </div>
    </div>
  );

  const renderCreateTab = () => (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <section className={`${cardClassName} p-6 sm:p-8`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Provision</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              Crear tenant
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Genera la empresa, asigna al administrador principal y deja listo el acceso
              inicial desde una sola operacion.
            </p>
          </div>
          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
            Flujo activo
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Nombre de la empresa
            </label>
            <input
              type="text"
              value={tenantForm.nombreEmpresa}
              onChange={(event) =>
                setTenantForm({ ...tenantForm, nombreEmpresa: event.target.value })
              }
              className={inputClassName}
              placeholder="Ej. Casa Valquirico"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Nombre del admin
            </label>
            <input
              type="text"
              value={tenantForm.ownerName}
              onChange={(event) => setTenantForm({ ...tenantForm, ownerName: event.target.value })}
              className={inputClassName}
              placeholder="Nombre completo"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Correo del admin
            </label>
            <input
              type="email"
              value={tenantForm.ownerEmail}
              onChange={(event) =>
                setTenantForm({ ...tenantForm, ownerEmail: event.target.value })
              }
              className={inputClassName}
              placeholder="admin@empresa.com"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Contrasena inicial
            </label>
            <input
              type="password"
              value={tenantForm.ownerPassword}
              onChange={(event) =>
                setTenantForm({ ...tenantForm, ownerPassword: event.target.value })
              }
              className={inputClassName}
              placeholder="Minimo 6 caracteres"
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-slate-200/80 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-slate-500">
            El usuario administrador quedara habilitado para iniciar sesion inmediatamente
            despues de crear el tenant.
          </p>
          <button
            onClick={handleCreateTenant}
            disabled={
              loading ||
              !tenantForm.ownerEmail ||
              !tenantForm.ownerPassword ||
              !tenantForm.ownerName ||
              !tenantForm.nombreEmpresa
            }
            className={`${buttonBaseClassName} bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)] hover:bg-slate-800`}
          >
            {loading ? (
              <>
                <Spinner light />
                Creando tenant
              </>
            ) : (
              <>
                Crear tenant
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
      </section>

      <section className="space-y-6">
        <div className={`${cardClassName} p-6`}>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Checklist</p>
          <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-950">
            Antes de provisionar
          </h4>
          <div className="mt-5 space-y-4">
            {[
              "Confirma el nombre comercial exacto de la empresa.",
              "Verifica el correo del administrador principal.",
              "Define una contrasena temporal de al menos 6 caracteres.",
              "Desde el directorio podras actualizar el correo despues si hace falta.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-white">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12.5l4 4L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-sm leading-6 text-slate-600">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardClassName} overflow-hidden p-6`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Estado actual</p>
              <h4 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-950">
                Vista rapida del entorno
              </h4>
            </div>
            <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white">
              Live
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {metricCards.map((card) => (
              <div
                key={card.key}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
              >
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                  {metrics[card.key]}
                </p>
                <p className="mt-2 text-sm leading-5 text-slate-500">{card.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );

  const renderTenantActions = (tenant) => (
    <button
      onClick={() => setEditingTenant(tenant)}
      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 20h4l10.5-10.5a2.121 2.121 0 10-3-3L5.5 17v3z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Actualizar
    </button>
  );

  const renderTenantsTab = () => (
    <section className={`${cardClassName} overflow-hidden`}>
      <div className="border-b border-slate-200/80 px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Directorio</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950">
              Tenants registrados
            </h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Ahora puedes abrir cada tenant y actualizar empresa, nombre del admin y correo
              del administrador desde aqui.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              {tenants.length} tenant{tenants.length === 1 ? "" : "s"}
            </div>
            <button
              onClick={loadTenants}
              disabled={loading}
              className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
            >
              {loading ? (
                <>
                  <Spinner />
                  Actualizando
                </>
              ) : (
                "Actualizar"
              )}
            </button>
          </div>
        </div>
      </div>

      {loading && tenants.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <Spinner size="h-8 w-8" />
          <p className="mt-4 text-sm text-slate-500">Cargando tenants...</p>
        </div>
      )}

      {!loading && tenants.length === 0 && (
        <div className="px-6 py-20 text-center sm:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 20V10l8-6 8 6v10M9 20v-5h6v5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h4 className="mt-6 text-xl font-semibold tracking-[-0.04em] text-slate-950">
            Aun no hay tenants registrados
          </h4>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Crea el primero desde la pestana de provision para comenzar a operar.
          </p>
        </div>
      )}

      {tenants.length > 0 && (
        <div className="px-4 py-4 sm:px-6 sm:py-6">
          <div className="grid gap-4 xl:hidden">
            {tenants.map((tenant) => (
              <article
                key={tenant.id}
                className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                    {getTenantInitials(tenant.nombreEmpresa)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="truncate text-lg font-semibold text-slate-950">
                          {tenant.nombreEmpresa}
                        </h4>
                        <p className="mt-1 text-sm text-slate-500">{tenant.adminName}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        {formatCreatedAt(tenant.createdAt)}
                      </span>
                    </div>
                    <div className="mt-5 grid gap-3 text-sm text-slate-600">
                      <p>{tenant.adminEmail}</p>
                      <code className="overflow-hidden text-ellipsis rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        {tenant.id}
                      </code>
                      <div className="pt-1">{renderTenantActions(tenant)}</div>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-[24px] border border-slate-200/80 xl:block">
            <table className="min-w-full divide-y divide-slate-200/80 bg-white/95">
              <thead className="bg-slate-50/90">
                <tr>
                  {["Empresa", "Admin", "Correo", "Fecha", "Tenant ID", "Acciones"].map(
                    (header) => (
                      <th
                        key={header}
                        className="px-6 py-4 text-left text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400"
                      >
                        {header}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                          {getTenantInitials(tenant.nombreEmpresa)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-950">{tenant.nombreEmpresa}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                            Empresa
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{tenant.adminName}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{tenant.adminEmail}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {formatCreatedAt(tenant.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <code className="inline-flex max-w-[240px] overflow-hidden text-ellipsis rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        {tenant.id}
                      </code>
                    </td>
                    <td className="px-6 py-4">{renderTenantActions(tenant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );

  if (sessionChecking) {
    return renderSessionChecking();
  }

  if (!isAuthenticated) {
    return renderAccessScreen();
  }

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-[#f6f3ee] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.10),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.12),_transparent_20%),radial-gradient(circle_at_bottom_left,_rgba(45,212,191,0.10),_transparent_22%)]" />
        <div className="absolute inset-x-0 top-0 h-56 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,255,255,0))]" />

        <div className="relative mx-auto max-w-7xl">
          <header className={`${cardClassName} mb-6 overflow-hidden p-6 sm:p-8`}>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Multi-tenant workspace
                </div>
                <h1 className="mt-6 text-4xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-5xl">
                  Centro de control para altas y gestion de tenants.
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Administra el aprovisionamiento, revisa el directorio actual y ahora actualiza
                  el correo del admin del tenant desde este mismo panel.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Sesion</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {user?.email || "Panel autenticado"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Cookie segura con duracion de 10 minutos
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className={`${buttonBaseClassName} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  Cerrar sesion
                </button>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {metricCards.map((card) => (
                <div
                  key={card.key}
                  className="rounded-[24px] border border-slate-200/80 bg-slate-50/80 p-5"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                    {metrics[card.key]}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
                </div>
              ))}
            </div>
          </header>

          <div className="mb-6 flex flex-wrap gap-3">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl border px-5 py-3 text-left transition duration-200 ${
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_30px_rgba(15,23,42,0.18)]"
                      : "border-white/70 bg-white/75 text-slate-700 backdrop-blur-xl hover:border-slate-200 hover:bg-white"
                  }`}
                >
                  <div className="text-sm font-medium">{tab.label}</div>
                  <div
                    className={`mt-1 text-xs ${isActive ? "text-slate-300" : "text-slate-400"}`}
                  >
                    {tab.caption}
                  </div>
                </button>
              );
            })}
          </div>

          {message && (
            <div
              className={`mb-6 rounded-[28px] border px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl ${
                messageTone === "success"
                  ? "border-emerald-200 bg-emerald-50/90 text-emerald-900"
                  : "border-rose-200 bg-rose-50/90 text-rose-900"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="pr-4">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] opacity-60">
                    {messageTone === "success" ? "Operacion exitosa" : "Atencion"}
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-6">
                    {message.replace(/^OK:\s?/, "").replace(/^ERROR:\s?/, "")}
                  </pre>
                </div>
                <button
                  onClick={() => setMessage("")}
                  className="self-start rounded-xl border border-current/15 px-3 py-2 text-sm font-medium hover:bg-white/40"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          <main className="pb-8">
            {activeTab === "crear" && renderCreateTab()}
            {activeTab === "tenants" && renderTenantsTab()}
          </main>

          <footer className="px-1 pb-6 pt-2 text-sm text-slate-500">
            Consulta <span className="font-medium text-slate-700">MULTI_TENANT_GUIDE.md</span>{" "}
            para la guia completa de configuracion y operacion.
          </footer>
        </div>
      </div>

      {editingTenant && (
        <TenantEditModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSave={handleTenantUpdate}
          saving={savingTenant}
        />
      )}
    </>
  );
};

export default MultiTenantSetup;
