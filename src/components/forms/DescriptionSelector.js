import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { descriptionService } from '../../lib/services/descriptionService';

const DescriptionSelector = forwardRef(({ 
  conceptId, 
  value, 
  onChange, 
  onCreateNew,
  className = '',
  placeholder = 'Seleccionar descripción...',
  required = false,
  disabled = false 
}, ref) => {
  const [descriptions, setDescriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (conceptId) {
      loadDescriptions();
    } else {
      setDescriptions([]);
      setError(null);
    }
  }, [conceptId]);

  const loadDescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const descriptionsData = await descriptionService.getByConcept(conceptId);
      setDescriptions(descriptionsData);
    } catch (err) {
      setError(err.message);
      console.error('Error loading descriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectChange = (e) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === 'CREATE_NEW') {
      onCreateNew && onCreateNew();
    } else {
      onChange(selectedValue);
    }
  };

  // This function can be called from parent component when a new description is created
  const refreshDescriptions = async () => {
    if (conceptId) {
      await loadDescriptions();
    }
  };

  // Expose refresh function to parent
  useImperativeHandle(ref, () => ({
    refreshDescriptions
  }));

  // If no concept is selected, show disabled state
  if (!conceptId) {
    return (
      <div className={`relative ${className}`}>
        <select 
          disabled 
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
        >
          <option>Primero selecciona un concepto</option>
        </select>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <select 
          disabled 
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
        >
          <option>Cargando descripciones...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative ${className}`}>
        <select 
          disabled 
          className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-red-500"
        >
          <option>Error al cargar descripciones</option>
        </select>
        <button
          type="button"
          onClick={loadDescriptions}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-600 hover:text-red-800"
        >
          ↻
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={value || ''}
        onChange={handleSelectChange}
        required={required}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">{placeholder}</option>
        {descriptions.map((description) => (
          <option key={description.id} value={description.id}>
            {description.name}
          </option>
        ))}
        <option value="CREATE_NEW" className="font-semibold text-primary">
          + Agregar nueva descripción
        </option>
      </select>
    </div>
  );
});

DescriptionSelector.displayName = 'DescriptionSelector';

export default DescriptionSelector;