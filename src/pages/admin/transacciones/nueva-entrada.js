import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import TransactionForm from "../../../components/forms/TransactionForm";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../context/AuthContextMultiTenant";
import { useToast } from "../../../components/ui/Toast";

const NuevaEntrada = () => {
  const router = useRouter();
  const { checkPermission } = useAuth();
  const toast = useToast();

  // Check permissions based on user role
  const canManageTransactions = checkPermission("canManageTransactions");

  const handleSuccess = () => {
    toast.success("Entrada creada exitosamente");
    router.push("/admin/transacciones/entradas");
  };

  const handleCancel = () => {
    router.push("/admin/transacciones/entradas");
  };

  if (!canManageTransactions) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Acceso Denegado
              </h2>
              <p className="text-gray-600 mb-6">
                No tienes permisos para crear transacciones.
              </p>
              <button
                onClick={() => router.push("/admin/dashboard")}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Volver al Dashboard
              </button>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="px-8">
            {/* Cabecera consistente (fondo verde claro para entradas) */}
            <div className="rounded-lg border border-green-200 overflow-hidden mb-6">
              <div className="flex items-center justify-between px-6 py-4 bg-green-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/70 rounded-lg text-green-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-green-800">
                      Nueva Entrada
                    </h1>
                    <p className="text-sm text-green-700/80 mt-0.5">
                      Registra una nueva entrada en el sistema
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-green-300 rounded-md text-sm font-medium text-green-800 bg-white hover:bg-green-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Volver
                </button>
              </div>
            </div>

            {/* Transaction Form */}
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-6">
                <TransactionForm
                  type="entrada"
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                  className="max-w-none"
                />
              </div>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default NuevaEntrada;
