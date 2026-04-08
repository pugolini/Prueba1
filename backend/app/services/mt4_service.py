import socket
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class MT4Service:
    """
    Servicio de comunicación directa con MetaTrader 4 mediante Sockets WinAPI.
    V3.1: Soporte para Sincronización Bidireccional (Posiciones, PnL, SL/TP).
    """
    def __init__(self, host: str = "127.0.0.1", port: int = 8006):
        self.host = host
        self.port = port
        self.timeout = 2.0  # Un poco más de tiempo para payloads grandes

    async def send_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Envía un comando al EA de MT4 y espera respuesta."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(self.timeout)
                s.connect((self.host, self.port))
                
                message = json.dumps(command) + "\n"
                s.sendall(message.encode('utf-8'))
                
                # Buffer más grande para recibir lista de posiciones (8 KB)
                chunks = []
                while True:
                    chunk = s.recv(4096)
                    if not chunk:
                        break
                    chunks.append(chunk)
                
                if not chunks:
                    return {"status": "error", "message": "No response from MT4 EA"}
                
                full_data = b"".join(chunks).decode('utf-8')
                return json.loads(full_data)
        except ConnectionRefusedError:
            return {"status": "error", "message": "MT4 EA NOT CONNECTED"}
        except socket.timeout:
            return {"status": "error", "message": "MT4 Connection Timeout"}
        except Exception as e:
            logger.error(f"[MT4] Error en socket: {e}")
            return {"status": "error", "message": str(e)}

    async def get_status(self, symbol: str) -> Dict[str, Any]:
        """Obtiene el estado completo de la terminal MT4 (Posiciones, Órdenes, Cuenta)."""
        command = {"action": "GET_STATUS", "symbol": symbol}
        return await self.send_command(command)

    async def send_order(self, symbol: str, order_type: str, lot: float, price: float = 0, sl: float = 0, tp: float = 0, magic: int = 0) -> Dict[str, Any]:
        """Envía una orden de mercado o límite a MT4."""
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
        return await self.send_command(command)

    async def close_position(self, ticket: int, volume: float = 0) -> Dict[str, Any]:
        """Cierra una posición en MT4 por ticket."""
        command = {
            "action": "ORDER_CLOSE",
            "ticket": ticket,
            "volume": volume
        }
        return await self.send_command(command)

    async def modify_position(self, ticket: int, sl: float = 0, tp: float = 0) -> Dict[str, Any]:
        """Modifica SL/TP de una posición existente en MT4."""
        command = {
            "action": "ORDER_MODIFY",
            "ticket": ticket,
            "sl": sl,
            "tp": tp
        }
        return await self.send_command(command)

# Instancia única
mt4_service = MT4Service()
