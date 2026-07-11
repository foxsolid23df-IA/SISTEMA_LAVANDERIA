import tkinter as tk
from tkinter import ttk
from database.modelos import Orden, Pago
from utils.fechas import formatear_fecha
from utils.moneda import formatear_moneda


class ReportesWindow:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Reportes")
        self.root.geometry("900x600")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()
        self._cargar_resumen()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 900, 600
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="📊 Reportes Básicos",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(expand=True, fill="both", padx=10, pady=10)

        self.tab_resumen = tk.Frame(self.notebook, bg="#f0f2f5")
        self.tab_ventas = tk.Frame(self.notebook, bg="#f0f2f5")
        self.tab_ordenes = tk.Frame(self.notebook, bg="#f0f2f5")
        self.tab_servicios = tk.Frame(self.notebook, bg="#f0f2f5")

        self.notebook.add(self.tab_resumen, text="Resumen General")
        self.notebook.add(self.tab_ventas, text="Ventas Recientes")
        self.notebook.add(self.tab_ordenes, text="Órdenes por Estado")
        self.notebook.add(self.tab_servicios, text="Servicios")

        self._crear_tab_resumen()
        self._crear_tab_ventas()
        self._crear_tab_ordenes()
        self._crear_tab_servicios()

    def _crear_tab_resumen(self):
        frame = tk.Frame(self.tab_resumen, bg="#f0f2f5", padx=20, pady=20)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Resumen del Negocio", font=("Segoe UI", 16, "bold"),
                 bg="#f0f2f5").pack(anchor="w", pady=(0, 20))

        stats_frame = tk.Frame(frame, bg="#f0f2f5")
        stats_frame.pack(fill="x")

        self.stat_ventas_hoy = self._crear_stat_card(stats_frame, "Ventas Hoy", "$0.00", "#2ecc71")
        self.stat_ventas_semana = self._crear_stat_card(stats_frame, "Ventas Semana", "$0.00", "#3498db")
        self.stat_ventas_mes = self._crear_stat_card(stats_frame, "Ventas Mes", "$0.00", "#9b59b6")
        self.stat_ordenes_pendientes = self._crear_stat_card(stats_frame, "Órdenes Pendientes", "0", "#e67e22")

        ordenes_frame = tk.Frame(frame, bg="#f0f2f5")
        ordenes_frame.pack(fill="x", pady=(30, 0))

        tk.Label(ordenes_frame, text="Distribución de Órdenes:", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", pady=(0, 10))

        self.estado_labels = {}
        for estado, color in [("recibido", "#3498db"), ("proceso", "#e67e22"),
                               ("listo", "#2ecc71"), ("entregado", "#95a5a6")]:
            f = tk.Frame(ordenes_frame, bg="#f0f2f5")
            f.pack(fill="x", pady=2)
            tk.Label(f, text="●", font=("Segoe UI", 12), bg="#f0f2f5", fg=color).pack(side="left")
            tk.Label(f, text=f"{estado.capitalize()}:", font=("Segoe UI", 10),
                     bg="#f0f2f5", width=12, anchor="w").pack(side="left")
            lbl = tk.Label(f, text="0", font=("Segoe UI", 10, "bold"), bg="#f0f2f5")
            lbl.pack(side="left")
            self.estado_labels[estado] = lbl

    def _crear_stat_card(self, parent, titulo, valor, color):
        card = tk.Frame(parent, bg="white", relief="flat")
        card.pack(side="left", expand=True, fill="both", padx=5)

        bar = tk.Frame(card, bg=color, height=4)
        bar.pack(fill="x")

        content = tk.Frame(card, bg="white", padx=15, pady=10)
        content.pack(expand=True, fill="both")

        tk.Label(content, text=titulo, font=("Segoe UI", 9), bg="white", fg="#666").pack(anchor="w")
        lbl = tk.Label(content, text=valor, font=("Segoe UI", 14, "bold"), bg="white", fg="#333")
        lbl.pack(anchor="w")
        return lbl

    def _crear_tab_ventas(self):
        frame = tk.Frame(self.tab_ventas, bg="#f0f2f5")
        frame.pack(expand=True, fill="both", padx=10, pady=10)

        tk.Label(frame, text="Últimas Ventas Registradas", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", padx=10, pady=(0, 5))

        columnas = ("folio_venta", "orden", "cliente", "monto", "metodo", "fecha")
        self.tree_ventas = ttk.Treeview(frame, columns=columnas, show="headings", height=20)

        self.tree_ventas.heading("folio_venta", text="Folio Venta")
        self.tree_ventas.heading("orden", text="Orden #")
        self.tree_ventas.heading("cliente", text="Cliente")
        self.tree_ventas.heading("monto", text="Monto")
        self.tree_ventas.heading("metodo", text="Método")
        self.tree_ventas.heading("fecha", text="Fecha")

        self.tree_ventas.column("folio_venta", width=80, anchor="center")
        self.tree_ventas.column("orden", width=70, anchor="center")
        self.tree_ventas.column("cliente", width=150)
        self.tree_ventas.column("monto", width=100, anchor="e")
        self.tree_ventas.column("metodo", width=100, anchor="center")
        self.tree_ventas.column("fecha", width=120, anchor="center")

        scroll = ttk.Scrollbar(frame, orient="vertical", command=self.tree_ventas.yview)
        self.tree_ventas.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.tree_ventas.pack(expand=True, fill="both", padx=5, pady=5)

    def _crear_tab_ordenes(self):
        frame = tk.Frame(self.tab_ordenes, bg="#f0f2f5")
        frame.pack(expand=True, fill="both", padx=10, pady=10)

        tk.Label(frame, text="Órdenes por Estado", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", padx=10, pady=(0, 5))

        self.tree_ordenes_estado = ttk.Treeview(frame, columns=("estado", "cantidad"),
                                                 show="headings", height=10)
        self.tree_ordenes_estado.heading("estado", text="Estado")
        self.tree_ordenes_estado.heading("cantidad", text="Cantidad de Órdenes")
        self.tree_ordenes_estado.column("estado", width=200)
        self.tree_ordenes_estado.column("cantidad", width=200, anchor="center")
        self.tree_ordenes_estado.pack(expand=True, fill="both", padx=10, pady=10)

    def _crear_tab_servicios(self):
        frame = tk.Frame(self.tab_servicios, bg="#f0f2f5")
        frame.pack(expand=True, fill="both", padx=10, pady=10)

        tk.Label(frame, text="Órdenes por Tipo de Servicio", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", padx=10, pady=(0, 5))

        columnas = ("servicio", "cantidad", "total")
        self.tree_servicios = ttk.Treeview(frame, columns=columnas, show="headings", height=10)
        self.tree_servicios.heading("servicio", text="Servicio")
        self.tree_servicios.heading("cantidad", text="Órdenes")
        self.tree_servicios.heading("total", text="Total Facturado")
        self.tree_servicios.column("servicio", width=250)
        self.tree_servicios.column("cantidad", width=150, anchor="center")
        self.tree_servicios.column("total", width=200, anchor="e")
        self.tree_servicios.pack(expand=True, fill="both", padx=10, pady=10)

    def _cargar_resumen(self):
        ordenes = Orden()

        self.stat_ventas_hoy.config(text=formatear_moneda(ordenes.total_ventas_hoy()))
        self.stat_ventas_semana.config(text=formatear_moneda(ordenes.total_ventas_semana()))
        self.stat_ventas_mes.config(text=formatear_moneda(ordenes.total_ventas_mes()))

        pendientes = ordenes.listar_por_estado("listo")
        self.stat_ordenes_pendientes.config(text=str(len(pendientes)))

        for estado, lbl in self.estado_labels.items():
            todas = ordenes.listar_por_estado(estado)
            lbl.config(text=str(len(todas)))

        pagos = Pago()
        ultimas_ventas = pagos.listar_hoy()
        for v in ultimas_ventas:
            self.tree_ventas.insert("", "end", values=(
                v["folio_venta"],
                f"#{v['orden_id']}",
                v["cliente_nombre"] or "N/A",
                formatear_moneda(v["monto"]),
                v["metodo_pago"].upper(),
                formatear_fecha(v["created_at"])
            ))

        for estado_row in ordenes.contar_por_estado():
            self.tree_ordenes_estado.insert("", "end", values=(
                estado_row["estado"].upper(),
                estado_row["total"]
            ))

        servicios_data = ordenes.db.fetch_all(
            """SELECT s.nombre as servicio, COUNT(*) as cantidad, SUM(o.costo_total) as total
               FROM ordenes o
               JOIN servicios s ON o.servicio_id = s.id
               GROUP BY o.servicio_id
               ORDER BY total DESC"""
        )
        for s in servicios_data:
            self.tree_servicios.insert("", "end", values=(
                s["servicio"],
                s["cantidad"],
                formatear_moneda(s["total"])
            ))
