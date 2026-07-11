import base64
import os
from datetime import datetime
from utils.fechas import formatear_fecha, formatear_hora
from utils.moneda import formatear_moneda


def generar_html_ticket(orden, datos_pago, folio_venta, config):
    nombre = config.get("nombre_negocio", "Mi Lavandería")
    direccion = config.get("direccion", "")
    telefono = config.get("telefono", "")
    logo_path = config.get("logo_path", "")
    mostrar_logo = config.get("mostrar_logo", "1") == "1"
    ancho = config.get("ancho_papel", "80")
    fuente = config.get("fuente", "Courier New")
    tam_fuente = config.get("tamanio_fuente", "12")
    negrita = config.get("negrita", "0") == "1"
    margen = config.get("margen", "0")
    mensaje_pie = config.get("mensaje_pie", "¡Gracias por su preferencia!")

    logo_html = ""
    if mostrar_logo and logo_path and os.path.exists(logo_path):
        try:
            with open(logo_path, "rb") as f:
                img_data = base64.b64encode(f.read()).decode()
            ext = os.path.splitext(logo_path)[1].lower()
            mime = {"png": "image/png", "jpg": "image/jpeg",
                    "jpeg": "image/jpeg", "bmp": "image/bmp"}.get(ext.lstrip("."), "image/png")
            logo_html = f'<div style="text-align:center;margin-bottom:8px;"><img src="data:{mime};base64,{img_data}" style="max-height:80px;filter:grayscale(100%);"></div>'
        except Exception:
            pass

    font_weight = "bold" if negrita else "normal"

    ahora = datetime.now()

    cliente_nombre = orden.get("cliente_nombre", "Cliente General") or "Cliente General"
    servicio_nombre = orden.get("servicio_nombre", "N/A") or "N/A"
    peso = orden.get("peso_kg", 0)
    precio_kg = orden.get("precio_por_kg", 0)
    costo_total = orden.get("costo_total", 0)
    folio = orden.get("folio", 0)
    descripcion_ropa = orden.get("descripcion_ropa", "") or ""
    observaciones = orden.get("observaciones", "") or ""

    total = datos_pago.get("total", costo_total)
    recibido = datos_pago.get("recibido", total)
    cambio = datos_pago.get("cambio", 0)
    metodo = datos_pago.get("metodo", "efectivo").capitalize()

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
        font-family: '{fuente}', monospace;
        font-size: {tam_fuente}px;
        font-weight: {font_weight};
        width: {ancho}mm;
        padding: {margen}px;
        background: white;
        color: black;
    }}
    .center {{ text-align: center; }}
    .bold {{ font-weight: bold; }}
    .separator {{
        border-top: 1px dashed #000;
        margin: 8px 0;
    }}
    .section {{
        margin: 5px 0;
    }}
    .row {{
        display: flex;
        justify-content: space-between;
    }}
    .total {{
        font-size: {int(tam_fuente) + 4}px;
        font-weight: bold;
        text-align: right;
        margin: 5px 0;
    }}
</style>
</head>
<body>
    {logo_html}
    <div class="center bold" style="font-size:{int(tam_fuente) + 4}px;">
        {nombre.upper()}
    </div>
"""

    if direccion:
        html += f'    <div class="center">{direccion}</div>\n'
    if telefono:
        html += f'    <div class="center">Tel: {telefono}</div>\n'

    html += f"""
    <div class="separator"></div>
    <div class="center bold">COMPROBANTE DE RECEPCIÓN</div>
    <div class="center bold">ORDEN #{str(folio).zfill(6)}</div>
    <div class="center">{formatear_fecha(ahora)}</div>
    <div class="separator"></div>

    <div class="section">
        <div><span class="bold">Cliente:</span> {cliente_nombre}</div>
    </div>
    <div class="separator"></div>

    <div class="section">
        <div><span class="bold">Servicio:</span> {servicio_nombre}</div>
        <div><span class="bold">Peso:</span> {peso:.1f} kg × ${precio_kg:.2f}/kg</div>
"""

    if descripcion_ropa:
        html += f'        <div><span class="bold">Ropa:</span> {descripcion_ropa}</div>\n'

    html += f"""
    </div>
    <div class="separator"></div>

    <div class="row">
        <span class="bold">SUBTOTAL:</span>
        <span>{formatear_moneda(total)}</span>
    </div>
    <div class="total">
        TOTAL: {formatear_moneda(total)}
    </div>
    <div class="row">
        <span class="bold">PAGADO:</span>
        <span>{formatear_moneda(recibido)}</span>
    </div>
    <div class="row">
        <span class="bold">MÉTODO:</span>
        <span>{metodo.upper()}</span>
    </div>
"""

    if cambio > 0:
        html += f"""    <div class="row">
        <span class="bold">CAMBIO:</span>
        <span>{formatear_moneda(cambio)}</span>
    </div>
"""

    html += f"""
    <div class="separator"></div>
    <div class="center" style="margin-top:10px;font-size:{int(tam_fuente) - 1}px;">
        {mensaje_pie}
    </div>
</body>
</html>"""

    return html


def generar_html_ticket_ejemplo(config):
    orden_ejemplo = {
        "folio": 123,
        "cliente_nombre": "Juan Pérez García",
        "cliente_telefono": "555-123-4567",
        "servicio_nombre": "Lavado exprés",
        "peso_kg": 5.2,
        "precio_por_kg": 50.0,
        "costo_total": 260.0,
        "descripcion_ropa": "Camisas, pantalones, ropa interior",
        "observaciones": "",
    }

    datos_pago = {
        "total": 260.0,
        "recibido": 300.0,
        "cambio": 40.0,
        "metodo": "efectivo",
    }

    return generar_html_ticket(orden_ejemplo, datos_pago, 456, config)
