# 🔧 BUGFIX: Velas no se mueven (precio sí)

**Fecha:** 2026-04-23

## Problema
El precio en el eje vertical se actualiza, pero las velas no se forman/mueven.

## Causas identificadas

### 1. Cálculo de tiempo inconsistente
- El código asumía que `message.time` podría estar en milisegundos (> 2000000000)
- Rithmic envía tiempo en **segundos**
- La conversión causaba desalineación temporal

### 2. Calibración de offset problemática
- La calibración automática aplicaba offset incluso cuando era pequeño
- Esto causaba drift en el cálculo de `candleTime`

### 3. Condición de filtrado muy estricta
- `candleTime >= lastBar.time` rechazaba ticks válidos
- Si había pequeños desfases, los ticks se descartaban

## Cambios aplicados

### ChartComponent.tsx

1. **Simplificar cálculo de tiempo** (línea ~1135):
```typescript
// ANTES: Conversión condicional compleja
const messageTimeSec = (messageTimeMs > 2000000000 ? Math.floor(messageTimeMs / 1000) : messageTimeMs) + serverOffset;

// DESPUÉS: Asumir segundos directamente
const messageTimeSec = Math.floor(messageTimeMs) + serverOffset;
```

2. **Mejorar calibración** (línea ~1070):
```typescript
// ANTES: Calibrar siempre
const calculatedOffset = barTime - expectedBarTime;
state.setServerOffset(calculatedOffset);

// DESPUÉS: Solo calibrar si offset es significativo
if (Math.abs(calculatedOffset) > 60) {
    state.setServerOffset(calculatedOffset);
}
```

3. **Relajar condición de tiempo** (línea ~1144):
```typescript
// ANTES: Estricto
if (candleTime >= (lastBar.time as number)) { ... }

// DESPUÉS: Permitir pequeños desfases
const isTimeValid = candleTime >= (lastBar.time as number) || Math.abs(timeDiff) < timeframeSeconds;
if (isTimeValid) { ... }
```

4. **Añadir logs de debug** para verificar:
- Tiempo actual del sistema
- Tiempo del mensaje
- Tiempo calculado de la vela
- Diferencia con la última vela

## Prueba

1. Hard refresh (Ctrl+F5)
2. Abrir DevTools → Console
3. Verificar logs:
   - `[WS] Timeframe: 1m = 60s`
   - `[WS] Debug time: now=XXXX, msgTime=XXXX, candleTime=XXXX, lastBar.time=XXXX`
   - `[WS] NUEVA VELA @ XXXX, price=XXXX` o `[WS] UPDATE VELA @ XXXX`

## Si sigue sin funcionar

Revisar en los logs:
1. ¿El `timeframe` es correcto? (debería ser "1m" = 60s)
2. ¿El `msgTime` es razonable? (debería ser cercano a `now`)
3. ¿La diferencia `candleTime - lastBar.time` es positiva?
