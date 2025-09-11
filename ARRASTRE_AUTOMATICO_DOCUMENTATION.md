# Sistema de Arrastre Automático - Documentación

## Resumen
Se ha implementado un sistema de arrastre automático que calcula y registra el saldo disponible del mes anterior cada primer día del mes a las 12:00 AM mediante un cronjob.

## Funcionamiento

### 1. Cálculo Automático
- **Frecuencia**: Cada 1° de mes a las 12:00 AM (medianoche)
- **Endpoint**: `/api/cron/calculate-carryover`
- **Configuración**: Schedule cron `"0 0 1 * *"` en `vercel.json`s
a
### 2. Lógica de Cálculo
El sistema calcula automáticamente:
```
Saldo Arrastre = (Ingresos del mes anterior + Arrastre previo) - Gastos pagados del mes anterior
```

### 3. Archivos Modificados

#### Nuevos Archivos
- `src/pages/api/cron/calculate-carryover.js` - Endpoint del cronjob

#### Archivos Modificados
- `vercel.json` - Añadido nuevo cronjob
- `src/pages/admin/reportes.js` - Removida interfaz manual, añadidos indicadores automáticos

### 4. Configuración del Cronjob

#### Vercel (Configuración Actual)
```json
{
  "crons": [
    {
      "path": "/api/cron/generate-recurring",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/calculate-carryover",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

#### Para Otros Proveedores
Si se despliega en otro proveedor, configurar un cron job que llame:
```bash
curl -X POST https://tu-dominio.com/api/cron/calculate-carryover \
  -H "Authorization: Bearer tu-secret-key"
```

### 5. Seguridad
- El endpoint está protegido con `CRON_SECRET` (variable de entorno)
- Sin `CRON_SECRET` configurado, funciona en modo desarrollo
- Validación de método POST únicamente

### 6. Monitoreo y Logs

#### Logs del Sistema
El cronjob genera logs detallados:
```javascript
console.log(`[CRON] Starting carryover calculation for ${currentMonth}/${currentYear}`);
console.log(`[CRON] Calculated carryover for ${currentMonth}/${currentYear}:`, carryoverData);
```

#### Respuesta del Endpoint
```json
{
  "success": true,
  "message": "Carryover calculated for 10/2025",
  "carryoverData": {
    "year": 2025,
    "month": 10,
    "previousYear": 2025,
    "previousMonth": 9,
    "saldoArrastre": 25000,
    "totalIngresos": 50000,
    "totalGastosPagados": 25000
  },
  "calculated": true,
  "date": "2025-10-01T00:00:00.000Z"
}
```

### 7. Interfaz de Usuario

#### Indicadores en Reportes
- ✅ **Verde**: "Arrastre calculado automáticamente" - El arrastre ya fue calculado
- ⏳ **Azul**: "Se calculará automáticamente el 1° del mes" - Pendiente de calcular
- 🤖 **Gris**: "Cálculo automático cada 1° del mes a las 12:00 AM" - Información del sistema

#### Cambios Removidos
- Botón "Calcular Arrastre" / "Recalcular Arrastre"
- Variable `processingCarryover`
- Función `processMonthlyCarryover`

### 8. Ventajas del Sistema Automático

1. **Consistencia**: El arrastre se calcula siempre el mismo día/hora
2. **Sin Intervención Manual**: No requiere que el usuario recuerde calcularlo
3. **Histórico Completo**: Cada mes queda registrado automáticamente
4. **Monitoreo**: Logs detallados para debugging y seguimiento
5. **Escalabilidad**: Funciona independientemente del número de usuarios

### 9. Consideraciones Técnicas

#### Idempotencia
- El sistema verifica si ya existe el cálculo antes de proceder
- Si ya existe, devuelve el resultado existente sin recalcular

#### Manejo de Errores
- Errores se loggean pero no interrumpen otros procesos
- Respuestas HTTP apropiadas para monitoreo externo

#### Zona Horaria
- El cron usa UTC por defecto
- El cálculo se hace basado en fechas locales del sistema

### 10. Testing del Sistema

#### Prueba Manual del Endpoint
```bash
# En desarrollo (sin CRON_SECRET)
curl -X POST http://localhost:3000/api/cron/calculate-carryover

# En producción (con CRON_SECRET)
curl -X POST https://tu-dominio.com/api/cron/calculate-carryover \
  -H "Authorization: Bearer $CRON_SECRET"
```

#### Verificación en Interfaz
1. Ir a la página de Reportes
2. Verificar el indicador de estado del arrastre
3. Los mensajes deben mostrar el estado automático

### 11. Migración del Sistema Anterior

#### Datos Existentes
- Los arrastres calculados manualmente anteriormente se mantienen
- El sistema nuevo es compatible con datos históricos

#### Comportamiento Híbrido
- El sistema detecta automáticamente si ya existe un cálculo
- No recalcula meses que ya tienen arrastre registrado

### 12. Próximos Pasos

1. **Monitoreo**: Configurar alertas para fallos del cronjob
2. **Dashboard**: Crear panel administrativo para ver histórico de arrastres
3. **Notificaciones**: Enviar email cuando se calcula el arrastre mensual
4. **Backup**: Sistema de respaldo para recálculo manual si es necesario

## Configuración de Variables de Entorno

### Vercel
```bash
# En el dashboard de Vercel, agregar:
CRON_SECRET=tu-clave-secreta-muy-segura
```

### Otras Plataformas
```bash
# Archivo .env.production
CRON_SECRET=tu-clave-secreta-muy-segura
```

## Notas Importantes

- El cronjob se ejecuta en zona horaria UTC
- El primer día del mes puede variar según la zona horaria del servidor
- Asegurarse de que `CRON_SECRET` esté configurado en producción
- Los logs se pueden monitorear en el dashboard del proveedor de hosting

## Contacto y Soporte

Para problemas con el sistema automático de arrastre:
1. Revisar logs del cronjob en el dashboard del proveedor
2. Verificar que `CRON_SECRET` esté configurado correctamente
3. Confirmar que las fechas y cálculos sean correctos en la base de datos
