import { useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import TransactionForm from "../../../components/forms/TransactionForm";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";

const NuevaSalida = () => {
  const router = useRouter();
  const { checkPermission } = useAuth();
  const toast = useToast();

  // Check permissions based on user role
  const canManageTransactions = checkPermission("canManageTransactions");

  const handleSuccess = () => {
    toast.success("Gasto creado exitosamente");
    // Redirect to the transactions list after successful creation
    router.push("/admin/transacciones/salidas");
  };

  const handleCancel = () => {
    // Go back to the previous page or to transactions list
    router.push("/admin/transacciones/salidas");
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
            {/* Header */}
            <div className="bg-white shadow-sm rounded-lg mb-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      Nueva Salida
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Registra una nueva salida en el sistema
                    </p>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                    Volver
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction Form */}
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-6">
                <TransactionForm
                  type="salida"
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

export default NuevaSalida;
