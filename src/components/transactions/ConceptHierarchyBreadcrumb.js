/** General → Concepto → Subconcepto (tabla / móvil en listados de transacciones) */
export default function ConceptHierarchyBreadcrumb({
  levels,
  lastClassName,
  midClassName,
}) {
  return (
    <div className="flex items-center space-x-1 flex-wrap">
      {levels.map((level, index, array) => (
        <div key={index} className="flex items-center space-x-1">
          <span
            className={
              index === array.length - 1 ? lastClassName : midClassName
            }
          >
            {level}
          </span>
          {index < array.length - 1 && (
            <svg
              className="w-3 h-3 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}
