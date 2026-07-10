/**
 * Jerarquía de concepto en dos filas (tabla / móvil en listados de transacciones):
 *   Fila 1: subconcepto — o el nivel más específico disponible — en negrita
 *   Fila 2: General / Concepto (peso normal, atenuado)
 *
 * `levels` es el arreglo ordenado de lo más general a lo más específico
 * (p. ej. [General, Concepto, Subconcepto]); cualquier nivel puede faltar.
 */
export default function ConceptHierarchyStacked({ levels }) {
  const clean = (levels || []).filter(Boolean);

  if (clean.length === 0) {
    return <span className="text-sm text-muted-foreground">N/A</span>;
  }

  // El nivel más específico va en negrita en la primera fila;
  // los niveles superiores van en la segunda fila.
  const primary = clean[clean.length - 1];
  const secondary = clean.slice(0, -1);

  return (
    <div className="leading-tight">
      <div className="text-xs font-bold text-foreground">{primary}</div>
      {secondary.length > 0 && (
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {secondary.join(" / ")}
        </div>
      )}
    </div>
  );
}
