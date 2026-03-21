import { XMarkIcon } from "@heroicons/react/24/outline";
import { getDayKey } from "../../lib/utils/reportUtils";

const WeekDayBreakdownModal = ({ data, onClose, formatCurrency }) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 rounded-t-xl bg-gradient-to-r from-blue-500 to-blue-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">
                Semana {data.weekNumber}
              </h3>
              <p className="text-white/90 text-sm mt-0.5">
                Desglose diario &bull; {data.weekRange}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <XMarkIcon className="h-6 w-6 text-white" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {Object.keys(data.rows).length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-sm">No hay transacciones registradas en esta semana.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider sticky left-0 bg-gray-100 z-20 min-w-[180px] border-r border-gray-200">
                    Concepto
                  </th>
                  {data.days.map((day, i) => (
                    <th
                      key={i}
                      className="px-2 py-2 text-center text-xs font-medium text-gray-700 tracking-wider min-w-[95px]"
                    >
                      <div className="font-semibold capitalize">
                        {day.toLocaleDateString("es-ES", { weekday: "long" })}
                      </div>
                      <div className="text-gray-500 font-normal mt-0.5">
                        {day.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {/* ── Entradas ── */}
                {Object.entries(data.rows).some(([, r]) => r.type === "entrada") && (
                  <>
                    <tr className="bg-lime-50">
                      <td
                        colSpan={data.days.length + 1}
                        className="px-3 py-1 text-xs font-bold text-lime-700 uppercase tracking-wider"
                      >
                        Entradas
                      </td>
                    </tr>
                    {Object.entries(data.rows)
                      .filter(([, r]) => r.type === "entrada")
                      .map(([fullName, rowData]) => {
                        const parts = fullName.split(" > ");
                        return (
                          <tr key={`entrada-${fullName}`} className="hover:bg-lime-50/40">
                            <td className="px-3 py-1.5 text-xs sticky left-0 bg-white z-10 border-r border-gray-100">
                              {parts.length === 3 ? (
                                <>
                                  <div className="font-semibold text-gray-900">{parts[2]}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {parts[0]} / {parts[1]}
                                  </div>
                                </>
                              ) : (
                                <span className="font-semibold text-gray-900">{fullName}</span>
                              )}
                            </td>
                            {data.days.map((day, i) => {
                              const cell = rowData.days[getDayKey(day)];
                              const tooltip = cell?.descriptions?.length
                                ? cell.descriptions.join(" / ")
                                : "N/A";
                              return (
                                <td key={i} className="px-2 py-1.5 text-xs text-center">
                                  {cell ? (
                                    <span
                                      className="font-medium text-lime-700 cursor-default"
                                      title={tooltip}
                                    >
                                      {formatCurrency(Number(cell.amount) || 0)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </>
                )}

                {/* ── Salidas ── */}
                {Object.entries(data.rows).some(([, r]) => r.type === "salida") && (
                  <>
                    <tr className="bg-red-50">
                      <td
                        colSpan={data.days.length + 1}
                        className="px-3 py-1 text-xs font-bold text-red-700 uppercase tracking-wider"
                      >
                        Salidas
                      </td>
                    </tr>
                    {Object.entries(data.rows)
                      .filter(([, r]) => r.type === "salida")
                      .map(([fullName, rowData]) => {
                        const parts = fullName.split(" > ");
                        return (
                          <tr key={`salida-${fullName}`} className="hover:bg-red-50/40">
                            <td className="px-3 py-1.5 text-xs sticky left-0 bg-white z-10 border-r border-gray-100">
                              {parts.length === 3 ? (
                                <>
                                  <div className="font-semibold text-gray-900">{parts[2]}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {parts[0]} / {parts[1]}
                                  </div>
                                </>
                              ) : (
                                <span className="font-semibold text-gray-900">{fullName}</span>
                              )}
                            </td>
                            {data.days.map((day, i) => {
                              const cell = rowData.days[getDayKey(day)];
                              const tooltip = cell?.descriptions?.length
                                ? cell.descriptions.join(" / ")
                                : "N/A";
                              return (
                                <td key={i} className="px-2 py-1.5 text-xs text-center">
                                  {cell ? (
                                    <span
                                      className="font-medium text-red-700 cursor-default"
                                      title={tooltip}
                                    >
                                      {formatCurrency(Number(cell.amount) || 0)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                  </>
                )}

                {/* ── Total por día ── */}
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-bold sticky bottom-0">
                  <td className="px-3 py-1.5 text-xs font-bold text-gray-700 sticky left-0 bg-gray-100 z-10 border-r border-gray-200">
                    Total por día
                  </td>
                  {data.days.map((day, i) => {
                    const key = getDayKey(day);
                    const total = Object.values(data.rows).reduce(
                      (sum, rowData) => sum + (rowData.days[key]?.amount || 0),
                      0
                    );
                    return (
                      <td key={i} className="px-2 py-1.5 text-xs text-center font-bold text-gray-800">
                        {total ? formatCurrency(total) : <span className="text-gray-400">—</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl flex-shrink-0">
          <div className="text-xs text-gray-600 text-center">
            Semana {data.weekNumber} &bull; {data.weekRange} &bull;{" "}
            {Object.keys(data.rows).length} concepto(s)
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekDayBreakdownModal;
