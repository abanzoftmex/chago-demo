# 📊 Sistema de Límites Dinámicos por Tipo de Consulta

## 🎯 Objetivo
Optimizar el rendimiento del análisis de IA aplicando límites inteligentes según el tipo de consulta, mejorando la velocidad de respuesta sin comprometer la calidad del análisis.
s
## 🔧 Configuración de Límites
a
### Tipos de Análisis y Límites

| Tipo | Límite | Palabras Clave | Uso |
|------|--------|----------------|-----|
| **Rápido** | 100 | balance actual, estado actual, hoy, ahora | Consultas inmediatas |a
| **Mensual** | 500 | último mes, este mes, últimos 2 meses | Análisis mensuales (por defecto) |
| **Trimestral** | 1,500 | trimestre, últimos 3-6 meses | Análisis trimestrales |
| **Anual** | 3,000 | año, anual, últimos 12 meses | Análisis anuales |
| **Histórico** | 5,000 | tendencia, evolución, histórico, completo | Análisis completos |
| **Completo** | Sin límite | análisis completo específico | Casos especiales |

## 🔍 Detección Automática

### Algoritmo de Clasificación
```javascript
function determineQueryLimit(question) {
  const questionLower = question.toLowerCase();
  
  // Consultas rápidas - Límite bajo
  if (questionLower.includes('balance actual') || 
      questionLower.includes('estado actual') ||
      questionLower.includes('hoy') ||
      questionLower.includes('ahora')) {
    return QUERY_LIMITS.quick; // 100
  }
  
  // Consultas históricas/tendencias - Límite alto
  if (questionLower.includes('tendencia') || 
      questionLower.includes('evolución') ||
      questionLower.includes('histórico') ||
      questionLower.includes('comparación') ||
      questionLower.includes('análisis completo')) {
    return QUERY_LIMITS.historical; // 5000
  }
  
  // ... más condiciones
  
  // Por defecto: consulta mensual
  return QUERY_LIMITS.monthly; // 500
}
```

## 📈 Ejemplos de Clasificación

### Consultas Rápidas (100 transacciones)
- "¿Cómo está mi balance actual?"
- "¿Cuál es mi estado financiero hoy?"
- "Muéstrame mi situación ahora"

### Consultas Mensuales (500 transacciones)
- "¿Cuánto gasté este mes?"
- "¿Cuáles son mis gastos del último mes?"
- "¿Cómo van mis finanzas en los últimos 2 meses?"

### Consultas Trimestrales (1,500 transacciones)
- "¿Cuál es mi tendencia en los últimos 3 meses?"
- "Muéstrame el trimestre pasado"
- "¿Cómo han sido mis gastos en los últimos 6 meses?"

### Consultas Anuales (3,000 transacciones)
- "¿Cuáles fueron mis gastos del año?"
- "Análisis anual de mis finanzas"
- "¿Cómo fue mi rendimiento en los últimos 12 meses?"

### Consultas Históricas (5,000 transacciones)
- "¿Cuál es mi tendencia histórica de gastos?"
- "Muéstrame la evolución completa"
- "Análisis histórico completo"
- "¿Cómo han cambiado mis gastos a lo largo del tiempo?"

## 🛠️ Mejoras Implementadas

### 1. Consolidación de Datos Duplicados
```javascript
function cleanAndConsolidateData(filteredData) {
  // Elimina conceptos duplicados
  // Reagrupa por concepto real
  // Recalcula porcentajes correctos
}
```

### 2. Información de Alcance
- Muestra al usuario qué tipo de análisis se aplicó
- Indica si es una vista parcial o completa
- Informa la cantidad de transacciones analizadas

### 3. Indicadores Visuales
```javascript
// En la interfaz
{visualData?.data?.analysisScope && (
  <div className="mb-4 p-3 bg-white rounded-lg border border-blue-200">
    <div className="flex items-center text-sm text-blue-700">
      <div className={`w-2 h-2 rounded-full mr-2 ${
        coverage === 'completo' ? 'bg-green-500' : 'bg-yellow-500'
      }`}></div>
      <span>Transacciones analizadas para llegar a la respuesta: {transactionsAnalyzed}</span>
      {isLimited && <span>(vista parcial)</span>}
    </div>
  </div>
)}
```

## 📊 Preguntas Sugeridas Optimizadas

Las preguntas sugeridas ahora están diseñadas para aprovechar los diferentes límites:

1. **"¿Cómo está mi balance actual?"** → Rápido (100)
2. **"¿Cuánto gasté en los últimos 2 meses?"** → Mensual (500)
3. **"¿Cuál es mi tendencia de gastos histórica?"** → Histórico (5,000)
4. **"¿En qué concepto gasto más dinero este año?"** → Anual (3,000)
5. **"¿Qué proveedores son los más costosos en los últimos 6 meses?"** → Trimestral (1,500)

## 🔧 Configuración Avanzada

### Personalización de Límites
```javascript
const QUERY_LIMITS = {
  quick: 100,           // Ajustable según necesidades
  monthly: 500,         // Óptimo para análisis mensuales
  quarterly: 1500,      // Balance entre velocidad y completitud
  yearly: 3000,         // Suficiente para análisis anuales
  historical: 5000,     // Análisis profundos
  complete: null        // Sin límite para casos especiales
};
```

### Logging y Debugging
El sistema incluye logs detallados para monitorear el rendimiento:
```
Consulta: "¿Cuál es mi tendencia histórica..." - Límite aplicado: 5000
Datos antes de limpiar: { conceptos: [...] }
Consolidando concepto duplicado: Gastos Administrativos...
Datos después de limpiar: { conceptos: [...] }
```

## 🚀 Beneficios

1. **Rendimiento Optimizado**: Consultas más rápidas según el alcance
2. **Experiencia Mejorada**: Respuestas apropiadas al tipo de pregunta
3. **Transparencia**: El usuario sabe qué datos se analizaron
4. **Escalabilidad**: Se adapta al crecimiento de la base de datos
5. **Flexibilidad**: Fácil ajuste de límites según necesidades

## 📋 Próximas Mejoras

- [ ] Límites adaptativos basados en rendimiento
- [ ] Cache inteligente por tipo de consulta
- [ ] Métricas de uso para optimización
- [ ] Configuración de límites por usuario/rol
