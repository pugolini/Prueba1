# Flujo Híbrido Pugobot - Claude Code + Qwen Local

## Configuración Completada

Este proyecto ahora está configurado para usar un **flujo híbrido** que minimiza el consumo de tokens en la nube:

### Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                     TAREA DEL USUARIO                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
         ┌────────────▼────────────┐
         │   ¿Es tarea compleja?   │
         │  (arquitectura, lógica  │
         │   crítica, diseño)      │
         └────────────┬────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
       SÍ            NO            repetitivo/boilerplate
        │             │
        ▼             ▼
┌───────────────┐  ┌──────────────────┐
│ CLAUDE CLOUD  │  │ QWEN OBRERO LOCAL│
│ (Arquitecto)  │  │ (4.7GB, RTX 4060)│
└───────────────┘  └──────────────────┘
```

## 🆕 NUEVO: Token Saver Mode (Máximo Ahorro)

Para tareas que **requieren reasoning** (Kimi/Claude) pero quieres ahorrar máximo tokens:

```
FLUJO TOKEN SAVER:

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   TU CONSULTA   │────▶│  QWEN OBRERO     │────▶│  KIMI/CLOUD     │
│  (ej: Fix bug)  │     │  (Análisis Local)│     │  (Reasoning)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                          │
                               ▼                          ▼
                        ┌──────────────┐          ┌──────────────┐
                        │ Brief JSON   │          │ Solución     │
                        │ (compacto)   │─────────▶│ (mismo       │
                        │ ~500 tokens  │          │  resultado)  │
                        └──────────────┘          └──────────────┘
```

**Ahorro: 70-85% menos tokens en Kimi/Claude**

### Cómo usar Token Saver

#### Opción 1: Script simple (recomendado)
```bash
.claude\analyze-issue "Fix bug in websocket connection"
```

#### Opción 2: Flujo completo con prompt optimizado
```bash
node .claude\token-saver.js --task "Refactor ChartComponent to use hooks"
```

#### Opción 3: Máximo ahorro (modo ultra-compacto)
```bash
node .claude\token-saver.js --task "Add tests for trading API" --mode ultra
```

### Qué hace Token Saver

1. **Análisis Local** (Qwen Obrero, gratis, tu GPU):
   - Lee archivos relevantes del proyecto
   - Identifica funciones y dependencias clave
   - Resume la lógica actual
   - Detecta posibles problemas

2. **Genera Brief Estructurado**:
   ```json
   {
     "task_summary": "Fix websocket bug in ChartComponent",
     "relevant_files": [
       {
         "path": "ChartComponent.tsx",
         "relevance": "Contiene el websocket",
         "key_functions": ["useEffect", "ws.onmessage"]
       }
     ],
     "current_logic": "El websocket se cierra prematuramente...",
     "potential_issues": ["Race condition en connect()"],
     "suggested_approach": "Añadir guardia de reconexión..."
   }
   ```

3. **Genera Prompt Optimizado** para Kimi/Claude:
   - Solo incluye información esencial
   - Snippets de código mínimos
   - Contexto pre-digerido

4. **Copia al portapapeles** (listo para pegar)

---

## Cómo Usar (Flujo Estándar)

### 1. Tareas para Claude (Cloud)

Yo me encargo automáticamente de:
- **Planificación arquitectónica**
- **Decisiones de diseño**
- **Code review final**
- **Debugging complejo**
- **Mapeo de código**

### 2. Tareas para Qwen Obrero (Local)

Delega al Obrero cuando necesites:
- **Boilerplate** (componentes React, funciones CRUD)
- **Tests unitarios**
- **Documentación extensa**
- **Refactorización repetitiva** (añadir logs, error handling)
- **Generación de código estándar**

#### Comando directo:
```bash
! ollama run qwen-obrero "genera un componente React con props X, Y, Z"
```

#### Script delegado:
```bash
! .claude/delegar-obrero.bat "crea tests para la función validateSMA"
```

### 3. Flujo Recomendado

```
1. YO (Claude) analizo el problema y diseño la solución
2. Delego partes repetitivas al Obrero
3. Reviso el output del Obrero
4. Integro el código final
```

---

## 📊 Comparativa de Modos

| Modo | Uso | Tokens Cloud | Tokens Local | Ahorro |
|------|-----|--------------|--------------|--------|
| **Cloud Directo** | Debugging complejo, arquitectura | 10,000 | 0 | 0% |
| **Token Saver** | Tareas con contexto de código | 2,500 | ~3,000 | **75%** |
| **Token Saver Ultra** | Tareas simples con código | 1,500 | ~2,000 | **85%** |
| **Obrero Directo** | Boilerplate, tests, docs | 0 | ~2,000 | **100%** |

---

## Sistema de Agentes Pugobot

El proyecto usa el sistema multi-agente definido en `SKILL.md`:

| Agente | Rol | Modelo |
|-------------|--------|
| **Pugobot** | Director/Coordinator | Claude Cloud |
| **Arquitecto** | Architecture & Design | Claude Cloud |
| **Especialistas** | Frontend/Backend impl | Claude Cloud |
| **Obrero** | Boilerplate & Tests | Qwen Local (Ollama) |
| **Revisor** | Code review, security | Claude Cloud |
| **Investigador** | Research & docs | Claude Cloud |
| **Token Saver** | Pre-procesador de contexto | Qwen Local (Ollama) |

---

## Archivos de Configuración

- `.claude/settings.local.json` - Permisos y hooks
- `.claude/obrero.js` - Script Node para invocar Ollama
- `.claude/delegar-obrero.bat` - Script batch para delegar tareas
- `.claude/preprocessor.js` - **NUEVO**: Análisis de contexto local
- `.claude/token-saver.js` - **NUEVO**: Orquestador híbrido
- `.claude/analyze-issue.bat` - **NUEVO**: Wrapper para análisis rápido
- `.claude/token-saver-mode.json` - **NUEVO**: Configuración del modo
- `.antigravity/team/tasks.json` - Tracker de tareas del equipo
- `.geminirules` - Reglas de enrutamiento híbrido

---

## Optimización de Tokens

Con este flujo:
- **~70-85% del código** se genera/analiza localmente (Obrero + Token Saver)
- **~15-30% requiere reasoning** (Cloud)

Esto reduce el consumo de tokens cloud significativamente, especialmente en tareas de:
- Generación masiva de tests
- Componentes UI repetitivos
- Documentación
- Refactorizaciones mecánicas
- **Debugging con contexto de código** ← NUEVO con Token Saver

---

## Ejemplo Real

### Antes (sin Token Saver):
```
Tú: Analiza estos bugs en mi trading terminal
[Yo leo 5 archivos de 1000 líneas = 5000 tokens]
[Yo hago thinking = 3000 tokens]
[Yo respondo = 2000 tokens]
TOTAL: ~10,000 tokens en Kimi
```

### Después (con Token Saver):
```
1. Tú ejecutas: .claude\analyze-issue "Fix websocket bug"
2. Qwen local analiza los 5 archivos (gratis, tu GPU)
3. Qwen genera brief de 500 tokens
4. Yo recibo solo el brief (500 tokens)
5. Yo hago thinking sobre el brief (1000 tokens)
6. Yo respondo con el fix (1000 tokens)
TOTAL: ~2,500 tokens en Kimi (75% de ahorro)
```

---

## Mantra del Proyecto

> "Diseña en la nube, pica código en el silicio local, **pre-procesa el contexto para ahorrar tokens**."
