def formatear_moneda(monto):
    if monto is None:
        return "$0.00"
    return f"${monto:,.2f} MXN"


def formatear_moneda_corta(monto):
    if monto is None:
        return "$0.00"
    return f"${monto:,.2f}"


def parsear_moneda(texto):
    if not texto:
        return 0.0
    texto = texto.replace("$", "").replace("MXN", "").replace(",", "").strip()
    try:
        return float(texto)
    except ValueError:
        return 0.0
