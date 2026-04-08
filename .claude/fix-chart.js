// Script para generar el fix del ChartComponent.tsx
// Este código corrige la actualización en tiempo real del gráfico

const fixCode = `
// Reemplazar el useEffect del WebSocket (línea 129-182) con esta versión mejorada:

useEffect(() => {
    if (!symbol) return;

    const ws = new WebSocket(\`ws://localhost:8001/ws/prices/\${symbol}\`);

    // Intervalo de respaldo para actualizar aunque no lleguen ticks
    let heartbeatInterval: NodeJS.Timeout;

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);

        if (message.type === 'tick_burst' && message.data && message.data.length > 0) {
            const ticks = message.data;
            const state = useStore.getState();
            const lastBar = state.data[state.data.length - 1];

            if (!lastBar) return;

            // Usar el último tick de la ráfaga
            const lastTick = ticks[ticks.length - 1];

            // FIX 1: Usar bid/ask cuando last es 0 (BTCUSD no reporta transacciones)
            const price = (lastTick.last && lastTick.last > 0)
                ? lastTick.last
                : (lastTick.bid > 0 ? lastTick.bid : lastTick.ask);

            // FIX 2: Usar tiempo actual para forzar actualización visual
            const now = Date.now();
            const timeInSeconds = Math.floor(now / 1000);

            // FIX 3: Solo actualizar si el precio ha cambiado significativamente
            const priceDiff = Math.abs(lastBar.close - price);
            const minTickSize = 0.01; // Ajustar según el símbolo

            if (priceDiff >= minTickSize || timeInSeconds !== (lastBar.time as number)) {
                const updatedBar = {
                    ...lastBar,
                    time: timeInSeconds as any,
                    close: price,
                    high: Math.max(lastBar.high, price),
                    low: Math.min(lastBar.low, price),
                };

                state.addBar(updatedBar);
                seriesRef.current?.update(updatedBar as any);
            }

            if (state.isFootprintEnabled) state.addTicksToFootprint(ticks);
        }
        else if (message.type === 'heartbeat') {
            // FIX 4: Forzar actualización aunque no haya ticks nuevos
            const state = useStore.getState();
            const lastBar = state.data[state.data.length - 1];
            if (lastBar) {
                // Obtener precio actual directo de MT5 via store o recacular
                const now = Date.now();
                const timeInSeconds = Math.floor(now / 1000);

                if (timeInSeconds !== (lastBar.time as number)) {
                    const updatedBar = {
                        ...lastBar,
                        time: timeInSeconds as any,
                    };
                    state.addBar(updatedBar);
                    seriesRef.current?.update(updatedBar as any);
                }
            }
        }
    };

    // FIX 5: Intervalo de respaldo que fuerza actualización cada segundo
    heartbeatInterval = setInterval(() => {
        const state = useStore.getState();
        const lastBar = state.data[state.data - 1];
        if (lastBar && ws.readyState === WebSocket.OPEN) {
            const now = Date.now();
            const timeInSeconds = Math.floor(now / 1000);

            if (timeInSeconds !== (lastBar.time as number)) {
                ws.send(JSON.stringify({ type: 'force_update' }));
            }
        }
    }, 1000);

    return () => {
        clearInterval(heartbeatInterval);
        ws.close();
    };
}, [symbol]);
`;

console.log(fixCode);
