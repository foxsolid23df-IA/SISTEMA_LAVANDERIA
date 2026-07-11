import os
import tempfile
import subprocess
import sys


def listar_impresoras():
    try:
        import win32print
        impresoras = []
        flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        for printer in win32print.EnumPrinters(flags):
            impresoras.append(printer[2])
        return impresoras
    except ImportError:
        return []


def impresora_por_defecto():
    try:
        import win32print
        return win32print.GetDefaultPrinter()
    except ImportError:
        return ""


def imprimir_ticket(html_content, nombre_impresora="", copias=1):
    if sys.platform != "win32":
        raise OSError("La impresión solo está soportada en Windows")

    try:
        import win32print
        import win32api
    except ImportError:
        raise ImportError(
            "Se requiere pywin32 para imprimir. "
            "Instale con: pip install pywin32"
        )

    temp_dir = tempfile.gettempdir()
    ticket_file = os.path.join(temp_dir, "ticket_lavanderia.html")

    html_completo = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
    @page {{
        size: auto;
        margin: 0;
    }}
    body {{
        margin: 0;
        padding: 0;
    }}
    @media print {{
        body {{
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
    }}
</style>
</head>
<body>
{html_content}
</body>
</html>"""

    with open(ticket_file, "w", encoding="utf-8-sig") as f:
        f.write(html_completo)

    impresora = nombre_impresora or impresora_por_defecto()
    if not impresora:
        raise Exception("No se encontró ninguna impresora instalada")

    original_default = win32print.GetDefaultPrinter()

    try:
        win32print.SetDefaultPrinter(impresora)

        for _ in range(copias):
            win32api.ShellExecute(
                0, "print", ticket_file,
                None, os.path.dirname(ticket_file), 0
            )

        import time
        time.sleep(2)

    except Exception as e:
        raise Exception(f"Error al imprimir: {str(e)}")
    finally:
        try:
            win32print.SetDefaultPrinter(original_default)
        except Exception:
            pass


def imprimir_texto_simple(texto, nombre_impresora="", copias=1):
    if sys.platform != "win32":
        raise OSError("La impresión solo está soportada en Windows")

    try:
        import win32print
        import win32api
    except ImportError:
        raise ImportError("Se requiere pywin32. Instale con: pip install pywin32")

    temp_dir = tempfile.gettempdir()
    ticket_file = os.path.join(temp_dir, "ticket_lavanderia.txt")

    with open(ticket_file, "w", encoding="utf-8") as f:
        f.write(texto)

    impresora = nombre_impresora or impresora_por_defecto()
    if not impresora:
        raise Exception("No se encontró ninguna impresora")

    original_default = win32print.GetDefaultPrinter()

    try:
        win32print.SetDefaultPrinter(impresora)
        for _ in range(copias):
            win32api.ShellExecute(
                0, "print", ticket_file,
                None, os.path.dirname(ticket_file), 0
            )
        import time
        time.sleep(2)
    except Exception as e:
        raise Exception(f"Error al imprimir: {str(e)}")
    finally:
        try:
            win32print.SetDefaultPrinter(original_default)
        except Exception:
            pass
