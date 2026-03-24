import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../../components/layout/AdminLayout";
import ProtectedRoute from "../../../components/auth/ProtectedRoute";
import { useAuth } from "../../../context/AuthContextMultiTenant";
import { useToast } from "../../../components/ui/Toast";
import { generalService } from "../../../lib/services/generalService";
import { conceptService } from "../../../lib/services/conceptService";
import { subconceptService } from "../../../lib/services/subconceptService";
import { providerService } from "../../../lib/services/providerService";
import { descriptionService } from "../../../lib/services/descriptionService";
import {
  splitCsvLine,
  normalizeTipoMovimiento,
  parseSiNoCell,
  formatGeneralCreatedAtForExport,
  detectGeneralesCsvLayout,
  parseGeneralesDataRow,
  catalogByNameMap,
  rowsToCsvString,
  triggerDownloadBlob,
} from "../../../lib/catalogs/catalogosHelpers";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  FolderOpenIcon,
  DocumentTextIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

// Clases completas (Tailwind no incluye utilidades con plantillas dinámicas tipo `bg-${color}-600`)
const catalogCardBtnBase =
  "w-full px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

const CATALOG_UI = {
  generales: {
    iconBox: "bg-blue-100",
    iconText: "text-blue-600",
    badge: "bg-blue-100 text-blue-800",
    exportBtn: `${catalogCardBtnBase} bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500`,
    importBtn: `${catalogCardBtnBase} bg-blue-500 hover:bg-blue-600 focus-visible:ring-blue-400`,
  },
  conceptos: {
    iconBox: "bg-green-100",
    iconText: "text-green-600",
    badge: "bg-green-100 text-green-800",
    exportBtn: `${catalogCardBtnBase} bg-green-600 hover:bg-green-700 focus-visible:ring-green-500`,
    importBtn: `${catalogCardBtnBase} bg-green-500 hover:bg-green-600 focus-visible:ring-green-400`,
  },
  subconceptos: {
    iconBox: "bg-amber-100",
    iconText: "text-amber-700",
    badge: "bg-amber-100 text-amber-900",
    // Exportar más oscuro que Importar (misma familia ámbar)
    exportBtn: `${catalogCardBtnBase} bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-600`,
    importBtn: `${catalogCardBtnBase} bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500`,
  },
  proveedores: {
    iconBox: "bg-purple-100",
    iconText: "text-purple-600",
    badge: "bg-purple-100 text-purple-800",
    exportBtn: `${catalogCardBtnBase} bg-purple-600 hover:bg-purple-700 focus-visible:ring-purple-500`,
    importBtn: `${catalogCardBtnBase} bg-purple-500 hover:bg-purple-600 focus-visible:ring-purple-400`,
  },
  descripciones: {
    iconBox: "bg-pink-100",
    iconText: "text-pink-600",
    badge: "bg-pink-100 text-pink-800",
    exportBtn: `${catalogCardBtnBase} bg-pink-600 hover:bg-pink-700 focus-visible:ring-pink-500`,
    importBtn: `${catalogCardBtnBase} bg-pink-500 hover:bg-pink-600 focus-visible:ring-pink-400`,
  },
};

const CATALOG_CARD_DEFS = [
  { key: "generales", name: "Generales" },
  { key: "conceptos", name: "Conceptos" },
  { key: "subconceptos", name: "Sub-conceptos" },
  { key: "proveedores", name: "Proveedores" },
  { key: "descripciones", name: "Descripciones" },
];

function ImportResultsPanel({ results }) {
  if (!results) return null;
  return (
    <div className="mb-6">
      <h4 className="font-medium text-gray-900 mb-2">Resultados de la importación:</h4>
      <div className="bg-gray-50 border rounded-md p-4">
        <p className="text-sm text-gray-700">
          <span className="font-medium">Total:</span> {results.total} registros
        </p>
        <p className="text-sm text-green-700">
          <span className="font-medium">Exitosos:</span> {results.successful}
        </p>
        {results.errors.length > 0 && (
          <div className="mt-3">
            <p className="text-sm font-medium text-red-700">Errores:</p>
            <div className="mt-1 max-h-32 overflow-y-auto">
              {results.errors.map((error, index) => (
                <p key={index} className="text-xs text-red-600">
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CatalogosPage = () => {
  const {
    user,
    tenantInfo,
    TENANT_ROLES,
    roleLoading,
    tenantLoading,
    isLegacyUser,
    checkPermission,
  } = useAuth();
  const router = useRouter();
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [catalogsData, setCatalogsData] = useState({
    generales: [],
    conceptos: [],
    subconceptos: [],
    proveedores: [],
    descripciones: []
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showIndividualImportModal, setShowIndividualImportModal] = useState(false);
  const [selectedCatalogType, setSelectedCatalogType] = useState(null);
  const [importResults, setImportResults] = useState(null);

  // Multi-tenant support
  const tenantId = useMemo(() => tenantInfo?.id, [tenantInfo?.id]);
  const tenantSlug = useMemo(
    () => tenantInfo?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "tenant",
    [tenantInfo?.name]
  );

  const generalById = useMemo(() => {
    const m = new Map();
    for (const g of catalogsData.generales) m.set(g.id, g);
    return m;
  }, [catalogsData.generales]);

  const conceptById = useMemo(() => {
    const m = new Map();
    for (const c of catalogsData.conceptos) m.set(c.id, c);
    return m;
  }, [catalogsData.conceptos]);

  const generalByName = useMemo(
    () => catalogByNameMap(catalogsData.generales),
    [catalogsData.generales]
  );
  const conceptByName = useMemo(
    () => catalogByNameMap(catalogsData.conceptos),
    [catalogsData.conceptos]
  );

  const catalogCards = useMemo(
    () =>
      CATALOG_CARD_DEFS.map((c) => ({
        ...c,
        count: (catalogsData[c.key] || []).length,
      })),
    [catalogsData]
  );

  // Admin/contador en tenant, o usuario legacy con configuración (evita falso negativo antes de cargar rol)
  const canManageCatalogs =
    !!TENANT_ROLES &&
    (tenantInfo?.role === TENANT_ROLES.ADMIN ||
      tenantInfo?.role === TENANT_ROLES.CONTADOR ||
      (isLegacyUser && checkPermission("canManageSettings")));

  const authResolved = !!user && !roleLoading && !tenantLoading;

  const loadAllCatalogs = useCallback(async () => {
    try {
      setLoading(true);

      // Check if we have tenant ID
      if (!tenantId) {
        console.error("No tenant ID available");
        setLoading(false);
        return;
      }

      const [generales, conceptos, subconceptos, proveedores, descripciones] = await Promise.all([
        generalService.getAll(tenantId),
        conceptService.getAll(tenantId),
        subconceptService.getAll(tenantId),
        providerService.getAll(tenantId),
        descriptionService?.getAll(tenantId) || []
      ]);

      setCatalogsData({
        generales,
        conceptos,
        subconceptos,
        proveedores,
        descripciones
      });
    } catch (error) {
      console.error("Error loading catalogs:", error);
      toast.error("Error al cargar los catálogos");
    } finally {
      setLoading(false);
    }
  }, [toast, tenantId]);

  useEffect(() => {
    // No evaluar permisos hasta que termine loadUserRole (si no, tenantInfo es null y parece "sin permiso")
    if (!authResolved) return;

    if (!canManageCatalogs) {
      toast.error("No tienes permisos para gestionar catálogos");
      router.push("/admin/dashboard");
      return;
    }
    if (tenantId) {
      loadAllCatalogs();
    }
  }, [authResolved, canManageCatalogs, router, toast, loadAllCatalogs, tenantId]);

  const exportAllCatalogs = async () => {
    try {
      // Validate tenant ID
      if (!tenantId) {
        toast.error("Error: No hay información de tenant disponible");
        return;
      }

      setLoading(true);
      
      // Crear datos para cada catálogo
      const catalogsExport = {
        metadata: {
          exportDate: new Date().toISOString(),
          tenantId: tenantId,
          tenantName: tenantInfo?.name || 'unknown',
          version: '1.0'
        },
        generales: catalogsData.generales.map((item) => ({
          id: item.id,
          nombre: item.name,
          tipo: item.type || '',
          tipo_movimiento: item.type || '',
          descripcion: item.description || '',
          maneja_saldo_anterior_y_actual: item.hasPreviousBalance === true,
          activo: item.isActive !== false,
          fecha_creacion: formatGeneralCreatedAtForExport(item),
        })),
        conceptos: catalogsData.conceptos.map(item => ({
          id: item.id,
          nombre: item.name,
          descripcion: item.description || '',
          tipo_movimiento: item.type || '',
          general_id: item.generalId || '',
          general_nombre: generalById.get(item.generalId)?.name || "",
          activo: item.isActive !== false
        })),
        subconceptos: catalogsData.subconceptos.map(item => ({
          id: item.id,
          nombre: item.name,
          descripcion: item.description || '',
          concepto_id: item.conceptId || '',
          concepto_nombre: conceptById.get(item.conceptId)?.name || "",
          activo: item.isActive !== false
        })),
        proveedores: catalogsData.proveedores.map(item => ({
          id: item.id,
          nombre: item.name,
          contacto: item.contact || '',
          telefono: item.phone || '',
          email: item.email || '',
          direccion: item.address || '',
          activo: item.isActive !== false
        })),
        descripciones: catalogsData.descripciones.map(item => ({
          id: item.id,
          nombre: item.name,
          descripcion: item.description || '',
          activo: item.isActive !== false
        }))
      };

      // Crear archivo JSON
      const jsonContent = JSON.stringify(catalogsExport, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      const timestamp = new Date().toISOString().split("T")[0];
      triggerDownloadBlob(blob, `catalogos_completos_${tenantSlug}_${timestamp}.json`);

      toast.success("Catálogos exportados exitosamente");
    } catch (error) {
      console.error('Error exporting catalogs:', error);
      toast.error('Error al exportar los catálogos');
    } finally {
      setLoading(false);
    }
  };

  const exportCatalogToCSV = async (catalogType) => {
    try {
      let data = [];
      let headers = [];
      let filename = '';

      switch (catalogType) {
        case 'generales':
          headers = [
            'Nombre',
            'Tipo',
            'Descripción',
            'Maneja saldo anterior y actual',
            'Activo',
            'Fecha creación',
          ];
          data = catalogsData.generales.map((item) => [
            item.name,
            item.type || '',
            item.description || '',
            item.hasPreviousBalance ? 'Sí' : 'No',
            item.isActive !== false ? 'Sí' : 'No',
            formatGeneralCreatedAtForExport(item) || '',
          ]);
          filename = 'generales';
          break;
        case 'conceptos':
          headers = ['Nombre', 'Descripción', 'Tipo Movimiento', 'General', 'Activo'];
          data = catalogsData.conceptos.map(item => [
            item.name,
            item.description || '',
            item.type || '',
            generalById.get(item.generalId)?.name || "",
            item.isActive !== false ? 'Sí' : 'No'
          ]);
          filename = 'conceptos';
          break;
        case 'subconceptos':
          headers = ['Nombre', 'Descripción', 'Concepto', 'Activo'];
          data = catalogsData.subconceptos.map(item => [
            item.name,
            item.description || '',
            conceptById.get(item.conceptId)?.name || "",
            item.isActive !== false ? 'Sí' : 'No'
          ]);
          filename = 'subconceptos';
          break;
        case 'proveedores':
          headers = ['Nombre', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Activo'];
          data = catalogsData.proveedores.map(item => [
            item.name,
            item.contact || '',
            item.phone || '',
            item.email || '',
            item.address || '',
            item.isActive !== false ? 'Sí' : 'No'
          ]);
          filename = 'proveedores';
          break;
        case 'descripciones':
          headers = ['Nombre', 'Descripción', 'Activo'];
          data = catalogsData.descripciones.map(item => [
            item.name,
            item.description || '',
            item.isActive !== false ? 'Sí' : 'No'
          ]);
          filename = 'descripciones';
          break;
      }

      const fullCsvData = [headers, ...data];
      const csvContent = rowsToCsvString(fullCsvData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const timestamp = new Date().toISOString().split("T")[0];
      triggerDownloadBlob(blob, `${filename}_${tenantSlug}_${timestamp}.csv`);

      toast.success(`Catálogo ${filename} exportado exitosamente`);
    } catch (error) {
      console.error('Error exporting catalog:', error);
      toast.error('Error al exportar el catálogo');
    }
  };

  const handleImportFile = async (file) => {
    if (!file) {
      toast.error("Por favor selecciona un archivo");
      return;
    }

    // Validate tenant ID
    if (!tenantId) {
      toast.error("Error: No hay información de tenant disponible para importar");
      return;
    }

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Skip metadata if present
      if (importData.metadata) {
        delete importData.metadata;
      }

      let results = {
        total: 0,
        successful: 0,
        errors: []
      };

      // Importar cada catálogo
      for (const [catalogType, items] of Object.entries(importData)) {
        if (!Array.isArray(items)) continue;

        results.total += items.length;

        for (const item of items) {
          try {
            switch (catalogType) {
              case 'generales': {
                const tipoRaw =
                  item.tipo_movimiento ?? item.tipo ?? item.type ?? 'ambos';
                const saldoRaw =
                  item.maneja_saldo_anterior_y_actual ??
                  item.hasPreviousBalance;
                await generalService.create(
                  {
                    name: item.nombre,
                    description: item.descripcion ?? item.description ?? '',
                    type: normalizeTipoMovimiento(tipoRaw),
                    hasPreviousBalance:
                      typeof saldoRaw === 'boolean'
                        ? saldoRaw
                        : parseSiNoCell(saldoRaw, false),
                    isActive:
                      typeof item.activo === 'boolean'
                        ? item.activo
                        : parseSiNoCell(item.activo, true),
                  },
                  tenantId
                );
                break;
              }
              case "conceptos": {
                const general = generalByName.get(item.general_nombre);
                if (!general) {
                  throw new Error(`General "${item.general_nombre}" no encontrado`);
                }
                const tipoConcept =
                  item.tipo_movimiento ?? item.tipo ?? item.type ?? "ambos";
                await conceptService.create(
                  {
                    name: item.nombre,
                    description: item.descripcion ?? item.description ?? "",
                    type: normalizeTipoMovimiento(tipoConcept),
                    generalId: general.id,
                    isActive:
                      typeof item.activo === "boolean"
                        ? item.activo
                        : parseSiNoCell(item.activo, true),
                  },
                  tenantId
                );
                break;
              }
              case "subconceptos": {
                const concept = conceptByName.get(item.concepto_nombre);
                if (!concept) {
                  throw new Error(`Concepto "${item.concepto_nombre}" no encontrado`);
                }
                await subconceptService.create(
                  {
                    name: item.nombre,
                    description: item.descripcion ?? item.description ?? "",
                    conceptId: concept.id,
                    isActive:
                      typeof item.activo === "boolean"
                        ? item.activo
                        : parseSiNoCell(item.activo, true),
                  },
                  tenantId
                );
                break;
              }
              case "proveedores":
                await providerService.create(
                  {
                    name: item.nombre,
                    contact: item.contacto,
                    phone: item.telefono,
                    email: item.email,
                    address: item.direccion,
                    isActive:
                      typeof item.activo === "boolean"
                        ? item.activo
                        : parseSiNoCell(item.activo, true),
                  },
                  tenantId
                );
                break;
              case "descripciones":
                if (descriptionService?.create) {
                  await descriptionService.create(
                    {
                      name: item.nombre,
                      description: item.descripcion ?? item.description ?? "",
                      isActive:
                        typeof item.activo === "boolean"
                          ? item.activo
                          : parseSiNoCell(item.activo, true),
                    },
                    tenantId
                  );
                }
                break;
            }
            results.successful++;
          } catch (error) {
            results.errors.push(`${catalogType} - ${item.nombre}: ${error.message}`);
          }
        }
      }

      setImportResults(results);
      
      if (results.successful > 0) {
        toast.success(`Importación completada: ${results.successful} de ${results.total} elementos importados`);
        loadAllCatalogs(); // Recargar datos
      }

      return results;
    } catch (error) {
      console.error('Error importing file:', error);
      const errorResult = {
        total: 0,
        successful: 0,
        errors: [`Error al procesar archivo: ${error.message}`]
      };
      setImportResults(errorResult);
      return errorResult;
    }
  };

  const handleImportIndividualCsv = async (file, catalogType) => {
    if (!file) {
      toast.error("Por favor selecciona un archivo");
      return;
    }

    // Validate tenant ID
    if (!tenantId) {
      toast.error("Error: No hay información de tenant disponible para importar");
      return;
    }

    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      
      if (lines.length <= 1) {
        throw new Error('El archivo CSV está vacío o solo contiene headers');
      }

      const headerRow = splitCsvLine(lines[0]);
      const generalesLayout =
        catalogType === 'generales'
          ? detectGeneralesCsvLayout(headerRow)
          : null;

      const dataLines = lines.slice(1);
      const results = {
        total: dataLines.length,
        successful: 0,
        errors: []
      };

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const lineNumber = i + 2; // +2 porque saltamos header y empezamos en 1
        
        try {
          const values = splitCsvLine(line);

          // Validar y crear según el tipo
          switch (catalogType) {
            case 'generales': {
              const payload = parseGeneralesDataRow(values, generalesLayout);
              if (!payload.name) {
                throw new Error('El nombre es obligatorio');
              }
              await generalService.create(
                {
                  name: payload.name,
                  description: payload.description,
                  type: payload.type,
                  hasPreviousBalance: payload.hasPreviousBalance,
                  isActive: payload.isActive,
                },
                tenantId
              );
              break;
            }

            case 'conceptos':
              if (values.length < 4) {
                throw new Error(`Se esperaban al menos 4 columnas (Nombre, Descripción, Tipo Movimiento, General), encontradas ${values.length}`);
              }
              
              const general = generalByName.get(values[3]?.trim());
              if (!general) {
                throw new Error(`General "${values[3]}" no encontrado`);
              }

              await conceptService.create(
                {
                  name: values[0]?.trim(),
                  description: values[1]?.trim() || "",
                  type: normalizeTipoMovimiento(values[2]),
                  generalId: general.id,
                  isActive: parseSiNoCell(values[4], true),
                },
                tenantId
              );
              break;

            case 'subconceptos':
              if (values.length < 3) {
                throw new Error(`Se esperaban al menos 3 columnas (Nombre, Descripción, Concepto), encontradas ${values.length}`);
              }
              
              const concept = conceptByName.get(values[2]?.trim());
              if (!concept) {
                throw new Error(`Concepto "${values[2]}" no encontrado`);
              }

              await subconceptService.create(
                {
                  name: values[0]?.trim(),
                  description: values[1]?.trim() || "",
                  conceptId: concept.id,
                  isActive: parseSiNoCell(values[3], true),
                },
                tenantId
              );
              break;

            case 'proveedores':
              if (values.length < 1) {
                throw new Error(`Se esperaba al menos 1 columna (Nombre), encontradas ${values.length}`);
              }

              await providerService.create({
                name: values[0]?.trim(),
                contact: values[1]?.trim() || '',
                phone: values[2]?.trim() || '',
                email: values[3]?.trim() || '',
                address: values[4]?.trim() || '',
                isActive: parseSiNoCell(values[5], true),
              }, tenantId);
              break;

            case 'descripciones':
              if (values.length < 1) {
                throw new Error(`Se esperaba al menos 1 columna (Nombre), encontradas ${values.length}`);
              }

              if (descriptionService?.create) {
                await descriptionService.create({
                  name: values[0]?.trim(),
                  description: values[1]?.trim() || '',
                  isActive: parseSiNoCell(values[2], true),
                }, tenantId);
              }
              break;

            default:
              throw new Error(`Tipo de catálogo no soportado: ${catalogType}`);
          }

          results.successful++;
        } catch (error) {
          results.errors.push(`Línea ${lineNumber}: ${error.message}`);
        }
      }

      setImportResults(results);
      
      if (results.successful > 0) {
        toast.success(`Importación completada: ${results.successful} de ${results.total} elementos importados`);
        loadAllCatalogs(); // Recargar datos
      }

      return results;
    } catch (error) {
      console.error('Error importing CSV:', error);
      const errorResult = {
        total: 0,
        successful: 0,
        errors: [`Error al procesar archivo: ${error.message}`]
      };
      setImportResults(errorResult);
      return errorResult;
    }
  };

  const downloadIndividualTemplate = (catalogType) => {
    let csvContent = '';

    switch (catalogType) {
      case 'generales':
        csvContent = `Nombre,Tipo,Descripción,Maneja saldo anterior y actual,Activo,Fecha creación
"Ingresos por Cuotas","entrada","Ingresos generados por cuotas de socios","No","Sí",""
"Gastos Operativos","salida","Gastos necesarios para el funcionamiento","Sí","Sí",""
"Categoría mixta","ambos","Puede usarse en entradas y salidas","No","Sí",""`;
        break;
      case 'conceptos':
        csvContent = `Nombre,Descripción,Tipo Movimiento,General,Activo
"Cuotas Mensuales","Cuotas regulares de socios","ingreso","Ingresos por Cuotas","Sí"
"Servicios Básicos","Electricidad agua gas internet","gasto","Gastos Operativos","Sí"
"Torneos","Organización de torneos","ingreso","Ingresos por Eventos","Sí"`;
        break;
      case 'subconceptos':
        csvContent = `Nombre,Descripción,Concepto,Activo
"Electricidad","Recibo de luz","Servicios Básicos","Sí"
"Agua","Recibo de agua","Servicios Básicos","Sí"
"Torneo de Primavera","Torneo anual","Torneos","Sí"`;
        break;
      case 'proveedores':
        csvContent = `Nombre,Contacto,Teléfono,Email,Dirección,Activo
"CFE","Juan Pérez","555-1234","contacto@cfe.mx","Av. Principal 123","Sí"
"Office Depot","Ana García","555-5678","ventas@officedepot.com","Centro Comercial","Sí"
"Papelería Lupita","Luis Martínez","555-9012","","Calle 5 de Mayo 456","Sí"`;
        break;
      case 'descripciones':
        csvContent = `Nombre,Descripción,Activo
"Material de Oficina","Compra de material para oficina","Sí"
"Mantenimiento","Servicios de mantenimiento","Sí"
"Capacitación","Gastos de capacitación del personal","Sí"`;
        break;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const timestamp = new Date().toISOString().split("T")[0];
    triggerDownloadBlob(blob, `plantilla_${catalogType}_${timestamp}.csv`);
  };

  const openIndividualImport = (catalogType) => {
    setSelectedCatalogType(catalogType);
    setImportResults(null);
    setShowIndividualImportModal(true);
  };

  return (
    <ProtectedRoute>
      <AdminLayout
        title="Gestión de Catálogos"
        breadcrumbs={[
          { name: "Dashboard", href: "/admin/dashboard" },
          { name: "Configuración" },
          { name: "Gestión de Catálogos" },
        ]}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-600 rounded-xl shadow-lg">
                  <FolderOpenIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Gestión de Catálogos
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Exporta e importa todos los catálogos del sistema
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={exportAllCatalogs}
                  disabled={loading}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 focus:ring-4 focus:ring-green-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" />
                  Exportar Todo (JSON)
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  disabled={loading}
                  className="px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 focus:ring-4 focus:ring-purple-500/20 focus:ring-offset-2 flex items-center justify-center transition-all duration-200 shadow-lg hover:shadow-xl font-medium disabled:opacity-50"
                >
                  <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />
                  Importar Todo
                </button>
              </div>
            </div>
          </div>

          {/* Catálogos individuales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { key: 'generales', name: 'Generales', count: catalogsData.generales.length },
              { key: 'conceptos', name: 'Conceptos', count: catalogsData.conceptos.length },
              { key: 'subconceptos', name: 'Sub-conceptos', count: catalogsData.subconceptos.length },
              { key: 'proveedores', name: 'Proveedores', count: catalogsData.proveedores.length },
              { key: 'descripciones', name: 'Descripciones', count: catalogsData.descripciones.length },
            ].map((catalog) => {
              const ui = CATALOG_UI[catalog.key];
              return (
              <div
                key={catalog.key}
                className="bg-white rounded-xl border border-gray-200 shadow-lg p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${ui.iconBox}`}>
                    <DocumentTextIcon className={`h-6 w-6 ${ui.iconText}`} />
                  </div>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${ui.badge}`}>
                    {catalog.count} elementos
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {catalog.name}
                </h3>
                
                <div className="space-y-2">
                  <button
                    onClick={() => exportCatalogToCSV(catalog.key)}
                    disabled={loading || catalog.count === 0}
                    className={ui.exportBtn}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </button>

                  <button
                    onClick={() => openIndividualImport(catalog.key)}
                    disabled={loading}
                    className={ui.importBtn}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                    Importar CSV
                  </button>

                  <button
                    onClick={() => downloadIndividualTemplate(catalog.key)}
                    className={`w-full px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center`}
                  >
                    <ArrowDownTrayIcon className="h-3 w-3 mr-1" />
                    Plantilla
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* Modal de Importación */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Importar Catálogos
                  </h3>
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResults(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar archivo JSON de catálogos
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleImportFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                  <h4 className="font-medium text-yellow-800 mb-2">Importante:</h4>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Solo se aceptan archivos JSON exportados por este sistema</li>
                    <li>• La importación creará nuevos registros, no actualizará existentes</li>
                    <li>• Asegúrate de tener los permisos necesarios</li>
                    <li>• Se recomienda hacer un respaldo antes de importar</li>
                  </ul>
                </div>

                <ImportResultsPanel results={importResults} />

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowImportModal(false);
                      setImportResults(null);
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Importación Individual */}
        {showIndividualImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Importar {selectedCatalogType?.charAt(0).toUpperCase() + selectedCatalogType?.slice(1)} desde CSV
                  </h3>
                  <button
                    onClick={() => {
                      setShowIndividualImportModal(false);
                      setImportResults(null);
                      setSelectedCatalogType(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar archivo CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleImportIndividualCsv(e.target.files[0], selectedCatalogType);
                      }
                    }}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                </div>

                <div className="mb-6">
                  <button
                    onClick={() => downloadIndividualTemplate(selectedCatalogType)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Descargar Plantilla
                  </button>
                </div>

                {/* Instrucciones específicas por catálogo */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                  <h4 className="font-medium text-yellow-800 mb-2">Formato requerido para {selectedCatalogType}:</h4>
                  <div className="text-sm text-yellow-700">
                    {selectedCatalogType === 'generales' && (
                      <div>
                        <p className="font-medium">
                          Columnas (export actual): Nombre, Tipo, Descripción, Maneja saldo anterior y
                          actual, Activo, Fecha creación
                        </p>
                        <ul className="mt-1 space-y-1">
                          <li>
                            • <strong>Tipo:</strong> entrada, salida, ambos (también se aceptan ingreso,
                            gasto como en plantillas antiguas)
                          </li>
                          <li>
                            • <strong>Maneja saldo anterior y actual:</strong> Sí/No — mismo criterio
                            que en el formulario de alta (comparativa en dashboard)
                          </li>
                          <li>• <strong>Activo:</strong> Sí/No (por defecto Sí si se omite)</li>
                          <li>
                            • <strong>Fecha creación:</strong> solo informativa en la exportación; al
                            importar se asigna la fecha actual en el sistema
                          </li>
                          <li>
                            • <strong>Archivos antiguos:</strong> si la cabecera sigue siendo Nombre,
                            Descripción, Tipo Movimiento, Activo, se importan igual (sin saldo
                            anterior; queda en No)
                          </li>
                        </ul>
                      </div>
                    )}
                    {selectedCatalogType === 'conceptos' && (
                      <div>
                        <p className="font-medium">Columnas: Nombre, Descripción, Tipo Movimiento, General, Activo</p>
                        <ul className="mt-1 space-y-1">
                          <li>• <strong>Tipo Movimiento:</strong> ingreso, gasto, ambos</li>
                          <li>• <strong>General:</strong> Debe coincidir con un catálogo general existente</li>
                          <li>• <strong>Activo:</strong> Sí/No (opcional, por defecto Sí)</li>
                        </ul>
                      </div>
                    )}
                    {selectedCatalogType === 'subconceptos' && (
                      <div>
                        <p className="font-medium">Columnas: Nombre, Descripción, Concepto, Activo</p>
                        <ul className="mt-1 space-y-1">
                          <li>• <strong>Concepto:</strong> Debe coincidir con un concepto existente</li>
                          <li>• <strong>Activo:</strong> Sí/No (opcional, por defecto Sí)</li>
                        </ul>
                      </div>
                    )}
                    {selectedCatalogType === 'proveedores' && (
                      <div>
                        <p className="font-medium">Columnas: Nombre, Contacto, Teléfono, Email, Dirección, Activo</p>
                        <ul className="mt-1 space-y-1">
                          <li>• Solo el <strong>Nombre</strong> es obligatorio</li>
                          <li>• Los demás campos son opcionales</li>
                          <li>• <strong>Activo:</strong> Sí/No (opcional, por defecto Sí)</li>
                        </ul>
                      </div>
                    )}
                    {selectedCatalogType === 'descripciones' && (
                      <div>
                        <p className="font-medium">Columnas: Nombre, Descripción, Activo</p>
                        <ul className="mt-1 space-y-1">
                          <li>• Solo el <strong>Nombre</strong> es obligatorio</li>
                          <li>• <strong>Activo:</strong> Sí/No (opcional, por defecto Sí)</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <ImportResultsPanel results={importResults} />

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowIndividualImportModal(false);
                      setImportResults(null);
                      setSelectedCatalogType(null);
                    }}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
};

export default CatalogosPage;