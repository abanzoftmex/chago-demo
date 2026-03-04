import { useState, useEffect, useMemo } from 'react';
import { subconceptService } from '../../lib/services/subconceptService';
import { conceptService } from '../../lib/services/conceptService';
import { generalService } from '../../lib/services/generalService';
import { useAuth } from '../../context/AuthContextMultiTenant';

export default function SubconceptCsvImportModal({ isOpen, onClose, onSuccess }) {
  const { tenantInfo } = useAuth();
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [generals, setGenerals] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [conceptsData, generalsData] = await Promise.all([
        conceptService.getAll(tenantId),
        generalService.getAll(tenantId)
      ]);
      setConcepts(conceptsData);
      setGenerals(generalsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
      setUploadError(null);
    } else {
      setUploadError('Por favor selecciona un archivo CSV válido');
      setSelectedFile(null);
    }
  };

  const downloadTemplate = () => {
    // Create template with concept names and general names for reference
    let csvContent = 'nombre,concepto_nombre,descripcion\n';
    csvContent += '"Balones de Fútbol","Compra de Balones","Balones oficiales para entrenamientos"\n';
    csvContent += '"Electricidad Estadio","Pago de Luz","Consumo eléctrico del estadio"\n';
    csvContent += '"Cuotas Juveniles","Cuotas Mensuales","Cobro de cuotas categoría juvenil"\n';
    csvContent += '"Riego Automático","Mantenimiento Césped","Sistema de riego del campo"';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_subconceptos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text) => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        data.push(row);
      }
    }
    return data;
  };

  const findConceptByName = (conceptName) => {
    return concepts.find(c => 
      c.name.toLowerCase().trim() === conceptName.toLowerCase().trim()
    );
  };

  const getGeneralName = (generalId) => {
    const general = generals.find(g => g.id === generalId);
    return general ? general.name : 'General no encontrado';
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setUploadError('Por favor selecciona un archivo CSV');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const text = await selectedFile.text();
      const data = parseCSV(text);
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const row of data) {
        try {
          // Support both English and Spanish headers
          const name = row.name || row.nombre;
          const conceptName = row.concept_name || row.concepto_nombre;
          const description = row.description || row.descripcion || '';
          
          if (!name || !conceptName) {
            errors.push(`Fila con nombre "${name || 'sin nombre'}": faltan campos requeridos (nombre y concepto_nombre)`);
            errorCount++;
            continue;
          }

          // Find the concept by name
          const concept = findConceptByName(conceptName);
          if (!concept) {
            errors.push(`Fila "${name}": no se encontró el concepto "${conceptName}"`);
            errorCount++;
            continue;
          }

          await subconceptService.create({
            name: name,
            conceptId: concept.id,
            description: description
          }, tenantId);
          successCount++;
        } catch (error) {
          const name = row.name || row.nombre;
          errors.push(`Error al crear "${name}": ${error.message}`);
          errorCount++;
        }
      }

      if (successCount > 0) {
        setUploadSuccess(`Se importaron ${successCount} subconceptos exitosamente.`);
        onSuccess();
      }

      if (errorCount > 0) {
        setUploadError(`${errorCount} errores encontrados:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}`);
      }

      if (successCount > 0 && errorCount === 0) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (error) {
      setUploadError(`Error al procesar el archivo: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadError(null);
    setUploadSuccess(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Importar Subconceptos
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isUploading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Template Download Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h4 className="text-sm font-medium text-blue-800">Descargar Plantilla</h4>
                <p className="mt-1 text-sm text-blue-700">
                  Descarga la plantilla CSV con el formato correcto para importar subconceptos.
                </p>
                <button
                  onClick={downloadTemplate}
                  className="mt-2 inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar Plantilla
                </button>
              </div>
            </div>
          </div>

          {/* Available Concepts Info */}
          {concepts.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-800 mb-2">Conceptos Disponibles:</h4>
              <div className="max-h-32 overflow-y-auto">
                <ul className="text-xs text-gray-600 space-y-1">
                  {concepts.map((concept) => (
                    <li key={concept.id} className="flex justify-between">
                      <span className="font-medium">{concept.name}</span>
                      <span className="text-gray-500">
                        {getGeneralName(concept.generalId)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seleccionar Archivo CSV
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-orange-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-orange-500">
                    <span>Subir archivo</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".csv"
                      className="sr-only"
                      onChange={handleFileSelect}
                      disabled={isUploading}
                    />
                  </label>
                  <p className="pl-1">o arrastra y suelta</p>
                </div>
                <p className="text-xs text-gray-500">Solo archivos CSV</p>
              </div>
            </div>
            {selectedFile && (
              <p className="mt-2 text-sm text-green-600">
                Archivo seleccionado: {selectedFile.name}
              </p>
            )}
          </div>

          {/* Format Instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-800 mb-2">Formato del CSV:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• <strong>nombre:</strong> Nombre del subconcepto (requerido)</li>
              <li>• <strong>concepto_nombre:</strong> Nombre exacto del concepto existente (requerido)</li>
              <li>• <strong>descripcion:</strong> Descripción del subconcepto (opcional)</li>
            </ul>
            <p className="text-xs text-gray-500 mt-2">
              <em>Nota: También se aceptan los nombres en inglés (name, concept_name, description)</em>
            </p>
          </div>

          {/* Error Message */}
          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800 whitespace-pre-line">{uploadError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{uploadSuccess}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              disabled={isUploading}
            >
              Cancelar
            </button>
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-700 border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importando...
                </div>
              ) : (
                'Importar CSV'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}