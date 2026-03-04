#!/bin/bash
# Script de setup inicial para sistema multi-tenant

echo "🚀 Configurando sistema multi-tenant..."
echo "=================================="

echo ""
echo "1️⃣ Verificando dependencias..."

# Verificar si firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI no encontrado. Por favor instala:"
    echo "   npm install -g firebase-tools"
    echo "   firebase login"
    exit 1
fi

echo "✅ Firebase CLI encontrado"

# Verificar si hay uuid instalado
if ! npm list uuid &> /dev/null; then
    echo "📦 Instalando dependencias..."
    npm install uuid
else
    echo "✅ Dependencias verificadas"
fi

echo ""
echo "2️⃣ Desplegando reglas de Firestore..."

# Backup de reglas anteriores
if [ -f "firestore.rules.backup" ]; then
    echo "⚠️  Backup de reglas anterior encontrado"
else
    if [ -f "firestore.rules" ]; then
        cp firestore.rules firestore.rules.backup
        echo "✅ Backup de reglas anterior creado: firestore.rules.backup"
    fi
fi

# Desplegar nuevas reglas
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Reglas de Firestore desplegadas exitosamente"
else
    echo "❌ Error desplegando reglas de Firestore"
    echo "   Verifica tu configuración de Firebase"
    exit 1
fi

echo ""
echo "3️⃣ Verificando estructura de la base de datos..."

# Verificar que el proyecto Firebase esté configurado
if [ ! -f ".firebaserc" ]; then
    echo "❌ Proyecto Firebase no configurado"
    echo "   Ejecuta: firebase init"
    exit 1
fi

echo "✅ Configuración de Firebase verificada"

echo ""
echo "4️⃣ Configurando índices de Firestore..."

# Crear archivo de índices si no existe
if [ ! -f "firestore.indexes.json" ]; then
    echo "📝 Creando configuración de índices..."
    cat > firestore.indexes.json << 'EOL'
{
  "indexes": [
    {
      "collectionGroup": "entradas",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "createdBy",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "fecha",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "salidas",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "createdBy",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "fecha",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "transacciones",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "tipo",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "fecha",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "members",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "role",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
EOL
    echo "✅ Configuración de índices creada"
fi

# Desplegar índices
firebase deploy --only firestore:indexes

echo ""
echo "5️⃣ Verificando variables de entorno..."

if [ ! -f ".env.local" ]; then
    echo "⚠️  Archivo .env.local no encontrado"
    echo "   Crea el archivo con tus configuraciones de Firebase"
else
    echo "✅ Variables de entorno encontradas"
fi

echo ""
echo "🎉 CONFIGURACIÓN COMPLETADA"
echo "=========================="
echo ""
echo "📋 Próximos pasos:"
echo "1. Verifica tu archivo .env.local con las claves de Firebase"
echo "2. Ejecuta 'npm run dev' para iniciar el servidor"
echo "3. Ve a /admin/multi-tenant-setup para configuración inicial"
echo "4. Consulta MULTI_TENANT_GUIDE.md para ejemplos de uso"
echo ""
echo "🔗 Enlaces útiles:"
echo "   - Consola Firebase: https://console.firebase.google.com"
echo "   - Reglas desplegadas en: Firestore Database > Rules"
echo "   - Índices en: Firestore Database > Indexes"
echo ""

# Verificar estado del servidor de desarrollo
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "🌐 Servidor de desarrollo corriendo en http://localhost:3000"
else
    echo "💡 Ejecuta 'npm run dev' para iniciar el servidor de desarrollo"
fi

echo "✨ ¡Listo para usar el sistema multi-tenant!"