export const aiAnalysisService = {
  /**
   * Genera un análisis de IA para las transacciones
   * @param {string} timeframe - Período de análisis (week, month, quarter, year)
   * @returns {Promise} Análisis generado por IA
   */
  async generateAnalysis(timeframe = "month") {
    try {
      const response = await fetch("/api/ai/analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timeframe }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || "Error al generar análisis");
      }

      return data;
    } catch (error) {
      console.error("Error calling AI analysis API:", error);
      throw error;
    }
  },

  /**
   * Obtiene métricas rápidas sin análisis completo de IA
   * @param {string} timeframe - Período de análisis
   * @returns {Promise} Métricas básicas
   */
  async getQuickMetrics(timeframe = "month") {
    try {
      const response = await fetch("/api/ai/analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          timeframe,
          quickMetrics: true 
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.metrics || {};
    } catch (error) {
      console.error("Error getting quick metrics:", error);
      throw error;
    }
  },

  /**
   * Formatea el análisis para mostrar en la UI
   * @param {string} analysisText - Texto del análisis en markdown
   * @returns {string} HTML formateado
   */
  formatAnalysisForDisplay(analysisText) {
    // Convertir markdown básico a HTML
    return analysisText
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-4">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-3 mt-6">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-medium mb-2 mt-4">$1</h3>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4 mb-1">• $1</li>')
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/^(.+)$/gm, (match) => {
        if (match.startsWith('<h') || match.startsWith('<li') || match.trim() === '') {
          return match;
        }
        return `<p class="mb-3">${match}</p>`;
      });
  },

  /**
   * Obtiene insights rápidos sin generar análisis completo
   * @param {Array} transactions - Array de transacciones
   * @param {Array} concepts - Array de conceptos
   * @param {Array} providers - Array de proveedores
   * @returns {Object} Insights básicos
   */
  getQuickInsights(transactions, concepts, providers) {
    if (!transactions || transactions.length === 0) {
      return {
        hasData: false,
        message: "No hay suficientes datos para generar insights"
      };
    }

    const gastos = transactions.filter(t => t.type === "salida");
    const ingresos = transactions.filter(t => t.type === "entrada");
    
    const gastoMasAlto = gastos.reduce((max, t) => 
      t.amount > (max?.amount || 0) ? t : max, null);
    
    const conceptoMasFrecuente = concepts.find(c => {
      const count = transactions.filter(t => t.conceptId === c.id).length;
      return count > 0;
    });

    const proveedorMasFrecuente = providers.find(p => {
      const count = transactions.filter(t => t.providerId === p.id).length;
      return count > 0;
    });

    return {
      hasData: true,
      gastoMasAlto: {
        monto: gastoMasAlto?.amount || 0,
        concepto: concepts.find(c => c.id === gastoMasAlto?.conceptId)?.name || "N/A"
      },
      totalGastos: gastos.reduce((sum, t) => sum + t.amount, 0),
      totalIngresos: ingresos.reduce((sum, t) => sum + t.amount, 0),
      transaccionesPendientes: transactions.filter(t => t.status === "pendiente").length,
      conceptoMasFrecuente: conceptoMasFrecuente?.name || "N/A",
      proveedorMasFrecuente: proveedorMasFrecuente?.name || "N/A"
    };
  }
};
