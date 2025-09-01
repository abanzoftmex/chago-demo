// Test script to verify email rate limiting functionality
// This script simulates multiple email sends to ensure delays are working

const { sendEmailWithRateLimit, sleep } = require('./src/lib/utils');

// Mock fetch function for testing
global.fetch = async (url, options) => {
  console.log(`Mock email sent to: ${JSON.parse(options.body).to} at ${new Date().toISOString()}`);
  return { ok: true };
};

async function testEmailRateLimit() {
  console.log('Testing email rate limiting...\n');
  
  const emails = [
    'test1@example.com',
    'test2@example.com', 
    'test3@example.com',
    'test4@example.com',
    'test5@example.com'
  ];
  
  const startTime = Date.now();
  
  console.log('Sending emails rapidly (should be rate limited):');
  
  for (let i = 0; i < emails.length; i++) {
    const emailStartTime = Date.now();
    
    try {
      await sendEmailWithRateLimit(
        emails[i],
        'Test Subject',
        '<h1>Test Email</h1>'
      );
      
      const emailEndTime = Date.now();
      const timeSinceStart = emailEndTime - startTime;
      const emailDuration = emailEndTime - emailStartTime;
      
      console.log(`Email ${i + 1}: ${emails[i]} - Duration: ${emailDuration}ms - Total time: ${timeSinceStart}ms`);
      
    } catch (error) {
      console.error(`Error sending email ${i + 1}:`, error);
    }
  }
  
  const totalTime = Date.now() - startTime;
  console.log(`\nTotal time for ${emails.length} emails: ${totalTime}ms`);
  console.log(`Expected minimum time (${emails.length - 1} * 500ms): ${(emails.length - 1) * 500}ms`);
  console.log(`Rate limiting is ${totalTime >= (emails.length - 1) * 500 ? 'WORKING' : 'NOT WORKING'}`);
}

// Run the test
testEmailRateLimit().catch(console.error);
