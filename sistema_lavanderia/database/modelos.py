from database.conexion import Database


class Cliente:
    def __init__(self, db=None):
        self.db = db or Database()

    def crear(self, nombre, telefono="", email="", direccion=""):
        self.db.ejecutar(
            "INSERT INTO clientes (nombre, telefono, email, direccion) VALUES (?, ?, ?, ?)",
            (nombre, telefono, email, direccion)
        )
        return self.db.last_insert_id()

    def obtener_por_id(self, cliente_id):
        return self.db.fetch_one("SELECT * FROM clientes WHERE id = ?", (cliente_id,))

    def buscar(self, termino):
        return self.db.fetch_all(
            "SELECT * FROM clientes WHERE (nombre LIKE ? OR telefono LIKE ?) AND activo = 1",
            (f"%{termino}%", f"%{termino}%")
        )

    def listar_todos(self):
        return self.db.fetch_all("SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre")

    def actualizar(self, cliente_id, nombre, telefono="", email="", direccion=""):
        self.db.ejecutar(
            "UPDATE clientes SET nombre=?, telefono=?, email=?, direccion=? WHERE id=?",
            (nombre, telefono, email, direccion, cliente_id)
        )

    def eliminar(self, cliente_id):
        self.db.ejecutar("UPDATE clientes SET activo = 0 WHERE id = ?", (cliente_id,))

    def obtener_o_crear(self, nombre, telefono=""):
        cliente = self.db.fetch_one(
            "SELECT * FROM clientes WHERE nombre = ? AND activo = 1", (nombre,)
        )
        if cliente:
            return cliente["id"]
        return self.crear(nombre, telefono)


class Servicio:
    def __init__(self, db=None):
        self.db = db or Database()

    def crear(self, nombre, descripcion="", precio_por_kg=0.0):
        self.db.ejecutar(
            "INSERT INTO servicios (nombre, descripcion, precio_por_kg) VALUES (?, ?, ?)",
            (nombre, descripcion, precio_por_kg)
        )
        return self.db.last_insert_id()

    def obtener_por_id(self, servicio_id):
        return self.db.fetch_one("SELECT * FROM servicios WHERE id = ?", (servicio_id,))

    def listar_todos(self):
        return self.db.fetch_all("SELECT * FROM servicios WHERE activo = 1 ORDER BY nombre")

    def actualizar(self, servicio_id, nombre, descripcion="", precio_por_kg=0.0):
        self.db.ejecutar(
            "UPDATE servicios SET nombre=?, descripcion=?, precio_por_kg=? WHERE id=?",
            (nombre, descripcion, precio_por_kg, servicio_id)
        )

    def eliminar(self, servicio_id):
        self.db.ejecutar("UPDATE servicios SET activo = 0 WHERE id = ?", (servicio_id,))

    def contar(self):
        result = self.db.fetch_one("SELECT COUNT(*) as total FROM servicios WHERE activo = 1")
        return result["total"] if result else 0


class Orden:
    def __init__(self, db=None):
        self.db = db or Database()

    def crear(self, cliente_id, servicio_id, peso_kg, costo_total,
              descripcion_ropa="", observaciones="", fecha_entrega_estimada=None):
        folio = self._siguiente_folio()
        self.db.ejecutar(
            """INSERT INTO ordenes
               (folio, cliente_id, servicio_id, peso_kg, costo_total,
                descripcion_ropa, observaciones, fecha_entrega_estimada)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (folio, cliente_id, servicio_id, peso_kg, costo_total,
             descripcion_ropa, observaciones, fecha_entrega_estimada)
        )
        return self.db.last_insert_id(), folio

    def _siguiente_folio(self):
        result = self.db.fetch_one("SELECT MAX(folio) as max_folio FROM ordenes")
        if result and result["max_folio"]:
            return result["max_folio"] + 1
        return 1

    def obtener_por_id(self, orden_id):
        return self.db.fetch_one(
            """SELECT o.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
                      s.nombre as servicio_nombre, s.precio_por_kg
               FROM ordenes o
               LEFT JOIN clientes c ON o.cliente_id = c.id
               LEFT JOIN servicios s ON o.servicio_id = s.id
               WHERE o.id = ?""",
            (orden_id,)
        )

    def obtener_por_folio(self, folio):
        return self.db.fetch_one(
            """SELECT o.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono,
                      s.nombre as servicio_nombre, s.precio_por_kg
               FROM ordenes o
               LEFT JOIN clientes c ON o.cliente_id = c.id
               LEFT JOIN servicios s ON o.servicio_id = s.id
               WHERE o.folio = ?""",
            (folio,)
        )

    def listar_por_estado(self, estado=None):
        if estado:
            return self.db.fetch_all(
                """SELECT o.*, c.nombre as cliente_nombre, s.nombre as servicio_nombre
                   FROM ordenes o
                   LEFT JOIN clientes c ON o.cliente_id = c.id
                   LEFT JOIN servicios s ON o.servicio_id = s.id
                   WHERE o.estado = ? ORDER BY o.folio DESC""",
                (estado,)
            )
        return self.db.fetch_all(
            """SELECT o.*, c.nombre as cliente_nombre, s.nombre as servicio_nombre
               FROM ordenes o
               LEFT JOIN clientes c ON o.cliente_id = c.id
               LEFT JOIN servicios s ON o.servicio_id = s.id
               ORDER BY o.folio DESC"""
        )

    def listar_hoy(self):
        return self.db.fetch_all(
            """SELECT o.*, c.nombre as cliente_nombre, s.nombre as servicio_nombre
               FROM ordenes o
               LEFT JOIN clientes c ON o.cliente_id = c.id
               LEFT JOIN servicios s ON o.servicio_id = s.id
               WHERE DATE(o.fecha_recepcion) = DATE('now')
               ORDER BY o.folio DESC"""
        )

    def cambiar_estado(self, orden_id, nuevo_estado):
        extra = ""
        params = (nuevo_estado,)
        if nuevo_estado == "entregado":
            extra = ", fecha_entrega_real = CURRENT_TIMESTAMP"
        self.db.ejecutar(
            f"UPDATE ordenes SET estado = ?{extra} WHERE id = ?",
            (*params, orden_id)
        )

    def esta_pagada(self, orden_id):
        result = self.db.fetch_one(
            "SELECT COUNT(*) as total FROM pagos WHERE orden_id = ?", (orden_id,)
        )
        return result["total"] > 0 if result else False

    def contar_por_estado(self):
        return self.db.fetch_all(
            "SELECT estado, COUNT(*) as total FROM ordenes GROUP BY estado"
        )

    def total_ventas_hoy(self):
        result = self.db.fetch_one(
            """SELECT COALESCE(SUM(p.monto), 0) as total
               FROM pagos p
               WHERE DATE(p.created_at) = DATE('now')"""
        )
        return result["total"] if result else 0

    def total_ventas_semana(self):
        result = self.db.fetch_one(
            """SELECT COALESCE(SUM(p.monto), 0) as total
               FROM pagos p
               WHERE p.created_at >= datetime('now', '-7 days')"""
        )
        return result["total"] if result else 0

    def total_ventas_mes(self):
        result = self.db.fetch_one(
            """SELECT COALESCE(SUM(p.monto), 0) as total
               FROM pagos p
               WHERE strftime('%Y-%m', p.created_at) = strftime('%Y-%m', 'now')"""
        )
        return result["total"] if result else 0


class Pago:
    def __init__(self, db=None):
        self.db = db or Database()

    def crear(self, orden_id, monto, metodo_pago="efectivo", cambio=0):
        folio_venta = self._siguiente_folio_venta()
        self.db.ejecutar(
            """INSERT INTO pagos (orden_id, monto, metodo_pago, cambio, folio_venta)
               VALUES (?, ?, ?, ?, ?)""",
            (orden_id, monto, metodo_pago, cambio, folio_venta)
        )
        return self.db.last_insert_id(), folio_venta

    def _siguiente_folio_venta(self):
        result = self.db.fetch_one("SELECT MAX(folio_venta) as max_folio FROM pagos")
        if result and result["max_folio"]:
            return result["max_folio"] + 1
        return 1

    def obtener_por_orden(self, orden_id):
        return self.db.fetch_one(
            "SELECT * FROM pagos WHERE orden_id = ? ORDER BY created_at DESC",
            (orden_id,)
        )

    def listar_hoy(self):
        return self.db.fetch_all(
            """SELECT p.*, o.folio as orden_folio, c.nombre as cliente_nombre
               FROM pagos p
               LEFT JOIN ordenes o ON p.orden_id = o.id
               LEFT JOIN clientes c ON o.cliente_id = c.id
               WHERE DATE(p.created_at) = DATE('now')
               ORDER BY p.created_at DESC"""
        )

    def total_pagos_hoy(self):
        result = self.db.fetch_one(
            """SELECT COALESCE(SUM(monto), 0) as total
               FROM pagos WHERE DATE(created_at) = DATE('now')"""
        )
        return result["total"] if result else 0


class CajaSesion:
    def __init__(self, db=None):
        self.db = db or Database()

    def abrir(self, fondo_inicial):
        self.db.ejecutar(
            "INSERT INTO caja_sesiones (fondo_inicial, estado) VALUES (?, 'abierta')",
            (fondo_inicial,)
        )
        return self.db.last_insert_id()

    def sesion_abierta(self):
        return self.db.fetch_one(
            "SELECT * FROM caja_sesiones WHERE estado = 'abierta' ORDER BY id DESC LIMIT 1"
        )

    def cerrar(self, sesion_id, monto_cierre):
        sesion = self.db.fetch_one(
            "SELECT * FROM caja_sesiones WHERE id = ?", (sesion_id,)
        )
        if not sesion:
            return False

        total_ingresos = self.db.fetch_one(
            """SELECT COALESCE(SUM(monto), 0) as total
               FROM caja_movimientos WHERE sesion_id = ? AND tipo = 'ingreso'""",
            (sesion_id,)
        )
        total_egresos = self.db.fetch_one(
            """SELECT COALESCE(SUM(monto), 0) as total
               FROM caja_movimientos WHERE sesion_id = ? AND tipo = 'egreso'""",
            (sesion_id,)
        )
        saldo_esperado = (sesion["fondo_inicial"] +
                          (total_ingresos["total"] if total_ingresos else 0) -
                          (total_egresos["total"] if total_egresos else 0))

        self.db.ejecutar(
            """UPDATE caja_sesiones
               SET estado = 'cerrada', monto_cierre = ?, saldo_esperado = ?,
                   fecha_cierre = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (monto_cierre, saldo_esperado, sesion_id)
        )
        return True

    def obtener_historial(self, limite=30):
        return self.db.fetch_all(
            """SELECT * FROM caja_sesiones
               ORDER BY fecha_apertura DESC LIMIT ?""",
            (limite,)
        )

    def agregar_movimiento(self, sesion_id, tipo, concepto, monto, referencia=""):
        self.db.ejecutar(
            """INSERT INTO caja_movimientos (sesion_id, tipo, concepto, monto, referencia)
               VALUES (?, ?, ?, ?, ?)""",
            (sesion_id, tipo, concepto, monto, referencia)
        )

    def obtener_movimientos(self, sesion_id):
        return self.db.fetch_all(
            """SELECT * FROM caja_movimientos
               WHERE sesion_id = ? ORDER BY created_at""",
            (sesion_id,)
        )

    def total_ingresos(self, sesion_id):
        result = self.db.fetch_one(
            """SELECT COALESCE(SUM(monto), 0) as total
               FROM caja_movimientos WHERE sesion_id = ? AND tipo = 'ingreso'""",
            (sesion_id,)
        )
        return result["total"] if result else 0

    def total_egresos(self, sesion_id):
        result = self.db.fetch_one(
            """SELECT COALESCE(SUM(monto), 0) as total
               FROM caja_movimientos WHERE sesion_id = ? AND tipo = 'egreso'""",
            (sesion_id,)
        )
        return result["total"] if result else 0


class Usuario:
    def __init__(self, db=None):
        self.db = db or Database()

    def crear(self, nombre, pin, rol="operador"):
        self.db.ejecutar(
            "INSERT INTO usuarios (nombre, pin, rol) VALUES (?, ?, ?)",
            (nombre, pin, rol)
        )
        return self.db.last_insert_id()

    def autenticar(self, pin):
        return self.db.fetch_one(
            "SELECT * FROM usuarios WHERE pin = ? AND activo = 1", (pin,)
        )

    def listar_todos(self):
        return self.db.fetch_all(
            "SELECT id, nombre, rol, activo, created_at FROM usuarios ORDER BY nombre"
        )

    def actualizar(self, usuario_id, nombre, pin="", rol="operador"):
        if pin:
            self.db.ejecutar(
                "UPDATE usuarios SET nombre=?, pin=?, rol=? WHERE id=?",
                (nombre, pin, rol, usuario_id)
            )
        else:
            self.db.ejecutar(
                "UPDATE usuarios SET nombre=?, rol=? WHERE id=?",
                (nombre, rol, usuario_id)
            )

    def eliminar(self, usuario_id):
        self.db.ejecutar("UPDATE usuarios SET activo = 0 WHERE id = ?", (usuario_id,))

    def contar(self):
        result = self.db.fetch_one("SELECT COUNT(*) as total FROM usuarios WHERE activo = 1")
        return result["total"] if result else 0


class TicketConfig:
    def __init__(self, db=None):
        self.db = db or Database()

    def obtener(self, clave, valor_default=""):
        result = self.db.fetch_one(
            "SELECT valor FROM ticket_config WHERE clave = ?", (clave,)
        )
        return result["valor"] if result else valor_default

    def obtener_todas(self):
        results = self.db.fetch_all("SELECT clave, valor FROM ticket_config")
        return {r["clave"]: r["valor"] for r in results}

    def guardar(self, clave, valor):
        self.db.ejecutar(
            "INSERT OR REPLACE INTO ticket_config (clave, valor) VALUES (?, ?)",
            (clave, str(valor))
        )

    def guardar_diccionario(self, config_dict):
        for clave, valor in config_dict.items():
            self.guardar(clave, valor)

    def inicializar_defaults(self, defaults):
        existentes = self.obtener_todas()
        for clave, valor in defaults.items():
            if clave not in existentes:
                self.guardar(clave, valor)
