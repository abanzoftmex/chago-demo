import { useState } from "react";
import { EyeIcon, XMarkIcon, ArrowUpIcon, ArrowDownIcon, ClockIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

const WeeklyBreakdownSalidas = ({
  stats,
  currentMonthName,
  transactions,
  generals,
  concepts,
  subconcepts,
  filters,
  currentDate,
  formatCurrency,
  getTreeBalanceByName,
  isAmboTree
}) => {
  const [selectedWeekDetail, setSelectedWeekDetail] = useState(null);
  const [selectedTreeBalance, setSelectedTreeBalance] = useState(null);

  if (!stats || !stats.weeklyBreakdown || !stats.weeklyBreakdown.weeks) {
    return null;
  }

  return (
    <div className="bg-background rounded-lg border border-border p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-red-700">
          Resumen Mes {currentMonthName} - Salidas
        </h3>
      </div>

      {stats.weeklyBreakdown && stats.weeklyBreakdown.weeks ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-red-100">
              <tr>
                <th rowSpan={2} className="px-6 py-3 text-center text-sm font-bold text-red-800 tracking-wider border-r-2 border-red-200">
                  Concepto
                </th>
                <th colSpan={stats.weeklyBreakdown.weeks.length} className="px-6 py-3 text-center text-sm font-bold text-red-800 tracking-wider border-r-2 border-red-200">
                  Semanas
                </th>
                <th rowSpan={2} className="px-6 py-3 text-center text-sm font-bold tracking-wider bg-red-200 text-red-800">
                  Totales
                </th>
              </tr>
              <tr>
                {stats.weeklyBreakdown.weeks.map((week, index) => {
                  return (
                  <th key={index} className="px-6 py-3 text-center text-xs font-medium text-red-800 uppercase tracking-wider bg-red-50">
                    <div>{week.weekNumber || (index + 1)}</div>
                    {(() => {
                      try {
                        if (!week.startDate || !week.endDate) {
                          return null;
                        }
                        
                        // Parse dates - handle both Firestore Timestamp and "dd/MM" string format
                        let startDate, endDate;
                        
                        if (typeof week.startDate === 'string' && week.startDate.includes('/')) {
                          // Format "dd/MM" - need to add year
                          const currentYear = new Date(filters.startDate || currentDate).getFullYear();
                          const [dayStart, monthStart] = week.startDate.split('/');
                          startDate = new Date(currentYear, parseInt(monthStart) - 1, parseInt(dayStart));
                        } else {
                          startDate = week.startDate?.toDate ? week.startDate.toDate() : new Date(week.startDate);
                        }
                        
                        if (typeof week.endDate === 'string' && week.endDate.includes('/')) {
                          // Format "dd/MM" - need to add year
                          const currentYear = new Date(filters.startDate || currentDate).getFullYear();
                          const [dayEnd, monthEnd] = week.endDate.split('/');
                          endDate = new Date(currentYear, parseInt(monthEnd) - 1, parseInt(dayEnd));
                        } else {
                          endDate = week.endDate?.toDate ? week.endDate.toDate() : new Date(week.endDate);
                        }
                        
                        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                          return null;
                        }
                        
                        return (
                          <div className="text-xs font-normal text-red-700 mt-1">
                            {startDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {endDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                          </div>
                        );
                      } catch (error) {
                        return null;
                      }
                    })()}
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="bg-background divide-y divide-border">
              {Object.entries(stats.weeklyBreakdown.salidas || {}).map(([subconcept, weekData]) => {
                const parts = subconcept.split(' > ');
                const isAmbo = isAmboTree(subconcept);
                return (
                <tr key={subconcept} className="hover:bg-muted/50">
                  <td className="px-6 py-4 text-sm text-foreground min-w-[200px] max-w-[230px]">
                    <div className="break-words">
                      {parts.length === 3 ? (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-bold text-foreground">{parts[2]}</div>
                              <div className="font-normal text-xs text-muted-foreground mt-0.5">{parts[0]} / {parts[1]}</div>
                            </div>
                            {isAmbo && (
                              <button
                                onClick={() => setSelectedTreeBalance(getTreeBalanceByName(subconcept))}
                                className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 transition-colors whitespace-nowrap"
                                title="Ver balance de este árbol mixto"
                              >
                                Ver saldo
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="font-semibold">{subconcept}</span>
                      )}
                    </div>
                  </td>
                  {stats.weeklyBreakdown.weeks.map((week, index) => {
                    const amount = weekData[`week${index + 1}`];
                    return (
                    <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      {amount ? (
                        <button
                          onClick={() => {
                            // Filtrar transacciones de esta semana y subconcepto
                            const weekTransactions = transactions.filter(t => {
                              const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
                              const tTime = tDate.getTime();
                              
                              // Construir el nombre completo del árbol desde los IDs
                              const general = generals.find(g => g.id === t.generalId);
                              const concept = concepts.find(c => c.id === t.conceptId);
                              const subconceptItem = subconcepts.find(s => s.id === t.subconceptId);
                              const fullName = `${general?.name || 'N/A'} > ${concept?.name || 'N/A'} > ${subconceptItem?.name || 'N/A'}`;
                              
                              return t.type === 'salida' &&
                                     tTime >= week.startTimestamp &&
                                     tTime <= week.endTimestamp &&
                                     fullName === subconcept;
                            });
                            setSelectedWeekDetail({
                              weekNumber: week.weekNumber || (index + 1),
                              weekRange: `${week.startDate} - ${week.endDate}`,
                              subconcept,
                              type: 'salida',
                              amount,
                              transactions: weekTransactions
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-800 font-medium transition-colors cursor-pointer border border-red-300"
                        >
                          <EyeIcon className="h-4 w-4" />
                          {formatCurrency(amount)}
                        </button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    );
                  })}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-700 bg-red-100">
                    {formatCurrency(weekData.total || 0)}
                  </td>
                </tr>
                );
              })}
              <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                  {/* Vacío para totales */}
                </td>
                {stats.weeklyBreakdown.weeks.map((week, index) => {
                  const weekTotal = Object.values(stats.weeklyBreakdown.salidas || {}).reduce(
                    (sum, data) => sum + (data[`week${index + 1}`] || 0),
                    0
                  );
                  return (
                    <td key={index} className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-700">
                      {formatCurrency(weekTotal)}
                    </td>
                  );
                })}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-red-800 bg-red-200">
                  {formatCurrency(stats.totalSalidas || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No hay datos de desglose semanal disponibles.</p>
          <p className="text-sm mt-2">El backend necesita proporcionar la estructura <code>weeklyBreakdown</code> con semanas y subconceptos.</p>
        </div>
      )}

      {/* Modal de Balance de Árbol Mixto */}
      {selectedTreeBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTreeBalance(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Balance de Árbol Mixto
                  </h3>
                  <p className="text-purple-100 text-sm mt-0.5">
                    {currentMonthName}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTreeBalance(null)}
                  className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-1">Árbol completo</div>
                <div className="font-medium text-gray-900">
                  {selectedTreeBalance.generalName} / {selectedTreeBalance.conceptName} / <strong>{selectedTreeBalance.subconceptName}</strong>
                </div>
              </div>

              <div className="space-y-3">
                {/* Primera fila: Arrastre y Saldo al día */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Arrastre */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-purple-700 font-medium mb-1">Arrastre</div>
                        <div className="text-xs text-purple-600 mb-1.5">(Mes anterior)</div>
                        <div className={`text-xl font-bold ${
                          selectedTreeBalance.carryover >= 0 ? 'text-purple-600' : 'text-purple-700'
                        }`}>
                          {formatCurrency(selectedTreeBalance.carryover || 0)}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {selectedTreeBalance.carryover >= 0 ? (
                          <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Saldo al día */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-orange-700 font-medium mb-1">Saldo al día</div>
                        <div className="text-xs text-orange-600 mb-1.5">(Hasta hoy)</div>
                        <div className={`text-xl font-bold ${
                          selectedTreeBalance.todayBalance >= 0 ? 'text-orange-600' : 'text-orange-700'
                        }`}>
                          {formatCurrency(selectedTreeBalance.todayBalance || 0)}
                        </div>
                      </div>
                      <div className="flex items-center">
                        {selectedTreeBalance.todayBalance >= 0 ? (
                          <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Segunda fila: Entradas, Salidas y Saldo */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Entradas */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-full">
                        <div className="text-xs text-green-700 font-medium mb-1">Entradas</div>
                        <div className="text-xs text-green-600 mb-1.5">(Mes consultado)</div>
                        <div className="text-lg font-bold text-green-600">
                          {formatCurrency(selectedTreeBalance.entradas)}
                        </div>
                      </div>
                      <ArrowUpIcon className="h-5 w-5 text-green-500 flex-shrink-0 ml-2" />
                    </div>
                  </div>

                  {/* Salidas */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="w-full">
                        <div className="text-xs text-red-700 font-medium mb-1">Salidas</div>
                        <div className="text-xs text-red-600 mb-1.5">(Mes consultado)</div>
                        <div className="text-lg font-bold text-red-600">
                          {formatCurrency(selectedTreeBalance.salidas)}
                        </div>
                      </div>
                      <ArrowDownIcon className="h-5 w-5 text-red-500 flex-shrink-0 ml-2" />
                    </div>
                  </div>

                  {/* Saldo del mes */}
                  <div className={`border-2 rounded-lg p-4 ${
                    selectedTreeBalance.balance >= 0 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-red-50 border-red-300'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="w-full">
                        <div className={`text-xs font-medium mb-1 ${
                          selectedTreeBalance.balance >= 0 ? 'text-blue-700' : 'text-red-700'
                        }`}>
                          Saldo
                        </div>
                        <div className={`text-xs mb-1.5 ${
                          selectedTreeBalance.balance >= 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          (Mes consultado)
                        </div>
                        <div className={`text-lg font-bold ${
                          selectedTreeBalance.balance >= 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(selectedTreeBalance.balance)}
                        </div>
                      </div>
                      <div className="flex items-center flex-shrink-0 ml-2">
                        {selectedTreeBalance.balance >= 0 ? (
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 text-center">
                {selectedTreeBalance.transactionCount} transacciones en este período
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalle de Semana */}
      {selectedWeekDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedWeekDetail(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Detalle de Transacciones - Semana {selectedWeekDetail.weekNumber}
                  </h3>
                  <p className="text-white/90 text-sm mt-0.5">
                    {selectedWeekDetail.weekRange} • Salidas
                  </p>
                </div>
                <button
                  onClick={() => setSelectedWeekDetail(null)}
                  className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6 text-white" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="mb-3">
                <div className="text-xs text-gray-600 mb-1">Subconcepto</div>
                <div className="font-medium text-gray-900">{selectedWeekDetail.subconcept}</div>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200">
                <span className="text-xs font-medium text-red-700">
                  Total de la semana:
                </span>
                <span className="text-lg font-bold text-red-600">
                  {formatCurrency(selectedWeekDetail.amount)}
                </span>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
              <div className="px-6 py-4">
                {selectedWeekDetail.transactions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Monto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Descripción
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Proveedor
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {selectedWeekDetail.transactions
                          .sort((a, b) => {
                            const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                            const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                            return dateB - dateA;
                          })
                          .map((transaction, index) => {
                            const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                            
                            const getPaymentStatusBadge = (status) => {
                              const statusConfig = {
                                pendiente: { 
                                  color: "bg-red-100 text-red-800", 
                                  text: "Pendiente",
                                  icon: <ClockIcon className="h-3 w-3 mr-1" />
                                },
                                parcial: { 
                                  color: "bg-yellow-100 text-yellow-800", 
                                  text: "Parcial",
                                  icon: <ClockIcon className="h-3 w-3 mr-1" />
                                },
                                pagado: { 
                                  color: "bg-green-100 text-green-800", 
                                  text: "Pagado",
                                  icon: <CheckCircleIcon className="h-3 w-3 mr-1" />
                                },
                              };
                              return statusConfig[status] || statusConfig.pendiente;
                            };

                            const paymentBadge = getPaymentStatusBadge(transaction.status);
                            
                            return (
                              <tr key={transaction.id || index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {transactionDate.toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-red-600">
                                  {formatCurrency(transaction.amount || 0)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={transaction.description || 'Sin descripción'}>
                                  {transaction.description || 'Sin descripción'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                  {transaction.providerName || 'Sin proveedor'}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadge.color}`}>
                                    {paymentBadge.icon}
                                    {paymentBadge.text}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No hay transacciones en esta semana para este subconcepto</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <div className="text-xs text-gray-600 text-center">
                Mostrando <strong>{selectedWeekDetail.transactions.length}</strong> transacciones de la semana {selectedWeekDetail.weekNumber}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyBreakdownSalidas;
