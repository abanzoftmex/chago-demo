import { useState } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import ProtectedRoute from "../../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../../context/AuthContext";
import RecurringExpenseForm from "../../../../components/forms/RecurringExpenseForm";

const CreateRecurringExpense = () => {
  const router = useRouter();
  const { checkPermission } = useAuth();

  // Check permissions
  const canManageTransactions = checkPermission("canManageTransactions");

  if (!canManageTransactions) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Sin permisos
            </h2>
            <p className="text-gray-600">
              No tienes permisos para gestionar salidas recurrentes.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const handleSuccess = (result) => {
    // Redirect to recurring expenses list
    router.push("/admin/transacciones/recurrentes");
  };

  const handleCancel = () => {
    router.push("/admin/transacciones/recurrentes");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Crear Salida Recurrente
            </h1>
            <p className="text-gray-600 mt-1">
              Configura una salida que se generará automáticamente según la frecuencia seleccionada
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Volver a Lista
          </button>
        </div>

        {/* Form */}
        <div >
          <RecurringExpenseForm 
            onSuccess={handleSuccess}
            className="bg-white rounded-lg shadow-sm border p-6"
          />
        </div>

        {/* Info section */}
        <div className=" bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Información sobre frecuencias
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-800">📅 Diario</h4>
                <p className="text-sm text-gray-600">
                  Se genera una transacción todos los días a medianoche.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">📅 Semanal</h4>
                <p className="text-sm text-gray-600">
                  Se genera una transacción todos los lunes a medianoche.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-800">📅 Quincenal</h4>
                <p className="text-sm text-gray-600">
                  Se genera una transacción el día 15 y el penúltimo día de cada mes a medianoche.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800">📅 Mensual</h4>
                <p className="text-sm text-gray-600">
                  Se genera una transacción el primer día de cada mes a medianoche.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-900 mb-1">Importante</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Las transacciones se generan automáticamente usando un cron job diario</li>
                  <li>• Puedes activar/desactivar salidas recurrentes en cualquier momento</li>
                  <li>• Las salidas se crean como "pendientes" para ser revisados antes del pago</li>
                  <li>• La fecha de inicio determina desde cuándo empezar a generar las transacciones</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

const CreateRecurringExpenseWithAuth = () => {
  return (
    <ProtectedRoute>
      <CreateRecurringExpense />
    </ProtectedRoute>
  );
};

export default CreateRecurringExpenseWithAuth;
