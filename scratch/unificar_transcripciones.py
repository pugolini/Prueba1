import os
import re

def clean_vtt_line(line):
    # Eliminar WEBVTT
    if line.strip() == "WEBVTT":
        return None
    # Eliminar timestamps (00:00:00.000 --> 00:00:00.000)
    if "-->" in line:
        return None
    # Eliminar números de índice aislados (ej: "1", "2")
    if re.match(r'^\d+$', line.strip()):
        return None
    return line

def process_module_files(source_dir, output_dir):
    files = [f for f in os.listdir(source_dir) if f.endswith(".txt")]
    
    # Agrupar por el primer dígito (módulo)
    modules = {}
    for f in files:
        match = re.match(r'^(\d+)', f)
        if match:
            mod_num = match.group(1)
            if mod_num not in modules:
                modules[mod_num] = []
            modules[mod_num].append(f)
    
    # Nombres de módulos (human-readable basado en contenido)
    mod_names = {
        "1": "Modulo_1_Introduccion",
        "2": "Modulo_2_Fundamentos",
        "3": "Modulo_3_Herramientas",
        "4": "Modulo_4_Estrategias",
        "5": "Modulo_5_Gestion",
        "6": "Modulo_6_Entradas",
        "7": "Modulo_7_Opciones"
    }

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for mod_id, mod_files in modules.items():
        # Ordenar archivos alfabéticamente/numéricamente para mantener orden correlativo
        mod_files.sort()
        
        output_name = f"{mod_names.get(mod_id, f'Modulo_{mod_id}')}.txt"
        output_path = os.path.join(output_dir, output_name)
        
        print(f"Procesando {output_name}...")
        
        with open(output_path, 'w', encoding='utf-8') as outfile:
            for f in mod_files:
                outfile.write(f"\n--- INICIO: {f} ---\n\n")
                with open(os.path.join(source_dir, f), 'r', encoding='utf-8') as infile:
                    paragraph = []
                    for line in infile:
                        cleaned = clean_vtt_line(line)
                        if cleaned is not None:
                            text = cleaned.strip()
                            if text:
                                paragraph.append(text)
                            elif paragraph:
                                # Si hay una línea vacía original de texto, unimos el párrafo actual
                                outfile.write(" ".join(paragraph) + "\n\n")
                                paragraph = []
                    
                    # Escribir lo que quede en el buffer
                    if paragraph:
                        outfile.write(" ".join(paragraph) + "\n\n")
                
                outfile.write(f"\n--- FIN: {f} ---\n\n")

if __name__ == "__main__":
    SOURCE = r"c:\Programacion\Prueba1\Transcripciones"
    TARGET = r"c:\Programacion\Prueba1\Transcripciones_Unificadas"
    process_module_files(SOURCE, TARGET)
