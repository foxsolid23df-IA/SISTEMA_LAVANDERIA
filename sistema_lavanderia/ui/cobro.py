import tkinter as tk
from tkinter import ttk, messagebox
from database.modelos import Orden, Pago, CajaSesion
from utils.fechas import formatear_fecha
from utils.moneda import formatear_moneda, parsear_moneda


class CobroWindow:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Cobro")
        self.root.geometry("700x600")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()
        self._cargar_ordenes_pendientes()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 700, 600
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="💰 Cobro de Órdenes",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        list_frame = tk.Frame(self.root, bg="white")
        list_frame.pack(expand=True, fill="both", padx=10, pady=10)

        tk.Label(list_frame, text="Órdenes listas para cobrar:",
                 font=("Segoe UI", 11, "bold"), bg="white").pack(anchor="w", padx=10, pady=(10, 5))

        columnas = ("folio", "cliente", "servicio", "peso", "costo", "fecha")
        self.tree = ttk.Treeview(list_frame, columns=columnas, show="headings", height=12)

        self.tree.heading("folio", text="Folio")
        self.tree.heading("cliente", text="Cliente")
        self.tree.heading("servicio", text="Servicio")
        self.tree.heading("peso", text="Peso")
        self.tree.heading("costo", text="Costo")
        self.tree.heading("fecha", text="Fecha")

        self.tree.column("folio", width=60, anchor="center")
        self.tree.column("cliente", width=150)
        self.tree.column("servicio", width=120)
        self.tree.column("peso", width=70, anchor="center")
        self.tree.column("costo", width=100, anchor="e")
        self.tree.column("fecha", width=100, anchor="center")

        scroll = ttk.Scrollbar(list_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y", padx=(0, 5), pady=5)
        self.tree.pack(expand=True, fill="both", padx=5, pady=5)

        pay_frame = tk.Frame(self.root, bg="#f0f2f5", padx=20, pady=10)
        pay_frame.pack(fill="x")

        info_frame = tk.Frame(pay_frame, bg="#f0f2f5")
        info_frame.pack(fill="x", pady=(0, 10))

        tk.Label(info_frame, text="Total a cobrar:", font=("Segoe UI", 11),
                 bg="#f0f2f5").pack(side="left")
        self.total_label = tk.Label(info_frame, text="$0.00 MXN",
                                     font=("Segoe UI", 16, "bold"),
                                     bg="#f0f2f5", fg="#2ecc71")
        self.total_label.pack(side="left", padx=10)

        self.tree.bind("<<TreeviewSelect>>", self._seleccion_orden)

        metodo_frame = tk.Frame(pay_frame, bg="#f0f2f5")
        metodo_frame.pack(fill="x", pady=(0, 5))

        tk.Label(metodo_frame, text="Método de pago:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(side="left")

        self.metodo_var = tk.StringVar(value="efectivo")
        for metodo in ["efectivo", "tarjeta", "transferencia"]:
            tk.Radiobutton(metodo_frame, text=metodo.capitalize(),
                           variable=self.metodo_var, value=metodo,
                           font=("Segoe UI", 10), bg="#f0f2f5").pack(side="left", padx=10)

        monto_frame = tk.Frame(pay_frame, bg="#f0f2f5")
        monto_frame.pack(fill="x", pady=(0, 5))

        tk.Label(monto_frame, text="Monto recibido:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(side="left")

        self.monto_entry = tk.Entry(monto_frame, font=("Segoe UI", 12), width=15)
        self.monto_entry.pack(side="left", padx=10)

        self.cambio_label = tk.Label(monto_frame, text="Cambio: $0.00",
                                      font=("Segoe UI", 12, "bold"),
                                      bg="#f0f2f5", fg="#e74c3c")
        self.cambio_label.pack(side="left", padx=10)

        self.monto_entry.bind("<KeyRelease>", self._calcular_cambio)

        btn_frame = tk.Frame(pay_frame, bg="#f0f2f5")
        btn_frame.pack(fill="x", pady=(10, 0))

        tk.Button(btn_frame, text="💰 COBRAR Y GENERAR TICKET",
                  font=("Segoe UI", 12, "bold"), bg="#2ecc71", fg="white",
                  relief="flat", height=2, command=self._cobrar).pack(fill="x")

        tk.Button(btn_frame, text="💰 COBRAR SIN IMPRIMIR",
                  font=("Segoe UI", 10), bg="#3498db", fg="white",
                  relief="flat", command=self._cobrar_sin_imprimir).pack(fill="x", pady=(5, 0))

    def _cargar_ordenes_pendientes(self):
        for item in self.tree.get_children():
            self.tree.delete(item)

        ordenes = Orden()
        pendientes = ordenes.listar_por_estado("listo")

        for row in pendientes:
            self.tree.insert("", "end", values=(
                row["folio"],
                row["cliente_nombre"] or "Sin cliente",
                row["servicio_nombre"] or "N/A",
                f"{row['peso_kg']:.1f} kg",
                formatear_moneda(row["costo_total"]),
                formatear_fecha(row["created_at"])
            ))

    def _seleccion_orden(self, event):
        sel = self.tree.selection()
        if sel:
            valores = self.tree.item(sel[0])["values"]
            costo_str = valores[4].replace("$", "").replace("MXN", "").replace(",", "").strip()
            try:
                costo = float(costo_str)
                self.total_label.config(text=formatear_moneda(costo))
                self.monto_entry.delete(0, tk.END)
                self.monto_entry.insert(0, costo_str)
                self._calcular_cambio()
            except ValueError:
                pass

    def _calcular_cambio(self, event=None):
        try:
            total_str = self.total_label.cget("text").replace("$", "").replace("MXN", "").replace(",", "").strip()
            total = float(total_str) if total_str else 0
            recibido = float(self.monto_entry.get()) if self.monto_entry.get() else 0
            cambio = recibido - total
            if cambio >= 0:
                self.cambio_label.config(text=f"Cambio: {formatear_moneda(cambio)}", fg="#2ecc71")
            else:
                self.cambio_label.config(text=f"Falta: {formatear_moneda(abs(cambio))}", fg="#e74c3c")
        except ValueError:
            self.cambio_label.config(text="Cambio: $0.00", fg="#e74c3c")

    def _obtener_datos_cobro(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("Aviso", "Seleccione una orden para cobrar")
            return None

        valores = self.tree.item(sel[0])["values"]
        folio = valores[0]

        costo_str = valores[4].replace("$", "").replace("MXN", "").replace(",", "").strip()
        total = float(costo_str)

        try:
            recibido = float(self.monto_entry.get()) if self.monto_entry.get() else total
        except ValueError:
            recibido = total

        if recibido < total:
            messagebox.showwarning("Aviso", "El monto recibido es menor al total")
            return None

        cambio = recibido - total
        metodo = self.metodo_var.get()

        return {
            "folio": folio,
            "total": total,
            "recibido": recibido,
            "cambio": cambio,
            "metodo": metodo
        }

    def _cobrar(self):
        datos = self._obtener_datos_cobro()
        if not datos:
            return

        ordenes = Orden()
        orden = ordenes.obtener_por_folio(datos["folio"])
        if not orden:
            messagebox.showerror("Error", "Orden no encontrada")
            return

        pagos = Pago()
        pago_id, folio_venta = pagos.crear(
            orden_id=orden["id"],
            monto=datos["total"],
            metodo_pago=datos["metodo"],
            cambio=datos["cambio"]
        )

        ordenes.cambiar_estado(orden["id"], "entregado")

        sesion = CajaSesion().sesion_abierta()
        if sesion:
            CajaSesion().agregar_movimiento(
                sesion["id"], "ingreso",
                f"Pago orden #{datos['folio']} ({datos['metodo']})",
                datos["total"], f"Venta #{folio_venta}"
            )

        self._mostrar_ticket(orden, datos, folio_venta)

        messagebox.showinfo("Éxito",
                            f"Cobro registrado\n"
                            f"Orden: #{datos['folio']}\n"
                            f"Total: {formatear_moneda(datos['total'])}\n"
                            f"Cambio: {formatear_moneda(datos['cambio'])}")

        self._cargar_ordenes_pendientes()
        self.total_label.config(text="$0.00 MXN")
        self.monto_entry.delete(0, tk.END)
        self.cambio_label.config(text="Cambio: $0.00")

    def _cobrar_sin_imprimir(self):
        datos = self._obtener_datos_cobro()
        if not datos:
            return

        ordenes = Orden()
        orden = ordenes.obtener_por_folio(datos["folio"])
        if not orden:
            messagebox.showerror("Error", "Orden no encontrada")
            return

        pagos = Pago()
        pago_id, folio_venta = pagos.crear(
            orden_id=orden["id"],
            monto=datos["total"],
            metodo_pago=datos["metodo"],
            cambio=datos["cambio"]
        )

        ordenes.cambiar_estado(orden["id"], "entregado")

        sesion = CajaSesion().sesion_abierta()
        if sesion:
            CajaSesion().agregar_movimiento(
                sesion["id"], "ingreso",
                f"Pago orden #{datos['folio']} ({datos['metodo']})",
                datos["total"], f"Venta #{folio_venta}"
            )

        messagebox.showinfo("Éxito",
                            f"Cobro registrado\n"
                            f"Orden: #{datos['folio']}\n"
                            f"Total: {formatear_moneda(datos['total'])}")

        self._cargar_ordenes_pendientes()
        self.total_label.config(text="$0.00 MXN")
        self.monto_entry.delete(0, tk.END)
        self.cambio_label.config(text="Cambio: $0.00")

    def _mostrar_ticket(self, orden, datos, folio_venta):
        from reportes.ticket import generar_html_ticket
        from database.modelos import TicketConfig

        config = TicketConfig().obtener_todas()
        html = generar_html_ticket(orden, datos, folio_venta, config)

        ticket_win = tk.Toplevel(self.root)
        ticket_win.title("Ticket de Venta")
        ticket_win.geometry("350x550")
        ticket_win.configure(bg="white")
        ticket_win.transient(self.root)

        from tkinterweb import HtmlFrame
        try:
            frame = HtmlFrame(ticket_win, messages_enabled=False)
            frame.load_html(html)
            frame.pack(expand=True, fill="both")
        except ImportError:
            text = tk.Text(ticket_win, font=("Courier New", 9), wrap="word")
            text.pack(expand=True, fill="both", padx=5, pady=5)
            import re
            clean = re.sub('<[^<]+?>', '', html)
            text.insert("1.0", clean)
            text.config(state="disabled")

        btn_frame = tk.Frame(ticket_win, bg="white")
        btn_frame.pack(fill="x", padx=10, pady=10)

        tk.Button(btn_frame, text="🖨️ Imprimir",
                  font=("Segoe UI", 10, "bold"), bg="#3498db", fg="white",
                  relief="flat",
                  command=lambda: self._imprimir(html, ticket_win)).pack(side="left", expand=True, fill="x", padx=2)

        tk.Button(btn_frame, text="Cerrar",
                  font=("Segoe UI", 10), bg="#95a5a6", fg="white",
                  relief="flat",
                  command=ticket_win.destroy).pack(side="left", expand=True, fill="x", padx=2)

    def _imprimir(self, html, ticket_win):
        from reportes.impresor import imprimir_ticket
        config = TicketConfig().obtener_todas()
        nombre_impresora = config.get("impresora_nombre", "")
        doble_corte = config.get("doble_corte", "0") == "1"
        copias = 2 if doble_corte else 1

        try:
            imprimir_ticket(html, nombre_impresora, copias)
            messagebox.showinfo("Impresión", "Ticket enviado a la impresora")
        except Exception as e:
            messagebox.showerror("Error de impresión", str(e))
