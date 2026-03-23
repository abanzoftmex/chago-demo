import { useState, useMemo } from "react";
import { EyeIcon, XMarkIcon, ClockIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useWeekDayBreakdown } from "../../lib/hooks/useWeekDayBreakdown";
import { usePersistedDisabledRows } from "../../lib/hooks/usePersistedDisabledRows";
import WeekDayBreakdownModal from "./WeekDayBreakdownModal";
import { parseWeekDate } from "../../lib/utils/reportUtils";
import { useAuth } from "../../context/AuthContextMultiTenant";

const PAYMENT_STATUS_CONFIG = {
  pendiente: { color: "bg-red-100 text-red-800", text: "Pendiente", icon: <ClockIcon className="h-3 w-3 mr-1" /> },
  parcial: { color: "bg-yellow-100 text-yellow-800", text: "Parcial", icon: <ClockIcon className="h-3 w-3 mr-1" /> },
  pagado: { color: "bg-green-100 text-green-800", text: "Pagado", icon: <CheckCircleIcon className="h-3 w-3 mr-1" /> },
};
const getPaymentStatusBadge = (status) => PAYMENT_STATUS_CONFIG[status] || PAYMENT_STATUS_CONFIG.pendiente;

const WeeklyBreakdownCombined = ({
  stats,
  currentMonthName,
  transactions,
  generals,
  concepts,
  subconcepts,
  filters,
  currentDate,
  formatCurrency
}) => {
  const { user } = useAuth();
  const [selectedWeekDetail, setSelectedWeekDetail] = useState(null);
  const { disabledRows, toggleRow } = usePersistedDisabledRows(user?.uid, "combined");
  const { selectedWeekOverview, handleWeekOverviewClick, clearWeekOverview } = useWeekDayBreakdown({
    transactions, generals, concepts, subconcepts, filters, currentDate, type: null,
  });

  const weeklyBreakdown = stats?.weeklyBreakdown;
  const weeks = weeklyBreakdown?.weeks || [];
  const entradasBreakdown = weeklyBreakdown?.entradas || {};
  const salidasBreakdown = weeklyBreakdown?.salidas || {};

  // O(1) lookup maps — built once per render, shared by handleRowClick
  const generalMap = useMemo(() => Object.fromEntries(generals.map((g) => [g.id, g.name])), [generals]);
  const conceptMap = useMemo(() => Object.fromEntries(concepts.map((c) => [c.id, c.name])), [concepts]);
  const subconceptMap = useMemo(() => Object.fromEntries(subconcepts.map((s) => [s.id, s.name])), [subconcepts]);

  // Combine entradas and salidas into a single ordered list
  const entradasRows = useMemo(
    () => Object.entries(entradasBreakdown).map(([subconcept, weekData]) => ({ subconcept, weekData, type: "entrada" })),
    [entradasBreakdown]
  );
  const salidasRows = useMemo(
    () => Object.entries(salidasBreakdown).map(([subconcept, weekData]) => ({ subconcept, weekData, type: "salida" })),
    [salidasBreakdown]
  );
  const allRows = useMemo(() => [...entradasRows, ...salidasRows], [entradasRows, salidasRows]);

  if (!weeklyBreakdown || weeks.length === 0) {
    return null;
  }

  const handleRowClick = (week, index, subconcept, type, amount) => {
    const weekTransactions = transactions.filter((t) => {
      const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      const tTime = tDate.getTime();
      const fullName = `${generalMap[t.generalId] || "N/A"} > ${conceptMap[t.conceptId] || "N/A"} > ${subconceptMap[t.subconceptId] || "N/A"}`;
      return t.type === type && tTime >= week.startTimestamp && tTime <= week.endTimestamp && fullName === subconcept;
    });
    setSelectedWeekDetail({
      weekNumber: week.weekNumber || index + 1,
      weekRange: `${week.startDate} - ${week.endDate}`,
      subconcept,
      type,
      amount,
      transactions: weekTransactions,
    });
  };

  return (
    <div className="bg-background rounded-lg border border-border p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">
          Resumen Mes {currentMonthName} - Entradas &amp; Salidas
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-gray-100">
            <tr>
              <th
                rowSpan={2}
                className="px-4 py-2 text-center text-xs font-bold text-gray-700 bg-gray-200 tracking-wider border-r-2 border-gray-200"
              >
                Concepto
              </th>
              <th
                colSpan={weeks.length}
                className="px-4 py-2 text-center text-xs font-bold bg-gray-200 text-gray-700 tracking-wider border-r-2 border-gray-200"
              >
                Semanas
              </th>
              <th
                rowSpan={2}
                className="px-4 py-2 text-center text-xs font-bold tracking-wider text-gray-700 bg-gray-200"
              >
                Total
              </th>
            </tr>
            <tr>
              {weeks.map((week, index) => {
                const startDate = parseWeekDate(week.startDate, filters, currentDate);
                const endDate = parseWeekDate(week.endDate, filters, currentDate);
                return (
                  <th
                    key={index}
                    className="px-6 py-3 text-center text-xs font-medium text-gray-700 tracking-wider bg-gray-50"
                  >
                    <button
                      onClick={() => handleWeekOverviewClick(week, index)}
                      title={`Ver desglose diario — Semana ${week.weekNumber || index + 1}`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-700 hover:text-blue-900 font-bold border border-blue-300 transition-colors cursor-pointer"
                    >
                      <EyeIcon className="h-3 w-3" />
                      {week.weekNumber || index + 1}
                    </button>
                    {startDate && endDate && !isNaN(startDate) && !isNaN(endDate) && (
                      <div className="text-xs font-normal text-gray-500 mt-1">
                        {startDate.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
                        {" - "}
                        {endDate.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" })}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-background divide-y divide-border">
            {allRows.map(({ subconcept, weekData, type }) => {
              const parts = subconcept.split(" > ");
              const isEntrada = type === "entrada";
              const rowKey = `${type}-${subconcept}`;
              const isActive = !disabledRows.has(rowKey);
              return (
                <tr key={rowKey} className={`hover:bg-muted/50 transition-opacity ${!isActive ? 'opacity-40' : ''}`}>
                  {/* Concepto cell */}
                  <td className="px-4 py-3 text-xs text-foreground min-w-[200px] max-w-[230px]">
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleRow(rowKey)}
                        title={isActive ? 'Desactivar fila' : 'Activar fila'}
                        className={`mt-0.5 relative inline-flex h-4 w-7 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isActive ? (isEntrada ? 'bg-lime-500' : 'bg-red-500') : 'bg-gray-300'}`}
                      >
                        <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isActive ? 'translate-x-3' : 'translate-x-0'}`} />
                      </button>
                      <div className="break-words">
                        {parts.length === 3 ? (
                          <>
                            <div className="font-bold text-foreground">{parts[2]}</div>
                            <div className="font-normal text-xs text-muted-foreground mt-0.5">
                              {parts[0]} / {parts[1]}
                            </div>
                          </>
                        ) : (
                          <span className="font-semibold">{subconcept}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Week amount cells */}
                  {weeks.map((week, index) => {
                    const amount = weekData[`week${index + 1}`];
                    return (
                      <td key={index} className="px-4 py-3 whitespace-nowrap text-xs text-right">
                        {amount ? (
                          <button
                            onClick={() => handleRowClick(week, index, subconcept, type, amount)}
                            className={
                              isEntrada
                                ? "inline-flex items-center gap-1 px-2 py-1 rounded-full bg-lime-100 hover:bg-lime-200 text-lime-700 hover:text-lime-800 font-medium transition-colors cursor-pointer border border-lime-300"
                                : "inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 hover:bg-red-200 text-red-700 hover:text-red-800 font-medium transition-colors cursor-pointer border border-red-300"
                            }
                          >
                            <EyeIcon className="h-3 w-3" />
                            {formatCurrency(amount)}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    );
                  })}
                  {/* Row total */}
                  <td
                    className={
                      isEntrada
                        ? "px-4 py-3 whitespace-nowrap text-xs text-right font-bold text-lime-800 bg-lime-100"
                        : "px-4 py-3 whitespace-nowrap text-xs text-right font-bold text-red-800 bg-red-100"
                    }
                  >
                    {formatCurrency(weekData.total || 0)}
                  </td>
                </tr>
              );
            })}

            {/* Total Entradas row */}
            <tr className="bg-lime-50 font-bold border-t-2 border-gray-300">
              <td className="px-4 py-3 whitespace-nowrap text-xs text-lime-800 font-bold">
                Total Entradas
              </td>
              {weeks.map((week, index) => {
                const weekTotal = Object.entries(
                  stats.weeklyBreakdown.entradas || {}
                ).reduce((sum, [key, data]) => disabledRows.has(`entrada-${key}`) ? sum : sum + (data[`week${index + 1}`] || 0), 0);
                return (
                  <td key={index} className="px-4 py-3 whitespace-nowrap text-xs text-right text-lime-700">
                    {formatCurrency(weekTotal)}
                  </td>
                );
              })}
              <td className="px-4 py-3 whitespace-nowrap text-xs text-right font-bold text-lime-800 bg-lime-200">
                {formatCurrency(Object.entries(stats.weeklyBreakdown.entradas || {}).reduce(
                  (sum, [key, data]) => disabledRows.has(`entrada-${key}`) ? sum : sum + (data.total || 0), 0
                ))}
              </td>
            </tr>

            {/* Total Salidas row */}
            <tr className="bg-red-50 font-bold border-t border-gray-200">
              <td className="px-4 py-3 whitespace-nowrap text-xs text-red-800 font-bold">
                Total Salidas
              </td>
              {weeks.map((week, index) => {
                const weekTotal = Object.entries(
                  stats.weeklyBreakdown.salidas || {}
                ).reduce((sum, [key, data]) => disabledRows.has(`salida-${key}`) ? sum : sum + (data[`week${index + 1}`] || 0), 0);
                return (
                  <td key={index} className="px-4 py-3 whitespace-nowrap text-xs text-right text-red-700">
                    {formatCurrency(weekTotal)}
                  </td>
                );
              })}
              <td className="px-4 py-3 whitespace-nowrap text-xs text-right font-bold text-red-800 bg-red-200">
                {formatCurrency(Object.entries(stats.weeklyBreakdown.salidas || {}).reduce(
                  (sum, [key, data]) => disabledRows.has(`salida-${key}`) ? sum : sum + (data.total || 0), 0
                ))}
              </td>
            </tr>

            {/* Balance row */}
            {(() => {
              const filteredEntradas = Object.entries(stats.weeklyBreakdown.entradas || {}).reduce(
                (sum, [key, data]) => disabledRows.has(`entrada-${key}`) ? sum : sum + (data.total || 0), 0
              );
              const filteredSalidas = Object.entries(stats.weeklyBreakdown.salidas || {}).reduce(
                (sum, [key, data]) => disabledRows.has(`salida-${key}`) ? sum : sum + (data.total || 0), 0
              );
              const balance = filteredEntradas - filteredSalidas;
              const isPositive = balance >= 0;
              return (
                <tr className="bg-gray-200 font-bold border-t-2 border-gray-400">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-800 font-bold">
                    Balance
                  </td>
                  {weeks.map((week, index) => {
                    const entradasWeek = Object.entries(
                      stats.weeklyBreakdown.entradas || {}
                    ).reduce((sum, [key, data]) => disabledRows.has(`entrada-${key}`) ? sum : sum + (data[`week${index + 1}`] || 0), 0);
                    const salidasWeek = Object.entries(
                      stats.weeklyBreakdown.salidas || {}
                    ).reduce((sum, [key, data]) => disabledRows.has(`salida-${key}`) ? sum : sum + (data[`week${index + 1}`] || 0), 0);
                    const weekBalance = entradasWeek - salidasWeek;
                    return (
                      <td
                        key={index}
                        className={`px-4 py-3 whitespace-nowrap text-xs text-right font-semibold ${
                          weekBalance >= 0 ? "text-lime-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(weekBalance)}
                      </td>
                    );
                  })}
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-xs text-right font-bold ${
                      isPositive ? "text-lime-800 bg-lime-100" : "text-red-800 bg-red-100"
                    }`}
                  >
                    {formatCurrency(balance)}
                  </td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      <WeekDayBreakdownModal
        data={selectedWeekOverview}
        onClose={clearWeekOverview}
        formatCurrency={formatCurrency}
      />

      {/* Modal de Detalle de Semana */}
      {selectedWeekDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedWeekDetail(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
            <div
              className={`px-6 py-4 rounded-t-xl ${
                selectedWeekDetail.type === "entrada"
                  ? "bg-gradient-to-r from-green-500 to-green-600"
                  : "bg-gradient-to-r from-red-500 to-red-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Detalle de Transacciones - Semana {selectedWeekDetail.weekNumber}
                  </h3>
                  <p className="text-white/90 text-sm mt-0.5">
                    {selectedWeekDetail.weekRange} &bull;{" "}
                    {selectedWeekDetail.type === "entrada" ? "Entradas" : "Salidas"}
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
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${
                  selectedWeekDetail.type === "entrada"
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    selectedWeekDetail.type === "entrada" ? "text-green-700" : "text-red-700"
                  }`}
                >
                  Total de la semana:
                </span>
                <span
                  className={`text-lg font-bold ${
                    selectedWeekDetail.type === "entrada" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(selectedWeekDetail.amount)}
                </span>
              </div>
            </div>

            <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 280px)" }}>
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
                            const transactionDate = transaction.date?.toDate
                              ? transaction.date.toDate()
                              : new Date(transaction.date);

                            const paymentBadge = getPaymentStatusBadge(transaction.status);
                            const isEntradaModal = selectedWeekDetail.type === "entrada";

                            return (
                              <tr key={transaction.id || index} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                                  {transactionDate.toLocaleDateString("es-MX", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </td>
                                <td
                                  className={`px-3 py-2 whitespace-nowrap text-xs text-right font-semibold ${
                                    isEntradaModal ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {formatCurrency(transaction.amount || 0)}
                                </td>
                                <td
                                  className="px-3 py-2 text-xs text-gray-900 max-w-xs truncate"
                                  title={transaction.description || "Sin descripción"}
                                >
                                  {transaction.description || "Sin descripción"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                                  {transaction.providerName || "Sin proveedor"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${paymentBadge.color}`}
                                  >
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
                    <p className="text-sm">
                      No hay transacciones en esta semana para este subconcepto
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl">
              <div className="text-xs text-gray-600 text-center">
                Mostrando{" "}
                <strong>{selectedWeekDetail.transactions.length}</strong> transacciones de la semana{" "}
                {selectedWeekDetail.weekNumber}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyBreakdownCombined;
