import { 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon, 
  ScaleIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

const SummaryCards = ({ summary, currentMonthName, montosPagados = false }) => {
  // El label puede ser un mes ("Septiembre de 2026") o un rango personalizado
  // ("1 sept 2026 – 15 sept 2026"). Se detecta por el separador "–".
  const isRange = currentMonthName ? currentMonthName.includes('–') : false;
  const periodWord = isRange ? 'Período' : 'Mes';
  // Para mes: solo el nombre ("Septiembre"); para rango: el rango completo.
  const periodLabel = currentMonthName
    ? isRange
      ? currentMonthName
      : currentMonthName.split(' ')[0]
    : '';

  // En modo "Pagos reales" los montos son pagos por fecha de pago, no las
  // transacciones normales: se ajustan los títulos para no confundir.
  const entradasTitle = montosPagados
    ? `Pagos recibidos (${periodLabel})`
    : `Entradas del ${periodWord} (${periodLabel})`;
  const salidasTitle = montosPagados
    ? `Pagos realizados (${periodLabel})`
    : `Salidas del ${periodWord} (${periodLabel})`;

  const cards = [
    {
      title: entradasTitle,
      bgcolorcard: 'bg-green-50',
      value: summary.entradas,
      icon: ArrowTrendingUpIcon,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      count: summary.entradasCount,
      pendingLabel: 'Por pagar',
      pendingValue: summary.entradasPorPagar,
    },
    {
      title: salidasTitle,
      bgcolorcard: 'bg-red-50',
      value: summary.salidas,
      icon: ArrowTrendingDownIcon,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      count: summary.salidasCount,
      pendingLabel: 'Por pagar',
      pendingValue: summary.salidasPorPagar,
    },
    // En modo "Pagos reales" el "Saldo General" (recibido − pagado) confunde
    // (parece saldo de cuenta y no flujo), así que se oculta.
    montosPagados
      ? null
      : {
          title: 'Saldo General',
          value: summary.balance,
          icon: ScaleIcon,
          color: summary.balance >= 0 ? 'text-green-600' : 'text-red-600',
          bgColor: summary.balance >= 0 ? 'bg-green-100' : 'bg-red-50',
        },
    {
      title: montosPagados ? 'Total de Pagos' : 'Total Transacciones',
      value: summary.totalTransactions,
      icon: DocumentTextIcon,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      isCount: true,
      showSplit: true,
      entradasCount: summary.entradasCount,
      salidasCount: summary.salidasCount
    }
  ].filter(Boolean);

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
                {card.pendingValue !== undefined && card.pendingValue !== null && (
                  <p className="text-sm font-semibold text-amber-700 mt-1">
                    {card.pendingLabel}: {formatCurrency(card.pendingValue)}
                  </p>
                )}
                {card.showSplit ? (
                  <div className="mt-2 flex items-center justify-center space-x-4 text-xs">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-600">Entradas:</span>
                    <span className="font-medium text-green-600">  <strong>{card.entradasCount}</strong></span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-red-600">Salidas:</span>
                      <span className="font-medium text-red-600"> <strong>{card.salidasCount}</strong></span>
                    </div>
                  </div>
                ) : card.count !== undefined && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <strong>{card.count}</strong> {montosPagados ? 'pago(s)' : 'transaccion(es)'}
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