import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  ScaleIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

const SummaryCards = ({ summary }) => {
  // Obtener el nombre del mes actual
  const getCurrentMonthName = () => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const currentMonth = new Date().getMonth();
    return months[currentMonth];
  };

  const currentMonthName = getCurrentMonthName();

  const cards = [
    {
      title: `Entradas del Mes (${currentMonthName})`,
      bgcolorcard: 'bg-green-50',
      value: summary.entradas,
      icon: ArrowTrendingUpIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      count: summary.entradasCount
    },
    {
      title: `Salidas del Mes (${currentMonthName})`,
      bgcolorcard: 'bg-red-50',
      value: summary.salidas,
      icon: ArrowTrendingDownIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      count: summary.salidasCount
    },
    {
      title: 'Saldo General',
      value: summary.balance,
      icon: ScaleIcon,
      color: summary.balance >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: summary.balance >= 0 ? 'bg-green-100' : 'bg-red-50',
    },
    {
      title: 'Total Transacciones',
      value: summary.totalTransactions,
      icon: DocumentTextIcon,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      isCount: true,
      showSplit: true,
      entradasCount: summary.entradasCount,
      salidasCount: summary.salidasCount
    }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <div key={index} className={`${card.bgcolorcard} rounded-lg border border-border p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {card.title}
                </h3>
                <p className={`text-2xl font-bold ${card.color}`}>
                  {card.isCount ? card.value : formatCurrency(card.value)}
                </p>
                {card.showSplit ? (
                  <div className="mt-2 flex items-center justify-center space-x-4 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-600">Ingresos:</span>
                    <span className="font-medium text-green-600">  <strong>{card.entradasCount}</strong></span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-red-600">Gastos:</span>
                      <span className="font-medium text-red-600"> <strong>{card.salidasCount}</strong></span>
                    </div>
                  </div>
                ) : card.count !== undefined && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{card.count}</strong> transaccion(es)
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-full ${card.bgColor}`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SummaryCards;