import { useState, useEffect } from 'react';
import { providerService } from '../../lib/services/providerService';
import { useToast } from '../ui/Toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const ProviderForm = ({ provider = null, onSubmit, onCancel, isOpen }) => {
  const [formData, setFormData] = useState({
    name: '',
    rfc: '',
    phone: '',
    address: '',
    contacts: [{ name: '', email: '', phone: '' }],
    bankAccounts: [{ bank: '', accountNumber: '', clabe: '' }]
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { success, error } = useToast();

  // Initialize form data when provider changes
  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name || '',
        rfc: provider.rfc || '',
        phone: provider.phone || '',
        address: provider.address || '',
        contacts: provider.contacts && provider.contacts.length > 0 
          ? provider.contacts 
          : [{ name: '', email: '', phone: '' }],
        bankAccounts: provider.bankAccounts && provider.bankAccounts.length > 0 
          ? provider.bankAccounts 
          : [{ bank: '', accountNumber: '', clabe: '' }]
      });
    } else {
      // Reset form for new provider
      setFormData({
        name: '',
        rfc: '',
        phone: '',
        address: '',
        contacts: [{ name: '', email: '', phone: '' }],
        bankAccounts: [{ bank: '', accountNumber: '', clabe: '' }]
      });
    }
    setErrors({});
  }, [provider, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleContactChange = (index, field, value) => {
    const newContacts = [...formData.contacts];
    newContacts[index] = {
      ...newContacts[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      contacts: newContacts
    }));

    // Clear contact-specific errors
    const errorKey = `contact_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const handleBankAccountChange = (index, field, value) => {
    const newBankAccounts = [...formData.bankAccounts];
    newBankAccounts[index] = {
      ...newBankAccounts[index],
      [field]: value
    };
    setFormData(prev => ({
      ...prev,
      bankAccounts: newBankAccounts
    }));

    // Clear bank account-specific errors
    const errorKey = `account_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const addContact = () => {
    setFormData(prev => ({
      ...prev,
      contacts: [...prev.contacts, { name: '', email: '', phone: '' }]
    }));
  };

  const removeContact = (index) => {
    if (formData.contacts.length > 1) {
      const newContacts = formData.contacts.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        contacts: newContacts
      }));
    }
  };

  const addBankAccount = () => {
    setFormData(prev => ({
      ...prev,
      bankAccounts: [...prev.bankAccounts, { bank: '', accountNumber: '', clabe: '' }]
    }));
  };

  const removeBankAccount = (index) => {
    if (formData.bankAccounts.length > 1) {
      const newBankAccounts = formData.bankAccounts.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        bankAccounts: newBankAccounts
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate form data
    const validation = providerService.validateProviderData(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      error('Por favor corrige los errores en el formulario');
      return;
    }

    try {
      setLoading(true);
      
      // Clean up empty contacts and bank accounts
      const cleanedData = {
        ...formData,
        contacts: formData.contacts.filter(contact => 
          contact.name.trim() || contact.email.trim() || contact.phone.trim()
        ),
        bankAccounts: formData.bankAccounts.filter(account => 
          account.bank.trim() || account.accountNumber.trim() || account.clabe.trim()
        )
      };

      let result;
      if (provider) {
        result = await providerService.update(provider.id, cleanedData);
        success('Proveedor actualizado exitosamente');
      } else {
        result = await providerService.create(cleanedData);
        success('Proveedor creado exitosamente');
      }

      onSubmit(result);
    } catch (err) {
      error(err.message || 'Error al guardar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
      <div className="bg-background rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-medium text-foreground">
            {provider ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h3>
          <button
            onClick={onCancel}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-4">Información Básica</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.name ? 'border-red-500' : 'border-border'
                  }`}
                  placeholder="Nombre del proveedor"
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  RFC <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.rfc}
                  onChange={(e) => handleInputChange('rfc', e.target.value.toUpperCase())}
                  className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.rfc ? 'border-red-500' : 'border-border'
                  }`}
                  placeholder="RFC del proveedor"
                  maxLength="13"
                />
                {errors.rfc && (
                  <p className="text-red-500 text-xs mt-1">{errors.rfc}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.phone ? 'border-red-500' : 'border-border'
                  }`}
                  placeholder="Teléfono del proveedor"
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Dirección <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  rows="3"
                  className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    errors.address ? 'border-red-500' : 'border-border'
                  }`}
                  placeholder="Dirección completa del proveedor"
                />
                {errors.address && (
                  <p className="text-red-500 text-xs mt-1">{errors.address}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contacts Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-foreground">Contactos</h4>
              <button
                type="button"
                onClick={addContact}
                className="inline-flex items-center px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Agregar Contacto
              </button>
            </div>
            
            <div className="space-y-4">
              {formData.contacts.map((contact, index) => (
                <div key={index} className="border border-border rounded-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-foreground">
                      Contacto {index + 1}
                    </h5>
                    {formData.contacts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeContact(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={contact.name}
                        onChange={(e) => handleContactChange(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Nombre del contacto"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                          errors[`contact_${index}_email`] ? 'border-red-500' : 'border-border'
                        }`}
                        placeholder="email@ejemplo.com"
                      />
                      {errors[`contact_${index}_email`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`contact_${index}_email`]}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Teléfono del contacto"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bank Accounts Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-foreground">Cuentas Bancarias</h4>
              <button
                type="button"
                onClick={addBankAccount}
                className="inline-flex items-center px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Agregar Cuenta
              </button>
            </div>
            
            <div className="space-y-4">
              {formData.bankAccounts.map((account, index) => (
                <div key={index} className="border border-border rounded-md p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-foreground">
                      Cuenta {index + 1}
                    </h5>
                    {formData.bankAccounts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBankAccount(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Banco
                      </label>
                      <input
                        type="text"
                        value={account.bank}
                        onChange={(e) => handleBankAccountChange(index, 'bank', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Nombre del banco"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Número de Cuenta
                      </label>
                      <input
                        type="text"
                        value={account.accountNumber}
                        onChange={(e) => handleBankAccountChange(index, 'accountNumber', e.target.value)}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Número de cuenta"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        CLABE
                      </label>
                      <input
                        type="text"
                        value={account.clabe}
                        onChange={(e) => handleBankAccountChange(index, 'clabe', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                          errors[`account_${index}_clabe`] ? 'border-red-500' : 'border-border'
                        }`}
                        placeholder="CLABE interbancaria"
                        maxLength="18"
                      />
                      {errors[`account_${index}_clabe`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`account_${index}_clabe`]}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-border">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : (provider ? 'Actualizar' : 'Crear')} Proveedor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProviderForm;