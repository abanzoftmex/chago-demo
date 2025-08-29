/**
 * Email templates for the application
 * This file contains reusable email templates with modern design
 */

/**
 * Formats a number as currency with thousand separators and 2 decimal places
 * @param {number|string} amount - The amount to format
 * @returns {string} Formatted currency string
 */
const formatCurrency = (amount) => {
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  return number.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Creates a modern, premium email template with logo and styling
 * @param {Object} options - Template options
 * @param {string} options.title - Email title
 * @param {string} options.content - Email content (HTML)
 * @param {string} options.footerText - Optional footer text
 * @returns {string} Complete HTML email template
 */
export const createEmailTemplate = ({ title, content, footerText }) => {
  // Base URL for assets (must be absolute for email clients)
  const resolvedBase =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BASE_URL) ||
    (typeof window !== 'undefined' ? window.location.origin : '') ||
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : '');
  const baseUrl = resolvedBase ? resolvedBase.replace(/\/$/, '') : '';
  // Use the absolute URL to the logo in the public directory
  const logoUrl = `${baseUrl}/logo-santi.png`;
  
  // Default footer text if not provided
  const defaultFooter = 'Este es un correo automático. Por favor no responda a este mensaje.';
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        /* Base styles */
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        
        /* Container */
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
        }
        
        /* Header */
        .email-header {
          background-color: #FF6B00;
          padding: 20px 30px;
          text-align: center;
        }
        
        .email-header img {
          max-height: 60px;
          width: auto;
          display: block;
          margin: 0 auto;
        }
        
        /* Content */
        .email-content {
          padding: 30px;
        }
        
        .email-title {
          color: #FF6B00;
          font-size: 24px;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 20px;
          text-align: center;
        }
        
        /* Data display */
        .data-container {
          background-color: #f9f9f9;
          border-radius: 6px;
          padding: 20px;
          margin-bottom: 20px;
        }
        
        .data-list {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }
        
        .data-list li {
          padding: 10px 0;
          border-bottom: 1px solid #eeeeee;
        }
        
        .data-list li:last-child {
          border-bottom: none;
        }
        
        .data-list strong {
          color: #555555;
          display: inline-block;
          min-width: 120px;
        }
        
        /* Links */
        a {
          color: #FF6B00;
          text-decoration: none;
        }
        
        a:hover {
          text-decoration: underline;
        }
        
        .button {
          display: inline-block;
          background-color: #FF6B00;
          color: white !important;
          padding: 12px 24px;
          border-radius: 4px;
          font-weight: 600;
          margin: 20px 0;
          text-decoration: none;
        }
        
        .button:hover {
          background-color: #E05A00;
        }
        
        /* Footer */
        .email-footer {
          background-color: #f5f5f5;
          padding: 20px 30px;
          text-align: center;
          color: #777777;
          font-size: 14px;
        }
        
        /* Responsive */
        @media screen and (max-width: 600px) {
          .email-container {
            width: 100% !important;
            border-radius: 0;
          }
          
          .email-header, .email-content, .email-footer {
            padding: 15px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <img src="${logoUrl}" alt="Logo" style="max-height: 60px; width: auto; display: block; margin: 0 auto;">
        </div>
        
        <div class="email-content">
          <h1 class="email-title">${title}</h1>
          ${content}
        </div>
        
        <div class="email-footer">
          ${footerText || defaultFooter}
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Creates HTML content for payment receipt emails
 * @param {Object} data - Payment data
 * @returns {string} HTML content
 */
export const createPaymentReceiptContent = ({
  amount,
  date,
  conceptName,
  providerDetails,
  totalAmount,
  totalPaid,
  remainingBalance,
  txId,
  notesHtml,
  detailUrl,
  linksHtml
}) => {
  return `
    <p>Se ha registrado un nuevo pago:</p>
    
    <div class="data-container">
      <ul class="data-list">
        <li><strong>Monto del pago:</strong> $${formatCurrency(amount)}</li>
        <li><strong>Fecha del pago:</strong> ${date}</li>
        <li><strong>Concepto:</strong> ${conceptName}</li>
        ${providerDetails || ''}
        <li><strong>Monto total:</strong> $${formatCurrency(totalAmount)}</li>
        <li><strong>Total pagado:</strong> $${formatCurrency(totalPaid)}</li>
        <li><strong>Saldo restante:</strong> $${formatCurrency(remainingBalance)}</li>
        ${txId ? `<li><strong>ID de Transacción:</strong> ${txId}</li>` : ""}
      </ul>
    </div>
    
    ${notesHtml || ''}
    
    ${detailUrl ? `<p><a href="${detailUrl}" class="button">Ver detalle de la transacción</a></p>` : ""}
    
    ${linksHtml || ''}
  `;
};

/**
 * Creates HTML content for expense notification emails
 * @param {Object} data - Expense data
 * @returns {string} HTML content
 */
export const createExpenseNotificationContent = ({
  amount,
  date,
  conceptName,
  descriptionName, // Backwards-compat: previously used to carry description/now subconcept
  providerInfo,
  divisionInfo,
  txId,
  detailUrl,
  // New optional fields to support updated structure
  generalName,
  subconceptName,
  freeDescription
}) => {
  return `
    <p>Se ha registrado un nuevo gasto que requiere ser cubierto:</p>
    
    <div class="data-container">
      <ul class="data-list">
        <li><strong>Monto:</strong> $${formatCurrency(amount)}</li>
        <li><strong>Fecha:</strong> ${date}</li>
        ${generalName ? `<li><strong>General:</strong> ${generalName}</li>` : ""}
        <li><strong>Concepto:</strong> ${conceptName}</li>
        ${subconceptName || descriptionName ? `<li><strong>Subconcepto:</strong> ${subconceptName || descriptionName}</li>` : ""}
        ${freeDescription ? `<li><strong>Descripción:</strong> ${freeDescription}</li>` : ""}
        ${providerInfo || ''}
        ${divisionInfo || ''}
        <li><strong>ID de Transacción:</strong> ${txId}</li>
      </ul>
    </div>
    
    ${detailUrl ? `<p><a href="${detailUrl}" class="button">Ver detalle de la transacción</a></p>` : ""}
  `;
};

/**
 * Creates HTML content for admin payment notification emails
 * @param {Object} data - Payment notification data
 * @returns {string} HTML content
 */
export const createAdminPaymentNotificationContent = ({
  amount,
  date,
  conceptName,
  providerDetails,
  totalAmount,
  totalPaid,
  remainingBalance,
  txId,
  notesHtml,
  detailUrl
}) => {
  return `
    <p>Se ha registrado un nuevo pago en el sistema:</p>
    
    <div class="data-container">
      <ul class="data-list">
        <li><strong>Monto del pago:</strong> $${formatCurrency(amount)}</li>
        <li><strong>Fecha del pago:</strong> ${date}</li>
        <li><strong>Concepto:</strong> ${conceptName}</li>
        ${providerDetails || ''}
        <li><strong>Monto total:</strong> $${formatCurrency(totalAmount)}</li>
        <li><strong>Total pagado:</strong> $${formatCurrency(totalPaid)}</li>
        <li><strong>Saldo restante:</strong> $${formatCurrency(remainingBalance)}</li>
        ${txId ? `<li><strong>ID de Transacción:</strong> ${txId}</li>` : ""}
      </ul>
    </div>
    
    ${notesHtml || ''}
    
    ${detailUrl ? `<p><a href="${detailUrl}" class="button">Ver detalle de la transacción</a></p>` : ""}
  `;
};