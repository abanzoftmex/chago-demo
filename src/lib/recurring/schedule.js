/**
 * Cuándo toca generar una transacción recurrente.
 *
 * Vive aparte y sin ninguna dependencia de Firestore porque lo necesitan los
 * dos lados: el servicio del navegador (`recurringExpenseService`) y el del
 * servidor (`lib/server/recurringServer`), que usa el Admin SDK. Tener la
 * regla escrita dos veces era garantizar que acabaran discrepando, y que un
 * gasto se generara o dejara de generarse según quién lo pidiera.
 */

/**
 * Ahora mismo, en la zona horaria del negocio.
 *
 * El reloj del servidor en Vercel es UTC, así que a partir de las 18:00 hora
 * de México ya sería el día siguiente: los recurrentes mensuales se generarían
 * un día antes de tiempo.
 */
export function getMexicoDate() {
  const now = new Date();
  const mexicoDateStr = now.toLocaleString("en-US", { timeZone: "America/Mexico_City" });
  return new Date(mexicoDateStr);
}

/** 'YYYY-MM-DD' — la llave con la que se registra lo ya generado. */
export function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * ¿Toca generar en `currentDate`?
 *
 * Lo primero que se comprueba es si ya se generó para esa fecha exacta: es lo
 * que hace que ejecutar el cron dos veces el mismo día no duplique nada.
 */
export function shouldGenerateForDate(currentDate, frequency, generatedDates, startDate) {
  const dateKey = formatDateKey(currentDate);

  if (generatedDates.includes(dateKey)) return false;

  switch (frequency) {
    case "daily":
      return true;

    case "weekly":
      // Los lunes (domingo = 0).
      return currentDate.getDay() === 1;

    case "biweekly": {
      // El 15 y el penúltimo día del mes.
      const day = currentDate.getDate();
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      return day === 15 || day === lastDayOfMonth - 1;
    }

    case "monthly":
      // SIEMPRE el día 1, sin importar cuántos días tuviera el mes anterior.
      return currentDate.getDate() === 1;

    default:
      return false;
  }
}

/** `startDate` puede venir como Timestamp de Firestore, Date o string. */
export function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  return new Date(value);
}

/**
 * Próxima fecha REAL de generación para un recurrente MENSUAL (día 1), usada solo
 * como preview en el formulario. Vive aquí para no divergir de la regla de
 * `shouldGenerateForDate` (mensual = día 1) y de la compuerta de `startDate`.
 *
 * Es el primer día 1 que cae en/después de `startDate` y de hoy (no se rellena el
 * pasado). Si el inicio ya es día 1, es ese mismo día; si no, el 1 del mes siguiente.
 */
export function nextMonthlyGenerationDate(startDate, fromDate = getMexicoDate()) {
  const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = atMidnight(fromDate);
  const start = startDate ? atMidnight(startDate) : today;
  const base = start > today ? start : today;
  return base.getDate() === 1
    ? base
    : new Date(base.getFullYear(), base.getMonth() + 1, 1);
}

/**
 * Días 1 (MENSUAL) que ya ocurrieron y deben generarse de una vez al CREAR un
 * recurrente con inicio en el pasado ("backfill"): desde `startDate` hasta hoy,
 * incluyendo el día 1 del mes en curso si ya pasó. Con un TOPE de `capMonths`
 * (1 año) hacia atrás para no generar cientos. Excluye las ya generadas.
 *
 * Comparte la regla mensual (día 1) y las utilidades de fecha con el resto del
 * módulo para no divergir de la generación real.
 */
export function monthlyBackfillDates(startDate, generatedDates = [], fromDate = getMexicoDate(), capMonths = 12) {
  if (!startDate) return [];
  const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = atMidnight(fromDate);
  const start = atMidnight(startDate);
  // Tope: no más de `capMonths` hacia atrás desde hoy.
  const cap = new Date(today.getFullYear(), today.getMonth() - capMonths, today.getDate());
  const lower = start > cap ? start : cap;
  // Primer día 1 en/después del límite inferior.
  let d =
    lower.getDate() === 1
      ? new Date(lower.getFullYear(), lower.getMonth(), 1)
      : new Date(lower.getFullYear(), lower.getMonth() + 1, 1);
  const already = new Set(generatedDates);
  const out = [];
  while (d <= today) {
    if (!already.has(formatDateKey(d))) out.push(new Date(d));
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return out;
}
