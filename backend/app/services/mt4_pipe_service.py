import win32file
import win32pipe
import pywintypes
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class MT4PipeService:
    """
    Servicio de comunicación NATIVA mediante Named Pipes (Tuberías Nombradas).
    V4: Eliminación total del lag y bloqueos de red local.
    """
    def __init__(self, pipe_name: str = r'\\.\pipe\PugobotPipe'):
        self.pipe_name = pipe_name

    async def _call_pipe(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Envía un comando al pipe y espera respuesta de forma síncrona pero eficiente."""
        handle = None
        try:
            # Intentar conectar al pipe (esperar hasta 200ms si el EA está ocupado)
            # Nota: En Windows, CreateFile falla si el pipe está ocupado
            handle = win32file.CreateFile(
                self.pipe_name,
                win32file.GENERIC_READ | win32file.GENERIC_WRITE,
                0,
                None,
                win32file.OPEN_EXISTING,
                0,
                None
            )
            
            # Configurar modo de lectura (importante para mensajes completos)
            res = win32pipe.SetNamedPipeHandleState(handle, win32pipe.PIPE_READMODE_MESSAGE, None, None)
            
            # Escribir comando
            msg = (json.dumps(command) + "\n").encode('utf-8')
            win32file.WriteFile(handle, msg)
            
            # Leer respuesta (Buffer de 16KB para muchas posiciones)
            resp_code, resp_data = win32file.ReadFile(handle, 16384)
            
            if resp_code != 0:
                logger.error(f"[Pipe] ReadFile error code: {resp_code}")
            
            return json.loads(resp_data.decode('utf-8'))

        except pywintypes.error as e:
            # Error 2: El sistema no puede encontrar el archivo (EA no cargado)
            # Error 231: Todos los ejemplares de canalización están ocupados
            if e.winerror == 2:
                return {"status": "error", "message": "MT4 EA NOT LOADED (Pipe not found)"}
            return {"status": "error", "message": f"Pipe OS Error: {e.strerror} ({e.winerror})"}
        except Exception as e:
            return {"status": "error", "message": f"Unexpected Pipe Error: {str(e)}"}
        finally:
            if handle:
                win32file.CloseHandle(handle)

    async def get_status(self, symbol: str) -> Dict[str, Any]:
        """Obtiene el estado completo de la terminal MT4 vía Pipe."""
        return await self._call_pipe({"action": "GET_STATUS", "symbol": symbol})

    async def send_order(self, symbol: str, order_type: str, lot: float, price: float = 0, sl: float = 0, tp: float = 0, magic: int = 0) -> Dict[str, Any]:
        """Envía una orden vía Pipe."""
        command = {
            "action": "ORDER_OPEN",
            "symbol": symbol,
            "type": order_type,
            "volume": lot,
            "price": price,
            "sl": sl,
            "tp": tp,
            "magic": magic
        }
        return await self._call_pipe(command)

    async def close_position(self, ticket: int, volume: float = 0) -> Dict[str, Any]:
        """Cierra una posición vía Pipe."""
        return await self._call_pipe({"action": "ORDER_CLOSE", "ticket": ticket, "volume": volume})

    async def modify_position(self, ticket: int, sl: float = 0, tp: float = 0) -> Dict[str, Any]:
        """Modifica SL/TP vía Pipe."""
        return await self._call_pipe({"action": "ORDER_MODIFY", "ticket": ticket, "sl": sl, "tp": tp})

# Instancia global para ser inyectada en main.py
mt4_pipe_service = MT4PipeService()
