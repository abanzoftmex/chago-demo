import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import TransactionForm from "../../../components/forms/TransactionForm";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import AdvancedDateSelector from "../../../components/dashboard/AdvancedDateSelector";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { generalService } from "../../../lib/services/generalService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { paymentService } from "../../../lib/services/paymentService";
import { 
  PlusIcon,
  ArrowTrendingUpIcon,
  PencilIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const Ingresos = () => {
  const router = useRouter();
  const { checkPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [generals, setGenerals] = useState([]);
  const [subconcepts, setSubconcepts] = useState([]);
  const [paymentsMap, setPaymentsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonthName, setCurrentMonthName] = useState("");
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
        type: "entrada", 
        limit: 10,
        startDate: startOfMonth,
        endDate: endOfMonth
      };

      const [transactionsData, conceptsData, generalsData, subconceptsData] = await Promise.all(
        [
          transactionService.getAll(transactionQuery),
          conceptService.getAll(),
          generalService.getAll(),
          subconceptService.getAll(),
        ]
      );
      setTransactions(transactionsData);
      setConcepts(conceptsData);
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
  };

  const handleTransactionSuccess = (transaction) => {
    if (editingTransaction) {
      // Update existing transaction
      setTransactions((prev) =>
        prev.map((t) => (t.id === transaction.id ? transaction : t))
      );
      toast.success("Ingreso actualizado exitosamente");
    } else {
      // Add new transaction to the list
      setTransactions((prev) => [transaction, ...prev]);
    }
    setShowForm(false);
    setEditingTransaction(null);
    // The toast is already shown in the TransactionForm component for new transactions
  };

  const handleNewTransaction = () => {
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingTransaction(null);
  };

  const handleEditTransaction = (transaction) => {
    router.push(`/admin/transacciones/editar/${transaction.id}`);
  };

  const getGeneralName = (generalId, transaction = null) => {
    if (!generalId) return "N/A";
    const general = generals.find((g) => g.id === generalId);
    return general ? general.name : "N/A";
  };

  const getConceptName = (conceptId, transaction = null) => {
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
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
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
            Recibido: {formatCurrency(paidAmount)}
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
      const description = (transaction.description || "").toLowerCase();
      const amountStr = (transaction.amount ?? "").toString();
      const statusStr = (transaction.status ?? "").toString().toLowerCase();
      
      return (
        generalName.includes(query) ||
        conceptName.includes(query) ||
        subconceptName.includes(query) ||
        description.includes(query) ||
        amountStr.includes(query) ||
        statusStr.includes(query)
      );
    }
    return true;
  });

  return (
    <ProtectedRoute>
      <AdminLayout
        title="Ingreso"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Transacciones" },
          { name: "Ingreso" },
        ]}
      >
        <div className="space-y-6">
          {/* Header with action button */}
          <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-600 rounded-xl shadow-lg">
                  <ArrowTrendingUpIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Ingresos - {currentMonthName}
                    </h1>
                    <AdvancedDateSelector
                      currentDate={currentDate}
                      onDateChange={handleDateChange}
                      onSuccess={toast.success}
                      onError={toast.error}
                    />
                  </div>
                  <p className="text-gray-600 mt-1">
                    Registra y consulta los ingresos de la organización
                  </p>
                </div>
              </div>
              {!showForm && canManageTransactions && (
                <button
                  onClick={handleNewTransaction}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:ring-4 focus:ring-green-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                ><PlusIcon className="h-4 w-4 mr-1.5" />
                  Nuevo Ingreso
                </button>
              )}
            </div>
          </div>

          {/* Transaction Form */}
          {showForm && (
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-foreground">
                  {editingTransaction ? "Editar Ingreso" : "Nuevo Ingreso"}
                </h3>
                <button
                  onClick={handleCancelForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
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
              <TransactionForm
                type="entrada"
                initialData={editingTransaction}
                onSuccess={handleTransactionSuccess}
                onCancel={handleCancelForm}
              />
            </div>
          )}

          {/* Recent Transactions Table */}
          {!showForm && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-600 rounded-lg">
                      <ArrowTrendingUpIcon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Ingresos Recientes
                      </h3>
                      <p className="text-sm text-gray-600">
                        Últimos {Math.min(filteredTransactions.length, 10)}{" "}
                        ingresos registrados
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {
                          filteredTransactions.filter(
                            (t) => t.status === "pendiente"
                          ).length
                        }{" "}
                        Pendientes
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {
                          filteredTransactions.filter(
                            (t) => t.status === "parcial"
                          ).length
                        }{" "}
                        Parciales
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {
                          filteredTransactions.filter(
                            (t) => t.status === "pagado"
                          ).length
                        }{" "}
                        Pagados
                      </span>
                    </div>
                    <div className="w-full md:w-80">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar por general, concepto, subconcepto, descripción, monto o estado..."
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
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">
                    Cargando ingresos...
                  </p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="border-2 border-dashed border-border rounded-lg h-32 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-2">
                        No hay ingresos registrados
                      </p>
                      <button
                        onClick={handleNewTransaction}
                        className="text-primary hover:text-primary text-sm font-medium"
                      >
                        Registrar primer ingreso
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
                            Monto
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-background divide-y divide-border">
                        {filteredTransactions
                          .sort((a, b) => {
                            const statusOrder = { pendiente: 1, parcial: 2, pagado: 3 };
                            return statusOrder[a.status] - statusOrder[b.status];
                          })
                          .slice(0, 10)
                          .map((transaction) => (
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                {formatCurrency(transaction.amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(transaction.status, transaction)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-3">
                                  {canManageTransactions && (
                                    <button
                                      onClick={() => handleEditTransaction(transaction)}
                                      className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center"
                                      title="Editar ingreso"
                                      cursor="pointer"
                                    >
                                    <PencilIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      handleViewDetails(transaction.id)
                                    }
                                    className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors"
                                    title="Ver detalles"
                                    cursor="pointer"
                                  >
                                    <EyeIcon className="h-4 w-4" />  
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden divide-y divide-border">
                    {filteredTransactions
                      .sort((a, b) => {
                        const statusOrder = { pendiente: 1, parcial: 2, pagado: 3 };
                        return statusOrder[a.status] - statusOrder[b.status];
                      })
                      .slice(0, 10)
                      .map((transaction) => (
                      <div key={transaction.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Ingreso
                              </span>
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
                                title="Editar ingreso"
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredTransactions.length > 10 && (
                    <div className="px-6 py-4 border-t border-border text-center">
                      <p className="text-sm text-muted-foreground">
                        Mostrando los 10 ingresos más recientes.{" "}
                        <Link
                          href="/admin/transacciones/historial?type=entrada"
                          className="text-primary hover:text-primary/80"
                        >
                          Ver historial completo
                        </Link>
                      </p>
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

export default Ingresos;
