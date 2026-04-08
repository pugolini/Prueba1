import re
with open("c:/Programacion/Prueba1/backend/app/main.py", "r", encoding="utf-8") as f: text = f.read()
new_text = text.split('@app.get("/api/history-footprint/{symbol}")')[0] + patch_code
with open("c:/Programacion/Prueba1/backend/app/main.py", "w", encoding="utf-8") as f: f.write(new_text)
print("PATCH SIMPLE M1 APLICADO CON EXITO.")
