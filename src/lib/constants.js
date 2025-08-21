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