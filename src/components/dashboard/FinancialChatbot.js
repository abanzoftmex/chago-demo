import React, { useState } from "react";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import {
  Loader2,
  Send,
  Bot,
  MessageCircle,
  X,
  TrendingUp,
  PieChart,
  BarChart3,
  DollarSign,
  Sparkles,
} from "lucide-react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import ReusableDataTable from "../chatbot/ReusableDataTable";
import ReusableChart from "../chatbot/ReusableChart";
import ReusableMetricsList from "../chatbot/ReusableMetricsList";
import ReusableTextSection from "../chatbot/ReusableTextSection";

const FinancialChatbot = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [visualData, setVisualData] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const [showWelcome, setShowWelcome] = useState(true);

  // Sistema de colores consistente para conceptos
  const getConceptColor = (conceptName, format = "hex") => {
    // Paleta de 20 colores diferentes para conceptos
    const colorPalette = [
      { hex: "#3B82F6", tailwind: "from-blue-500 to-blue-600", name: "blue" }, // Azul
      {
        hex: "#10B981",
        tailwind: "from-emerald-500 to-emerald-600",
        name: "emerald",
      }, // Verde esmeralda
      {
        hex: "#F59E0B",
        tailwind: "from-amber-500 to-amber-600",
        name: "amber",
      }, // Ámbar
      { hex: "#EF4444", tailwind: "from-red-500 to-red-600", name: "red" }, // Rojo
      {
        hex: "#8B5CF6",
        tailwind: "from-violet-500 to-violet-600",
        name: "violet",
      }, // Violeta
      { hex: "#06B6D4", tailwind: "from-cyan-500 to-cyan-600", name: "cyan" }, // Cian
      { hex: "#84CC16", tailwind: "from-lime-500 to-lime-600", name: "lime" }, // Lima
      {
        hex: "#F97316",
        tailwind: "from-orange-500 to-orange-600",
        name: "orange",
      }, // Naranja
      { hex: "#EC4899", tailwind: "from-pink-500 to-pink-600", name: "pink" }, // Rosa
      {
        hex: "#6366F1",
        tailwind: "from-indigo-500 to-indigo-600",
        name: "indigo",
      }, // Índigo
      { hex: "#14B8A6", tailwind: "from-teal-500 to-teal-600", name: "teal" }, // Verde azulado
      {
        hex: "#A855F7",
        tailwind: "from-purple-500 to-purple-600",
        name: "purple",
      }, // Púrpura
      {
        hex: "#22C55E",
        tailwind: "from-green-500 to-green-600",
        name: "green",
      }, // Verde
      {
        hex: "#EAB308",
        tailwind: "from-yellow-500 to-yellow-600",
        name: "yellow",
      }, // Amarillo
      { hex: "#DC2626", tailwind: "from-red-600 to-red-700", name: "red-dark" }, // Rojo oscuro
      {
        hex: "#7C3AED",
        tailwind: "from-violet-600 to-violet-700",
        name: "violet-dark",
      }, // Violeta oscuro
      {
        hex: "#059669",
        tailwind: "from-emerald-600 to-emerald-700",
        name: "emerald-dark",
      }, // Verde esmeralda oscuro
      {
        hex: "#D97706",
        tailwind: "from-amber-600 to-amber-700",
        name: "amber-dark",
      }, // Ámbar oscuro
      {
        hex: "#BE185D",
        tailwind: "from-pink-600 to-pink-700",
        name: "pink-dark",
      }, // Rosa oscuro
      {
        hex: "#1E40AF",
        tailwind: "from-blue-600 to-blue-700",
        name: "blue-dark",
      }, // Azul oscuro
    ];

    // Crear un hash simple del nombre del concepto para asignar color consistente
    const hashCode = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };

    const colorIndex =
      hashCode(conceptName.toLowerCase().trim()) % colorPalette.length;
    const selectedColor = colorPalette[colorIndex];

    if (format === "hex") {
      return selectedColor.hex;
    } else if (format === "tailwind") {
      return selectedColor.tailwind;
    } else {
      return selectedColor;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(amount);
  };

  // Función para limpiar valores monetarios y convertirlos a números
  const parseValue = (value) => {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return 0;

    // Remover símbolos de moneda, espacios, comas y texto
    const cleanValue = value
      .replace(/[$,\s]/g, "") // Remover $, comas y espacios
      .replace(/MXN|USD|EUR|pesos?/gi, "") // Remover códigos de moneda
      .replace(/[^\d.-]/g, ""); // Mantener solo números, puntos y guiones

    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  };

  const suggestedQuestions = [
    "¿Cuánto gasté en los últimos 2 meses?", // Consulta mensual - 500 transacciones
    "¿Cuáles son mis mayores gastos este mes?", // Consulta mensual - 500 transacciones
    "Me puedes dar los generales del mes", // Nueva consulta específica
    "Me puedes dar los conceptos del mes", // Nueva consulta específica
    "¿Cuánto gasté en J2 este mes?", // Consulta específica de jornada
    "¿Cuáles son los subconceptos del mes?", // Nueva consulta de subconceptos
    "¿Cómo se distribuyen los gastos por división?", // Nueva consulta de divisiones
    "¿Cómo está mi balance actual?", // Consulta rápida - 100 transacciones
    "¿Cuál es mi tendencia de gastos histórica?", // Consulta histórica - 5000 transacciones
    "¿En qué concepto gasto más dinero este año?", // Consulta anual - 3000 transacciones
    "¿Qué proveedores son los más costosos en los últimos 6 meses?", // Consulta trimestral - 1500 transacciones
    "Muéstrame el análisis completo de mis finanzas", // Consulta histórica - 5000 transacciones
  ];

  const handleSendMessage = async (messageText = null) => {
    const message = messageText || inputMessage.trim();
    if (!message || isLoading) return;

    setLastQuery(message);
    setInputMessage("");
    setIsLoading(true);
    setError("");
    setResponseText("");
    setVisualData(null);
    setShowWelcome(false);
    setIsExpanded(false);

    try {
      const response = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: message }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.message || "Error al procesar la consulta");
        setIsLoading(false);
        return;
      }

      // Guardar el texto de respuesta
      setResponseText(data.response || "");

      // Verificar que data.data existe y tiene contenido
      if (
        data.data &&
        (data.data.metrics || data.data.percentages || data.data.transactions)
      ) {
        setVisualData(data);
      } else {
        setError("Se recibió la respuesta pero no hay datos para visualizar.");
      }
    } catch (err) {
      console.error("Error en chatbot:", err);
      setError("Error al procesar tu pregunta. Por favor, intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatResponseText = (text) => {
    if (!text) return null;

    // Dividir el texto en líneas
    const lines = text.split("\n");

    return (
      <div className="space-y-4">
        {lines.map((line, index) => {
          // Línea vacía
          if (!line.trim()) {
            return <div key={index} className="h-2"></div>;
          }

          // Títulos con **texto:**
          if (line.includes(":**")) {
            const parts = line.split(":**");
            return (
              <div
                key={index}
                className="border-l-4 border-blue-500 pl-4 py-2 bg-blue-50 rounded-r-lg"
              >
                <h4 className="font-bold text-blue-900 text-lg">
                  {parts[0].replace(/\*\*/g, "")}:
                </h4>
                {parts[1] && (
                  <p className="text-blue-800 mt-1">{parts[1].trim()}</p>
                )}
              </div>
            );
          }

          // Elementos de lista que empiezan con *
          if (line.trim().startsWith("*")) {
            const content = line.replace(/^\s*\*\s*/, "");
            // Manejar texto con negritas **texto**
            const formattedContent = content
              .split(/(\*\*[^*]+\*\*)/)
              .map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={i} className="font-bold text-gray-900">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return part;
              });

            return (
              <div key={index} className="flex items-start space-x-3 py-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <div className="text-gray-700 leading-relaxed">
                  {formattedContent}
                </div>
              </div>
            );
          }

          // Texto normal con formato de negritas
          const formattedLine = line.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={i} className="font-bold text-gray-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          });

          return (
            <p key={index} className="text-gray-700 leading-relaxed">
              {formattedLine}
            </p>
          );
        })}
      </div>
    );
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const renderPieChart = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-gray-500">
          No hay datos disponibles para el gráfico
        </div>
      );
    }

    // Transformar los datos para que funcionen con PieChart
    const chartData = data.map((item) => ({
      name: item.label,
      value: parseValue(item.value), // Limpiar y convertir a número
      percentage: parseValue(item.percentage), // Limpiar porcentaje también
      color: getConceptColor(item.label, "hex"), // Asignar color consistente basado en el concepto
    }));

    return (
      <div className="w-full h-[600px]">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${percentage}%`}
              outerRadius={185}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatCurrency(value), name]}
              labelFormatter={(label) => `${label}`}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value) => value}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderBarChart = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-gray-500">
          No hay datos disponibles para el gráfico
        </div>
      );
    }

    // Asegurar que los datos tienen la estructura correcta
    const chartData = data.map((item) => ({
      name: item.shortLabel || item.label || item.name,
      fullLabel: item.label || item.name,
      value: parseValue(item.value), // Limpiar y convertir a número
    }));

    return (
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              angle={-45}
              textAnchor="end"
              height={80}
              fontSize={12}
            />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value, name, props) => [
                formatCurrency(value),
                props.payload.fullLabel || name,
              ]}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullLabel || label;
                }
                return label;
              }}
            />
            <Legend />
            <Bar dataKey="value" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderLineChart = (data) => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return (
        <div className="flex items-center justify-center h-80 text-gray-500">
          No hay datos disponibles para el gráfico
        </div>
      );
    }

    // Asegurar que los datos tienen la estructura correcta
    const chartData = data.map((item) => ({
      name: item.label || item.name,
      value: parseValue(item.value),
    }));

    return (
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip formatter={(value) => [formatCurrency(value), "Monto"]} />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderMetricCards = (metrics) => {
    const getIcon = (key) => {
      if (key.toLowerCase().includes("gasto")) return "💰";
      if (key.toLowerCase().includes("ingreso")) return "📈";
      if (key.toLowerCase().includes("balance")) return "⚖️";
      if (key.toLowerCase().includes("total")) return "🧮";
      if (key.toLowerCase().includes("promedio")) return "📊";
      return "💡";
    };

    const formatValue = (key, value) => {
      // Primero limpiar el valor si viene con formato de moneda
      const cleanValue = parseValue(value);

      // Si no es un número después de limpiar, devolver como está
      if (typeof cleanValue !== "number" || isNaN(cleanValue)) return value;

      // Detectar si es un valor monetario basado en la clave
      const isMonetary =
        key.toLowerCase().includes("gasto") ||
        key.toLowerCase().includes("ingreso") ||
        key.toLowerCase().includes("balance") ||
        key.toLowerCase().includes("total") ||
        key.toLowerCase().includes("promedio") ||
        key.toLowerCase().includes("amount") ||
        key.toLowerCase().includes("monto");

      // Detectar si es un conteo/cantidad basado en la clave
      const isCount =
        key.toLowerCase().includes("numero") ||
        key.toLowerCase().includes("cantidad") ||
        key.toLowerCase().includes("count") ||
        key.toLowerCase().includes("proveedores") ||
        key.toLowerCase().includes("transacciones");

      if (isCount) {
        return cleanValue.toString(); // Solo el número, sin formato
      } else if (isMonetary) {
        return formatCurrency(cleanValue); // Con formato de moneda
      } else {
        // Para casos ambiguos, si es menor a 100 probablemente es un conteo
        return cleanValue < 100
          ? cleanValue.toString()
          : formatCurrency(cleanValue);
      }
    };

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Object.entries(metrics).map(([key, value]) => (
          <Card
            key={key}
            className="hover:shadow-lg transition-shadow duration-200 border-l-4 border-l-green-500"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-2xl">{getIcon(key)}</span>
                    <div className="text-sm font-medium text-gray-600">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatValue(key, value)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderTransactionsTable = (transactions) => {
    if (
      !transactions ||
      !Array.isArray(transactions) ||
      transactions.length === 0
    ) {
      return (
        <div className="text-center text-gray-500 py-8">
          No hay transacciones disponibles
        </div>
      );
    }

    const getStatusBadge = (status) => {
      const statusConfig = {
        pagado: { bg: "bg-green-100", text: "text-green-800", label: "Pagado" },
        pendiente: {
          bg: "bg-yellow-100",
          text: "text-yellow-800",
          label: "Pendiente",
        },
        parcial: { bg: "bg-blue-100", text: "text-blue-800", label: "Parcial" },
        cancelado: {
          bg: "bg-red-100",
          text: "text-red-800",
          label: "Cancelado",
        },
      };

      const config =
        statusConfig[status?.toLowerCase()] || statusConfig["pendiente"];

      return (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
        >
          {config.label}
        </span>
      );
    };

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Concepto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Proveedor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((transaction, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {transaction.dateString ||
                    new Date(transaction.date).toLocaleDateString("es-MX")}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {transaction.concepto || transaction.concept}
                  </div>
                  {transaction.description && (
                    <div className="text-sm text-gray-500">
                      {transaction.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {transaction.proveedor || transaction.provider}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatCurrency(parseValue(transaction.amount))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getStatusBadge(transaction.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderPercentageBreakdown = (percentages) => {
    return (
      <div className="space-y-3">
        {percentages.map((item, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-4 h-4 rounded-full`}
                  style={{
                    backgroundColor: getConceptColor(item.label, "hex"),
                  }}
                ></div>
                <span className="font-semibold text-gray-900">
                  {item.label}
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrency(parseValue(item.value))}
                </div>
                <div className="text-sm text-gray-600">
                  {parseValue(item.percentage)}% del total
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(parseValue(item.percentage), 100)}%`,
                  backgroundColor: getConceptColor(item.label, "hex"),
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVisualization = (data) => {
    if (!data) return null;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-6 w-6" />
            <div>
              <h2 className="text-xl font-bold">Análisis Generado</h2>
              <p className="text-purple-100">&ldquo;{lastQuery}&rdquo;</p>
            </div>
          </div>
        </div>

        {/* Respuesta en texto */}
        {responseText && (
          <ReusableTextSection
            title="Resumen del Análisis"
            content={responseText}
            type="info"
          />
        )}

        {/* Métricas principales */}
        {data.metrics && (
          <ReusableMetricsList
            title="Métricas Principales"
            metrics={
              Array.isArray(data.metrics)
                ? data.metrics
                : [
                    ...(data.metrics.totalIngresos !== undefined
                      ? [
                          {
                            label: "Total de Ingresos",
                            value: data.metrics.totalIngresos,
                            type: "income",
                          },
                        ]
                      : []),
                    ...(data.metrics.totalGastos !== undefined
                      ? [
                          {
                            label: "Total de Gastos",
                            value: data.metrics.totalGastos,
                            type: "expense",
                          },
                        ]
                      : []),
                    ...(data.metrics.balance !== undefined
                      ? [
                          {
                            label: "Balance",
                            value: data.metrics.balance,
                            type: "balance",
                          },
                        ]
                      : []),
                    ...(data.metrics.numeroTransacciones !== undefined
                      ? [
                          {
                            label: "Total de Transacciones",
                            value: data.metrics.numeroTransacciones,
                            type: "count",
                          },
                        ]
                      : []),
                    // Agregar otras métricas dinámicamente
                    ...Object.entries(data.metrics)
                      .filter(
                        ([key]) =>
                          ![
                            "totalIngresos",
                            "totalGastos",
                            "balance",
                            "numeroTransacciones",
                          ].includes(key)
                      )
                      .map(([key, value]) => ({
                        label: key.charAt(0).toUpperCase() + key.slice(1),
                        value: value,
                        type:
                          typeof value === "number" && value > 1000
                            ? "currency"
                            : "number",
                      })),
                  ]
            }
            layout="grid"
          />
        )}

        {/* Gráfico principal */}
        {data.chartData && (
          <ReusableChart
            type={data.chartData.type || "bar"}
            title="Distribución Visual"
            data={data.chartData.data.map((item) => ({
              name: item.label || item.name,
              value: item.value,
              percentage: item.percentage,
            }))}
            height={400}
          />
        )}

        {/* Distribución detallada en tabla */}
        {data.percentages && (
          <ReusableDataTable
            title="Distribución Detallada"
            data={data.percentages.map((item) => ({
              categoria: item.label,
              amount: item.value,
              percentage: item.percentage,
            }))}
            columns={[
              { key: "categoria", title: "Categoría" },
              {
                key: "amount",
                title: "Monto",
                type: "currency",
                align: "right",
              },
              {
                key: "percentage",
                title: "Porcentaje",
                type: "percentage",
                align: "right",
              },
            ]}
            showTotal={true}
            totalLabel="Total"
          />
        )}

        {/* Transacciones detalladas */}
        {data.transactions && (
          <ReusableDataTable
            title="Transacciones Detalladas"
            data={data.transactions.slice(0, 10)} // Limitar a 10 para mejor rendimiento
            columns={[
              { key: "dateString", title: "Fecha" },
              {
                key: "type",
                title: "Tipo",
                format: (value) => (value === "entrada" ? "Ingreso" : "Gasto"),
              },
              { key: "concept", title: "Concepto" },
              { key: "description", title: "Descripción" },
              {
                key: "amount",
                title: "Monto",
                type: "currency",
                align: "right",
              },
              { key: "status", title: "Estado", type: "status" },
            ]}
            maxHeight="400px"
          />
        )}

        {/* Información adicional */}
        {data.transactions && data.transactions.length > 10 && (
          <ReusableTextSection
            title=""
            content={`Se muestran las primeras 10 transacciones de un total de ${data.transactions.length}. Para ver todas las transacciones, utiliza la sección de historial completo.`}
            type="info"
            showIcon={true}
          />
        )}
      </div>
    );
  };

  return (
    <div className="relative">
      {showWelcome && !visualData && (
        <div className="text-center py-16">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Asistente Financiero IA
              </h2>
              <p className="text-gray-600 text-lg">
                Pregúntame cualquier cosa sobre tus finanzas y te mostraré
                análisis detallados con gráficas y datos visuales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(question)}
                  className="p-4 text-left bg-white rounded-lg border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all duration-200"
                  disabled={isLoading}
                >
                  <div className="text-sm font-medium text-gray-900">
                    {question}
                  </div>
                </button>
              ))}
            </div>

            {/* Información sobre tipos de análisis */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
                Tipos de Análisis Inteligente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="font-medium text-sm text-gray-900">
                      Análisis Rápido
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Balance actual, estado hoy (100 transacciones)
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                    <span className="font-medium text-sm text-gray-900">
                      Análisis Mensual
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Últimos 1-2 meses (500 transacciones)
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="font-medium text-sm text-gray-900">
                      Análisis Trimestral
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Últimos 3-6 meses (1,500 transacciones)
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                    <span className="font-medium text-sm text-gray-900">
                      Análisis Anual
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Último año (3,000 transacciones)
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                    <span className="font-medium text-sm text-gray-900">
                      Análisis Histórico
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Tendencias completas (5,000 transacciones)
                  </p>
                </div>
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                    <span className="font-medium text-sm text-gray-900">
                      Análisis Completo
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Todas las transacciones disponibles
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(visualData || responseText) && (
        <div className="mb-8">
          {responseText && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mb-6 border border-blue-200">
              <h3 className="text-xl font-semibold text-blue-900 mb-4 flex items-center">
                <Bot className="h-5 w-5 mr-2" />
                Respuesta del Asistente
              </h3>

              {/* Información del alcance del análisis */}
              {visualData?.data?.analysisScope && (
                <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
                  <div className="flex items-center text-sm text-blue-700">
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        visualData.data.analysisScope.coverage === "completo"
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                    ></div>
                    <span className="font-medium">
                      Transacciones analizadas para llegar a la respuesta:
                    </span>
                    <span className="ml-1 font-semibold">
                      {visualData.data.analysisScope.transactionsAnalyzed}
                    </span>
                    {visualData.data.analysisScope.isLimited && (
                      <span className="ml-1 text-yellow-600">
                        (vista parcial)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="text-gray-700">
                {formatResponseText(responseText)}
              </div>
            </div>
          )}
          {visualData &&
            visualData.data &&
            renderVisualization(visualData.data)}
        </div>
      )}

      {isLoading && (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Analizando tus datos...
            </h3>
            <p className="text-gray-600">
              Procesando &ldquo;{lastQuery}&rdquo;
            </p>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-50">
        {isExpanded && (
          <div className="mb-4 w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
            {error && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-600">{error}</div>
              </div>
            )}

            <div className="flex flex-col space-y-2">
              <textarea
                rows={4}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Pregúntame sobre tus finanzas..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                disabled={isLoading}
                autoFocus
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !inputMessage.trim()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
          disabled={isLoading}
        >
          {isExpanded ? (
            <X className="w-6 h-6 transition-transform group-hover:scale-110" />
          ) : (
            <MessageCircle className="w-6 h-6 transition-transform group-hover:scale-110" />
          )}
        </button>

        {isLoading && (
          <div className="absolute -top-2 -left-2 w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
        )}
      </div>
    </div>
  );
};

export default FinancialChatbot;
