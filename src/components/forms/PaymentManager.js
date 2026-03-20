import { useState, useEffect, useCallback, useMemo } from "react";
import { paymentService } from "../../lib/services/paymentService";
import { useAuth } from "../../context/AuthContextMultiTenant";
import FileUpload from "../ui/FileUpload";
import Toast from "../ui/Toast";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { sendEmailWithRateLimit } from "../../lib/utils";
import { createEmailTemplate, createPaymentReceiptContent } from "../../lib/emailTemplates";

// Pure helper — defined outside component to avoid recreation on every render
const createImagePreview = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

const PaymentManager = ({
  transactionId,
  onPaymentUpdate,
  provider,
  transaction,
}) => {
  const { checkPermission, userRole, tenantInfo } = useAuth();
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);
  const canDeletePayments = checkPermission ? checkPermission("canDeletePayments") : false;
  const canRegisterPayments = !['director', 'director_general'].includes(userRole);

  const providerContactEmails = useMemo(() => {
    const contacts = Array.isArray(provider?.contacts) ? provider.contacts : [];
    return contacts
      .map((c, idx) => ({
        index: idx,
        name: c.name || `Contacto ${idx + 1}`,
        email: c.email || "",
      }))
      .filter((c) => c.email && c.email.includes("@"));
  }, [provider?.contacts]);

  const [payments, setPayments] = useState([]);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [lastCreatedPayment, setLastCreatedPayment] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailForm, setEmailForm] = useState({
    to: "",
    selectedContactIndex: null,
    useOther: true,
    includeReceiptLinks: true,
  });

  // Form state
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [formFiles, setFormFiles] = useState([]);
  const [formErrors, setFormErrors] = useState({});

  // Edit payment state
  const [editingPayment, setEditingPayment] = useState(null); // payment being edited
  const [editFormData, setEditFormData] = useState({ amount: "", date: "", notes: "" });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingPayment, setDeletingPayment] = useState(null); // payment pending deletion
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const loadPaymentData = useCallback(async () => {
    try {
      setLoading(true);
      const summary = await paymentService.getPaymentSummary(transactionId, tenantId);
      setPaymentSummary(summary);
      setPayments(summary.payments);
    } catch (error) {
      console.error("Error loading payment data:", error);
      setToast({
        type: "error",
        message: "Error al cargar los datos de pagos",
      });
    } finally {
      setLoading(false);
    }
  }, [transactionId, tenantId]);
  // Load payment data on mount
  useEffect(() => {
    if (transactionId) {
      loadPaymentData();
    }
  }, [loadPaymentData, transactionId]);

  // Format number with commas helper function
  const formatNumberWithCommas = (value) => {
    // Ensure value is a string and handle null/undefined
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const stringValue = String(value);

    // Remove non-numeric characters except decimal point
    const numericValue = stringValue.replace(/[^0-9.]/g, '');

    // Split into integer and decimal parts
    const parts = numericValue.split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';

    // Add thousand separators to integer part
    if (integerPart) {
      integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    return integerPart + decimalPart;
  };

  const parseFormattedNumber = (value) => {
    // Ensure value is a string and handle null/undefined
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const stringValue = String(value);

    // Remove all non-numeric characters except decimal point
    return stringValue.replace(/[^0-9.]/g, '');
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Special handling for amount field
    if (name === 'amount') {
      // If empty, set empty string
      if (value === '') {
        setFormData(prev => ({
          ...prev,
          [name]: ''
        }));
        return;
      }

      // Format the number with commas
      const formattedValue = formatNumberWithCommas(value);

      // Update the display value with formatting
      e.target.value = formattedValue;

      // Store the raw numeric value in form state (without commas)
      const rawValue = parseFormattedNumber(formattedValue);

      setFormData(prev => ({
        ...prev,
        [name]: rawValue
      }));
    } else {
      // For all other fields, update normally
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }

    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  // Handle file upload
  const handleFileUpload = async (files) => {



    // Create previews for image files
    const filesWithPreviews = await Promise.all(
      files.map(async (file) => {
        const fileWrapper = {
          file: file, // Original File object, completely untouched
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified
        };

        if (file.type && file.type.startsWith("image/")) {
          const preview = await createImagePreview(file);
          fileWrapper.preview = preview; // Add preview to wrapper, not to File
        }

        return fileWrapper;
      })
    );

    setFormFiles((prev) => [...prev, ...filesWithPreviews]);
  };

  // Handle file removal
  const handleFileRemove = (fileToRemove) => {

    // Find the file by name and remove it
    setFormFiles((prev) => {
      const updatedFiles = prev.filter(
        (file) => file.name !== fileToRemove.fileName
      );


      // Find the actual file object to revoke its preview URL
      const fileToRevoke = prev.find(
        (file) => file.name === fileToRemove.fileName
      );
      if (
        fileToRevoke &&
        fileToRevoke.preview &&
        fileToRevoke.preview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(fileToRevoke.preview);
      }

      return updatedFiles;
    });
  };

  // Validate form
  const validateForm = () => {
    const errors = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      errors.amount = "El monto debe ser mayor a 0";
    }

    if (
      paymentSummary &&
      parseFloat(formData.amount) > paymentSummary.balance
    ) {
      errors.amount = "El monto no puede ser mayor al saldo pendiente";
    }

    if (!formData.date) {
      errors.date = "La fecha es requerida";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit payment
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);

      const paymentData = {
        transactionId,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date),
        notes: formData.notes,
      };



      // Extract original File objects from wrappers
      const originalFiles = formFiles.map(fileWrapper => fileWrapper.file);

      const created = await paymentService.create(paymentData, originalFiles, tenantId);

      // Reset form
      setFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });

      // Clean up previews before clearing files
      formFiles.forEach((fileWrapper) => {
        if (fileWrapper.preview && fileWrapper.preview.startsWith("blob:")) {
          URL.revokeObjectURL(fileWrapper.preview);
        }
      });

      setFormFiles([]);
      setShowForm(false);

      // Reload data
      await loadPaymentData();

      // Notify parent to refresh progress bar
      if (onPaymentUpdate) {
        onPaymentUpdate();
      }

      setToast({
        type: "success",
        message: "Pago registrado exitosamente",
      });

      // Prepare and open email modal
      setLastCreatedPayment(created);
      setEmailError("");
      setEmailForm({
        selectedContactIndex: providerContactEmails.length > 0 ? 0 : null,
        useOther: providerContactEmails.length === 0,
        to: providerContactEmails.length > 0 ? providerContactEmails[0].email : "",
        includeReceiptLinks: (created?.attachments || []).length > 0,
      });
      setShowEmailModal(true);
    } catch (error) {
      console.error("Error creating payment:", error);
      setToast({
        type: "error",
        message: error.message || "Error al registrar el pago",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete payment — opens confirmation modal
  const handleDeletePayment = (payment) => {
    setDeletingPayment(payment);
  };

  const confirmDeletePayment = async () => {
    if (!deletingPayment) return;
    setDeleteSubmitting(true);
    try {
      await paymentService.delete(deletingPayment.id, tenantId);
      setDeletingPayment(null);
      await loadPaymentData();
      onPaymentUpdate?.();
      setToast({ type: "success", message: "Pago eliminado exitosamente" });
    } catch (error) {
      console.error("Error deleting payment:", error);
      setToast({ type: "error", message: error.message || "Error al eliminar el pago" });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Edit payment — opens edit modal pre-populated
  const handleEditPayment = (payment) => {
    const dateObj = payment.date?.toDate ? payment.date.toDate() : new Date(payment.date);
    const dateStr = dateObj.toISOString().split("T")[0];
    setEditFormData({
      amount: String(payment.amount),
      date: dateStr,
      notes: payment.notes || "",
    });
    setEditFormErrors({});
    setEditingPayment(payment);
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
    if (editFormErrors[name]) {
      setEditFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(String(editFormData.amount).replace(/,/g, ""));
    const errors = {};
    if (!amount || amount <= 0) errors.amount = "El monto debe ser mayor a 0";
    if (!editFormData.date) errors.date = "La fecha es requerida";
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    setEditSubmitting(true);
    try {
      await paymentService.update(
        editingPayment.id,
        { amount, date: new Date(editFormData.date + "T12:00:00"), notes: editFormData.notes },
        [],
        tenantId
      );
      setEditingPayment(null);
      await loadPaymentData();
      onPaymentUpdate?.();
      setToast({ type: "success", message: "Pago actualizado exitosamente" });
    } catch (error) {
      console.error("Error updating payment:", error);
      setToast({ type: "error", message: error.message || "Error al actualizar el pago" });
    } finally {
      setEditSubmitting(false);
    }
  };

  // Send payment receipt email
  const handleSendEmail = async () => {
    const email = String(emailForm.to || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Ingresa un correo válido");
      return;
    }
    try {
      setEmailSending(true);
      setEmailError("");

      const amount = lastCreatedPayment?.amount || 0;
      const date = lastCreatedPayment?.date
        ? new Date(lastCreatedPayment.date).toLocaleDateString("es-MX")
        : new Date().toLocaleDateString("es-MX");
      const txId = transaction?.id;
      const totalAmount = transaction?.amount || 0;
      const totalPaid = paymentSummary?.totalPaid || amount;
      const remainingBalance = totalAmount - totalPaid;

      let conceptName = "N/A";
      if (transaction?.conceptId) {
        try {
          const res = await fetch(`/api/concepts/${transaction.conceptId}`);
          if (res.ok) {
            const data = await res.json();
            conceptName = data.name || "N/A";
          }
        } catch { /* fallback to N/A */ }
      }

      let providerDetails = "";
      if (provider) {
        providerDetails = `<li><strong>Proveedor:</strong> ${provider.name || "N/A"}${provider.rfc ? `<br>RFC: ${provider.rfc}` : ""}</li>`;
        if (provider.bankAccounts?.length > 0) {
          const acc = provider.bankAccounts[0];
          providerDetails += `<li><strong>Cuenta bancaria:</strong><ul><li>Banco: ${acc.bank || "N/A"}</li><li>Cuenta: ${acc.accountNumber || "N/A"}</li><li>CLABE: ${acc.clabe || "N/A"}</li></ul></li>`;
        }
      }

      const attachments = lastCreatedPayment?.attachments || [];
      const linksHtml = emailForm.includeReceiptLinks && attachments.length > 0
        ? `<div class="data-container"><h3>Comprobantes adjuntos:</h3><ul class="data-list">${attachments.map((a) => `<li><a href="${a.fileUrl}">${a.fileName}</a></li>`).join("")}</ul></div>`
        : "";
      const notesHtml = lastCreatedPayment?.notes
        ? `<p><strong>Notas:</strong> ${lastCreatedPayment.notes}</p>`
        : "";
      const detailUrl = txId ? `${window.location.origin}/admin/transacciones/detalle/${txId}` : null;

      const subject = `Comprobante de pago - ${conceptName}${txId ? ` - #${String(txId).slice(-8)}` : ""}`;
      const emailContent = createPaymentReceiptContent({ amount, date, conceptName, providerDetails, totalAmount, totalPaid, remainingBalance, txId, notesHtml, detailUrl, linksHtml });
      const html = createEmailTemplate({ title: "Comprobante de Pago", content: emailContent });

      await sendEmailWithRateLimit(email, subject, html);
      setShowEmailModal(false);
      setToast({ type: "success", message: "Correo enviado" });
    } catch (err) {
      console.error("Error sending email:", err);
      setEmailError("Error al enviar el correo");
    } finally {
      setEmailSending(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return "";
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString("es-MX");
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const config = {
      pagado: {
        className: "bg-green-100 text-green-800",
        icon: <CheckCircle className="w-3.5 h-3.5" />,
        label: "Pagado",
      },
      parcial: {
        className: "bg-amber-100 text-amber-800",
        icon: <Clock className="w-3.5 h-3.5" />,
        label: "Parcial",
      },
      pendiente: {
        className: "bg-red-100 text-red-800",
        icon: <AlertCircle className="w-3.5 h-3.5" />,
        label: "Pendiente",
      },
    };
    const { className, icon, label } = config[status] ?? config.pendiente;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>
        {icon}
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen General */}
      {paymentSummary && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Resumen General
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Monto Total</p>
              <p className="text-lg font-bold text-gray-900">
                {formatCurrency(paymentSummary.totalAmount)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Total Pagado</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(paymentSummary.totalPaid)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Saldo Pendiente</p>
              <p className="text-lg font-bold text-red-600">
                {formatCurrency(paymentSummary.balance)}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Estado</p>
              <div className="mt-1">
                {getStatusBadge(paymentSummary.status)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historial de Pagos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-gray-900">
            Historial de Pagos
            {payments.length > 0 && (
              <span className="ml-2 text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                {payments.length}
              </span>
            )}
          </h3>
          {canRegisterPayments && paymentSummary && paymentSummary.balance > 0 && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
              {showForm ? "Cancelar" : "Registrar Pago"}
            </button>
          )}
        </div>

        {/* Payment Form */}
        {showForm && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h4 className="text-base font-medium text-gray-900 mb-4">Nuevo Pago</h4>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="amount"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Monto *
                  </label>
                  <input
                    type="text"
                    id="amount"
                    name="amount"
                    value={formatNumberWithCommas(formData.amount)}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-orange-500 ${formErrors.amount ? "border-red-300" : ""
                      }`}
                    placeholder="0.00"
                  />
                  {formErrors.amount && (
                    <p className="mt-1 text-sm text-red-600">
                      {formErrors.amount}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="date"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Fecha *
                  </label>
                  <input
                    type="date"
                    id="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className={`mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-orange-500 ${formErrors.date ? "border-red-300" : ""
                      }`}
                  />
                  {formErrors.date && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.date}</p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700"
                >
                  Notas
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-orange-500"
                  placeholder="Notas adicionales sobre el pago..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Documentos Adjuntos
                </label>
                <FileUpload
                  onUpload={handleFileUpload}
                  onRemove={handleFileRemove}
                  existingFiles={formFiles.map((fileWrapper) => ({
                    fileName: fileWrapper.name || "Archivo sin nombre",
                    fileType: fileWrapper.type || "application/octet-stream",
                    fileSize: fileWrapper.size || 0,
                    fileUrl: null,
                    preview: fileWrapper.preview || null,
                  }))}
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    formFiles.forEach((fileWrapper) => {
                      if (fileWrapper.preview && fileWrapper.preview.startsWith("blob:")) {
                        URL.revokeObjectURL(fileWrapper.preview);
                      }
                    });
                    setFormFiles([]);
                    setShowForm(false);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    "Guardar Pago"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Payments List */}
        {payments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-200">
              {payments.map((payment) => (
                <div key={payment.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="text-lg font-semibold text-gray-900">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(payment.date)}
                          </p>
                        </div>
                        {payment.notes && (
                          <div className="flex-1">
                            <p className="text-sm text-gray-600">
                              {payment.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Attachments */}
                      {payment.attachments && payment.attachments.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            Documentos adjuntos:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {payment.attachments.map((attachment, index) => (
                              <a
                                key={index}
                                href={attachment.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 no-underline"
                                title={`Ver ${attachment.fileName}`}
                              >
                                <svg
                                  className="w-3 h-3 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                  />
                                </svg>
                                {attachment.fileName}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                      {canRegisterPayments && (
                        <button
                          onClick={() => handleEditPayment(payment)}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                          title="Editar pago"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Editar
                        </button>
                      )}
                      {canDeletePayments && (
                        <button
                          onClick={() => handleDeletePayment(payment)}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors"
                          title="Eliminar pago"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {payments.length === 0 && !loading && (
          <div className="text-center py-10 bg-white border border-gray-200 rounded-lg">
            <svg
              className="mx-auto h-10 w-10 text-gray-300"
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
            <p className="mt-2 text-sm font-medium text-gray-500">No hay pagos registrados</p>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Editar Pago</h3>
              <button
                onClick={() => setEditingPayment(null)}
                disabled={editSubmitting}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdatePayment} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto *</label>
                  <input
                    type="text"
                    name="amount"
                    value={formatNumberWithCommas(editFormData.amount)}
                    onChange={handleEditInputChange}
                    className={`block w-full px-3 py-2 rounded-md border text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 ${editFormErrors.amount ? "border-red-300" : "border-gray-300"}`}
                    placeholder="0.00"
                  />
                  {editFormErrors.amount && <p className="mt-1 text-xs text-red-600">{editFormErrors.amount}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
                  <input
                    type="date"
                    name="date"
                    value={editFormData.date}
                    onChange={handleEditInputChange}
                    className={`block w-full px-3 py-2 rounded-md border text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 ${editFormErrors.date ? "border-red-300" : "border-gray-300"}`}
                  />
                  {editFormErrors.date && <p className="mt-1 text-xs text-red-600">{editFormErrors.date}</p>}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  name="notes"
                  rows={3}
                  value={editFormData.notes}
                  onChange={handleEditInputChange}
                  className="block w-full px-3 py-2 rounded-md border border-gray-300 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Notas adicionales..."
                />
              </div>
              {editingPayment.attachments && editingPayment.attachments.length > 0 && (
                <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2">
                  <p className="text-xs text-blue-700">
                    Este pago tiene {editingPayment.attachments.length} documento(s) adjunto(s). Los archivos existentes se conservan; para modificarlos elimina este pago y vuelve a registrarlo.
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  disabled={editSubmitting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Guardando...
                    </>
                  ) : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Payment Confirmation Modal */}
      {deletingPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
            <div className="p-5 border-b">
              <h3 className="text-base font-semibold text-gray-900">Confirmar eliminación</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3 rounded-md bg-red-50 border border-red-200 p-3">
                <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-red-700">
                  Vas a eliminar el pago de <strong>{formatCurrency(deletingPayment.amount)}</strong> del <strong>{formatDate(deletingPayment.date)}</strong>. Esta acción no se puede deshacer.
                </p>
              </div>
              {deletingPayment.attachments && deletingPayment.attachments.length > 0 && (
                <p className="text-xs text-gray-500">
                  También se eliminarán los {deletingPayment.attachments.length} archivo(s) adjunto(s).
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button
                onClick={() => setDeletingPayment(null)}
                disabled={deleteSubmitting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeletePayment}
                disabled={deleteSubmitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Eliminando...
                  </>
                ) : "Eliminar pago"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Receipt Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Enviar comprobante por correo
              </h3>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={emailSending}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
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
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                ¿Deseas enviar el comprobante del pago de{" "}
                {formatCurrency(lastCreatedPayment?.amount || 0)}
                {transaction
                  ? ` de la transacción #${String(transaction.id).slice(-8)}`
                  : ""}
                ?
              </p>

              {/* Recipient selector */}
              {provider && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Proveedor
                  </label>
                  <p className="text-sm text-gray-900 font-medium">
                    {provider?.name || ""}
                  </p>
                </div>
              )}

              {providerContactEmails.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enviar a contacto
                  </label>
                  <select
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                    value={
                      emailForm.useOther
                        ? "other"
                        : String(emailForm.selectedContactIndex)
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "other") {
                        setEmailForm((prev) => ({
                          ...prev,
                          useOther: true,
                          selectedContactIndex: null,
                          to: "",
                        }));
                      } else {
                        const idx = parseInt(val, 10);
                        const sel = providerContactEmails[idx];
                        setEmailForm((prev) => ({
                          ...prev,
                          useOther: false,
                          selectedContactIndex: idx,
                          to: sel?.email || "",
                        }));
                      }
                      setEmailError("");
                    }}
                    disabled={emailSending}
                  >
                    {providerContactEmails.map((c, idx) => (
                      <option key={idx} value={String(idx)}>
                        {c.name} — {c.email}
                      </option>
                    ))}
                    <option value="other">Otro correo…</option>
                  </select>
                </div>
              )}

              {/* Manual email input */}
              {(emailForm.useOther || providerContactEmails.length === 0) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Correo del destinatario
                  </label>
                  <input
                    type="email"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${emailError ? "border-red-300" : "border-gray-300"}`}
                    placeholder="correo@cliente.com"
                    value={emailForm.to}
                    onChange={(e) => {
                      setEmailForm((prev) => ({ ...prev, to: e.target.value }));
                      setEmailError("");
                    }}
                    disabled={emailSending}
                  />
                  {emailError && (
                    <p className="mt-1 text-sm text-red-600">{emailError}</p>
                  )}
                </div>
              )}

              {/* Include receipt toggle */}
              <div className="flex items-center">
                <input
                  id="includeReceipt"
                  type="checkbox"
                  className="mr-2"
                  checked={
                    emailForm.includeReceiptLinks &&
                    (lastCreatedPayment?.attachments || []).length > 0
                  }
                  onChange={(e) =>
                    setEmailForm((prev) => ({
                      ...prev,
                      includeReceiptLinks: e.target.checked,
                    }))
                  }
                  disabled={
                    emailSending ||
                    (lastCreatedPayment?.attachments || []).length === 0
                  }
                />
                <label
                  htmlFor="includeReceipt"
                  className="text-sm text-gray-700"
                >
                  Incluir enlace(s) del comprobante adjunto
                  {(lastCreatedPayment?.attachments || []).length === 0
                    ? " (no hay archivos adjuntos)"
                    : ""}
                </label>
              </div>

              {emailForm.includeReceiptLinks &&
                (lastCreatedPayment?.attachments || []).length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <p className="text-xs text-gray-600 mb-2">
                      Se enviarán los siguientes enlaces:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      {lastCreatedPayment.attachments.map((a, i) => (
                        <li key={i} className="text-xs break-all">
                          <a
                            href={a.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {a.fileName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
                onClick={() => setShowEmailModal(false)}
                disabled={emailSending}
              >
                Omitir
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 disabled:opacity-50 flex items-center"
                onClick={handleSendEmail}
                disabled={emailSending}
              >
                {emailSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Enviando...
                  </>
                ) : (
                  "Enviar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentManager;
