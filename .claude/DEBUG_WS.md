# 🔍 DEBUG WebSocket - Velas no se mueven

## Estado actual
- `[WS] Error for NAS100.fs: error` - Error de conexión WebSocket
- Las velas no se mueven
- El precio en eje vertical sí se actualiza (intermitente)

## Cambios aplicados para debug

### 1. Logs de mensajes (línea ~1060)
```typescript
console.log(`[WS] Msg #${msgCount} type=${message.type}:`, ...);
```

### 2. Log de error detallado (línea ~1043)
```typescript
console.error(`[WS] Error for ${symbol}:`, err);
console.error(`[WS] WebSocket readyState: ${ws?.readyState}`);
```

### 3. Log de mensaje raw (línea ~1063)
```typescript
console.log('[WS] Mensaje raw:', JSON.stringify(message).substring(0, 200));
```

## Prueba

1. **Hard refresh** (Ctrl+F5)
2. **Abrir DevTools** → Console
3. **Verificar logs:**

### Si ves `[WS] Msg #1 type=...`:
- Los mensajes SÍ están llegando
- El problema está en el procesamiento

### Si NO ves mensajes de llegada:
- El backend no está enviando datos
- O hay un error de conexión

### Si ves `[WS] Error for NAS100.fs: [Event]`:
- Hay un error de conexión
- Verificar que el backend esté corriendo en `http://127.0.0.1:8000`

## Verificación del backend

```bash
# En terminal, verificar si el backend responde
curl http://127.0.0.1:8000/api/ping

# Debería responder: {"status": "ok", "time": ...}
```

## Si el backend no responde

1. **Iniciar backend:**
```bash
cd backend
python -m app.main
```

2. **Verificar logs del backend** en `backend_debug.log`

## Si el backend SÍ responde pero WS falla

Posibles causas:
1. **CORS** - El backend no acepta conexiones desde `localhost:5174`
2. **Rithmic no conectado** - El backend necesita credenciales de Rithmic
3. **Firewall** - Bloqueando puerto 8000

## Prueba manual del WS

Abrir en navegador:
```
http://localhost:8000/docs
```

O probar con script de diagnóstico:
```bash
# En consola del navegador (DevTools)
const ws = new WebSocket('ws://127.0.0.1:8000/ws/orderflow/NAS100.fs');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onerror = (e) => console.error('Error:', e);
```
