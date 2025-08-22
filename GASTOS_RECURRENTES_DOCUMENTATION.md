# Documentación: Gastos Recurrentes

## Descripción General

La funcionalidad de gastos recurrentes permite automatizar la creación de transacciones de gasto que se repiten mensualmente. Cuando se marca un gasto como "recurrente", el sistema automáticamente genera una nueva transacción pendiente cada mes.

## Características Principales

### 1. Toggle de Gastos Recurrentes
- **Ubicación**: Formulario de creación de gastos (`/admin/transacciones/salidas`)
- **Funcionalidad**: Toggle que permite marcar un gasto como recurrente
- **Restricción**: Solo disponible para gastos nuevos (no para edición)

### 2. Gestión de Gastos Recurrentes
- **Página**: `/admin/transacciones/recurrentes`
- **Funciones**:
  - Ver todos los gastos recurrentes (activos e inactivos)
  - Activar/desactivar gastos recurrentes
  - Eliminar gastos recurrentes
  - Generar manualmente transacciones para el próximo mes
  - Buscar y filtrar gastos recurrentes

### 3. Generación Automática
- **Frecuencia**: Mensual (primer día de cada mes)
- **Estado**: Las transacciones generadas aparecen como "pendientes"
- **Descripción**: Se agrega "(Recurrente)" al final de la descripción original

### 4. Notificaciones y Alertas
- **Dashboard**: Alerta visual cuando hay gastos pendientes de generar
- **Sidebar**: Indicador numérico en el menú de "Gastos Recurrentes"
- **Funcionalidad**: Botón para generar inmediatamente desde el dashboard

## Estructura de Datos

### Tabla: `recurringExpenses`
```javascript
{
  id: string,
  generalId: string,
  conceptId: string,
  subconceptId: string,
  description: string,
  amount: number,
  providerId: string,
  division: string,
  isActive: boolean,
  lastGenerated: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Campos Adicionales en Transacciones
```javascript
{
  isRecurring: boolean,           // Indica si la transacción proviene de un gasto recurrente
  recurringExpenseId: string     // ID del gasto recurrente que la generó
}
```

## Flujo de Trabajo

### 1. Creación de Gasto Recurrente
1. Usuario crea un nuevo gasto en `/admin/transacciones/salidas`
2. Activa el toggle "Gasto Recurrente"
3. Completa el formulario normalmente
4. Al guardar:
   - Se crea la transacción normal
   - Se crea un registro en `recurringExpenses`
   - Se muestra confirmación de configuración

### 2. Generación Automática (Cron Job)
1. El primer día de cada mes se ejecuta el cron job
2. Se buscan todos los gastos recurrentes activos
3. Para cada gasto:
   - Se verifica si ya se generó para el mes actual
   - Si no, se crea una nueva transacción pendiente
   - Se actualiza `lastGenerated`

### 3. Generación Manual
1. Usuario ve alerta en dashboard o va a gastos recurrentes
2. Hace clic en "Generar Próximo Mes"
3. Se ejecuta la misma lógica que el cron job
4. Se muestran las transacciones generadas

## APIs y Endpoints

### `/api/recurring-expenses/generate`
- **Método**: POST
- **Autenticación**: Bearer token
- **Función**: Generar transacciones pendientes manualmente

### `/api/cron/generate-recurring`
- **Método**: POST
- **Autenticación**: Secret key en headers
- **Función**: Endpoint para cron job automático
- **Restricción**: Solo se ejecuta el primer día del mes

## Configuración de Cron Job

### Para Vercel
Agregar a `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/generate-recurring",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

### Para otros proveedores
Configurar cron job que ejecute:
```bash
curl -X POST https://tu-dominio.com/api/cron/generate-recurring \
  -H "Authorization: Bearer tu-clave-secreta"
```

## Permisos y Seguridad

### Permisos Requeridos
- **Ver gastos recurrentes**: `canManageTransactions`
- **Crear gastos recurrentes**: `canManageTransactions`
- **Generar transacciones**: `canManageTransactions`

### Variables de Entorno
```env
CRON_SECRET=tu-clave-secreta-para-cron
```

## Componentes Principales

### Servicios
- `recurringExpenseService.js`: Lógica de negocio para gastos recurrentes
- `transactionService.js`: Modificado para soportar campos adicionales

### Componentes UI
- `TransactionForm.js`: Modificado con toggle de gastos recurrentes
- `RecurringExpenseAlert.js`: Alerta en dashboard
- `useRecurringExpenses.js`: Hook personalizado para estado

### Páginas
- `/admin/transacciones/recurrentes.js`: Gestión de gastos recurrentes
- `/admin/transacciones/salidas.js`: Modificado con funcionalidad recurrente

## Casos de Uso

### 1. Gastos Fijos Mensuales
- Renta de oficina
- Servicios (luz, agua, internet)
- Salarios base
- Seguros

### 2. Gastos Variables Recurrentes
- Mantenimiento mensual
- Suministros regulares
- Servicios profesionales

### 3. Gastos Estacionales
- Se pueden desactivar temporalmente
- Reactivar cuando sea necesario

## Monitoreo y Mantenimiento

### Logs
- Generación automática se registra en logs del servidor
- Errores se capturan y reportan
- Métricas de transacciones generadas

### Alertas
- Dashboard muestra gastos pendientes
- Notificaciones visuales en sidebar
- Posibilidad de generar manualmente si falla automático

## Limitaciones Actuales

1. **Frecuencia**: Solo mensual (no semanal, trimestral, etc.)
2. **Fecha fija**: Siempre el primer día del mes
3. **Edición**: No se pueden editar gastos recurrentes existentes
4. **Historial**: No hay historial de generaciones anteriores

## Futuras Mejoras

1. **Múltiples frecuencias**: Semanal, quincenal, trimestral, anual
2. **Fechas personalizadas**: Elegir día específico del mes
3. **Edición de recurrentes**: Modificar gastos recurrentes existentes
4. **Historial**: Ver todas las transacciones generadas por cada recurrente
5. **Notificaciones por email**: Alertas automáticas de generación
6. **Plantillas**: Crear plantillas de gastos recurrentes comunes