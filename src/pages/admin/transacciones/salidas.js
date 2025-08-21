import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import TransactionForm from "../../../components/forms/TransactionForm";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { providerService } from "../../../lib/services/providerService";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

const SolicitudesPago = () => {
  const router = useRouter();
  const { checkPermission } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonthName, setCurrentMonthName] = useState("");
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const monthDropdownRef = useRef(null);
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
        limit: 10,
        startDate: startOfMonth,
        endDate: endOfMonth
      };

      const [transactionsData, conceptsData, providersData] = await Promise.all(
        [
          transactionService.getAll(transactionQuery),
          conceptService.getAll(),
          providerService.getAll(),
        ]
      );
      setTransactions(transactionsData);
      setConcepts(conceptsData);
      setProviders(providersData);
    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Error al cargar las transacciones");
    } finally {
      setLoading(false);
    }
  }, [toast, currentDate]);

  useEffect(() => {
    loadTransactions();
    updateMonthName();
  }, [loadTransactions, currentDate]);
  
  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target)) {
        setShowMonthDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateMonthName = () => {
    const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    setCurrentMonthName(monthName.charAt(0).toUpperCase() + monthName.slice(1));
  };
  
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (direction === 'next') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setMonth(new Date().getMonth());
      newDate.setFullYear(new Date().getFullYear());
    }
    setCurrentDate(newDate);
    setShowMonthDropdown(false);
  };
  
  const selectMonth = (monthIndex) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(monthIndex);
    setCurrentDate(newDate);
    setShowMonthDropdown(false);
  };
  
  const getMonthsList = () => {
    const months = [];
    const currentYear = currentDate.getFullYear();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentYear, i, 1);
      months.push({
        index: i,
        name: date.toLocaleDateString('es-ES', { month: 'long' })
      });
    }
    
    return months;
  };

  const handleTransactionSuccess = (transaction) => {
    // Add the new transaction to the list
    setTransactions((prev) => [transaction, ...prev]);
    setShowForm(false);
    // The toast is already shown in the TransactionForm component
  };

  const handleNewTransaction = () => {
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
  };

  const getConceptName = (conceptId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    return concept ? concept.name : "N/A";
  };

  const getProviderName = (providerId) => {
    if (!providerId) return "N/A";
    const provider = providers.find((p) => p.id === providerId);
    return provider ? provider.name : "N/A";
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

  const getStatusBadge = (status) => {
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

    return (
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.icon}
        {config.text}
      </span>
    );
  };

  const handleViewDetails = (transactionId) => {
    router.push(`/admin/transacciones/detalle/${transactionId}`);
  };

  const filteredTransactions = transactions.filter((transaction) => {
    // Si hay un término de búsqueda, filtrar por él
    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      const conceptName = getConceptName(transaction.conceptId).toLowerCase();
      const providerName = getProviderName(transaction.providerId).toLowerCase();
      const amountStr = (transaction.amount ?? "").toString();
      const statusStr = (transaction.status ?? "").toString().toLowerCase();
      return (
        conceptName.includes(query) ||
        providerName.includes(query) ||
        amountStr.includes(query) ||
        statusStr.includes(query)
      );
    }
    return true;
  });

  return (
    <ProtectedRoute>
      <AdminLayout
        title="Gasto"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Transacciones" },
          { name: "Gasto" },
        ]}
      >
        <div className="space-y-6">
          {/* Header with action button */}
          <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-6 border border-red-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-red-600 rounded-xl shadow-lg">
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
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Gasto - {currentMonthName}
                    </h1>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => navigateMonth('prev')}
                        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                        aria-label="Mes anterior"
                      >
                        <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
                      </button>
                      <div className="relative" ref={monthDropdownRef}>
                        <button
                          onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                          className="p-1 rounded-full hover:bg-gray-200 transition-colors flex items-center"
                          aria-label="Seleccionar mes"
                        >
                          <span className="text-xs font-medium text-gray-600 flex items-center">
                            {currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear() 
                              ? "Mes Actual" 
                              : currentDate.toLocaleDateString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + 
                                currentDate.toLocaleDateString('es-ES', { month: 'long' }).slice(1)}
                            <ChevronDownIcon className="h-3 w-3 ml-1" />
                          </span>
                        </button>
                        
                        {showMonthDropdown && (
                          <div className="absolute z-10 mt-1 w-40 bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none">
                            <button
                              onClick={() => navigateMonth('current')}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              Mes Actual
                            </button>
                            <div className="border-t border-gray-100 my-1"></div>
                            {getMonthsList().map((month) => (
                              <button
                                key={month.index}
                                onClick={() => selectMonth(month.index)}
                                className={`block w-full text-left px-4 py-2 text-sm ${currentDate.getMonth() === month.index ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'}`}
                              >
                                {month.name.charAt(0).toUpperCase() + month.name.slice(1)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => navigateMonth('next')}
                        className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                        aria-label="Mes siguiente"
                      >
                        <ChevronRightIcon className="h-5 w-5 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 mt-1">
                    Gestiona y realiza seguimiento de todos los gastos de la organización
                  </p>
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    {transactions.length} gastos registrados
                  </div>
                </div>
              </div>
              {!showForm && canManageTransactions && (
                <button
                  onClick={handleNewTransaction}
                  className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 focus:ring-4 focus:ring-red-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
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
                  Nuevo Gasto
                </button>
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
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Nuevo Gasto
                      </h3>
                      <p className="text-red-100 text-sm">
                        Completa los campos para crear un nuevo gasto
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
                          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Gastos Recientes
                      </h3>
                      <p className="text-sm text-gray-600">
                        Últimas {Math.min(filteredTransactions.length, 10)}{" "}
                        gastos registrados
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
                        Pagadas
                      </span>
                    </div>
                    <div className="w-full md:w-80">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Buscar por concepto, proveedor, monto o estado..."
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
                  <div className="max-w-md mx-auto">
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
                      No hay gastos registrados
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Comienza creando tu primer gasto para gestionar los gastos
                      de tu organización
                    </p>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                {getConceptName(transaction.conceptId)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                {getProviderName(transaction.providerId)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                {formatCurrency(transaction.amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(transaction.status)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() =>
                                    handleViewDetails(transaction.id)
                                  }
                                  className="text-primary hover:text-primary/80 transition-colors"
                                >
                                  Ver Detalles
                                </button>
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
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                Gasto
                              </span>
                              {getStatusBadge(transaction.status)}
                            </div>
                            <p className="text-sm font-medium text-foreground">
                              {getConceptName(transaction.conceptId)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {getProviderName(transaction.providerId)}
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
                          <button
                            onClick={() => handleViewDetails(transaction.id)}
                            className="text-sm text-primary hover:text-primary/80 transition-colors"
                          >
                            Ver Detalles
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredTransactions.length > 10 && (
                    <div className="px-6 py-4 border-t border-border text-center">
                      <p className="text-sm text-muted-foreground">
                        Mostrando los 10 gastos más recientes.{" "}
                        <Link
                          href="/admin/transacciones/historial?type=salida"
                          className="text-primary hover:text-primary/80"
                        >
                          Ver todos los gastos
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

export default SolicitudesPago;
