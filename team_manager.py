import json
import os
import subprocess
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
    print(f"OK: Infraestructura 'Equipo Pugobot' lista.")

def assign_task(title, assigned_to, deps=[]):
    """Asigna una nueva tarea con soporte para dependencias."""
    path = f"{TEAM_DIR}/tasks.json"
    with open(path, 'r+') as f:
        data = json.load(f)

        # Valida si el miembro asignado existe en la lista de miembros
        member_names = [m["name"] for m in data["members"]]
        if assigned_to not in member_names:
            print(f"ERROR: El miembro {assigned_to} no existe en el equipo. Miembros disponibles: {member_names}")
            return

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
        f.truncate()
    print(f"OK: Tarea {task['id']} ({title}) asignada a {assigned_to}.")

def update_task_status(task_id, status):
    """Actualiza el estado de una tarea."""
    path = f"{TEAM_DIR}/tasks.json"
    with open(path, 'r+') as f:
        data = json.load(f)
        for task in data["tasks"]:
            if task["id"] == task_id:
                task["status"] = status
                break
        f.seek(0)
        json.dump(data, f, indent=2)
        f.truncate()
    print(f"OK: Estado de tarea {task_id} actualizado a {status}.")

def broadcast(sender, text):
    """Envía un mensaje a todos los miembros del equipo."""
    msg = {"de": sender, "tipo": "BROADCAST", "mensaje": text}
    with open(f"{TEAM_DIR}/broadcast.msg", 'a') as f:
        f.write(json.dumps(msg) + "\n")
    print(f"OK: Mensaje global enviado por {sender}.")

def send_message(sender, receiver, text):
    """Envía un mensaje al buzón de un agente específico."""
    msg = {"de": sender, "mensaje": text}
    with open(f"{TEAM_DIR}/mailbox/{receiver}.msg", 'a') as f:
        f.write(json.dumps(msg) + "\n")
    print(f"OK: Mensaje enviado a {receiver}.")

def run_obrero(prompt):
    """Ejecuta una tarea en el Obrero Local y devuelve el resultado."""
    print(f"--- [Obrero Local: Procesando...] ---")
    try:
        # Usamos subprocess para llamar a ollama
        process = subprocess.Popen(
            ['ollama', 'run', 'qwen-obrero', prompt],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8'
        )
        stdout, stderr = process.communicate()
        if process.returncode == 0:
            print(stdout)
            return stdout
        else:
            print(f"ERROR Obrero: {stderr}")
            return None
    except Exception as e:
        print(f"ERROR de conexión con Ollama: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "init": init_team()
        elif cmd == "assign" and len(sys.argv) > 3:
            assign_task(sys.argv[2], sys.argv[3], sys.argv[4:] if len(sys.argv) > 4 else [])
        elif cmd == "status" and len(sys.argv) > 3:
            update_task_status(int(sys.argv[2]), sys.argv[3])
        elif cmd == "obrero" and len(sys.argv) > 2:
            run_obrero(sys.argv[2])
