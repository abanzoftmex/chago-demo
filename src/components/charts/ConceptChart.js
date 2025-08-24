import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { CHART_COLORS } from '../../lib/constants';

ChartJS.register(ArcElement, Tooltip, Legend);

const ConceptChart = ({ data, type = 'total' }) => {
  const concepts = Object.keys(data);
  const values = concepts.map(concept => {
    if (type === 'entradas') return data[concept].entradas;
    if (type === 'salidas') return data[concept].salidas;
    return data[concept].total;
  });

  // Generate alternating orange and gray colors for each concept
  const colors = CHART_COLORS.generateAlternating(concepts.length);

  const chartData = {
    labels: concepts,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace('0.8', '1')),
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 20,
          usePointStyle: true,
        }
      },
      title: {
        display: true,
        text: `Transacciones por Concepto${type === 'entradas' ? ' - Entradas' : type === 'salidas' ? ' - Salidas' : ''}`,
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: $${value.toLocaleString('es-MX')} (${percentage}%)`;
          }
        }
      }
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="bg-background rounded-lg border border-border p-6">
      <div style={{ height: '300px' }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
};

export default ConceptChart;