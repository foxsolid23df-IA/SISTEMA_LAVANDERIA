import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from database.modelos import TicketConfig
from config import DEFAULT_CONFIG


class TicketConfigWindow:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Configuración de Ticket")
        self.root.geometry("650x700")
        self.root.configure(bg="#f0f2f5")

        self.config_model = TicketConfig()
        self.logo_path = tk.StringVar()

        self._centrar_ventana()
        self._crear_widgets()
        self._cargar_configuracion()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 650, 700
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="🎫 Configuración del Ticket",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        canvas = tk.Canvas(self.root, bg="#f0f2f5", highlightthickness=0)
        scrollbar = ttk.Scrollbar(self.root, orient="vertical", command=canvas.yview)
        self.form_frame = tk.Frame(canvas, bg="#f0f2f5", padx=20, pady=20)

        self.form_frame.bind("<Configure>",
                             lambda e: canvas.configure(scrollregion=canvas.bbox("all")))

        canvas.create_window((0, 0), window=self.form_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", expand=True, fill="both")
        scrollbar.pack(side="right", fill="y")

        self._bind_mousewheel(canvas)

        form = self.form_frame

        tk.Label(form, text="Datos del Negocio", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", pady=(0, 10))

        self.entries = {}

        campos_texto = [
            ("Nombre del Negocio:", "nombre_negocio"),
            ("Dirección:", "direccion"),
            ("Teléfono:", "telefono"),
        ]

        for label, key in campos_texto:
            tk.Label(form, text=label, font=("Segoe UI", 10), bg="#f0f2f5").pack(anchor="w")
            entry = tk.Entry(form, font=("Segoe UI", 11), width=45)
            entry.pack(fill="x", pady=(0, 5))
            self.entries[key] = entry

        tk.Label(form, text="Logo del Ticket", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", pady=(15, 5))

        logo_frame = tk.Frame(form, bg="#f0f2f5")
        logo_frame.pack(fill="x", pady=(0, 5))

        tk.Button(logo_frame, text="Seleccionar imagen...",
                  font=("Segoe UI", 10), bg="#3498db", fg="white", relief="flat",
                  command=self._seleccionar_logo).pack(side="left")

        self.logo_label = tk.Label(logo_frame, text="Ninguna imagen seleccionada",
                                    font=("Segoe UI", 9), bg="#f0f2f5", fg="#666")
        self.logo_label.pack(side="left", padx=10)

        self.mostrar_logo_var = tk.BooleanVar(value=True)
        tk.Checkbutton(form, text="Mostrar logo en el ticket",
                       variable=self.mostrar_logo_var, font=("Segoe UI", 10),
                       bg="#f0f2f5").pack(anchor="w", pady=(5, 0))

        tk.Label(form, text="Formato del Ticket", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", pady=(15, 10))

        ancho_frame = tk.Frame(form, bg="#f0f2f5")
        ancho_frame.pack(fill="x", pady=(0, 5))
        tk.Label(ancho_frame, text="Ancho del papel:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(side="left")
        self.ancho_var = tk.StringVar(value="80")
        tk.Radiobutton(ancho_frame, text="80mm (estándar)", variable=self.ancho_var,
                       value="80", font=("Segoe UI", 10), bg="#f0f2f5").pack(side="left", padx=10)
        tk.Radiobutton(ancho_frame, text="58mm (mini)", variable=self.ancho_var,
                       value="58", font=("Segoe UI", 10), bg="#f0f2f5").pack(side="left", padx=10)

        tk.Label(form, text="Tamaño de fuente:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.fuente_size_var = tk.StringVar(value="12")
        sizes = [str(s) for s in range(8, 25)]
        ttk.Combobox(form, textvariable=self.fuente_size_var, values=sizes,
                     state="readonly", width=5).pack(anchor="w", pady=(0, 5))

        tk.Label(form, text="Fuente:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.fuente_var = tk.StringVar(value="Courier New")
        fuentes = ["Courier New", "Consolas", "Arial", "Times New Roman", "Lucida Console"]
        ttk.Combobox(form, textvariable=self.fuente_var, values=fuentes,
                     state="readonly", width=20).pack(anchor="w", pady=(0, 5))

        self.negrita_var = tk.BooleanVar(value=False)
        tk.Checkbutton(form, text="Texto en negrita",
                       variable=self.negrita_var, font=("Segoe UI", 10),
                       bg="#f0f2f5").pack(anchor="w", pady=(0, 5))

        tk.Label(form, text="Margen horizontal (px):", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.margen_var = tk.StringVar(value="0")
        ttk.Combobox(form, textvariable=self.margen_var,
                     values=[str(m) for m in range(0, 51, 5)],
                     state="readonly", width=5).pack(anchor="w", pady=(0, 5))

        tk.Label(form, text="Mensaje al pie del ticket:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.mensaje_text = tk.Text(form, font=("Segoe UI", 10), height=3, width=45)
        self.mensaje_text.pack(fill="x", pady=(0, 5))

        tk.Label(form, text="Impresora", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5").pack(anchor="w", pady=(15, 10))

        printer_frame = tk.Frame(form, bg="#f0f2f5")
        printer_frame.pack(fill="x", pady=(0, 5))

        self.impresora_var = tk.StringVar()
        impresoras = self._listar_impresoras()
        ttk.Combobox(printer_frame, textvariable=self.impresora_var,
                     values=impresoras, state="readonly", width=35).pack(side="left")

        tk.Button(printer_frame, text="🔄", font=("Segoe UI", 10),
                  command=lambda: self._actualizar_impresoras(printer_frame)).pack(side="left", padx=5)

        self.doble_corte_var = tk.BooleanVar(value=False)
        tk.Checkbutton(form, text="Imprimir 2 copias por ticket",
                       variable=self.doble_corte_var, font=("Segoe UI", 10),
                       bg="#f0f2f5").pack(anchor="w", pady=(10, 0))

        btn_frame = tk.Frame(form, bg="#f0f2f5")
        btn_frame.pack(fill="x", pady=(20, 0))

        tk.Button(btn_frame, text="💾 GUARDAR CONFIGURACIÓN",
                  font=("Segoe UI", 12, "bold"), bg="#2ecc71", fg="white",
                  relief="flat", command=self._guardar).pack(fill="x", pady=(0, 5))

        tk.Button(btn_frame, text="🔄 Restaurar Valores por Defecto",
                  font=("Segoe UI", 10), bg="#95a5a6", fg="white",
                  relief="flat", command=self._restaurar_defaults).pack(fill="x", pady=(0, 5))

        tk.Button(btn_frame, text="👁️ Vista Previa del Ticket",
                  font=("Segoe UI", 10), bg="#9b59b6", fg="white",
                  relief="flat", command=self._vista_previa).pack(fill="x")

    def _bind_mousewheel(self, canvas):
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

        def _bind_to_mousewheel(event):
            canvas.bind_all("<MouseWheel>", _on_mousewheel)

        def _unbind_from_mousewheel(event):
            canvas.unbind_all("<MouseWheel>")

        canvas.bind("<Enter>", _bind_to_mousewheel)
        canvas.bind("<Leave>", _unbind_from_mousewheel)

    def _listar_impresoras(self):
        try:
            import win32print
            impresoras = []
            for printer in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS):
                impresoras.append(printer[2])
            return impresoras
        except ImportError:
            return ["(pywin32 no instalado)"]

    def _actualizar_impresoras(self, parent):
        impresoras = self._listar_impresoras()
        for widget in parent.winfo_children():
            if isinstance(widget, ttk.Combobox):
                widget.configure(values=impresoras)
                break

    def _seleccionar_logo(self):
        filepath = filedialog.askopenfilename(
            title="Seleccionar logo",
            filetypes=[("Imágenes", "*.png *.jpg *.jpeg *.bmp *.gif"), ("Todos", "*.*")]
        )
        if filepath:
            self.logo_path.set(filepath)
            import os
            nombre = os.path.basename(filepath)
            self.logo_label.config(text=nombre)

    def _cargar_configuracion(self):
        config = self.config_model.obtener_todas()

        for key, entry in self.entries.items():
            valor = config.get(key, DEFAULT_CONFIG.get(key, ""))
            entry.insert(0, valor)

        self.ancho_var.set(config.get("ancho_papel", "80"))
        self.fuente_size_var.set(config.get("tamanio_fuente", "12"))
        self.fuente_var.set(config.get("fuente", "Courier New"))
        self.negrita_var.set(config.get("negrita", "0") == "1")
        self.margen_var.set(config.get("margen", "0"))
        self.mostrar_logo_var.set(config.get("mostrar_logo", "1") == "1")
        self.doble_corte_var.set(config.get("doble_corte", "0") == "1")
        self.impresora_var.set(config.get("impresora_nombre", ""))

        logo_path = config.get("logo_path", "")
        if logo_path:
            self.logo_path.set(logo_path)
            import os
            self.logo_label.config(text=os.path.basename(logo_path))

        mensaje = config.get("mensaje_pie", DEFAULT_CONFIG.get("mensaje_pie", ""))
        self.mensaje_text.insert("1.0", mensaje)

    def _guardar(self):
        config = {
            "nombre_negocio": self.entries["nombre_negocio"].get().strip(),
            "direccion": self.entries["direccion"].get().strip(),
            "telefono": self.entries["telefono"].get().strip(),
            "logo_path": self.logo_path.get(),
            "mostrar_logo": "1" if self.mostrar_logo_var.get() else "0",
            "ancho_papel": self.ancho_var.get(),
            "tamanio_fuente": self.fuente_size_var.get(),
            "fuente": self.fuente_var.get(),
            "negrita": "1" if self.negrita_var.get() else "0",
            "margen": self.margen_var.get(),
            "mensaje_pie": self.mensaje_text.get("1.0", tk.END).strip(),
            "impresora_nombre": self.impresora_var.get(),
            "doble_corte": "1" if self.doble_corte_var.get() else "0",
        }

        self.config_model.guardar_diccionario(config)
        messagebox.showinfo("Éxito", "Configuración del ticket guardada")

    def _restaurar_defaults(self):
        if messagebox.askyesno("Confirmar", "¿Restaurar valores por defecto?"):
            self.config_model.guardar_diccionario(DEFAULT_CONFIG)
            for key, entry in self.entries.items():
                entry.delete(0, tk.END)
                entry.insert(0, DEFAULT_CONFIG.get(key, ""))
            self.ancho_var.set(DEFAULT_CONFIG.get("ancho_papel", "80"))
            self.fuente_size_var.set(DEFAULT_CONFIG.get("tamanio_fuente", "12"))
            self.fuente_var.set(DEFAULT_CONFIG.get("fuente", "Courier New"))
            self.negrita_var.set(False)
            self.margen_var.set(DEFAULT_CONFIG.get("margen", "0"))
            self.mostrar_logo_var.set(True)
            self.doble_corte_var.set(False)
            self.impresora_var.set("")
            self.logo_path.set("")
            self.logo_label.config(text="Ninguna imagen seleccionada")
            self.mensaje_text.delete("1.0", tk.END)
            self.mensaje_text.insert("1.0", DEFAULT_CONFIG.get("mensaje_pie", ""))
            messagebox.showinfo("Éxito", "Valores restaurados")

    def _vista_previa(self):
        from reportes.ticket import generar_html_ticket_ejemplo

        config = self._obtener_config_actual()
        html = generar_html_ticket_ejemplo(config)

        preview = tk.Toplevel(self.root)
        preview.title("Vista Previa del Ticket")
        preview.geometry("350x550")
        preview.configure(bg="white")
        preview.transient(self.root)

        try:
            from tkinterweb import HtmlFrame
            frame = HtmlFrame(preview, messages_enabled=False)
            frame.load_html(html)
            frame.pack(expand=True, fill="both")
        except ImportError:
            text = tk.Text(preview, font=("Courier New", 9), wrap="word")
            text.pack(expand=True, fill="both", padx=5, pady=5)
            import re
            clean = re.sub('<[^<]+?>', '', html)
            text.insert("1.0", clean)
            text.config(state="disabled")

        tk.Button(preview, text="Cerrar", font=("Segoe UI", 10),
                  bg="#95a5a6", fg="white", relief="flat",
                  command=preview.destroy).pack(pady=10)

    def _obtener_config_actual(self):
        return {
            "nombre_negocio": self.entries["nombre_negocio"].get().strip() or "Mi Lavandería",
            "direccion": self.entries["direccion"].get().strip(),
            "telefono": self.entries["telefono"].get().strip(),
            "logo_path": self.logo_path.get(),
            "mostrar_logo": self.mostrar_logo_var.get(),
            "ancho_papel": self.ancho_var.get(),
            "tamanio_fuente": self.fuente_size_var.get(),
            "fuente": self.fuente_var.get(),
            "negrita": self.negrita_var.get(),
            "margen": self.margen_var.get(),
            "mensaje_pie": self.mensaje_text.get("1.0", tk.END).strip(),
            "impresora_nombre": self.impresora_var.get(),
            "doble_corte": self.doble_corte_var.get(),
        }
