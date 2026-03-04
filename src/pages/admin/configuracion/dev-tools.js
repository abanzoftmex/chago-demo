import { useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import DeleteTransactionsModal from "../../../components/admin/DeleteTransactionsModal";
import InitialExpenseModal from "../../../components/admin/InitialExpenseModal";
import { transactionService } from "../../../lib/services/transactionService";
import { reportService } from "../../../lib/services/reportService";
import { useAuth } from "../../../context/AuthContextMultiTenant";
import { useToast } from "../../../components/ui/Toast";

const DevTools = () => {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isInitialExpenseModalOpen, setIsInitialExpenseModalOpen] = useState(false);
  const [carryoverResult, setCarryoverResult] = useState(null);
  const [carryoverLoading, setCarryoverLoading] = useState(false);
  const [carryoverStatus, setCarryoverStatus] = useState(null);
  const { user } = useAuth();
  const toast = useToast();

  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return (
      <AdminLayout
        title="Herramientas de Desarrollo"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Configuración" },
          { name: "Herramientas de Desarrollo" },
        ]}
      >
        <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-3xl">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No disponible en producción
            </h2>
            <p className="text-gray-600">
              Las herramientas de desarrollo solo están disponibles en el entorno de desarrollo.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const handleDeleteTransactions = async (year, month, onProgress) => {
    try {
      // Call the service directly with progress callback
      const result = await transactionService.deleteTransactionsByMonth(
        year, 
        month, 
        user, 
        onProgress
      );
      
      if (result.errors.length > 0) {
        toast.warning(`Se eliminaron ${result.deletedCount} de ${result.totalFound} transacciones. ${result.errors.length} errores.`);
      } else {
        toast.success(`Se eliminaron ${result.deletedCount} transacciones exitosamente.`);
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  };

    const handleCarryoverProcess = async () => {
    try {
      setCarryoverLoading(true);
      setCarryoverResult(null);
      
      // Primero obtener el estado actual
      const now = new Date();
      const status = await reportService.getCarryoverInfo(now.getFullYear(), now.getMonth() + 1);
      setCarryoverStatus(status);
      
      if (status.executed) {
        setCarryoverResult({
          success: false,
          message: "El arrastre para este mes ya fue ejecutado",
          data: status.data
        });
        return;
      }
      
      if (!status.canExecute) {
        setCarryoverResult({
          success: false,
          message: "No hay saldo disponible para arrastrar del mes anterior",
          data: status.data
        });
        return;
      }
      
      // Ejecutar el arrastre
      const result = await reportService.processMonthlyCarryover(user);
      setCarryoverResult({
        success: true,
        message: result.message,
        data: result.carryoverData,
        transaction: result.carryoverTransaction
      });
      
      // Actualizar el estado
      const newStatus = await reportService.getCarryoverInfo(now.getFullYear(), now.getMonth() + 1);
      setCarryoverStatus(newStatus);
      
      success("Arrastre mensual procesado exitosamente");
    } catch (err) {
      console.error("Error processing carryover:", err);
      setCarryoverResult({
        success: false,
        message: err.message || "Error al procesar el arrastre mensual",
        data: null
      });
      error(err.message || "Error al procesar el arrastre mensual");
    } finally {
      setCarryoverLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Herramientas de Desarrollo"
      breadcrumbs={[
        { name: "Dashboard", href: "/admin/dashboard" },
        { name: "Configuración" },
        { name: "Herramientas de Desarrollo" },
      ]}
    >
      <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-3xl">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            🛠️ Herramientas de Desarrollo
          </h2>
          <p className="text-gray-600 mt-1">
            Herramientas útiles para desarrollo y testing. Solo disponibles en entorno de desarrollo.
          </p>
        </div>

        {/* Environment indicator */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-yellow-800">Entorno de Desarrollo</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Estas herramientas están diseñadas para facilitar el desarrollo y testing. 
                <strong> No están disponibles en producción.</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Delete Transactions Tool */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="text-3xl">🗑️</div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Eliminar Transacciones por Mes
                </h3>
                <p className="text-gray-600 mt-1 mb-4">
                  Elimina todas las transacciones de un mes específico. Útil para limpiar datos de prueba
                  o resetear un mes durante el desarrollo.
                </p>
                
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-2">
                      <p className="text-sm text-red-800">
                        <strong>Acción irreversible:</strong> Las transacciones eliminadas no se pueden recuperar.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:ring-2 focus:ring-red-500 transition-colors"
                >
                  🗑️ Eliminar Transacciones
                </button>
              </div>
            </div>
          </div>

          {/* Placeholder for future tools */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="text-3xl">�</div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Crear Gasto Inicial
                </h3>
                <p className="text-gray-600 mt-1 mb-4">
                  Crea un gasto inicial sin necesidad de crear entidades en el sistema (general, concepto, subconcepto).
                  Útil para inicializar el sistema con gastos del mes anterior.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-2">
                      <p className="text-sm text-blue-800">
                        <strong>Gasto temporal:</strong> Este gasto usará nombres directos sin crear entidades permanentes en el sistema.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsInitialExpenseModalOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  💰 Crear Gasto Inicial
                </button>
              </div>
            </div>
          </div>

          {/* Monthly Carryover Tool */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="text-3xl">🔄</div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Procesar Arrastre Mensual
                </h3>
                <p className="text-gray-600 mt-1 mb-4">
                  Calcula el saldo del mes anterior (ingresos - gastos pagados) y lo arrastra como ingreso al mes actual.
                  Se debe ejecutar al inicio de cada mes para trasladar el saldo sobrante.
                </p>
                
                <div className="bg-green-50 border border-green-200 rounded p-3 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-2">
                      <p className="text-sm text-green-800">
                        <strong>Proceso automático:</strong> Calcula automáticamente el saldo del mes anterior y crea la transacción de arrastre si es positivo.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-4 w-4 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-2">
                      <p className="text-sm text-yellow-800">
                        <strong>Fecha actual:</strong> 6 de septiembre de 2025 - Se calculará el arrastre de agosto 2025.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleProcessCarryover}
                  disabled={processingCarryover}
                  className={`px-4 py-2 text-white rounded-lg focus:ring-2 transition-colors ${
                    processingCarryover 
                      ? 'bg-gray-400 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                >
                  {processingCarryover ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando...
                    </span>
                  ) : (
                    '🔄 Ejecutar Corte Mensual'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* More tools placeholder */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="text-3xl">�🔧</div>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Más Herramientas
                </h3>
                <p className="text-gray-600 mt-1">
                  Aquí se pueden agregar más herramientas de desarrollo en el futuro.
                </p>
                
                <div className="mt-4 text-sm text-gray-500">
                  Ideas para futuras herramientas:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Reset de gastos recurrentes</li>
                    <li>Generar datos de prueba</li>
                    <li>Exportar/Importar configuración</li>
                    <li>Limpiar logs antiguos</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Transactions Modal */}
      <DeleteTransactionsModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteTransactions}
      />

      {/* Initial Expense Modal */}
      <InitialExpenseModal
        isOpen={isInitialExpenseModalOpen}
        onClose={() => setIsInitialExpenseModalOpen(false)}
        onSuccess={() => {
          // Optional: Add any success handling here
          console.log("Initial expense created successfully");
        }}
      />
    </AdminLayout>
  );
};

export default DevTools;
