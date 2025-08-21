import { GoogleGenerativeAI } from "@google/generative-ai";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { providerService } from "../../../lib/services/providerService";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { timeframe = "month" } = req.body;

    // Obtener datos de transacciones
    const [transactions, concepts, providers] = await Promise.all([
      transactionService.getAll({ limit: 100 }),
      conceptService.getAll(),
      providerService.getAll(),
    ]);

    // Filtrar transacciones por timeframe
    const now = new Date();
    let startDate;
    
    switch (timeframe) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const filteredTransactions = transactions.filter((transaction) => {
      const transactionDate = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
      return transactionDate >= startDate;
    });

    // Preparar datos para el análisis
    const analysisData = prepareAnalysisData(filteredTransactions, concepts, providers);

    // Generar análisis con Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
Eres un analista financiero experto. Analiza los siguientes datos financieros y proporciona insights clave en formato JSON estructurado:

DATOS FINANCIEROS (Período: ${timeframe}):
${JSON.stringify(analysisData, null, 2)}

Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura:

{
  "resumenEjecutivo": {
    "totalTransacciones": number,
    "balanceNeto": number,
    "tendenciaGeneral": "positive|negative|stable",
    "insight": "Descripción breve de la situación financiera actual"
  },
  "gastosDestacados": {
    "transaccionMasAlta": {
      "monto": number,
      "concepto": "string",
      "proveedor": "string",
      "porcentajeDelTotal": number
    },
    "categoriaConMayorGasto": {
      "concepto": "string",
      "monto": number,
      "porcentajeDelTotal": number
    }
  },
  "proveedores": {
    "principal": {
      "nombre": "string",
      "monto": number,
      "numeroTransacciones": number,
      "porcentajeDelTotal": number
    },
    "concentracionRiesgo": "alto|medio|bajo"
  },
  "analisisTendencias": {
    "estadoPagos": {
      "pagadas": number,
      "pendientes": number,
      "parciales": number
    },
    "patrones": "Descripción breve de patrones identificados"
  },
  "alertas": [
    {
      "tipo": "warning|info|danger",
      "titulo": "string",
      "descripcion": "string"
    }
  ],
  "metricas": {
    "gastoPromedioPorTransaccion": number,
    "variabilidadGastos": "alta|media|baja",
    "eficienciaPagos": number
  }
}

IMPORTANTE: Responde SOLO con el JSON válido, sin texto adicional.`;

    const result = await model.generateContent(prompt);
    const analysisText = result.response.text();
    
    // Parsear el JSON de la respuesta de IA
    let parsedAnalysis;
    try {
      // Limpiar la respuesta por si tiene markdown o texto extra
      const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedAnalysis = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      // Fallback en caso de error de parsing
      parsedAnalysis = {
        resumenEjecutivo: {
          totalTransacciones: filteredTransactions.length,
          balanceNeto: 0,
          tendenciaGeneral: "stable",
          insight: "No se pudo procesar el análisis automático"
        },
        error: "Error procesando respuesta de IA"
      };
    }

    // Calcular métricas adicionales
    const metrics = calculateMetrics(filteredTransactions);

    res.status(200).json({
      success: true,
      analysis: parsedAnalysis,
      rawAnalysis: analysisText,
      metrics,
      dataPoints: {
        totalTransactions: filteredTransactions.length,
        timeframe,
        periodStart: startDate.toISOString(),
        periodEnd: now.toISOString(),
      },
    });

  } catch (error) {
    console.error("Error generating AI analysis:", error);
    res.status(500).json({
      success: false,
      message: "Error al generar el análisis de IA",
      error: error.message,
    });
  }
}

function prepareAnalysisData(transactions, concepts, providers) {
  return {
    resumen: {
      totalTransacciones: transactions.length,
      totalIngresos: transactions
        .filter((t) => t.type === "entrada")
        .reduce((sum, t) => sum + t.amount, 0),
      totalGastos: transactions
        .filter((t) => t.type === "salida")
        .reduce((sum, t) => sum + t.amount, 0),
      balanceNeto: transactions.reduce((sum, t) => {
        return sum + (t.type === "entrada" ? t.amount : -t.amount);
      }, 0),
    },
    transaccionesPorTipo: {
      ingresos: transactions.filter((t) => t.type === "entrada").length,
      gastos: transactions.filter((t) => t.type === "salida").length,
    },
    estadosPago: {
      pendientes: transactions.filter((t) => t.status === "pendiente").length,
      parciales: transactions.filter((t) => t.status === "parcial").length,
      pagados: transactions.filter((t) => t.status === "pagado").length,
    },
    transaccionesPorConcepto: concepts.map((concept) => {
      const conceptTransactions = transactions.filter((t) => t.conceptId === concept.id);
      return {
        concepto: concept.name,
        tipo: concept.type,
        cantidad: conceptTransactions.length,
        montoTotal: conceptTransactions.reduce((sum, t) => sum + t.amount, 0),
        promedioMonto: conceptTransactions.length > 0 
          ? conceptTransactions.reduce((sum, t) => sum + t.amount, 0) / conceptTransactions.length 
          : 0,
      };
    }).filter((item) => item.cantidad > 0),
    transaccionesPorProveedor: providers.map((provider) => {
      const providerTransactions = transactions.filter((t) => t.providerId === provider.id);
      return {
        proveedor: provider.name,
        cantidad: providerTransactions.length,
        montoTotal: providerTransactions.reduce((sum, t) => sum + t.amount, 0),
        promedioMonto: providerTransactions.length > 0 
          ? providerTransactions.reduce((sum, t) => sum + t.amount, 0) / providerTransactions.length 
          : 0,
      };
    }).filter((item) => item.cantidad > 0),
    transaccionMasAlta: transactions.reduce((max, transaction) => {
      if (transaction.amount > (max?.amount || 0)) {
        const concept = concepts.find((c) => c.id === transaction.conceptId);
        const provider = providers.find((p) => p.id === transaction.providerId);
        return {
          ...transaction,
          conceptoNombre: concept?.name || "N/A",
          proveedorNombre: provider?.name || "N/A",
        };
      }
      return max;
    }, null),
    tendenciasRecientes: {
      ultimasSemanas: getWeeklyTrends(transactions),
      patronesPago: getPaymentPatterns(transactions),
    },
  };
}

function calculateMetrics(transactions) {
  const ingresos = transactions.filter((t) => t.type === "entrada");
  const gastos = transactions.filter((t) => t.type === "salida");

  const totalIngresos = ingresos.reduce((sum, t) => sum + t.amount, 0);
  const totalGastos = gastos.reduce((sum, t) => sum + t.amount, 0);

  return {
    totalIngresos,
    totalGastos,
    balanceNeto: totalIngresos - totalGastos,
    promedioTransaccion: transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length 
      : 0,
    transaccionMasAlta: Math.max(...transactions.map((t) => t.amount), 0),
    transaccionMasBaja: Math.min(...transactions.map((t) => t.amount), 0),
    pendientesPorcentaje: (transactions.filter((t) => t.status === "pendiente").length / transactions.length) * 100,
    gastosPorcentaje: totalIngresos > 0 ? (totalGastos / totalIngresos) * 100 : 0,
  };
}

function getWeeklyTrends(transactions) {
  const weeks = {};
  const now = new Date();

  transactions.forEach((transaction) => {
    const date = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeks[weekKey]) {
      weeks[weekKey] = { ingresos: 0, gastos: 0, cantidad: 0 };
    }

    weeks[weekKey].cantidad++;
    if (transaction.type === "entrada") {
      weeks[weekKey].ingresos += transaction.amount;
    } else {
      weeks[weekKey].gastos += transaction.amount;
    }
  });

  return Object.entries(weeks)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .slice(-4); // Últimas 4 semanas
}

function getPaymentPatterns(transactions) {
  const patterns = {
    porDiaSemana: {},
    porHoraPago: {},
    tiempoPromedioPago: 0,
  };

  transactions.forEach((transaction) => {
    const date = transaction.date.toDate ? transaction.date.toDate() : new Date(transaction.date);
    const dayOfWeek = date.getDay();
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayName = dayNames[dayOfWeek];

    patterns.porDiaSemana[dayName] = (patterns.porDiaSemana[dayName] || 0) + 1;
  });

  return patterns;
}
