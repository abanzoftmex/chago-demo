import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import { settingsService } from "../../../lib/services/settingsService";
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../context/AuthContextMultiTenant";

const ConfiguracionLogo = () => {
  const { tenantInfo } = useAuth();
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    settingsService.getLogo(tenantId).then((url) => {
      setCurrentLogoUrl(url);
    }).catch((err) => {
      toast.error(err.message || "Error al cargar el logo");
    }).finally(() => setLoading(false));
  }, [tenantId]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen");
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    if (!tenantId) {
      toast.error("No hay una organización activa. Vuelve a iniciar sesión e inténtalo de nuevo.");
      return;
    }
    try {
      setSaving(true);
      const url = await settingsService.uploadLogo(file, tenantId);
      setCurrentLogoUrl(url);
      setPreview(null);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success("Logo actualizado correctamente");
    } catch (err) {
      toast.error(err.message || "Error al subir el logo");
    } finally {
      setSaving(false);
    }
  };

  const displayLogo = preview || currentLogoUrl;

  return (
    <AdminLayout
      title="Logo"
      breadcrumbs={[
        { name: "Dashboard", href: "/admin/dashboard" },
        { name: "Configuración" },
        { name: "Logo" },
      ]}
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-lg">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Logo del sistema</h2>
          <p className="text-gray-600 mt-1">
            Sube el logo que aparecerá en el menú lateral.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vista previa */}
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-40 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-center overflow-hidden bg-gray-50">
                {displayLogo ? (
                  <img
                    src={displayLogo}
                    alt="Logo actual"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-primary text-white font-bold text-3xl tracking-widest rounded-2xl">
                    EYS
                  </div>
                )}
              </div>
              {preview && (
                <span className="text-xs text-amber-600 font-medium">
                  Vista previa — aún no guardado
                </span>
              )}
            </div>

            {/* Input de archivo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleccionar imagen
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-white
                  hover:file:opacity-90 cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">
                PNG, JPG, SVG o WebP. Recomendado: fondo transparente.
              </p>
            </div>

            {!tenantId && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No se detectó la organización. Cierra sesión y entra de nuevo, o contacta al administrador.
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !file || !tenantId}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-md disabled:opacity-50"
              >
                {saving ? "Subiendo..." : "Guardar logo"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
};

export default ConfiguracionLogo;
