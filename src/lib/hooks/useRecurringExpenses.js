import { useState, useEffect } from 'react';
import { recurringExpenseService } from '../services/recurringExpenseService';

export const useRecurringExpenses = () => {
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRecurringExpenses = async () => {
    try {
      setLoading(true);
      setError(null);
      const expenses = await recurringExpenseService.getAll({ isActive: true });
      setRecurringExpenses(expenses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecurringExpenses();
  }, []);

  // Check if there are expenses that need to be generated for next month
  const checkPendingGeneration = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    return recurringExpenses.filter(expense => {
      if (!expense.isActive) return false;
      
      const lastGenerated = expense.lastGenerated?.toDate();
      
      // If never generated, or last generated is not for next month
      return !lastGenerated || 
        lastGenerated.getMonth() !== nextMonth.getMonth() || 
        lastGenerated.getFullYear() !== nextMonth.getFullYear();
    });
  };

  const pendingExpenses = checkPendingGeneration();
  const hasPendingGeneration = pendingExpenses.length > 0;

  return {
    recurringExpenses,
    loading,
    error,
    hasPendingGeneration,
    pendingExpenses,
    refetch: loadRecurringExpenses
  };
};