import { recurringExpenseService } from "../../../lib/services/recurringExpenseService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Verify the request is coming from a trusted source
    const { authorization } = req.headers;
    const cronSecret = process.env.CRON_SECRET || 'your-secret-key';
    
    if (!authorization || authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if it's the first day of the month
    const today = new Date();
    const isFirstDayOfMonth = today.getDate() === 1;
    
    if (!isFirstDayOfMonth) {
      return res.status(200).json({
        success: true,
        message: 'Not the first day of the month, skipping generation',
        transactions: []
      });
    }

    // Generate pending transactions for this month
    const generatedTransactions = await recurringExpenseService.generatePendingTransactions({
      uid: 'system-cron',
      email: 'system@santiago-fc.com'
    });

    // Log the generation for monitoring
    console.log(`[CRON] Generated ${generatedTransactions.length} recurring transactions on ${today.toISOString()}`);

    res.status(200).json({
      success: true,
      message: `Generated ${generatedTransactions.length} recurring transactions`,
      transactions: generatedTransactions,
      date: today.toISOString()
    });

  } catch (error) {
    console.error('[CRON] Error generating recurring transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recurring transactions',
      error: error.message
    });
  }
}

// Example cron job setup (add to your deployment platform):
// 
// For Vercel, add to vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron/generate-recurring",
//       "schedule": "0 0 1 * *"
//     }
//   ]
// }
//
// For other platforms, set up a cron job to call:
// curl -X POST https://your-domain.com/api/cron/generate-recurring \
//   -H "Authorization: Bearer your-secret-key"