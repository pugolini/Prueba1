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

## Cómo Usar

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

## Archivos de Configuración

- `.claude/settings.local.json` - Permisos y hooks
- `.claude/obrero.js` - Script Node para invocar Ollama
- `.claude/delegar-obrero.bat` - Script batch para delegar tareas
- `.antigravity/team/tasks.json` - Tracker de tareas del equipo
- `.geminirules` - Reglas de enrutamiento híbrido

## Optimización de Tokens

Con este flujo:
- **~70-80% del código** se genera localmente (Obrero)
- **~20-30% requiere reasoning** (Cloud)

Esto reduce el consumo de tokens cloud significativamente, especialmente en tareas de:
- Generación masiva de tests
- Componentes UI repetitivos
- Documentación
- Refactorizaciones mecánicas

## Mantra del Proyecto

> "Diseña en la nube, pica código en el silicio local."
