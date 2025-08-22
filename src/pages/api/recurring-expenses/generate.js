import { recurringExpenseService } from "../../../lib/services/recurringExpenseService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // This would typically be called by a cron job or scheduled task
    // For now, we'll allow manual triggering with proper authentication
    
    const { authorization } = req.headers;
    
    // Basic security check - in production, implement proper API key validation
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Generate pending transactions for next month
    const generatedTransactions = await recurringExpenseService.generatePendingTransactions({
      uid: 'system', // System user for automated generation
      email: 'system@santiago-fc.com'
    });

    res.status(200).json({
      success: true,
      message: `Generated ${generatedTransactions.length} pending transactions`,
      transactions: generatedTransactions
    });

  } catch (error) {
    console.error('Error generating recurring transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recurring transactions',
      error: error.message
    });
  }
}