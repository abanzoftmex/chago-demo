import { useState } from "react";
import { generalService } from "../../lib/services/generalService";
import { conceptService } from "../../lib/services/conceptService";
import { subconceptService } from "../../lib/services/subconceptService";

export default function MassiveCsvImportModal({ isOpen, onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [errors, setErrors] = useState([]);
  const [showTableExample, setShowTableExample] = useState(false);

  const downloadTemplate = () => {
    const csvContent = `tipo,nombre,descripcion,general_nombre,concepto_nombre
general,Ingresos por Cuotas,Ingresos generados por cuotas de socios,,
general,Gastos Operativos,Gastos necesarios para el funcionamiento,,
general,Ingresos por Eventos,Ingresos por eventos especiales,,
concepto,Cuotas Mensuales,Cuotas regulares de socios,Ingresos por Cuotas,
concepto,Servicios Básicos,Electricidad agua gas internet,Gastos Operativos,
concepto,Torneos,Organización de torneos,Ingresos por Eventos,
subconcepto,Cuotas Juveniles,Cuotas categorías juveniles,Ingresos por Cuotas,Cuotas Mensuales
subconcepto,Electricidad,Factura mensual electricidad,Gastos Operativos,Servicios Básicos
subconcepto,Torneo Apertura,Torneo inicio temporada,Ingresos por Eventos,Torneos`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_importacion_masiva.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (csvText) => {
    const lines = csvText.trim().split("\n")
      .filter(line => line.trim() && !line.trim().startsWith('#'));
    
    if (lines.length === 0) {
      throw new Error("El archivo CSV está vacío o solo contiene comentarios");
    }
    
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    
    const requiredHeaders = ['tipo', 'nombre'];
    const missingHeaders = requiredHeaders.filter(header => 
      !headers.some(h => h.includes(header))
    );
    
    if (missingHeaders.length > 0) {
      throw new Error(`Faltan las columnas requeridas: ${missingHeaders.join(', ')}`);
    }
    
    const rows = lines.slice(1).map((line, index) => {
      const values = line.split(",").map(v => v.trim());
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      row.lineNumber = index + 2;
      return row;
    });
    
    const validTypes = ['general', 'concepto', 'subconcepto'];
    rows.forEach(row => {
      if (!row.tipo || !validTypes.includes(row.tipo.toLowerCase())) {
        throw new Error(`Línea ${row.lineNumber}: Tipo '${row.tipo}' no válido. Use: ${validTypes.join(', ')}`);
      }
      if (!row.nombre || row.nombre.trim() === '') {
        throw new Error(`Línea ${row.lineNumber}: El campo 'nombre' es requerido`);
      }
      if (row.tipo.toLowerCase() === 'concepto' && (!row.general_nombre || row.general_nombre.trim() === '')) {
        throw new Error(`Línea ${row.lineNumber}: Los conceptos requieren 'general_nombre'`);
      }
      if (row.tipo.toLowerCase() === 'subconcepto') {
        if (!row.general_nombre || row.general_nombre.trim() === '') {
          throw new Error(`Línea ${row.lineNumber}: Los subconceptos requieren 'general_nombre'`);
        }
        if (!row.concepto_nombre || row.concepto_nombre.trim() === '') {
          throw new Error(`Línea ${row.lineNumber}: Los subconceptos requieren 'concepto_nombre'`);
        }
      }
    });
    
    return rows;
  };

  const handleImport = async () => {
    if (!file) {
      setErrors(['Por favor selecciona un archivo CSV']);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrors(['El archivo debe tener extensión .csv']);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors(['El archivo no puede ser mayor a 5MB']);
      return;
    }

    setIsImporting(true);
    setErrors([]);
    setImportResults(null);

    try {
      const text = await file.text();
      
      if (!text.trim()) {
        throw new Error('El archivo está vacío');
      }

      const rows = parseCSV(text);
      
      const results = {
        generales: { created: [], errors: [] },
        conceptos: { created: [], errors: [] },
        subconceptos: { created: [], errors: [] }
      };

      const generalesMap = new Map();
      const conceptosMap = new Map();

      for (const row of rows) {
        try {
          if (row.tipo.toLowerCase() === 'general') {
            if (!row.nombre || row.nombre.trim() === '') {
              results.generales.errors.push(`Línea ${row.lineNumber}: Nombre requerido`);
              continue;
            }

            if (generalesMap.has(row.nombre.toLowerCase())) {
              results.generales.errors.push(`Línea ${row.lineNumber}: General '${row.nombre}' duplicado en el archivo`);
              continue;
            }

            const generalData = {
              name: row.nombre.trim(),
              description: row.descripcion || '',
              type: 'entrada'
            };

            const createdGeneral = await generalService.create(generalData);
            results.generales.created.push(createdGeneral);
            generalesMap.set(row.nombre.toLowerCase(), createdGeneral);
          }
        } catch (error) {
          results.generales.errors.push(`Línea ${row.lineNumber}: ${error.message}`);
        }
      }

      for (const row of rows) {
        try {
          if (row.tipo.toLowerCase() === 'concepto') {
            if (!row.nombre || row.nombre.trim() === '') {
              results.conceptos.errors.push(`Línea ${row.lineNumber}: Nombre requerido`);
              continue;
            }

            if (!row.general_nombre || row.general_nombre.trim() === '') {
              results.conceptos.errors.push(`Línea ${row.lineNumber}: General requerido para conceptos`);
              continue;
            }

            let general = generalesMap.get(row.general_nombre.toLowerCase());
            if (!general) {
              const existingGenerals = await generalService.getAll();
              general = existingGenerals.find(g => g.name.toLowerCase() === row.general_nombre.toLowerCase());
              if (!general) {
                results.conceptos.errors.push(`Línea ${row.lineNumber}: General '${row.general_nombre}' no encontrado`);
                continue;
              }
            }

            const conceptKey = `${row.nombre.toLowerCase()}-${general.id}`;
            if (conceptosMap.has(conceptKey)) {
              results.conceptos.errors.push(`Línea ${row.lineNumber}: Concepto '${row.nombre}' duplicado para el general '${row.general_nombre}'`);
              continue;
            }

            const conceptData = {
              name: row.nombre.trim(),
              description: row.descripcion || '',
              generalId: general.id,
              type: general.type
            };

            const createdConcept = await conceptService.create(conceptData);
            results.conceptos.created.push(createdConcept);
            conceptosMap.set(conceptKey, createdConcept);
          }
        } catch (error) {
          results.conceptos.errors.push(`Línea ${row.lineNumber}: ${error.message}`);
        }
      }

      for (const row of rows) {
        try {
          if (row.tipo.toLowerCase() === 'subconcepto') {
            if (!row.nombre || row.nombre.trim() === '') {
              results.subconceptos.errors.push(`Línea ${row.lineNumber}: Nombre requerido`);
              continue;
            }

            if (!row.general_nombre || row.general_nombre.trim() === '') {
              results.subconceptos.errors.push(`Línea ${row.lineNumber}: General requerido para subconceptos`);
              continue;
            }

            if (!row.concepto_nombre || row.concepto_nombre.trim() === '') {
              results.subconceptos.errors.push(`Línea ${row.lineNumber}: Concepto requerido para subconceptos`);
              continue;
            }

            let general = generalesMap.get(row.general_nombre.toLowerCase());
            if (!general) {
              const existingGenerals = await generalService.getAll();
              general = existingGenerals.find(g => g.name.toLowerCase() === row.general_nombre.toLowerCase());
              if (!general) {
                results.subconceptos.errors.push(`Línea ${row.lineNumber}: General '${row.general_nombre}' no encontrado`);
                continue;
              }
            }

            const conceptKey = `${row.concepto_nombre.toLowerCase()}-${general.id}`;
            let concept = conceptosMap.get(conceptKey);
            if (!concept) {
              const existingConcepts = await conceptService.getByGeneralId(general.id);
              concept = existingConcepts.find(c => c.name.toLowerCase() === row.concepto_nombre.toLowerCase());
              if (!concept) {
                results.subconceptos.errors.push(`Línea ${row.lineNumber}: Concepto '${row.concepto_nombre}' no encontrado`);
                continue;
              }
            }

            const subconceptData = {
              name: row.nombre.trim(),
              description: row.descripcion || '',
              conceptId: concept.id,
              type: concept.type
            };

            const createdSubconcept = await subconceptService.create(subconceptData);
            results.subconceptos.created.push(createdSubconcept);
          }
        } catch (error) {
          results.subconceptos.errors.push(`Línea ${row.lineNumber}: ${error.message}`);
        }
      }

      setImportResults(results);
      
      const totalCreated = results.generales.created.length + results.conceptos.created.length + results.subconceptos.created.length;
      if (totalCreated > 0 && onSuccess) {
        onSuccess();
      }

    } catch (error) {
      setErrors([`Error al procesar el archivo: ${error.message}`]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResults(null);
    setErrors([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-2xl rounded-xl bg-white border-gray-200">
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 -m-5 mb-5 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-xl font-bold text-white">
                  ⚽ Importación Masiva - Santiago FC
                </h3>
                <p className="text-orange-100 text-sm mt-1">
                  Gestiona los catálogos del club de forma eficiente
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-orange-100 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-green-800">
                  🏆 Instrucciones para el Equipo Administrativo
                </h4>
                <div className="mt-2 text-sm text-green-700">
                  <p>Importa múltiples elementos del catálogo de una sola vez. Ideal para configurar nuevas temporadas, categorías o actualizar la estructura financiera del club.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">1. Descargar Plantilla</h4>
            <p className="text-sm text-blue-700 mb-3">
              Descarga la plantilla CSV con ejemplos listos para usar.
            </p>
            <button
              onClick={downloadTemplate}
              className="inline-flex items-center px-4 py-2 border border-blue-300 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
            >
              <svg className="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar Plantilla
            </button>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
             <h4 className="font-medium text-gray-900 mb-3">2. Formato del Archivo</h4>
             <div className="text-sm text-gray-700 space-y-2">
               <p><strong>Columnas requeridas:</strong> tipo, nombre, descripcion, general_nombre, concepto_nombre</p>
               <p><strong>Valores válidos para 'tipo':</strong> general, concepto, subconcepto</p>
               <p><strong>Orden recomendado:</strong> Primero generales, luego conceptos, finalmente subconceptos</p>
             </div>
             
             {/* Accordion para ejemplo de tabla */}
             <div className="mt-4 border border-gray-200 rounded-lg">
               <button
                 onClick={() => setShowTableExample(!showTableExample)}
                 className="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 rounded-t-lg flex items-center justify-between transition-colors"
               >
                 <span className="font-medium text-gray-800">📊 Ver Ejemplo de Tabla</span>
                 <svg 
                   className={`w-5 h-5 text-gray-600 transform transition-transform ${showTableExample ? 'rotate-180' : ''}`}
                   fill="none" 
                   stroke="currentColor" 
                   viewBox="0 0 24 24"
                 >
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                 </svg>
               </button>
               
               {showTableExample && (
                 <div className="p-4 bg-white border-t border-gray-200">
                   <p className="text-sm text-gray-600 mb-3">Ejemplo de cómo se vería la tabla con los datos del CSV:</p>
                   <div className="overflow-x-auto">
                     <table className="min-w-full text-xs border border-gray-300">
                       <thead className="bg-orange-50">
                         <tr>
                           <th className="px-2 py-2 border border-gray-300 text-left font-semibold text-orange-800">Tipo</th>
                           <th className="px-2 py-2 border border-gray-300 text-left font-semibold text-orange-800">Nombre</th>
                           <th className="px-2 py-2 border border-gray-300 text-left font-semibold text-orange-800">Descripción</th>
                           <th className="px-2 py-2 border border-gray-300 text-left font-semibold text-orange-800">General</th>
                           <th className="px-2 py-2 border border-gray-300 text-left font-semibold text-orange-800">Concepto</th>
                         </tr>
                       </thead>
                       <tbody>
                         <tr className="bg-green-50">
                           <td className="px-2 py-2 border border-gray-300 font-medium text-green-700">general</td>
                           <td className="px-2 py-2 border border-gray-300">Ingresos por Cuotas</td>
                           <td className="px-2 py-2 border border-gray-300">Ingresos generados por cuotas de socios</td>
                           <td className="px-2 py-2 border border-gray-300 text-gray-400">-</td>
                           <td className="px-2 py-2 border border-gray-300 text-gray-400">-</td>
                         </tr>
                         <tr className="bg-green-50">
                           <td className="px-2 py-2 border border-gray-300 font-medium text-green-700">general</td>
                           <td className="px-2 py-2 border border-gray-300">Gastos Operativos</td>
                           <td className="px-2 py-2 border border-gray-300">Gastos necesarios para el funcionamiento</td>
                           <td className="px-2 py-2 border border-gray-300 text-gray-400">-</td>
                           <td className="px-2 py-2 border border-gray-300 text-gray-400">-</td>
                         </tr>
                         <tr className="bg-blue-50">
                           <td className="px-2 py-2 border border-gray-300 font-medium text-blue-700">concepto</td>
                           <td className="px-2 py-2 border border-gray-300">Cuotas Mensuales</td>
                           <td className="px-2 py-2 border border-gray-300">Cuotas regulares de socios</td>
                           <td className="px-2 py-2 border border-gray-300 font-medium">Ingresos por Cuotas</td>
                           <td className="px-2 py-2 border border-gray-300 text-gray-400">-</td>
                         </tr>
                         <tr className="bg-blue-50">
                           <td className="px-2 py-2 border border-gray-300 font-medium text-blue-700">concepto</td>
                           <td className="px-2 py-2 border border-gray-300">Servicios Básicos</td>
                           <td className="px-2 py-2 border border-gray-300">Electricidad agua gas internet</td>
                           <td className="px-2 py-2 border border-gray-300 font-medium">Gastos Operativos</td>
                           <td className="px-2 py-2 border border-gray-300 text-gray-400">-</td>
                         </tr>
                         <tr className="bg-purple-50">
                           <td className="px-2 py-2 border border-gray-300 font-medium text-purple-700">subconcepto</td>
                           <td className="px-2 py-2 border border-gray-300">Cuotas Juveniles</td>
                           <td className="px-2 py-2 border border-gray-300">Cuotas categorías juveniles</td>
                           <td className="px-2 py-2 border border-gray-300 font-medium">Ingresos por Cuotas</td>
                           <td className="px-2 py-2 border border-gray-300 font-medium">Cuotas Mensuales</td>
                         </tr>
                         <tr className="bg-purple-50">
                           <td className="px-2 py-2 border border-gray-300 font-medium text-purple-700">subconcepto</td>
                           <td className="px-2 py-2 border border-gray-300">Electricidad</td>
                           <td className="px-2 py-2 border border-gray-300">Factura mensual electricidad</td>
                           <td className="px-2 py-2 border border-gray-300 font-medium">Gastos Operativos</td>
                           <td className="px-2 py-2 border border-gray-300 font-medium">Servicios Básicos</td>
                         </tr>
                       </tbody>
                     </table>
                   </div>
                   <div className="mt-3 text-xs text-gray-600">
                     <p><strong>💡 Nota:</strong> Los colores indican la jerarquía: <span className="text-green-600">Verde = Generales</span>, <span className="text-blue-600">Azul = Conceptos</span>, <span className="text-purple-600">Morado = Subconceptos</span></p>
                   </div>
                 </div>
               )}
             </div>
           </div>

          <div className="bg-yellow-50 p-4 rounded-lg">
            <h4 className="font-medium text-yellow-900 mb-2">3. Seleccionar Archivo</h4>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
            />
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Archivo seleccionado: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {importResults && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">📊 Resultados de la Importación</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <h5 className="font-medium text-green-800">✅ Generales Creados</h5>
                  <p className="text-2xl font-bold text-green-600">{importResults.generales.created.length}</p>
                  {importResults.generales.created.length > 0 && (
                    <div className="mt-2 text-xs text-green-700">
                      {importResults.generales.created.map(item => (
                        <div key={item.id}>• {item.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h5 className="font-medium text-blue-800">✅ Conceptos Creados</h5>
                  <p className="text-2xl font-bold text-blue-600">{importResults.conceptos.created.length}</p>
                  {importResults.conceptos.created.length > 0 && (
                    <div className="mt-2 text-xs text-blue-700">
                      {importResults.conceptos.created.map(item => (
                        <div key={item.id}>• {item.name}</div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="bg-purple-50 p-3 rounded-lg">
                  <h5 className="font-medium text-purple-800">✅ Subconceptos Creados</h5>
                  <p className="text-2xl font-bold text-purple-600">{importResults.subconceptos.created.length}</p>
                  {importResults.subconceptos.created.length > 0 && (
                    <div className="mt-2 text-xs text-purple-700">
                      {importResults.subconceptos.created.map(item => (
                        <div key={item.id}>• {item.name}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {([...importResults.generales.errors, ...importResults.conceptos.errors, ...importResults.subconceptos.errors].length > 0) && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <h5 className="font-medium text-red-800 mb-2">
                    ⚠️ Errores Encontrados ({[...importResults.generales.errors, ...importResults.conceptos.errors, ...importResults.subconceptos.errors].length})
                  </h5>
                  <div className="space-y-2">
                    {importResults.generales.errors.length > 0 && (
                      <div>
                        <h6 className="font-medium text-red-700">Generales:</h6>
                        <div className="text-sm text-red-600 ml-4">
                          {importResults.generales.errors.map((error, index) => (
                            <p key={index}>• {error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {importResults.conceptos.errors.length > 0 && (
                      <div>
                        <h6 className="font-medium text-red-700">Conceptos:</h6>
                        <div className="text-sm text-red-600 ml-4">
                          {importResults.conceptos.errors.map((error, index) => (
                            <p key={index}>• {error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {importResults.subconceptos.errors.length > 0 && (
                      <div>
                        <h6 className="font-medium text-red-700">Subconceptos:</h6>
                        <div className="text-sm text-red-600 ml-4">
                          {importResults.subconceptos.errors.map((error, index) => (
                            <p key={index}>• {error}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-sm text-red-700">
                    <p><strong>💡 Consejos:</strong></p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Verifica que los nombres de generales y conceptos existan</li>
                      <li>Asegúrate de importar en orden: generales → conceptos → subconceptos</li>
                      <li>Revisa que no haya duplicados en el archivo</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 mb-2">Errores</h4>
              <div className="text-sm text-red-700 space-y-1">
                {errors.map((error, index) => (
                  <p key={index}>• {error}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cerrar
            </button>
            <button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Importando...
                </>
              ) : (
                "Importar CSV"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}