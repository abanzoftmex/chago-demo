import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import Select from 'react-select';
import { subconceptService } from '../../lib/services/subconceptService';
import { useAuth } from '../../context/AuthContextMultiTenant';
import { CREATE_NEW, treeSelectStyles, keepCreateFilter, menuPortalTarget } from './treeSelectStyles';

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
  const { tenantInfo } = useAuth();
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
      
      const tenantId = tenantInfo?.id;
      if (!tenantId) {
        setError('No tenant ID available');
        return;
      }
      
      // Load all subconcepts and filter by conceptId
      const allSubconcepts = await subconceptService.getAll(tenantId);
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
  }, [conceptId, tenantInfo]);

  useEffect(() => {
    loadSubconcepts();
  }, [conceptId, loadSubconcepts]);

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

  const options = subconcepts.map((s) => ({ value: s.id, label: s.name }));
  const allOptions = [
    ...options,
    { value: CREATE_NEW, label: "＋ Agregar nuevo subconcepto", __isCreate: true },
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
        isDisabled={disabled || !conceptId}
        placeholder={
          !conceptId ? "Primero selecciona un concepto" : placeholder
        }
        noOptionsMessage={() => "Sin resultados"}
        menuPortalTarget={menuPortalTarget}
        menuPosition="fixed"
      />
    </div>
  );
});

SubconceptSelector.displayName = 'SubconceptSelector';

export default SubconceptSelector;


