import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import TransactionForm from "../../../components/forms/TransactionForm";
import TransactionCsvImportModal from "../../../components/forms/TransactionCsvImportModal";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import AdvancedDateSelector from "../../../components/dashboard/AdvancedDateSelector";
import { useAuth } from "../../../context/AuthContextMultiTenant";
import { useToast } from "../../../components/ui/Toast";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { generalService } from "../../../lib/services/generalService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { paymentService } from "../../../lib/services/paymentService";
import {
  formatDateIsoLocal,
  parseTransactionCsvDate,
} from "../../../lib/transactions/transactionCsvDate";
import {
  splitCsvLine,
  rowsToCsvString,
  triggerDownloadBlob,
  catalogByNameMap,
} from "../../../lib/catalogs/catalogosHelpers";
import ConceptHierarchyBreadcrumb from "../../../components/transactions/ConceptHierarchyBreadcrumb";
import {
  PlusIcon,
  ArrowTrendingUpIcon,
  PencilIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

const ITEMS_PER_PAGE = 20;

const ENTRADA_CSV_HEADERS = [
  "Fecha",
  "General",
  "Concepto",
  "Subconcepto",
  "Descripción",
  "Monto",
  "Estado",
];

const VALID_ENTRADA_STATUSES = ["pendiente", "parcial", "pagado"];

const STATUS_SORT_ORDER = { pendiente: 1, parcial: 2, pagado: 3 };

const mxnCurrency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function formatCurrencyMx(amount) {
  return mxnCurrency.format(amount);
}

const Ingresos = () => {
  const router = useRouter();
  const { tenantInfo, TENANT_ROLES } = useAuth();
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { error: notifyError, success: notifySuccess } = useToast();

  // Check permissions based on user role in tenant
  const canManageTransactions = TENANT_ROLES && (tenantInfo?.role === TENANT_ROLES.ADMIN || tenantInfo?.role === TENANT_ROLES.CONTADOR);

  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);

  const generalById = useMemo(() => {
    const m = new Map();
    for (const g of generals) m.set(g.id, g);
    return m;
  }, [generals]);

  const conceptById = useMemo(() => {
    const m = new Map();
    for (const c of concepts) m.set(c.id, c);
    return m;
  }, [concepts]);

  const subconceptById = useMemo(() => {
    const m = new Map();
    for (const s of subconcepts) m.set(s.id, s);
    return m;
  }, [subconcepts]);

  const generalByName = useMemo(
    () => catalogByNameMap(generals),
    [generals]
  );
  const conceptByName = useMemo(
    () => catalogByNameMap(concepts),
    [concepts]
  );
  const subconceptByName = useMemo(
    () => catalogByNameMap(subconcepts),
    [subconcepts]
  );

  const currentMonthName = useMemo(() => {
    const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  }, [currentDate]);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);

      // Check if we have tenant ID
      if (!tenantId) {
        console.error("No tenant ID available");
        setLoading(false);
        return;
      }

      // Get first and last day of the selected month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      const transactionQuery = { 
        type: "entrada", 
        startDate: startOfMonth,
        endDate: endOfMonth
      };

      const [transactionsData, conceptsData, generalsData, subconceptsData] = await Promise.all(
        [
          transactionService?.getAll(transactionQuery, tenantId) || [],
          conceptService?.getAll(tenantId) || [],
          generalService?.getAll(tenantId) || [],
          subconceptService?.getAll(tenantId) || [],
        ]
      );
      setTransactions(transactionsData);
      setConcepts(conceptsData);
      setGenerals(generalsData);
      setSubconcepts(subconceptsData);

      // Cargar pagos de todas las transacciones en paralelo
      const paymentsResults = await Promise.all(
        transactionsData.map(t =>
          paymentService.getByTransaction(t.id, tenantId).catch(() => [])
        )
      );
      const paymentsData = {};
      transactionsData.forEach((t, i) => {
        paymentsData[t.id] = paymentsResults[i] || [];
      });
      setPaymentsMap(paymentsData);
    } catch (error) {
      console.error("Error loading transactions:", error);
      notifyError("Error al cargar las transacciones");
    } finally {
      setLoading(false);
    }
  }, [notifyError, currentDate, tenantId]);

  useEffect(() => {
    if (tenantId) {
      loadTransactions();
    }
  }, [loadTransactions, tenantId]);

  const handleDateChange = (newDate) => {
    setCurrentDate(newDate);
    setCurrentPage(1);
  };

  const handleTransactionSuccess = (transaction) => {
    if (editingTransaction) {
      // Update existing transaction
      setTransactions((prev) =>
        prev.map((t) => (t.id === transaction.id ? transaction : t))
      );
      notifySuccess("Entrada actualizada exitosamente");
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

  const getConceptHierarchy = useCallback(
    (transaction) => {
      const hierarchy = [];
      if (transaction.generalId) {
        const gn = generalById.get(transaction.generalId)?.name;
        if (gn) hierarchy.push(gn);
      }
      if (transaction.conceptId) {
        const cn = conceptById.get(transaction.conceptId)?.name;
        if (cn) hierarchy.push(cn);
      }
      if (transaction.subconceptId) {
        const sn = subconceptById.get(transaction.subconceptId)?.name;
        if (sn) hierarchy.push(sn);
      }
      return hierarchy.length > 0 ? hierarchy : ["N/A"];
    },
    [generalById, conceptById, subconceptById]
  );

  const getRemainingAmount = (transaction) => {
    // Usar el campo 'balance' guardado en la transacción (actualizado por updateTransactionPaymentStatus)
    if (transaction.balance !== undefined && transaction.balance !== null) {
      return Math.max(0, transaction.balance);
    }
    // Fallback: calcular desde paymentsMap
    const totalAmount = transaction.amount || 0;
    const payments = paymentsMap[transaction.id] || [];
    const paidAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    return Math.max(0, totalAmount - paidAmount);
  };

  const getPaidAmount = (transaction) => {
    // Usar el campo 'totalPaid' guardado en la transacción
    if (transaction.totalPaid !== undefined && transaction.totalPaid !== null) {
      return transaction.totalPaid;
    }
    // Fallback: calcular desde paymentsMap
    const payments = paymentsMap[transaction.id] || [];
    return payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
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
            Recibido: {formatCurrencyMx(paidAmount)}
          </span>
        )}
        
        {/* Mostrar saldo pendiente para estado pendiente y parcial */}
        {(status === "pendiente" || status === "parcial") && remainingAmount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
            Saldo pendiente: {formatCurrencyMx(remainingAmount)}
          </span>
        )}
      </div>
    );
  };

  const handleViewDetails = (transactionId) => {
    router.push(`/admin/transacciones/detalle/${transactionId}`);
  };

  const exportToCSV = useCallback(() => {
    try {
      if (!tenantId) {
        notifyError("Error: No se ha identificado el tenant");
        return;
      }

      const csvData = transactions.map((transaction) => [
        formatDateIsoLocal(transaction.date),
        generalById.get(transaction.generalId)?.name ?? "N/A",
        conceptById.get(transaction.conceptId)?.name ?? "N/A",
        subconceptById.get(transaction.subconceptId)?.name ?? "",
        transaction.description || "",
        transaction.amount || 0,
        transaction.status || "pendiente",
      ]);

      const csvContent = rowsToCsvString([ENTRADA_CSV_HEADERS, ...csvData]);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const monthYear = currentDate.toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      });
      const tenantSlug = tenantInfo?.name
        ? `_${tenantInfo.name.replace(/\s+/g, "_")}`
        : "";
      triggerDownloadBlob(
        blob,
        `entradas_${monthYear.replace(" ", "_")}${tenantSlug}.csv`
      );

      notifySuccess("Archivo CSV exportado exitosamente");
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      notifyError("Error al exportar el archivo CSV");
    }
  }, [
    tenantId,
    notifyError,
    notifySuccess,
    transactions,
    generalById,
    conceptById,
    subconceptById,
    currentDate,
    tenantInfo?.name,
  ]);

  const handleImportCSV = useCallback(
    (file, importTenantId) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () =>
          reject(new Error("No se pudo leer el archivo"));
        reader.onload = async (e) => {
          try {
            const csvText = e.target.result;
            const lines = csvText.trim().split(/\r?\n/);

            if (lines.length <= 1) {
              throw new Error(
                "El archivo CSV está vacío o solo contiene headers"
              );
            }

            const dataLines = lines.slice(1);
            const importResults = {
              total: dataLines.length,
              successful: 0,
              errors: [],
            };

            for (let i = 0; i < dataLines.length; i++) {
              const line = dataLines[i];
              const lineNumber = i + 2;

              try {
                const values = splitCsvLine(line);

                if (values.length < 7) {
                  throw new Error(
                    `Línea ${lineNumber}: Se esperaban al menos 7 columnas, encontradas ${values.length}`
                  );
                }

                const generalName = values[1]?.trim();
                const conceptName = values[2]?.trim();
                const subconceptName = values[3]?.trim();

                const general = generalByName.get(generalName);
                if (!general) {
                  throw new Error(
                    `Línea ${lineNumber}: General "${generalName}" no encontrado`
                  );
                }

                const concept = conceptByName.get(conceptName);
                if (!concept) {
                  throw new Error(
                    `Línea ${lineNumber}: Concepto "${conceptName}" no encontrado`
                  );
                }

                let subconceptId = null;
                if (subconceptName) {
                  const subconcept = subconceptByName.get(subconceptName);
                  if (!subconcept) {
                    throw new Error(
                      `Línea ${lineNumber}: Subconcepto "${subconceptName}" no encontrado`
                    );
                  }
                  subconceptId = subconcept.id;
                }

                const dateString = values[0]?.trim();
                if (!dateString) {
                  throw new Error(`Línea ${lineNumber}: La fecha es requerida`);
                }

                const transactionDate = parseTransactionCsvDate(dateString);
                if (!transactionDate) {
                  throw new Error(
                    `Línea ${lineNumber}: Fecha inválida "${dateString}". Use YYYY-MM-DD (recomendado, así exporta el sistema), o DD/MM/YYYY o DD/MM/AA (día primero, formato México)`
                  );
                }

                const transactionData = {
                  type: "entrada",
                  generalId: general.id,
                  conceptId: concept.id,
                  subconceptId,
                  description: values[4]?.trim() || "",
                  amount: parseFloat(values[5]) || 0,
                  status: values[6]?.trim()?.toLowerCase() || "pendiente",
                  date: transactionDate,
                };

                if (transactionData.amount <= 0) {
                  throw new Error(
                    `Línea ${lineNumber}: El monto debe ser mayor a 0`
                  );
                }

                if (!VALID_ENTRADA_STATUSES.includes(transactionData.status)) {
                  throw new Error(
                    `Línea ${lineNumber}: Estado inválido "${transactionData.status}". Use: pendiente, parcial, pagado`
                  );
                }

                await transactionService.create(
                  transactionData,
                  { uid: "import-user" },
                  importTenantId
                );
                importResults.successful++;
              } catch (error) {
                importResults.errors.push(
                  `Línea ${lineNumber}: ${error.message}`
                );
              }
            }

            resolve(importResults);
          } catch (error) {
            reject(error);
          }
        };
        reader.readAsText(file);
      });
    },
    [generalByName, conceptByName, subconceptByName]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((transaction) => {
      const generalName = transaction.generalId
        ? (generalById.get(transaction.generalId)?.name ?? "N/A")
        : "N/A";
      const conceptName = transaction.conceptId
        ? (conceptById.get(transaction.conceptId)?.name ?? "N/A")
        : "N/A";
      const subconceptName = transaction.subconceptId
        ? (subconceptById.get(transaction.subconceptId)?.name ?? "")
        : "";
      const description = (transaction.description || "").toLowerCase();
      const amountStr = (transaction.amount ?? "").toString();
      const statusStr = (transaction.status ?? "").toString().toLowerCase();
      return (
        generalName.toLowerCase().includes(q) ||
        conceptName.toLowerCase().includes(q) ||
        subconceptName.toLowerCase().includes(q) ||
        description.includes(q) ||
        amountStr.includes(q) ||
        statusStr.includes(q)
      );
    });
  }, [
    transactions,
    searchTerm,
    generalById,
    conceptById,
    subconceptById,
  ]);

  const sortedTransactions = useMemo(
    () =>
      [...filteredTransactions].sort(
        (a, b) =>
          (STATUS_SORT_ORDER[a.status] ?? 99) -
          (STATUS_SORT_ORDER[b.status] ?? 99)
      ),
    [filteredTransactions]
  );

  const statusCounts = useMemo(() => {
    let pendiente = 0;
    let parcial = 0;
    let pagado = 0;
    for (const t of filteredTransactions) {
      if (t.status === "pendiente") pendiente++;
      else if (t.status === "parcial") parcial++;
      else if (t.status === "pagado") pagado++;
    }
    return { pendiente, parcial, pagado };
  }, [filteredTransactions]);

  const { totalPages, startIndex, endIndex, currentTransactions } =
    useMemo(() => {
      const total = sortedTransactions.length;
      const pages = Math.ceil(total / ITEMS_PER_PAGE) || 0;
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      const end = start + ITEMS_PER_PAGE;
      return {
        totalPages: pages,
        startIndex: start,
        endIndex: end,
        currentTransactions: sortedTransactions.slice(start, end),
      };
    }, [sortedTransactions, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <ProtectedRoute>
      <AdminLayout
        title="Entrada"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Transacciones" },
          { name: "Entrada" },
        ]}
      >
        <div className="space-y-6">
          {/* Top-right utility buttons */}
          {canManageTransactions && (
            <div className="flex justify-end gap-1.5">
              <button
                onClick={exportToCSV}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                Exportar CSV
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
              >
                <ArrowUpTrayIcon className="h-3.5 w-3.5" />
                Importar CSV
              </button>
            </div>
          )}

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
                      Entradas - {currentMonthName}
                    </h1>
                    <AdvancedDateSelector
                      currentDate={currentDate}
                      onDateChange={handleDateChange}
                      onSuccess={notifySuccess}
                      onError={notifyError}
                      accentColor="green"
                    />
                  </div>
                  <p className="text-gray-600 mt-1">
                    Registra y consulta las entradas de la organización
                  </p>
                </div>
              </div>
              {!showForm && canManageTransactions && (
                <div className="flex gap-3">
                  <button
                    onClick={handleNewTransaction}
                    className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:ring-4 focus:ring-green-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    Nueva Entrada
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Form */}
          {showForm && (
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium text-foreground">
                  {editingTransaction ? "Editar Entrada" : "Nueva Entrada"}
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
                        Entradas Recientes
                      </h3>
                      <p className="text-sm text-gray-600">
                        {sortedTransactions.length} entradas registradas
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {statusCounts.pendiente} Pendientes
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {statusCounts.parcial} Parciales
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {statusCounts.pagado} Pagados
                      </span>
                    </div>
                    <div className="w-full md:w-80">
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                          placeholder="Buscar por general, concepto, subconcepto, descripción, monto o estado..."
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm bg-white"
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
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-green-600 mx-auto"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-green-600 rounded-full opacity-20"></div>
                      </div>
                    </div>
                    <p className="text-gray-600 mt-4 font-medium">
                      Cargando entradas...
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
                      No hay entradas registradas este mes
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Comienza creando tu primera entrada para gestionar los ingresos de tu organización
                    </p>

                    <div className="flex justify-center">
                      <button
                        onClick={handleNewTransaction}
                        className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:ring-4 focus:ring-green-500/20 transition-all duration-200 font-medium shadow-lg"
                      >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Crear primera entrada
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-green-900 uppercase tracking-wider bg-green-200">
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
                        {currentTransactions
                          .map((transaction) => (
                            <tr
                              key={transaction.id}
                              className="hover:bg-muted/50"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                {formatDate(transaction.date)}
                              </td>
                              <td className="px-6 py-4 text-sm text-foreground">
                                <ConceptHierarchyBreadcrumb
                                  levels={getConceptHierarchy(transaction)}
                                  lastClassName="font-medium text-gray-900"
                                  midClassName="text-gray-600"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-800 bg-green-50">
                                {formatCurrencyMx(transaction.amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(transaction.status, transaction)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-3">
                                  {canManageTransactions && (
                                    <button
                                      onClick={() => handleEditTransaction(transaction)}
                                      className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors flex items-center cursor-pointer"
                                      title="Editar entrada"
                                    >
                                    <PencilIcon className="h-4 w-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      handleViewDetails(transaction.id)
                                    }
                                    className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-800 py-1.5 px-2.5 rounded-md transition-colors cursor-pointer"
                                    title="Ver detalles"
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
                    {currentTransactions
                      .map((transaction) => (
                      <div key={transaction.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center space-x-2 mb-1 flex-wrap">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Entrada
                              </span>
                              {getStatusBadge(transaction.status, transaction)}
                            </div>
                            <div className="text-sm font-medium text-foreground mb-1">
                              <ConceptHierarchyBreadcrumb
                                levels={getConceptHierarchy(transaction)}
                                lastClassName="font-semibold"
                                midClassName="text-gray-600 font-normal"
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-foreground">
                              {formatCurrencyMx(transaction.amount)}
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
                                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span className="sr-only">Anterior</span>
                              </button>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
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
                                          ? "z-10 bg-green-50 border-green-500 text-green-700"
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
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
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

        <TransactionCsvImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={(message) => {
            notifySuccess(message);
            loadTransactions();
          }}
          onImport={handleImportCSV}
          type="entrada"
          tenantId={tenantId}
        />
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default Ingresos;
