import { useState } from "react";
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

export default function TransactionCsvImportModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  onImport, 
  type = "entrada",
  tenantId 
}) {
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const downloadTemplate = () => {
    let csvContent;
    
    if (type === "entrada") {
      const headers = 'Fecha,General,Concepto,Subconcepto,Descripción,Monto,Estado';
      const example1 = '"2024-03-01","Ingresos por Cuotas","Cuotas Mensuales","","Cuota marzo 2024",1500.00,pendiente';
      const example2 = '"2024-03-02","Ingresos por Eventos","Torneos","Torneo de Primavera","Inscripciones torneo",2000.00,pagado';
      csvContent = `${headers}\n${example1}\n${example2}`;
    } else {
      const headers = 'Fecha,General,Concepto,Subconcepto,Proveedor,Descripción,Monto,Estado';
      const example1 = '"2024-03-01","Gastos Operativos","Servicios Básicos","Electricidad","CFE","Recibo CFE marzo",800.50,pendiente';
      const example2 = '"2024-03-02","Gastos Operativos","Material de Oficina","Papelería","Office Depot","Compra de material",350.00,pagado';
      csvContent = `${headers}\n${example1}\n${example2}`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `plantilla_${type}s.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!file) {
      alert('Por favor selecciona un archivo');
      return;
    }

    if (!tenantId) {
      alert('Error: No se ha identificado el tenant. Por favor recarga la página.');
      return;
    }

    setIsImporting(true);
    setImportResults(null);

    try {
      const results = await onImport(file, tenantId);
      setImportResults(results);
      
      if (results.successful > 0) {
        onSuccess(`Se importaron ${results.successful} de ${results.total} ${type}s correctamente`);
      }
    } catch (error) {
      console.error('Error importing:', error);
      setImportResults({
        total: 0,
        successful: 0,
        errors: [error.message]
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResults(null);
    setShowInstructions(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Importar {type === "entrada" ? "Entradas" : "Salidas"} desde CSV
            </h3>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {!showInstructions ? (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleccionar archivo CSV
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                  Descargar Plantilla
                </button>
                <button
                  onClick={() => setShowInstructions(true)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Ver Instrucciones
                </button>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                <h4 className="font-medium text-yellow-800 mb-2">Importante:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• El archivo debe estar en formato CSV con codificación UTF-8</li>
                  <li>• Los nombres de General, Concepto{type === "salida" ? ", Proveedor" : ""} y Subconcepto deben coincidir exactamente con los existentes</li>
                  <li>
                    • Fechas: <strong>YYYY-MM-DD</strong> (así exporta el sistema). También se aceptan{" "}
                    <strong>DD/MM/YYYY</strong> y <strong>DD/MM/AA</strong> (día primero, México); no uses
                    el parseo ambiguo de Excel sin revisar.
                  </li>
                  <li>• Los estados válidos son: pendiente, parcial, pagado</li>
                  {type === "salida" && (
                    <li>• El campo Proveedor es opcional, déjalo vacío si no aplica</li>
                  )}
                  <li>• Los datos se importarán en el tenant actual</li>
                </ul>
              </div>

              {importResults && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">Resultados de la importación:</h4>
                  <div className="bg-gray-50 border rounded-md p-4">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Total:</span> {importResults.total} registros
                    </p>
                    <p className="text-sm text-green-700">
                      <span className="font-medium">Exitosos:</span> {importResults.successful}
                    </p>
                    {importResults.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-700">Errores:</p>
                        <div className="mt-1 max-h-32 overflow-y-auto">
                          {importResults.errors.map((error, index) => (
                            <p key={index} className="text-xs text-red-600">{error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || isImporting || !tenantId}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isImporting ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">Formato del archivo CSV</h4>
                <p className="text-sm text-gray-600 mb-4">
                  El archivo debe contener las siguientes columnas en este orden:
                </p>
                <div className="bg-gray-50 p-4 rounded-md mb-4">
                  <code className="text-sm">
                    {type === "entrada" 
                      ? "Fecha,General,Concepto,Subconcepto,Descripción,Monto,Estado"
                      : "Fecha,General,Concepto,Subconcepto,Proveedor,Descripción,Monto,Estado"
                    }
                  </code>
                </div>
                
                <h5 className="font-medium text-gray-800 mb-2">Descripción de columnas:</h5>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>
                    <strong>Fecha:</strong> Preferente <strong>YYYY-MM-DD</strong> (ej: 2024-03-15), igual que
                    al exportar desde el sistema. Alternativas con día primero: DD/MM/YYYY o DD/MM/AA (ej:
                    7/3/2026 o 07/03/26 = 7 de marzo).
                  </li>
                  <li><strong>General:</strong> Nombre exacto del catálogo general existente en este tenant</li>
                  <li><strong>Concepto:</strong> Nombre exacto del concepto existente en este tenant</li>
                  <li><strong>Subconcepto:</strong> Nombre del subconcepto (opcional, dejar vacío si no aplica)</li>
                  {type === "salida" && (
                    <li><strong>Proveedor:</strong> Nombre del proveedor (opcional, dejar vacío si no aplica)</li>
                  )}
                  <li><strong>Descripción:</strong> Descripción de la transacción (opcional)</li>
                  <li><strong>Monto:</strong> Cantidad numérica sin símbolos (ej: 1250.50)</li>
                  <li><strong>Estado:</strong> pendiente, parcial o pagado</li>
                </ul>
                
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    <strong>Tip:</strong> Usa la plantilla descargable para asegurar el formato correcto.
                    Los catálogos deben existir en el tenant actual antes de importar.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowInstructions(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Volver al Importador
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}