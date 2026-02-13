import { useState } from "react";
import { EyeIcon, XMarkIcon, ArrowUpIcon, ArrowDownIcon } from "@heroicons/react/24/outline";

const TreeComparisonSection = ({
  stats,
  currentMonthName,
  calculateTreeComparison,
  formatCurrency,
  formatCurrencyWithBadge,
  subconcepts
}) => {
  const [selectedTreeTransactions, setSelectedTreeTransactions] = useState(null);

  if (!stats || !calculateTreeComparison().length) {
    return null;
  }

  return (
    <div className="bg-purple-100 rounded-lg border border-border p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Balance de cuentas mixtas (Entrada vs Salida)
          </h3>
          <p className="text-xs text-foreground mt-1">
            Transacciones mixtas por semana - Período: {currentMonthName}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Semana
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Árbol (General / Concepto)
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-purple-600 uppercase tracking-wider">
                Arrastre<br/><span className="text-[10px] font-normal normal-case">(Semana anterior)</span>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-green-600 uppercase tracking-wider">
                Entradas<br/><span className="text-[10px] font-normal normal-case">(Semana)</span>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-red-600 uppercase tracking-wider">
                Salidas<br/><span className="text-[10px] font-normal normal-case">(Semana)</span>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                Saldo<br/><span className="text-[10px] font-normal normal-case">(Semana)</span>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-orange-600 uppercase tracking-wider">
                Saldo al día<br/><span className="text-[10px] font-normal normal-case">(Hasta hoy)</span>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Transacciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {calculateTreeComparison().map((tree, index) => (
              <tr key={index} className="hover:bg-muted/50 transition-colors">
                <td className="px-4 py-4 whitespace-nowrap text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className="text-lg font-bold text-foreground">
                      {tree.weekNumber}
                    </span>
                    {tree.weekInfo && (
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        {tree.weekInfo.startDate} - {tree.weekInfo.endDate}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-foreground">
                  <div className="space-y-1">
                    <div className="font-semibold">{tree.conceptName}</div>
                    <div className="font-medium text-xs">{tree.generalName}</div>
                  </div>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                  tree.carryover >= 0 ? 'text-purple-600' : 'text-purple-700'
                }`}>
                  <div className="flex items-center justify-end">
                    {tree.carryover !== 0 ? (
                      <>
                        {tree.carryover >= 0 ? (
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                        {formatCurrencyWithBadge(tree.carryover)}
                      </>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                  {tree.entradas > 0 ? (
                    <span className="text-green-600">{formatCurrency(tree.entradas)}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                  {tree.salidas > 0 ? (
                    <span className="text-red-600">{formatCurrency(tree.salidas)}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                  tree.balance >= 0 ? 'text-blue-600' : 'text-blue-700'
                }`}>
                  <div className="flex items-center justify-end">
                    {tree.balance >= 0 ? (
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                    {formatCurrencyWithBadge(tree.balance)}
                  </div>
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${
                  tree.todayBalance >= 0 ? 'text-orange-600' : 'text-orange-700'
                }`}>
                  <div className="flex items-center justify-end">
                    {tree.todayBalance >= 0 ? (
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                    {formatCurrencyWithBadge(tree.todayBalance)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <button
                    onClick={() => setSelectedTreeTransactions(tree)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-800 font-medium transition-colors cursor-pointer border border-blue-300"
                  >
                    <EyeIcon className="h-4 w-4" />
                    <span>{tree.transactionCount}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {calculateTreeComparison().length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No hay árboles con transacciones mixtas en el período seleccionado</p>
          <p className="text-xs mt-2">Los árboles tipo 'ambos' aparecerán aquí agrupados por semana cuando tengan transacciones</p>
        </div>
      )}

      {/* Modal de Transacciones de Árbol Mixto */}
      {selectedTreeTransactions && (() => {
        // Ordenar todas las transacciones cronológicamente usando createdAt (timestamp completo)
        const sortedTransactions = [...selectedTreeTransactions.transactions].sort((a, b) => {
          // Prioridad 1: Usar createdAt si está disponible (tiene timestamp completo)
          if (a.createdAt && b.createdAt) {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
            return timeA - timeB;
          }
          // Prioridad 2: Usar date si createdAt no está disponible
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
          const dateDiff = dateA - dateB;
          
          // Si las fechas son iguales, ordenar por ID (orden de creación)
          if (dateDiff === 0) {
            return (a.id || '').localeCompare(b.id || '');
          }
          return dateDiff;
        });
        
        // Calcular saldo acumulado para cada transacción
        let runningBalance = 0;
        const transactionsWithBalance = sortedTransactions.map(transaction => {
          const amount = transaction.amount || 0;
          if (transaction.type === 'entrada') {
            runningBalance += amount;
          } else if (transaction.type === 'salida') {
            runningBalance -= amount;
          }
          return {
            ...transaction,
            runningBalance: runningBalance
          };
        });
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedTreeTransactions(null)} />
            <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      Detalle de Movimientos - Semana {selectedTreeTransactions.weekNumber}
                    </h3>
                    <p className="text-blue-100 text-sm mt-0.5">
                      {selectedTreeTransactions.weekInfo && (
                        <span className="mr-3">
                          📅 {selectedTreeTransactions.weekInfo.startDate} - {selectedTreeTransactions.weekInfo.endDate}
                        </span>
                      )}
                      {selectedTreeTransactions.generalName} / <strong>{selectedTreeTransactions.conceptName}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedTreeTransactions(null)}
                    className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6 text-white" />
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-700 font-medium mb-1">Total Entradas</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(selectedTreeTransactions.entradas)}
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs text-red-700 font-medium mb-1">Total Salidas</div>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(selectedTreeTransactions.salidas)}
                    </div>
                  </div>
                  <div className={`border-2 rounded-lg p-3 ${
                    selectedTreeTransactions.balance >= 0 
                      ? 'bg-blue-50 border-blue-300' 
                      : 'bg-orange-50 border-orange-300'
                  }`}>
                    <div className={`text-xs font-medium mb-1 ${
                      selectedTreeTransactions.balance >= 0 ? 'text-blue-700' : 'text-orange-700'
                    }`}>Saldo Final</div>
                    <div className={`text-lg font-bold ${
                      selectedTreeTransactions.balance >= 0 ? 'text-blue-600' : 'text-orange-600'
                    }`}>
                      {formatCurrency(Math.abs(selectedTreeTransactions.balance))}
                    </div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="text-xs text-purple-700 font-medium mb-1">Movimientos</div>
                    <div className="text-lg font-bold text-purple-600">
                      {selectedTreeTransactions.transactions.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 280px)' }}>
                <div className="px-6 py-4">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Fecha Transacción
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Subconcepto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Monto
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                            Saldo Acumulado
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Descripción
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                            Proveedor
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactionsWithBalance.map((transaction, index) => {
                          // Mostrar la fecha real de la transacción (date)
                          const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
                          // Obtener el timestamp de registro (createdAt) si está disponible
                          const createdDate = transaction.createdAt?.toDate 
                            ? transaction.createdAt.toDate() 
                            : null;
                          const subconcept = subconcepts?.find(s => s.id === transaction.subconceptId);
                          
                          return (
                            <tr key={transaction.id || index} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                <div className="font-medium">
                                  {transactionDate.toLocaleDateString('es-MX', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </div>
                                {createdDate && (
                                  <div className="text-xs text-gray-500" title="Hora de registro en sistema">
                                    {createdDate.toLocaleTimeString('es-MX', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <span className="font-medium">{subconcept?.name || 'Sin subconcepto'}</span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.type === 'entrada'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {transaction.type === 'entrada' ? (
                                    <ArrowUpIcon className="h-3 w-3 mr-1" />
                                  ) : (
                                    <ArrowDownIcon className="h-3 w-3 mr-1" />
                                  )}
                                  {transaction.type === 'entrada' ? 'Entrada' : 'Salida'}
                                </span>
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${
                                transaction.type === 'entrada' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {transaction.type === 'entrada' ? '+' : '-'}{formatCurrency(transaction.amount || 0)}
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-bold ${
                                transaction.runningBalance >= 0 ? 'text-blue-600' : 'text-orange-600'
                              }`}>
                                <div className="flex items-center justify-end">
                                  {transaction.runningBalance >= 0 ? (
                                    <ArrowUpIcon className="h-4 w-4 mr-1" />
                                  ) : (
                                    <ArrowDownIcon className="h-4 w-4 mr-1" />
                                  )}
                                  {formatCurrency(Math.abs(transaction.runningBalance))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={transaction.description || 'Sin descripción'}>
                                {transaction.description || 'Sin descripción'}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                                {transaction.providerName || 'Sin proveedor'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {transactionsWithBalance.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p className="text-sm">No hay transacciones en este concepto</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
                <div className="text-xs text-gray-600 text-center">
                  Mostrando <strong>{transactionsWithBalance.length}</strong> transacciones de la Semana {selectedTreeTransactions.weekNumber} • Ordenadas por fecha/hora de registro
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TreeComparisonSection;
