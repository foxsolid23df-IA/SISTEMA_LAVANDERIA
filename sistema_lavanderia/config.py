import os
import sys

APP_NAME = "Sistema Lavandería"
APP_VERSION = "1.0.0"
APP_AUTHOR = "FoxSolid"

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(os.environ.get('APPDATA', BASE_DIR), 'sistema_lavanderia')
DB_DIR = os.path.join(DATA_DIR, 'data')
DB_PATH = os.path.join(DB_DIR, 'lavanderia.db')
ASSETS_DIR = os.path.join(BASE_DIR, 'assets')
LOGOS_DIR = os.path.join(DATA_DIR, 'logos')

os.makedirs(DB_DIR, exist_ok=True)
os.makedirs(LOGOS_DIR, exist_ok=True)

DEFAULT_SERVICES = [
    {"nombre": "Lavado normal", "descripcion": "Lavado estándar con detergente", "precio_por_kg": 35.0},
    {"nombre": "Lavado exprés", "descripcion": "Lavado rápido en 2 horas", "precio_por_kg": 50.0},
    {"nombre": "Planchado", "descripcion": "Planchado por prenda", "precio_por_kg": 25.0},
    {"nombre": "Tintorería", "descripcion": "Limpieza en seco", "precio_por_kg": 80.0},
    {"nombre": "Lavado y planchado", "descripcion": "Servicio completo de lavado y planchado", "precio_por_kg": 60.0},
    {"nombre": "Cobija/Edredón", "descripcion": "Lavado de cobijas y edredones", "precio_por_kg": 45.0},
    {"nombre": "Cortinas", "descripcion": "Lavado de cortinas", "precio_por_kg": 55.0},
    {"nombre": "Zapatillas", "descripcion": "Lavado de calzado", "precio_por_kg": 40.0},
]

DEFAULT_CONFIG = {
    "nombre_negocio": "Mi Lavandería",
    "direccion": "",
    "telefono": "",
    "logo_path": "",
    "mensaje_pie": "¡Gracias por su preferencia!",
    "ancho_papel": 80,
    "tamanio_fuente": 12,
    "fuente": "Courier New",
    "negrita": 0,
    "margen": 0,
    "impresora_nombre": "",
    "mostrar_logo": 1,
    "doble_corte": 0,
    "telefono_negocio": "",
    "rfc": "",
    "razon_social": "",
}
