from datetime import datetime, date


def fecha_hora_actual():
    return datetime.now()


def fecha_actual():
    return date.today()


def formatear_fecha(fecha):
    if isinstance(fecha, str):
        try:
            fecha = datetime.fromisoformat(fecha)
        except ValueError:
            return fecha
    if isinstance(fecha, datetime):
        return fecha.strftime("%d/%m/%Y %H:%M")
    elif isinstance(fecha, date):
        return fecha.strftime("%d/%m/%Y")
    return str(fecha)


def formatear_hora(fecha=None):
    if fecha is None:
        fecha = datetime.now()
    if isinstance(fecha, str):
        try:
            fecha = datetime.fromisoformat(fecha)
        except ValueError:
            return ""
    return fecha.strftime("%H:%M")


def formatear_fecha_corta(fecha=None):
    if fecha is None:
        fecha = datetime.now()
    if isinstance(fecha, str):
        try:
            fecha = datetime.fromisoformat(fecha)
        except ValueError:
            return fecha
    if isinstance(fecha, datetime):
        return fecha.strftime("%d/%m/%Y")
    elif isinstance(fecha, date):
        return fecha.strftime("%d/%m/%Y")
    return str(fecha)


def parsear_fecha(fecha_str):
    formatos = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y %H:%M:%S"]
    for fmt in formatos:
        try:
            return datetime.strptime(fecha_str, fmt)
        except ValueError:
            continue
    return None
