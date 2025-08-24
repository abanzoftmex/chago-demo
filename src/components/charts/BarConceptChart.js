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

  // Generate alternating orange and gray colors for each bar
  const colors = CHART_COLORS.generateAlternating(filteredConcepts.length);

  const chartData = {
    labels: filteredConcepts,
    datasets: [
      {
        label: type === 'entradas' ? 'Ingresos' : type === 'salidas' ? 'Gastos' : 'Total',
        data: values,
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
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
        text: `${type === 'entradas' ? 'Ingresos' : type === 'salidas' ? 'Gastos' : 'Balance'} por ${chartType === 'general' ? 'General' : 'Concepto'}`,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: $${value.toLocaleString('es-MX')} (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
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
      <div style={{ height: '300px' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default BarConceptChart;