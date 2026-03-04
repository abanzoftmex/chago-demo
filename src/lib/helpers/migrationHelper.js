/**
 * Helper para migración desde sistema anterior a multi-tenant
 * Utilidades para migrar usuarios y datos existentes
 */

import { db } from "../firebase/firebaseConfig";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { createTenant, addTenantMember, TENANT_ROLES } from "../services/tenantService";
import { setUserRole, ROLES } from "../services/roleServiceMultiTenant";

/**
 * Migra un usuario del sistema anterior a multi-tenant
 * @param {string} userId - UID del usuario a migrar
 * @param {string} nombreEmpresa - Nombre de la empresa para el nuevo tenant
 * @returns {Promise<Object>} - Resultado de la migración
 */
export const migrateUserToMultiTenant = async (userId, nombreEmpresa) => {
  try {
    console.log(`🔄 Iniciando migración de usuario ${userId} a multi-tenant`);

    // 1. Obtener datos del usuario actual
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error("Usuario no encontrado");
    }

    const userData = userSnap.data();
    
    // Verificar si ya tiene tenant asignado
    if (userData.tenantId) {
      return {
        success: false,
        error: "Usuario ya tiene tenant asignado",
        tenantId: userData.tenantId,
      };
    }

    // 2. Mapear rol anterior a rol tenant
    const legacyRole = userData.role || ROLES.ADMINISTRATIVO;
    const tenantRole = mapLegacyRoleToTenant(legacyRole);

    console.log(`📝 Mapeando rol: ${legacyRole} -> ${tenantRole}`);

    // 3. Crear tenant para el usuario
    const tenantResult = await createTenant(userId, nombreEmpresa, {
      email: userData.email,
      displayName: userData.displayName,
    });

    if (!tenantResult.success) {
      throw new Error(`Error creando tenant: ${tenantResult.error}`);
    }

    const tenantId = tenantResult.tenantId;
    console.log(`✅ Tenant creado: ${tenantId}`);

    // 4. Migrar datos legacy del usuario al tenant
    await migrateLegacyDataToTenant(userId, tenantId);

    console.log(`✅ Usuario ${userId} migrado exitosamente a tenant ${tenantId}`);
    
    return {
      success: true,
      userId,
      tenantId,
      oldRole: legacyRole,
      newRole: tenantRole,
    };

  } catch (error) {
    console.error(`❌ Error migrando usuario ${userId}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Mapea roles del sistema anterior a roles de tenant
 * @param {string} legacyRole - Rol del sistema anterior
 * @returns {string} - Rol equivalente en el sistema tenant
 */
const mapLegacyRoleToTenant = (legacyRole) => {
  const roleMap = {
    [ROLES.ADMINISTRATIVO]: TENANT_ROLES.ADMIN,
    [ROLES.CONTADOR]: TENANT_ROLES.CONTADOR,
    [ROLES.DIRECTOR_GENERAL]: TENANT_ROLES.VIEWER,
  };

  return roleMap[legacyRole] || TENANT_ROLES.VIEWER;
};

/**
 * Migra datos legacy (transacciones, catálogos) al tenant
 * @param {string} userId - UID del usuario propietario
 * @param {string} tenantId - ID del tenant destino
 * @returns {Promise<Object>} - Resultado de la migración de datos
 */
const migrateLegacyDataToTenant = async (userId, tenantId) => {
  try {
    console.log(`📦 Migrando datos legacy al tenant ${tenantId}`);

    const migrationResults = {
      transactions: 0,
      concepts: 0,
      subconcepts: 0,
      providers: 0,
      descriptions: 0,
      generals: 0,
      recurring_expenses: 0,
    };

    // Migrar transacciones
    migrationResults.transactions = await migrateLegacyCollection(
      "transactions",
      tenantId,
      userId,
      "transacciones"
    );

    // Migrar catálogos
    migrationResults.concepts = await migrateLegacyCollection(
      "concepts",
      tenantId,
      userId,
      "conceptos"
    );

    migrationResults.subconcepts = await migrateLegacyCollection(
      "subconcepts",
      tenantId,
      userId,
      "subconceptos"
    );

    migrationResults.providers = await migrateLegacyCollection(
      "providers",
      tenantId,
      userId,
      "proveedores"
    );

    migrationResults.descriptions = await migrateLegacyCollection(
      "descriptions",
      tenantId,
      userId,
      "descripciones"
    );

    migrationResults.generals = await migrateLegacyCollection(
      "generals",
      tenantId,
      userId,
      "generales"
    );

    migrationResults.recurring_expenses = await migrateLegacyCollection(
      "recurring_expenses",
      tenantId,
      userId,
      "gastos_recurrentes"
    );

    console.log(`📊 Datos migrados:`, migrationResults);
    return migrationResults;

  } catch (error) {
    console.error("❌ Error migrando datos legacy:", error);
    throw error;
  }
};

/**
 * Migra una colección específica del sistema legacy al tenant
 * @param {string} legacyCollection - Nombre de la colección legacy
 * @param {string} tenantId - ID del tenant destino
 * @param {string} userId - UID del usuario propietario
 * @param {string} tenantCollection - Nombre de la colección en el tenant
 * @returns {Promise<number>} - Número de documentos migrados
 */
const migrateLegacyCollection = async (legacyCollection, tenantId, userId, tenantCollection) => {
  try {
    // Obtener documentos legacy
    const legacyRef = collection(db, legacyCollection);
    const legacySnap = await getDocs(legacyRef);

    if (legacySnap.empty) {
      console.log(`⚠️  No se encontraron documentos en ${legacyCollection}`);
      return 0;
    }

    const batch = writeBatch(db);
    let count = 0;
    const maxBatchSize = 500;

    // Procesar documentos en batches
    const docs = legacySnap.docs;
    for (let i = 0; i < docs.length; i += maxBatchSize) {
      const batchDocs = docs.slice(i, i + maxBatchSize);
      const currentBatch = writeBatch(db);

      batchDocs.forEach((legacyDoc) => {
        const legacyData = legacyDoc.data();
        
        // Preparar datos para el tenant
        const tenantData = {
          ...legacyData,
          // Agregar metadatos de migración
          migratedFrom: legacyCollection,
          migratedAt: serverTimestamp(),
          migratedBy: userId,
          originalId: legacyDoc.id,
          // Metadatos estándar si no existen
          createdBy: legacyData.createdBy || userId,
          createdAt: legacyData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Crear documento en el tenant
        const tenantDocRef = doc(db, `tenants/${tenantId}/${tenantCollection}`, legacyDoc.id);
        currentBatch.set(tenantDocRef, tenantData);
        count++;
      });

      await currentBatch.commit();
      console.log(`📝 Migrados ${Math.min(i + maxBatchSize, docs.length)}/${docs.length} documentos de ${legacyCollection}`);
    }

    console.log(`✅ ${count} documentos migrados de ${legacyCollection} a ${tenantCollection}`);
    return count;

  } catch (error) {
    console.error(`❌ Error migrando ${legacyCollection}:`, error);
    return 0;
  }
};

/**
 * Migra múltiples usuarios a un tenant compartido
 * @param {Array} userIds - Array de UIDs de usuarios
 * @param {string} tenantId - ID del tenant existente
 * @param {string} adminUserId - UID del admin que ejecuta la migración
 * @returns {Promise<Object>} - Resultado de la migración masiva
 */
export const migrateUsersToSharedTenant = async (userIds, tenantId, adminUserId) => {
  try {
    console.log(`🔄 Migrando ${userIds.length} usuarios al tenant ${tenantId}`);

    const results = {
      successful: [],
      failed: [],
      total: userIds.length,
    };

    for (const userId of userIds) {
      try {
        // Obtener datos del usuario
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          results.failed.push({
            userId,
            error: "Usuario no encontrado",
          });
          continue;
        }

        const userData = userSnap.data();

        if (userData.tenantId) {
          results.failed.push({
            userId,
            error: "Usuario ya tiene tenant asignado",
          });
          continue;
        }

        // Mapear rol y agregar al tenant
        const legacyRole = userData.role || ROLES.ADMINISTRATIVO;
        const tenantRole = mapLegacyRoleToTenant(legacyRole);

        const addMemberResult = await addTenantMember(
          tenantId,
          userId,
          {
            email: userData.email,
            displayName: userData.displayName,
          },
          tenantRole,
          adminUserId
        );

        if (addMemberResult.success) {
          results.successful.push({
            userId,
            email: userData.email,
            oldRole: legacyRole,
            newRole: tenantRole,
          });
          console.log(`✅ Usuario ${userData.email} migrado exitosamente`);
        } else {
          results.failed.push({
            userId,
            error: addMemberResult.error,
          });
          console.log(`❌ Error migrando usuario ${userId}: ${addMemberResult.error}`);
        }

      } catch (error) {
        results.failed.push({
          userId,
          error: error.message,
        });
        console.log(`❌ Error procesando usuario ${userId}: ${error.message}`);
      }
    }

    console.log(`📊 Migración completada: ${results.successful.length} exitosos, ${results.failed.length} fallidos`);
    return {
      success: true,
      results,
    };

  } catch (error) {
    console.error("❌ Error en migración masiva:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Verifica el estado de migración de usuarios
 * @returns {Promise<Object>} - Resumen del estado de migración
 */
export const checkMigrationStatus = async () => {
  try {
    console.log("📊 Verificando estado de migración");

    // Obtener todos los usuarios
    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);

    const status = {
      total: 0,
      migrated: 0,
      pending: 0,
      users: {
        migrated: [],
        pending: [],
      },
    };

    usersSnap.forEach((doc) => {
      const userData = doc.data();
      status.total++;

      if (userData.tenantId) {
        status.migrated++;
        status.users.migrated.push({
          id: doc.id,
          email: userData.email,
          tenantId: userData.tenantId,
        });
      } else {
        status.pending++;
        status.users.pending.push({
          id: doc.id,
          email: userData.email,
          role: userData.role,
        });
      }
    });

    console.log(`📈 Estado de migración:`);
    console.log(`- Total usuarios: ${status.total}`);
    console.log(`- Migrados: ${status.migrated}`);
    console.log(`- Pendientes: ${status.pending}`);

    return {
      success: true,
      status,
    };

  } catch (error) {
    console.error("❌ Error verificando estado de migración:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Crea un reporte de pre-migración
 * @returns {Promise<Object>} - Reporte detallado para planificar migración
 */
export const generatePreMigrationReport = async () => {
  try {
    console.log("📋 Generando reporte de pre-migración");

    const report = {
      users: { total: 0, byRole: {} },
      data: {},
      complexity: "LOW", // LOW, MEDIUM, HIGH
      recommendations: [],
    };

    // Analizar usuarios
    const usersRef = collection(db, "users");
    const usersSnap = await getDocs(usersRef);

    report.users.total = usersSnap.size;

    usersSnap.forEach((doc) => {
      const userData = doc.data();
      const role = userData.role || "sin_rol";
      
      if (!report.users.byRole[role]) {
        report.users.byRole[role] = 0;
      }
      report.users.byRole[role]++;
    });

    // Analizar datos legacy
    const collections = ["transactions", "concepts", "subconcepts", "providers", "descriptions", "generals"];
    
    for (const collectionName of collections) {
      try {
        const collRef = collection(db, collectionName);
        const collSnap = await getDocs(collRef);
        report.data[collectionName] = collSnap.size;
      } catch (error) {
        report.data[collectionName] = 0;
      }
    }

    // Determinar complejidad
    const totalData = Object.values(report.data).reduce((sum, count) => sum + count, 0);
    
    if (totalData > 10000 || report.users.total > 50) {
      report.complexity = "HIGH";
    } else if (totalData > 1000 || report.users.total > 10) {
      report.complexity = "MEDIUM";
    }

    // Generar recomendaciones
    if (report.complexity === "HIGH") {
      report.recommendations.push("Realizar migración por fases");
      report.recommendations.push("Programar ventana de mantenimiento");
      report.recommendations.push("Hacer backup completo antes de migrar");
    }

    if (Object.keys(report.users.byRole).length > 3) {
      report.recommendations.push("Revisar mapeo de roles antes de migrar");
    }

    if (report.data.transactions > 5000) {
      report.recommendations.push("Considerar archivado de transacciones antiguas");
    }

    report.recommendations.push("Probar migración en ambiente de desarrollo");
    report.recommendations.push("Notificar a usuarios sobre el cambio");

    console.log("📋 Reporte generado:");
    console.log(`- Complejidad: ${report.complexity}`);
    console.log(`- Total usuarios: ${report.users.total}`);
    console.log(`- Total datos: ${totalData} documentos`);
    console.log(`- Recomendaciones: ${report.recommendations.length}`);

    return {
      success: true,
      report,
    };

  } catch (error) {
    console.error("❌ Error generando reporte:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Crea un tenant de demostración con datos de ejemplo
 * @param {string} ownerEmail - Email del administrador
 * @param {string} ownerPassword - Contraseña del administrador
 * @param {string} ownerName - Nombre del administrador
 * @param {string} nombreEmpresa - Nombre de la empresa
 * @returns {Promise<Object>} - Resultado de la creación
 */
export const createDemoTenant = async (ownerEmail, ownerPassword, ownerName, nombreEmpresa) => {
  try {
    console.log(`🎬 Creando tenant de demostración: ${nombreEmpresa}`);

    // Importar servicios necesarios de Firebase Auth
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("../firebase/firebaseConfig");

    // 1. Crear usuario administrador
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, ownerEmail, ownerPassword);
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        return {
          success: false,
          error: `El email ${ownerEmail} ya está en uso. Usa otro email para el demo.`,
        };
      }
      throw authError;
    }

    const user = userCredential.user;
    console.log(`✅ Usuario creado: ${user.uid}`);

    // 2. Crear tenant
    const tenantResult = await createTenant(
      user.uid, 
      nombreEmpresa, 
      {
        email: user.email,
        displayName: ownerName
      }
    );

    if (!tenantResult.success) {
      throw new Error(tenantResult.error);
    }

    const tenantId = tenantResult.tenantId;
    console.log(`✅ Tenant creado: ${tenantId}`);

    // 3. El tenant ya creó el miembro con rol admin, solo actualizamos datos adicionales del usuario
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      displayName: ownerName,
      isDemo: true,
      createdAt: serverTimestamp(),
    }, { merge: true });
    console.log(`✅ Datos adicionales del usuario actualizados`);

    // 4. Crear datos de ejemplo
    await createDemoData(tenantId);
    console.log(`✅ Datos de ejemplo creados`);

    return {
      success: true,
      tenantId: tenantId,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: ownerName,
      },
      nombreEmpresa,
      message: "Tenant de demostración creado exitosamente",
    };

  } catch (error) {
    console.error("❌ Error creando tenant demo:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Crea datos de ejemplo para un tenant de demostración
 * @param {string} tenantId - ID del tenant
 */
const createDemoData = async (tenantId) => {
  try {
    const batch = writeBatch(db);

    // Crear conceptos de ejemplo
    const conceptosDemo = [
      { nombre: "Ventas", descripcion: "Ingresos por ventas", tipo: "entrada" },
      { nombre: "Servicios", descripcion: "Ingresos por servicios", tipo: "entrada" },
      { nombre: "Gastos Operativos", descripcion: "Gastos del día a día", tipo: "salida" },
      { nombre: "Marketing", descripcion: "Gastos de marketing y publicidad", tipo: "salida" },
    ];

    conceptosDemo.forEach((concepto, index) => {
      const conceptoRef = doc(collection(db, `tenants/${tenantId}/conceptos`));
      batch.set(conceptoRef, {
        ...concepto,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    // Crear proveedores de ejemplo
    const proveedoresDemo = [
      { nombre: "Proveedor A", contacto: "contacto@proveedora.com", telefono: "555-0001" },
      { nombre: "Proveedor B", contacto: "info@proveedorb.com", telefono: "555-0002" },
    ];

    proveedoresDemo.forEach((proveedor) => {
      const proveedorRef = doc(collection(db, `tenants/${tenantId}/proveedores`));
      batch.set(proveedorRef, {
        ...proveedor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    // Crear algunas transacciones de ejemplo
    const transaccionesDemo = [
      {
        tipo: "entrada",
        concepto: "Ventas",
        descripcion: "Venta de productos",
        monto: 5000,
        fecha: new Date(),
      },
      {
        tipo: "salida",
        concepto: "Gastos Operativos",
        descripcion: "Pago de servicios",
        monto: 1500,
        fecha: new Date(),
      },
    ];

    transaccionesDemo.forEach((transaccion) => {
      const transaccionRef = doc(collection(db, `tenants/${tenantId}/transacciones`));
      batch.set(transaccionRef, {
        ...transaccion,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    // Ejecutar batch
    await batch.commit();
    console.log(`✅ Datos de ejemplo creados para tenant ${tenantId}`);

  } catch (error) {
    console.error("❌ Error creando datos demo:", error);
    throw error;
  }
};