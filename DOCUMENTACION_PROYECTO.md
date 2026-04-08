# Documentación Técnica: Pugobot Trading Terminal

## 🚀 Resumen del Sistema
**Pugobot Trading Terminal** es un entorno de trading algorítmico de alto rendimiento que conecta **React (Frontend)** con **MetaTrader 5 (Backend)** a través de una API de alto rendimiento fabricada en **FastAPI**. El sistema permite análisis técnico avanzado mediante el motor **Vortex JS**, ofreciendo una experiencia similar a TradingView con ejecución de órdenes en tiempo real.

---

## 🏗️ Arquitectura de Comunicación
El sistema utiliza un modelo de tres capas para garantizar baja latencia y alta fidelidad:

1.  **Backend (FastAPI + MT5)**:
    -   **REST API**: Para datos históricos y gestión de órdenes.
    -   **WebSockets**: Streaming de precios tick-a-tick directamente desde el servidor MT5.
    -   **Singleton Service**: `MT5Service` gestiona la conexión única con el terminal MetaTrader.

2.  **Frontend (React + Zustand + Lightweight Charts)**:
    -   **Atomic State**: Zustand centraliza el estado (precios, dibujos, indicadores).
    -   **High-Fidelity Rendering**: `lightweight-charts` (TradingView) para una visualización fluida.
    -   **Vortex JS Engine**: Un runtime de JavaScript personalizado que ejecuta indicadores complejos (Vortex/Pine) directamente en el cliente.

3.  **Persistence**:
    -   **LocalStorage**: Almacena dibujos del gráfico, scripts personalizados de la biblioteca y preferencias de tema (Dark/Light).

---

## 🌪️ El Motor Vortex JS
El motor Vortex JS (`vortexEngine.ts`) es la joya de la corona. Permite ejecutar lógica de análisis técnico personalizada sobre el flujo de datos en tiempo real.

### API de Scripting
| Función | Descripción |
| :--- | :--- |
| `ta.sma / ta.ema` | Medias móviles con recursión de estado. |
| `ta.rsi / ta.stdev` | Osciladores y bandas estadísticas. |
| `ta.vwap_session` | VWAP anclado a la sesión de Nueva York (NY). |
| `plot(val, {color, title})` | Renderiza líneas continuas en el gráfico. |
| `plotshape(opts)` | Renderiza señales (flechas, diamantes, círculos). |
| `barcolor(color)` | Cambia el color de la vela según condiciones. |
| `display(key, val)` | Actualiza el **Trade Checklist** (Dashboard) dinámicamente. |

### Sincronización de Sesiones
El motor está diseñado para ser **timezone-aware**. Utiliza `Intl.DateTimeFormat` para detectar automáticamente el horario de Nueva York (EST/EDT) y alinear el VWAP y el Initial Balance (IB) con el Open de las 09:30 AM, independientemente del offset del broker (`serverOffset`).

---

## 🛠️ Flujo de Renderizado de Alta Performance (O(1) Updates)
Para evitar la degradación de FPS al paso de las horas, el terminal utiliza un flujo de actualización segregado en `ChartComponent.tsx`:

1.  **Tick Ingestion**: El WebSocket recibe el precio -> `useStore.addBar()`.
2.  **State Sync & Diffing**: Se utiliza un sistema de detección de carga de historial vs. actualización en tiempo real mediante `lastDataLengthRef`.
3.  **Real-Time Tick (O(1))**: Para actualizaciones de ticks entrantes, el sistema utiliza `series.update()`. Esto evita recalcular la caché de todo el array de datos, manteniendo un uso de CPU constante.
4.  **Bulk Loading (History)**: La función `series.setData()` se reserva exclusivamente para la carga inicial del historial o cambios de símbolo, minimizando el impacto en el Garbage Collector.
5.  **Vortex Engine Sync**: El motor de indicadores sigue este mismo patrón, realizando actualizaciones incrementales en las `LineSeries` de VortexJS.

---

## 🎨 Personalización y UI
-   **Temas**: Soporte nativo para `data-theme="dark"` y `"light"` mediante variables CSS (design tokens).
-   **Estética "Deep Slate"**: Un diseño premium basado en una paleta de grises profundos, con micro-interacciones sutiles.
-   **Sidebar Compacto**: Acceso rápido a herramientas de dibujo y biblioteca de scripts.

---

## 🦶 Motor de Footprint (Order Flow)
El sistema de Footprint visualiza el volumen de compra (**Ask**) y venta (**Bid**) directamente en cada vela, permitiendo un análisis de liquidez en tiempo real.

### Arquitectura de Datos
1. **WS Ingestion**: Los ticks en tiempo real se agrupan en celdas de precio por el `useStore.ts`.
2. **Eternal History (Lazy Loading)**:
   - Al hacer scroll a la izquierda, el `ChartComponent` detecta que faltan datos y solicita bloques de **50 velas** anteriores al backend.
   - **Throttling**: Se aplica un límite de 1.5s entre peticiones para evitar saturar el puente MT5.
   - **Blacklist**: Si un timestamp falla, se bloquea por 10s para evitar bucles de errores infinitos.
3. **Arquitectura de Renderizado Event-Driven**:
   - **Muerte al Game Loop**: Se ha eliminado el uso de `requestAnimationFrame` infinito en los Overlays (`FootprintOverlay.tsx`, `OrderFlowStrategiesOverlay.tsx`).
   - **Suscripción Directa**: Los componentes Canvas se redibujan únicamente ante eventos de `timeScale` de LWC o cambios atómicos en el `useStore` de Zustand, reduciendo el consumo de CPU en reposo al 0%.
   - **Viewport Culling**: Durante la iteración de renderizado, el sistema calcula la visibilidad de cada vela. Si una vela (o señal compleja como Doble Delta) está fuera de la zona visible del gráfico, el motor omite sus cálculos matemáticos y llamadas de dibujo.
4. **Optimización del Puente**: El backend procesa miles de ticks en milisegundos usando un bucle de alta performance en Python, devolviendo un mapa de precios condensado.

---

## 🌪️ Motor de Flujo de Órdenes (Order Flow & DeepDOM)
El sistema visualiza la liquidez institucional y la cinta de órdenes mediante dos capas de alto rendimiento: **Big Trades** y el heatmap de profundidad **DeepDOM**.

### 1. Big Trades (Burbujas Institucionales)
- **Concepto**: Agrupa órdenes masivas que ocurren en un mismo precio y tiempo, visualizándolas como burbujas de radio dinámico (`Math.sqrt(size)`).
- **Filtro Psicológico**: Permite identificar dónde las manos fuertes están absorbiendo el mercado.

### 2. DeepDOM: Heatmap de liquidez institucional (Rithmic/Apex)
Este motor ha sido diseñado para replicar la precisión de herramientas profesionales de análisis de profundidad de mercado (Order Book).

#### 🛠️ Arquitectura de Datos L2 (Backend)
- **Acumulación de Libros**: `RithmicService` utiliza un diccionario de estado `self._order_books` para acumular mensajes incrementales (Template 156) de Rithmic, manteniendo una imagen completa (+1800 niveles) de la oferta y demanda.
- **Throttling Inteligente**: Se emite un snapshot completo por WebSocket cada **500ms** solo si hay cambios. Esto reduce el tráfico de red mientras mantiene la fluidez visual.
- **Normalización Dinámica**: El frontend normaliza la intensidad del color basándose en el volumen máximo visible en el viewport actual, asegurando que los "muros" de liquidez siempre destaquen.

#### ⚡ Sincronización de Alto Rendimiento (Frontend)
Para eliminar el "lag" visual al mover el gráfico (paneo/zoom), el `BookmapOverlay.tsx` implementa:
- **Zero-Lag RAF Loop**: Un ciclo de `requestAnimationFrame` que compara el `getVisibleLogicalRange()` (eje X) y el mapeo de coordenadas de precio (eje Y) en cada frame del navegador.
- **Alineación Espacial**: El canvas del heatmap se auto-posiciona dinámicamente utilizando `getBoundingClientRect()` de los canvas internos de `lightweight-charts`, alineándose con precisión milimétrica sobre el pane de precios (excluyendo escalas y barras de tiempo).
- **Anclaje Temporal**: Los datos se indexan por el **BarTime** del gráfico, permitiendo reconstruir un heatmap histórico de los últimos 500 snapshots (~8 minutos de historial visual).

#### 🎨 Estética Professional
- **Paleta de Color**: Escala Cian → Amarillo → Rojo con transparencia adaptativa según la densidad de volumen.
- **Blending**: Uso de `mix-blend-mode: screen` para que el heatmap brille sobre el fondo oscuro sin ocultar las velas ni los indicadores.

---

## 🎨 Sistema de Dibujo Pro (Primitives API)
Migración masiva de herramientas de dibujo tradicionales a la **API de Primitives de Lightweight Charts V5**. Esta arquitectura permite un renderizado de baja latencia y alta precisión sin depender de series de datos pesadas.

### Herramientas Implementadas
-   **Fibonacci Retracement**: Niveles estándar con etiquetas dinámicas y sombreado.
-   **Long/Short Position Tool**: Cálculo en tiempo real de ratios Riesgo/Beneficio con zonas de color traslúcidas.
-   **Tendencias y Rectángulos**: Geometría corregida para mantener verticalidad perfecta y persistencia entre activos.

### El Caso AVWAP (Anchored VWAP)
El indicador **Anchored VWAP** ha sido transformado en un plugin nativo de alta performance (`AnchoredVwapPrimitive.ts`).
-   **Zero-Lag Synchronization**: Las coordenadas se calculan en la fase de renderizado (`renderer()`), lo que garantiza que la línea del AVWAP se mueva en perfecta sincronía con las velas durante el scroll rápido.
-   **Bandas Sigma**: Soporte para hasta 3 desviaciones estándar (Sigma) calculadas dinámicamente sobre el volumen acumulado.
-   **Arquitectura de Plugins Persistentes**: Para evitar un bug de lag en LWC V5 tras múltiples inserciones/borrados, el sistema ahora mantiene los plugins en memoria y los oculta mediante un flag `visible` en lugar de llamar repetidamente a `detachPrimitive`.

---

## 📁 Estructura de Archivos Crítica
- [`frontend/src/engine/vortexEngine.ts`](file:///c:/Programacion/Prueba1/frontend/src/engine/vortexEngine.ts): Lógica del runtime de scripts (Vortex/Pine).
- [`frontend/src/components/Chart/ChartComponent.tsx`](file:///c:/Programacion/Prueba1/frontend/src/components/Chart/ChartComponent.tsx): Orquestación del gráfico, gestión de Primitives y puente WebSocket.
- [`frontend/src/components/Chart/BookmapOverlay.tsx`](file:///c:/Programacion/Prueba1/frontend/src/components/Chart/BookmapOverlay.tsx): Motor de renderizado DeepDOM (Heatmap L2).
- [`frontend/src/components/Chart/BigTradesOverlay.tsx`](file:///c:/Programacion/Prueba1/frontend/src/components/Chart/BigTradesOverlay.tsx): Burbujas de Big Trades institucionales.
- [`backend/app/services/rithmic_service.py`](file:///c:/Programacion/Prueba1/backend/app/services/rithmic_service.py): Servicio principal de Level 2 para Apex/Rithmic.
- [`frontend/src/store/useStore.ts`](file:///c:/Programacion/Prueba1/frontend/src/store/useStore.ts): Gestión atómica del estado (Order Book, Precios, Estrategias).

---

## 🛠️ Tecnologías Core
- **Frontend:** React, Tailwind CSS (en componentes específicos), Lightweight Charts (LWC), Zustand.
- **Backend:** FastAPI (Python), MetaTrader5 Python API, dxFeed Mock/Integration.
- **Visualización:** Canvas API (Overlays personalizados sobre LWC).

---

## 🤝 Handoff Final
Este terminal es ahora una plataforma de análisis técnico de nivel institucional, con un motor de representación gráfica que rivaliza con las mejores herramientas comerciales del mercado.

---
*Documentación Final - Versión 5.0 (Institutional Evolution) - 2026-04-01*