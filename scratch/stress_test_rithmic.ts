
import { useStore } from '../frontend/src/store/useStore';

async function stressTestRithmic() {
    console.log("🔥 Iniciando Test de Estrés RITHMIC (v11)...");
    
    const timeframeSec = 60;
    const nowS = Math.floor(Date.now() / 1000);
    const cTime = Math.floor(nowS / timeframeSec) * timeframeSec;
    
    // Simular una caída masiva (10,000 ticks en ráfaga)
    const bigBurst = Array.from({ length: 10000 }).map((_, i) => ({
        time: (nowS * 1000) + i,
        price: 26800 - (i * 0.01),
        quantity: Math.floor(Math.random() * 100) + 1,
        aggressor: Math.random() > 0.5 ? 1 : 0
    }));

    console.time("⏱️ Tiempo de Procesamiento Store");
    useStore.getState().addTicksToFootprint(bigBurst);
    console.timeEnd("⏱️ Tiempo de Procesamiento Store");

    const data = useStore.getState().footprintData;
    const keys = Object.keys(data);
    
    console.log(`✅ Velas procesadas: ${keys.length}`);
    if (data[cTime]) {
        const pricesCount = Object.keys(data[cTime]).length;
        console.log(`📊 Niveles de precio creados en vela actual: ${pricesCount}`);
    } else {
        console.log("❌ ERROR: La vela actual no recibió datos.");
    }
    
    // Verificar si el lastTickTime se actualizó
    console.log(`💓 Pulso actual: ${useStore.getState().lastTickTime}`);
}

stressTestRithmic();
