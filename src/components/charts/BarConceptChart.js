import { Bar } from 'react-chartjs-2';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { CHART_COLORS } from '../../lib/constants';

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BarConceptChart = ({ data, type = 'total', chartType = 'concepto' }) => {
  // Filter concepts based on type
  const filteredConcepts = Object.keys(data).filter(concept => {
    if (type === 'entradas') return data[concept].entradas > 0;
    if (type === 'salidas') return data[concept].salidas > 0;
    return data[concept].total > 0;
  });
  
  const values = filteredConcepts.map(concept => {
    if (type === 'entradas') return data[concept].entradas;
    if (type === 'salidas') return data[concept].salidas;
    return data[concept].total;
  });

  // Función para calcular el rango truncado
  const calculateTruncatedRange = (values) => {
    if (!values || values.length === 0) return { max: 100000, isTruncated: false };
    
    const maxValue = Math.max(...values);
    const threshold = 100000; // Threshold para truncar (100K)
    
    // Si el valor máximo excede el threshold, truncar
    if (maxValue > threshold) {
      return {
        max: threshold,
        isTruncated: true,
        originalMax: maxValue
      };
    }
    
    return {
      max: maxValue * 1.1, // 10% margen
      isTruncated: false
    };
  };

  const range = calculateTruncatedRange(values);
  
  // Crear datos con valores truncados para el display visual
  const displayValues = values.map(value => Math.min(value, range.max));
  const originalValues = [...values]; // Guardar valores originales

  // Generate alternating orange and gray colors for each bar
  // Usar colores especiales para valores truncados
  const colors = CHART_COLORS.generateAlternating(filteredConcepts.length).map((color, index) => {
    const isTruncated = originalValues[index] > range.max;
    return isTruncated ? '#F59E0B' : color; // Color naranja para valores truncados
  });

  const chartData = {
    labels: filteredConcepts,
    datasets: [
      {
        label: type === 'entradas' ? 'Entradas' : type === 'salidas' ? 'Salidas' : 'Total',
        data: displayValues,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
        // Guardar valores originales para tooltips
        originalData: originalValues,
      },
    ],
  };

  const options = {
    responsive: true,
    // Using default indexAxis (x) for vertical bar chart
    plugins: {
      legend: {
        display: false,  // Hide the legend since each bar represents a concept
      },
      title: {
        display: true,
        text: `${type === 'entradas' ? 'Entradas' : type === 'salidas' ? 'Salidas' : 'Balance'} por ${chartType === 'general' ? 'General' : 'Concepto'}`,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const originalValue = context.dataset.originalData[context.dataIndex];
            const displayValue = context.parsed.y;
            const total = context.dataset.originalData.reduce((a, b) => a + b, 0);
            const percentage = ((originalValue / total) * 100).toFixed(1);
            const isTruncated = originalValue > displayValue;
            
            let tooltip = `${label}: $${originalValue.toLocaleString('es-MX')} (${percentage}%)`;
            if (isTruncated) {
              tooltip += '\n⚠️ Valor truncado en gráfico';
            }
            
            return tooltip;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: range.max,
        ticks: {
          callback: function(value) {
            return '$' + value.toLocaleString('es-MX');
          }
        }
      }
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="bg-background rounded-lg border border-border p-6">
      <div style={{ height: '400px' }}>
        <Bar data={chartData} options={options} />
      </div>
      {range.isTruncated && (
        <div className="mt-3 p-2 bg-orange-50 border-l-4 border-orange-400 rounded">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-sm text-orange-700">
                <strong>Escala truncada:</strong> Algunos valores superiores a ${range.max.toLocaleString('es-MX')} se muestran cortados para mejorar la visualización de valores menores.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarConceptChart;