import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { subconceptService } from '../../lib/services/subconceptService';

const SubconceptSelector = forwardRef(({ 
  conceptId,
  value, 
  onChange, 
  onCreateNew,
  className = '',
  placeholder = 'Seleccionar subconcepto...',
  required = false,
  disabled = false 
}, ref) => {
  const [subconcepts, setSubconcepts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadSubconcepts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!conceptId) {
        // If no concept is selected, show empty list
        setSubconcepts([]);
        return;
      }
      
      // Load all subconcepts and filter by conceptId
      const allSubconcepts = await subconceptService.getAll();
      const filteredSubconcepts = allSubconcepts.filter(subconcept => 
        subconcept.conceptId === conceptId
      );
      setSubconcepts(filteredSubconcepts);
    } catch (err) {
      setError(err.message);
      console.error('Error loading subconcepts:', err);
    } finally {
      setLoading(false);
    }
  }, [conceptId]);

  useEffect(() => {
    loadSubconcepts();
  }, [conceptId, loadSubconcepts]);

  const handleSelectChange = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue === 'CREATE_NEW') {
      onCreateNew && onCreateNew();
    } else {
      onChange(selectedValue);
    }
  };

  const refreshSubconcepts = async () => {
    await loadSubconcepts();
  };

  useImperativeHandle(ref, () => ({ refreshSubconcepts }));

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <select disabled className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
          <option>Cargando subconceptos...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative ${className}`}>
        <select disabled className="w-full px-3 py-2 border border-red-300 rounded-md bg-red-50 text-red-500">
          <option>Error al cargar subconceptos</option>
        </select>
        <button type="button" onClick={loadSubconcepts} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-600 hover:text-red-800">
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
        disabled={disabled || !conceptId}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">
          {!conceptId ? "Primero selecciona un concepto" : placeholder}
        </option>
        {subconcepts.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        <option value="CREATE_NEW" className="font-semibold text-primary">
          + Agregar nuevo subconcepto
        </option>
      </select>
    </div>
  );
});

SubconceptSelector.displayName = 'SubconceptSelector';

export default SubconceptSelector;


