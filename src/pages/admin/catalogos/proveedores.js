import { useState, useEffect } from 'react';
import AdminLayout from '../../../components/layout/AdminLayout';
import ProviderForm from '../../../components/forms/ProviderForm';
import { providerService } from '../../../lib/services/providerService';
import { useToast } from '../../../components/ui/Toast';
import { 
  PlusIcon, 
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

const Proveedores = () => {
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const { success, error } = useToast();
  const itemsPerPage = 10;

  // Load providers
  useEffect(() => {
    loadProviders();
  }, []);

  // Filter providers based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProviders(providers);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = providers.filter(provider => 
        provider.name.toLowerCase().includes(searchLower) ||
        provider.rfc.toLowerCase().includes(searchLower) ||
        provider.phone.includes(searchTerm) ||
        provider.address.toLowerCase().includes(searchLower)
      );
      setFilteredProviders(filtered);
    }
    setCurrentPage(1); // Reset to first page when searching
  }, [searchTerm, providers]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await providerService.getAll();
      setProviders(data);
      setFilteredProviders(data);
    } catch (err) {
      error('Error al cargar los proveedores');
      console.error('Error loading providers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProvider) return;
    
    try {
      setDeleting(true);
      await providerService.delete(selectedProvider.id);
      success('Proveedor eliminado exitosamente');
      setShowDeleteModal(false);
      setSelectedProvider(null);
      loadProviders();
    } catch (err) {
      error(err.message || 'Error al eliminar el proveedor');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateProvider = () => {
    setEditingProvider(null);
    setShowProviderForm(true);
  };

  const handleEditProvider = (provider) => {
    setEditingProvider(provider);
    setShowProviderForm(true);
  };

  const handleProviderFormSubmit = (savedProvider) => {
    setShowProviderForm(false);
    setEditingProvider(null);
    loadProviders();
  };

  const handleProviderFormCancel = () => {
    setShowProviderForm(false);
    setEditingProvider(null);
  };

  // Pagination logic
  const totalPages = Math.ceil(filteredProviders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProviders = filteredProviders.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <AdminLayout 
        title="Catálogo de Proveedores" 
        breadcrumbs={[
          { name: 'Dashboard', href: '/admin/dashboard' },
          { name: 'Catálogos' },
          { name: 'Proveedores' }
        ]}
      >
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Catálogo de Proveedores" 
      breadcrumbs={[
        { name: 'Dashboard', href: '/admin/dashboard' },
        { name: 'Catálogos' },
        { name: 'Proveedores' }
      ]}
    >
      <div className="bg-background rounded-lg border border-border">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Gestión de Proveedores
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredProviders.length} proveedor{filteredProviders.length !== 1 ? 'es' : ''} encontrado{filteredProviders.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <button
              onClick={handleCreateProvider}
              className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Nuevo Proveedor
            </button>
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre, RFC, teléfono o dirección..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  RFC
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Teléfono
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Dirección
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {currentProviders.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="text-muted-foreground">
                      {searchTerm ? 'No se encontraron proveedores que coincidan con la búsqueda' : 'No hay proveedores registrados'}
                    </div>
                    {!searchTerm && (
                      <button
                        onClick={handleCreateProvider}
                        className="mt-2 text-primary hover:text-primary/80"
                      >
                        Crear el primer proveedor
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                currentProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">
                        {provider.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {provider.rfc}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">
                        {provider.phone}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="text-sm text-foreground max-w-xs truncate">
                        {provider.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedProvider(provider);
                            setShowDetailModal(true);
                          }}
                          className="text-primary hover:text-blue-900 p-1"
                          title="Ver detalles"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditProvider(provider)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProvider(provider);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Eliminar"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} a {Math.min(endIndex, filteredProviders.length)} de {filteredProviders.length} resultados
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                >
                  Anterior
                </button>
                
                {/* Page numbers */}
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => goToPage(pageNum)}
                        className={`px-3 py-1 text-sm border rounded-md ${
                          currentPage === pageNum
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-foreground mb-4">
              Confirmar eliminación
            </h3>
            <p className="text-muted-foreground mb-6">
              ¿Estás seguro de que deseas eliminar el proveedor: {selectedProvider?.name}? 
              Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedProvider(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedProvider && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-foreground">
                Detalles del Proveedor
              </h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedProvider(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h4 className="text-sm font-medium text-foreground mb-3">Información Básica</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Nombre</label>
                    <p className="text-sm text-foreground">{selectedProvider.name}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">RFC</label>
                    <p className="text-sm text-foreground">{selectedProvider.rfc}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Teléfono</label>
                    <p className="text-sm text-foreground">{selectedProvider.phone}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Dirección</label>
                    <p className="text-sm text-foreground">{selectedProvider.address}</p>
                  </div>
                </div>
              </div>

              {/* Contacts */}
              {selectedProvider.contacts && selectedProvider.contacts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Contactos</h4>
                  <div className="space-y-3">
                    {selectedProvider.contacts.map((contact, index) => (
                      <div key={index} className="border border-border rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Nombre</label>
                            <p className="text-sm text-foreground">{contact.name}</p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Email</label>
                            <p className="text-sm text-foreground">{contact.email || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Teléfono</label>
                            <p className="text-sm text-foreground">{contact.phone || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Accounts */}
              {selectedProvider.bankAccounts && selectedProvider.bankAccounts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3">Cuentas Bancarias</h4>
                  <div className="space-y-3">
                    {selectedProvider.bankAccounts.map((account, index) => (
                      <div key={index} className="border border-border rounded-md p-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Banco</label>
                            <p className="text-sm text-foreground">{account.bank}</p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Número de Cuenta</label>
                            <p className="text-sm text-foreground">{account.accountNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">CLABE</label>
                            <p className="text-sm text-foreground">{account.clabe || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provider Form Modal */}
      <ProviderForm
        provider={editingProvider}
        isOpen={showProviderForm}
        onSubmit={handleProviderFormSubmit}
        onCancel={handleProviderFormCancel}
      />
    </AdminLayout>
  );
};

export default Proveedores;