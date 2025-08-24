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
      value: summary.entradas,
      icon: ArrowTrendingUpIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      count: summary.entradasCount
    },
    {
      title: `Salidas del Mes (${currentMonthName})`,
      value: summary.salidas,
      icon: ArrowTrendingDownIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      count: summary.salidasCount
    },
    {
      title: 'Saldo General',
      value: summary.balance,
      icon: ScaleIcon,
      color: summary.balance >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: summary.balance >= 0 ? 'bg-green-50' : 'bg-red-50',
    },
    {
      title: 'Total Transacciones',
      value: summary.totalTransactions,
      icon: DocumentTextIcon,
      color: 'text-primary',
      bgColor: 'bg-orange-50',
      isCount: true
    }
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <div key={index} className="bg-background rounded-lg border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  {card.title}
                </h3>
                <p className={`text-2xl font-bold ${card.color}`}>
                  {card.isCount ? card.value : formatCurrency(card.value)}
                </p>
                {card.count !== undefined && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {card.count} transacciones
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