import { carryoverService } from "../../../lib/services/carryoverService";
import { transactionService } from "../../../lib/services/transactionService";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { year, month } = req.query;
    
    if (!year || !month) {
      return res.status(400).json({ 
        message: 'Se requieren parámetros year y month',
        example: '/api/debug/carryover-info?year=2025&month=10'
      });
    }

    const yearInt = parseInt(year);
    const monthInt = parseInt(month);

    console.log(`🔍 DEBUG: Obteniendo información de arrastre para ${monthInt}/${yearInt}`);

    // 1. Obtener el arrastre registrado para este mes
    const carryoverData = await carryoverService.getCarryoverForMonth(yearInt, monthInt);
    
    // 2. Obtener todas las transacciones del mes anterior para verificar cálculo
    const prevMonth = monthInt === 1 ? 12 : monthInt - 1;
    const prevYear = monthInt === 1 ? yearInt - 1 : yearInt;
    
    const startDate = new Date(prevYear, prevMonth - 1, 1);
    const endDate = new Date(prevYear, prevMonth, 0);
    
    const prevMonthTransactions = await transactionService.getByDateRange(startDate, endDate);
    
    // 3. Calcular totales del mes anterior manualmente
    let totalIngresos = 0;
    let totalGastosPagados = 0;
    let totalGastosPendientes = 0;
    
    prevMonthTransactions.forEach(transaction => {
      if (transaction.type === 'entrada') {
        totalIngresos += transaction.amount || 0;
      } else if (transaction.type === 'salida') {
        if (transaction.status === 'pagado') {
          totalGastosPagados += transaction.amount || 0;
        } else if (transaction.status === 'pendiente') {
          totalGastosPendientes += transaction.amount || 0;
        }
      }
    });

    // 4. Obtener arrastre del mes anterior al anterior
    let arrastePrevio = 0;
    try {
      const prevCarryover = await carryoverService.getCarryoverForMonth(prevYear, prevMonth);
      if (prevCarryover && prevCarryover.saldoArrastre > 0) {
        arrastePrevio = prevCarryover.saldoArrastre;
      }
    } catch (error) {
      console.log(`No hay arrastre previo para ${prevMonth}/${prevYear}`);
    }

    // 5. Calcular saldo teórico
    const saldoTeórico = (totalIngresos + arrastePrevio) - totalGastosPagados;

    // 6. Obtener gastos pendientes actuales
    const currentStartDate = new Date(yearInt, monthInt - 1, 1);
    const currentEndDate = new Date(yearInt, monthInt, 0);
    const currentTransactions = await transactionService.getByDateRange(currentStartDate, currentEndDate);
    
    let gastosPendientesActuales = 0;
    currentTransactions.forEach(transaction => {
      if (transaction.type === 'salida' && transaction.status === 'pendiente') {
        gastosPendientesActuales += transaction.amount || 0;
      }
    });

    const debugInfo = {
      consultado: {
        year: yearInt,
        month: monthInt,
        fecha: new Date().toISOString()
      },
      arrastre_registrado: carryoverData,
      calculo_manual: {
        mes_anterior: `${prevMonth}/${prevYear}`,
        rango_fechas: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`,
        transacciones_procesadas: prevMonthTransactions.length,
        total_ingresos: totalIngresos,
        arrastre_previo: arrastePrevio,
        total_gastos_pagados: totalGastosPagados,
        total_gastos_pendientes: totalGastosPendientes,
        saldo_teorico: saldoTeórico,
        formula: `(${totalIngresos} + ${arrastePrevio}) - ${totalGastosPagados} = ${saldoTeórico}`
      },
      mes_actual: {
        gastos_pendientes_actuales: gastosPendientesActuales,
        transacciones_actuales: currentTransactions.length
      },
      comparacion: {
        registrado_vs_calculado: carryoverData ? carryoverData.saldoArrastre - saldoTeórico : 'No registrado',
        coincide: carryoverData ? Math.abs(carryoverData.saldoArrastre - saldoTeórico) < 0.01 : false
      }
    };

    res.status(200).json(debugInfo);

  } catch (error) {
    console.error('[DEBUG] Error obteniendo información de arrastre:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo información de arrastre',
      error: error.message
    });
  }
}
