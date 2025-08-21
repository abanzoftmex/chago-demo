# Sistema de Roles - CHAGO

## Resumen

Se ha implementado un sistema de roles completo con tres tipos de usuarios:

### 1. Administrativo

- **Acceso completo** a todas las funcionalidades del sistema
- **Únicos** que pueden crear, habilitar e inhabilitar usuariosa
- **Únicos** que pueden acceder a Reportes, Configuración, Usuarios y Análisis-IA
- **Únicos** que pueden eliminar elementos del catálogo, transacciones y pagos

### 2. Contador

- **Acceso limitado** según las siguientes reglas:
  - ✅ **Puede ver**: Dashboard, Ingresos, Gastos, Historial, Proveedores, Conceptos, Descripciones, Generales, Subconceptos
  - ✅ **Puede crear/editar**: Transacciones, Proveedores, Conceptos, Descripciones, Generales, Subconceptos
  - ❌ **NO puede ver**: Reportes, Configuración, Usuarios, Análisis-IA
  - ❌ **NO puede**: Eliminar elementos del catálogo, transacciones o pagos

### 3. Director General

- **Solo lectura** en el sistema
- ✅ **Puede ver**: Dashboard, Ingresos, Gastos, Historial
- ❌ **NO puede ver**: Reportes, Configuración, Usuarios, Análisis-IA
- ❌ **NO puede**: Crear, editar o eliminar nada en el sistema

## Funcionalidades Implementadas

### 🔐 Autenticación y Autorización

- **AuthContext** extendido con funciones de roles
- **ProtectedRoute** con verificación de permisos por ruta
- **RoleProtectedRoute** para protecciones específicas por permisos

### 👥 Gestión de Usuarios

- **API endpoints** para crear usuarios con Firebase Admin SDK
- **Interfaz de administración** en `/admin/usuarios`
- **Creación de usuarios** sin afectar la sesión actual
- **Habilitación/deshabilitación** de usuarios
- **Solo Administrativos** pueden acceder a gestión de usuarios

### 🧭 Navegación Adaptativa

- **Sidebar** se adapta automáticamente según permisos del usuario
- **Rutas protegidas** redirigen automáticamente si no hay permisos

### 💰 Transacciones

- **Administrativo**: Acceso completo a todas las transacciones, puede crear, editar y eliminar
- **Contador**: Puede ver y crear transacciones, pero no puede eliminarlas
- **Director General**: Solo puede ver transacciones, sin capacidad de crear o editar

### 🏷️ Catálogos

- **Administrativo**: Acceso completo, puede crear, editar y eliminar elementos
- **Contador**: Puede ver, crear y editar elementos, pero no eliminarlos
- **Director General**: No tiene acceso a catálogos

### 🔒 Permisos de Eliminación

- **Solo Administrativos** pueden eliminar:
  - Elementos de catálogos (conceptos, proveedores, etc.)
  - Transacciones
  - Pagos
- **Contadores y Directores Generales** no tienen permisos de eliminación

## Estructura de Archivos

```
src/
├── components/
│   ├── auth/
│   │   ├── ProtectedRoute.js          # Protección base con roles
│   │   └── RoleProtectedRoute.js      # Protección específica por permisos
│   ├── admin/
│   │   ├── CreateUserModal.js         # Modal para crear usuarios
│   │   └── UserList.js                # Lista de usuarios con acciones
│   └── layout/
│       └── Sidebar.js                 # Navegación adaptativa por roles
├── lib/
│   └── services/
│       └── roleService.js             # Lógica principal de roles y permisos
├── pages/
│   ├── admin/
│   │   ├── usuarios.js                # Página de gestión de usuarios
│   │   └── transacciones/
│   │       └── salidas.js             # Vista adaptada para contadores
│   └── api/
│       └── admin/
│           ├── create-user.js         # API para crear usuarios
│           └── manage-user.js         # API para gestionar usuarios
└── context/
    └── AuthContext.js                 # Context extendido con roles
```

## Configuración Requerida

### Variables de Entorno

Agregar al archivo `.env.local`:

```env
# Firebase Admin SDK (para crear usuarios)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### Configuración de Firebase

1. Generar una **clave de cuenta de servicio** en la consola de Firebase
2. Agregar las credenciales a las variables de entorno
3. Asegurar que Firestore tenga las reglas adecuadas

## Roles y Permisos

| Permiso                 | Administrador | Contador |
| ----------------------- | ------------- | -------- |
| `canViewDashboard`      | ✅            | ✅       |
| `canViewEntradas`       | ✅            | ✅       |
| `canViewSalidas`        | ✅            | ✅       |
| `canViewHistorial`      | ✅            | ❌       |
| `canManageProviders`    | ✅            | ✅       |
| `canManageConcepts`     | ✅            | ❌       |
| `canManageDescriptions` | ✅            | ❌       |
| `canViewReports`        | ✅            | ❌       |
| `canManageSettings`     | ✅            | ❌       |
| `canManageUsers`        | ✅            | ❌       |
| `canManageTransactions` | ✅            | ❌       |
| `canViewAllSalidas`     | ✅            | ❌       |
| `canViewAllEntradas`    | ✅            | ❌       |

## Uso

### Crear un Usuario

1. Ir a **Admin > Usuarios**
2. Hacer clic en **"Crear Usuario"**
3. Completar el formulario con email, contraseña y rol
4. El usuario se crea sin afectar la sesión actual

### Gestionar Usuarios

- **Habilitar/Deshabilitar**: Usar los íconos de candado
- **Eliminar**: Usar el ícono de papelera (confirmación requerida)
- **No se puede modificar**: El propio usuario

### Comportamiento del Contador

- Al acceder a **"Ingresos"** ve:
  - Transacciones pendientes y parciales
  - Transacciones pagadas habilitadas por administrador (toggle activado)
- Al acceder a **"Gastos"** ve:
  - Transacciones pendientes y parciales
  - Transacciones pagadas habilitadas por administrador (toggle activado)
- No ve los botones **"Nuevo Ingreso"** ni **"Nuevo Gasto"**
- No tiene acceso a secciones restringidas (automáticamente redirigido)

### Gestión de Visibilidad para Administradores

- **Toggle individual** por transacción pagada
- **Por defecto deshabilitado** (oculto para contadores)
- **Solo visible en transacciones con estado "pagado"**
- **Actualización en tiempo real** del estado de visibilidad

## Consideraciones de Seguridad

1. **Firebase Admin SDK** se ejecuta solo en el servidor (API routes)
2. **Verificación de tokens** en cada operación administrativa
3. **Protección a nivel de ruta** y componente
4. **Validación de permisos** en el backend y frontend
5. **Usuarios no pueden modificarse** a sí mismos

## Mantenimiento

### Agregar Nuevos Roles

1. Actualizar `ROLES` en `roleService.js`
2. Definir permisos en `ROLE_PERMISSIONS`
3. Actualizar mapeo de rutas en `canAccessRoute`

### Agregar Nuevos Permisos

1. Agregar permiso a `ROLE_PERMISSIONS`
2. Usar `checkPermission()` en componentes
3. Actualizar mapeo de rutas si es necesario

### Modificar Comportamiento por Rol

Usar las funciones del AuthContext:

- `checkPermission(permission)` - Verificar permiso específico
- `canUserAccessRoute(route)` - Verificar acceso a ruta
- `getUserPermissions()` - Obtener todos los permisos del usuario
