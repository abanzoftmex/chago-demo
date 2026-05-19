import { useRouter } from "next/router";
import AdminLayout from "../../../../../components/layout/AdminLayout";
import ProtectedRoute from "../../../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../../../context/AuthContextMultiTenant";
import RecurringExpenseForm from "../../../../../components/forms/RecurringExpenseForm";

const EditRecurringExpense = () => {
  const router = useRouter();
  const { id } = router.query;
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
              No tienes permisos para gestionar transacciones recurrentes.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const handleSuccess = () => {
    router.push("/admin/transacciones/recurrentes");
  };

  const handleCancel = () => {
    router.push("/admin/transacciones/recurrentes");
  };

  if (!id) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center p-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-rose-500"></div>
          <p className="text-gray-500 mt-4">Identificador requerido...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Editar Salida Recurrente
            </h1>
            <p className="text-gray-600 mt-1">
              Modifica los detalles de la salida programada, como el monto, frecuencia o fecha de inicio
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Cancelar
          </button>
        </div>

        {/* Form */}
        <div>
          <RecurringExpenseForm 
            type="salida"
            expenseId={id}
            onSuccess={handleSuccess}
            className="bg-white rounded-lg shadow-sm border p-6"
          />
        </div>
      </div>
    </AdminLayout>
  );
};

const EditRecurringExpenseWithAuth = () => {
  return (
    <ProtectedRoute>
      <EditRecurringExpense />
    </ProtectedRoute>
  );
};

export default EditRecurringExpenseWithAuth;
