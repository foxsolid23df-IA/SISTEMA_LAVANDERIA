import hashlib
from config import DEFAULT_SERVICES, DEFAULT_CONFIG
from database.modelos import Servicio, Usuario, TicketConfig
from database.conexion import Database


def seed_inicial():
    db = Database()
    db.connect()

    servicios = Servicio(db)
    if servicios.contar() == 0:
        print("Creando servicios por defecto...")
        for s in DEFAULT_SERVICES:
            servicios.crear(s["nombre"], s["descripcion"], s["precio_por_kg"])
        print(f"  {len(DEFAULT_SERVICES)} servicios creados.")

    usuarios = Usuario(db)
    if usuarios.contar() == 0:
        print("Creando usuario admin por defecto (PIN: 1234)...")
        usuarios.crear("Administrador", "1234", "admin")
        print("  Usuario admin creado.")

    ticket_config = TicketConfig(db)
    ticket_config.inicializar_defaults(DEFAULT_CONFIG)
    print("  Configuración de ticket inicializada.")

    db.close()
    print("Base de datos inicializada correctamente.")
