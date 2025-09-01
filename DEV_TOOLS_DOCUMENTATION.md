# Herramientas de Desarrollo - Eliminación Masiva de Transacciones

## Descripción

Se ha agregado una nueva funcionalidad para eliminar todas las transacciones de un mes específico. Esta herramienta es útil durante el desarrollo y testing para limpiar datos de prueba o resetear un mes completo.

## Característicasaa

### 🔒 Seguridada
- **Solo disponible en desarrollo**: La funcionalidad está completamente deshabilitada en produccióna
- **Confirmación doble**: Requiere escribir "BORRAR" para confirmar la acción
- **Logs detallados**: Todas las eliminaciones se registran en el sistema de logs

### 🎯 Funcionalidad
- Elimina todas las transacciones de un mes y año específico
- Muestra el progreso en tiempo real
- Maneja errores individualmente por transacción
- Proporciona estadísticas detalladas del proceso

## Ubicación

**Menú:** Configuración > Dev Tools > Eliminar Transacciones por Mes

**URL:** `/admin/configuracion/dev-tools`

**Nota:** Solo visible en entorno de desarrollo

## Archivos Creados/Modificados

### Nuevos Archivos
- ✅ `src/components/admin/DeleteTransactionsModal.js` - Modal de confirmación
- ✅ `src/pages/admin/configuracion/dev-tools.js` - Página principal de herramientas
- ✅ `src/pages/api/dev/delete-transactions-by-month.js` - Endpoint API

### Archivos Modificados
- ✅ `src/lib/services/transactionService.js` - Método `deleteTransactionsByMonth`
- ✅ `src/components/layout/Sidebar.js` - Entrada de menú (solo en dev)
- ✅ `src/lib/stores/sidebarStore.js` - Auto-expand para nuevas rutas

## Proceso de Eliminación

### 1. Selección de Mes
- El usuario selecciona año y mes mediante selectores
- Rango de años: 2020-2030
- Todos los meses disponibles

### 2. Confirmación
- Debe escribir exactamente "BORRAR" (mayúsculas)
- Se muestra información del mes seleccionado
- Advertencias de seguridad visibles

### 3. Eliminación
- Se obtienen todas las transacciones del mes
- Se eliminan una por una con manejo individual de errores
- Progreso mostrado en tiempo real

### 4. Reporte
- Número total de transacciones encontradas
- Número de transacciones eliminadas exitosamente
- Lista de errores (si los hay)
- Log detallado en la consola

## Estructura del Modal

### Estados
- **Inicial**: Selección de mes y confirmación
- **Procesando**: Indicador de carga durante eliminación
- **Completado**: Cierre automático con mensaje de éxito/error

### Validaciones
- Mes seleccionado obligatorio
- Texto de confirmación exacto
- Validación de rangos de año/mes

## API Endpoint

### `/api/dev/delete-transactions-by-month`

**Método:** POST

**Body:**
```json
{
  "year": 2024,
  "month": 7,  // 0-11 (enero-diciembre)
  "user": {
    "uid": "user-id",
    "email": "user@example.com"
  }
}
```

**Respuesta Exitosa:**
```json
{
  "success": true,
  "message": "Se eliminaron 15 de 15 transacciones",
  "data": {
    "deletedCount": 15,
    "totalFound": 15,
    "errors": []
  }
}
```

**Respuesta con Errores:**
```json
{
  "success": true,
  "message": "Se eliminaron 12 de 15 transacciones",
  "data": {
    "deletedCount": 12,
    "totalFound": 15,
    "errors": [
      "Error deleting transaction xyz: Permission denied",
      "Error deleting transaction abc: Not found"
    ]
  }
}
```

## Protecciones de Seguridad

### Nivel de Código
```javascript
// Solo en desarrollo
if (process.env.NODE_ENV === 'production') {
  throw new Error("Esta función solo está disponible en desarrollo");
}
```

### Nivel de UI
- Menú solo visible en desarrollo
- Página muestra mensaje de error en producción
- API rechaza requests en producción

### Nivel de Logs
```javascript
await logService.log({
  level: 'warn',
  action: 'BULK_DELETE_TRANSACTIONS',
  userId: user.uid,
  userEmail: user.email,
  details: {
    year, month, deletedCount, totalFound, errors: errors.length
  }
});
```

## Casos de Uso

### 1. Limpieza de Datos de Prueba
```
Escenario: Después de testing de gastos recurrentes
Acción: Eliminar transacciones de agosto 2024
Resultado: Mes limpio para nuevas pruebas
```

### 2. Reset de Mes Durante Desarrollo
```
Escenario: Error en generación masiva de datos
Acción: Eliminar todo septiembre 2024
Resultado: Poder regenerar datos correctamente
```

### 3. Preparación de Ambiente
```
Escenario: Configurar ambiente para demo
Acción: Limpiar meses específicos
Resultado: Datos controlados para presentación
```

## Consideraciones Técnicas

### Performance
- Eliminación secuencial (no paralela) para evitar sobrecarga
- Manejo individual de errores por transacción
- Logs detallados para debugging

### Escalabilidad
- Funciona eficientemente con hasta ~1000 transacciones por mes
- Para volúmenes mayores, considerar implementar batch processing

### Monitoreo
- Todos los logs van a `logService` con nivel `warn`
- Incluye metadata completa del proceso
- Timestamp y environment tracking

## Futuras Mejoras

### Posibles Extensiones
- Filtros adicionales (por tipo, concepto, etc.)
- Eliminación por rango de fechas
- Preview antes de eliminar
- Backup automático antes de eliminar
- Restaurar desde backup

### Optimizaciones
- Batch processing para grandes volúmenes
- Progress bar más detallado
- Cancelación de proceso en curso
- Retry automático para errores temporales

## Testing

### Para Probar la Funcionalidad
1. Asegurarse de estar en entorno de desarrollo
2. Navegar a Configuración > Dev Tools
3. Crear algunas transacciones de prueba
4. Seleccionar el mes y confirmar eliminación
5. Verificar logs en consola y en la base de datos

### Validar Seguridad
1. Intentar acceder en producción (debe fallar)
2. Verificar que el menú no aparece en producción
3. Probar API directamente en producción (debe retornar 403)
