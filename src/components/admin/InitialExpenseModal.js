import React, { useState } from "react";
import { transactionService } from "../../lib/services/transactionService";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContextMultiTenant";

const InitialExpenseModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    date: (() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })(),
    monthYear: (() => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    })(),
    generalName: "",
    conceptName: "",
    subconceptName: "",
    providerName: ""
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const toast = useToast();
  const { user, tenantInfo } = useAuth();

  const formatNumberWithCommas = (value) => {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    
    const stringValue = String(value);
    const numericValue = stringValue.replace(/[^0-9.]/g, '');
    const parts = numericValue.split('.');
    let integerPart = parts[0];
    const decimalPart = parts.length > 1 ? `.${parts[1]}` : '';
    
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    return integerPart + decimalPart;
  };

  const handleInputChange = (field, value) => {
    if (field === 'amount') {
      value = formatNumberWithCommas(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.amount || parseFloat(formData.amount.replace(/,/g, '')) <= 0) {
      newErrors.amount = "El monto es requerido y debe ser mayor a 0";
    }
    
    if (!formData.description.trim()) {
      newErrors.description = "La descripción es requerida";
    }
    
    if (!formData.date) {
      newErrors.date = "La fecha es requerida";
    }
    
    if (!formData.monthYear) {
      newErrors.monthYear = "El mes/año es requerido";
    }
    
    if (!formData.generalName.trim()) {
      newErrors.generalName = "El nombre del general es requerido";
    }
    
    if (!formData.conceptName.trim()) {
      newErrors.conceptName = "El nombre del concepto es requerido";
    }
    
    if (!formData.subconceptName.trim()) {
      newErrors.subconceptName = "El nombre del subconcepto es requerido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      const amount = parseFloat(formData.amount.replace(/,/g, ''));
      
      // Crear fecha basada en el mes/año seleccionado
      const [year, month] = formData.monthYear.split('-');
      const selectedDate = new Date(parseInt(year), parseInt(month) - 1, new Date(formData.date).getDate());
      
      // Crear el gasto inicial con nombres directos (sin crear entidades en el sistema)
      const transactionData = {
        type: "salida",
        amount: amount,
        description: formData.description,
        date: selectedDate,
        // Usar nombres directos en lugar de IDs
        generalName: formData.generalName.trim(),
        conceptName: formData.conceptName.trim(),
        subconceptName: formData.subconceptName.trim(),
        providerName: formData.providerName.trim() || "Sin proveedor",
        division: "general",
        isInitialExpense: true, // Marcar como gasto inicial
        status: "aprobado",
        // No incluir IDs ya que es un gasto temporal
        generalId: null,
        conceptId: null,
        subconceptId: null,
        providerId: null
      };
      
      // Sin tenantId, createInitialExpense escribe en la colección raíz
      // 'transactions' en lugar de tenants/{id}/transactions: el gasto queda
      // fuera de la empresa y no aparece en ninguna pantalla.
      const tenantId = tenantInfo?.id;
      if (!tenantId) {
        throw new Error("No se pudo determinar la empresa activa");
      }

      await transactionService.createInitialExpense(transactionData, user, tenantId);
      
      toast.success("Gasto inicial creado exitosamente");
      
      // Reset form
      setFormData({
        amount: "",
        description: "",
        date: (() => {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        })(),
        monthYear: (() => {
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          return `${year}-${month}`;
        })(),
        generalName: "",
        conceptName: "",
        subconceptName: "",
        providerName: ""
      });
      
      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      console.error("Error creating initial expense:", error);
      toast.error("Error al crear el gasto inicial: " + (error.message || "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      amount: "",
      description: "",
      date: (() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })(),
      monthYear: (() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
      })(),
      generalName: "",
      conceptName: "",
      subconceptName: "",
      providerName: ""
    });
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500/75 -z-1" onClick={handleClose}></div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Crear Gasto Inicial</h3>
                    <p className="text-blue-100 text-sm">Gasto simple sin crear entidades en el sistema</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Body */}
            <div className="px-6 py-4 space-y-4 max-h-96 overflow-y-auto">
              {/* Información */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-blue-800">Gasto Inicial</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Este gasto no creará entidades en el sistema (general, concepto, subconcepto, proveedor).
                      Solo creará la transacción con los nombres que proporciones.
                    </p>
                  </div>
                </div>
              </div>

              {/* Mes/Año */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mes/Año del Gasto <span className="text-red-500">*</span>
                </label>
                <input
                  type="month"
                  value={formData.monthYear}
                  onChange={(e) => handleInputChange('monthYear', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.monthYear ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.monthYear && <p className="text-red-500 text-xs mt-1">{errors.monthYear}</p>}
              </div>

              {/* Monto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input
                    type="text"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Descripción del gasto"
                />
                {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
              </div>

              {/* Fecha específica */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha específica <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
              </div>

              {/* General */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  General <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.generalName}
                  onChange={(e) => handleInputChange('generalName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.generalName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Gastos Operativos"
                />
                {errors.generalName && <p className="text-red-500 text-xs mt-1">{errors.generalName}</p>}
              </div>

              {/* Concepto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Concepto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.conceptName}
                  onChange={(e) => handleInputChange('conceptName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.conceptName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Servicios"
                />
                {errors.conceptName && <p className="text-red-500 text-xs mt-1">{errors.conceptName}</p>}
              </div>

              {/* Subconcepto */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subconcepto <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subconceptName}
                  onChange={(e) => handleInputChange('subconceptName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.subconceptName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Ej: Electricidad"
                />
                {errors.subconceptName && <p className="text-red-500 text-xs mt-1">{errors.subconceptName}</p>}
              </div>

              {/* Proveedor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor <span className="text-gray-400">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={formData.providerName}
                  onChange={(e) => handleInputChange('providerName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: CFE"
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creando...
                  </div>
                ) : (
                  "Crear Gasto"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InitialExpenseModal;