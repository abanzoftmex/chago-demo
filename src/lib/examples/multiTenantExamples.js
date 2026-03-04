/**
 * Ejemplos de uso del sistema multi-tenant
 * Muestra cómo implementar las funcionalidades principales
 */

import {
  registerUserWithNewTenant,
  registerUserForExistingTenant,
  inviteUserToTenant,
} from "../services/userRegistrationService";

import {
  createEntrada,
  getEntradas,
  getEntradasSummary,
} from "../services/entradasService";

import {
  createSalida,
  getSalidas,
} from "../services/salidasService";

import {
  getTransacciones,
  getResumenFinanciero,
} from "../services/transaccionesService";

import {
  addTenantMember,
  getTenantMembers,
  updateTenantMemberRole,
} from "../services/tenantService";

// ===== EJEMPLO 1: REGISTRO DE NUEVO USUARIO CON TENANT =====

export const ejemploRegistroConNuevoTenant = async () => {
  try {
    console.log("🚀 Ejemplo: Registro de usuario con nuevo tenant");
    
    const datosUsuario = {
      email: "admin@miempresa.com",
      password: "MiPassword123!",
      displayName: "Juan Pérez",
      nombreEmpresa: "Mi Empresa SAC",
    };

    const resultado = await registerUserWithNewTenant(datosUsuario);

    if (resultado.success) {
      console.log("✅ Usuario y tenant creados exitosamente:");
      console.log(`- Usuario UID: ${resultado.user.uid}`);
      console.log(`- Email: ${resultado.user.email}`);
      console.log(`- Tenant ID: ${resultado.user.tenantId}`);
      console.log(`- Rol: ${resultado.user.role}`);
      console.log(`- Mensaje: ${resultado.message}`);
    } else {
      console.error("❌ Error en registro:", resultado.error);
    }

    return resultado;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO 2: AGREGAR USUARIO A TENANT EXISTENTE =====

export const ejemploAgregarUsuarioATenant = async (adminUserId, tenantId) => {
  try {
    console.log("🚀 Ejemplo: Agregar usuario a tenant existente");
    
    const datosNuevoUsuario = {
      email: "contador@miempresa.com",
      password: "Password123!",
      displayName: "María González",
      role: "contador",
    };

    const resultado = await registerUserForExistingTenant(
      datosNuevoUsuario,
      tenantId,
      adminUserId
    );

    if (resultado.success) {
      console.log("✅ Usuario agregado al tenant exitosamente:");
      console.log(`- Usuario UID: ${resultado.user.uid}`);
      console.log(`- Email: ${resultado.user.email}`);
      console.log(`- Rol en tenant: ${resultado.user.role}`);
      console.log(`- Tenant ID: ${resultado.user.tenantId}`);
    } else {
      console.error("❌ Error agregando usuario:", resultado.error);
    }

    return resultado;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO 3: INVITAR USUARIO AL TENANT =====

export const ejemploInvitarUsuario = async (adminUserId, tenantId) => {
  try {
    console.log("🚀 Ejemplo: Invitar usuario al tenant");
    
    const datosInvitacion = {
      email: "viewer@miempresa.com",
      displayName: "Carlos López",
      role: "viewer",
    };

    const resultado = await inviteUserToTenant(
      datosInvitacion,
      tenantId,
      adminUserId
    );

    if (resultado.success) {
      console.log("✅ Invitación enviada exitosamente:");
      console.log(`- Usuario UID: ${resultado.user.uid}`);
      console.log(`- Email: ${resultado.user.email}`);
      console.log(`- Rol: ${resultado.user.role}`);
      console.log(`- Mensaje: ${resultado.message}`);
    } else {
      console.error("❌ Error enviando invitación:", resultado.error);
    }

    return resultado;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO 4: CREAR ENTRADA EN TENANT =====

export const ejemploCrearEntrada = async (userId) => {
  try {
    console.log("🚀 Ejemplo: Crear entrada en tenant");
    
    const datosEntrada = {
      concepto: "Venta de productos",
      descripcion: "Venta de productos marzo 2026",
      monto: 15000.50,
      fecha: new Date(),
      proveedor: "Cliente ABC",
      metodoPago: "transferencia",
      referencia: "TRF-2026-001",
      notas: "Pago por contrato de servicios",
    };

    const resultado = await createEntrada(datosEntrada, userId);

    if (resultado.success) {
      console.log("✅ Entrada creada exitosamente:");
      console.log(`- ID: ${resultado.entradaId}`);
      console.log(`- Concepto: ${resultado.entrada.concepto}`);
      console.log(`- Monto: $${resultado.entrada.monto}`);
    } else {
      console.error("❌ Error creando entrada:", resultado.error);
    }

    return resultado;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO 5: CREAR SALIDA EN TENANT =====

export const ejemploCrearSalida = async (userId) => {
  try {
    console.log("🚀 Ejemplo: Crear salida en tenant");
    
    const datosSalida = {
      concepto: "Gastos operativos",
      subconcepto: "Servicios públicos",
      descripcion: "Pago de energía eléctrica marzo",
      monto: 850.75,
      fecha: new Date(),
      proveedor: "Empresa Eléctrica",
      metodoPago: "transferencia",
      referencia: "PAG-2026-005",
      notas: "Factura #123456",
    };

    const resultado = await createSalida(datosSalida, userId);

    if (resultado.success) {
      console.log("✅ Salida creada exitosamente:");
      console.log(`- ID: ${resultado.salidaId}`);
      console.log(`- Concepto: ${resultado.salida.concepto}`);
      console.log(`- Subconcepto: ${resultado.salida.subconcepto}`);
      console.log(`- Monto: $${resultado.salida.monto}`);
    } else {
      console.error("❌ Error creando salida:", resultado.error);
    }

    return resultado;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO 6: OBTENER TRANSACCIONES DEL TENANT =====

export const ejemploObtenerTransacciones = async (userId) => {
  try {
    console.log("🚀 Ejemplo: Obtener transacciones del tenant");
    
    const opciones = {
      fechaInicio: new Date(2026, 0, 1), // Enero 2026
      fechaFin: new Date(2026, 11, 31), // Diciembre 2026
      orderBy: "fecha",
      orderDirection: "desc",
      limitTo: 50,
    };

    const resultado = await getTransacciones(userId, opciones);

    if (resultado.success) {
      console.log("✅ Transacciones obtenidas exitosamente:");
      console.log(`- Total de transacciones: ${resultado.total}`);
      console.log("- Últimas 3 transacciones:");
      
      resultado.transacciones.slice(0, 3).forEach((transaccion, index) => {
        console.log(`  ${index + 1}. ${transaccion.concepto} - $${transaccion.monto} (${transaccion.tipo})`);
      });
    } else {
      console.error("❌ Error obteniendo transacciones:", resultado.error);
    }

    return resultado;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO 7: OBTENER RESUMEN FINANCIERO =====

export const ejemploResumenFinanciero = async (userId) => {
  try {
    console.log("🚀 Ejemplo: Obtener resumen financiero del tenant");
    
    const periodo = {
      inicio: new Date(2026, 2, 1), // Marzo 2026
      fin: new Date(2026, 2, 31), // Marzo 2026
    };

    const resultado = await getResumenFinanciero(userId, periodo);

    if (resultado.success) {
      const resumen = resultado.resumen;
      console.log("✅ Resumen financiero obtenido exitosamente:");
      console.log(`- Período: ${periodo.inicio.toLocaleDateString()} - ${periodo.fin.toLocaleDateString()}`);
      console.log(`- Total entradas: $${resumen.totales.entradas.amount} (${resumen.totales.entradas.count} transacciones)`);
      console.log(`- Total salidas: $${resumen.totales.salidas.amount} (${resumen.totales.salidas.count} transacciones)`);
      console.log(`- Balance neto: $${resumen.totales.balance}`);
      
      console.log("- Top 3 conceptos:");
      const conceptos = Object.entries(resumen.desglosePorConcepto).slice(0, 3);
      conceptos.forEach(([concepto, data], index) => {
        const balance = data.entradas.amount - data.salidas.amount;
        console.log(`  ${index + 1}. ${concepto}: $${balance}`);
      });
    } else {
      console.error("❌ Error obteniendo resumen:", resultado.error);
    }

    return resultado;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO 8: GESTIONAR MIEMBROS DEL TENANT =====

export const ejemploGestionarMiembros = async (adminUserId) => {
  try {
    console.log("🚀 Ejemplo: Gestionar miembros del tenant");
    
    // Obtener lista de miembros
    const miembrosResult = await getTenantMembers(adminUserId, adminUserId);
    
    if (miembrosResult.success) {
      console.log("✅ Miembros del tenant:");
      miembrosResult.members.forEach((miembro, index) => {
        console.log(`  ${index + 1}. ${miembro.email} - ${miembro.role} (${miembro.status})`);
      });

      // Buscar un contador para promocionar a admin
      const contador = miembrosResult.members.find(m => m.role === "contador");
      
      if (contador) {
        console.log(`\n🚀 Promoviendo contador ${contador.email} a admin...`);
        
        const updateResult = await updateTenantMemberRole(
          contador.tenantId,
          contador.uid,
          "admin",
          adminUserId
        );

        if (updateResult.success) {
          console.log("✅ Rol actualizado exitosamente");
        } else {
          console.error("❌ Error actualizando rol:", updateResult.error);
        }
      }
    } else {
      console.error("❌ Error obteniendo miembros:", miembrosResult.error);
    }

    return miembrosResult;
  } catch (error) {
    console.error("❌ Error inesperado:", error);
    return { success: false, error: error.message };
  }
};

// ===== EJEMPLO COMPLETO DE USO =====

export const ejemploCompletoMultiTenant = async () => {
  try {
    console.log("🎯 EJEMPLO COMPLETO: Sistema Multi-Tenant");
    console.log("=" .repeat(50));

    // 1. Registro de admin con tenant
    console.log("\n1️⃣ PASO 1: Registro de admin con nuevo tenant");
    const registroResult = await ejemploRegistroConNuevoTenant();
    
    if (!registroResult.success) {
      throw new Error("Fallo en registro inicial");
    }

    const adminUserId = registroResult.user.uid;
    const tenantId = registroResult.user.tenantId;

    // 2. Agregar contador al tenant
    console.log("\n2️⃣ PASO 2: Agregar contador al tenant");
    await ejemploAgregarUsuarioATenant(adminUserId, tenantId);

    // 3. Invitar viewer al tenant
    console.log("\n3️⃣ PASO 3: Invitar viewer al tenant");
    await ejemploInvitarUsuario(adminUserId, tenantId);

    // 4. Crear algunas entradas
    console.log("\n4️⃣ PASO 4: Crear entradas");
    await ejemploCrearEntrada(adminUserId);
    await ejemploCrearEntrada(adminUserId);

    // 5. Crear algunas salidas
    console.log("\n5️⃣ PASO 5: Crear salidas");
    await ejemploCrearSalida(adminUserId);
    await ejemploCrearSalida(adminUserId);

    // 6. Obtener transacciones
    console.log("\n6️⃣ PASO 6: Obtener transacciones del tenant");
    await ejemploObtenerTransacciones(adminUserId);

    // 7. Obtener resumen financiero
    console.log("\n7️⃣ PASO 7: Obtener resumen financiero");
    await ejemploResumenFinanciero(adminUserId);

    // 8. Gestionar miembros
    console.log("\n8️⃣ PASO 8: Gestionar miembros del tenant");
    await ejemploGestionarMiembros(adminUserId);

    console.log("\n🎉 ¡EJEMPLO COMPLETO EJECUTADO EXITOSAMENTE!");
    console.log("=" .repeat(50));

    return {
      success: true,
      adminUserId,
      tenantId,
    };

  } catch (error) {
    console.error("❌ Error en ejemplo completo:", error);
    return { success: false, error: error.message };
  }
};