import tkinter as tk
from tkinter import ttk, messagebox
from database.modelos import Orden, CajaSesion, Pago
from utils.fechas import formatear_fecha
from utils.moneda import formatear_moneda


class Dashboard:
    def __init__(self, root, usuario, on_navegar):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar

        self.root.title(f"Sistema Lavandería - Bienvenido {usuario['nombre']}")
        self.root.geometry("900x600")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 900, 600
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=60)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="🧺 SISTEMA LAVANDERÍA",
                 font=("Segoe UI", 16, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Label(header, text=f"Usuario: {self.usuario['nombre']}",
                 font=("Segoe UI", 10), bg="#1a1a2e", fg="#aaa").pack(side="right", padx=20)

        main_frame = tk.Frame(self.root, bg="#f0f2f5")
        main_frame.pack(expand=True, fill="both", padx=20, pady=20)

        stats_frame = tk.Frame(main_frame, bg="#f0f2f5")
        stats_frame.pack(fill="x", pady=(0, 20))

        ordenes = Orden()
        self._crear_stat_card(stats_frame, "Órdenes Hoy", str(len(ordenes.listar_hoy())), "#3498db")
        self._crear_stat_card(stats_frame, "Ventas Hoy", formatear_moneda(ordenes.total_ventas_hoy()), "#2ecc71")
        self._crear_stat_card(stats_frame, "Ventas Semana", formatear_moneda(ordenes.total_ventas_semana()), "#9b59b6")
        self._crear_stat_card(stats_frame, "Ventas Mes", formatear_moneda(ordenes.total_ventas_mes()), "#e67e22")

        btn_frame = tk.Frame(main_frame, bg="#f0f2f5")
        btn_frame.pack(expand=True, fill="both")

        botones = [
            ("📋 Nueva Orden", "#3498db", lambda: self.on_navegar("ordenes_nueva")),
            ("📋 Ver Órdenes", "#2980b9", lambda: self.on_navegar("ordenes_lista")),
            ("💰 Cobrar", "#2ecc71", lambda: self.on_navegar("cobro")),
            ("🗄️ Control Caja", "#e67e22", lambda: self.on_navegar("caja")),
            ("📊 Reportes", "#9b59b6", lambda: self.on_navegar("reportes")),
            ("👥 Clientes", "#1abc9c", lambda: self.on_navegar("clientes")),
            ("🎫 Config Ticket", "#e74c3c", lambda: self.on_navegar("ticket_config")),
            ("⚙️ Configuración", "#34495e", lambda: self.on_navegar("configuracion")),
        ]

        for i, (texto, color, cmd) in enumerate(botones):
            row, col = divmod(i, 4)
            btn = tk.Button(btn_frame, text=texto, font=("Segoe UI", 12, "bold"),
                            bg=color, fg="white", activebackground=color,
                            activeforeground="white", relief="flat",
                            width=20, height=3, command=cmd)
            btn.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")

        for c in range(4):
            btn_frame.columnconfigure(c, weight=1)
        for r in range(2):
            btn_frame.rowconfigure(r, weight=1)

    def _crear_stat_card(self, parent, titulo, valor, color):
        card = tk.Frame(parent, bg="white", relief="flat", bd=0)
        card.pack(side="left", expand=True, fill="both", padx=5)

        color_bar = tk.Frame(card, bg=color, height=4)
        color_bar.pack(fill="x")

        content = tk.Frame(card, bg="white", padx=15, pady=10)
        content.pack(expand=True, fill="both")

        tk.Label(content, text=titulo, font=("Segoe UI", 9),
                 bg="white", fg="#666").pack(anchor="w")
        tk.Label(content, text=valor, font=("Segoe UI", 14, "bold"),
                 bg="white", fg="#333").pack(anchor="w")
