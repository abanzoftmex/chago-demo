import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import { recurringExpenseService } from "../../lib/services/recurringExpenseService";
import { conceptService } from "../../lib/services/conceptService";
import { subconceptService } from "../../lib/services/subconceptService";
import { providerService } from "../../lib/services/providerService";
import { generalService } from "../../lib/services/generalService";
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

const RecurringExpenseForm = ({ onSuccess, className = "" }) => {
  const { user } = useAuth();
  const toast = useToast();
  const conceptSelectorRef = useRef();
  const subconceptSelectorRef = useRef();
  const providerSelectorRef = useRef();

  const [formData, setFormData] = useState({
    generalId: "",
    conceptId: "",
    subconceptId: "",
    description: "",
    amount: "",
    providerId: "",
    division: "general",
    frequency: "monthly", // New field for frequency
    startDate: new Date().toISOString().split("T")[0], // When to start generating
    isActive: true
  });

  const [generals, setGenerals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingGenerals, setLoadingGenerals] = useState(false);
  const [generalsError, setGeneralsError] = useState(null);
  const [errors, setErrors] = useState({});

  // Modal states
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showConceptModal, setShowConceptModal] = useState(false);
  const [showSubconceptModal, setShowSubconceptModal] = useState(false);

  // Load generals when component mounts
  useEffect(() => {
    const loadGenerals = async () => {
      try {
        setLoadingGenerals(true);
        setGeneralsError(null);
        const allGenerals = await generalService.getAll();
        // Filter only salidas (expenses) for recurring expenses
        const filtered = allGenerals.filter(g => g.type === "salida");
        setGenerals(filtered);
      } catch (err) {
        setGeneralsError(err.message);
      } finally {
        setLoadingGenerals(false);
      }
    };
    loadGenerals();
  }, []);

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

    if (!formData.description || formData.description.trim() === "") {
      newErrors.description = "La descripción es requerida";
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = "El monto debe ser mayor a 0";
    }

    if (!formData.providerId) {
      newErrors.providerId = "El proveedor es requerido";
    }

    if (!formData.frequency) {
      newErrors.frequency = "La frecuencia es requerida";
    }

    if (!formData.startDate) {
      newErrors.startDate = "La fecha de inicio es requerida";
    }

    return newErrors;
  };

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
      const recurringData = {
        type: "salida", // Always expense for recurring
        generalId: formData.generalId,
        conceptId: formData.conceptId,
        subconceptId: formData.subconceptId,
        description: formData.description,
        amount: parseFloat(formData.amount),
        providerId: formData.providerId,
        division: formData.division,
        frequency: formData.frequency,
        startDate: new Date(formData.startDate),
        isActive: formData.isActive,
        generatedDates: [], // Track specific dates when transactions were generated
        lastGenerated: null
      };

      const result = await recurringExpenseService.create(recurringData, user);
      
      toast.success("Gasto recurrente creado exitosamente");
      
      // Reset form
      setFormData({
        generalId: "",
        conceptId: "",
        subconceptId: "",
        description: "",
        amount: "",
        providerId: "",
        division: "general",
        frequency: "monthly",
        startDate: new Date().toISOString().split("T")[0],
        isActive: true
      });

      onSuccess && onSuccess(result);

    } catch (error) {
      console.error("Error creating recurring expense:", error);
      toast.error(error.message || "Error al crear el gasto recurrente");
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGeneralCreated = (newGeneral) => {
    // Refresh generals list
    const loadGenerals = async () => {
      try {
        setLoadingGenerals(true);
        setGeneralsError(null);
        const allGenerals = await generalService.getAll();
        const filtered = allGenerals.filter(g => g.type === "salida");
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
      monthly: "Se generará una nueva transacción el primer día de cada mes a la medianoche."
    };
    return descriptions[frequency] || "";
  };

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-500 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Nuevo Gasto Recurrente</h3>
              <p className="text-sm text-gray-600">
                Configura un gasto que se generará automáticamente según la frecuencia seleccionada
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
              <select
                value={formData.generalId}
                onChange={(e) => {
                  const selectedValue = e.target.value;
                  if (selectedValue === 'CREATE_NEW') {
                    setShowGeneralModal(true);
                  } else {
                    setFormData(prev => ({ ...prev, generalId: selectedValue, conceptId: '', subconceptId: '' }));
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                disabled={loading}
                required
              >
                <option value="">Selecciona una categoría general</option>
                {generals.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="CREATE_NEW" className="font-semibold text-rose-600">
                  + Agregar nuevo general
                </option>
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
              type="salida"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
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
              Fecha de inicio *
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={formData.startDate}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500 ${
                errors.startDate ? "border-red-300" : "border-gray-300"
              }`}
              disabled={loading}
              required
            />
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
                className={`w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500 ${
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

        {/* Tercera fila: Proveedor / División */}
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
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

        {/* Descripción - Ancho completo */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Descripción *
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-rose-500 focus:border-rose-500 ${
              errors.description ? "border-red-300" : "border-gray-300"
            }`}
            placeholder="Describe el gasto recurrente..."
            disabled={loading}
            required
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
              </div>
            </div>
          </div>
        )}

        {/* Submit button */}
        <div className="flex justify-end space-x-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creando..." : "Crear Gasto Recurrente"}
          </button>
        </div>
      </form>

      {/* Modals */}
      {showGeneralModal && (
        <GeneralModal
          type="salida"
          isOpen={showGeneralModal}
          onClose={() => setShowGeneralModal(false)}
          onCreated={handleGeneralCreated}
        />
      )}

      {showConceptModal && (
        <ConceptModal
          type="salida"
          isOpen={showConceptModal}
          onClose={() => setShowConceptModal(false)}
          onCreated={handleConceptCreated}
        />
      )}

      {showSubconceptModal && (
        <SubconceptModal
          isOpen={showSubconceptModal}
          onClose={() => setShowSubconceptModal(false)}
          onCreated={handleSubconceptCreated}
        />
      )}
    </div>
  );
};

export default RecurringExpenseForm;
