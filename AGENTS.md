# PROTOCOLO DE EXPERTOS (UNIVERSAL)

Este archivo guia mi comportamiento tecnico segun el stack detectado en el bunker.

## 1. REGLAS GLOBALES (Siempre Activas)
- **Calidad de Codigo**: Preferir codigo limpio, modular y bien documentado.
- **Seguridad**: Nunca hardcodear credenciales; usar siempre variables de entorno.
- **Ahorro de Tokens**: Antes de una edicion masiva, analiza la estructura con el Obrero Local.

## 2. REGLAS POR STACK (Activar segun deteccion)

### [STACK: REACT + VITE + TYPESCRIPT]
- **Framework**: React 18+ con Vite como build tool.
- **Router**: React Router v6 (SPA, no Next.js).
- **Estado**: Zustand para estado global; Context API solo para dependencias inyectadas.
- **Styling**: Tailwind CSS preferido; CSS Modules para componentes aislados.
- **Testing**: Vitest + React Testing Library + MSW para mocks de API.
- **Estructura**: Feature-based folders (`src/features/`, `src/components/`, `src/lib/`).
- **Types**: TypeScript estricto; interfaces en `src/types/`; no usar `any`.
- **Async**: React Query (TanStack Query) para server state; `axios` para HTTP client.

### [STACK: PYTHON / BACKEND + TRADING]
- **Framework**: FastAPI para APIs async; Uvicorn como ASGI server.
- **Validacion**: Pydantic v2 para todos los modelos de entrada/salida.
- **Finanzas**: pandas para series temporales; numpy para calculos vectorizados.
- **WebSocket**: Conexiones persistentes para streams de precios en tiempo real.
- **Validacion de Precios**: Siempre verificar bid/ask spread, volumen minimo, y timestamp de mercado antes de ejecutar orden.
- **Testing**: pytest + pytest-asyncio; mocks con `unittest.mock` o `respx`.
- **Entornos**: `.venv` obligatorio; `requirements.txt` + `requirements-dev.txt`.
- **Documentacion**: Docstrings tipo Google para funciones publicas.

### [STACK: TESTING]
- **Frontend**: Vitest (runner), React Testing Library (DOM), MSW (API mocks).
- **Backend**: pytest, pytest-asyncio, httpx para tests de integracion.
- **Regla de Oro**: Cada bug fix debe incluir un test de regresion.

### [STACK: ESTADO / STATE MANAGEMENT]
- **Global**: Zustand (ligero, sin boilerplate).
- **Local**: `useState` / `useReducer` para estado de componente.
- **Server**: React Query (cache, refetch, invalidacion automatica).
- **Context API**: Solo para temas, autenticacion, o dependencias inyectadas.

---

## INSTRUCCION PARA EL AGENTE:
Al inicializar, detecta que lenguajes predominan en el bunker y aplicate las reglas de la seccion correspondiente. Si el stack no esta listado, pidele al usuario que investigue las "Best Practices" actuales antes de escribir codigo.
