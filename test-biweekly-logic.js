// Test específico para la nueva lógica quincenal
// Ejecutar con: node test-biweekly-logic.js

const testBiweeklyLogic = () => {
  console.log('🧪 Test: Nueva lógica quincenal (día 15 y penúltimo del mes)\n');

  // Función que replica la lógica del servidor
  const shouldGenerateForBiweekly = (currentDate) => {
    const day = currentDate.getDate();
    const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const dayBeforeLast = lastDayOfMonth - 1;
    return day === 15 || day === dayBeforeLast;
  };

  // Tests para diferentes fechas
  const testDates = [
    // Enero 2025 (31 días)
    { date: new Date(2025, 0, 15), expected: true, description: 'Enero 15 (debe generar)' },
    { date: new Date(2025, 0, 30), expected: true, description: 'Enero 30 (penúltimo, debe generar)' },
    { date: new Date(2025, 0, 31), expected: false, description: 'Enero 31 (último, NO debe generar)' },
    
    // Febrero 2025 (28 días)
    { date: new Date(2025, 1, 15), expected: true, description: 'Febrero 15 (debe generar)' },
    { date: new Date(2025, 1, 27), expected: true, description: 'Febrero 27 (penúltimo, debe generar)' },
    { date: new Date(2025, 1, 28), expected: false, description: 'Febrero 28 (último, NO debe generar)' },
    
    // Abril 2025 (30 días)
    { date: new Date(2025, 3, 15), expected: true, description: 'Abril 15 (debe generar)' },
    { date: new Date(2025, 3, 29), expected: true, description: 'Abril 29 (penúltimo, debe generar)' },
    { date: new Date(2025, 3, 30), expected: false, description: 'Abril 30 (último, NO debe generar)' },
    
    // Días aleatorios (no deben generar)
    { date: new Date(2025, 0, 10), expected: false, description: 'Enero 10 (día aleatorio, NO debe generar)' },
    { date: new Date(2025, 1, 20), expected: false, description: 'Febrero 20 (día aleatorio, NO debe generar)' }
  ];

  let passed = 0;
  let failed = 0;

  testDates.forEach(test => {
    const result = shouldGenerateForBiweekly(test.date);
    const status = result === test.expected ? '✅' : '❌';
    
    if (result === test.expected) {
      passed++;
    } else {
      failed++;
    }
    
    console.log(`${status} ${test.description}`);
    if (result !== test.expected) {
      console.log(`   Esperado: ${test.expected}, Obtenido: ${result}`);
    }
  });

  console.log(`\n📊 Resultados:`);
  console.log(`   ✅ Pasaron: ${passed}`);
  console.log(`   ❌ Fallaron: ${failed}`);
  console.log(`   📈 Éxito: ${Math.round((passed / testDates.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 ¡Todos los tests pasaron! La lógica quincenal funciona correctamente.');
  } else {
    console.log('\n⚠️ Algunos tests fallaron. Revisar la lógica.');
  }

  // Mostrar resumen de cuándo se generarán transacciones en 2025
  console.log('\n📅 Resumen de generación quincenal para 2025:');
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  
  months.forEach((monthName, index) => {
    const lastDay = new Date(2025, index + 1, 0).getDate();
    const penultimate = lastDay - 1;
    console.log(`   ${monthName}: día 15 y ${penultimate}`);
  });
};

// Ejecutar test
testBiweeklyLogic();
