import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.lib.units import inch

def create_brochure(output_path, image_folder):
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter
    
    # --- Página 1: Portada ---
    c.setFillColor(colors.HexColor("#1e293b")) # Dark background
    c.rect(0, 0, width, height, fill=1)
    
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 36)
    c.drawCentredString(width / 2, height - 3 * inch, "FoxSolid Laundry 2026")
    
    c.setFont("Helvetica", 18)
    c.drawCentredString(width / 2, height - 3.5 * inch, "Control Total. Cero Errores. Máximo Crecimiento.")
    
    c.setFont("Helvetica-Oblique", 14)
    c.drawCentredString(width / 2, 2 * inch, "Tu negocio en tu bolsillo.")
    c.showPage()

    # --- Páginas de Características ---
    sections = [
        {
            "title": "Ventas y POS Intuitivo",
            "image": "ventas.png",
            "desc": [
                "• Registra órdenes en segundos con una interfaz táctil.",
                "• Soporte para servicios por kilo, pieza y productos comunes.",
                "• Olvídate de las cuentas a mano y los errores de cobro."
            ]
        },
        {
            "title": "Gestión del Ciclo de Lavado",
            "image": "historial.png",
            "desc": [
                "• Monitorea el estado de cada prenda en tiempo real.",
                "• De 'Recibido' a 'Entregado' sin perder el rastro.",
                "• Prioriza entregas y optimiza el flujo de tu personal."
            ]
        },
        {
            "title": "Inteligencia de Negocio",
            "image": "estadisticas.png",
            "desc": [
                "• Toma decisiones basadas en datos reales.",
                "• Gráficas de ingresos, servicios top y tendencias.",
                "• Auditoría de cancelaciones para evitar fugas de dinero."
            ]
        },
        {
            "title": "Control de Insumos e Inventario",
            "image": "inventario.png",
            "desc": [
                "• Alertas automáticas de stock bajo (jabón, bolsas, etc.).",
                "• Libreta digital de existencias para evitar compras de pánico.",
                "• Control de compras y gastos operativos integrado."
            ]
        }
    ]

    for section in sections:
        c.setFillColor(colors.HexColor("#0f172a"))
        c.rect(0, 0, width, height, fill=1)
        
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 24)
        c.drawString(0.5 * inch, height - 1 * inch, section["title"])
        
        # Imagen
        img_path = os.path.join(image_folder, section["image"])
        if os.path.exists(img_path):
            img = ImageReader(img_path)
            # Mantener proporción (letter es 8.5 x 11 inch)
            img_w, img_h = img.getSize()
            aspect = img_h / float(img_w)
            display_w = 7.5 * inch
            display_h = display_w * aspect
            
            # Si es muy alta, ajustar por altura
            if display_h > 5 * inch:
                display_h = 5 * inch
                display_w = display_h / aspect
                
            c.drawImage(img, 0.5 * inch, height - 1.5 * inch - display_h, width=display_w, height=display_h)
            
            # Texto descriptivo debajo de la imagen
            text_y = height - 2 * inch - display_h
            c.setFont("Helvetica", 14)
            for line in section["desc"]:
                c.drawString(0.7 * inch, text_y, line)
                text_y -= 0.3 * inch
        else:
            c.drawString(0.5 * inch, height - 3 * inch, f"[Imagen no encontrada: {section['image']}]")
            
        c.showPage()

    # --- Página Final ---
    c.setFillColor(colors.HexColor("#1e293b"))
    c.rect(0, 0, width, height, fill=1)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height / 2 + 1 * inch, "¿Listo para modernizar tu lavandería?")
    c.setFont("Helvetica", 16)
    c.drawCentredString(width / 2, height / 2, "FoxSolid Software Solutions 2026")
    
    c.save()

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(current_dir)
    img_folder = os.path.join(project_root, "screenshots")
    output = os.path.join(project_root, "FoxSolid_Laundry_Brochure_2026.pdf")
    
    print(f"Generando PDF en: {output}")
    create_brochure(output, img_folder)
    print("¡PDF generado con éxito!")
