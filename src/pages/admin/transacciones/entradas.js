import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import TransactionForm from "../../../components/forms/TransactionForm";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../components/ui/Toast";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { providerService } from "../../../lib/services/providerService";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

const Ingresos = () => {
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
        type: "entrada", 
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
      pendiente: { color: "bg-red-100 text-red-800", text: "Pendiente" },
      parcial: { color: "bg-yellow-100 text-yellow-800", text: "Parcial" },
      pagado: { color: "bg-green-100 text-green-800", text: "Pagado" },
    };

    const config = statusConfig[status] || statusConfig.pendiente;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      >
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
                      d="M12 8c-1.657 0-3 1.343-3 3m6 0a3 3 0 00-3-3m-7 3a7 7 0 1114 0 7 7 0 01-14 0z"
                    />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h1 className="text-2xl font-bold text-gray-900">
                      Ingreso - {currentMonthName}
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
                    Registra y consulta los ingresos de la organización
                  </p>
                </div>
              </div>
              {!showForm && canManageTransactions && (
                <button
                  onClick={handleNewTransaction}
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:ring-4 focus:ring-green-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
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
                  Nuevo Ingreso
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
                          d="M12 8c-1.657 0-3 1.343-3 3m6 0a3 3 0 00-3-3m-7 3a7 7 0 1114 0 7 7 0 01-14 0z"
                        />
                      </svg>
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
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Ingreso
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
