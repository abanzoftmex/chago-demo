import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import TransactionForm from "../../../components/forms/TransactionForm";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import AdvancedDateSelector from "../../../components/dashboard/AdvancedDateSelector";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { providerService } from "../../../lib/services/providerService";
import { generalService } from "../../../lib/services/generalService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { paymentService } from "../../../lib/services/paymentService";
import Link from "next/link";
import { 
  PlusIcon,
  ArrowTrendingDownIcon,
  PencilIcon,
  ClipboardIcon,
  EyeIcon,
  ArrowPathIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

const SolicitudesPago = () => {
  const router = useRouter();
  const { checkPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);
  const [paymentsMap, setPaymentsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonthName, setCurrentMonthName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const toast = useToast();

  // Check permissions based on user role
  const canManageTransactions = checkPermission("canManageTransactions");
  const canDeleteTransactions = checkPermission("canDeleteTransactions");

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);

      // Get first and last day of the selected month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const transactionQuery = { 
        type: "salida", 
        limit: 1000, // Aumentamos el límite para traer más datos y paginar en el frontend
        startDate: startOfMonth,
        endDate: endOfMonth
      };

      const [transactionsData, conceptsData, providersData, generalsData, subconceptsData] = await Promise.all(
        [
          transactionService.getAll(transactionQuery),
          conceptService.getAll(),
          providerService.getAll(),
          generalService.getAll(),
          subconceptService.getAll(),
        ]
      );
      
      console.log('Transacciones cargadas:', {
        query: transactionQuery,
        resultCount: transactionsData.length,
        transactions: transactionsData
      });
      
      setTransactions(transactionsData);
      setConcepts(conceptsData);
      setProviders(providersData);
      setGenerals(generalsData);
      setSubconcepts(subconceptsData);

      // Cargar pagos para todas las transacciones
      const paymentsData = {};
      for (const transaction of transactionsData) {
        try {
          const payments = await paymentService.getByTransaction(transaction.id);
          paymentsData[transaction.id] = payments || [];
        } catch (err) {
          console.error(`Error loading payments for transaction ${transaction.id}:`, err);
          paymentsData[transaction.id] = [];
        }
      }
      setPaymentsMap(paymentsData);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Error al cargar las transacciones");
    } finally {
      setLoading(false);
    }
  }, [toast, currentDate]);

  const updateMonthName = useCallback(() => {
    const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    setCurrentMonthName(monthName.charAt(0).toUpperCase() + monthName.slice(1));
  }, [currentDate]);

  useEffect(() => {
    loadTransactions();
    updateMonthName();
  }, [loadTransactions, currentDate, updateMonthName]);

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
    setCurrentPage(1); // Reset to first page when date changes
  };

  const handleTransactionSuccess = (transaction) => {
    if (editingTransaction) {
      // Update existing transaction
      setTransactions((prev) =>
        prev.map((t) => (t.id === transaction.id ? transaction : t))
      );
      toast.success("Salida actualizada exitosamente");
    } else {
      // Add new transaction to the list
      setTransactions((prev) => [transaction, ...prev]);
    }
    setShowForm(false);
    setEditingTransaction(null);
    // The toast is already shown in the TransactionForm component for new transactions
  };

  const handleNewTransaction = () => {
    router.push('/admin/transacciones/nueva-salida');
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const handleEditTransaction = (transaction) => {
    router.push(`/admin/transacciones/editar/${transaction.id}`);
  };

  const handleDeleteTransaction = async (transaction) => {
    if (!canDeleteTransactions) {
      toast.error("No tienes permisos para eliminar transacciones");
      return;
    }

    const confirmMessage = `¿Estás seguro de eliminar esta transacción?\n\nProveedor: ${getProviderName(transaction.providerId, transaction)}\nMonto: ${formatCurrency(transaction.amount)}\nFecha: ${formatDate(transaction.date)}\n\nEsta acción no se puede deshacer.`;
    
    if (window.confirm(confirmMessage)) {
      try {
        await transactionService.delete(transaction.id, { uid: 'admin' }, 'Eliminación manual desde interfaz');
        setTransactions((prev) => prev.filter((t) => t.id !== transaction.id));
        toast.success("Transacción eliminada exitosamente");
      } catch (error) {
        console.error("Error deleting transaction:", error);
        toast.error("Error al eliminar la transacción: " + error.message);
      }
    }
  };

  const getGeneralName = (generalId, transaction = null) => {
    if (!generalId) return "N/A";
    const general = generals.find((g) => g.id === generalId);
    return general ? general.name : "N/A";
  };

  const getConceptName = (conceptId, transaction = null) => {
    // Si es un gasto inicial con conceptName, usar ese nombre
    if (transaction?.isInitialExpense && transaction?.conceptName) {
      return transaction.conceptName;
    }
    
    const concept = concepts.find((c) => c.id === conceptId);
    return concept ? concept.name : "N/A";
  };

  const getSubconceptName = (subconceptId, transaction = null) => {
    if (!subconceptId) return null;
    const subconcept = subconcepts.find((s) => s.id === subconceptId);
    return subconcept ? subconcept.name : null;
  };

  const getConceptHierarchy = (transaction) => {
    const generalName = getGeneralName(transaction.generalId, transaction);
    const conceptName = getConceptName(transaction.conceptId, transaction);
    const subconceptName = getSubconceptName(transaction.subconceptId, transaction);

    // Construir el árbol jerárquico
    const hierarchy = [];
    
    if (generalName && generalName !== "N/A") {
      hierarchy.push(generalName);
    }
    
    if (conceptName && conceptName !== "N/A") {
      hierarchy.push(conceptName);
    }
    
    if (subconceptName) {
      hierarchy.push(subconceptName);
    }

    return hierarchy.length > 0 ? hierarchy : ["N/A"];
  };

  const getRemainingAmount = (transaction) => {
    const totalAmount = transaction.amount || 0;
    const payments = paymentsMap[transaction.id] || [];
    const paidAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    return remainingAmount;
  };

  const getPaidAmount = (transaction) => {
    const payments = paymentsMap[transaction.id] || [];
    const paidAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    return paidAmount;
  };

  const getProviderName = (providerId, transaction = null) => {
    // Si es un gasto inicial con providerName, usar ese nombre
    if (transaction?.isInitialExpense && transaction?.providerName) {
      return transaction.providerName;
    }
    
    if (!providerId) return "N/A";
    const provider = providers.find((p) => p.id === providerId);
    return provider ? provider.name : "N/A";
  };

  const getInitialExpenseBadge = (transaction) => {
    if (transaction.isInitialExpense) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Inicial
        </span>
      );
    }
    return null;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return "";
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    
    // Ajustar la fecha para mostrar la fecha correcta en la zona horaria local
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const day = dateObj.getDate();
    
    // Crear una nueva fecha usando solo año, mes y día para evitar problemas de zona horaria
    const adjustedDate = new Date(year, month, day);
    
    return adjustedDate.toLocaleDateString("es-MX");
  };

  const getStatusBadge = (status, transaction = null) => {
    const statusConfig = {
      pendiente: {
        color: "bg-red-100 text-red-800 border border-red-200",
        text: "Pendiente",
        icon: (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      parcial: {
        color: "bg-yellow-100 text-yellow-800 border border-yellow-200",
        text: "Parcial",
        icon: (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
      pagado: {
        color: "bg-green-50 text-green-700 border border-green-200",
        text: "Pagado",
        icon: (
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ),
      },
    };

    const config = statusConfig[status] || statusConfig.pendiente;
    
    if (!transaction) {
      return (
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          {config.icon}
          {config.text}
        </span>
      );
    }

    const paidAmount = getPaidAmount(transaction);
    const remainingAmount = getRemainingAmount(transaction);

    return (
      <div className="flex flex-col items-start gap-1">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.color}`}
        >
          {config.icon}
          {config.text}
        </span>
        
        {/* Mostrar monto pagado para estado parcial y pagado */}
        {(status === "parcial" || status === "pagado") && paidAmount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
            Pagado: {formatCurrency(paidAmount)}
          </span>
        )}
        
        {/* Mostrar saldo pendiente para estado pendiente y parcial */}
        {(status === "pendiente" || status === "parcial") && remainingAmount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
            Saldo pendiente: {formatCurrency(remainingAmount)}
          </span>
        )}
      </div>
    );
  };

  const handleViewDetails = (transactionId) => {
    router.push(`/admin/transacciones/detalle/${transactionId}`);
  };

  const filteredTransactions = transactions.filter((transaction) => {
    // Si hay un término de búsqueda, filtrar por él
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      
      // Buscar en el árbol jerárquico completo
      const generalName = getGeneralName(transaction.generalId, transaction).toLowerCase();
      const conceptName = getConceptName(transaction.conceptId, transaction).toLowerCase();
      const subconceptName = (getSubconceptName(transaction.subconceptId, transaction) || "").toLowerCase();
      
      // Otros campos
      const providerName = getProviderName(transaction.providerId, transaction).toLowerCase();
      const description = (transaction.description || "").toLowerCase();
      const amountStr = (transaction.amount ?? "").toString();
      const statusStr = (transaction.status ?? "").toString().toLowerCase();
      
      return (
        generalName.includes(query) ||
        conceptName.includes(query) ||
        subconceptName.includes(query) ||
        providerName.includes(query) ||
        description.includes(query) ||
        amountStr.includes(query) ||
        statusStr.includes(query)
      );
    }
    return true;
  });

  // Sort transactions by status priority
  const sortedTransactions = filteredTransactions.sort((a, b) => {
    const statusOrder = { pendiente: 1, parcial: 2, pagado: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTransactions = sortedTransactions.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  return (
    <ProtectedRoute>
      <AdminLayout
        title="Salida"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Transacciones" },
          { name: "Salida" },
        ]}
      >
        <div className="space-y-6">
          {/* Header with action button */}
          <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-red-600 rounded-xl shadow-lg">
                  <ArrowTrendingDownIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Salidas - {currentMonthName}
                    </h1>
                    <AdvancedDateSelector
                      currentDate={currentDate}
                      onDateChange={handleDateChange}
                      onSuccess={toast.success}
                      onError={toast.error}
                    />
                  </div>
                  <p className="text-gray-600 mt-1">
                    Gestiona y realiza seguimiento de todas las salidas de la organización
                  </p>
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    <ClipboardIcon className="h-4 w-4 mr-1" />
                    {transactions.length} salidas registradas
                  </div>
                </div>
              </div>
              {!showForm && canManageTransactions && (
                <div className="flex flex-col sm:flex-row gap-3">                  
                  {/* Botón Nueva Salida */}
                  <button
                    onClick={handleNewTransaction}
                    className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 focus:ring-4 focus:ring-red-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  ><PlusIcon className="h-4 w-4 mr-1.5" />
                    Nueva Salida
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={editingTransaction ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 6v6m0 0v6m0-6h6m-6 0H6"}
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {editingTransaction ? "Editar Gasto" : "Nuevo Gasto"}
                      </h3>
                      <p className="text-red-100 text-sm">
                        {editingTransaction
                          ? "Modifica los campos para actualizar el gasto"
                          : "Completa los campos para crear un nuevo gasto"
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelForm}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                <TransactionForm
                  type="salida"
                  initialData={editingTransaction}
                  onSuccess={handleTransactionSuccess}
                  onCancel={handleCancelForm}
                />
              </div>
            </div>
          )}

          {/* Recent Transactions Table */}
          {!showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-red-600 rounded-lg">
                      <ArrowTrendingDownIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Salidas Recientes
                      </h3>
                      <p className="text-sm text-gray-600">
                        {startIndex + 1}-{Math.min(endIndex, sortedTransactions.length)} de {sortedTransactions.length} gastos
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {
                          sortedTransactions.filter(
                            (t) => t.status === "pendiente"
                          ).length
                        }{" "}
                        Pendientes
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {
                          sortedTransactions.filter(
                            (t) => t.status === "parcial"
                          ).length
                        }{" "}
                        Parciales
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {
                          sortedTransactions.filter(
                            (t) => t.status === "pagado"
                          ).length
                        }{" "}
                        Pagadas
                      </span>
                    </div>
                    <div className="w-full md:w-80">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={handleSearchChange}
                          placeholder="Buscar por general, concepto, subconcepto, proveedor, descripción, monto o estado..."
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
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
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-red-600 mx-auto"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-red-600 rounded-full opacity-20"></div>
                      </div>
                    </div>
                    <p className="text-gray-600 mt-4 font-medium">
                      Cargando gastos...
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Por favor espera un momento
                    </p>
                  </div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="max-w-lg mx-auto">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <svg
                        className="w-12 h-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No hay gastos registrados este mes
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Comienza creando tu primer gasto para gestionar los gastos de tu organización
                    </p>
                    
                    <div className="flex justify-center">
                      <button
                        onClick={handleNewTransaction}
                        className="inline-flex items-center px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 focus:ring-4 focus:ring-red-500/20 transition-all duration-200 font-medium shadow-lg"
                      >
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                        Crear primer gasto
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Concepto
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Proveedor
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Monto
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {currentTransactions.map((transaction) => (
                            <tr
                              key={transaction.id}
                              className="hover:bg-muted/50"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                {formatDate(transaction.date)}
                              </td>
                              <td className="px-6 py-4 text-sm text-foreground">
                                <div className="flex items-center space-x-1 flex-wrap">
                                  {getConceptHierarchy(transaction).map((level, index, array) => (
                                    <div key={index} className="flex items-center space-x-1">
                                      <span className={index === array.length - 1 ? "font-medium text-gray-900" : "text-gray-600"}>
                                        {level}
                                      </span>
                                      {index < array.length - 1 && (
                                        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                {getProviderName(transaction.providerId, transaction)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                {formatCurrency(transaction.amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(transaction.status, transaction)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {transaction.isRecurring ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-rose-400 text-white order border-blue-200">
                                    <ArrowPathIcon className="h-4 w-4 mr-1" />
                                    Recurrente
                                  </span>
                                ) : getInitialExpenseBadge(transaction) || (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    <PlusIcon className="h-4 w-4 mr-1" />
                                    Manual
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-3">
                                  {canManageTransactions && (
                                    <button
                                      onClick={() => handleEditTransaction(transaction)}
                                      className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center"
                                      title="Editar gasto"
                                      cursor="pointer"
                                    >
                                      <PencilIcon className="h-4 w-4" /> 
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleViewDetails(transaction.id)}
                                    className="bg-orange-100 hover:bg-orange-200 text-orange-600 hover:text-orange-800 py-1.5 px-2.5 rounded-md transition-colors"
                                    title="Ver detalles"
                                    cursor="pointer"
                                  >
                                    <EyeIcon className="h-4 w-4" />
                                  </button>
                                  {canDeleteTransactions && (
                                    <button
                                      onClick={() => handleDeleteTransaction(transaction)}
                                      className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center"
                                      title="Eliminar gasto"
                                      cursor="pointer"
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
                    {currentTransactions.map((transaction) => (
                      <div key={transaction.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Gasto
                              </span>
                              {transaction.isRecurring && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                  Recurrente
                                </span>
                              )}
                              {getInitialExpenseBadge(transaction)}
                              {getStatusBadge(transaction.status, transaction)}
                            </div>
                            <div className="text-sm font-medium text-foreground mb-1">
                              <div className="flex items-center space-x-1 flex-wrap">
                                {getConceptHierarchy(transaction).map((level, index, array) => (
                                  <div key={index} className="flex items-center space-x-1">
                                    <span className={index === array.length - 1 ? "font-semibold" : "text-gray-600 font-normal"}>
                                      {level}
                                    </span>
                                    {index < array.length - 1 && (
                                      <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {getProviderName(transaction.providerId, transaction)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-foreground">
                              {formatCurrency(transaction.amount)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(transaction.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-3">
                            {canManageTransactions && (
                              <button
                                onClick={() => handleEditTransaction(transaction)}
                                className="text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center"
                                title="Editar gasto"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Editar
                              </button>
                            )}
                            <button
                              onClick={() => handleViewDetails(transaction.id)}
                              className="text-sm text-primary hover:text-primary/80 transition-colors"
                            >
                              Ver Detalles
                            </button>
                            {canDeleteTransactions && (
                              <button
                                onClick={() => handleDeleteTransaction(transaction)}
                                className="text-sm text-red-600 hover:text-red-800 transition-colors flex items-center"
                                title="Eliminar gasto"
                              >
                                <TrashIcon className="w-4 h-4 mr-1" />
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 flex justify-between sm:hidden">
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Anterior
                          </button>
                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Siguiente
                          </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-gray-700">
                              Mostrando{" "}
                              <span className="font-medium">{startIndex + 1}</span> a{" "}
                              <span className="font-medium">
                                {Math.min(endIndex, sortedTransactions.length)}
                              </span>{" "}
                              de{" "}
                              <span className="font-medium">{sortedTransactions.length}</span>{" "}
                              resultados
                            </p>
                          </div>
                          <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                              <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span className="sr-only">Anterior</span>
                              </button>
                              
                              {/* Page numbers */}
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                                // Show first page, last page, current page, and pages around current page
                                if (
                                  page === 1 ||
                                  page === totalPages ||
                                  Math.abs(page - currentPage) <= 1
                                ) {
                                  return (
                                    <button
                                      key={page}
                                      onClick={() => handlePageChange(page)}
                                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                        page === currentPage
                                          ? "z-10 bg-red-50 border-red-500 text-red-600"
                                          : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                                      }`}
                                    >
                                      {page}
                                    </button>
                                  );
                                } else if (
                                  page === currentPage - 2 ||
                                  page === currentPage + 2
                                ) {
                                  return (
                                    <span
                                      key={page}
                                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                                    >
                                      ...
                                    </span>
                                  );
                                }
                                return null;
                              })}
                              
                              <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <span className="sr-only">Siguiente</span>
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </nav>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default SolicitudesPago;
