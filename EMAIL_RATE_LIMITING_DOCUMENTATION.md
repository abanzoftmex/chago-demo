# Email Rate Limiting Implementation

## Descripción

Se ha implementado un sistema de rate limiting para controlar la velocidad de envío de correos electrónicos, limitando a un máximo de 2 correos por segundo para evitar problemas con la API de email.

## Implementación

### Función Utilitaria

Se creó la función `sendEmailWithRateLimit` en `/src/lib/utils.js` que:

- Controla el tiempo entre envíos de correos
- Implementa un delay de 500ms entre cada correo (para no exceder 2 por segundo)
- Mantiene registro del último envío realizado
- Maneja errores de manera apropiada

### Archivos Modificados

1. **`/src/lib/utils.js`**
   - Agregada función `sendEmailWithRateLimit`
   - Agregada función helper `sleep`

2. **`/src/components/forms/TransactionForm.js`**
   - Importa la nueva función utilitaria
   - Reemplaza `fetch("/api/email/send")` con `sendEmailWithRateLimit`

3. **`/src/lib/services/paymentService.js`**
   - Importa la nueva función utilitaria
   - Reemplaza `fetch("/api/email/send")` con `sendEmailWithRateLimit`

4. **`/src/components/forms/PaymentManager.js`**
   - Importa la nueva función utilitaria
   - Reemplaza `fetch("/api/email/send")` con `sendEmailWithRateLimit`

## Uso

En lugar de usar directamente:
```javascript
await fetch("/api/email/send", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ to, subject, html }),
});
```

Ahora se usa:
```javascript
import { sendEmailWithRateLimit } from "../../lib/utils";

await sendEmailWithRateLimit(to, subject, html);
```

## Comportamiento

- **Primer correo**: Se envía inmediatamente
- **Correos subsecuentes**: Se espera 500ms desde el último envío antes de proceder
- **Múltiples correos**: Se procesan secuencialmente con delays automáticos

## Ventajas

1. **Prevención de rate limiting**: Evita que la API rechace correos por exceso de velocidad
2. **Transparente**: Los componentes no necesitan manejar delays manualmente
3. **Centralizado**: Toda la lógica de rate limiting está en una sola función
4. **Robusto**: Maneja errores y mantiene el control de tiempo incluso si hay fallos

## Testing

Se incluye un archivo de prueba `test-email-rate-limit.js` para verificar el funcionamiento del rate limiting.

Para probarlo:
```bash
node test-email-rate-limit.js
```

## Consideraciones

- El delay de 500ms permite exactamente 2 correos por segundo
- Si necesitas ajustar la velocidad, modifica el valor en la función `sendEmailWithRateLimit`
- El sistema mantiene estado entre llamadas usando una propiedad de la función
