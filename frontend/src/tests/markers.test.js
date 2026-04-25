/**
 * TEST UNITARIO: Deduplicación de Marcadores
 * Objetivo: Asegurar que el array final enviado a setMarkers() NO contenga duplicados de tiempo.
 */

function validateMarkers(allMarkers, deltaMarkers) {
    const finalMarkerMap = new Map();
    
    // Simulación de la lógica de ChartComponent.tsx
    allMarkers.forEach(m => {
        // Forzamos normalización de la clave (integer)
        const timeKey = Math.floor(Number(m.time));
        finalMarkerMap.set(timeKey, { ...m, time: timeKey });
    });
    
    deltaMarkers.forEach(m => {
        const timeKey = Math.floor(Number(m.time));
        finalMarkerMap.set(timeKey, { ...m, time: timeKey });
    });

    const finalArray = Array.from(finalMarkerMap.values());
    
    // Verificación de integridad
    const seen = new Set();
    const duplicates = [];
    finalArray.forEach(m => {
        if (seen.has(m.time)) duplicates.push(m.time);
        seen.add(m.time);
    });

    return {
        total: finalArray.length,
        duplicates: duplicates,
        isValid: duplicates.length === 0
    };
}

// CASO DE PRUEBA: Colisión de Tipos (String vs Number) y Floating Point
const allMarkers = [
    { time: 1713390000, text: 'Indicator' },
    { time: "1713390060", text: 'Signal' }
];

const deltaMarkers = [
    { time: 1713390000.0001, text: 'Delta +10' }, // Colisión con Indicator
    { time: 1713390120, text: 'Delta -5' }
];

const result = validateMarkers(allMarkers, deltaMarkers);

console.log('--- RESULTADO DEL TEST ---');
console.log('Total marcadores:', result.total);
console.log('Duplicados encontrados:', result.duplicates);
console.log('¿Es válido?:', result.isValid ? 'SÍ ✅' : 'NO ❌');

if (!result.isValid || result.total !== 3) {
    console.error('ERROR: La deduplicación falló.');
    process.exit(1);
} else {
    console.log('TEST PASADO: No hay apilamiento posible.');
}
