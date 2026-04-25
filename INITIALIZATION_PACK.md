# 🏛️ PACK DE INICIALIZACIÓN: THE VAULT (MÁXIMA EFICIENCIA)

Este documento contiene los 3 archivos esenciales para clonar mi cerebro operativo y mi sistema de ahorro de tokens en cualquier proyecto nuevo. 

### 🚀 Instrucciones de Activación:
1. Crea una carpeta nueva para tu proyecto.
2. Crea los archivos indicados abajo en la raíz.
3. Copia el contenido exacto de cada bloque.
4. **Primer Mensaje:** Pídeme: `"Lee mis reglas y mi skill.md y dime cómo vamos a operar para ahorrar tokens"`.

---

## 1. Archivo: `.geminirules` (Eficiencia de Tokens)
*Este archivo me obliga a usar el "Obrero Local" (Ollama/Terminal) antes de gastar tokens en la nube.*

```markdown
# Target: Antigravity Assistant & Claude Code CLI

## 1. Hybrid Model Routing (MANDATORY)
- **Architect (Cloud/Claude)**: Use primarily for project mapping, complex logic, architectural decisions, and final review of code.
- **Worker (Local/Ollama - qwen-obrero)**: Use for all "grunt work" including boilerplate generation, unit tests creation, verbose documentation, and repetitive refactoring (e.g., adding logs, error handling).

## 2. Interaction Protocol
- When the USER requests code changes, ALWAYS first identify if the task can be delegated to the local sub-agent.
- If delegatable, use `ollama run qwen-obrero` or the Ollama API to generate code.
- ALWAYS review the local output for architectural coherence before persistence.

## 3. Hardware Optimization
- Use `num_ctx=16384` for the local worker to handle context efficiently.
- Avoid unnecessary cloud token consumption by pre-summarizing files locally.

## 4. Developer Experience
- Maintain transparency: explicitly state "[Obrero Local: Generando código...]" when using Ollama.

## 5. Idioma y Localización (MANDATORIO)
- Todas las comunicaciones con el usuario, documentación, planes y tareas **DEBEN** ser en **ESPAÑOL**.
```

---

## 2. Archivo: `SKILL.md` (Orquestación Multi-Agente)
*Este archivo activa el sistema "Equipo Pugobot", permitiéndome actuar como un equipo de especialistas.*

```markdown
# Skill: Equipo Pugobot (Multi-Agente)

Esta habilidad permite coordinar un equipo de agentes inteligentes trabajando en paralelo.

## Roles del Equipo
1. **Director (Pugobot)**: El líder. Divide el problema y aprueba planes.
2. **Arquitecto**: Define la estructura y patrones (Cloud).
3. **Especialista**: Ejecuta tareas técnicas específicas (Cloud/Local).
4. **Obrero (Local)**: Modelo Ollama para tareas repetitivas y documentación extensa.

## Protocolo de Orquestación
- **Modo de Planificación**: Antes de realizar cambios, envía un Plan de Acción a Pugobot.
- **Enrutamiento Híbrido**: 
    - Arquitectura -> Cloud.
    - Boilerplate/Tests/Docs -> Local (Obrero).

## Estructura de Comunicación
El equipo utiliza `.antigravity/team/` para:
- `tasks.json`: Lista maestra de tareas.
- `mailbox/`: Mensajes entre agentes.
```

---

## 3. Archivo: `AGENTS.md` (Contexto Técnico)
*Asegura que no cometa errores con las versiones de los frameworks (Detección Automática).*

```markdown
# 🏛️ PROTOCOLO DE EXPERTOS (UNIVERSAL)

Este archivo guía mi comportamiento técnico según el stack detectado en el búnker.

## 1. REGLAS GLOBALES (Siempre Activas)
- **Calidad de Código**: Preferir código limpio, modular y bien documentado.
- **Seguridad**: Nunca hardcodear credenciales; usar siempre variables de entorno.
- **Ahorro de Tokens**: Antes de una edición masiva, analiza la estructura con el Obrero Local.

## 2. REGLAS POR STACK (Activar según detección)

### [STACK: NEXT.JS / REACT]
- Usar App Router y Server Components por defecto.
- Seguir las guías de `node_modules/next/dist/docs/`.
- Evitar 'use client' a menos que sea estrictamente necesario para la interactividad.

### [STACK: PYTHON / DATA SCIENCE]
- Seguir estándares PEP 8.
- Usar entornos virtuales (`.venv`) para la gestión de dependencias.
- Documentar funciones con Docstrings tipo Google o NumPY.

### [STACK: C / SISTEMAS]
- Gestión de memoria rigurosa: cada `malloc` debe tener su `free`.
- Seguir estándares ANSI C o C11 según el compilador.
- Comentar exhaustivamente la lógica de punteros para evitar desbordamientos.

---

## 🤖 INSTRUCCIÓN PARA EL AGENTE:
Al inicializar, detecta qué lenguajes predominan en el búnker y aplícame las reglas de la sección correspondiente. Si el stack no está listado, pídeme que investigue las "Best Practices" actuales antes de escribir código.
```

---

## 4. Archivo: `team_manager.py` (Script de Gestión)
*Opcional: Automatiza la creación de tareas y mensajes en el equipo.*

```python
import json
import os
import sys

TEAM_DIR = ".antigravity/team"

def init_team():
    os.makedirs(f"{TEAM_DIR}/mailbox", exist_ok=True)
    os.makedirs(f"{TEAM_DIR}/locks", exist_ok=True)
    tasks_path = f"{TEAM_DIR}/tasks.json"
    if not os.path.exists(tasks_path):
        with open(tasks_path, 'w') as f:
            json.dump({"tasks": [], "members": []}, f, indent=2)
    print("Mando Táctico: Infraestructura lista.")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "init":
        init_team()
```
