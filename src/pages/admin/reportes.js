import { useState, useEffect } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { useToast } from "../../components/ui/Toast";
import { Button } from "../../components/ui/Button";
import { reportService } from "../../lib/services/reportService";
import { conceptService } from "../../lib/services/conceptService";
import {
  CalendarIcon,
  DocumentArrowDownIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const Reportes = () => {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [concepts, setConcepts] = useState([]);

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    type: "",
    conceptId: "",
  });
  const [currentMonthName, setCurrentMonthName] = useState("");
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    loadReferenceData();
    // Load initial report with current month
    setMonthRange(currentDate);
  }, []);

  const setMonthRange = (date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Set month name
    const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    setCurrentMonthName(monthName.charAt(0).toUpperCase() + monthName.slice(1));

    setFilters((prev) => ({
      ...prev,
      startDate: startOfMonth.toISOString().split("T")[0],
      endDate: endOfMonth.toISOString().split("T")[0],
    }));
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
    setMonthRange(newDate);
  };

  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      generateReport();
    }
  }, [filters]);

  const loadReferenceData = async () => {
    try {
      const conceptsData = await conceptService.getAll();
      setConcepts(conceptsData);
    } catch (err) {
      console.error("Error loading reference data:", err);
      error("Error al cargar datos de referencia");
    }
  };

  const generateReport = async () => {
    try {
      setLoading(true);

      const filterData = {
        ...filters,
        startDate: filters.startDate ? new Date(filters.startDate) : null,
        endDate: filters.endDate ? new Date(filters.endDate) : null,
      };

      const transactionsData =
        await reportService.getFilteredTransactions(filterData);
      const statsData =
        await reportService.generateReportStats(transactionsData);

      setTransactions(transactionsData);
      setStats(statsData);

      success("Reporte generado exitosamente");
    } catch (err) {
      console.error("Error generating report:", err);
      error("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      const filename = await reportService.exportToExcel(
        transactions,
        stats,
        filters
      );
      success(`Reporte exportado a Excel: ${filename}`);
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      error("Error al exportar a Excel");
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    try {
      setExporting(true);
      const filename = await reportService.exportToPDF(
        transactions,
        stats,
        filters
      );
      success(`Reporte exportado a PDF: ${filename}`);
    } catch (err) {
      console.error("Error exporting to PDF:", err);
      error("Error al exportar a PDF");
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  return (
    <AdminLayout
      title="Reportes"
      breadcrumbs={[
        { name: "Dashboard", href: "/admin/dashboard" },
        { name: "Reportes" },
      ]}
    >
      <div className="space-y-6">
        {/* Filters Section */}
        <div className="bg-background rounded-lg border border-border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-foreground flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2" />
              Filtros de Reporte
            </h2>
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigateMonth(-1)}
                className="p-1"
                aria-label="Mes anterior"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
              <span className="text-foreground font-medium">{currentMonthName}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigateMonth(1)}
                className="p-1"
                aria-label="Mes siguiente"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Fecha Inicio
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Fecha Fin
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="input-field"
              />
            </div>

            {/* Type Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Tipo
              </label>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange("type", e.target.value)}
                className="input-field"
              >
                <option value="">Todos</option>
                <option value="entrada">Ingreso</option>
                <option value="salida">Gasto</option>
              </select>
            </div>



            {/* Concept Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Concepto
              </label>
              <select
                value={filters.conceptId}
                onChange={(e) =>
                  handleFilterChange("conceptId", e.target.value)
                }
                className="input-field"
              >
                <option value="">Todos</option>
                {concepts.map((concept) => (
                  <option key={concept.id} value={concept.id}>
                    {concept.name} ({concept.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={generateReport}
              disabled={loading}
              variant="primary"
              size="md"
              className="inline-flex items-center"
            >
              {loading ? "Generando..." : "Generar Reporte"}
            </Button>

            <div className="flex space-x-2">
              <Button
                onClick={exportToExcel}
                disabled={!stats || exporting}
                variant="outline"
                size="sm"
                className="inline-flex items-center border-green-500 text-green-600 hover:bg-green-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                {exporting ? "Exportando..." : "Excel"}
              </Button>
              <Button
                onClick={exportToPDF}
                disabled={!stats || exporting}
                variant="outline"
                size="sm"
                className="inline-flex items-center border-red-500 text-red-600 hover:bg-red-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4 mr-2" />
                {exporting ? "Exportando..." : "PDF"}
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics Summary */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Total Ingreso
                  </h3>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(stats.totalEntradas)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stats.entradasCount} transacciones
                  </p>
                </div>
                <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Total Gasto
                  </h3>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(stats.totalSalidas)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stats.salidasCount} transacciones
                  </p>
                </div>
                <CurrencyDollarIcon className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Balance
                  </h3>
                  <p
                    className={`text-2xl font-bold ${stats.totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatCurrency(stats.totalBalance)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Diferencia neta
                  </p>
                </div>
                <ChartBarIcon
                  className={`h-8 w-8 ${stats.totalBalance >= 0 ? "text-green-600" : "text-red-600"}`}
                />
              </div>
            </div>

            <div className="bg-background rounded-lg border border-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Total Transacciones
                  </h3>
                  <p className="text-2xl font-bold text-primary">
                    {stats.totalTransactions}
                  </p>
                  <p className="text-sm text-muted-foreground">En el período</p>
                </div>
                <DocumentTextIcon className="h-8 w-8 text-primary" />
              </div>
            </div>
          </div>
        )}

        {/* Payment Status (for salidas) */}
        {stats && stats.salidasCount > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2" />
              Estado de Gastos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-green-800">Pagados</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-green-700 hover:bg-green-100 -mt-1 -mr-1"
                    onClick={() => {
                      if (window.confirm('¿Estás seguro de reiniciar el contador de pagados? Esto no afectará los datos históricos.')) {
                        setStats(prev => ({
                          ...prev,
                          paymentStatus: {
                            ...prev.paymentStatus,
                            pagado: { count: 0, amount: 0 }
                          }
                        }));
                        success('Contador de pagados reiniciado');
                      }
                    }}
                  >
                    Reiniciar
                  </Button>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {stats.paymentStatus.pagado.count}
                </p>
                <p className="text-sm text-green-600">
                  {formatCurrency(stats.paymentStatus.pagado.amount)}
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800">Parciales</h4>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats.paymentStatus.parcial.count}
                </p>
                <p className="text-sm text-yellow-600">
                  {formatCurrency(stats.paymentStatus.parcial.amount)}
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <h4 className="font-medium text-red-800">Pendientes</h4>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-red-700 hover:bg-red-100 -mt-1 -mr-1"
                    onClick={() => {
                      if (window.confirm('¿Estás seguro de reiniciar el contador de pendientes? Esto no afectará los datos históricos.')) {
                        setStats(prev => ({
                          ...prev,
                          paymentStatus: {
                            ...prev.paymentStatus,
                            pendiente: { count: 0, amount: 0 }
                          }
                        }));
                        success('Contador de pendientes reiniciado');
                      }
                    }}
                  >
                    Reiniciar
                  </Button>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  {stats.paymentStatus.pendiente.count}
                </p>
                <p className="text-sm text-red-600">
                  {formatCurrency(stats.paymentStatus.pendiente.amount)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Concept Breakdown */}
        {stats && Object.keys(stats.conceptBreakdown).length > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Desglose por Concepto
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Concepto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ingreso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Solicitudes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Cantidad
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {Object.entries(stats.conceptBreakdown).map(
                    ([concept, data]) => (
                      <tr key={concept}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          {concept}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                          {formatCurrency(data.entradas)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {formatCurrency(data.salidas)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          {formatCurrency(data.total)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {data.count}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Provider Breakdown (for salidas) */}
        {stats && Object.keys(stats.providerBreakdown).length > 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Desglose por Proveedor (Gastos)
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Monto Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Saldo Pendiente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Transacciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {Object.entries(stats.providerBreakdown).map(
                    ([provider, data]) => (
                      <tr key={provider}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                          {provider}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {formatCurrency(data.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {formatCurrency(data.pendingAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {data.count}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-background rounded-lg border border-border p-6">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-muted-foreground">
                Generando reporte...
              </span>
            </div>
          </div>
        )}

        {/* No Data State */}
        {!loading && stats && stats.totalTransactions === 0 && (
          <div className="bg-background rounded-lg border border-border p-6">
            <div className="border-2 border-dashed border-border rounded-lg h-32 flex items-center justify-center">
              <div className="text-center">
                <DocumentTextIcon className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">
                  No se encontraron transacciones con los filtros seleccionados
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Reportes;
