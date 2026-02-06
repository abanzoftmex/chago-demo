import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
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

  const loadConcepts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!generalId) {
        // If no general is selected, show empty list
        setConcepts([]);
        return;
      }
      
      // Fetch all concepts and filter by general and type
      const allConcepts = await conceptService.getAll();
      const filteredConcepts = allConcepts.filter(concept => 
        concept.generalId === generalId && (concept.type === type || concept.type === 'ambos')
      );
      setConcepts(filteredConcepts);
    } catch (err) {
      setError(err.message);
      console.error('Error loading concepts:', err);
    } finally {
      setLoading(false);
    }
  }, [type, generalId]);

  useEffect(() => {
    loadConcepts();
  }, [type, generalId, loadConcepts]);

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
        disabled={disabled || !generalId}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">
          {!generalId ? "Primero selecciona una categoría general" : placeholder}
        </option>
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