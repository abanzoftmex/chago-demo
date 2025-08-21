// Utility functions for the application

/**
 * Format currency amount
 * @param {number} amount 
 * @returns {string}
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

/**
 * Format date
 * @param {Date|string} date 
 * @returns {string}
 */
export const formatDate = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(dateObj);
};

/**
 * Format date for input fields
 * @param {Date|string} date 
 * @returns {string}
 */
export const formatDateForInput = (date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toISOString().split('T')[0];
};

/**
 * Validate file type and size
 * @param {File} file 
 * @param {Array} acceptedTypes 
 * @param {number} maxSize 
 * @returns {Object}
 */
export const validateFile = (file, acceptedTypes, maxSize) => {
  const errors = [];
  
  if (!acceptedTypes.includes(file.type)) {
    errors.push('Tipo de archivo no permitido');
  }
  
  if (file.size > maxSize) {
    errors.push('El archivo es demasiado grande');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate unique ID
 * @returns {string}
 */
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

/**
 * Debounce function
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};