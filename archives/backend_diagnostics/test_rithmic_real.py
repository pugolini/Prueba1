import asyncio
import logging
import sys
import os

# Añadir el path del backend para importar el servicio
sys.path.append(os.path.join(os.getcwd(), 'app'))

from services.rithmic_service import rithmic_service

# Configurar logging para ver todo el detalle
logging.basicConfig(
    level=logging.DEBUG,
    format='%(name)s - %(levelname)s - %(message)s'
)

async def test_callback(msg):
    """Callback que recibe los datos y los imprime de forma resumida."""
    msg_type = msg.get('type')
    if msg_type == 'price_update':
        print(f">>> [TEST] TICK RECIBIDO (Price: {msg.get('price')}, Size: {msg.get('size')})")
    elif msg_type == 'heatmap':
        print(f">>> [TEST] HEATMAP RECIBIDO: {len(msg['data'])} niveles")
    elif msg_type == 'status_update':
        print(f">>> [TEST] STATUS: {msg}")

async def main():
    print("--- INICIANDO TEST DE CONEXION RITHMIC REAL ---")
    
    # El rithmic_service carga automaticamente rithmic_config.json del directorio actual o de backend
    # Aseguramos que estamos en el directorio correcto o le pasamos la ruta
    rithmic_service.config_file = "rithmic_config.json"
    rithmic_service.load_from_file()
    
    if not rithmic_service.user:
        logging.error("No se pudo cargar la configuracion de rithmic_config.json")
        return

    logging.info(f"Probando conexion para usuario: {rithmic_service.user} en {rithmic_service.system}")
    
    # Probamos con NAS100 (NQ en CME)
    symbol = "NAS100.fs"
    
    # Ejecutamos el stream por 30 segundos para ver si llegan datos
    try:
        # Usamos wait_for para que el test no sea infinito
        await asyncio.wait_for(
            rithmic_service.stream_data(symbol, test_callback),
            timeout=30
        )
    except asyncio.TimeoutError:
        logging.info("--- TEST FINALIZADO (Timeout normal de 30s) ---")
    except Exception as e:
        logging.error(f"--- ERROR EN EL TEST: {e} ---")
        import traceback
        logging.error(traceback.format_exc())
    finally:
        await rithmic_service.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
