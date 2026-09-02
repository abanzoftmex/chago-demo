import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { transactionService } from "./transactionService";
import { generalService } from "./generalService";
import { conceptService } from "./conceptService";

/**
 * El arrastre vive DENTRO del tenant.
 *
 * Estaba en una coleccion raiz `monthly_carryover` con clave `YYYY-MM` a
 * secas: un solo documento para todos los tenants, que ademas se suma al
 * balance total del reporte y sale impreso en el PDF. Cualquiera que abriera
 * Reportes lo recalculaba y el numero pasaba a verse en los demas.
 */
const carryoverPath = (tenantId) => {
  if (!tenantId) throw new Error("Tenant ID es requerido para el arrastre mensual");
  return `tenants/${tenantId}/monthly_carryover`;
};

export const carryoverService = {
  // Calcular y guardar el arrastre del mes anterior
  async calculateAndSaveCarryover(year, month, tenantId) {
    try {
      // Obtener el mes anterior
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;

      // Definir el rango de fechas del mes anterior
      const startDate = new Date(prevYear, prevMonth - 1, 1);
      const endDate = new Date(prevYear, prevMonth, 0); // Último día del mes anterior

      console.log(`Calculando arrastre para ${month}/${year} basado en ${prevMonth}/${prevYear}`);
      console.log(`Rango: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      // Obtener todas las transacciones del mes anterior usando el mismo método que los reportes
      const transactions = await transactionService.getByDateRange(startDate, endDate, {}, tenantId);
      
      console.log(`🔍 ARRASTRE: Transacciones obtenidas del ${startDate.toISOString().split('T')[0]} al ${endDate.toISOString().split('T')[0]}: ${transactions.length}`);

      // Calcular totales del mes anterior (método manual por ahora)
      let totalIngresos = 0;
      let totalGastosPagados = 0;

      transactions.forEach(transaction => {
        if (transaction.type === 'entrada') {
          totalIngresos += transaction.amount || 0;
        } else if (transaction.type === 'salida') {
          // Solo contar gastos que ya fueron pagados (no pendientes)
          if (transaction.status === 'pagado') {
            totalGastosPagados += transaction.amount || 0;
          }
        }
      });
      
      console.log(`📊 ARRASTRE: Totales calculados - Ingresos: ${totalIngresos}, Gastos pagados: ${totalGastosPagados}`);

      // Obtener el arrastre que tenía el mes anterior (si existía)
      let arrastePrevio = 0;
      try {
        const prevCarryover = await this.getCarryoverForMonth(prevYear, prevMonth, tenantId);
        if (prevCarryover && prevCarryover.saldoArrastre > 0) {
          arrastePrevio = prevCarryover.saldoArrastre;
          console.log(`Arrastre previo encontrado para ${prevMonth}/${prevYear}: ${arrastePrevio}`);
        }
      } catch (error) {
        console.log(`No hay arrastre previo para ${prevMonth}/${prevYear}`);
      }

      // Calcular el saldo disponible para arrastre
      // Fórmula: (Ingresos del mes anterior + Arrastre previo) - Gastos pagados del mes anterior
      const saldoArrastre = (totalIngresos + arrastePrevio) - totalGastosPagados;

      console.log(`Mes ${prevMonth}/${prevYear}:`);
      console.log(`- Ingresos: ${totalIngresos}`);
      console.log(`- Arrastre previo: ${arrastePrevio}`);
      console.log(`- Gastos pagados: ${totalGastosPagados}`);
      console.log(`- Saldo para arrastrar: ${saldoArrastre}`);

      // Crear el registro de arrastre
      const carryoverData = {
        year: year,
        month: month,
        previousYear: prevYear,
        previousMonth: prevMonth,
        totalIngresos: totalIngresos,
        arrastePrevio: arrastePrevio,
        totalGastosPagados: totalGastosPagados,
        saldoArrastre: saldoArrastre > 0 ? saldoArrastre : 0, // No arrastrar saldos negativos
        calculatedAt: serverTimestamp(),
        transactionsCount: transactions.length
      };

      // Guardar en Firestore usando un ID único basado en año y mes
      const docId = `${year}-${month.toString().padStart(2, '0')}`;
      await setDoc(doc(db, carryoverPath(tenantId), docId), carryoverData);

      console.log(`Arrastre guardado para ${month}/${year}: ${saldoArrastre > 0 ? saldoArrastre : 0}`);

      return carryoverData;
    } catch (error) {
      console.error("Error calculating carryover:", error);
      throw new Error("Error al calcular el arrastre");
    }
  },

  // Obtener el arrastre de un mes específico
  async getCarryoverForMonth(year, month, tenantId) {
    try {
      const docId = `${year}-${month.toString().padStart(2, '0')}`;
      console.log(`🔍 Buscando documento de arrastre: ${docId}`);
      
      const docRef = doc(db, carryoverPath(tenantId), docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        console.log(`✅ Documento encontrado:`, data);
        return data;
      } else {
        console.log(`❌ Documento no encontrado: ${docId}`);
        return null;
      }
    } catch (error) {
      console.error("Error getting carryover:", error);
      throw new Error("Error al obtener el arrastre");
    }
  },

  // Inicializar el sistema de arrastre (para el mes actual)
  async initializeCarryoverSystem(tenantId) {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

      console.log(`Inicializando sistema de arrastre para ${currentMonth}/${currentYear}`);

      // Verificar si ya existe el arrastre para el mes actual
      const existingCarryover = await this.getCarryoverForMonth(currentYear, currentMonth, tenantId);
      
      if (existingCarryover) {
        console.log(`Ya existe arrastre para ${currentMonth}/${currentYear}:`, existingCarryover.saldoArrastre);
        return existingCarryover;
      }

      // Calcular y guardar el arrastre del mes anterior al actual
      const carryoverData = await this.calculateAndSaveCarryover(currentYear, currentMonth, tenantId);
      
      return carryoverData;
    } catch (error) {
      console.error("Error initializing carryover system:", error);
      throw new Error("Error al inicializar el sistema de arrastre");
    }
  },

  // Obtener todos los arrastres históricos
  async getAllCarryovers(tenantId) {
    try {
      const q = query(
        collection(db, carryoverPath(tenantId)),
        orderBy("year", "desc"),
        orderBy("month", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const carryovers = [];
      
      querySnapshot.forEach((doc) => {
        carryovers.push({ id: doc.id, ...doc.data() });
      });
      
      return carryovers;
    } catch (error) {
      console.error("Error getting all carryovers:", error);
      throw new Error("Error al obtener historial de arrastres");
    }
  },

  // Verificar si ya existe una transacción de arrastre para un mes específico
  async carryoverTransactionExists(year, month, tenantId) {
    try {
      const transactions = await transactionService.getAll({
        type: "entrada"
      }, tenantId);

      // Buscar transacciones de arrastre para el mes específico
      const carryoverExists = transactions.some(transaction => {
        if (!transaction.isCarryover) return false;
        
        const transactionDate = transaction.date?.toDate ? transaction.date.toDate() : new Date(transaction.date);
        return transactionDate.getFullYear() === year && (transactionDate.getMonth() + 1) === month;
      });

      return carryoverExists;
    } catch (error) {
      console.error("Error checking carryover transaction existence:", error);
      return false;
    }
  },

  // Crear un ingreso de arrastre para el mes actual
  async createCarryoverIncomeTransaction(carryoverAmount, previousYear, previousMonth, user, tenantId) {
    try {
      if (carryoverAmount <= 0) {
        console.log("No hay saldo positivo para arrastrar");
        return null;
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      // Verificar si ya existe una transacción de arrastre para este mes
      const exists = await this.carryoverTransactionExists(currentYear, currentMonth, tenantId);
      if (exists) {
        throw new Error(`Ya existe una transacción de arrastre para ${currentMonth}/${currentYear}`);
      }

      // Crear o obtener los conceptos especiales para arrastre
      const carryoverGeneral = await this.getOrCreateCarryoverGeneral(tenantId);
      const carryoverConcept = await this.getOrCreateCarryoverConcept(tenantId);

      const prevMonthName = new Date(previousYear, previousMonth - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

      const transactionData = {
        type: 'entrada',
        amount: carryoverAmount,
        date: now,
        description: `💰 ARRASTRE - Saldo del ${prevMonthName}`,
        conceptId: carryoverConcept.id,
        generalId: carryoverGeneral.id,
        isCarryover: true,
        carryoverInfo: {
          fromYear: previousYear,
          fromMonth: previousMonth,
          toYear: currentYear,
          toMonth: currentMonth,
          calculatedAt: now
        },
        status: 'confirmado'
      };

      const transaction = await transactionService.create(transactionData, user, tenantId);
      
      console.log(`Transacción de arrastre creada: ${carryoverAmount} de ${previousMonth}/${previousYear}`);
      
      return transaction;
    } catch (error) {
      console.error("Error creating carryover transaction:", error);
      throw error;
    }
  },

  // Obtener o crear la categoría general para arrastre
  async getOrCreateCarryoverGeneral(tenantId) {
    try {
      // Buscar si ya existe
      const generals = await generalService.getAll(tenantId);
      let carryoverGeneral = generals.find(g => g.name === 'Arrastre de Saldo' && g.type === 'entrada');
      
      if (!carryoverGeneral) {
        // Crear la categoría general
        carryoverGeneral = await generalService.create({
          name: 'Arrastre de Saldo',
          type: 'entrada',
          description: 'Categoría para ingresos de arrastre de saldo de meses anteriores',
          isSystem: true
        }, tenantId);
        console.log('Categoría general de arrastre creada:', carryoverGeneral.id);
      }
      
      return carryoverGeneral;
    } catch (error) {
      console.error("Error getting/creating carryover general:", error);
      throw new Error("Error al crear categoría general de arrastre");
    }
  },

  // Obtener o crear el concepto para arrastre
  async getOrCreateCarryoverConcept(tenantId) {
    try {
      // Buscar si ya existe
      const concepts = await conceptService.getAll(tenantId);
      let carryoverConcept = concepts.find(c => c.name === 'Saldo Arrastrado');
      
      if (!carryoverConcept) {
        // Crear el concepto
        carryoverConcept = await conceptService.create({
          name: 'Saldo Arrastrado',
          description: 'Concepto para ingresos de saldo arrastrado del mes anterior',
          isSystem: true
        }, tenantId);
        console.log('Concepto de arrastre creado:', carryoverConcept.id);
      }
      
      return carryoverConcept;
    } catch (error) {
      console.error("Error getting/creating carryover concept:", error);
      throw new Error("Error al crear concepto de arrastre");
    }
  },

  // Ejecutar proceso completo de arrastre para el mes actual
  async processMonthlyCarryover(user, tenantId) {
    try {
      // Inicializar el sistema de arrastre
      const carryoverData = await this.initializeCarryoverSystem(tenantId);
      
      // Si hay saldo positivo, crear la transacción de ingreso
      let carryoverTransaction = null;
      if (carryoverData.saldoArrastre > 0) {
        carryoverTransaction = await this.createCarryoverIncomeTransaction(
          carryoverData.saldoArrastre, 
          carryoverData.previousYear,
          carryoverData.previousMonth,
          user,
          tenantId
        );
      }

      return {
        carryoverData,
        carryoverTransaction,
        message: carryoverData.saldoArrastre > 0 
          ? `Arrastre de ${carryoverData.saldoArrastre.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} aplicado del ${carryoverData.previousMonth}/${carryoverData.previousYear}`
          : `No hay saldo positivo para arrastrar del ${carryoverData.previousMonth}/${carryoverData.previousYear}`
      };
    } catch (error) {
      console.error("Error processing monthly carryover:", error);
      throw error;
    }
  },

  // Verificar y calcular arrastre automáticamente si es necesario para el mes actual
  async checkAndCalculateCarryoverIfNeeded(tenantId) {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      console.log(`🔍 Verificando arrastre para ${currentMonth}/${currentYear}...`);

      // Verificar si ya existe el cálculo del arrastre para este mes
      let carryoverData = await this.getCarryoverForMonth(currentYear, currentMonth, tenantId);
      
      if (carryoverData) {
        console.log(`✅ Arrastre ya calculado para ${currentMonth}/${currentYear}:`, carryoverData.saldoArrastre);
        return {
          alreadyCalculated: true,
          carryoverData: carryoverData,
          message: `Arrastre ya calculado: ${carryoverData.saldoArrastre.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} del ${carryoverData.previousMonth}/${carryoverData.previousYear}`
        };
      } else {
        // Calcular el arrastre por primera vez
        console.log(`🧮 Calculando arrastre para ${currentMonth}/${currentYear} por primera vez...`);
        carryoverData = await this.calculateAndSaveCarryover(currentYear, currentMonth, tenantId);
        
        return {
          calculated: true,
          carryoverData: carryoverData,
          message: `Arrastre calculado: ${carryoverData.saldoArrastre.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })} del ${carryoverData.previousMonth}/${carryoverData.previousYear}`
        };
      }
    } catch (error) {
      console.error("Error checking and calculating carryover:", error);
      // No lanzar error para no romper la carga de reportes
      return {
        error: true,
        message: `Error al verificar arrastre: ${error.message}`
      };
    }
  },

  // Obtener información del arrastre incluyendo su estado
  async getCarryoverStatus(year, month, tenantId) {
    try {
      console.log(`🔍 getCarryoverStatus: Verificando arrastre para ${month}/${year}`);
      const carryoverData = await this.getCarryoverForMonth(year, month, tenantId);
      
      console.log(`📊 getCarryoverStatus: Resultado carryoverData:`, carryoverData);
      
      const result = {
        data: carryoverData,
        calculated: !!carryoverData,
        hasPositiveBalance: carryoverData && carryoverData.saldoArrastre > 0
      };
      
      console.log(`✅ getCarryoverStatus: Estado final:`, result);
      
      return result;
    } catch (error) {
      console.error("Error getting carryover status:", error);
      return {
        data: null,
        calculated: false,
        hasPositiveBalance: false
      };
    }
  }
};
