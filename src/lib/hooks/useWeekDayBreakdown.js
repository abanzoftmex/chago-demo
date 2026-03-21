import { useState } from "react";
import { getDayKey, parseWeekDate } from "../utils/reportUtils";

export function useWeekDayBreakdown({
  transactions,
  generals,
  concepts,
  subconcepts,
  filters,
  currentDate,
  type = null,
}) {
  const [selectedWeekOverview, setSelectedWeekOverview] = useState(null);

  const handleWeekOverviewClick = (week, index) => {
    const startDate = parseWeekDate(week.startDate, filters, currentDate);
    const endDate = parseWeekDate(week.endDate, filters, currentDate);
    if (!startDate || !endDate || isNaN(startDate) || isNaN(endDate)) return;

    // Build array of every calendar day in the week
    const days = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // Build lookup maps once — O(n) instead of O(n×m) find() per transaction
    const generalMap = Object.fromEntries(generals.map((g) => [g.id, g.name]));
    const conceptMap = Object.fromEntries(concepts.map((c) => [c.id, c.name]));
    const subMap = Object.fromEntries(subconcepts.map((s) => [s.id, s.name]));

    // Filter transactions that fall in this week (and optionally by type)
    const weekTransactions = transactions.filter((t) => {
      const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      const inRange =
        tDate.getTime() >= week.startTimestamp &&
        tDate.getTime() <= week.endTimestamp;
      return inRange && (type === null || t.type === type);
    });

    // Group by fullName → dayKey, accumulating amount + descriptions
    const rowsMap = {};
    weekTransactions.forEach((t) => {
      const tDate = t.date?.toDate ? t.date.toDate() : new Date(t.date);
      const dayKey = getDayKey(tDate);
      const fullName = `${generalMap[t.generalId] || "N/A"} > ${conceptMap[t.conceptId] || "N/A"} > ${subMap[t.subconceptId] || "N/A"}`;
      if (!rowsMap[fullName]) {
        rowsMap[fullName] = { type: t.type, days: {} };
      }
      const prev = rowsMap[fullName].days[dayKey] || { amount: 0, descriptions: [] };
      const desc = t.description?.trim() || null;
      rowsMap[fullName].days[dayKey] = {
        amount: prev.amount + (parseFloat(t.amount) || 0),
        descriptions: desc ? [...prev.descriptions, desc] : prev.descriptions,
      };
    });

    setSelectedWeekOverview({
      weekNumber: week.weekNumber || index + 1,
      weekRange: `${week.startDate} - ${week.endDate}`,
      days,
      rows: rowsMap,
    });
  };

  return {
    selectedWeekOverview,
    handleWeekOverviewClick,
    clearWeekOverview: () => setSelectedWeekOverview(null),
  };
}
