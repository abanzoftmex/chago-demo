import { useState, useEffect } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import PaymentManager from "../../../../components/forms/PaymentManager";
import { transactionService } from "../../../../lib/services/transactionService";
import { conceptService } from "../../../../lib/services/conceptService";
import { subconceptService } from "../../../../lib/services/subconceptService";
import { providerService } from "../../../../lib/services/providerService";
import { paymentService } from "../../../../lib/services/paymentService";
import { logService } from "../../../../lib/services/logService";
import { generalService } from "../../../../lib/services/generalService";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  Tag,
  FileDigitIcon,
  Building,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Calendar,
  CreditCard,
  BarChart3,
  Plus,
  ArrowLeft,
  Edit,
  Eye,
  Download,
  Paperclip,
  StickyNote,
  Trash,
  X,
  Copy,
  Banknote,
} from "lucide-react";

// Modal component for displaying provider details
const ProviderDetailsModal = ({ isOpen, onClose, provider }) => {
  if (!isOpen) return null;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // You might want to add a toast notification here
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center border-b border-gray-200 p-4">
          <h3 className="text-lg font-medium text-gray-900">
            Información del Proveedor
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-4">
          <div>
            <h4 className="font-medium text-gray-900">{provider.name}</h4>
            <p className="text-sm text-gray-500">RFC: {provider.rfc || 'No especificado'}</p>
            <p className="text-sm text-gray-500">Teléfono: {provider.phone || 'No especificado'}</p>
            <p className="text-sm text-gray-500">Dirección: {provider.address || 'No especificada'}</p>
          </div>
          
          {provider.bankAccounts && provider.bankAccounts.length > 0 ? (
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Cuentas Bancarias</h4>
              <div className="space-y-4">
                {provider.bankAccounts.map((account, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          <Banknote className="inline-block w-4 h-4 mr-1" />
                          {account.bank || 'Banco no especificado'}
                        </p>
                        {account.accountNumber && (
                          <div className="flex items-center mt-1">
                            <span className="text-sm text-gray-500">Número de cuenta: {account.accountNumber}</span>
                            <button 
                              onClick={() => copyToClipboard(account.accountNumber)}
                              className="ml-1 text-blue-500 hover:text-blue-700"
                              title="Copiar número de cuenta"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {account.clabe && (
                          <div className="flex items-center mt-1">
                            <span className="text-sm text-gray-500">CLABE: {account.clabe}</span>
                            <button 
                              onClick={() => copyToClipboard(account.clabe)}
                              className="ml-1 text-blue-500 hover:text-blue-700"
                              title="Copiar CLABE"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              No hay cuentas bancarias registradas para este proveedor.
            </div>
          )}
        </div>
        
        <div className="bg-gray-50 px-4 py-3 sm:px-6 flex justify-end space-x-3 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const TransactionDetail = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, userRole } = useAuth();

  const [transaction, setTransaction] = useState(null);
  const [concept, setConcept] = useState(null);
  const [subconcept, setSubconcept] = useState(null);
  const [general, setGeneral] = useState(null);
  const [provider, setProvider] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [deleteReasonError, setDeleteReasonError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadTransactionDetails();
    }
  }, [id]);

  const handleDelete = async () => {
    // Check user role first
    if (['contador', 'director_general'].includes(userRole)) {
      setError("No tienes permisos para eliminar transacciones");
      return;
    }

    // Validar que el motivo sea obligatorio
    if (!deleteReason.trim()) {
      setDeleteReasonError("El motivo de eliminación es obligatorio");
      return;
    }

    if (!confirm("¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      setDeleting(true);
      setDeleteReasonError(""); // Limpiar error anterior
      setError(""); // Clear any previous errors

      // Delete the transaction with deletion reason
      await transactionService.delete(id, user, deleteReason.trim());
      setShowDeleteModal(false);
      router.push("/admin/transacciones/historial");
    } catch (error) {
      console.error("Error deleting transaction:", error);
      setError(error.message || "Error al eliminar la transacción");
      setDeleting(false);
    }
  };

  const loadTransactionDetails = async () => {
    try {
      setLoading(true);
      setError("");

      // Load transaction
      const transactionData = await transactionService.getById(id);
      setTransaction(transactionData);

      // Load related data
      const conceptPromise = transactionData.conceptId
        ? conceptService.getById(transactionData.conceptId)
        : Promise.resolve(null);
      const subconceptPromise = transactionData.subconceptId
        ? subconceptService.getById(transactionData.subconceptId)
        : Promise.resolve(null);
      const paymentsPromise = paymentService.getByTransaction(id);

      const [conceptData, subconceptData, paymentsData] = await Promise.all([
        conceptPromise,
        subconceptPromise,
        paymentsPromise,
      ]);

      setConcept(conceptData);
      setSubconcept(subconceptData);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);

      // Load general: prefer transaction.generalId, else derive from concept
      let generalData = null;
      try {
        const generalId = transactionData.generalId || conceptData?.generalId;
        if (generalId) {
          generalData = await generalService.getById(generalId);
        }
      } catch (e) {
        console.error("Error loading general:", e);
      }
      setGeneral(generalData);

      // Load provider if it's a salida
      if (transactionData.providerId) {
        const providerData = await providerService.getById(
          transactionData.providerId
        );
        setProvider(providerData);
      }
    } catch (err) {
      console.error("Error loading transaction details:", err);
      setError(err.message || "Error al cargar los detalles de la transacción");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentUpdate = (updatedPayments) => {
    setPayments(Array.isArray(updatedPayments) ? updatedPayments : []);
  };

  const handleDeleteReasonChange = (value) => {
    setDeleteReason(value);
    // Limpiar error cuando el usuario empiece a escribir
    if (deleteReasonError && value.trim()) {
      setDeleteReasonError("");
    }
  };

  // Utility functions
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "pagado":
        return (
          <div className="flex items-center space-x-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Pagado</span>
          </div>
        );
      case "parcial":
        return (
          <div className="flex items-center space-x-1 text-amber-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Parcial</span>
          </div>
        );
      case "pendiente":
      default:
        return (
          <div className="flex items-center space-x-1 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Pendiente</span>
          </div>
        );
    }
  };

  const getPaymentMetrics = () => {
    if (!transaction || !payments || !Array.isArray(payments)) return { paid: 0, remaining: 0, progress: 0 };

    const totalAmount = transaction.amount || 0;
    const paidAmount = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const progress = totalAmount > 0 ? Math.min(100, (paidAmount / totalAmount) * 100) : 0;

    return {
      paid: paidAmount,
      remaining: remainingAmount,
      progress,
    };
  };

  // File handling
  const handleDownloadFile = (url, fileName) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewFile = (url) => {
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando detalles de la transacción...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="bg-red-100 text-red-600 p-4 rounded-lg mb-4">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p>{error}</p>
            </div>
            <button
              onClick={() => router.push("/admin/transacciones/historial")}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!transaction) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="bg-amber-100 text-amber-600 p-4 rounded-lg mb-4">
              <AlertCircle className="w-6 h-6 mx-auto mb-2" />
              <p>No se encontró la transacción</p>
            </div>
            <button
              onClick={() => router.push("/admin/transacciones/historial")}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const paymentMetrics = getPaymentMetrics();
  const transactionType = transaction.type === "entrada" ? "entrada" : "salida";
  const transactionIcon = transaction.type === "entrada" ? TrendingUp : TrendingDown;
  const transactionColor = transaction.type === "entrada" ? "text-green-600" : "text-red-600";

  return (
    <AdminLayout>
      <div className="px-5">
        {/* Transaction Header - Compact */}
         <div className="flex items-center justify-between mb-6 bg-background rounded-lg border border-border p-4">
           <div className="flex items-center space-x-3">
             <div className={`w-10 h-10 rounded-full ${transaction.type === "entrada" ? "bg-green-100" : "bg-red-100"} flex items-center justify-center`}>
               {transaction.type === "entrada" ? (
                 <TrendingUp className={`w-5 h-5 ${transaction.type === "entrada" ? "text-green-600" : "text-red-600"}`} />
               ) : (
                 <TrendingDown className={`w-5 h-5 ${transaction.type === "entrada" ? "text-green-600" : "text-red-600"}`} />
               )}
             </div>
             <div>
               <h1 className="text-xl font-bold text-foreground">
                 {transaction.type === "entrada" ? "Entrada" : "Salida"}: {formatCurrency(transaction.amount)}
               </h1>
               <div className="text-sm text-muted-foreground">
                 {formatDate(transaction.date)} • {general?.name} • {concept?.name} • {subconcept?.name}
               </div>
             </div>
           </div>
           {getStatusBadge(transaction.status)}
         </div>

        {/* Payment Progress */}
         <div className="mb-6 border border-border rounded-lg p-4 bg-background">
           <div className="flex items-center justify-between mb-2">
             <h2 className="text-sm font-medium">Progreso de Pago</h2>
             <span className="text-sm font-medium">{paymentMetrics.progress.toFixed(0)}%</span>
           </div>
           <div className="w-full bg-muted rounded-full h-2 mb-3">
             <div
               className="bg-primary h-2 rounded-full"
               style={{ width: `${paymentMetrics.progress}%` }}
             ></div>
           </div>
           <div className="flex justify-between text-sm">
             <div>
               <span className="text-muted-foreground">Pagado:</span>{" "}
               <span className="font-medium">{formatCurrency(paymentMetrics.paid)}</span>
             </div>
             <div>
               <span className="text-muted-foreground">Restante:</span>{" "}
               <span className="font-medium">{formatCurrency(paymentMetrics.remaining)}</span>
             </div>
           </div>
         </div>

        {/* Transaction Details */}
         <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="border border-border rounded-lg p-4 bg-background">
             <h2 className="text-sm font-medium mb-3">Detalles de la Transacción</h2>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Tag className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">General</div>
                  <div className="text-sm font-medium">{general?.name || "No especificado"}</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Tag className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Concepto</div>
                  <div className="text-sm font-medium">{concept?.name || "No especificado"}</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FileDigitIcon className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Subconcepto</div>
                  <div className="text-sm font-medium">{subconcept?.name || "No especificado"}</div>
                </div>
              </div>
              {transaction.type === "salida" && provider && (
                <div className="flex items-start space-x-3">
                  <Building className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Proveedor</div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">{provider.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowProviderModal(true);
                        }}
                        className="inline-flex items-center px-2 py-0.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        VER CUENTAS
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start space-x-3">
                <Calendar className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Fecha</div>
                  <div className="text-sm font-medium">{formatDate(transaction.date)}</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <DollarSign className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Monto</div>
                  <div className="text-sm font-medium">{formatCurrency(transaction.amount)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-lg p-4 bg-background">
             <h2 className="text-sm font-medium mb-3">Información Adicional</h2>
            <div className="space-y-3">
              {transaction.attachments && Array.isArray(transaction.attachments) && transaction.attachments.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Paperclip className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Adjuntos de la transacción ({transaction.attachments.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {transaction.attachments.map((attachment, idx) => (
                      <div key={idx} className="border border-border rounded p-3 bg-background">
                        <div className="text-sm font-medium mb-1 truncate" title={attachment.fileName}>
                          {attachment.fileName}
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">{attachment.fileType}</div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewFile(attachment.fileUrl)}
                            className="p-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center rounded-sm"
                            title="Ver archivo"
                          >
                            <Eye className="w-3 h-3 mr-1" /> Ver
                          </button>
                          <button
                            onClick={() => handleDownloadFile(attachment.fileUrl, attachment.fileName)}
                            className="p-1 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-muted flex items-center rounded-sm"
                            title="Descargar archivo"
                          >
                            <Download className="w-3 h-3 mr-1" /> Descargar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {transaction.reference && (
                <div className="flex items-start space-x-3">
                  <FileText className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Referencia</div>
                    <div className="text-sm font-medium">{transaction.reference}</div>
                  </div>
                </div>
              )}
              {transaction.description && (
                <div className="flex items-start space-x-3">
                  <FileText className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Descripción</div>
                    <div className="text-sm">{transaction.description}</div>
                  </div>
                </div>
              )}
              {transaction.paymentMethod && (
                <div className="flex items-start space-x-3">
                  <CreditCard className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Método de Pago</div>
                    <div className="text-sm font-medium">{transaction.paymentMethod}</div>
                  </div>
                </div>
              )}
              <div className="flex items-start space-x-3">
                <BarChart3 className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Estado</div>
                  <div className="text-sm font-medium">
                    {transaction.status === "pagado"
                      ? "Pagado"
                      : transaction.status === "parcial"
                      ? "Parcial"
                      : "Pendiente"}
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Calendar className="w-4 h-4 text-primary mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">Creado</div>
                  <div className="text-sm font-medium">{formatDateTime(transaction.createdAt)}</div>
                </div>
              </div>
              {transaction.notes && (
                <div className="flex items-start space-x-3">
                  <StickyNote className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">Notas</div>
                    <div className="text-sm">{transaction.notes}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment Management */}
         <div className="mb-6">
           <h2 className="text-lg font-semibold mb-4">Gestión de Pagos</h2>
           <div className="border border-border rounded-lg p-4 bg-background">
             <PaymentManager
              transactionId={id}
              transactionAmount={transaction.amount}
              transactionType={transactionType}
              onPaymentUpdate={handlePaymentUpdate}
              provider={provider}
              transaction={transaction}
            />
          </div>
        </div>

        {/* Payment History */}
        <div>
          {payments && Array.isArray(payments) && payments.length > 0 && (
            <div className="space-y-4">
              {payments.map((payment, index) => (
                <div
                  key={payment.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors bg-background"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          {formatCurrency(payment.amount)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Pago #{index + 1} • {formatDate(payment.date)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Registrado
                      </div>
                      <div className="text-sm font-medium">
                        {formatDateTime(payment.createdAt)}
                      </div>
                    </div>
                  </div>

                  {payment.notes && (
                    <div className="mb-3 pl-11">
                      <div className="flex items-center space-x-2 mb-2">
                        <StickyNote className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Notas</span>
                      </div>
                      <div className="bg-muted/50 rounded p-3 text-sm">
                        {payment.notes}
                      </div>
                    </div>
                  )}

                  {payment.attachments && Array.isArray(payment.attachments) && payment.attachments.length > 0 && (
                    <div className="pl-11">
                      <div className="flex items-center space-x-2 mb-3">
                        <Paperclip className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium">
                          Documentos ({payment.attachments.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {payment.attachments.map((attachment, attachIndex) => (
                          <div
                            key={attachIndex}
                            className="border border-border rounded p-3 bg-background"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <FileText className="w-4 h-4 text-primary" />
                                <span className="text-xs font-medium text-primary uppercase">
                                  {attachment.fileType}
                                </span>
                              </div>
                            </div>
                            <div
                              className="text-sm font-medium mb-2 truncate"
                              title={attachment.fileName}
                            >
                              {attachment.fileName}
                            </div>
                            <div className="flex space-x-2">
                            <button
                              onClick={() =>
                                handleViewFile(attachment.fileUrl)
                              }
                              className="p-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary flex items-center rounded-sm"
                              title="Ver archivo"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Ver
                            </button>
                            <button
                              onClick={() =>
                                handleDownloadFile(
                                  attachment.fileUrl,
                                  attachment.fileName
                                )
                              }
                              className="p-1 text-xs bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-muted flex items-center rounded-sm"
                              title="Descargar archivo"
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Descargar
                            </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pt-4 border-t flex justify-between items-center">
          <button
            onClick={() => router.push("/admin/transacciones/historial")}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </button>

          {!['contador', 'director_general'].includes(userRole) && (
            <button
              onClick={() => {
                setDeleteReasonError(""); // Limpiar errores previos
                setDeleteReason(""); // Limpiar campo
                setShowDeleteModal(true);
              }}
              disabled={deleting}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {deleting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <Trash className="w-4 h-4" />
                  <span>Eliminar</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Delete Reason Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Confirmar eliminación</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Esta acción no se puede deshacer.
                  <span className="block mt-1 text-amber-600 font-medium">
                    ⚠️ El motivo de eliminación es obligatorio
                  </span>
                </p>
              </div>
              <div className="p-4 space-y-3">
                <label htmlFor="deleteReasonModal" className="block text-sm font-medium text-gray-700">
                  Motivo de eliminación <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="deleteReasonModal"
                  name="deleteReasonModal"
                  value={deleteReason}
                  onChange={(e) => handleDeleteReasonChange(e.target.value)}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                    deleteReasonError
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300'
                  }`}
                  placeholder="Escribe el motivo de eliminación..."
                  disabled={deleting}
                  required
                />
                {deleteReasonError && (
                  <p className="text-sm text-red-600 mt-1">{deleteReasonError}</p>
                )}
                <p className="text-xs text-gray-500">
                  Este campo es obligatorio para mantener un registro de auditoría.
                </p>
              </div>
              <div className="p-4 border-t flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setDeleteReasonError("");
                    setDeleteReason("");
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || !deleteReason.trim()}
                  className={`flex items-center px-4 py-2 text-sm font-medium text-white rounded-md focus:ring-2 focus:ring-red-500 ${
                    deleting || !deleteReason.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Eliminando...
                    </>
                  ) : (
                    <>Eliminar definitivamente</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Provider Details Modal */}
      {provider && (
        <ProviderDetailsModal
          isOpen={showProviderModal}
          onClose={() => setShowProviderModal(false)}
          provider={provider}
        />
      )}
    </AdminLayout>
  );
};

export default TransactionDetail;
