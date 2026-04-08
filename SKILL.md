# Skill: Equipo Pugobot (Multi-Agente)

Esta habilidad permite a Antigravity coordinar un equipo de agentes inteligentes trabajando en paralelo sobre el mismo proyecto, replicando la funcionalidad de "Agent Teams" de Claude Code.

## Configuración del Entorno
El equipo utiliza una carpeta oculta en la raíz del proyecto para comunicarse:
- `.antigravity/team/tasks.json` -> Lista maestra de tareas, estados y dependencias.
- `.antigravity/team/mailbox/` -> Mensajes individuales (.msg).
- `.antigravity/team/broadcast.msg` -> Mensajes globales para todo el equipo.
- `.antigravity/team/locks/` -> Semáforos para evitar edición simultánea de archivos.

## Roles del Equipo
1. **Director (Pugobot)**: El líder. Divide el problema, asigna roles y aprueba planes.
2. **Arquitecto**: Define la estructura y patrones antes de codificar.
3. **Especialista (Frontend/Backend/DB)**: Ejecuta tareas técnicas específicas.
4. **Marketer**: Creación de marca, logos, copywriting y diseño de landing pages.
5. **Investigador**: Búsqueda de información, documentación y análisis de mercado.
6. **Revisor (Devil's Advocate)**: Busca fallos, bugs y problemas de seguridad.
7. **Obrero (Local)**: Modelo de bajo coste (Ollama) para tareas repetitivas, boilerplate y tests.


## Protocolo de Orquestación Avanzada

### 1. Modo de Planificación (Gatekeeping)
Antes de realizar cambios significativos, cada agente debe enviar un **Plan de Acción** al buzón de Pugobot.
- El agente se mantiene en modo `READ_ONLY` o `PLANNING` hasta que Pugobot responda con un mensaje de `APPROVED`.

### 2. Mensajería y Difusión (Broadcast)
- **Mensaje Directo**: Coordinación 1 a 1 entre especialistas.
- **Broadcast**: Pugobot puede escribir en `broadcast.msg` para dar nuevas directrices a todo el equipo simultáneamente.

### 3. Sincronización de Tareas y Dependencias
- Las tareas en `tasks.json` pueden tener una lista de `dependencies`. Una IA no debe reclamar una tarea si sus dependencias no están en estado `COMPLETED`.

### 4. Enrutamiento Híbrido (Cost Optimization)
Para maximizar la eficiencia y ahorrar tokens:
- **Tareas de Arquitectura**: Siempre asignadas a modelos en la nube (Claude/Gemini).
- **Tareas de "Fuerza Bruta"**: (Boilerplate, Tests Unitarios, Documentación extensa) -> Asignadas al **Obrero**.
- El Obrero debe ejecutarse localmente (e.g., `ollama run qwen-obrero`).

## Reglas Críticas
- NUNCA editar un archivo si existe un .lock activo en `.antigravity/team/locks/`.
- Al completar una tarea, el agente debe liberar sus "locks" y notificar a Pugobot.
```

---

## 3. Script de Orquestación (team_manager.py)
*Este script automatiza la gestión de las tareas y la comunicación. Guárdalo como `team_manager.py`.*

```python
import json
import os
import sys

TEAM_DIR = ".antigravity/team"

def init_team():
    """Inicializa la infraestructura del equipo."""
    os.makedirs(f"{TEAM_DIR}/mailbox", exist_ok=True)
    os.makedirs(f"{TEAM_DIR}/locks", exist_ok=True)
    tasks_path = f"{TEAM_DIR}/tasks.json"
    if not os.path.exists(tasks_path):
        with open(tasks_path, 'w') as f:
            json.dump({"tasks": [], "members": []}, f, indent=2)
    if not os.path.exists(f"{TEAM_DIR}/broadcast.msg"):
        with open(f"{TEAM_DIR}/broadcast.msg", 'w') as f: f.write("")
    print("✓ Infraestructura 'Equipo Pugobot' lista.")

def assign_task(title, assigned_to, deps=[]):
    """Asigna una nueva tarea con soporte para dependencias."""
    path = f"{TEAM_DIR}/tasks.json"
    with open(path, 'r+') as f:
        data = json.load(f)
        task = {
            "id": len(data["tasks"]) + 1,
            "title": title,
            "status": "PENDING",
            "plan_approved": False,
            "assigned_to": assigned_to,
            "dependencies": deps
        }
        data["tasks"].append(task)
        f.seek(0)
        json.dump(data, f, indent=2)
    print(f"✓ Tarea {task['id']} ({title}) asignada a {assigned_to}.")

def broadcast(sender, text):
    """Envía un mensaje a todos los miembros del equipo."""
    msg = {"de": sender, "tipo": "BROADCAST", "mensaje": text}
    with open(f"{TEAM_DIR}/broadcast.msg", 'a') as f:
        f.write(json.dumps(msg) + "\n")
    print(f"✓ Mensaje global enviado por {sender}.")

def send_message(sender, receiver, text):
    """Envía un mensaje al buzón de un agente específico."""
    msg = {"de": sender, "mensaje": text}
    with open(f"{TEAM_DIR}/mailbox/{receiver}.msg", 'a') as f:
        f.write(json.dumps(msg) + "\n")
    print(f"✓ Mensaje enviado a {receiver}.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "init": init_team()
```

---

## 4. Cómo usarlo
1. **Activa el Líder**: Pídele a Antigravity: *"Usa la habilidad Equipo Pugobot para inicializar este proyecto"*.
2. **Reparte el trabajo**: **Pugobot** dividirá el trabajo. Usa `python team_manager.py assign` para cada tarea. 
   > [!WARNING]
   > **NUNCA uses `&&` o `&` para encadenar comandos en la misma línea (falla en ciertas versiones de PowerShell en Windows).** Ejecuta cada comando de asignación en líneas separadas dentro de un mismo bloque, o en llamadas secuenciales.
3. **Flujo de Planificación**: Los agentes envían sus planes a Pugobot antes de empezar. Un equipo bien coordinado es imparable.
