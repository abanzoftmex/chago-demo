import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../context/AuthContextMultiTenant";
import { useToast } from "../ui/Toast";
import { recurringExpenseService } from "../../lib/services/recurringExpenseService";
import { conceptService } from "../../lib/services/conceptService";
import { subconceptService } from "../../lib/services/subconceptService";
import { providerService } from "../../lib/services/providerService";
import { generalService } from "../../lib/services/generalService";
import { formatDateKey, nextMonthlyGenerationDate, monthlyBackfillDates } from "../../lib/recurring/schedule";
import Select from "react-select";
import ConfirmDialog from "../ui/ConfirmDialog";
import { CREATE_NEW, treeSelectStyles, keepCreateFilter, menuPortalTarget } from "./treeSelectStyles";
import ConceptSelector from "./ConceptSelector";
import SubconceptSelector from "./SubconceptSelector";
import ProviderSelector from "./ProviderSelector";
import GeneralModal from "./GeneralModal";
import ConceptModal from "./ConceptModal";
import SubconceptModal from "./SubconceptModal";

const FREQUENCIES = {
  daily: { label: "Diario", value: "daily" },
  weekly: { label: "Semanal (cada lunes)", value: "weekly" },
  biweekly: { label: "Quincenal (día 15 y penúltimo)", value: "biweekly" },
  monthly: { label: "Mensual (día 1)", value: "monthly" }
};

const RecurringExpenseForm = ({ type = "salida", expenseId = null, onSuccess, className = "" }) => {
  const { user, tenantInfo } = useAuth();
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);
  const toast = useToast();
  const conceptSelectorRef = useRef();
  const subconceptSelectorRef = useRef();
  const providerSelectorRef = useRef();

  const isEntrada = type === "entrada";
  const focusRingClass = isEntrada
    ? "focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
    : "focus:ring-2 focus:ring-rose-500 focus:border-rose-500";

  const [formData, setFormData] = useState({
    generalId: "",
    conceptId: "",
    subconceptId: "",
    description: "",
    amount: "",
    providerId: "",
    division: "general",
    frequency: "monthly", // New field for frequency
    startDate: formatDateKey(new Date()), // When to start generating (fecha local, sin corrimiento UTC)
    isActive: true
  });

  const [generals, setGenerals] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [loadingGenerals, setLoadingGenerals] = useState(false);
  const [generalsError, setGeneralsError] = useState(null);
  const [errors, setErrors] = useState({});

  // Modal states
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showSubconceptModal, setShowSubconceptModal] = useState(false);
  // Confirmación del backfill (generar meses pasados al crear un mensual).
  const [confirmBackfill, setConfirmBackfill] = useState({ open: false, message: "", onConfirm: null });

  // Load generals when component mounts
  useEffect(() => {
    if (!tenantId) return;
    const loadGenerals = async () => {
      try {
        setLoadingGenerals(true);
        setGeneralsError(null);
        const allGenerals = await generalService.getAll(tenantId);
        // Filter based on type
        const filtered = allGenerals.filter(g => g.type === type || g.type === "ambos");
        setGenerals(filtered);
      } catch (err) {
        setGeneralsError(err.message);
      } finally {
        setLoadingGenerals(false);
      }
    };
    loadGenerals();
  }, [tenantId, type]);

  // Load concepts for SubconceptModal
  useEffect(() => {
    if (!tenantId) return;
    const loadConcepts = async () => {
      try {
        const allConcepts = await conceptService.getAll(tenantId);
        setConcepts(allConcepts.filter(c => c.type === type || c.type === "ambos"));
      } catch (err) {
        console.error('Error loading concepts:', err);
      }
    };
    loadConcepts();
  }, [tenantId, type]);

  // Load existing recurring transaction if in edit mode
  useEffect(() => {
    if (!tenantId || !expenseId) return;
    const loadExpense = async () => {
      try {
        setLoadingExpense(true);
        const expense = await recurringExpenseService.getById(expenseId, tenantId);
        if (expense) {
          let dateStr = formatDateKey(new Date());
          if (expense.startDate) {
            const dateObj = expense.startDate.toDate ? expense.startDate.toDate() : new Date(expense.startDate);
            if (!isNaN(dateObj.getTime())) {
              // Componentes locales para no recorrer el día (evita el corrimiento UTC).
              dateStr = formatDateKey(dateObj);
            }
          }

          setFormData({
            generalId: expense.generalId || "",
            conceptId: expense.conceptId || "",
            subconceptId: expense.subconceptId || "",
            description: expense.description || "",
            amount: expense.amount !== undefined ? String(expense.amount) : "",
            providerId: expense.providerId || "",
            division: expense.division || "general",
            frequency: expense.frequency || "monthly",
            startDate: dateStr,
            isActive: expense.isActive !== undefined ? expense.isActive : true
          });
        }
      } catch (err) {
        console.error("Error loading recurring transaction:", err);
        toast.error("Error al cargar la información del recurrente");
      } finally {
        setLoadingExpense(false);
      }
    };
    loadExpense();
  }, [tenantId, expenseId, toast]);

  const formatNumberWithCommas = (value) => {
    if (!value) return '';
    
    // Convert to string and remove any existing commas
    let cleanValue = String(value).replace(/,/g, '');
    
    // Split into parts (before and after decimal)
    const parts = cleanValue.split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';
    
    // Add thousand separators to integer part
    if (integerPart) {
      integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    return integerPart + decimalPart;
  };

  const parseFormattedNumber = (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    const stringValue = String(value);
    return stringValue.replace(/[^0-9.]/g, '');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for amount field
    if (name === 'amount') {
      if (value === '') {
        setFormData(prev => ({ ...prev, [name]: '' }));
        return;
      }
      
      const formattedValue = formatNumberWithCommas(value);
      e.target.value = formattedValue;
      const rawValue = parseFormattedNumber(formattedValue);
      
      setFormData(prev => ({ ...prev, [name]: rawValue }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleConceptChange = (conceptId) => {
    setFormData((prev) => ({
      ...prev,
      conceptId,
      subconceptId: "", // Reset subconcept when concept changes
    }));

    if (errors.conceptId) {
      setErrors((prev) => ({ ...prev, conceptId: null }));
    }
  };

  const handleSubconceptChange = (subconceptId) => {
    setFormData((prev) => ({ ...prev, subconceptId }));

    if (errors.subconceptId) {
      setErrors((prev) => ({ ...prev, subconceptId: null }));
    }
  };

  const handleProviderChange = (providerId) => {
    setFormData((prev) => ({ ...prev, providerId }));

    if (errors.providerId) {
      setErrors((prev) => ({ ...prev, providerId: null }));
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

    // Description is not required
    // Provider is not required

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "El monto debe ser mayor a 0";
    }

    if (!formData.frequency) {
      newErrors.frequency = "La frecuencia es requerida";
    }

    if (!formData.startDate) {
      newErrors.startDate = "La fecha de inicio es requerida";
    }

    return newErrors;
  };

  const formatShortDate = (d) =>
    d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

  // Ejecuta el guardado (crear/actualizar) y, si aplica, el backfill de meses pasados.
  const doSubmit = async (recurringData, backfillDates = []) => {
    try {
      setLoading(true);
      setErrors({});

      let result;
      if (expenseId) {
        result = await recurringExpenseService.update(expenseId, recurringData, tenantId);
        toast.success(`${isEntrada ? "Entrada" : "Salida"} recurrente actualizada exitosamente`);
      } else {
        recurringData.generatedDates = [];
        recurringData.lastGenerated = null;
        result = await recurringExpenseService.create(recurringData, tenantId);
        toast.success(`${isEntrada ? "Entrada" : "Salida"} recurrente creada exitosamente`);

        // Backfill de meses pasados (solo mensual, solo al crear).
        if (backfillDates.length > 0) {
          const created = await recurringExpenseService.backfillMonthly(
            { ...recurringData, id: result.id },
            tenantId,
            user
          );
          if (created.length > 0) {
            toast.success(`Se generaron ${created.length} transacciones pasadas`);
          }
        }

        // Reset form (only on create)
        setFormData({
          generalId: "",
          conceptId: "",
          subconceptId: "",
          description: "",
          amount: "",
          providerId: "",
          division: "general",
          frequency: "monthly",
          startDate: formatDateKey(new Date()),
          isActive: true,
        });
      }

      onSuccess && onSuccess(result);
    } catch (error) {
      console.error("Error saving recurring transaction:", error);
      toast.error(error.message || `Error al guardar la ${isEntrada ? "entrada" : "salida"} recurrente`);
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Prepare data for submission
    const recurringData = {
      type: type,
      generalId: formData.generalId,
      conceptId: formData.conceptId,
      subconceptId: formData.subconceptId,
      description: formData.description,
      amount: parseFloat(formData.amount),
      providerId: formData.providerId,
      division: formData.division,
      frequency: formData.frequency,
      // Ancla a mediodía: evita que en México (UTC-6) se guarde el día anterior.
      startDate: new Date(formData.startDate + "T12:00:00"),
      isActive: formData.isActive,
    };

    // Solo al CREAR un mensual con inicio en el pasado: confirmar el backfill.
    const backfillDates =
      !expenseId && formData.frequency === "monthly"
        ? monthlyBackfillDates(recurringData.startDate, [])
        : [];

    if (backfillDates.length > 0) {
      const first = formatShortDate(backfillDates[0]);
      const last = formatShortDate(backfillDates[backfillDates.length - 1]);
      setConfirmBackfill({
        open: true,
        message: `Se generarán ${backfillDates.length} transacciones pasadas (${first} → ${last}). ¿Continuar?`,
        onConfirm: () => {
          setConfirmBackfill((c) => ({ ...c, open: false }));
          doSubmit(recurringData, backfillDates);
        },
      });
      return;
    }

    doSubmit(recurringData);
  };

  const handleGeneralCreated = (newGeneral) => {
    // Refresh generals list
    const loadGenerals = async () => {
      try {
        setLoadingGenerals(true);
        setGeneralsError(null);
        const allGenerals = await generalService.getAll(tenantId);
        const filtered = allGenerals.filter(g => g.type === type || g.type === "ambos");
        setGenerals(filtered);
      } catch (err) {
        setGeneralsError(err.message);
      } finally {
        setLoadingGenerals(false);
      }
    };
    
    loadGenerals();
    
    setFormData((prev) => ({
      ...prev,
      generalId: newGeneral.id,
      conceptId: "",
      subconceptId: "",
    }));
    
    toast.success("Categoría general creada exitosamente");
  };

  const handleConceptCreated = (newConcept) => {
    conceptSelectorRef.current?.refreshConcepts();
    setFormData((prev) => ({ ...prev, conceptId: newConcept.id }));
    toast.success("Concepto creado exitosamente");
  };

  const handleSubconceptCreated = (newSubconcept) => {
    subconceptSelectorRef.current?.refreshSubconcepts();
    setFormData((prev) => ({ ...prev, subconceptId: newSubconcept.id }));
    toast.success("Subconcepto creado exitosamente");
  };

  const getFrequencyDescription = (frequency) => {
    const descriptions = {
      daily: "Se generará una nueva transacción todos los días a la medianoche.",
      weekly: "Se generará una nueva transacción todos los lunes a la medianoche.",
      biweekly: "Se generará una nueva transacción el día 15 y el penúltimo día de cada mes a la medianoche.",
      monthly: "Mensual: se genera el día 1 de cada mes. El día que elijas no cambia la fecha; solo indica a partir de cuándo."
    };
    return descriptions[frequency] || "";
  };

  if (loadingExpense) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className={`animate-spin rounded-full h-12 w-12 border-4 border-gray-200 ${
          isEntrada ? "border-t-emerald-600" : "border-t-rose-500"
        }`}></div>
        <p className="text-gray-500 font-medium">Cargando información del recurrente...</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Header */}
        <div className={`bg-gradient-to-r ${
          isEntrada 
            ? "from-emerald-50 to-teal-50 border-emerald-200" 
            : "from-rose-50 to-orange-50 border-rose-200"
        } border rounded-lg p-4`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 ${isEntrada ? "bg-emerald-600" : "bg-rose-500"} rounded-lg`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {expenseId 
                  ? isEntrada ? "Editar Entrada Recurrente" : "Editar Salida Recurrente"
                  : isEntrada ? "Nueva Entrada Recurrente" : "Nueva Salida Recurrente"
                }
              </h3>
              <p className="text-sm text-gray-600">
                {expenseId
                  ? `Modifica los detalles de la ${isEntrada ? "entrada" : "salida"} recurrente`
                  : `Configura una ${isEntrada ? "entrada" : "salida"} que se generará automáticamente según la frecuencia seleccionada`
                }
              </p>
            </div>
          </div>
        </div>

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
              (() => {
                const labelOf = (g) =>
                  `${g.name} (${g.type === "salida" ? "Salida" : g.type === "entrada" ? "Entrada" : "Ambos"})`;
                const options = generals.map((g) => ({ value: g.id, label: labelOf(g) }));
                const allOptions = [
                  ...options,
                  { value: CREATE_NEW, label: "＋ Agregar nuevo general", __isCreate: true },
                ];
                const selectedOption = options.find((o) => o.value === formData.generalId) || null;
                return (
                  <Select
                    value={selectedOption}
                    onChange={(opt) => {
                      if (opt?.value === CREATE_NEW) {
                        setShowGeneralModal(true);
                        return;
                      }
                      setFormData((prev) => ({
                        ...prev,
                        generalId: opt?.value || "",
                        conceptId: "",
                        subconceptId: "",
                      }));
                    }}
                    options={allOptions}
                    styles={treeSelectStyles}
                    filterOption={keepCreateFilter}
                    isSearchable
                    isClearable
                    isDisabled={loading}
                    placeholder="Selecciona una categoría general"
                    noOptionsMessage={() => "Sin resultados"}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                  />
                );
              })()
            )}
            {errors.generalId && (
              <p className="mt-1 text-sm text-red-600">{errors.generalId}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Concepto *</label>
            <ConceptSelector
              ref={conceptSelectorRef}
              type={type}
              generalId={formData.generalId}
              value={formData.conceptId}
              onChange={handleConceptChange}
              onCreateNew={() => setShowConceptModal(true)}
              required
              disabled={loading}
              placeholder="Seleccionar concepto..."
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
              placeholder="Seleccionar subconcepto..."
            />
            {errors.subconceptId && (
              <p className="mt-1 text-sm text-red-600">{errors.subconceptId}</p>
            )}
          </div>
        </div>

        {/* Segunda fila: Frecuencia / Fecha de inicio / Monto */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-2">
              Frecuencia *
            </label>
            <select
              id="frequency"
              name="frequency"
              value={formData.frequency}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRingClass}`}
              disabled={loading}
              required
            >
              {Object.values(FREQUENCIES).map(freq => (
                <option key={freq.value} value={freq.value}>
                  {freq.label}
                </option>
              ))}
            </select>
            {errors.frequency && (
              <p className="mt-1 text-sm text-red-600">{errors.frequency}</p>
            )}
          </div>

          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
              Generar a partir de *
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${focusRingClass} ${
                errors.startDate ? "border-red-300" : "border-gray-300"
              }`}
              disabled={loading}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              El recurrente empieza a generarse desde esta fecha.
            </p>
            {errors.startDate && (
              <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
            )}
          </div>

          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
              Monto *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="text"
                id="amount"
                name="amount"
                value={formData.amount ? formatNumberWithCommas(formData.amount) : ''}
                onChange={handleInputChange}
                inputMode="decimal"
                className={`w-full pl-8 pr-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${focusRingClass} ${
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

        {/* Tercera fila: Proveedor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor
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
              disabled={loading}
            />
            {errors.providerId && (
              <p className="mt-1 text-sm text-red-600">{errors.providerId}</p>
            )}
          </div>
        </div>

        {/* Descripción - Ancho completo */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${focusRingClass} ${
              errors.description ? "border-red-300" : "border-gray-300"
            }`}
            placeholder={`Describe la ${isEntrada ? "entrada" : "salida"} recurrente...`}
            disabled={loading}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">{errors.description}</p>
          )}
        </div>

        {/* Información de frecuencia */}
        {formData.frequency && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Frecuencia: {FREQUENCIES[formData.frequency]?.label}
                </h4>
                <p className="text-sm text-blue-700">
                  {getFrequencyDescription(formData.frequency)}
                </p>
                {formData.frequency === "monthly" && formData.startDate && (() => {
                  const start = new Date(formData.startDate + "T12:00:00");
                  if (isNaN(start.getTime())) return null;
                  const fmt = (d) =>
                    d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
                  // Al CREAR con inicio pasado se rellenan los meses (backfill).
                  const backfill = !expenseId ? monthlyBackfillDates(start, []) : [];
                  if (backfill.length > 0) {
                    return (
                      <p className="text-sm font-semibold text-blue-900 mt-1">
                        Al guardar se generarán {backfill.length} transacciones (
                        {fmt(backfill[0])} → {fmt(backfill[backfill.length - 1])}), y luego cada día 1.
                      </p>
                    );
                  }
                  return (
                    <p className="text-sm font-semibold text-blue-900 mt-1">
                      Primera generación: {fmt(nextMonthlyGenerationDate(start))}
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="flex justify-end space-x-3">
          <button
            type="submit"
            disabled={loading}
            className={`${
              isEntrada 
                ? "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500" 
                : "bg-rose-500 hover:bg-rose-600 focus:ring-rose-500"
            } text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading 
              ? expenseId ? "Guardando..." : "Creando..." 
              : expenseId 
                ? isEntrada ? "Actualizar Entrada Recurrente" : "Actualizar Salida Recurrente" 
                : isEntrada ? "Crear Entrada Recurrente" : "Crear Salida Recurrente"
            }
          </button>
        </div>
      </form>

      {/* Modals */}
      {showGeneralModal && (
        <GeneralModal
          type={type}
          isOpen={showGeneralModal}
          onClose={() => setShowGeneralModal(false)}
          onSuccess={handleGeneralCreated}
        />
      )}

      {showConceptModal && (
        <ConceptModal
          type={type}
          isOpen={showConceptModal}
          onClose={() => setShowConceptModal(false)}
          onSuccess={handleConceptCreated}
          generals={generals}
        />
      )}

      {showSubconceptModal && (
        <SubconceptModal
          isOpen={showSubconceptModal}
          onClose={() => setShowSubconceptModal(false)}
          onSuccess={handleSubconceptCreated}
          concepts={concepts}
          generals={generals}
        />
      )}

      <ConfirmDialog
        isOpen={confirmBackfill.open}
        type="confirm"
        title="Generar transacciones pasadas"
        message={confirmBackfill.message}
        confirmLabel="Sí, generar"
        onConfirm={confirmBackfill.onConfirm}
        onClose={() => setConfirmBackfill((c) => ({ ...c, open: false }))}
      />
    </div>
  );
};

export default RecurringExpenseForm;
