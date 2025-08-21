import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { conceptService } from '../../lib/services/conceptService';

const ConceptSelector = forwardRef(({ 
  type, 
  generalId,
  value, 
  onChange, 
  onCreateNew,
  className = '',
  placeholder = 'Seleccionar concepto...',
  required = false,
  disabled = false 
}, ref) => {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConcepts = async () => {
    try {
      setLoading(true);
      setError(null);
      // Always fetch by type; if a general is chosen, filter client-side to avoid composite index requirements
      const allByType = await conceptService.getByType(type);
      const filtered = generalId ? allByType.filter(c => c.generalId === generalId) : allByType;
      setConcepts(filtered);
    } catch (err) {
      setError(err.message);
      console.error('Error loading concepts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConcepts();
  }, [type, generalId]);

  const handleSelectChange = (e) => {
    const selectedValue = e.target.value;
    
    if (selectedValue === 'CREATE_NEW') {
      onCreateNew && onCreateNew();
    } else {
      onChange(selectedValue);
    }
  };

  // This function can be called from parent component when a new concept is created
  const refreshConcepts = async () => {
    await loadConcepts();
  };

  // Expose refresh function to parent
  React.useImperativeHandle(ref, () => ({
    refreshConcepts
  }));

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <select 
          disabled 
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
        >
          <option>Cargando conceptos...</option>
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
          <option>Error al cargar conceptos</option>
        </select>
        <button
          type="button"
          onClick={loadConcepts}
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
        {concepts.map((concept) => (
          <option key={concept.id} value={concept.id}>
            {concept.name}
          </option>
        ))}
        <option value="CREATE_NEW" className="font-semibold text-primary">
          + Agregar nuevo concepto
        </option>
      </select>
    </div>
  );
});

ConceptSelector.displayName = 'ConceptSelector';

export default ConceptSelector;