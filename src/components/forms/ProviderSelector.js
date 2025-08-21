import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { providerService } from '../../lib/services/providerService';

const ProviderSelector = forwardRef(({ 
  value, 
  onChange, 
  onCreateNew,
  className = '',
  placeholder = 'Seleccionar proveedor...',
  required = false,
  disabled = false 
}, ref) => {
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
      const providersData = await providerService.getAll();
      setProviders(providersData);
    } catch (err) {
      setError(err.message);
      console.error('Error loading providers:', err);
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
        {providers.map((provider) => (
          <option key={provider.id} value={provider.id}>
            {provider.name} - {provider.rfc}
          </option>
        ))}
        <option value="CREATE_NEW" className="font-semibold text-primary">
          + Agregar nuevo proveedor
        </option>
      </select>
    </div>
  );
});

ProviderSelector.displayName = 'ProviderSelector';

export default ProviderSelector;