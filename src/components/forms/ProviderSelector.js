import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import Select from 'react-select';
import { providerService } from '../../lib/services/providerService';
import { useAuth } from '../../context/AuthContextMultiTenant';
import { CREATE_NEW, treeSelectStyles, keepCreateFilter, menuPortalTarget } from './treeSelectStyles';

const ProviderSelector = forwardRef(({ 
  value, 
  onChange, 
  onCreateNew,
  className = '',
  placeholder = 'Seleccionar proveedor...',
  required = false,
  disabled = false 
}, ref) => {
  const { tenantInfo } = useAuth();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tenantId = tenantInfo?.id;
      if (!tenantId) {
        setError('No tenant ID available');
        return;
      }
      
      const providersData = await providerService.getAll(tenantId);
      setProviders(providersData);
    } catch (err) {
      setError(err.message);
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  };

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

  // This function can be called from parent component when a new provider is created
  const refreshProviders = async () => {
    await loadProviders();
  };

  // Expose refresh function to parent
  useImperativeHandle(ref, () => ({
    refreshProviders
  }));

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <select 
          disabled 
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
        >
          <option>Cargando proveedores...</option>
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
          <option>Error al cargar proveedores</option>
        </select>
        <button
          type="button"
          onClick={loadProviders}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-600 hover:text-red-800"
        >
          ↻
        </button>
      </div>
    );
  }

  const options = providers.map((provider) => ({
    value: provider.id,
    label: provider.rfc ? `${provider.name} - ${provider.rfc}` : provider.name,
  }));
  const allOptions = [
    ...options,
    { value: CREATE_NEW, label: "＋ Agregar nuevo proveedor", __isCreate: true },
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
        isDisabled={disabled}
        placeholder={placeholder}
        noOptionsMessage={() => "Sin resultados"}
        menuPortalTarget={menuPortalTarget}
        menuPosition="fixed"
      />
    </div>
  );
});

ProviderSelector.displayName = 'ProviderSelector';

export default ProviderSelector;