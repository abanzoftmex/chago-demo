# Guía de Implementación: Sistema Multi-Tenant 

## 🎯 Descripción General

Este sistema convierte tu aplicación financiera existente en un SaaS multi-tenant completo usando Firebase Authentication y Firestore. Cada empresa (tenant) tiene sus datos completamente aislados y pueden tener múltiples usuarios con diferentes roles.

## 🏗️ Arquitectura Implementada

### Estructura de Firestore

```
📁 users (collection)
   └── {uid}
         ├── email
         ├── displayName  
         ├── tenantId
         ├── createdAt

📁 tenants (collection)
   └── {tenantId}
         ├── nombreEmpresa
         ├── ownerUid
         ├── createdAt
         ├── 📁 members (subcollection)
         │    └── {uid}
         │          ├── email
         │          ├── role: "admin" | "contador" | "viewer"
         │          ├── status: "active" | "inactive"
         │          ├── createdAt
         ├── 📁 entradas (subcollection)
         ├── 📁 salidas (subcollection)
         ├── 📁 transacciones (subcollection)
         ├── 📁 conceptos (subcollection)
         ├── 📁 proveedores (subcollection)
         └── ... (otros catálogos)
```

### Roles y Permisos

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **admin** | Administrador completo | Todos los permisos, gestión de usuarios |
| **contador** | Usuario operativo | Crear/editar entradas y salidas |
| **viewer** | Solo lectura | Ver datos y reportes |

## 🚀 Implementación Paso a Paso

### Paso 1: Actualizar las Reglas de Firestore

Reemplaza tu archivo `firestore.rules` con las nuevas reglas multi-tenant:

```bash
# Copiar las nuevas reglas
cp firestore.rules.multi-tenant firestore.rules

# Desplegar en Firebase
firebase deploy --only firestore
```

### Paso 2: Actualizar el AuthContext

En tu `_app.js`, reemplaza el AuthContext actual:

```jsx
// Antes 
import { AuthProvider } from '../context/AuthContext';

// Después
import { AuthProvider } from '../context/AuthContextMultiTenant';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
```

### Paso 3: Actualizar Componentes Existentes

#### Para componentes de autenticación:

```jsx
// Antes
import { useAuth } from '../context/AuthContext';

// Después  
import { useAuth } from '../context/AuthContextMultiTenant';

// Nuevas propiedades disponibles:
const {
  // Estados
  user,
  userRole, 
  tenantInfo,
  isLegacyUser,
  
  // Funciones multi-tenant
  registerWithNewTenant,
  inviteUserToCurrentTenant,
  hasCurrentTenantPermission,
  
  // Constantes
  TENANT_ROLES,
} = useAuth();
```

#### Para componentes de datos:

```jsx
// Antes - acceso directo a collections
import { collection, getDocs } from 'firebase/firestore';
const transactionsRef = collection(db, 'transactions');

// Después - usar servicios por tenant
import { getTransacciones } from '../lib/services/transaccionesService';
const result = await getTransacciones(userId, { 
  fechaInicio: startDate,
  fechaFin: endDate 
});
```

### Paso 4: Migración de Datos Existentes

#### Opción A: Migración Automática por Usuario

```jsx
import { migrateUserToMultiTenant } from '../lib/helpers/migrationHelper';

// Migrar usuario actual al hacer login por primera vez
const handleMigration = async (userId) => {
  const result = await migrateUserToMultiTenant(
    userId, 
    "Mi Empresa" // Nombre de la empresa
  );
  
  if (result.success) {
    console.log(`Usuario migrado a tenant: ${result.tenantId}`);
    // Recargar página o actualizar contexto
  }
};
```

#### Opción B: Migración por Lotes

```jsx
import { 
  generatePreMigrationReport,
  migrateUsersToSharedTenant 
} from '../lib/helpers/migrationHelper';

// 1. Generar reporte previo
const report = await generatePreMigrationReport();

// 2. Migrar múltiples usuarios a un tenant compartido
const userIds = ['user1', 'user2', 'user3'];
const sharedTenantId = 'existing-tenant-id';
const adminId = 'admin-user-id';

const migrationResult = await migrateUsersToSharedTenant(
  userIds, 
  sharedTenantId, 
  adminId
);
```

## 📝 Ejemplos de Uso

### Registro de Nueva Empresa

```jsx
import { registerUserWithNewTenant } from '../lib/services/userRegistrationService';

const handleRegister = async (formData) => {
  const result = await registerUserWithNewTenant({
    email: "admin@empresa.com",
    password: "password123",
    displayName: "Juan Pérez", 
    nombreEmpresa: "Mi Empresa SAC"
  });
  
  if (result.success) {
    // Usuario y tenant creados
    console.log('Tenant ID:', result.user.tenantId);
    // Auto-login o redirigir
  }
};
```

### Crear Entrada

```jsx
import { createEntrada } from '../lib/services/entradasService';

const handleCreateEntrada = async () => {
  const result = await createEntrada({
    concepto: "Venta de productos",
    monto: 15000.50,
    fecha: new Date(),
    proveedor: "Cliente ABC",
    metodoPago: "transferencia"
  }, userId);
  
  if (result.success) {
    console.log('Entrada creada:', result.entradaId);
  }
};
```

### Obtener Transacciones

```jsx
import { getTransacciones } from '../lib/services/transaccionesService';

const loadTransacciones = async () => {
  const result = await getTransacciones(userId, {
    fechaInicio: new Date(2026, 0, 1),
    fechaFin: new Date(2026, 11, 31),
    tipo: "entrada", // "entrada" | "salida"
    limitTo: 100
  });
  
  if (result.success) {
    setTransacciones(result.transacciones);
  }
};
```

### Gestionar Usuarios del Tenant

```jsx
import { inviteUserToTenant } from '../lib/services/userRegistrationService';

const handleInviteUser = async () => {
  const result = await inviteUserToTenant({
    email: "nuevo@empresa.com",
    displayName: "María González", 
    role: "contador"
  }, tenantId, adminUserId);
  
  if (result.success) {
    // Usuario invitado, se envía email de reset password
  }
};
```

## 🔒 Seguridad y Validaciones

### Verificación de Permisos

```jsx
import { requirePermission } from '../lib/services/roleServiceMultiTenant';

// En funciones del backend
const handleDeleteTransaction = async (userId, transactionId) => {
  const permCheck = await requirePermission(userId, 'canDeleteTransactions');
  if (!permCheck.success) {
    return { success: false, error: 'Sin permisos' };
  }
  
  // Continuar con eliminación
};

// En componentes frontend
const { checkPermission } = useAuth();

return (
  <div>
    {checkPermission('canCreateUsers') && (
      <button onClick={handleInviteUser}>
        Invitar Usuario
      </button>
    )}
  </div>
);
```

### Aislamiento de Datos

Las reglas de Firestore garantizan que:
- ✅ Solo miembros activos del tenant pueden acceder a sus datos
- ✅ Los datos están completamente aislados entre tenants 
- ✅ Los usuarios solo ven datos de su tenant
- ✅ Se mantienen logs de auditoría automáticos

## 🛠️ Mantenimiento y Monitoreo

### Verificar Estado de Migración

```jsx
import { checkMigrationStatus } from '../lib/helpers/migrationHelper';

const status = await checkMigrationStatus();
console.log(`${status.migrated} migrados, ${status.pending} pendientes`);
```

### Obtener Resumen del Tenant

```jsx
import { getTenantSummary } from '../lib/services/tenantDataHelper';

const summary = await getTenantSummary(userId);
console.log('Documentos por colección:', summary.collections);
```

## 🚦 Lista de Verificación de Implementación

### Backend/Database
- [ ] Reglas de Firestore actualizadas y desplegadas
- [ ] Indices de Firestore creados para consultas tenant
- [ ] Backup de datos existentes realizado

### Frontend  
- [ ] AuthContext actualizado a multi-tenant
- [ ] Componentes actualizados para usar nuevos servicios
- [ ] Rutas protegidas actualizadas con nuevos roles
- [ ] UI actualizada para mostrar información de tenant

### Migración
- [ ] Reporte de pre-migración generado
- [ ] Estrategia de migración definida (por usuario vs lotes)
- [ ] Datos legacy migrados exitosamente
- [ ] Usuarios notificados sobre cambios

### Testing
- [ ] Flujo de registro con tenant probado
- [ ] Aislamiento de datos verificado
- [ ] Permisos por rol validados
- [ ] Performance con múltiples tenants probada

## 📞 Soporte y Extensiones

### Estructura de Archivos Creados
```
src/
├── lib/
│   ├── services/
│   │   ├── tenantService.js               # Gestión de tenants
│   │   ├── roleServiceMultiTenant.js      # Roles multi-tenant
│   │   ├── userRegistrationService.js     # Registro de usuarios
│   │   ├── entradasService.js             # Entradas por tenant
│   │   ├── salidasService.js              # Salidas por tenant
│   │   ├── transaccionesService.js        # Transacciones por tenant
│   │   └── tenantDataHelper.js            # Helpers generales
│   ├── helpers/
│   │   └── migrationHelper.js             # Herramientas de migración
│   └── examples/
│       └── multiTenantExamples.js         # Ejemplos de uso
├── context/
│   └── AuthContextMultiTenant.js          # Context actualizado
└── components/
    └── examples/
        └── MultiTenantExample.js          # Componente de ejemplo
```

### Extensiones Posibles
- **Facturación por tenant**: Métricas de uso y billing
- **Personalización**: Temas y configuraciones por tenant  
- **API pública**: Endpoints REST para integraciones
- **Analytics avanzados**: Dashboards por tenant y global
- **Backup automático**: Respaldos programados por tenant

¡El sistema está listo para escalar como SaaS multi-tenant! 🎉