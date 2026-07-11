import sqlite3
import os
from config import DB_PATH


class Database:
    def __init__(self):
        self.db_path = DB_PATH
        self.connection = None

    def connect(self):
        if self.connection is None:
            self.connection = sqlite3.connect(self.db_path)
            self.connection.row_factory = sqlite3.Row
            self.connection.execute("PRAGMA foreign_keys = ON")
        return self.connection

    def close(self):
        if self.connection:
            self.connection.close()
            self.connection = None

    def crear_tablas(self):
        conn = self.connect()
        cursor = conn.cursor()

        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                telefono TEXT,
                email TEXT,
                direccion TEXT,
                activo INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS servicios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                precio_por_kg REAL NOT NULL,
                activo INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ordenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folio INTEGER UNIQUE NOT NULL,
                cliente_id INTEGER REFERENCES clientes(id),
                servicio_id INTEGER REFERENCES servicios(id),
                peso_kg REAL NOT NULL,
                costo_total REAL NOT NULL,
                descripcion_ropa TEXT,
                estado TEXT DEFAULT 'recibido',
                observaciones TEXT,
                fecha_recepcion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_entrega_estimada DATE,
                fecha_entrega_real TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pagos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orden_id INTEGER REFERENCES ordenes(id),
                monto REAL NOT NULL,
                metodo_pago TEXT DEFAULT 'efectivo',
                cambio REAL DEFAULT 0,
                folio_venta INTEGER UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS caja_sesiones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fondo_inicial REAL NOT NULL,
                saldo_esperado REAL DEFAULT 0,
                monto_cierre REAL,
                estado TEXT DEFAULT 'abierta',
                fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_cierre TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS caja_movimientos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sesion_id INTEGER REFERENCES caja_sesiones(id),
                tipo TEXT NOT NULL,
                concepto TEXT NOT NULL,
                monto REAL NOT NULL,
                referencia TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                pin TEXT NOT NULL,
                rol TEXT DEFAULT 'operador',
                activo INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS ticket_config (
                clave TEXT PRIMARY KEY,
                valor TEXT
            );
        """)

        conn.commit()

    def ejecutar(self, sql, params=None):
        conn = self.connect()
        cursor = conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        conn.commit()
        return cursor

    def fetch_one(self, sql, params=None):
        conn = self.connect()
        cursor = conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor.fetchone()

    def fetch_all(self, sql, params=None):
        conn = self.connect()
        cursor = conn.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor.fetchall()

    def last_insert_id(self):
        conn = self.connect()
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]
