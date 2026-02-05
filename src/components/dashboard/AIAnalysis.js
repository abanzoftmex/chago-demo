import { useState, useEffect } from "react";
import { aiAnalysisService } from "../../lib/services";

const AIAnalysis = () => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState("month");
  const [metrics, setMetrics] = useState(null);

  const timeframeOptions = [
    { value: "week", label: "Esta Semana" },
    { value: "month", label: "Este Mes" },
    { value: "quarter", label: "Este Trimestre" },
    { value: "year", label: "Este Año" },
  ];

  const generateAnalysis = async () => {
    try {
      setLoading(true);
      setError("");
      
      const result = await aiAnalysisService.generateAnalysis(timeframe);
      setAnalysis(result.analysis);
      setMetrics(result.metrics);
    } catch (err) {
      console.error("Error generating analysis:", err);
      setError("Error al generar el análisis. Por favor, intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  const getTendencyIcon = (tendency) => {
    switch (tendency) {
      case "positive":
        return "📈";
      case "negative":
        return "📉";
      default:
        return "📊";
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case "danger":
        return "🚨";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case "alto":
        return "text-red-600 bg-red-50";
      case "medio":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-green-600 bg-green-50";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-600 rounded-xl shadow-lg">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Análisis con IA</h2>
              <p className="text-gray-600 mt-1">
                Insights inteligentes sobre tus finanzas
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
            >
              {timeframeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={generateAnalysis}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Analizando...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Generar Análisis
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Métricas rápidas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Entradas</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(metrics.totalIngresos)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Salidas</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(metrics.totalGastos)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${metrics.balanceNeto >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <svg className={`w-4 h-4 ${metrics.balanceNeto >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Balance</p>
                <p className={`text-lg font-semibold ${metrics.balanceNeto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(metrics.balanceNeto)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Promedio</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(metrics.promedioTransaccion)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Pendientes</p>
                <p className="text-lg font-semibold text-gray-900">{metrics.pendientesPorcentaje.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Ratio Gastos</p>
                <p className="text-lg font-semibold text-gray-900">{metrics.gastosPorcentaje.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Análisis */}
      {analysis && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-600 rounded-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Análisis Inteligente
                </h3>
                <p className="text-sm text-gray-600">
                  Generado por IA • {timeframeOptions.find(t => t.value === timeframe)?.label}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {/* Renderizar análisis estructurado */}
            {analysis && typeof analysis === 'object' ? (
              <div className="space-y-6">
                {/* Resumen Ejecutivo */}
                {analysis.resumenEjecutivo && (
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">Resumen Ejecutivo</h3>
                        <p className="text-blue-100 mb-4">{analysis.resumenEjecutivo.insight}</p>
                        <div className="flex items-center space-x-4">
                          <div>
                            <span className="text-2xl font-bold">
                              {analysis.resumenEjecutivo.totalTransacciones || 0}
                            </span>
                            <p className="text-sm text-blue-100">Transacciones</p>
                          </div>
                          <div>
                            <span className="text-2xl font-bold">
                              {formatCurrency(analysis.resumenEjecutivo.balanceNeto || 0)}
                            </span>
                            <p className="text-sm text-blue-100">Balance Neto</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-4xl">
                        {getTendencyIcon(analysis.resumenEjecutivo.tendenciaGeneral)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Gastos Destacados */}
                {analysis.gastosDestacados && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {analysis.gastosDestacados.transaccionMasAlta && (
                      <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">💸 Gasto más Alto</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Monto:</span>
                            <span className="font-bold text-red-600">
                              {formatCurrency(analysis.gastosDestacados.transaccionMasAlta.monto)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Concepto:</span>
                            <span className="font-medium">{analysis.gastosDestacados.transaccionMasAlta.concepto}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Proveedor:</span>
                            <span className="font-medium">{analysis.gastosDestacados.transaccionMasAlta.proveedor}</span>
                          </div>
                          <div className="bg-red-50 rounded p-2 text-center">
                            <span className="text-red-700 font-semibold">
                              {analysis.gastosDestacados.transaccionMasAlta.porcentajeDelTotal}% del total
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {analysis.gastosDestacados.categoriaConMayorGasto && (
                      <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Categoría Principal</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Concepto:</span>
                            <span className="font-medium">{analysis.gastosDestacados.categoriaConMayorGasto.concepto}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Monto:</span>
                            <span className="font-bold text-purple-600">
                              {formatCurrency(analysis.gastosDestacados.categoriaConMayorGasto.monto)}
                            </span>
                          </div>
                          <div className="bg-purple-50 rounded p-2 text-center">
                            <span className="text-purple-700 font-semibold">
                              {analysis.gastosDestacados.categoriaConMayorGasto.porcentajeDelTotal}% del total
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Proveedor Principal */}
                {analysis.proveedores && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">🏢 Proveedor Principal</h3>
                      {analysis.proveedores.concentracionRiesgo && (
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(analysis.proveedores.concentracionRiesgo)}`}>
                          Riesgo: {analysis.proveedores.concentracionRiesgo}
                        </span>
                      )}
                    </div>
                    {analysis.proveedores.principal && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-gray-600 text-sm">Nombre</p>
                          <p className="font-semibold">{analysis.proveedores.principal.nombre}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-sm">Monto Total</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(analysis.proveedores.principal.monto)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-sm">Transacciones</p>
                          <p className="font-semibold">{analysis.proveedores.principal.numeroTransacciones}</p>
                        </div>
                        <div>
                          <p className="text-gray-600 text-sm">% del Total</p>
                          <p className="font-semibold">{analysis.proveedores.principal.porcentajeDelTotal}%</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Estados de Pago */}
                {analysis.analisisTendencias && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">💳 Estado de Pagos</h3>
                    {analysis.analisisTendencias.estadoPagos && (
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {analysis.analisisTendencias.estadoPagos.pagadas}
                          </div>
                          <div className="text-sm text-green-700">Pagadas</div>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 rounded-lg">
                          <div className="text-2xl font-bold text-yellow-600">
                            {analysis.analisisTendencias.estadoPagos.pendientes}
                          </div>
                          <div className="text-sm text-yellow-700">Pendientes</div>
                        </div>
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {analysis.analisisTendencias.estadoPagos.parciales}
                          </div>
                          <div className="text-sm text-blue-700">Parciales</div>
                        </div>
                      </div>
                    )}
                    {analysis.analisisTendencias.patrones && (
                      <p className="text-gray-700 bg-gray-50 p-3 rounded">
                        <strong>Patrones:</strong> {analysis.analisisTendencias.patrones}
                      </p>
                    )}
                  </div>
                )}

                {/* Alertas */}
                {analysis.alertas && analysis.alertas.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">🔔 Alertas Financieras</h3>
                    <div className="space-y-3">
                      {analysis.alertas.map((alert, index) => (
                        <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                          <span className="text-xl">{getAlertIcon(alert.tipo)}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">{alert.titulo}</h4>
                            <p className="text-gray-600 text-sm">{alert.descripcion}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Métricas Adicionales */}
                {analysis.metricas && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Métricas Clave</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-xl font-bold text-blue-600">
                          {formatCurrency(analysis.metricas.gastoPromedioPorTransaccion || 0)}
                        </div>
                        <div className="text-sm text-gray-600">Gasto Promedio</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-xl font-bold text-purple-600">
                          {analysis.metricas.variabilidadGastos || "N/A"}
                        </div>
                        <div className="text-sm text-gray-600">Variabilidad</div>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-xl font-bold text-green-600">
                          {analysis.metricas.eficienciaPagos || 0}%
                        </div>
                        <div className="text-sm text-gray-600">Eficiencia Pagos</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No se pudo cargar el análisis correctamente</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!analysis && !loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="mx-auto w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Análisis con IA
          </h3>
          <p className="text-gray-600 mb-6">
            Haz clic en &quot;Generar Análisis&quot; para obtener insights inteligentes sobre tus finanzas
          </p>
        </div>
      )}

      {/* Footer informativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-blue-400">🤖</div>
          <div className="ml-3">
            <p className="text-sm text-blue-800">
              <strong>Powered by Gemini 2.0 Flash:</strong> Este análisis fue generado automáticamente usando 
              inteligencia artificial para identificar patrones y tendencias clave en tus datos financieros.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysis;
