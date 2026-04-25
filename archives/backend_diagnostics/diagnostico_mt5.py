import MetaTrader5 as mt5
import sys

def diagnose():
    path = r"C:\Program Files\Axi MetaTrader 5 Terminal\terminal64.exe"
    print(f"--- Diagnóstico MT5 ---")
    print(f"Intentando conectar a: {path}")
    
    if not mt5.initialize(path=path):
        print(f"Error de inicialización: {mt5.last_error()}")
        # Reintento sin ruta
        if not mt5.initialize():
            print(f"Fallo total de inicialización: {mt5.last_error()}")
            return

    print("Conexión establecida con éxito.")
    print(f"Terminal Info: {mt5.terminal_info()._asdict() if mt5.terminal_info() else 'N/A'}")
    
    symbols = mt5.symbols_get()
    if symbols:
        print(f"Total de símbolos encontrados: {len(symbols)}")
        print("Muestra de los primeros 20 símbolos:")
        for s in symbols[:20]:
            print(f" - {s.name}")
            
        # Prueba específica
        for test in ["NAS100", "NAS100.pro", "NAS100.fs", "BTCUSD", "BTCUSD.pro"]:
            success = mt5.symbol_select(test, True)
            print(f"Prueba selección '{test}': {'EXITO' if success else 'FALLO'}")
    else:
        print("No se encontraron símbolos.")

    mt5.shutdown()

if __name__ == "__main__":
    diagnose()
