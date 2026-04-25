
import { useStore } from '../frontend/src/store/useStore';

async function testFootprintSync() {
    console.log("🚀 Iniciando Test de Sincronización de Footprint (Pugobot v10)...");
    
    // 1. Simular estado inicial
    const timeframeSec = 60; // 1m
    const nowS = Math.floor(Date.now() / 1000);
    const currentMinute = Math.floor(nowS / timeframeSec) * timeframeSec;
    
    console.log(`⏱️ Minuto Actual Calculado: ${currentMinute}`);
    
    // 2. Simular llegada de ticks de una nueva vela (que el gráfico aún no conoce)
    const futureTickTime = (currentMinute + 60) * 1000; // Un minuto en el futuro
    const testTicks = [
        { time: futureTickTime, price: 26800, quantity: 10, aggressor: 1 }, // Buy
        { time: futureTickTime + 500, price: 26800.25, quantity: 15, aggressor: 0 } // Sell
    ];
    
    console.log("📥 Inyectando ticks de vela de VANGUARDIA...");
    useStore.getState().addTicksToFootprint(testTicks);
    
    // 3. Verificar si el Store ha creado la clave de tiempo correcta
    const data = useStore.getState().footprintData;
    const futureKey = (currentMinute + 60).toString();
    
    if (data[futureKey]) {
        console.log("✅ ÉXITO: El Store ha creado la vela de vanguardia proactivamente.");
        console.log("📊 Datos en vela:", data[futureKey]);
    } else {
        console.log("❌ FALLO: La vela de vanguardia NO ha sido creada. Los ticks podrían estar anclados a la vela anterior.");
        console.log("Keys disponibles:", Object.keys(data));
    }
}

testFootprintSync();
