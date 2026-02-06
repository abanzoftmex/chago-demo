import { useState, useEffect } from 'react';
import { subconceptService } from '../../lib/services/subconceptService';

const SubconceptModal = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  initialData = null,
  concepts = []
}) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    conceptId: initialData?.conceptId || ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name || '',
        conceptId: initialData.conceptId || ''
      });
    }
  }, [isOpen, initialData]);

  // Obtener el concepto seleccionado para mostrar información
  const selectedConcept = concepts.find(c => c.id === formData.conceptId);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const validation = subconceptService.validateSubconceptData(formData);
    setErrors(validation.errors);
    return validation.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      console.log('📝 Guardando subconcepto con datos:', formData);
      
      if (initialData?.id) {
        // Update existing subconcept
        await subconceptService.update(initialData.id, formData);
        console.log('✅ Subconcepto actualizado exitosamente');
      } else {
        // Create new subconcept
        const result = await subconceptService.create(formData);
        console.log('✅ Subconcepto creado exitosamente:', result);
      }
      
      onSuccess?.(formData);
      onClose();
      
      // Reset form
      setFormData({
        name: '',
        conceptId: ''
      });
      setErrors({});
    } catch (error) {
      console.error('❌ Error saving subconcept:', error);
      setErrors({ 
        general: error.message || 'Error al guardar el subconcepto' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setFormData({
      name: '',
      conceptId: ''
    });
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600/50 backdrop-blur-lg overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">
            {initialData ? 'Editar Subconcepto' : 'Nuevo Subconcepto'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {errors.general && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {errors.general}
            </div>
          )}

          {/* Concepto Field - PRIMERO */}
          <div className="mb-4">
            <label
              htmlFor="conceptId"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Concepto *
            </label>
            <select
              id="conceptId"
              name="conceptId"
              value={formData.conceptId}
              onChange={handleInputChange}
              disabled={loading}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 ${
                errors.conceptId ? "border-red-300" : "border-gray-300"
              }`}
            >
              <option value="">Selecciona un concepto</option>
              {concepts.map((concept) => (
                <option key={concept.id} value={concept.id}>
                  {concept.name}
                </option>
              ))}
            </select>
            {errors.conceptId && (
              <p className="mt-1 text-sm text-red-600">{errors.conceptId}</p>
            )}
            
            {/* Mostrar información del concepto y tipo heredado */}
            {selectedConcept && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Tipo heredado del Concepto:
                    </p>
                    <div className="mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedConcept.type === 'entrada' ? 'bg-green-100 text-green-800' :
                        selectedConcept.type === 'salida' ? 'bg-red-100 text-red-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {selectedConcept.type === 'entrada' ? 'Entrada' : 
                         selectedConcept.type === 'salida' ? 'Salida' : 'Ambos'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Name Field - SEGUNDO */}
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Subconcepto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Ingresa el nombre del subconcepto"
              disabled={loading}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                initialData ? 'Actualizar' : 'Crear'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubconceptModal;
