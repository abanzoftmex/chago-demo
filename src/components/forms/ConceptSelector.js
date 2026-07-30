import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import Select from 'react-select';
import { conceptService } from '../../lib/services/conceptService';
import { useAuth } from '../../context/AuthContextMultiTenant';
import { CREATE_NEW, treeSelectStyles, keepCreateFilter, menuPortalTarget } from './treeSelectStyles';

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
  const { tenantInfo } = useAuth();
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
      
      const tenantId = tenantInfo?.id;
      if (!tenantId) {
        setError('No tenant ID available');
        return;
      }
      
      // Fetch all concepts and filter by general and type
      const allConcepts = await conceptService.getAll(tenantId);
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
  }, [type, generalId, tenantInfo]);

  useEffect(() => {
    loadConcepts();
  }, [type, generalId, loadConcepts]);

  const handleSelectChange = (opt) => {
    if (!opt) {
      onChange('');
      return;
    }
    if (opt.value === CREATE_NEW) {
      onCreateNew && onCreateNew();
    } else {
      onChange(opt.value);
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

  const options = concepts.map((concept) => ({
    value: concept.id,
    label: concept.name,
  }));
  const allOptions = [
    ...options,
    { value: CREATE_NEW, label: "＋ Agregar nuevo concepto", __isCreate: true },
  ];
  const selectedOption = options.find((o) => o.value === value) || null;

  return (
    <div className={`relative ${className}`}>
      <Select
        value={selectedOption}
        onChange={handleSelectChange}
        options={allOptions}
        styles={treeSelectStyles}
        filterOption={keepCreateFilter}
        isSearchable
        isClearable
        isDisabled={disabled || !generalId}
        placeholder={
          !generalId ? "Primero selecciona una categoría general" : placeholder
        }
        noOptionsMessage={() => "Sin resultados"}
        menuPortalTarget={menuPortalTarget}
        menuPosition="fixed"
      />
    </div>
  );
});

ConceptSelector.displayName = 'ConceptSelector';

export default ConceptSelector;