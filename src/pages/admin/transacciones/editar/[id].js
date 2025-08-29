import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import TransactionForm from "../../../../components/forms/TransactionForm";
import ProtectedRoute from "../../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../components/ui/Toast";
import { transactionService } from "../../../../lib/services/transactionService";
import { conceptService } from "../../../../lib/services/conceptService";
import { providerService } from "../../../../lib/services/providerService";

const EditTransaction = () => {
  const router = useRouter();
  const { id } = router.query;
  const { checkPermission } = useAuth();
  const [transaction, setTransaction] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Check permissions
  const canManageTransactions = checkPermission("canManageTransactions");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [transactionData, conceptsData, providersData] = await Promise.all([
        transactionService.getById(id),
        conceptService.getAll(),
        providerService.getAll(),
      ]);

      if (!transactionData) {
        toast.error("Transacción no encontrada");
        router.push("/admin/transacciones/salidas");
        return;
      }

      setTransaction(transactionData);
      setConcepts(conceptsData);
      setProviders(providersData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
      router.push("/admin/transacciones/salidas");
    } finally {
      setLoading(false);
    }
  }, [id, router, toast]);

  useEffect(() => {
    if (!canManageTransactions) {
      toast.error("No tienes permisos para editar transacciones");
      router.push("/admin/dashboard");
      return;
    }

    if (id) {
      loadData();
    }
  }, [id, canManageTransactions, router, toast, loadData]);

  const handleTransactionSuccess = (updatedTransaction) => {
    toast.success("Transacción actualizada exitosamente");
    
    // Determinar a qué página regresar basado en el tipo de transacción
    const returnPath = updatedTransaction.type === "entrada" 
      ? "/admin/transacciones/entradas" 
      : "/admin/transacciones/salidas";
    
    router.push(returnPath);
  };

  const handleCancel = () => {
    // Determinar a qué página regresar basado en el tipo de transacción
    const returnPath = transaction?.type === "entrada" 
      ? "/admin/transacciones/entradas" 
      : "/admin/transacciones/salidas";
    
    router.push(returnPath);
  };

  const getTransactionTypeLabel = (type) => {
    return type === "entrada" ? "Ingreso" : "Gasto";
  };

  const getTransactionTypeColor = (type) => {
    return type === "entrada" ? "green" : "red";
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout
          title="Editando Transacción"
          breadcrumbs={[
            { name: "Dashboard", href: "/admin/dashboard" },
            { name: "Transacciones" },
            { name: "Editar" },
          ]}
        >
          <div className="p-12 text-center">
            <div className="max-w-sm mx-auto">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-blue-600 mx-auto"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 bg-blue-600 rounded-full opacity-20"></div>
                </div>
              </div>
              <p className="text-gray-600 mt-4 font-medium">
                Cargando transacción...
              </p>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!transaction) {
    return (
      <ProtectedRoute>
        <AdminLayout
          title="Transacción no encontrada"
          breadcrumbs={[
            { name: "Dashboard", href: "/admin/dashboard" },
            { name: "Transacciones" },
            { name: "Editar" },
          ]}
        >
          <div className="p-12 text-center">
            <div className="max-w-sm mx-auto">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">
                Transacción no encontrada
              </p>
              <button
                onClick={handleCancel}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Volver a Transacciones
              </button>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  const transactionType = transaction.type;
  const typeLabel = getTransactionTypeLabel(transactionType);
  const typeColor = getTransactionTypeColor(transactionType);

  return (
    <ProtectedRoute>
      <AdminLayout
        title={`Editar ${typeLabel}`}
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Transacciones" },
          { 
            name: typeLabel === "Ingreso" ? "Ingresos" : "Gastos", 
            href: typeLabel === "Ingreso" ? "/admin/transacciones/entradas" : "/admin/transacciones/salidas" 
          },
          { name: "Editar" },
        ]}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className={`rounded-xl p-6 border ${
            transactionType === "entrada" 
              ? "bg-gradient-to-r from-green-50 to-green-100 border-green-200" 
              : "bg-gradient-to-r from-red-50 to-red-100 border-red-200"
          }`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-xl shadow-lg ${
                transactionType === "entrada" ? "bg-green-600" : "bg-red-600"
              }`}>
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Editar {typeLabel}
                </h1>
                <p className="text-gray-600 mt-1">
                  Modifica los detalles de esta transacción
                </p>
              </div>
            </div>
          </div>

          {/* Transaction Form */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-6">
              <TransactionForm
                type={transactionType}
                initialData={transaction}
                concepts={concepts}
                providers={providers}
                onSuccess={handleTransactionSuccess}
                onCancel={handleCancel}
              />
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default EditTransaction;
