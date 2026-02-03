// Application constants
export const TRANSACTION_TYPES = {
  ENTRADA: 'entrada',
  SALIDA: 'salida'
};

export const PAYMENT_STATUS = {
  PENDIENTE: 'pendiente',
  PARCIAL: 'parcial',
  PAGADO: 'pagado'
};

export const FILE_TYPES = {
  ACCEPTED: ['image/jpeg', 'image/png', 'application/pdf'],
  MAX_SIZE: 5 * 1024 * 1024 // 5MB
};

export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/admin/dashboard',
  ENTRADAS: '/admin/entradas',
  SALIDAS: '/admin/salidas',
  HISTORIAL: '/admin/historial',
  PROVEEDORES: '/admin/proveedores',
  CONCEPTOS: '/admin/conceptos',
  REPORTES: '/admin/reportes'
};

// Color scheme for different transaction types
export const TRANSACTION_COLORS = {
  // Regular gastos (salidas) - Standard red
  GASTOS: {
    primary: '#EF4444', // red-500
    background: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200'
  },
  // Gastos recurrentes - Light red variants
  GASTOS_RECURRENTES: {
    primary: '#FB7185', // rose-400 (lighter)
    background: 'bg-rose-50',
    text: 'text-rose-400',
    border: 'border-rose-200',
    gradient: 'from-rose-50 to-pink-50'
  },
  // Ingresos (entradas) - Green
  INGRESOS: {
    primary: '#10B981', // emerald-500
    background: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-200'
  }
};

// Chart colors - Red and Gray alternating scheme
export const CHART_COLORS = {
  PRIMARY_ORANGE: 'rgba(220, 38, 38, 0.8)',     // red-600
  SECONDARY_GRAY: 'rgba(107, 114, 128, 0.8)',    // gray-500
  PRIMARY_ORANGE_SOLID: 'rgb(220, 38, 38)',     // red-600 solid
  SECONDARY_GRAY_SOLID: 'rgb(107, 114, 128)',    // gray-500 solid
  PRIMARY_ORANGE_LIGHT: 'rgba(220, 38, 38, 0.1)', // red-600 light
  SECONDARY_GRAY_LIGHT: 'rgba(107, 114, 128, 0.1)', // gray-500 light
  
  // Function to generate alternating colors
  generateAlternating: (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      colors.push(i % 2 === 0 ? 'rgba(220, 38, 38, 0.8)' : 'rgba(107, 114, 128, 0.8)');
    }
    return colors;
  }
};