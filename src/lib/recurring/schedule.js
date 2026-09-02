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
