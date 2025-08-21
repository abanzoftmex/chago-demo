// Export all services for easier imports
export { transactionService } from './transactionService';
export { providerService } from './providerService';
export { generalService } from './generalService';
export { conceptService } from './conceptService';
export { descriptionService } from './descriptionService';
export { subconceptService } from './subconceptService';
export { paymentService } from './paymentService';
export { aiAnalysisService } from './aiAnalysisService';
export { logService } from './logService';

// Service utilities
export const serviceUtils = {
  // Format currency for display
  formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  },

  // Format date for display
  formatDate(date) {
    if (!date) return '';
    
    // Handle Firestore timestamp
    if (date.toDate) {
      date = date.toDate();
    }
    
    return new Intl.DateTimeFormat('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  },

  // Format date for input fields
  formatDateForInput(date) {
    if (!date) return '';
    
    // Handle Firestore timestamp
    if (date.toDate) {
      date = date.toDate();
    }
    
    return date.toISOString().split('T')[0];
  },

  // Parse date from input
  parseDateFromInput(dateString) {
    if (!dateString) return null;
    return new Date(dateString);
  },

  // Get file extension from filename
  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  },

  // Get file icon based on type
  getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
      return '🖼️';
    } else if (fileType === 'application/pdf') {
      return '📄';
    }
    return '📎';
  },

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // Generate unique ID (fallback if needed)
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Debounce function for search inputs
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
};