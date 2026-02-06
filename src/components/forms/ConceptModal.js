import { useState, useEffect } from "react";
import { conceptService } from "../../lib/services/conceptService";

const ConceptModal = ({
  isOpen,
  onClose,
  onSuccess,
  type,
  initialData = null,
  generals = [],
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    type: type || initialData?.type || "entrada",
    generalId: initialData?.generalId || "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Modo edición: cargar datos existentes
        const general = generals.find(g => g.id === initialData.generalId);
        setFormData({
          name: initialData.name || "",
          type: general?.type || initialData.type || "entrada",
          generalId: initialData.generalId || "",
        });
      } else {
        // Modo creación: valores por defecto
        setFormData({
          name: "",
          type: type || "entrada",
          generalId: "",
        });
      }
    }
  }, [isOpen, initialData, type, generals]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el general, heredar su tipo automáticamente
    if (name === 'generalId' && value) {
      const selectedGeneral = generals.find(g => g.id === value);
      if (selectedGeneral) {
        setFormData((prev) => ({
          ...prev,
          generalId: value,
          type: selectedGeneral.type // Heredar tipo del general
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  // Obtener el general seleccionado para mostrar su tipo
  const selectedGeneral = generals.find(g => g.id === formData.generalId);
  const inheritedType = selectedGeneral?.type;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    const validation = conceptService.validateConceptData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});

      let result;
      if (initialData) {
        // Update existing concept
        result = await conceptService.update(initialData.id, formData);
      } else {
        // Create new concept
        result = await conceptService.create(formData);
      }

      onSuccess && onSuccess(result);
      onClose();

      // Reset form
      setFormData({
        name: "",
        type: type || "entrada",
        generalId: "",
      });
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setErrors({});
      setFormData({
        name: initialData?.name || "",
        type: type || initialData?.type || "entrada",
        generalId: initialData?.generalId || "",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {initialData ? "Editar Concepto" : "Nuevo Concepto"}
          </h3>
          <button
            onClick={handleClose}
            disabled={loading}
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

        <form onSubmit={handleSubmit} className="p-6">
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Nombre del Concepto *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                errors.name ? "border-red-300" : "border-gray-300"
              }`}
              placeholder="Ej: Ventas, Gastos operativos, etc."
              disabled={loading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div className="mb-4">
            <label
              htmlFor="generalId"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Categoría General *
            </label>
            <select
              id="generalId"
              name="generalId"
              value={formData.generalId}
              onChange={handleInputChange}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                errors.generalId ? "border-red-300" : "border-gray-300"
              }`}
            >
              <option value="">Selecciona una categoría general</option>
              {generals.map((general) => (
                <option key={general.id} value={general.id}>
                  {general.name}
                </option>
              ))}
            </select>
            {errors.generalId && (
              <p className="mt-1 text-sm text-red-600">{errors.generalId}</p>
            )}
            
            {/* Mostrar tipo heredado */}
            {inheritedType && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Tipo heredado del General:
                    </p>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        inheritedType === 'entrada' ? 'bg-green-100 text-green-800' :
                        inheritedType === 'salida' ? 'bg-red-100 text-red-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {inheritedType === 'entrada' ? 'Entrada' : 
                         inheritedType === 'salida' ? 'Salida' : 'Ambos'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancelar
            </button>
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
              {initialData ? "Actualizar" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConceptModal;
