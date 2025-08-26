import React, { useState, useRef } from "react";
import { transactionService } from "../../lib/services/transactionService";
import ConceptSelector from "./ConceptSelector";
import SubconceptSelector from "./SubconceptSelector";
import ProviderSelector from "./ProviderSelector";
import ConceptModal from "./ConceptModal";
import SubconceptModal from "./SubconceptModal";
import { useToast } from "../ui/Toast";
import { settingsService } from "../../lib/services/settingsService";
import { useAuth } from "../../context/AuthContext";
import { generalService } from "../../lib/services/generalService";
import FileUpload from "../ui/FileUpload";
import { conceptService } from "../../lib/services/conceptService";
import { subconceptService } from "../../lib/services/subconceptService";
import { paymentService } from "../../lib/services/paymentService";
import { recurringExpenseService } from "../../lib/services/recurringExpenseService";

const TransactionForm = ({
  type,
  onSuccess,
  onCancel,
  initialData = null,
  className = "",
}) => {
  const [formData, setFormData] = useState(() => {
    // Inicializar la fecha correctamente para evitar problemas de zona horaria
    let initialDate;
    
    if (initialData?.date) {
      // Si hay datos iniciales, usar esos datos
      const dateObj = initialData.date.toDate ? initialData.date.toDate() : new Date(initialData.date.seconds * 1000);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Meses en JS son 0-11
      const day = String(dateObj.getDate()).padStart(2, '0');
      initialDate = `${year}-${month}-${day}`;
    } else {
      // Si no hay datos iniciales, usar la fecha actual
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0'); // Meses en JS son 0-11
      const day = String(today.getDate()).padStart(2, '0');
      initialDate = `${year}-${month}-${day}`;
    }
    
    return {
      type: type || initialData?.type || "entrada",
      generalId: initialData?.generalId || "",
      conceptId: initialData?.conceptId || "",
      subconceptId: initialData?.subconceptId || "",
      description: initialData?.description || "",
      amount: initialData?.amount || "",
      date: initialDate,
      providerId: initialData?.providerId || "", // Only for salidas
      division: initialData?.division || "general", // Nueva opción para categorizar gastos
      isRecurring: initialData?.isRecurring || false, // Toggle para gastos recurrentes
    };
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showSubconceptModal, setShowSubconceptModal] = useState(false);
  const [generals, setGenerals] = useState([]);
  const [loadingGenerals, setLoadingGenerals] = useState(false);
  const [generalsError, setGeneralsError] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);

  const formatSize = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const conceptSelectorRef = useRef();
  const subconceptSelectorRef = useRef();
  const providerSelectorRef = useRef();
  const toast = useToast();
  const { user } = useAuth();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleConceptChange = (conceptId) => {
    setFormData((prev) => ({
      ...prev,
      conceptId,
      subconceptId: "", // Reset subconcept when concept changes
    }));

    if (errors.conceptId) {
      setErrors((prev) => ({
        ...prev,
        conceptId: null,
      }));
    }
  };

  const handleSubconceptChange = (subconceptId) => {
    setFormData((prev) => ({
      ...prev,
      subconceptId,
    }));

    if (errors.subconceptId) {
      setErrors((prev) => ({
        ...prev,
        subconceptId: null,
      }));
    }
  };

  const handleProviderChange = (providerId) => {
    setFormData((prev) => ({
      ...prev,
      providerId,
    }));

    if (errors.providerId) {
      setErrors((prev) => ({
        ...prev,
        providerId: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.generalId) {
      newErrors.generalId = "La categoría general es requerida";
    }

    if (!formData.conceptId) {
      newErrors.conceptId = "El concepto es requerido";
    }

    if (!formData.subconceptId) {
      newErrors.subconceptId = "El subconcepto es requerido";
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "El monto debe ser mayor a 0";
    }

    if (!formData.date) {
      newErrors.date = "La fecha es requerida";
    }

    // For salidas, provider is required
    if (formData.type === "salida" && !formData.providerId) {
      newErrors.providerId = "El proveedor es requerido para salidas";
    }

    return newErrors;
  };

  // Load generals when form mounts or type changes
  React.useEffect(() => {
    const loadGenerals = async () => {
      try {
        setLoadingGenerals(true);
        setGeneralsError(null);
        const allGenerals = await generalService.getAll();
        // Filter by transaction type if provided
        const filtered = allGenerals.filter(g => !formData.type || g.type === formData.type);
        setGenerals(filtered);
      } catch (err) {
        setGeneralsError(err.message);
      } finally {
        setLoadingGenerals(false);
      }
    };
    loadGenerals();
  }, [formData.type]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      // Prepare data for submission
      // Crear la fecha correctamente para evitar problemas de zona horaria
      const dateComponents = formData.date.split('-');
      const year = parseInt(dateComponents[0]);
      const month = parseInt(dateComponents[1]) - 1; // Meses en JS son 0-11
      const day = parseInt(dateComponents[2]);
      
      const transactionData = {
        type: formData.type,
        generalId: formData.generalId,
        conceptId: formData.conceptId,
        subconceptId: formData.subconceptId,
        description: formData.description,
        amount: parseFloat(formData.amount),
        date: new Date(year, month, day),
      };

      // Add providerId and division only for salidas
      if (formData.type === "salida") {
        transactionData.providerId = formData.providerId;
        transactionData.division = formData.division;
      }

      let result;
      if (initialData) {
        // Update existing transaction
        result = await transactionService.update(
          initialData.id,
          transactionData,
          user
        );
        toast.success("Transacción actualizada exitosamente");
      } else {
        // Create new transaction
        result = await transactionService.create(transactionData, user);
        
        // If it's a recurring expense, also create the recurring expense record
        if (formData.type === "salida" && formData.isRecurring) {
          const recurringData = {
            generalId: formData.generalId,
            conceptId: formData.conceptId,
            subconceptId: formData.subconceptId,
            description: formData.description,
            amount: parseFloat(formData.amount),
            providerId: formData.providerId,
            division: formData.division,
          };
          
          await recurringExpenseService.create(recurringData, user);
          toast.success("Gasto recurrente configurado exitosamente");
        }
        // Upload optional attachments and save on transaction
        if (files.length > 0) {
          try {
            setUploadingAttachments(true);
            setAttachmentProgress(0);
            const attachments = [];
            
            toast.info(`Subiendo ${files.length} archivo(s)...`);
            
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              console.log(`Uploading file ${i + 1}/${files.length}:`, file.name);
              
              try {
                const attachment = await paymentService.uploadFile(file, result.id);
                attachments.push(attachment);
                console.log(`File ${file.name} uploaded successfully:`, attachment);
              } catch (fileError) {
                console.error(`Error uploading file ${file.name}:`, fileError);
                toast.error(`Error subiendo ${file.name}: ${fileError.message}`);
              }
              
              const progress = Math.round(((i + 1) / files.length) * 100);
              setAttachmentProgress(progress);
            }
            
            if (attachments.length > 0) {
              await transactionService.update(result.id, { attachments }, user);
              toast.success(`${attachments.length} archivo(s) subido(s) exitosamente`);
            }
            
            if (attachments.length < files.length) {
              const failedCount = files.length - attachments.length;
              toast.warning(`${failedCount} archivo(s) no se pudieron subir`);
            }
            
          } catch (err) {
            console.error("Error uploading attachments:", err);
            toast.error("Error general subiendo archivos: " + err.message);
          } finally {
            setUploadingAttachments(false);
          }
        }
        toast.success("Transacción creada exitosamente");
        // If it's an expense (salida), notify accountant
        if (transactionData.type === "salida") {
          try {
                const { accountantEmails } = await settingsService.getEmails();
                const recipients = Array.isArray(accountantEmails)
                  ? accountantEmails
                  : [];
                if (recipients.length > 0) {
                  // Obtener información del general, concepto y subconcepto
                  let conceptName = "N/A";
                  let subconceptName = "N/A";
                  let generalName = "N/A";
                  let providerName = "N/A";
                  let providerInfo = "";
                  
                  try {
                    // Obtener datos del concepto si está disponible
                    if (transactionData.conceptId) {
                      try {
                        const conceptData = await conceptService.getById(transactionData.conceptId);
                        conceptName = conceptData?.name || "N/A";
                        const genId = transactionData.generalId || conceptData?.generalId;
                        if (genId) {
                          try {
                            const genData = await generalService.getById(genId);
                            generalName = genData?.name || generalName;
                          } catch (e) {
                            console.error("Error getting general:", e);
                          }
                        }
                      } catch (err) {
                        console.error("Error getting concept:", err);
                      }
                    }
                    
                    // Obtener datos del subconcepto si está disponible
                    if (transactionData.subconceptId) {
                      try {
                        const subData = await subconceptService.getById(transactionData.subconceptId);
                        subconceptName = subData?.name || "N/A";
                      } catch (err) {
                        console.error("Error getting subconcept:", err);
                      }
                    }
                    
                    // Obtener datos del proveedor si está disponible
                    if (transactionData.providerId) {
                      try {
                        const providerResponse = await fetch(`/api/providers/${transactionData.providerId}`);
                        if (providerResponse.ok) {
                          const providerData = await providerResponse.json();
                          providerName = providerData.name || "N/A";
                          providerInfo = `
                          <li><strong>Proveedor:</strong> ${providerData.name || "N/A"}
                            ${providerData.rfc ? `<br>RFC: ${providerData.rfc}` : ""}
                          </li>`;
                          
                          // Añadir información bancaria si está disponible
                          if (providerData.bankAccounts && providerData.bankAccounts.length > 0) {
                            const account = providerData.bankAccounts[0];
                            providerInfo += `
                            <li>
                              <strong>Cuenta bancaria:</strong>
                              <ul>
                                <li>Banco: ${account.bank || 'N/A'}</li>
                                <li>Cuenta: ${account.accountNumber || 'N/A'}</li>
                                <li>CLABE: ${account.clabe || 'N/A'}</li>
                              </ul>
                            </li>`;
                          }
                        }
                      } catch (err) {
                        console.error("Error fetching provider:", err);
                      }
                  }
                  } catch (err) {
                    console.error("Error fetching transaction details:", err);
                  }
                  
                  // Información de división
                  const divisionInfo = transactionData.division ? 
                    `<li><strong>División:</strong> ${transactionData.division}</li>` : "";
                  
                  // Importar el template de correo
                  const { createEmailTemplate, createExpenseNotificationContent } = await import('../../lib/emailTemplates');
                  
                  const subject = `Favor de cubrir este gasto - ${conceptName} - #${String(result.id).slice(-8)}`;
                  
                  // Crear el contenido del correo usando el template
                  const emailContent = createExpenseNotificationContent({
                    amount: parseFloat(transactionData.amount).toFixed(2),
                    date: transactionData.date.toLocaleDateString("es-MX"),
                    conceptName,
                    descriptionName: undefined, // obsolete
                    providerInfo,
                    divisionInfo,
                    txId: result.id,
                    detailUrl: `${window.location.origin}/admin/transacciones/detalle/${result.id}`,
                    generalName,
                    subconceptName,
                    freeDescription: transactionData.description
                  });
                  
                  // Aplicar el template completo
                  const html = createEmailTemplate({
                    title: 'Solicitud de Pago',
                    content: emailContent
                  });
                  for (const to of recipients) {
                    try {
                      await fetch("/api/email/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ to, subject, html }),
                      });
                    } catch (e) {
                      console.error("Error sending to recipient", to, e);
                    }
                  }
                }
          } catch (err) {
            console.error("Error sending accountant notification:", err);
          }
        }
      }

      onSuccess && onSuccess(result);

      // Reset form if creating new transaction
      if (!initialData) {
        setFormData({
          type: type || "entrada",
          generalId: "",
          conceptId: "",
          subconceptId: "",
          description: "",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          providerId: "",
          division: "general",
          isRecurring: false,
        });
        setFiles([]);
        setAttachmentProgress(0);
      }
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast.error(error.message || "Error al guardar la transacción");
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConceptCreated = (newConcept) => {
    // Refresh concepts in selector
    conceptSelectorRef.current?.refreshConcepts();
    // Set the new concept as selected
    setFormData((prev) => ({
      ...prev,
      conceptId: newConcept.id,
      descriptionId: "", // Reset description
    }));
    toast.success("Concepto creado exitosamente");
  };

  const handleSubconceptCreated = (newSubconcept) => {
    // Refresh subconcepts in selector
    subconceptSelectorRef.current?.refreshSubconcepts();
    // Set the new subconcept as selected
    setFormData((prev) => ({
      ...prev,
      subconceptId: newSubconcept.id,
    }));
    toast.success("Subconcepto creado exitosamente");
  };

  const handleProviderCreated = (newProvider) => {
    // Refresh providers in selector
    providerSelectorRef.current?.refreshProviders();
    // Set the new provider as selected
    setFormData((prev) => ({
      ...prev,
      providerId: newProvider.id,
    }));
    toast.success("Proveedor creado exitosamente");
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* General -> Concept -> Subconcept */}
        {/* Primera fila: General / Concepto / Subconcepto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              General *
            </label>
            {loadingGenerals ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                Cargando categorías...
              </div>
            ) : generalsError ? (
              <div className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-red-600">
                Error al cargar categorías
              </div>
            ) : (
              <select
                value={formData.generalId}
                onChange={(e) => setFormData(prev => ({ ...prev, generalId: e.target.value, conceptId: '', subconceptId: '' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                disabled={loading}
                required
              >
                <option value="">Selecciona una categoría general</option>
                {generals.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.type === 'entrada' ? 'Ingreso' : 'Gasto'})
                  </option>
                ))}
              </select>
            )}
            {errors.generalId && (
              <p className="mt-1 text-sm text-red-600">{errors.generalId}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Concepto *</label>
            <ConceptSelector
              ref={conceptSelectorRef}
              type={formData.type}
              generalId={formData.generalId}
              value={formData.conceptId}
              onChange={handleConceptChange}
              onCreateNew={() => setShowConceptModal(true)}
              required
              disabled={loading}
            />
            {errors.conceptId && (
              <p className="mt-1 text-sm text-red-600">{errors.conceptId}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subconcepto *
            </label>
            <SubconceptSelector
              ref={subconceptSelectorRef}
              conceptId={formData.conceptId}
              value={formData.subconceptId}
              onChange={handleSubconceptChange}
              onCreateNew={() => setShowSubconceptModal(true)}
              required
              disabled={loading}
            />
            {errors.subconceptId && (
              <p className="mt-1 text-sm text-red-600">{errors.subconceptId}</p>
            )}
          </div>
        </div>

        {/* Segunda fila: Fecha / Monto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="date"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Fecha *
            </label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                errors.date ? "border-red-300" : "border-gray-300"
              }`}
              disabled={loading}
              required
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Monto *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                className={`w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                  errors.amount ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="0.00"
                disabled={loading}
                required
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
            )}
          </div>
        </div>

        {/* Tercera fila: Proveedor / División - Solo para salidas */}
        {formData.type === "salida" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Proveedor *
              </label>
              <ProviderSelector
                ref={providerSelectorRef}
                value={formData.providerId}
                onChange={handleProviderChange}
                onCreateNew={() =>
                  toast.info(
                    "Funcionalidad de crear proveedor será implementada próximamente"
                  )
                }
                required
                disabled={loading}
              />
              {errors.providerId && (
                <p className="mt-1 text-sm text-red-600">{errors.providerId}</p>
              )}
            </div>

            <div>
              <label htmlFor="division" className="block text-sm font-medium text-gray-700 mb-2">
                División *
              </label>
              <select
                id="division"
                name="division"
                value={formData.division}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
                disabled={loading}
                required
              >
                <option value="general">General</option>
                <option value="2da_division">2nda división profesional</option>
                <option value="3ra_division">3ra división profesional</option>
              </select>
              {errors.division && (
                <p className="mt-1 text-sm text-red-600">{errors.division}</p>
              )}
            </div>
          </div>
        )}

        {/* Cuarta fila: Descripción */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Descripción (opcional)
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500"
            placeholder="Escribe una nota o detalle..."
            disabled={loading}
          />
        </div>

        {/* Quinta fila: Adjuntos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adjuntos (opcional)
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Puedes subir múltiples archivos (imágenes, PDFs, etc.) arrastrándolos o seleccionándolos
          </p>
          {uploadingAttachments && (
            <div className="mb-2 w-full bg-gray-100 rounded h-2 overflow-hidden">
              <div
                className="h-2 bg-primary transition-all"
                style={{ width: `${attachmentProgress}%` }}
              />
              <div className="text-xs text-gray-600 mt-1">Subiendo archivos... {attachmentProgress}%</div>
            </div>
          )}
          <FileUpload
            onUpload={(selectedFiles) => {
              console.log('Files selected:', selectedFiles);
              setFiles(prev => [...prev, ...selectedFiles]);
            }}
            existingFiles={[]}
            multiple={true}
            disabled={loading || uploadingAttachments}
            acceptedTypes={["image/jpeg", "image/jpg", "image/png", "image/gif", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]}
            maxSize={10 * 1024 * 1024} // 10MB
          />
          {files.length > 0 && !uploadingAttachments && (
            <div className="mt-3">
              <div className="text-xs text-gray-600 mb-2">
                <strong>{files.length}</strong> archivo(s) seleccionado(s) para subir
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center space-x-2 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors">
                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-gray-700 truncate block" title={f.name}>{f.name}</span>
                      <span className="text-[10px] text-gray-500">{formatSize(f.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-600 hover:text-red-800 text-xs font-medium flex-shrink-0 ml-2"
                      title="Eliminar archivo"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-blue-600">
                💡 Tip: Puedes seleccionar más archivos para agregarlos a la lista
              </div>
            </div>
          )}
        </div>



        {/* Recurring Expense Toggle - Only for salidas */}
        {formData.type === "salida" && !initialData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-rose-400 rounded-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Gasto Recurrente</h4>
                  <p className="text-sm text-gray-600">
                    Este gasto se repetirá automáticamente cada mes como pendiente
                  </p>
                  {/* Debug info */}
                  <p className="text-xs text-gray-500 mt-1">
                    Debug - Tipo: {formData.type}, InitialData: {initialData ? 'Sí' : 'No'}, Estado: {formData.isRecurring ? 'ON' : 'OFF'}
                  </p>
                </div>
              </div>
              
              {/* Toggle Switch */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    console.log('Toggle clicked, current state:', formData.isRecurring);
                    const newState = !formData.isRecurring;
                    console.log('Setting new state:', newState);
                    setFormData(prev => {
                      const updated = { ...prev, isRecurring: newState };
                      console.log('Updated formData:', updated);
                      return updated;
                    });
                  }}
                  disabled={loading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 ${
                    formData.isRecurring ? 'bg-rose-400' : 'bg-gray-200'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.isRecurring ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <span className="ml-3 text-sm font-medium text-gray-900">
                  {formData.isRecurring ? 'Activado' : 'Desactivado'}
                </span>
              </div>
            </div>
            {formData.isRecurring && (
              <div className="mt-4 p-3 bg-rose-50 rounded-md">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-rose-600">
                    <p className="font-medium mb-2">¿Cómo funciona?</p>
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-rose-600 mb-1">📅 Generación automática:</p>
                        <ul className="space-y-1 ml-2">
                          <li>• Se creará automáticamente una transacción pendiente cada mes</li>
                          <li>• Aparecerá el primer día del siguiente mes</li>
                          <li>• Mantendrá todos los datos del gasto original</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-rose-600 mb-1">⚙️ Gestión y control:</p>
                        <ul className="space-y-1 ml-2">
                          <li>• Podrás activar/desactivar desde "Gastos Recurrentes"</li>
                          <li>• Cuando se desactiva solo se generará para el mes actual</li>
                          <li>• Puedes reactivarlo en cualquier momento</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-primary border border-transparent rounded-md hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 disabled:opacity-50 flex items-center"
          >
            {loading && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
            {initialData ? "Actualizar" : "Guardar"}{" "}
            {formData.type === "entrada" ? "Ingreso" : "Gasto"}
          </button>
        </div>
      </form>

      {/* Concept Modal */}
      <ConceptModal
        isOpen={showConceptModal}
        onClose={() => setShowConceptModal(false)}
        onSuccess={handleConceptCreated}
        type={formData.type}
      />

      {/* Subconcept Modal */}
      <SubconceptModal
        isOpen={showSubconceptModal}
        onClose={() => setShowSubconceptModal(false)}
        onSuccess={handleSubconceptCreated}
        conceptId={formData.conceptId}
      />
    </div>
  );
};

export default TransactionForm;
