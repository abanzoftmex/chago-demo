import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import { settingsService } from "../../../lib/services/settingsService";
import { useToast } from "../../../components/ui/Toast";

const CorreosNotificacion = () => {
  const [adminInput, setAdminInput] = useState("");
  const [accountantInput, setAccountantInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { adminEmails, accountantEmails } =
          await settingsService.getEmails();
        setAdminInput((adminEmails || []).join(", "));
        setAccountantInput((accountantEmails || []).join(", "));
      } catch (error) {
        console.error(error);
        toast.error(error.message || "Error al cargar configuración");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const parseEmails = (value) =>
    value
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await settingsService.saveEmails({
        adminEmails: parseEmails(adminInput),
        accountantEmails: parseEmails(accountantInput),
      });
      toast.success("Correos actualizados");
    } catch (error) {
      toast.error(error.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Correos de notificación"
      breadcrumbs={[
        { name: "Dashboard", href: "/admin/dashboard" },
        { name: "Configuración" },
        { name: "Correos de notificación" },
      ]}
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Correos de notificación
          </h2>
          <p className="text-gray-600 mt-1">
            Puedes ingresar varios correos en cada campo, separados por coma o
            salto de línea.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correos del administrador
              </label>
              <textarea
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                placeholder="admin@dominio.com, otro@dominio.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separar por coma o en varias líneas.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correos del contador
              </label>
              <textarea
                value={accountantInput}
                onChange={(e) => setAccountantInput(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                placeholder="contador@dominio.com, otro@dominio.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separar por coma o en varias líneas.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-md disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Toasts se muestran globalmente desde AdminLayout */}
    </AdminLayout>
  );
};

export default CorreosNotificacion;
