# Fix para Duplicación de Gastos Recurrentes

## Problema Identificado

Al crear un gasto marcado como "recurrente", se estaban generando dos transacciones idénticas:
1. Una transacción "Manual" - creada directamente por el usuario
2. Una transacción "Recurrente" - generada automáticamente por el sistema al cargar el dashboard

## Causa del Problema

El flujo problemático era:

1. Usuario crea un gasto con toggle "recurrente" activado ✅
2. Se crea la transacción manual ✅
3. Se crea el registro en `recurringExpenses` con `generatedMonths: []` (vacío) ✅
4. Usuario regresa al dashboard
5. **PROBLEMA**: El dashboard ejecuta `generatePendingTransactions()` automáticamente
6. Como el `generatedMonths` está vacío, genera otra transacción para el mes actual
7. Resultado: Dos transacciones idénticas (una "Manual" y otra "Recurrente")

## Solución Implementada

### 1. Modificación en TransactionForm.js

**Cambio principal**: Al crear un gasto recurrente, se marca inmediatamente el mes actual como "ya generado" en el array `generatedMonths`.

```javascript
// Antes:
await recurringExpenseService.create(recurringData, user);

// Después:
const currentMonth = new Date(year, month, 1);
const currentMonthKey = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth()).padStart(2, '0')}`;
recurringData.generatedMonths = [currentMonthKey]; // Marcar mes actual como generado

const recurringExpense = await recurringExpenseService.create(recurringData, user);

// Actualizar la transacción manual para marcarla como recurrente
await transactionService.update(result.id, {
  description: `${formData.description} (Recurrente)`,
  isRecurring: true,
  recurringExpenseId: recurringExpense.id
}, user);
```

### 2. Modificación en recurringExpenseService.js

**Cambio**: El método `create` ahora acepta el campo `generatedMonths` desde los datos de entrada.

```javascript
// Antes:
generatedMonths: [], // Siempre vacío

// Después:
generatedMonths: expenseData.generatedMonths || [], // Usar el array proporcionado o vacío
```

## Funcionamiento Actual

1. **Usuario crea gasto recurrente**:
   - Se crea la transacción manual
   - Se crea el registro de gasto recurrente con `generatedMonths: ["2025-08"]` (mes actual)
   - Se actualiza la transacción para marcarla como recurrente y agregar "(Recurrente)" a la descripción

2. **Dashboard se carga**:
   - `generatePendingTransactions()` ve que el mes actual ya está en `generatedMonths`
   - **NO** genera una nueva transacción
   - No hay duplicación

3. **Próximos meses**:
   - El sistema generará automáticamente nuevas transacciones solo para meses que no estén en `generatedMonths`

## Ventajas de la Solución

1. **Elimina duplicación**: No se crean transacciones duplicadas al crear un gasto recurrente
2. **Consistencia**: Todas las transacciones recurrentes (manual inicial + automáticas) tienen la misma estructura
3. **Rastreabilidad**: Todas están marcadas con `isRecurring: true` y `recurringExpenseId`
4. **Descripción uniforme**: Todas incluyen "(Recurrente)" en la descripción
5. **Retrocompatible**: No afecta gastos recurrentes existentes

## Archivos Modificados

- ✅ `src/components/forms/TransactionForm.js`
- ✅ `src/lib/services/recurringExpenseService.js`

## Validación

Para validar que funciona:

1. Crear un nuevo gasto marcado como "recurrente"
2. Verificar que aparece solo UNA transacción con "(Recurrente)" en la descripción
3. Ir al dashboard múltiples veces
4. Confirmar que no se genera una segunda transacción
5. Esperar al próximo mes para verificar que se genere automáticamente la nueva transacción

## Ejemplo de Comportamiento

### Septiembre 2025 (creación inicial):
- Usuario crea gasto recurrente "CASA CLUB - Arcos de Oriente SA de CV - $5,000"
- Se genera: 1 transacción "CASA CLUB (Recurrente)" marcada como recurrente
- `generatedMonths: ["2025-08"]`

### Octubre 2025 (automático):
- Sistema detecta que "2025-09" no está en `generatedMonths`
- Genera automáticamente: 1 transacción "CASA CLUB (Recurrente)"
- Actualiza `generatedMonths: ["2025-08", "2025-09"]`

### Dashboard (cualquier momento):
- No genera transacciones adicionales porque los meses ya están registrados
