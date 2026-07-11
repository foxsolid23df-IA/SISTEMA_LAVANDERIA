from database.conexion import Database
from database.modelos import (
    Cliente, Servicio, Orden, Pago,
    CajaSesion, Usuario, TicketConfig
)

db = Database()

def init_db():
    db.crear_tablas()

def get_db():
    return db
