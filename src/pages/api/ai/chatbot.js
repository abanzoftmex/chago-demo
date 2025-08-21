import { GoogleGenerativeAI } from "@google/generative-ai";
import { transactionService } from "../../../lib/services/transactionService";
import { conceptService } from "../../../lib/services/conceptService";
import { providerService } from "../../../lib/services/providerService";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Función helper para formatear monedas en texto
function formatCurrency(amount) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
}

// Configuración de límites por tipo de consulta
const QUERY_LIMITS = {
  quick: 100,           // Consultas rápidas (balance actual, este mes)
  monthly: 500,         // Consultas mensuales (último mes, últimos 2 meses)
  quarterly: 1500,      // Consultas trimestrales (últimos 3 meses)
  yearly: 3000,         // Consultas anuales (año actual, último año)
  historical: 5000,     // Consultas históricas (tendencias, comparaciones)
  complete: null        // Sin límite (análisis completos)
};

// Función para determinar el límite según el tipo de consulta
function determineQueryLimit(question) {
  const questionLower = question.toLowerCase();
  
  // Consultas rápidas - Límite bajo
  if (questionLower.includes('balance actual') || 
      questionLower.includes('estado actual') ||
      questionLower.includes('hoy') ||
      questionLower.includes('ahora')) {
    return QUERY_LIMITS.quick;
  }
  
  // Consultas históricas/tendencias - Límite alto
  if (questionLower.includes('tendencia') || 
      questionLower.includes('evolución') ||
      questionLower.includes('histórico') ||
      questionLower.includes('comparación') ||
      questionLower.includes('análisis completo') ||
      questionLower.includes('todo el año') ||
      questionLower.includes('todos los años')) {
    return QUERY_LIMITS.historical;
  }
  
  // Consultas anuales
  if (questionLower.includes('año') || 
      questionLower.includes('anual') ||
      questionLower.includes('últimos 12 meses') ||
      questionLower.includes('último año')) {
    return QUERY_LIMITS.yearly;
  }
  
  // Consultas trimestrales
  if (questionLower.includes('trimestre') ||
      questionLower.includes('últimos 3 meses') ||
      questionLower.includes('tres meses') ||
      questionLower.includes('últimos 4 meses') ||
      questionLower.includes('últimos 5 meses') ||
      questionLower.includes('últimos 6 meses')) {
    return QUERY_LIMITS.quarterly;
  }
  
  // Consultas mensuales (por defecto)
  return QUERY_LIMITS.monthly;
}

// Función para obtener información sobre el alcance del análisis
function getAnalysisScope(limit, actualTransactions) {
  const limitTypes = {
    [QUERY_LIMITS.quick]: 'rápido',
    [QUERY_LIMITS.monthly]: 'mensual',
    [QUERY_LIMITS.quarterly]: 'trimestral',
    [QUERY_LIMITS.yearly]: 'anual',
    [QUERY_LIMITS.historical]: 'histórico'
  };

  const limitType = limitTypes[limit] || 'personalizado';
  const isLimited = limit && actualTransactions >= limit;
  
  return {
    limitApplied: limit,
    limitType,
    transactionsAnalyzed: actualTransactions,
    isLimited,
    coverage: isLimited ? 'parcial' : 'completo',
    message: `Transacciones analizadas para llegar a la respuesta: ${actualTransactions}${isLimited ? ' (vista parcial)' : ''}`
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        message: "Pregunta requerida",
      });
    }

    // Determinar límite dinámico según el tipo de consulta
    const transactionLimit = determineQueryLimit(question);
    
    console.log(`Consulta: "${question.substring(0, 50)}..." - Límite aplicado: ${transactionLimit || 'Sin límite'}`);

    // Obtener datos financieros con límite dinámico
    const [transactions, concepts, providers] = await Promise.all([
      transactionService.getAll({ limit: transactionLimit }),
      conceptService.getAll(),
      providerService.getAll(),
    ]);

    // Preparar datos para el análisis
    const financialData = prepareFinancialData(transactions, concepts, providers);

    // Análisis inteligente de la pregunta para determinar filtros
    const questionAnalysis = analyzeQuestion(question);
    
    // Filtrar datos según el análisis de la pregunta
    const filteredData = filterDataByQuestion(financialData, questionAnalysis);

    // Generar respuesta con IA
    const response = await generateChatbotResponse(question, filteredData, questionAnalysis);

    // Añadir información sobre el alcance del análisis
    const analysisScope = getAnalysisScope(transactionLimit, transactions.length);

    console.log("Final response to send:", response);

    res.status(200).json({
      success: true,
      response: response.text,
      data: {
        ...response.data,
        analysisScope // Información sobre el alcance del análisis
      },
    });
  } catch (error) {
    console.error("Error in chatbot API:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
}

function prepareFinancialData(transactions, concepts, providers) {
  const now = new Date();
  
  // Funciones helper para filtrar por fecha
  const filterByDate = (days) => {
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return transactions.filter(t => {
      const transactionDate = t.date.toDate ? t.date.toDate() : new Date(t.date);
      return transactionDate >= cutoffDate;
    });
  };

  // Calcular métricas para un conjunto de transacciones
  const calculateMetrics = (transactionSet) => {
    const ingresos = transactionSet.filter(t => t.type === "entrada");
    const gastos = transactionSet.filter(t => t.type === "salida");
    
    const totalIngresos = ingresos.reduce((sum, t) => sum + t.amount, 0);
    const totalGastos = gastos.reduce((sum, t) => sum + t.amount, 0);
    
    return {
      totalIngresos,
      totalGastos,
      balance: totalIngresos - totalGastos,
      numeroTransacciones: transactionSet.length,
      numeroIngresos: ingresos.length,
      numeroGastos: gastos.length,
    };
  };

  // Datos por períodos
  const lastWeek = filterByDate(7);
  const lastMonth = filterByDate(30);
  const last2Months = filterByDate(60);
  const last3Months = filterByDate(90);
  const last6Months = filterByDate(180);
  const lastYear = filterByDate(365);

  // Análisis por conceptos
  const gastosPorConcepto = concepts.map(concept => {
    const transaccionesConcepto = transactions.filter(t => t.conceptId === concept.id && t.type === "salida");
    const total = transaccionesConcepto.reduce((sum, t) => sum + t.amount, 0);
    return {
      concepto: concept.name,
      conceptId: concept.id,
      total,
      numeroTransacciones: transaccionesConcepto.length,
      transacciones: transaccionesConcepto.map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date.toDate ? t.date.toDate() : new Date(t.date),
        providerId: t.providerId
      })),
      porcentaje: 0 // Se calculará después
    };
  }).filter(item => item.total > 0);

  const totalGastos = gastosPorConcepto.reduce((sum, item) => sum + item.total, 0);
  gastosPorConcepto.forEach(item => {
    item.porcentaje = totalGastos > 0 ? (item.total / totalGastos * 100) : 0;
  });
  gastosPorConcepto.sort((a, b) => b.total - a.total);

  // Análisis por proveedores
  const gastosPorProveedor = providers.map(provider => {
    const transaccionesProveedor = transactions.filter(t => t.providerId === provider.id && t.type === "salida");
    const total = transaccionesProveedor.reduce((sum, t) => sum + t.amount, 0);
    return {
      proveedor: provider.name,
      providerId: provider.id,
      total,
      numeroTransacciones: transaccionesProveedor.length,
      transacciones: transaccionesProveedor.map(t => ({
        id: t.id,
        amount: t.amount,
        description: t.description,
        date: t.date.toDate ? t.date.toDate() : new Date(t.date),
        conceptId: t.conceptId
      })),
      porcentaje: totalGastos > 0 ? (total / totalGastos * 100) : 0
    };
  }).filter(item => item.total > 0);
  gastosPorProveedor.sort((a, b) => b.total - a.total);

  // Transacciones detalladas para análisis específicos
  const transaccionesDetalladas = transactions.map(t => {
    const concept = concepts.find(c => c.id === t.conceptId);
    const provider = providers.find(p => p.id === t.providerId);
    const date = t.date.toDate ? t.date.toDate() : new Date(t.date);
    
    return {
      id: t.id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      date: date,
      dateString: date.toLocaleDateString('es-MX'),
      dayOfWeek: date.toLocaleDateString('es-MX', { weekday: 'long' }),
      month: date.toLocaleDateString('es-MX', { month: 'long' }),
      year: date.getFullYear(),
      week: getWeekNumber(date),
      concept: concept ? concept.name : 'Sin concepto',
      conceptId: t.conceptId,
      provider: provider ? provider.name : 'Sin proveedor',
      providerId: t.providerId,
      status: t.status
    };
  });

  return {
    // Métricas por períodos
    metricas: {
      ultimaSemana: calculateMetrics(lastWeek),
      ultimoMes: calculateMetrics(lastMonth),
      ultimos2Meses: calculateMetrics(last2Months),
      ultimos3Meses: calculateMetrics(last3Months),
      ultimos6Meses: calculateMetrics(last6Months),
      ultimoAno: calculateMetrics(lastYear),
      total: calculateMetrics(transactions),
    },
    
    // Análisis agrupados
    gastosPorConcepto,
    gastosPorProveedor,
    
    // Datos detallados para análisis específicos
    transaccionesDetalladas,
    
    // Estadísticas adicionales
    transaccionesPendientes: transactions.filter(t => t.status === "pendiente").length,
    numeroTotalTransacciones: transactions.length,
    fechaUltimaTransaccion: transactions.length > 0 ? 
      Math.max(...transactions.map(t => {
        const date = t.date.toDate ? t.date.toDate() : new Date(t.date);
        return date.getTime();
      })) : null,
      
    // Análisis de tendencias
    gastoPorDia: getGastoPorDia(transaccionesDetalladas),
    gastoPorSemana: getGastoPorSemana(transaccionesDetalladas),
    gastoPorMes: getGastoPorMes(transaccionesDetalladas),
  };
}

// Función helper para obtener el número de semana
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

// Función para análisis por día
function getGastoPorDia(transacciones) {
  const gastosPorDia = {};
  transacciones.filter(t => t.type === 'salida').forEach(t => {
    const fecha = t.dateString;
    if (!gastosPorDia[fecha]) {
      gastosPorDia[fecha] = {
        fecha,
        total: 0,
        transacciones: []
      };
    }
    gastosPorDia[fecha].total += t.amount;
    gastosPorDia[fecha].transacciones.push(t);
  });
  
  return Object.values(gastosPorDia).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

// Función para análisis por semana
function getGastoPorSemana(transacciones) {
  const gastosPorSemana = {};
  transacciones.filter(t => t.type === 'salida').forEach(t => {
    const semana = `${t.year}-W${t.week}`;
    if (!gastosPorSemana[semana]) {
      gastosPorSemana[semana] = {
        semana,
        year: t.year,
        weekNumber: t.week,
        total: 0,
        transacciones: []
      };
    }
    gastosPorSemana[semana].total += t.amount;
    gastosPorSemana[semana].transacciones.push(t);
  });
  
  return Object.values(gastosPorSemana).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.weekNumber - a.weekNumber;
  });
}

// Función para análisis por mes
function getGastoPorMes(transacciones) {
  const gastosPorMes = {};
  transacciones.filter(t => t.type === 'salida').forEach(t => {
    const mes = `${t.year}-${t.month}`;
    if (!gastosPorMes[mes]) {
      gastosPorMes[mes] = {
        mes: t.month,
        year: t.year,
        total: 0,
        transacciones: []
      };
    }
    gastosPorMes[mes].total += t.amount;
    gastosPorMes[mes].transacciones.push(t);
  });
  
  return Object.values(gastosPorMes).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return new Date(`${a.mes} 1, ${a.year}`) - new Date(`${b.mes} 1, ${b.year}`);
  });
}

// Función para analizar la pregunta y determinar filtros
function analyzeQuestion(question) {
  const questionLower = question.toLowerCase();
  const currentDate = new Date();
  
  const analysis = {
    timeframe: null,
    specificMonth: null,
    specificYear: null,
    concepts: [],
    providers: [],
    metrics: [],
    chartType: null,
    specific: false
  };

  // Meses en español para detectar consultas específicas
  const months = {
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
    'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
  };

  // Detectar meses específicos
  for (const [monthName, monthIndex] of Object.entries(months)) {
    if (questionLower.includes(monthName)) {
      analysis.specificMonth = monthIndex;
      analysis.timeframe = 'specific_month';
      analysis.specific = true;
      break;
    }
  }

  // Detectar años específicos (2024, 2025, etc.)
  const yearMatch = questionLower.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    analysis.specificYear = parseInt(yearMatch[1]);
  } else if (analysis.specificMonth !== null) {
    // Si se especifica un mes sin año, asumir el año actual
    analysis.specificYear = currentDate.getFullYear();
  }

  // Análisis de período de tiempo (mantener lógica existente)
  if (!analysis.timeframe) {
    if (questionLower.includes('último mes') || questionLower.includes('este mes') || questionLower.includes('mes actual')) {
      analysis.timeframe = 'current_month';
      analysis.specific = true;
    } else if (questionLower.includes('últimos 2 meses') || questionLower.includes('dos meses')) {
      analysis.timeframe = 'last_2_months';
    } else if (questionLower.includes('esta semana') || questionLower.includes('semana actual')) {
      analysis.timeframe = 'current_week';
      analysis.specific = true;
    } else if (questionLower.includes('año') || questionLower.includes('anual')) {
      analysis.timeframe = 'current_year';
    }
  }

  // Análisis de métricas solicitadas
  if (questionLower.includes('gasto') || questionLower.includes('gasté')) {
    analysis.metrics.push('gastos');
  }
  if (questionLower.includes('ingreso')) {
    analysis.metrics.push('ingresos');
  }
  if (questionLower.includes('balance')) {
    analysis.metrics.push('balance');
  }

  // Análisis de tipo de gráfica sugerida
  if (questionLower.includes('distribución') || questionLower.includes('porcentaje') || questionLower.includes('categoría')) {
    analysis.chartType = 'pie';
  } else if (questionLower.includes('comparar') || questionLower.includes('vs') || questionLower.includes('diferencia')) {
    analysis.chartType = 'bar';
  } else if (questionLower.includes('tendencia') || questionLower.includes('tiempo') || questionLower.includes('evolución')) {
    analysis.chartType = 'line';
  } else if (questionLower.includes('mayores gastos') || questionLower.includes('gastos más altos') || questionLower.includes('gastos del mes') || questionLower.includes('gastos este mes')) {
    analysis.chartType = 'bar';
    analysis.chartSubtype = 'gastos_por_dia';
  }

  return analysis;
}

// Función para generar datos de gráfico específicos según la pregunta
function generateChartData(filteredData, questionAnalysis) {
  console.log('generateChartData llamada con:', {
    questionAnalysis,
    transacciones: filteredData.transaccionesDetalladas?.length || 0
  });
  
  if (!questionAnalysis.chartType) {
    console.log('No chartType definido');
    return null;
  }

  if (questionAnalysis.chartType === 'bar' && questionAnalysis.chartSubtype === 'gastos_por_dia') {
    console.log('Generando gráfico de gastos individuales por día');
    
    // Generar gráfico de barras de gastos individuales por día
    const gastosIndividuales = [];
    
    filteredData.transaccionesDetalladas
      .filter(t => t.type === 'salida')
      .forEach(t => {
        const fecha = new Date(t.date);
        const dia = fecha.getDate();
        const mes = fecha.toLocaleString('es-MX', { month: 'short' });
        const fechaLabel = `${dia} ${mes}`;
        
        // Crear una entrada por cada transacción individual
        gastosIndividuales.push({
          label: `${fechaLabel} - ${t.concepto}`,
          value: t.amount,
          fecha: t.date,
          concepto: t.concepto,
          proveedor: t.proveedor,
          descripcion: t.description || 'Sin descripción',
          shortLabel: fechaLabel
        });
      });

    console.log('Gastos individuales generados:', gastosIndividuales);

    // Ordenar por fecha y tomar los datos para el gráfico
    const chartData = gastosIndividuales
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map((item, index) => ({
        label: item.label,
        value: item.value,
        shortLabel: item.shortLabel
      }));

    console.log('ChartData final:', chartData);

    return {
      type: 'bar',
      data: chartData,
      title: 'Gastos Individuales por Día'
    };
  }

  if (questionAnalysis.chartType === 'pie') {
    // Generar datos para gráfico de pastel por concepto
    const gastosPorConcepto = {};
    
    filteredData.transaccionesDetalladas
      .filter(t => t.type === 'salida')
      .forEach(t => {
        if (!gastosPorConcepto[t.concepto]) {
          gastosPorConcepto[t.concepto] = 0;
        }
        gastosPorConcepto[t.concepto] += t.amount;
      });

    const total = Object.values(gastosPorConcepto).reduce((a, b) => a + b, 0);
    
    return Object.entries(gastosPorConcepto)
      .map(([concepto, amount]) => ({
        label: concepto,
        value: amount,
        percentage: ((amount / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.value - a.value);
  }

  if (questionAnalysis.chartType === 'bar') {
    // Gráfico de barras genérico por concepto
    const gastosPorConcepto = {};
    
    filteredData.transaccionesDetalladas
      .filter(t => t.type === 'salida')
      .forEach(t => {
        if (!gastosPorConcepto[t.concepto]) {
          gastosPorConcepto[t.concepto] = 0;
        }
        gastosPorConcepto[t.concepto] += t.amount;
      });

    return {
      type: 'bar',
      data: Object.entries(gastosPorConcepto)
        .map(([concepto, amount]) => ({
          label: concepto,
          value: amount
        }))
        .sort((a, b) => b.value - a.value),
      title: 'Gastos por Concepto'
    };
  }

  return null;
}

// Función para filtrar datos según el análisis de la pregunta
function filterDataByQuestion(financialData, questionAnalysis) {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  let filteredTransactions = financialData.transaccionesDetalladas;

  // Filtrar por período de tiempo
  if (questionAnalysis.timeframe === 'specific_month' && questionAnalysis.specificMonth !== null) {
    // Filtrar por mes y año específicos
    const targetMonth = questionAnalysis.specificMonth;
    const targetYear = questionAnalysis.specificYear || currentYear;
    
    filteredTransactions = filteredTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === targetMonth && 
             transactionDate.getFullYear() === targetYear;
    });
  } else if (questionAnalysis.timeframe === 'current_month') {
    filteredTransactions = filteredTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate.getMonth() === currentMonth && 
             transactionDate.getFullYear() === currentYear;
    });
  } else if (questionAnalysis.timeframe === 'current_week') {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    filteredTransactions = filteredTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startOfWeek;
    });
  } else if (questionAnalysis.timeframe === 'last_2_months') {
    const twoMonthsAgo = new Date(currentDate);
    twoMonthsAgo.setMonth(currentDate.getMonth() - 2);
    filteredTransactions = filteredTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= twoMonthsAgo;
    });
  }

  // Recalcular métricas con transacciones filtradas
  const filteredGastos = filteredTransactions.filter(t => t.type === 'salida');
  const filteredIngresos = filteredTransactions.filter(t => t.type === 'entrada');

  const totalGastos = filteredGastos.reduce((sum, t) => sum + t.amount, 0);
  const totalIngresos = filteredIngresos.reduce((sum, t) => sum + t.amount, 0);

  // Recalcular gastos por concepto con datos filtrados
  const gastosPorConcepto = {};
  filteredGastos.forEach(t => {
    if (!gastosPorConcepto[t.concept]) {
      gastosPorConcepto[t.concept] = 0;
    }
    gastosPorConcepto[t.concept] += t.amount;
  });

  // Recalcular gastos por proveedor con datos filtrados
  const gastosPorProveedor = {};
  filteredGastos.forEach(t => {
    if (!gastosPorProveedor[t.provider]) {
      gastosPorProveedor[t.provider] = 0;
    }
    gastosPorProveedor[t.provider] += t.amount;
  });

  return {
    metricas: {
      totalGastos,
      totalIngresos,
      balance: totalIngresos - totalGastos,
      numeroTransacciones: filteredTransactions.length,
      numeroGastos: filteredGastos.length,
      numeroIngresos: filteredIngresos.length,
      promedioGasto: filteredGastos.length > 0 ? totalGastos / filteredGastos.length : 0
    },
    gastosPorConcepto: Object.entries(gastosPorConcepto).map(([concepto, total]) => ({
      concepto,
      total,
      porcentaje: totalGastos > 0 ? (total / totalGastos * 100) : 0
    })).sort((a, b) => b.total - a.total),
    gastosPorProveedor: Object.entries(gastosPorProveedor).map(([proveedor, total]) => ({
      proveedor,
      total,
      porcentaje: totalGastos > 0 ? (total / totalGastos * 100) : 0
    })).sort((a, b) => b.total - a.total),
    transaccionesDetalladas: filteredTransactions,
    periodo: questionAnalysis.timeframe || 'all',
    sugerenciaTipoGrafica: questionAnalysis.chartType
  };
}

// Función para limpiar y consolidar datos duplicados
function cleanAndConsolidateData(filteredData) {
  console.log('Datos antes de limpiar:', {
    conceptos: filteredData.gastosPorConcepto.map(c => ({ concepto: c.concepto, total: c.total }))
  });

  // Limpiar y consolidar gastos por concepto
  const conceptMap = {};
  filteredData.gastosPorConcepto.forEach(item => {
    const conceptName = item.concepto.trim();
    if (conceptMap[conceptName]) {
      console.log(`Consolidando concepto duplicado: ${conceptName} - Total anterior: ${conceptMap[conceptName].total}, Sumando: ${item.total}`);
      conceptMap[conceptName].total += item.total;
    } else {
      conceptMap[conceptName] = {
        concepto: conceptName,
        total: item.total
      };
    }
  });

  // Recalcular porcentajes
  const totalGastos = Object.values(conceptMap).reduce((sum, item) => sum + item.total, 0);
  const cleanedGastosPorConcepto = Object.values(conceptMap).map(item => ({
    ...item,
    porcentaje: totalGastos > 0 ? (item.total / totalGastos * 100) : 0
  })).sort((a, b) => b.total - a.total);

  console.log('Datos después de limpiar:', {
    conceptos: cleanedGastosPorConcepto.map(c => ({ concepto: c.concepto, total: c.total, porcentaje: c.porcentaje }))
  });

  // Limpiar y consolidar gastos por proveedor
  const providerMap = {};
  filteredData.gastosPorProveedor.forEach(item => {
    const providerName = item.proveedor.trim();
    if (providerMap[providerName]) {
      providerMap[providerName].total += item.total;
    } else {
      providerMap[providerName] = {
        proveedor: providerName,
        total: item.total
      };
    }
  });

  const cleanedGastosPorProveedor = Object.values(providerMap).map(item => ({
    ...item,
    porcentaje: totalGastos > 0 ? (item.total / totalGastos * 100) : 0
  })).sort((a, b) => b.total - a.total);

  return {
    ...filteredData,
    gastosPorConcepto: cleanedGastosPorConcepto,
    gastosPorProveedor: cleanedGastosPorProveedor
  };
}

async function generateChatbotResponse(question, filteredData, questionAnalysis) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // Limpiar datos antes de enviar a la IA
  const cleanedData = cleanAndConsolidateData(filteredData);

  const monthNames = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  const timeFrameText = {
    'current_month': 'del mes actual',
    'current_week': 'de esta semana',
    'last_2_months': 'de los últimos 2 meses',
    'current_year': 'de este año',
    'specific_month': questionAnalysis.specificMonth !== null 
      ? `de ${monthNames[questionAnalysis.specificMonth]} ${questionAnalysis.specificYear || new Date().getFullYear()}`
      : 'del mes especificado',
    'all': 'total'
  };

  const prompt = `
Eres un asistente financiero experto. Analiza esta pregunta específica: "${question}"

DATOS FINANCIEROS FILTRADOS PARA ESTA CONSULTA (${timeFrameText[cleanedData.periodo] || 'período solicitado'}):
${JSON.stringify(cleanedData, null, 2)}

IMPORTANTE: 
- Solo analiza y responde sobre los datos filtrados que corresponden EXACTAMENTE a la pregunta
- Los datos ya están filtrados para el período correcto solicitado
- NO agregues datos de otros períodos no solicitados
- Sé específico sobre el período analizado
- SIEMPRE usa formato de moneda mexicana (ej: $28,450 MXN) para cantidades monetarias en el texto
- Para números que NO son dinero (como cantidad de proveedores), NO uses formato de moneda
- IMPORTANTE: Agrupa correctamente por concepto - si hay múltiples transacciones del mismo concepto, súmalas en UNA SOLA categoría
- NO duplicar conceptos en la respuesta ni en los datos de gráficas
- Usa EXACTAMENTE los nombres de conceptos que aparecen en gastosPorConcepto para evitar duplicados

INSTRUCCIONES PARA GRÁFICAS:
${questionAnalysis.chartType ? `- Tipo de gráfica sugerida: ${questionAnalysis.chartType}` : '- Propón el tipo de gráfica más relevante'}
- Para distribución por categorías: usa "pie" 
- Para comparaciones de montos: usa "bar"
- Para tendencias temporales: usa "line"
- Para gráficas de distribución por conceptos, usa EXACTAMENTE los datos de gastosPorConcepto (ya están agrupados correctamente)

Responde en formato JSON con esta estructura exacta:
{
  "text": "respuesta narrativa clara y específica sobre el período solicitado",
  "data": {
    "metrics": {
      "metrica1": valor,
      "metrica2": valor
    },
    "percentages": [
      {
        "label": "categoria",
        "value": monto,
        "percentage": porcentaje
      }
    ],
    "chartData": {
      "type": "pie|bar|line",
      "data": [
        {
          "label": "etiqueta",
          "value": valor
        }
      ]
    }
  }
}

Mantén los montos en pesos mexicanos con formato de moneda (ej: $28,450 MXN). 
EJEMPLOS DE FORMATO CORRECTO:
- "el proveedor más costoso es Arcos de Oriente SA de CV con $28,045 MXN"
- "registró gastos por $2,000 MXN"
- "con un total de $141,950 MXN"
- "4 proveedores diferentes" (SIN signo de peso para conteos)

Enfócate solo en lo que se preguntó.
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Limpiar el texto si viene con markdown
    if (text.includes('```json')) {
      text = text.replace(/```json\n?/g, '').replace(/\n?```/g, '');
    }
    
    // Intentar parsear como JSON
    try {
      const parsedResponse = JSON.parse(text);
      console.log("Parsed AI response:", parsedResponse);
      
      // Si no se generó chartData automáticamente, intentar generarlo basado en la pregunta
      if (!parsedResponse.data.chartData && questionAnalysis.chartType) {
        const autoChartData = generateChartData(filteredData, questionAnalysis);
        if (autoChartData) {
          parsedResponse.data.chartData = autoChartData;
        }
      }

      // Agregar transacciones detalladas si no están presentes
      if (!parsedResponse.data.transactions && filteredData.transaccionesDetalladas) {
        // Para consultas de gastos, incluir solo salidas; para general, incluir todas
        let transactionsToInclude = filteredData.transaccionesDetalladas;
        
        if (questionAnalysis.metrics.includes('gastos') && !questionAnalysis.metrics.includes('ingresos')) {
          // Solo gastos
          transactionsToInclude = filteredData.transaccionesDetalladas.filter(t => t.type === 'salida');
        } else if (questionAnalysis.metrics.includes('ingresos') && !questionAnalysis.metrics.includes('gastos')) {
          // Solo ingresos
          transactionsToInclude = filteredData.transaccionesDetalladas.filter(t => t.type === 'entrada');
        }
        
        // Ordenar por fecha descendente y limitar para no sobrecargar la UI
        parsedResponse.data.transactions = transactionsToInclude
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 20); // Aumentar límite a 20 transacciones
      }
      
      return parsedResponse;
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", text);
      // Si no es JSON válido, generar respuesta de fallback
      return generateFallbackResponse(question, filteredData, questionAnalysis);
    }
  } catch (error) {
    console.error("Error generating AI response:", error);
    return generateFallbackResponse(question, filteredData, questionAnalysis);
  }
}

function generateFallbackResponse(question, filteredData, questionAnalysis) {
  const { metricas, gastosPorConcepto, gastosPorProveedor, transaccionesDetalladas } = filteredData;
  
  // Análisis simple basado en palabras clave
  const questionLower = question.toLowerCase();
  
  // Preguntas sobre gastos más altos
  if ((questionLower.includes("mayor") || questionLower.includes("más") || questionLower.includes("alto")) && 
      questionLower.includes("gasto")) {
    
    // Determinar el período
    let transaccionesRelevantes = transaccionesDetalladas.filter(t => t.type === 'salida');
    let periodo = "total";
    
    if (questionLower.includes("semana")) {
      const ahora = new Date();
      const inicioSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      transaccionesRelevantes = transaccionesRelevantes.filter(t => new Date(t.date) >= inicioSemana);
      periodo = "de la semana";
    } else if (questionLower.includes("día") || questionLower.includes("hoy")) {
      const hoy = new Date().toLocaleDateString('es-MX');
      transaccionesRelevantes = transaccionesRelevantes.filter(t => t.dateString === hoy);
      periodo = "de hoy";
    } else if (questionLower.includes("mes")) {
      const ahora = new Date();
      const inicioMes = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
      transaccionesRelevantes = transaccionesRelevantes.filter(t => new Date(t.date) >= inicioMes);
      periodo = "del mes";
    }
    
    if (transaccionesRelevantes.length === 0) {
      return {
        text: `No se encontraron gastos ${periodo}.`,
        data: null
      };
    }
    
    // Encontrar el gasto más alto
    const gastoMasAlto = transaccionesRelevantes.reduce((max, t) => t.amount > max.amount ? t : max);
    const top5Gastos = transaccionesRelevantes.sort((a, b) => b.amount - a.amount).slice(0, 5);
    
    const totalPeriodo = transaccionesRelevantes.reduce((sum, t) => sum + t.amount, 0);
    const porcentajeDelTotal = totalPeriodo > 0 ? (gastoMasAlto.amount / totalPeriodo * 100) : 0;
    
    let respuesta = `El gasto más alto ${periodo} fue de **${formatCurrency(gastoMasAlto.amount)}** el día **${gastoMasAlto.dateString}**.\n\n`;
    respuesta += `**Detalles:**\n`;
    respuesta += `* **Concepto:** ${gastoMasAlto.concept}\n`;
    respuesta += `* **Proveedor:** ${gastoMasAlto.provider}\n`;
    respuesta += `* **Descripción:** ${gastoMasAlto.description}\n`;
    respuesta += `* **Porcentaje del total ${periodo}:** ${porcentajeDelTotal.toFixed(1)}%\n\n`;
    
    if (top5Gastos.length > 1) {
      respuesta += `**Top 5 gastos ${periodo}:**\n`;
      top5Gastos.forEach((gasto, index) => {
        respuesta += `${index + 1}. **${formatCurrency(gasto.amount)}** - ${gasto.concept} (${gasto.dateString})\n`;
      });
    }
    
    // Generar datos de gráfico automáticamente
    const dataForChart = {
      ...filteredData,
      transaccionesDetalladas: transaccionesRelevantes
    };
    const chartData = generateChartData(dataForChart, questionAnalysis);
    
    return {
      text: respuesta,
      data: {
        metrics: {
          "Gasto Más Alto": gastoMasAlto.amount,
          "Total Período": totalPeriodo,
          "Porcentaje del Total": porcentajeDelTotal,
          "Número de Gastos": transaccionesRelevantes.length,
        },
        percentages: top5Gastos.slice(0, 3).map(gasto => ({
          label: `${gasto.concept} (${gasto.dateString})`,
          percentage: totalPeriodo > 0 ? (gasto.amount / totalPeriodo * 100) : 0,
          value: gasto.amount
        })),
        transactions: transaccionesRelevantes.slice(0, 10), // Limitar a 10 transacciones para la tabla
        chartData: chartData
      }
    };
  }
  
  // Preguntas sobre períodos específicos
  if (questionLower.includes("semana")) {
    const data = metricas.ultimaSemana;
    const gastosSemana = gastoPorSemana.length > 0 ? gastoPorSemana[0] : null;
    
    let respuesta = `En la última semana has gastado **${formatCurrency(data.totalGastos)}** y recibido **${formatCurrency(data.totalIngresos)}**.\n\n`;
    respuesta += `**Tu balance semanal es de ${formatCurrency(data.balance)}.**\n\n`;
    
    if (gastosSemana && gastosSemana.transacciones.length > 0) {
      const top3Gastos = gastosSemana.transacciones.sort((a, b) => b.amount - a.amount).slice(0, 3);
      respuesta += `**Principales gastos de la semana:**\n`;
      top3Gastos.forEach((gasto, index) => {
        respuesta += `${index + 1}. **${formatCurrency(gasto.amount)}** - ${gasto.concept} (${gasto.dateString})\n`;
      });
    }
    
    return {
      text: respuesta,
      data: {
        metrics: {
          "Gastos Semana": data.totalGastos,
          "Ingresos Semana": data.totalIngresos,
          "Balance Semana": data.balance,
          "Número de Transacciones": data.numeroTransacciones,
        },
        percentages: gastosSemana ? gastosSemana.transacciones.slice(0, 5).map(gasto => {
          const porcentaje = data.totalGastos > 0 ? (gasto.amount / data.totalGastos * 100) : 0;
          return {
            label: gasto.concept,
            percentage: porcentaje,
            value: gasto.amount
          };
        }) : null,
        chartData: null
      }
    };
  }

  // Preguntas sobre 2 meses
  if (questionLower.includes("2 meses") || questionLower.includes("dos meses")) {
    const data = metricas.ultimos2Meses;
    const topConceptos = gastosPorConcepto.slice(0, 5);
    
    let desglose = "";
    if (topConceptos.length > 0) {
      desglose = ` Tu gasto se dividió en: ${topConceptos.map(c => 
        `**${Math.round(c.porcentaje)}%** en ${c.concepto}`
      ).join(", ")}.`;
    }
    
    return {
      text: `En los últimos 2 meses has gastado **${formatCurrency(data.totalGastos)}** y recibido **${formatCurrency(data.totalIngresos)}**. Tu balance es de **${formatCurrency(data.balance)}**.${desglose} ${data.balance >= 0 ? "¡Vas bien financieramente!" : "Considera revisar tus gastos más altos."}`,
      data: {
        metrics: {
          "Total Gastos": data.totalGastos,
          "Total Ingresos": data.totalIngresos,
          "Balance": data.balance,
          "Número de Transacciones": data.numeroTransacciones,
        },
        percentages: topConceptos.map(item => ({
          label: item.concepto,
          percentage: Math.round(item.porcentaje * 10) / 10,
          value: item.total
        })),
        chartData: null
      }
    };
  }

  // Respuesta genérica final
  const dataTotal = metricas.total;
  const topConcepto = gastosPorConcepto[0];
  
  return {
    text: `Aquí tienes un resumen general: Gastos totales: **${formatCurrency(dataTotal.totalGastos)}**, Ingresos totales: **${formatCurrency(dataTotal.totalIngresos)}**, Balance: **${formatCurrency(dataTotal.balance)}**. ${topConcepto ? `Tu mayor gasto es en **${topConcepto.concepto}** (${Math.round(topConcepto.porcentaje)}%).` : ""} ¿Te gustaría saber algo más específico?`,
    data: {
      metrics: {
        "Gastos Totales": dataTotal.totalGastos,
        "Ingresos Totales": dataTotal.totalIngresos,
        "Balance Total": dataTotal.balance,
      },
      percentages: gastosPorConcepto.slice(0, 3).map(item => ({
        label: item.concepto,
        percentage: Math.round(item.porcentaje * 10) / 10,
        value: item.total
      })),
      chartData: null
    }
  };
}
