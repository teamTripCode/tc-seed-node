// Importar la biblioteca node-os-utils
const osUtils = require('node-os-utils');

// Función para probar las métricas del sistema
async function testMetrics() {
  try {
    // Obtener los módulos de CPU y memoria
    const cpu = osUtils.cpu;
    const mem = osUtils.mem;

    // Obtener el uso de CPU (en porcentaje)
    const cpuUsage = await cpu.usage();

    // Obtener información de memoria
    const memInfo = await mem.info();
    const memoryUsage = 100 - memInfo.freeMemPercentage; // Calcular el uso de memoria

    // Imprimir los resultados en la consola
    console.log(`CPU Usage: ${cpuUsage}%`);
    console.log(`Memory Usage: ${memoryUsage}%`);
  } catch (error) {
    // Manejar errores
    console.error(`Error al obtener métricas del sistema: ${error.message}`);
  }
}

// Ejecutar la función
testMetrics();