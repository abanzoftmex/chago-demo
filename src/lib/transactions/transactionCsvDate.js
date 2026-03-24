/**
 * Fechas para CSV de transacciones: exportación sin ambigüedad e importación día/mes/año (México).
 * Evita `new Date("dd/mm/yy")`, que en JS suele interpretarse como mm/dd/yy (EE.UU.).
 */

/**
 * Timestamp Firestore, Date u objeto serializable → YYYY-MM-DD en calendario local.
 */
export function formatDateIsoLocal(date) {
  if (!date) return "";
  const dateObj = date.toDate ? date.toDate() : new Date(date);
  if (Number.isNaN(dateObj.getTime())) return "";
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Año de 2 dígitos: 70–99 → 19xx, 00–69 → 20xx */
function expandTwoDigitYear(y) {
  if (y >= 100) return y;
  return y >= 70 ? 1900 + y : 2000 + y;
}

function buildLocalDate(day, month, year) {
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

/**
 * Columna Fecha del CSV: prioridad ISO; barras y guiones como día/mes/año (México).
 */
export function parseTransactionCsvDate(dateString) {
  const s = String(dateString || "").trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    return buildLocalDate(day, month, year);
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return buildLocalDate(
      parseInt(m[1], 10),
      parseInt(m[2], 10),
      parseInt(m[3], 10)
    );
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = expandTwoDigitYear(parseInt(m[3], 10));
    return buildLocalDate(day, month, year);
  }

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    return buildLocalDate(
      parseInt(m[1], 10),
      parseInt(m[2], 10),
      parseInt(m[3], 10)
    );
  }

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = expandTwoDigitYear(parseInt(m[3], 10));
    return buildLocalDate(day, month, year);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const dt = new Date(s);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}
