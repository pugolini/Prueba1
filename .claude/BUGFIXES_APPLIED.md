# 🐛 BUGFIXES APLICADOS - Errores de Carga

**Fecha:** 2026-04-23  
**Errores corregidos:** 2 críticos

---

## ❌ ERROR #1: Invalid Hook Call (useMemo dentro de useEffect)

**Archivo:** `frontend/src/components/Chart/ChartComponent.tsx`  
**Línea:** ~1321  
**Error:** `Invalid hook call. Hooks can only be called inside of the body of a function component.`

### Causa:
```typescript
// ❌ MAL: useMemo dentro de useEffect
useEffect(() => {
    const uniqueDeltaMarkers = useMemo(() => { ... }, [...]);
}, [...]);
```

### Solución:
```typescript
// ✅ BIEN: Lógica normal sin useMemo
useEffect(() => {
    const uniqueDeltaMarkers: any[] = [];
    deltaMarkersArray.reverse().forEach(m => { ... });
}, [...]);
```

---

## ❌ ERROR #2: WebSocket se cierra inmediatamente (React StrictMode)

**Archivo:** `frontend/src/components/Chart/ChartComponent.tsx`  
**Líneas:** ~972-1000  
**Error:** `[WS] Cleanup: cerrando conexión` inmediatamente después de `[WS] Intentando conectar`

### Causa:
React StrictMode monta/desmonta/remonta componentes para detectar efectos mal implementados. El efecto del WebSocket se ejecutaba, creaba una conexión, y el cleanup la cerraba inmediatamente.

### Solución:
```typescript
// 🛡️ GUARDIA ANTI-DOBLE EJECUCIÓN (React StrictMode)
const wsKey = `ws_effect_${symbol}`;
const existingWs = (window as any)[wsKey];
if (existingWs && (existingWs.readyState === WebSocket.OPEN || existingWs.readyState === WebSocket.CONNECTING)) {
    console.log(`[WS] Efecto ya activo para ${symbol}, saltando...`);
    return;
}

// Guardar referencia global
(window as any)[wsKey] = ws;

// Cleanup solo cierra si es el dueño
if (ws && ws === currentWs) {
    ws.close(1000, 'Component unmount');
    (window as any)[wsKey] = null;
}
```

---

## 📋 OTROS ERRORES (No críticos)

### ⚠️ Warning: Tailwind CDN
```
cdn.tailwindcss.com should not be used in production
```
**Estado:** Warning de desarrollo, no afecta funcionamiento.
**Solución futura:** Migrar a PostCSS plugin.

### ⚠️ Warning: Zustand deprecated
```
[DEPRECATED] Use `createWithEqualityFn` instead of `create`
```
**Estado:** Warning, no afecta funcionamiento.
**Solución futura:** Migrar a nueva API de Zustand.

---

## ✅ ESTADO ACTUAL

| Error | Estado |
|-------|--------|
| Invalid hook call | ✅ CORREGIDO |
| WebSocket cierra inmediatamente | ✅ CORREGIDO |
| Tailwind CDN warning | ⚠️ No crítico |
| Zustand deprecated | ⚠️ No crítico |

---

## 🧪 PRUEBA RECOMENDADA

1. **Hard refresh** (Ctrl+F5)
2. **Verificar en consola:**
   - No debe aparecer `Invalid hook call`
   - Debe aparecer `[WS] Open for NAS100.fs` y mantenerse
   - No debe aparecer `[WS] Cleanup: cerrando conexión` inmediatamente

3. **Verificar que el precio se actualiza:**
   - El precio en el chart debe cambiar
   - Debe aparecer `[WS] price_update recibido: XXXX.XX`

---

*Bugfixes aplicados por Equipo Pugobot*
