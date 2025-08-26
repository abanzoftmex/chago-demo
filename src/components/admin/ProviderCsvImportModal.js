import React, { useState } from 'react';
import { providerService } from '../../lib/services/providerService';
import { useToast } from '../ui/Toast';

const ProviderCsvImportModal = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [showTableExample, setShowTableExample] = useState(false);
  const { success, error } = useToast();

  const downloadTemplate = () => {
    const headers = ['nombre', 'rfc', 'telefono', 'direccion', 'contacto_nombre', 'contacto_email', 'contacto_telefono', 'banco', 'numero_cuenta', 'clabe'];
    const exampleData = [
      'Distribuidora Deportiva ABC,ABC123456789,555-0123,Av. Principal 123 Col. Centro,Juan Pérez,juan@abc.com,555-0124,Banco Nacional,1234567890,012345678901234567',
      'Servicios Deportivos XYZ,XYZ987654321,555-0456,Calle Secundaria 456 Col. Norte,María García,maria@xyz.com,555-0457,Banco Regional,0987654321,098765432109876543',
      'Equipamiento Futbolístico DEF,DEF456789123,555-0789,Blvd. Deportivo 789 Col. Sur,Carlos López,carlos@def.com,555-0790,Banco Central,5678901234,567890123456789012'
    ];
    
    const csvContent = headers.join(',') + '\n' + exampleData.join('\n') + '\n';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_proveedores.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('El archivo CSV debe contener al menos una fila de encabezados y una fila de datos');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['nombre', 'rfc', 'telefono', 'direccion'];
    
    // Validate required headers
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      throw new Error(`Faltan las siguientes columnas requeridas: ${missingHeaders.join(', ')}`);
    }

    const providers = [];
    const parseErrors = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length !== headers.length) {
        parseErrors.push(`Fila ${i + 1}: Número incorrecto de columnas`);
        continue;
      }

      const provider = {};
      const contacts = [];
      const bankAccounts = [];

      headers.forEach((header, index) => {
        const value = values[index];
        
        switch (header) {
          case 'nombre':
            if (!value) {
              parseErrors.push(`Fila ${i + 1}: El nombre es requerido`);
              return;
            }
            provider.name = value;
            break;
          case 'rfc':
            if (!value) {
              parseErrors.push(`Fila ${i + 1}: El RFC es requerido`);
              return;
            }
            provider.rfc = value.toUpperCase();
            break;
          case 'telefono':
            if (!value) {
              parseErrors.push(`Fila ${i + 1}: El teléfono es requerido`);
              return;
            }
            provider.phone = value;
            break;
          case 'direccion':
            if (!value) {
              parseErrors.push(`Fila ${i + 1}: La dirección es requerida`);
              return;
            }
            provider.address = value;
            break;
          case 'contacto_nombre':
            if (value) {
              contacts.push({ name: value });
            }
            break;
          case 'contacto_email':
            if (value && contacts.length > 0) {
              contacts[contacts.length - 1].email = value;
            }
            break;
          case 'contacto_telefono':
            if (value && contacts.length > 0) {
              contacts[contacts.length - 1].phone = value;
            }
            break;
          case 'banco':
            if (value) {
              bankAccounts.push({ bank: value });
            }
            break;
          case 'numero_cuenta':
            if (value && bankAccounts.length > 0) {
              bankAccounts[bankAccounts.length - 1].accountNumber = value;
            }
            break;
          case 'clabe':
            if (value && bankAccounts.length > 0) {
              bankAccounts[bankAccounts.length - 1].clabe = value;
            }
            break;
        }
      });

      if (contacts.length > 0) {
        provider.contacts = contacts;
      }
      if (bankAccounts.length > 0) {
        provider.bankAccounts = bankAccounts;
      }

      providers.push(provider);
    }

    if (parseErrors.length > 0) {
      throw new Error(`Errores en el archivo:\n${parseErrors.join('\n')}`);
    }

    return providers;
  };

  const handleImport = async () => {
    if (!file) {
      error('Por favor selecciona un archivo CSV');
      return;
    }

    setImporting(true);
    setErrors([]);

    try {
      const text = await file.text();
      const providers = parseCSV(text);
      
      let successCount = 0;
      let errorCount = 0;
      const importErrors = [];

      for (const provider of providers) {
        try {
          await providerService.create(provider);
          successCount++;
        } catch (err) {
          errorCount++;
          importErrors.push(`Error al crear ${provider.name}: ${err.message}`);
        }
      }

      if (successCount > 0) {
        success(`Se importaron ${successCount} proveedores exitosamente`);
      }
      
      if (errorCount > 0) {
        setErrors(importErrors);
        error(`${errorCount} proveedores no pudieron ser importados`);
      }

      if (successCount > 0) {
        onSuccess();
        onClose();
      }
    } catch (err) {
      error(err.message || 'Error al procesar el archivo CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setErrors([]);
    } else {
      error('Por favor selecciona un archivo CSV válido');
      setFile(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 rounded-t-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">
              Importar Proveedores CSV
            </h3>
            <button
              onClick={onClose}
              className="text-orange-100 hover:text-white transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-orange-100 text-sm mt-1">
            Importa múltiples proveedores desde un archivo CSV
          </p>
        </div>

        <div className="p-6">
          {/* Instructions */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 mb-2">Instrucciones:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Descarga la plantilla CSV haciendo clic en el botón de abajo</li>
              <li>• Completa los datos de los proveedores en el archivo</li>
              <li>• Los campos nombre, RFC, teléfono y dirección son obligatorios</li>
              <li>• Sube el archivo completado para importar los proveedores</li>
            </ul>
          </div>

          {/* Download Template */}
          <div className="mb-6">
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center px-4 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar Plantilla CSV
            </button>
          </div>

          {/* Table Example Accordion */}
          <div className="mb-6">
            <button
              onClick={() => setShowTableExample(!showTableExample)}
              className="flex items-center justify-between w-full p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-900">Ver ejemplo de tabla</span>
              <svg 
                className={`h-5 w-5 text-gray-500 transition-transform ${showTableExample ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showTableExample && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-orange-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Nombre</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">RFC</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Teléfono</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Dirección</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Contacto</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Tel. Contacto</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Banco</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">Cuenta</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-orange-700 uppercase tracking-wider">CLABE</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr className="bg-blue-50">
                        <td className="px-3 py-2 text-sm text-gray-900">Distribuidora ABC</td>
                        <td className="px-3 py-2 text-sm text-gray-900">ABC123456789</td>
                        <td className="px-3 py-2 text-sm text-gray-900">555-0123</td>
                        <td className="px-3 py-2 text-sm text-gray-900">Av. Principal 123</td>
                        <td className="px-3 py-2 text-sm text-gray-900">Juan Pérez</td>
                        <td className="px-3 py-2 text-sm text-gray-900">juan@abc.com</td>
                        <td className="px-3 py-2 text-sm text-gray-900">555-0124</td>
                        <td className="px-3 py-2 text-sm text-gray-900">Banco Nacional</td>
                        <td className="px-3 py-2 text-sm text-gray-900">1234567890</td>
                        <td className="px-3 py-2 text-sm text-gray-900">012345678901234567</td>
                      </tr>
                      <tr className="bg-green-50">
                        <td className="px-3 py-2 text-sm text-gray-900">Servicios XYZ</td>
                        <td className="px-3 py-2 text-sm text-gray-900">XYZ987654321</td>
                        <td className="px-3 py-2 text-sm text-gray-900">555-0456</td>
                        <td className="px-3 py-2 text-sm text-gray-900">Calle Secundaria 456</td>
                        <td className="px-3 py-2 text-sm text-gray-900">María García</td>
                        <td className="px-3 py-2 text-sm text-gray-900">maria@xyz.com</td>
                        <td className="px-3 py-2 text-sm text-gray-900">555-0457</td>
                        <td className="px-3 py-2 text-sm text-gray-900">Banco Regional</td>
                        <td className="px-3 py-2 text-sm text-gray-900">0987654321</td>
                        <td className="px-3 py-2 text-sm text-gray-900">098765432109876543</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 bg-gray-50 text-sm text-gray-600">
                  <p><strong>Nota:</strong> Los campos nombre, RFC, teléfono y dirección son obligatorios. Los demás campos son opcionales.</p>
                </div>
              </div>
            )}
          </div>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar archivo CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
            />
            {file && (
              <p className="mt-2 text-sm text-green-600">
                Archivo seleccionado: {file.name}
              </p>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <h4 className="text-sm font-medium text-red-800 mb-2">Errores encontrados:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {importing ? 'Importando...' : 'Importar Proveedores'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderCsvImportModal;