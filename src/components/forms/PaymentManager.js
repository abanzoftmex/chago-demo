import { useState, useEffect, useCallback } from "react";
import { paymentService } from "../../lib/services/paymentService";
import { useAuth } from "../../context/AuthContext";
import FileUpload from "../ui/FileUpload";
import Toast from "../ui/Toast";

const PaymentManager = ({
  transactionId,
  totalAmount,
  onPaymentUpdate,
  provider,
  transaction,
}) => {
  const { checkPermission } = useAuth();
  const canDeletePayments = checkPermission("canDeletePayments");
  
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
  const providerContacts = Array.isArray(provider?.contacts)
    ? provider.contacts
    : [];
  const providerContactEmails = providerContacts
    .map((c, idx) => ({
      index: idx,
      name: c.name || `Contacto ${idx + 1}`,
      email: c.email || "",
    }))
    .filter((c) => c.email && c.email.includes("@"));
  const [emailForm, setEmailForm] = useState({
    to: "",
    selectedContactIndex: providerContactEmails.length > 0 ? 0 : null,
    useOther: providerContactEmails.length === 0,
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

  const loadPaymentData = useCallback(async () => {
    try {
      setLoading(true);
      const summary = await paymentService.getPaymentSummary(transactionId);
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
  }, [transactionId]);
  // Load payment data on mount
  useEffect(() => {
    if (transactionId) {
      loadPaymentData();
    }
  }, [loadPaymentData, transactionId]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

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
    console.log("Files received in handleFileUpload:", files);

    // Log each file's properties individually
    files.forEach((file, index) => {
      console.log(`File ${index}:`, {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        webkitRelativePath: file.webkitRelativePath,
      });
    });

    // Create previews for image files
    const filesWithPreviews = await Promise.all(
      files.map(async (file) => {
        console.log("Processing file:", file.name, file.type, file.size);

        // Ensure we preserve all file properties
        const fileWithProperties = {
          name: file.name,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          // Preserve the original File object properties
          ...file,
        };

        if (file.type && file.type.startsWith("image/")) {
          const preview = await createImagePreview(file);
          console.log("Preview created for:", file.name);
          return { ...fileWithProperties, preview };
        }
        return fileWithProperties;
      })
    );

    console.log("Files with previews:", filesWithPreviews);
    setFormFiles((prev) => [...prev, ...filesWithPreviews]);
  };

  // Create image preview
  const createImagePreview = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  };

  // Handle file removal
  const handleFileRemove = (fileToRemove) => {
    console.log("Removing file:", fileToRemove);
    console.log("Current formFiles:", formFiles);

    // Find the file by name and remove it
    setFormFiles((prev) => {
      const updatedFiles = prev.filter(
        (file) => file.name !== fileToRemove.fileName
      );

      console.log("Updated files after removal:", updatedFiles);

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

      const created = await paymentService.create(paymentData, formFiles);

      // Reset form
      setFormData({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });

      // Clean up previews before clearing files
      formFiles.forEach((file) => {
        if (file.preview && file.preview.startsWith("blob:")) {
          URL.revokeObjectURL(file.preview);
        }
      });

      setFormFiles([]);
      setShowForm(false);

      // Reload data
      await loadPaymentData();

      // Notify parent component
      if (onPaymentUpdate) {
        onPaymentUpdate();
      }

      setToast({
        type: "success",
        message: "Pago registrado exitosamente",
      });

      // Prepare email modal with defaults
      setLastCreatedPayment(created);
      setEmailError("");
      setEmailForm((prev) => ({
        ...prev,
        selectedContactIndex: providerContactEmails.length > 0 ? 0 : null,
        useOther: providerContactEmails.length === 0,
        to:
          providerContactEmails.length > 0
            ? providerContactEmails[0].email
            : "",
        includeReceiptLinks: (created?.attachments || []).length > 0,
      }));
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

  // Delete payment
  const handleDeletePayment = async (paymentId) => {
    if (!confirm("¿Estás seguro de que deseas eliminar este pago?")) {
      return;
    }

    try {
      await paymentService.delete(paymentId);
      await loadPaymentData();

      if (onPaymentUpdate) {
        onPaymentUpdate();
      }

      setToast({
        type: "success",
        message: "Pago eliminado exitosamente",
      });
    } catch (error) {
      console.error("Error deleting payment:", error);
      setToast({
        type: "error",
        message: error.message || "Error al eliminar el pago",
      });
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
    const badges = {
      pendiente: "bg-red-100 text-red-800",
      parcial: "bg-yellow-100 text-yellow-800",
      pagado: "bg-green-100 text-green-800",
    };

    const labels = {
      pendiente: "Pendiente",
      parcial: "Parcial",
      pagado: "Pagado",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          badges[status] || badges.pendiente
        }`}
      >
        {labels[status] || labels.pendiente}
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
      {/* Payment Summary */}
      {paymentSummary && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Resumen de Pagos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Monto Total</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(paymentSummary.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Pagado</p>
              <p className="text-lg font-semibold text-green-600">
                {formatCurrency(paymentSummary.totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">
                Saldo Pendiente
              </p>
              <p className="text-lg font-semibold text-red-600">
                {formatCurrency(paymentSummary.balance)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Estado</p>
              <div className="mt-1">
                {getStatusBadge(paymentSummary.status)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Button */}
      {paymentSummary && paymentSummary.balance > 0 && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            Historial de Pagos
          </h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            {showForm ? "Cancelar" : "Registrar Pago"}
          </button>
        </div>
      )}

      {/* Payment Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Nuevo Pago</h4>
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
                  type="number"
                  id="amount"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  max={paymentSummary?.balance || totalAmount}
                  value={formData.amount}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-orange-500 ${
                    formErrors.amount ? "border-red-300" : ""
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
                  className={`mt-1 block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-orange-500 ${
                    formErrors.date ? "border-red-300" : ""
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
                existingFiles={formFiles.map((file) => ({
                  fileName: file.name || "Archivo sin nombre",
                  fileType: file.type || "application/octet-stream",
                  fileSize: file.size || 0,
                  fileUrl: null, // No URL for files that haven't been uploaded yet
                  preview: file.preview || null, // Include preview if available
                }))}
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  // Clean up previews when canceling
                  formFiles.forEach((file) => {
                    if (file.preview && file.preview.startsWith("blob:")) {
                      URL.revokeObjectURL(file.preview);
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
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-medium text-gray-900">
              Pagos Registrados ({payments.length})
            </h4>
          </div>
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
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
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

                  <div className="ml-4">
                    {canDeletePayments && (
                      <button
                        onClick={() => handleDeletePayment(payment.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
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
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No hay pagos registrados
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Comienza registrando el primer pago para esta transacción.
          </p>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
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
                onClick={async () => {
                  // Validate email
                  const email = String(emailForm.to || "").trim();
                  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                  if (!isValid) {
                    setEmailError("Ingresa un correo válido");
                    return;
                  }
                  try {
                    setEmailSending(true);
                    setEmailError("");
                    const amount = lastCreatedPayment?.amount || 0;
                    const date = lastCreatedPayment?.date
                      ? new Date(lastCreatedPayment.date).toLocaleDateString(
                          "es-MX"
                        )
                      : new Date().toLocaleDateString("es-MX");
                    const txId = transaction?.id;
                    
                    // Obtener información del concepto si está disponible
                    let conceptName = "N/A";
                    if (transaction?.conceptId) {
                      try {
                        const conceptResponse = await fetch(`/api/concepts/${transaction.conceptId}`);
                        if (conceptResponse.ok) {
                          const conceptData = await conceptResponse.json();
                          conceptName = conceptData.name || "N/A";
                        }
                      } catch (err) {
                        console.error("Error fetching concept:", err);
                      }
                    }
                    
                    // Calcular saldo restante
                    const totalAmount = transaction?.amount || 0;
                    const totalPaid = paymentSummary?.totalPaid || amount;
                    const remainingBalance = totalAmount - totalPaid;
                    
                    // Obtener información del proveedor
                    let providerDetails = "";
                    if (provider) {
                      providerDetails = `
                        <li>
                          <strong>Proveedor:</strong> ${provider.name || "N/A"}
                          ${provider.rfc ? `<br>RFC: ${provider.rfc}` : ""}
                        </li>
                      `;
                      
                      // Añadir información de cuenta bancaria si está disponible
                      if (provider.bankAccounts && provider.bankAccounts.length > 0) {
                        const primaryAccount = provider.bankAccounts[0];
                        providerDetails += `
                          <li>
                            <strong>Cuenta bancaria:</strong>
                            <ul>
                              <li>Banco: ${primaryAccount.bank || 'N/A'}</li>
                              <li>Cuenta: ${primaryAccount.accountNumber || 'N/A'}</li>
                              <li>CLABE: ${primaryAccount.clabe || 'N/A'}</li>
                            </ul>
                          </li>
                        `;
                      }
                    }
                    
                    // Importar el template de correo
                    const { createEmailTemplate, createPaymentReceiptContent } = await import('../../../lib/emailTemplates');
                    
                    const subject = `Comprobante de pago - ${conceptName}${txId ? ` - #${String(txId).slice(-8)}` : ""}`;
                    const detailUrl = txId
                      ? `${window.location.origin}/admin/transacciones/detalle/${txId}`
                      : null;
                    const attachments = lastCreatedPayment?.attachments || [];
                    const linksHtml =
                      emailForm.includeReceiptLinks && attachments.length > 0
                        ? `<div class="data-container">
                            <h3>Comprobantes adjuntos:</h3>
                            <ul class="data-list">
                              ${attachments.map((a) => `<li><a href="${a.fileUrl}">${a.fileName}</a></li>`).join("")}
                            </ul>
                          </div>`
                        : "";
                    
                    // Añadir notas si existen
                    const notesHtml = lastCreatedPayment?.notes
                      ? `<p><strong>Notas:</strong> ${lastCreatedPayment.notes}</p>`
                      : "";
                    
                    // Crear el contenido del correo usando el template
                    const emailContent = createPaymentReceiptContent({
                      amount,
                      date,
                      conceptName,
                      providerDetails,
                      totalAmount,
                      totalPaid,
                      remainingBalance,
                      txId,
                      notesHtml,
                      detailUrl,
                      linksHtml
                    });
                    
                    // Aplicar el template completo
                    const html = createEmailTemplate({
                      title: 'Comprobante de Pago',
                      content: emailContent
                    });
                    await fetch("/api/email/send", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ to: email, subject, html }),
                    });
                    setShowEmailModal(false);
                    setToast({ type: "success", message: "Correo enviado" });
                  } catch (err) {
                    console.error("Error sending email:", err);
                    setEmailError("Error al enviar el correo");
                  } finally {
                    setEmailSending(false);
                  }
                }}
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
