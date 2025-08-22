import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { recurringExpenseService } from "../../../lib/services/recurringExpenseService";
import { conceptService } from "../../../lib/services/conceptService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { providerService } from "../../../lib/services/providerService";
import { generalService } from "../../../lib/services/generalService";

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
  const [generatingTransactions, setGeneratingTransactions] = useState(false);
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
    try {
      await recurringExpenseService.toggleActive(expenseId);
      setRecurringExpenses(prev => 
        prev.map(expense => 
          expense.id === expenseId 
            ? { ...expense, isActive: !currentStatus }
            : expense
        )
      );
      toast.success(`Gasto recurrente ${!currentStatus ? 'activado' : 'desactivado'} exitosamente`);
    } catch (error) {
      console.error("Error toggling expense:", error);
      toast.error("Error al cambiar el estado del gasto");
    }
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

  const handleGenerateTransactions = async () => {
    try {
      setGeneratingTransactions(true);
      const generatedTransactions = await recurringExpenseService.generatePendingTransactions();
      
      if (generatedTransactions.length > 0) {
        toast.success(`Se generaron ${generatedTransactions.length} transacciones pendientes para el próximo mes`);
      } else {
        toast.info("No hay gastos recurrentes pendientes de generar");
      }
    } catch (error) {
      console.error("Error generating transactions:", error);
      toast.error("Error al generar las transacciones pendientes");
    } finally {
      setGeneratingTransactions(false);
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
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-600 rounded-xl shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Gastos Recurrentes</h1>
                  <p className="text-gray-600 mt-1">
                    Gestiona los gastos que se repiten automáticamente cada mes
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
                    onClick={handleGenerateTransactions}
                    disabled={generatingTransactions || activeExpenses.length === 0}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:ring-4 focus:ring-green-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingTransactions ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generando...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Generar Próximo Mes
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => router.push('/admin/transacciones/salidas')}
                    className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 focus:ring-4 focus:ring-purple-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo Gasto
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
                  <div className="p-2 bg-purple-600 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
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
                        className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
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
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-purple-600 mx-auto"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 bg-purple-600 rounded-full opacity-20"></div>
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
                    Crea tu primer gasto recurrente para automatizar los gastos mensuales
                  </p>
                  <button
                    onClick={() => router.push('/admin/transacciones/salidas')}
                    className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 focus:ring-4 focus:ring-purple-500/20 transition-all duration-200 font-medium shadow-lg"
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Monto</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">División</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-background divide-y divide-border">
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-muted/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              expense.isActive 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                              {expense.isActive ? (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Activo
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                  Inactivo
                                </>
                              )}
                            </span>
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                            {formatCurrency(expense.amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                            <span className="capitalize">{expense.division?.replace('_', ' ')}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleToggleActive(expense.id, expense.isActive)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                                  expense.isActive
                                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                                }`}
                              >
                                {expense.isActive ? 'Desactivar' : 'Activar'}
                              </button>
                              {canManageTransactions && (
                                <button
                                  onClick={() => handleDelete(expense.id)}
                                  className="px-3 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded-md text-xs font-medium transition-colors"
                                >
                                  Eliminar
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
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              expense.isActive 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {expense.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              Recurrente
                            </span>
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
                        <div className="text-right">
                          <p className="text-sm font-medium text-foreground">
                            {formatCurrency(expense.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {expense.division?.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3">
                        <p className="text-xs text-muted-foreground">
                          {getGeneralName(expense.generalId)}
                        </p>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleToggleActive(expense.id, expense.isActive)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                              expense.isActive
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-800 hover:bg-green-200'
                            }`}
                          >
                            {expense.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          {canManageTransactions && (
                            <button
                              onClick={() => handleDelete(expense.id)}
                              className="px-3 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded-md text-xs font-medium transition-colors"
                            >
                              Eliminar
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
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default GastosRecurrentes;