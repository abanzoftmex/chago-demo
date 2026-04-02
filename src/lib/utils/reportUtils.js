// Utility functions for reports

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

export const formatCurrencyWithBadge = (amount) => {
  const formatted = formatCurrency(amount);
  if (amount < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-100 text-yellow-900 font-semibold">
        {formatted}
      </span>
    );
  }
  return formatted;
};

export const formatPercentage = (amount, total) => {
  if (total === 0) return "0%";
  const percentage = (amount / total) * 100;
  return `${percentage.toFixed(1)}%`;
};

// Function to calculate tree comparison (for mixed trees - type 'ambos')
export const calculateTreeComparison = (allTransactions, stats, filters, generals, concepts) => {
  if (!allTransactions || allTransactions.length === 0 || !stats || !stats.weeklyBreakdown) {
    return [];
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startDate = filters.startDate ? new Date(filters.startDate) : null;
  const endDate = filters.endDate ? new Date(filters.endDate) : null;

  // Use same weeks already calculated in stats.weeklyBreakdown
  const weeks = stats.weeklyBreakdown.weeks || [];
  
  // Function to get which week a date falls into
  const getWeekInfo = (transactionDate) => {
    const transactionTime = transactionDate.getTime();
    
    // Find corresponding week
    for (let i = 0; i < weeks.length; i++) {
      const week = weeks[i];
      if (transactionTime >= week.startTimestamp && transactionTime <= week.endTimestamp) {
        return {
          weekIndex: i,
          monthWeekOrder: i + 1,
          isoWeekNumber: week.weekNumber,
          startDate: week.startDate,
          endDate: week.endDate,
        };
      }
    }
    return null;
  };

  // STEP 1: Calculate initial carryover (before month) by concept
  const initialCarryoverByTree = {};
  allTransactions.forEach(transaction => {
    const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
    const isBeforeStart = startDate && transactionDate < startDate;
    
    if (isBeforeStart) {
      const treeKey = `${transaction.generalId}|${transaction.conceptId}`;
      if (!initialCarryoverByTree[treeKey]) {
        initialCarryoverByTree[treeKey] = { entradas: 0, salidas: 0 };
      }
      
      const amount = transaction.amount || 0;
      if (transaction.type === 'entrada') {
        initialCarryoverByTree[treeKey].entradas += amount;
      } else if (transaction.type === 'salida') {
        initialCarryoverByTree[treeKey].salidas += amount;
      }
    }
  });

  // STEP 2: Group transactions by week + concept and calculate balance for each week
  const treeMap = {};
  
  allTransactions.forEach(transaction => {
    const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
    const amount = transaction.amount || 0;
    
    const isInPeriod = (!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate);
    const isUntilToday = transactionDate <= today;

    // Only process transactions from queried period
    if (!isInPeriod) return;

    const weekInfo = getWeekInfo(transactionDate);
    if (!weekInfo) return;
    
    // Group by Week + General + Concept (monthWeekOrder = 1..n dentro del mes mostrado)
    const weekKey = weekInfo.monthWeekOrder;
    const treeKey = `${transaction.generalId}|${transaction.conceptId}`;
    const key = `${weekKey}|${treeKey}`;
    
    if (!treeMap[key]) {
      const general = generals.find(g => g.id === transaction.generalId);
      const concept = concepts.find(c => c.id === transaction.conceptId);
      
      treeMap[key] = {
        weekNumber: weekKey,
        isoWeekNumber: weekInfo.isoWeekNumber,
        weekInfo: weekInfo,
        generalId: transaction.generalId,
        generalName: general?.name || 'Sin categoría',
        generalType: general?.type || 'N/A',
        conceptId: transaction.conceptId,
        conceptName: concept?.name || 'Sin concepto',
        conceptType: concept?.type || 'N/A',
        entradas: 0,
        salidas: 0,
        balance: 0,
        transactionCount: 0,
        transactions: [],
        todayEntradas: 0,
        todaySalidas: 0,
        todayBalance: 0,
        hasEntradas: false,
        hasSalidas: false
      };
    }
    
    // Accumulate week transactions
    if (transaction.type === 'entrada') {
      treeMap[key].entradas += amount;
      treeMap[key].hasEntradas = true;
    } else if (transaction.type === 'salida') {
      treeMap[key].salidas += amount;
      treeMap[key].hasSalidas = true;
    }
    treeMap[key].transactionCount++;
    treeMap[key].transactions.push(transaction);
    
    // Balance until today (accumulated until today within this week)
    if (isUntilToday) {
      if (transaction.type === 'entrada') {
        treeMap[key].todayEntradas += amount;
      } else if (transaction.type === 'salida') {
        treeMap[key].todaySalidas += amount;
      }
    }
  });

  // STEP 3: Calculate balances and accumulated carryovers
  Object.values(treeMap).forEach(tree => {
    tree.balance = tree.entradas - tree.salidas;
  });

  // STEP 4: Calculate carryover for each week (accumulated from previous weeks)
  const treeArray = Object.values(treeMap);
  treeArray.forEach(tree => {
    const treeKey = `${tree.generalId}|${tree.conceptId}`;
    const initialCarryover = initialCarryoverByTree[treeKey] || { entradas: 0, salidas: 0 };
    
    if (tree.weekNumber === 1) {
      // First week: carryover is from previous month
      tree.carryover = initialCarryover.entradas - initialCarryover.salidas;
    } else {
      // Later weeks: initial carryover + sum of previous weeks balances
      let accumulatedBalance = initialCarryover.entradas - initialCarryover.salidas;
      
      // Add balances from previous weeks of same concept
      treeArray.forEach(otherTree => {
        if (otherTree.generalId === tree.generalId &&
            otherTree.conceptId === tree.conceptId &&
            otherTree.weekNumber < tree.weekNumber) {
          accumulatedBalance += otherTree.balance;
        }
      });
      
      tree.carryover = accumulatedBalance;
    }
    
    // Today balance = carryover + income until today - expenses until today
    tree.todayBalance = tree.carryover + tree.todayEntradas - tree.todaySalidas;
  });

  // STEP 5: Filter only mixed trees
  const mixedTrees = treeArray.filter(tree => {
    const hasBothTypes = tree.hasEntradas && tree.hasSalidas;
    const isAmbosType = tree.generalType === 'ambos' || tree.conceptType === 'ambos';
    return (hasBothTypes || isAmbosType) && tree.weekNumber > 0;
  });

  // Sort first by week, then by balance
  return mixedTrees.sort((a, b) => {
    if (a.weekNumber !== b.weekNumber) {
      return a.weekNumber - b.weekNumber;
    }
    return Math.abs(b.balance) - Math.abs(a.balance);
  });
};

// Get balance of specific tree by its full name
export const getTreeBalanceByName = (treeString, calculateTreeComparisonFn) => {
  const parts = treeString.split(' > ');
  if (parts.length !== 3) return null;

  const [generalName, conceptName] = parts;

  // Find the tree in calculateTreeComparison
  const trees = calculateTreeComparisonFn();
  const matchingTree = trees.find(tree => 
    tree.generalName === generalName && 
    tree.conceptName === conceptName
  );

  return matchingTree || null;
};

// Check if a tree is of type "ambos"
export const isAmboTree = (treeString, generals) => {
  const parts = treeString.split(' > ');
  if (parts.length < 1) return false;

  const [generalName] = parts;
  const general = generals.find(g => g.name === generalName);
  
  return general?.type === 'ambos';
};

// Shared helpers for week day breakdown feature
export const getDayKey = (date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const parseWeekDate = (dateValue, filters, currentDate) => {
  if (!dateValue) return null;
  if (typeof dateValue === "string" && dateValue.includes("/")) {
    const currentYear = new Date(filters?.startDate || currentDate).getFullYear();
    const [day, month] = dateValue.split("/");
    return new Date(currentYear, parseInt(month) - 1, parseInt(day));
  }
  return dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
};

export const buildProviderNameMap = (providers) => {
  if (!providers?.length) return {};
  return Object.fromEntries(providers.map((p) => [p.id, p.name]));
};

/** Resuelve nombre de proveedor desde catálogo (providerId) o campo embebido providerName. */
export const getTransactionProviderLabel = (transaction, providerNameMap) => {
  if (!transaction) return "Sin proveedor";
  const fromMap =
    transaction.providerId && providerNameMap?.[transaction.providerId];
  if (fromMap) return fromMap;
  const embedded =
    typeof transaction.providerName === "string" && transaction.providerName.trim();
  if (embedded) return transaction.providerName.trim();
  return transaction.type === "entrada" ? "—" : "Sin proveedor";
};
