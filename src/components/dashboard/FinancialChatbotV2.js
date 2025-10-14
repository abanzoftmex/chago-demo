import React, { useState, useRef, useEffect } from "react";
import {
  Loader2,
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  ChevronDown,
  RefreshCw,
  ChartCandlestick,
  ChartNoAxesCombined,
  CircleDollarSign,
  BanknoteArrowDown,
} from "lucide-react";
import ReusableDataTable from "../chatbot/ReusableDataTable";
import ReusableChart from "../chatbot/ReusableChart";
import ReusableMetricsList from "../chatbot/ReusableMetricsList";

const FinancialChatbotV2 = () => {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(null);
  const [loadingStage, setLoadingStage] = useState("");
  const [conversationHistory, setConversationHistory] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversationHistory, isLoading]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "inherit";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputMessage]);

  const suggestedQuestions = [
    "¿Cuál es mi balance actual?",
    "¿Cuánto gasté este mes?",
    "Muéstrame los gastos más altos",
    "¿Cuál es la tendencia de gastos en el último trimestre?",
    "¿Qué proveedor tiene el mayor gasto?",
    "Análisis de gastos por división",
  ];

  const quickActions = [
    { icon: <ChartCandlestick/>, label: "Balance actual", query: "¿Cuál es mi balance actual?" },
    { icon: <ChartNoAxesCombined/>, label: "Gastos del mes", query: "¿Cuánto gasté este mes?" },
    { icon: <CircleDollarSign/>, label: "Tendencia anual", query: "¿Cuál es la tendencia de gastos en el último año?" },
    { icon: <BanknoteArrowDown/>, label: "Top gastos", query: "¿Cuáles son mis mayores gastos?" },
  ];

  const handleSendMessage = async (message = null) => {
    const messageToSend = message || inputMessage.trim();
    if (!messageToSend || isLoading) return;

    setShowSuggestions(false);
    setInputMessage("");
    
    // Add user message to conversation
    const userMessage = {
      id: Date.now(),
      type: "user",
      content: messageToSend,
      timestamp: new Date(),
    };
    
    setConversationHistory((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Estimación de tiempo según el tipo de consulta
    const messageLower = messageToSend.toLowerCase();
    let estimatedSeconds = 15; // Por defecto

    if (messageLower.includes("año") || messageLower.includes("anual")) {
      estimatedSeconds = 60;
    } else if (messageLower.includes("histórico") || messageLower.includes("tendencia")) {
      estimatedSeconds = 45;
    } else if (messageLower.includes("trimestre") || messageLower.includes("últimos 3 meses")) {
      estimatedSeconds = 30;
    } else if (messageLower.includes("balance") || messageLower.includes("actual")) {
      estimatedSeconds = 5;
    }

    setEstimatedTime(estimatedSeconds);

    // Progress simulation
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + (100 - prev) * 0.1;
      });
    }, estimatedSeconds * 10);

    // Stage updates
    const stages = [
      { progress: 15, message: "Iniciando análisis..." },
      { progress: 30, message: "Procesando transacciones..." },
      { progress: 50, message: "Calculando totales..." },
      { progress: 70, message: "Analizando patrones..." },
      { progress: 85, message: "Generando respuesta..." },
      { progress: 95, message: "Finalizando..." },
    ];

    const stageInterval = setInterval(() => {
      setLoadingProgress((current) => {
        const currentStage = stages.find((s) => current < s.progress) || stages[stages.length - 1];
        setLoadingStage(currentStage.message);
        return current;
      });
    }, (estimatedSeconds * 1000) / stages.length);

    try {
      const response = await fetch("/api/ai/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: messageToSend }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      clearInterval(progressInterval);
      clearInterval(stageInterval);
      setLoadingProgress(100);
      setLoadingStage("¡Completado!");

      if (data.success) {
        const assistantMessage = {
          id: Date.now() + 1,
          type: "assistant",
          content: data.response,
          data: data.data,
          timestamp: new Date(),
        };
        setConversationHistory((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error(data.message || "Error al procesar la consulta");
      }
    } catch (err) {
      clearInterval(progressInterval);
      clearInterval(stageInterval);
      console.error("Error en chatbot:", err);
      
      const errorMessage = {
        id: Date.now() + 1,
        type: "error",
        content: "Lo siento, hubo un error al procesar tu pregunta. Por favor, intenta nuevamente.",
        timestamp: new Date(),
      };
      setConversationHistory((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
      setEstimatedTime(null);
      setLoadingStage("");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatResponseText = (text) => {
    if (!text) return null;

    const lines = text.split("\n");
    return (
      <div className="space-y-3">
        {lines.map((line, index) => {
          if (!line.trim()) return <div key={index} className="h-2" />;

          // Títulos con **texto:**
          if (line.includes(":**")) {
            const parts = line.split(":**");
            return (
              <div key={index} className="mt-4 first:mt-0">
                <h4 className="font-semibold text-gray-900 text-base mb-2">
                  {parts[0].replace(/\*\*/g, "")}:
                </h4>
                {parts[1] && <p className="text-gray-700 text-sm">{parts[1].trim()}</p>}
              </div>
            );
          }

          // Listas con viñetas
          if (line.trim().startsWith("*") || line.trim().startsWith("-")) {
            return (
              <div key={index} className="flex items-start pl-4">
                <span className="text-gray-400 mr-2 mt-1">•</span>
                <p className="text-gray-700 text-sm flex-1">{line.replace(/^[*-]\s*/, "")}</p>
              </div>
            );
          }

          // Texto normal con negritas
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <p key={index} className="text-gray-700 text-sm leading-relaxed">
              {parts.map((part, i) => {
                if (part.startsWith("**") && part.endsWith("**")) {
                  return (
                    <strong key={i} className="font-semibold text-gray-900">
                      {part.slice(2, -2)}
                    </strong>
                  );
                }
                return part;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  const renderVisualization = (data) => {
    if (!data) return null;

    return (
      <div className="space-y-4 mt-4">
        {/* Métricas */}
        {data.metrics && (
          <ReusableMetricsList
            title="Métricas Principales"
            metrics={
              Array.isArray(data.metrics)
                ? data.metrics
                : Object.entries(data.metrics)
                    .filter(([key]) => !["totalIngresos", "totalGastos", "balance", "numeroTransacciones"].includes(key))
                    .map(([key, value]) => ({
                      label: key.charAt(0).toUpperCase() + key.slice(1),
                      value: value,
                      type: typeof value === "number" && value > 1000 ? "currency" : "number",
                    }))
            }
            layout="grid"
          />
        )}

        {/* Gráfico */}
        {data.chartData && (
          <ReusableChart
            type={data.chartData.type || "bar"}
            title={data.chartData.title || "Distribución Visual"}
            data={data.chartData.data.map((item) => ({
              name: item.label || item.name,
              value: item.value,
              percentage: item.percentage,
            }))}
            height={300}
          />
        )}

        {/* Tabla de distribución */}
        {data.percentages && data.percentages.length > 0 && (
          <ReusableDataTable
            title="Distribución Detallada"
            data={data.percentages.map((item) => ({
              categoria: item.label,
              amount: item.value,
              percentage: item.percentage,
            }))}
            columns={[
              { key: "categoria", title: "Categoría" },
              { key: "amount", title: "Monto", type: "currency", align: "right" },
              { key: "percentage", title: "Porcentaje", type: "percentage", align: "right" },
            ]}
          />
        )}

        {/* Tabla de transacciones */}
        {data.transactions && data.transactions.length > 0 && (
          <ReusableDataTable
            title="Transacciones Detalladas"
            data={data.transactions.map((t) => ({
              fecha: t.dateString || new Date(t.date).toLocaleDateString("es-MX"),
              concepto: t.concept || t.concepto,
              monto: t.amount,
              tipo: t.type === "salida" ? "Gasto" : "Ingreso",
            }))}
            columns={[
              { key: "fecha", title: "Fecha" },
              { key: "concepto", title: "Concepto" },
              { key: "monto", title: "Monto", type: "currency", align: "right" },
              { key: "tipo", title: "Tipo" },
            ]}
          />
        )}

        {/* Análisis scope */}
        {data.analysisScope && (
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center text-xs text-gray-600">
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  data.analysisScope.coverage === "completo" ? "bg-green-500" : "bg-yellow-500"
                }`}
              />
              <span>
                {data.analysisScope.transactionsAnalyzed} transacciones analizadas
                {data.analysisScope.isLimited && " (vista parcial)"}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleNewConversation = () => {
    setConversationHistory([]);
    setShowSuggestions(true);
    setInputMessage("");
  };

  return (
    <div className="flex flex-col h-[90dvh] bg-white overflow-hidden rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="bg-purple-50 border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Asistente Financiero</h1>
              <p className="text-xs text-gray-500">Análisis inteligente de tus finanzas</p>
            </div>
          </div>
          <button
            onClick={handleNewConversation}
            cursor="pointer"
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-gradient-to-br from-purple-500 to-blue-600 text-white hover:text-white hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Nueva conversación</span>
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Welcome Screen */}
          {conversationHistory.length === 0 && showSuggestions && (
            <div className="space-y-8">
              {/* Hero Section */}
              <div className="text-center space-y-4 py-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                  ¿En qué puedo ayudarte hoy?
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Analiza tus finanzas, identifica patrones de gasto y obtén insights accionables
                  sobre tu situación financiera.
                </p>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Acciones rápidas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(action.query)}
                      className="bg-purple-50 flex items-center space-x-3 p-4 hover:bg-gray-100 rounded-xl border border-gray-200 hover:border-gray-300 transition-all text-left group"
                    >
                      <span className="text-2xl text-purple-600">{action.icon}</span>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Suggested Questions */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Preguntas sugeridas</h3>
                <div className="space-y-2">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(question)}
                      className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-all text-sm text-gray-700 hover:text-gray-900"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-emerald-600" />
                  Capacidades del asistente
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5" />
                    <div>
                      <p className="font-medium text-gray-900">Análisis Rápido</p>
                      <p className="text-gray-600">Balance, estado actual (100 transacciones)</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5" />
                    <div>
                      <p className="font-medium text-gray-900">Análisis Mensual</p>
                      <p className="text-gray-600">Últimos 1-2 meses (500 transacciones)</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5" />
                    <div>
                      <p className="font-medium text-gray-900">Análisis Completo</p>
                      <p className="text-gray-600">Histórico y tendencias (hasta 5000)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Conversation Messages */}
          {conversationHistory.map((message) => (
            <div
              key={message.id}
              className={`flex items-start space-x-3 mb-6 ${
                message.type === "user" ? "justify-end" : ""
              }`}
            >
              {message.type !== "user" && (
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              
              <div
                className={`flex-1 max-w-3xl ${
                  message.type === "user" ? "flex justify-end" : ""
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    message.type === "user"
                      ? "bg-gray-900 text-white ml-auto"
                      : message.type === "error"
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : "bg-white"
                  }`}
                  style={message.type === "user" ? { maxWidth: "80%" } : {}}
                >
                  {message.type === "user" ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <>
                      {formatResponseText(message.content)}
                      {message.data && renderVisualization(message.data)}
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1 px-2">
                  {message.timestamp.toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>

              {message.type === "user" && (
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-start space-x-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 max-w-3xl">
                <div className="bg-white rounded-2xl px-4 py-3 border border-gray-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    <span className="text-sm text-gray-600">{loadingStage || "Pensando..."}</span>
                  </div>
                  {estimatedTime && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-600 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${loadingProgress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{loadingProgress.toFixed(0)}%</span>
                        <span>~{estimatedTime}s</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-gradient-to-br from-purple-500 to-blue-600 border-gray-200 bg-white sticky bottom-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="text-2xl font-bold text-white mb-2">Haz una pregunta:</div>
          <div className="flex items-end space-x-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu pregunta aquí..."
                className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm text-gray-900 placeholder-gray-400"
                rows={1}
                style={{ maxHeight: "120px" }}
                disabled={isLoading}
              />
              {inputMessage && (
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputMessage.trim()}
                  className="absolute right-2 bottom-2 p-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-white mt-2 text-center">
            Presiona Enter para enviar • Shift + Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinancialChatbotV2;
