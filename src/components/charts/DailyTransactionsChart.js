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

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const DailyTransactionsChart = ({ data, monthName, currentDate }) => {
  // Función para obtener la abreviatura del día de la semana
  const getDayAbbreviation = (date) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[date.getDay()];
  };

  // Ordenar los días numéricamente
  const sortedDays = Object.keys(data).sort((a, b) => {
    const dayA = parseInt(a.replace('Día ', ''));
    const dayB = parseInt(b.replace('Día ', ''));
    return dayA - dayB;
  });

  const entradasData = sortedDays.map(day => data[day].entradas || 0);
  const salidasData = sortedDays.map(day => data[day].salidas || 0);
  
  // Crear etiquetas con el número del día y la abreviatura del día de la semana
  const dayLabels = sortedDays.map(day => {
    const dayNumber = parseInt(day.replace('Día ', ''));
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNumber);
    const dayAbbr = getDayAbbreviation(date);
    return [`${dayNumber}`, dayAbbr];
  });

  const chartData = {
    labels: dayLabels,
    datasets: [
      {
        label: 'Entradas',
        data: entradasData,
        backgroundColor: 'rgba(34, 197, 94, 0.7)', // Verde suave
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Salidas',
        data: salidasData,
        backgroundColor: 'rgba(239, 68, 68, 0.7)', // Rojo suave
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: `Movimientos Diarios - ${monthName}`,
        font: {
          size: 16,
          weight: 'bold',
        },
        padding: {
          top: 10,
          bottom: 20,
        },
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            const label = context[0].label;
            // Si label es un array, tomamos el primer elemento
            const dayNumber = Array.isArray(label) ? label[0] : label;
            return `Día ${dayNumber}`;
          },
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: $${value.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          },
          footer: function(context) {
            // Calcular el balance del día
            const entradas = context[0].chart.data.datasets[0].data[context[0].dataIndex];
            const salidas = context[1] ? context[1].chart.data.datasets[1].data[context[1].dataIndex] : 0;
            const balance = entradas - salidas;
            const balanceText = balance >= 0 ? `Balance: +$${balance.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `Balance: -$${Math.abs(balance).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            return balanceText;
          },
        },
        padding: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 10,
          },
          autoSkip: false,
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          callback: function(value) {
            return '$' + value.toLocaleString('es-MX');
          },
          font: {
            size: 11,
          },
        },
      },
    },
  };

  // Calcular estadísticas del mes
  const totalEntradas = entradasData.reduce((sum, val) => sum + val, 0);
  const totalSalidas = salidasData.reduce((sum, val) => sum + val, 0);
  const balance = totalEntradas - totalSalidas;
  const diasConMovimiento = sortedDays.filter(day => data[day].entradas > 0 || data[day].salidas > 0).length;

  return (
    <div className="bg-background rounded-lg border border-border p-6">
      {/* Estadísticas resumidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <p className="text-xs text-green-700 font-medium mb-1">Total Entradas</p>
          <p className="text-lg font-bold text-green-600">
            ${totalEntradas.toLocaleString('es-MX')}
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <p className="text-xs text-red-700 font-medium mb-1">Total Salidas</p>
          <p className="text-lg font-bold text-red-600">
            ${totalSalidas.toLocaleString('es-MX')}
          </p>
        </div>
        <div className={`rounded-lg p-4 border ${balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-medium mb-1 ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Balance</p>
          <p className={`text-lg font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {balance >= 0 ? '+' : '-'}${Math.abs(balance).toLocaleString('es-MX')}
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-xs text-gray-700 font-medium mb-1">Días con movimiento</p>
          <p className="text-lg font-bold text-gray-600">
            {diasConMovimiento} / {sortedDays.length}
          </p>
        </div>
      </div>

      {/* Gráfica */}
      <div style={{ height: '450px' }}>
        <Bar data={chartData} options={options} />
      </div>
    </div>
  );
};

export default DailyTransactionsChart;
