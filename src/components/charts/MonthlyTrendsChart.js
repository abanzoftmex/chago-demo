import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const MonthlyTrendsChart = ({ data }) => {
  const chartData = {
    labels: data.map(item => item.month),
    datasets: [
      {
        label: 'Entradas',
        data: data.map(item => item.entradas),
        borderColor: '#10B981', // Verde
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.1,
      },
      {
        label: 'Salidas',
        data: data.map(item => item.salidas),
        borderColor: '#EF4444', // Rojo
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.1,
      },
      {
        label: 'Balance',
        data: data.map(item => item.balance),
        borderColor: '#6B7280', // Gris
        backgroundColor: 'rgba(107, 114, 128, 0.1)',
        tension: 0.1,
      }
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Tendencias Mensuales',
      },
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
    interaction: {
      intersect: false,
    },
  };

  return (
    <div className="bg-background rounded-lg border border-border p-6">
      <Line data={chartData} options={options} />
    </div>
  );
};

export default MonthlyTrendsChart;