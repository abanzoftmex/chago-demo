import { useState, useEffect } from 'react';
import { descriptionService } from '../../lib/services/descriptionService';
import { conceptService } from '../../lib/services/conceptService';

const DescriptionModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  conceptId,
  initialData = null 
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    conceptId: conceptId || initialData?.conceptId || ''
  });
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingConcepts, setLoadingConcepts] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadConcepts();
    }
  }, [isOpen]);

  useEffect(() => {
    setFormData({
      name: initialData?.name || '',
      conceptId: conceptId || initialData?.conceptId || ''
    });
  }, [conceptId, initialData]);

  const loadConcepts = async () => {
    try {
      setLoadingConcepts(true);
      const conceptsData = await conceptService.getAll();
      setConcepts(conceptsData);
    } catch (error) {
      console.error('Error loading concepts:', error);
    } finally {
      setLoadingConcepts(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form
    const validation = descriptionService.validateDescriptionData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setLoading(true);
      setErrors({});
      
      let result;
      if (initialData) {
        // Update existing description
        result = await descriptionService.update(initialData.id, formData);
      } else {
        // Create new description
        result = await descriptionService.create(formData);
      }
      
      onSuccess && onSuccess(result);
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        conceptId: conceptId || ''
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
        name: initialData?.name || '',
        conceptId: conceptId || initialData?.conceptId || ''
      });
    }
  };

  const getConceptName = (conceptId) => {
    const concept = concepts.find(c => c.id === conceptId);
    return concept ? concept.name : '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {initialData ? 'Editar Descripción' : 'Nueva Descripción'}
          </h3>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
            <label htmlFor="conceptId" className="block text-sm font-medium text-gray-700 mb-2">
              Concepto *
            </label>
            {loadingConcepts ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                Cargando conceptos...
              </div>
            ) : (
              <select
                id="conceptId"
                name="conceptId"
                value={formData.conceptId}
                onChange={handleInputChange}
                disabled={loading || !!conceptId} // Disable if conceptId is passed as prop
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                  errors.conceptId ? 'border-red-300' : 'border-gray-300'
                } ${(loading || !!conceptId) ? 'bg-gray-50' : ''}`}
              >
                <option value="">Seleccionar concepto</option>
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.name} ({concept.type === 'entrada' ? 'Entrada' : 'Salida'})
                  </option>
                ))}
              </select>
            )}
            {errors.conceptId && (
              <p className="mt-1 text-sm text-red-600">{errors.conceptId}</p>
            )}
            {conceptId && (
              <p className="mt-1 text-sm text-gray-500">
                Asociada al concepto: {getConceptName(conceptId)}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Descripción *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Ej: Venta de productos, Pago de servicios, etc."
              disabled={loading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
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
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {initialData ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DescriptionModal;