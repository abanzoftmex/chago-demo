# 🔧 Scripts de Utilidad

Este directorio contiene scripts de utilidad y mantenimiento del sistema.

## 📋 Scripts Disponibles

### 1. `audit-duplicate-october-31.js`
**Propósito:** Auditoría de transacciones recurrentes duplicadas.

**Uso:**
```bash
node scripts/audit-duplicate-october-31.js
```

**Funcionalidad:**
- Detecta transacciones duplicadas en un rango de fechas
- Genera archivo CSV con duplicados encontrados (si existen)
- Muestra resumen detallado en consola
- ⚠️ **Solo audita, NO elimina datos**

**Salida:**
- 📄 CSV: `audit-reports/duplicados-octubre-31-YYYY-MM-DD.csv` (si hay duplicados)
- 📊 Console: Resumen detallado

---

### 2. `simulate-october-2025.cjs`
**Propósito:** Script de simulación para pruebas.

---

### 3. `backfill-pos-payments.cjs`
**Propósito:** Crear el pago que salda cada transacción que llegó del punto de venta antes de que la integración lo creara sola.

**Uso:**
```bash
node scripts/backfill-pos-payments.cjs                 # simulación: solo lista
node scripts/backfill-pos-payments.cjs --tenant=<id>   # limitar a un tenant
node scripts/backfill-pos-payments.cjs --apply         # escribe
```

**Funcionalidad:**
- Crea `payments/pos_<idTransacción>` por el monto total, con la fecha de la venta o compra
- Si la transacción está anulada, el pago nace anulado (o se marca anulado si ya existía)
- Las transacciones que ya tienen pagos capturados a mano **no se tocan**: se listan para revisarlas
- ⚠️ **Escribe en la base de datos solo con `--apply`**; nunca borra ni sobrescribe pagos

---

## 📚 Documentación

Para información sobre el sistema de suscripciones mensuales, consulta:
- � `MONTHLY_SUBSCRIPTION_FIX.md` - Documentación de la corrección del sistema mensual
- � `src/lib/services/recurringExpenseService.js` - Lógica de gastos recurrentes

---

## � Troubleshooting

### Error: "Cannot find module"
```bash
# Asegúrate de estar en la raíz del proyecto
cd /Users/gabrielhernandez/Projects/chago
npm install
```

### Error: "Firebase not configured"
```bash
# Verificar configuración de Firebase
cat .env.local | grep FIREBASE
```

---

**Última actualización:** 4 de noviembre de 2025
