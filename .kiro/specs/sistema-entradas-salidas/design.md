# Design Document

## Overview

El sistema de entradas y salidas será desarrollado como una aplicación web usando Next.js 15 con React 19, Firebase como backend, y Tailwind CSS 4 para el diseño. La arquitectura seguirá el patrón de páginas de Next.js con un enfoque en componentes reutilizables y un diseño administrativo modular.

## Architecture

### Frontend Architecture
- **Framework**: Next.js 15 con con el sistema anterior de /pages/
- **UI Library**: React 19 con componentes funcionales y hooks
- **Styling**: Tailwind CSS 4 para diseño responsivo y consistente
- **State Management**: Zustand para estado global y useState/useEffect para estado local
- **Form Handling**: Formularios controlados con validación en tiempo real
- **File Upload**: Componente personalizado con drag & drop y preview

### Backend Architecture
- **Database**: Firebase Firestore para almacenamiento de datos
- **Authentication**: Firebase Auth con email/password
- **File Storage**: Firebase Storage para documentos adjuntos

### Data Flow
```
User Interface → React Components → Firebase SDK → Firestore/Storage → Real-time Updates
```

## Components and Interfaces

### Core Layout Components

#### AdminLayout
```javascript
// Componente principal que envuelve todas las páginas administrativas
const AdminLayout = ({ children, title, breadcrumbs }) => {
  // Sidebar con navegación
  // Header con usuario y notificaciones
  // Main content area
  // Footer
}
```

#### Sidebar Navigation
- Dashboard
- Transacciones
  - Entradas
  - Salidas
  - Historial
- Catálogos
  - Proveedores
  - Conceptos
  - Descripciones
- Reportes
- Configuración

#### Header Component
- Breadcrumbs dinámicos
- Notificaciones toast
- Menú de usuario con logout

### Transaction Components

#### TransactionForm
```javascript
const TransactionForm = ({ type, onSubmit, initialData }) => {
  // Campos: concepto, descripción, monto, proveedor, fecha
  // Dropdowns dinámicos con opción "Agregar nuevo"
  // Validación en tiempo real
  // Integración con catálogos
}
```

#### ConceptSelector
```javascript
const ConceptSelector = ({ type, value, onChange, onCreateNew }) => {
  // Dropdown filtrado por tipo (entrada/salida)
  // Opción "Agregar nuevo" que abre modal
  // Búsqueda en tiempo real
}
```

#### DescriptionSelector
```javascript
const DescriptionSelector = ({ conceptId, value, onChange, onCreateNew }) => {
  // Dropdown filtrado por concepto seleccionado
  // Creación dinámica de descripciones
  // Asociación automática con concepto
}
```

### Provider Components

#### ProviderCatalog
```javascript
const ProviderCatalog = () => {
  // Lista paginada de proveedores
  // Búsqueda y filtros
  // Acciones: crear, editar, eliminar
  // Vista detallada con contactos y cuentas
}
```

#### ProviderForm
```javascript
const ProviderForm = ({ provider, onSubmit }) => {
  // Información básica: nombre, dirección, teléfono, RFC
  // Sección de contactos (array dinámico)
  // Sección de cuentas bancarias (array dinámico)
  // Validación de RFC y datos bancarios
}
```

### Payment Components

#### PaymentManager
```javascript
const PaymentManager = ({ transactionId, totalAmount }) => {
  // Lista de pagos existentes
  // Formulario para nuevo pago
  // Cálculo de saldo pendiente
  // Gestión de archivos adjuntos
}
```

#### FileUpload
```javascript
const FileUpload = ({ onUpload, acceptedTypes, maxSize }) => {
  // Drag & drop interface
  // Preview de archivos
  // Validación de tipo y tamaño
  // Progress indicator
  // Integración con Firebase Storage
}
```

## Data Models

### Transaction Model
```javascript
{
  id: string,
  type: 'entrada' | 'salida',
  conceptId: string,
  descriptionId: string,
  providerId: string, // solo para salidas
  amount: number,
  date: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
  status: 'pendiente' | 'pagado' | 'parcial',
  payments: [paymentId],
  totalPaid: number,
  balance: number
}
```

### Provider Model
```javascript
{
  id: string,
  name: string,
  address: string,
  phone: string,
  rfc: string,
  contacts: [{
    name: string,
    email: string,
    phone: string
  }],
  bankAccounts: [{
    bank: string,
    accountNumber: string,
    clabe: string
  }],
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Concept Model
```javascript
{
  id: string,
  name: string,
  type: 'entrada' | 'salida',
  createdAt: timestamp,
  isActive: boolean
}
```

### Description Model
```javascript
{
  id: string,
  name: string,
  conceptId: string,
  createdAt: timestamp,
  isActive: boolean
}
```

### Payment Model
```javascript
{
  id: string,
  transactionId: string,
  amount: number,
  date: timestamp,
  attachments: [{
    fileName: string,
    fileUrl: string,
    fileType: string,
    uploadedAt: timestamp
  }],
  notes: string,
  createdAt: timestamp
}
```

## Error Handling

### Client-Side Error Handling
- **Form Validation**: Validación en tiempo real con mensajes específicos
- **Network Errors**: Retry automático con exponential backoff
- **File Upload Errors**: Mensajes específicos por tipo de error (tamaño, formato, etc.)
- **Authentication Errors**: Redirección automática a login

### Firebase Error Handling
- **Firestore Errors**: Manejo de permisos, conexión y límites
- **Storage Errors**: Validación de archivos y manejo de cuotas
- **Auth Errors**: Mensajes de error amigables para usuarios

### Error Boundaries
```javascript
const ErrorBoundary = ({ children, fallback }) => {
  // Captura errores de React
  // Logging a Firebase Analytics
  // UI de fallback amigable
}
```

## Testing Strategy
- **Components**:NOT NECESESARY


## Security Considerations

### Authentication & Authorization
- Firebase Auth con email/password
- Protected routes
- Session management automático

### Data Security
- Sanitización de inputs

### File Security
- Validación de tipos de archivo
- Límites de tamaño
- URLs firmadas para acceso controlado

## Performance Optimizations

### Frontend Optimizations
- **Code Splitting**: Lazy loading de páginas y componentes
- **Image Optimization**: Next.js Image component
- **Caching**: SWR para caching de datos
- **Bundle Optimization**: Tree shaking y minification

### Firebase Optimizations
- **Query Optimization**: Índices compuestos para consultas complejas
- **Pagination**: Cursor-based pagination para listas grandes
- **Real-time Subscriptions**: Unsubscribe automático para evitar memory leaks
- **Offline Support**: Firebase offline persistence

### UI/UX Optimizations
- **Loading States**: Skeletons y spinners
- **Optimistic Updates**: UI updates antes de confirmación del servidor
- **Debounced Search**: Reducir queries en búsquedas
- **Virtual Scrolling**: Para listas muy grandes

## Responsive Design

### Breakpoints (Tailwind CSS)
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Mobile-First Approach
- Sidebar colapsable en móvil
- Formularios optimizados para touch
- Tablas responsivas con scroll horizontal
- Modals full-screen en móvil

### Accessibility
- ARIA labels y roles
- Keyboard navigation
- Color contrast compliance
- Screen reader support
- Focus management