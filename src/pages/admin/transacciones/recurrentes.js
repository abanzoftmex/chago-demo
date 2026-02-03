import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import Switch from "../../../components/ui/Switch";
import RecurringExpenseDetailsModal from "../../../components/forms/RecurringExpenseDetailsModal";
import { recurringExpenseService } from "../../../lib/services/recurringExpenseService";
import { conceptService } from "../../../lib/services/conceptService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { providerService } from "../../../lib/services/providerService";
import { generalService } from "../../../lib/services/generalService";
import { 
  ArrowPathIcon,
  PlusIcon,
  EyeIcon,
  TrashIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

const GastosRecurrentes = () => {
  const router = useRouter();
  const { checkPermission } = useAuth();
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [togglingExpense, setTogglingExpense] = useState(null);
  const toast = useToast();

  // Check permissions
  const canManageTransactions = checkPermission("canManageTransactions");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [expensesData, conceptsData, subconceptsData, providersData, generalsData] = await Promise.all([
        recurringExpenseService.getAll(),
        conceptService.getAll(),
        subconceptService.getAll(),
        providerService.getAll(),
        generalService.getAll(),
      ]);
      
      setRecurringExpenses(expensesData);
      setConcepts(conceptsData);
      setSubconcepts(subconceptsData);
      setProviders(providersData);
      setGenerals(generalsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getConceptName = (conceptId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    return concept ? concept.name : "N/A";
  };

  const getSubconceptName = (subconceptId) => {
    const subconcept = subconcepts.find((s) => s.id === subconceptId);
    return subconcept ? subconcept.name : "N/A";
  };

  const getProviderName = (providerId) => {
    if (!providerId) return "N/A";
    const provider = providers.find((p) => p.id === providerId);
    return provider ? provider.name : "N/A";
  };

  const getGeneralName = (generalId) => {
    const general = generals.find((g) => g.id === generalId);
    return general ? general.name : "N/A";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const handleToggleActive = async (expenseId, currentStatus) => {
    // Si se va a desactivar, mostrar confirmación
    if (currentStatus) {
      const confirmed = confirm(
        "¿Estás seguro de que deseas desactivar este gasto recurrente?\n\n" +
        "⚠️ Esto eliminará todas las transacciones futuras generadas por este gasto recurrente.\n" +
        "Las transacciones del mes actual y anteriores se mantendrán."
      );
      
      if (!confirmed) {
        return;
      }
    }

    try {
      setTogglingExpense(expenseId);
      const newStatus = await recurringExpenseService.toggleActive(expenseId);
      setRecurringExpenses(prev => 
        prev.map(expense => 
          expense.id === expenseId 
            ? { ...expense, isActive: newStatus }
            : expense
        )
      );
      
      if (newStatus) {
        toast.success("Gasto recurrente activado exitosamente");
      } else {
        toast.success("Gasto recurrente desactivado y transacciones futuras eliminadas");
      }
    } catch (error) {
      console.error("Error toggling expense:", error);
      toast.error("Error al cambiar el estado del gasto");
    } finally {
      setTogglingExpense(null);
    }
  };

  const handleViewDetails = (expense) => {
    setSelectedExpense(expense);
    setShowDetailsModal(true);
  };

  const handleCloseDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedExpense(null);
  };

  const handleShowDetails = (expense) => {
    setSelectedExpense(expense);
    setShowDetailsModal(true);
  };

  const handleDelete = async (expenseId) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este gasto recurrente?")) {
      return;
    }

    try {
      await recurringExpenseService.delete(expenseId);
      setRecurringExpenses(prev => prev.filter(expense => expense.id !== expenseId));
      toast.success("Gasto recurrente eliminado exitosamente");
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error("Error al eliminar el gasto recurrente");
    }
  };

  const filteredExpenses = recurringExpenses.filter((expense) => {
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      const conceptName = getConceptName(expense.conceptId).toLowerCase();
      const subconceptName = getSubconceptName(expense.subconceptId).toLowerCase();
      const providerName = getProviderName(expense.providerId).toLowerCase();
      const generalName = getGeneralName(expense.generalId).toLowerCase();
      const description = (expense.description || "").toLowerCase();
      
      return (
        conceptName.includes(query) ||
        subconceptName.includes(query) ||
        providerName.includes(query) ||
        generalName.includes(query) ||
        description.includes(query)
      );
    }
    return true;
  });

  const activeExpenses = filteredExpenses.filter(e => e.isActive);
  const inactiveExpenses = filteredExpenses.filter(e => !e.isActive);

  return (
    <ProtectedRoute>
      <AdminLayout
        title="Gastos Recurrentes"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Transacciones" },
          { name: "Gastos Recurrentes" },
        ]}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-50 to-pink-50 rounded-xl p-6 border border-rose-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-rose-400 rounded-xl shadow-lg">
                  <ArrowPathIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Gastos Recurrentes</h1>
                  <p className="text-gray-600 mt-1">
                    Gestiona los gastos que se generan automáticamente según la frecuencia configurada
                  </p>
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    {activeExpenses.length} activos, {inactiveExpenses.length} inactivos
                  </div>
                </div>
              </div>
              {canManageTransactions && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => router.push('/admin/transacciones/recurrentes/nuevo')}
                    className="px-6 py-3 bg-rose-400 text-white rounded-xl hover:bg-rose-500 focus:ring-4 focus:ring-rose-400/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  ><PlusIcon className="h-4 w-4 mr-1.5" />
                    Nuevo Gasto Recurrente
                  </button>
                </div>
              )}
            </div>
          </div>



          {/* Search and Filters */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-rose-400 rounded-lg">
                    <ArrowPathIcon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Lista de Gastos Recurrentes</h3>
                    <p className="text-sm text-gray-600">
                      {filteredExpenses.length} gastos configurados
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {activeExpenses.length} Activos
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {inactiveExpenses.length} Inactivos
                    </span>
                  </div>
                  <div className="w-full md:w-80">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por concepto, proveedor, descripción..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent text-sm"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="max-w-sm mx-auto">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-rose-400 mx-auto"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-rose-400 rounded-full opacity-20"></div>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-4 font-medium">Cargando gastos recurrentes...</p>
                  <p className="text-gray-500 text-sm mt-1">Por favor espera un momento</p>
                </div>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="p-12 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay gastos recurrentes</h3>
                  <p className="text-gray-600 mb-6">
                    Crea tu primer gasto recurrente con la frecuencia que necesites: diaria, semanal, quincenal o mensual
                  </p>
                  <button
                    onClick={() => router.push('/admin/transacciones/recurrentes/nuevo')}
                    className="inline-flex items-center px-6 py-3 bg-rose-400 text-white rounded-xl hover:bg-rose-500 focus:ring-4 focus:ring-rose-400/20 transition-all duration-200 font-medium shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Crear primer gasto recurrente
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Estado</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">General</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Concepto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Subconcepto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Proveedor</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Frecuencia</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">División</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-border">
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-muted/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <Switch
                                enabled={expense.isActive}
                                onChange={() => handleToggleActive(expense.id, expense.isActive)}
                                loading={togglingExpense === expense.id}
                                size="sm"
                                disabled={!canManageTransactions}
                              />
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                expense.isActive 
                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                  : 'bg-gray-100 text-gray-800 border border-gray-200'
                              }`}>
                                {expense.isActive ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {getGeneralName(expense.generalId)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {getConceptName(expense.conceptId)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {getSubconceptName(expense.subconceptId)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            {getProviderName(expense.providerId)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              expense.frequency === 'daily' ? 'bg-purple-100 text-purple-800' :
                              expense.frequency === 'weekly' ? 'bg-blue-100 text-blue-800' :
                              expense.frequency === 'biweekly' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {
                              expense.frequency === 'daily' ? ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /> <span>Diario</span></div> ) :
                              expense.frequency === 'weekly' ? ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /><span>Semanal</span></div> ) :
                              expense.frequency === 'biweekly' ? ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /><span>Quincenal</span></div> ) :
                                ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /><span>Mensual</span></div> )
                              }
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            <span className="capitalize">{expense.division?.replace('_', ' ')}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleViewDetails(expense)}
                                title="Ver detalles de recurrente"
                                className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors"
                              >
                                 <EyeIcon className="h-4 w-4" />
                              </button>
                              {canManageTransactions && (
                                <button
                                  onClick={() => handleDelete(expense.id)}
                                  title="Eliminar recurrente"
                                  className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-border">
                  {filteredExpenses.map((expense) => (
                    <div key={expense.id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                expense.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {expense.isActive ? 'Activo' : 'Inactivo'}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-600">
                                Recurrente
                              </span>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                expense.frequency === 'daily' ? 'bg-purple-100 text-purple-800' :
                                expense.frequency === 'weekly' ? 'bg-blue-100 text-blue-800' :
                                expense.frequency === 'biweekly' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {
                                expense.frequency === 'daily' ? ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /> <span>Diario</span></div> ) :
                                expense.frequency === 'weekly' ? ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /><span>Semanal</span></div> ) :
                                expense.frequency === 'biweekly' ? ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /><span>Quincenal</span></div> ) :
                                ( <div className="flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /><span>Mensual</span></div> )
                                }
                              </span>
                            </div>
                            <Switch
                              enabled={expense.isActive}
                              onChange={() => handleToggleActive(expense.id, expense.isActive)}
                              loading={togglingExpense === expense.id}
                              size="sm"
                              disabled={!canManageTransactions}
                            />
                          </div>
                          <p className="text-sm font-medium text-foreground">
                            {getConceptName(expense.conceptId)} - {getSubconceptName(expense.subconceptId)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {getProviderName(expense.providerId)}
                          </p>
                          {expense.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {expense.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(expense.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {expense.division?.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-muted-foreground">
                          {getGeneralName(expense.generalId)}
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(expense)}
                            className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors"
                          >
                             <EyeIcon className="h-4 w-4" />
                          </button>
                          {canManageTransactions && (
                            <button
                              onClick={() => handleDelete(expense.id)}
                              className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Details Modal */}
        {selectedExpense && (
          <RecurringExpenseDetailsModal
            expense={selectedExpense}
            isOpen={showDetailsModal}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedExpense(null);
            }}
            conceptName={getConceptName(selectedExpense.conceptId)}
            subconceptName={getSubconceptName(selectedExpense.subconceptId)}
            providerName={getProviderName(selectedExpense.providerId)}
          />
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default GastosRecurrentes;