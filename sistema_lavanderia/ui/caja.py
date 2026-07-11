import tkinter as tk
from tkinter import ttk, messagebox
from database.modelos import CajaSesion, Pago
from utils.fechas import formatear_fecha
from utils.moneda import formatear_moneda


class CajaWindow:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Control de Caja")
        self.root.geometry("800x600")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()
        self._verificar_sesion()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 800, 600
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="🗄️ Control de Caja",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        self.main_frame = tk.Frame(self.root, bg="#f0f2f5")
        self.main_frame.pack(expand=True, fill="both", padx=20, pady=20)

        self.status_frame = tk.Frame(self.main_frame, bg="#f0f2f5")
        self.status_frame.pack(fill="x", pady=(0, 20))

        btn_frame = tk.Frame(self.main_frame, bg="#f0f2f5")
        btn_frame.pack(fill="x", pady=(0, 10))

        self.btn_abrir = tk.Button(btn_frame, text="🔓 Abrir Caja",
                                    font=("Segoe UI", 11, "bold"), bg="#2ecc71", fg="white",
                                    relief="flat", command=self._abrir_caja)
        self.btn_abrir.pack(side="left", padx=5)

        self.btn_cerrar = tk.Button(btn_frame, text="🔒 Cerrar Caja",
                                     font=("Segoe UI", 11, "bold"), bg="#e74c3c", fg="white",
                                     relief="flat", command=self._cerrar_caja, state="disabled")
        self.btn_cerrar.pack(side="left", padx=5)

        self.btn_egreso = tk.Button(btn_frame, text="➖ Egreso",
                                     font=("Segoe UI", 11), bg="#e67e22", fg="white",
                                     relief="flat", command=self._registrar_egreso, state="disabled")
        self.btn_egreso.pack(side="left", padx=5)

        self.btn_historial = tk.Button(btn_frame, text="📜 Historial",
                                        font=("Segoe UI", 11), bg="#9b59b6", fg="white",
                                        relief="flat", command=self._ver_historial)
        self.btn_historial.pack(side="left", padx=5)

        mov_frame = tk.Frame(self.main_frame, bg="white")
        mov_frame.pack(expand=True, fill="both", pady=(10, 0))

        tk.Label(mov_frame, text="Movimientos de la sesión actual:",
                 font=("Segoe UI", 11, "bold"), bg="white").pack(anchor="w", padx=10, pady=(10, 5))

        columnas = ("hora", "tipo", "concepto", "monto")
        self.tree = ttk.Treeview(mov_frame, columns=columnas, show="headings", height=15)

        self.tree.heading("hora", text="Hora")
        self.tree.heading("tipo", text="Tipo")
        self.tree.heading("concepto", text="Concepto")
        self.tree.heading("monto", text="Monto")

        self.tree.column("hora", width=80, anchor="center")
        self.tree.column("tipo", width=80, anchor="center")
        self.tree.column("concepto", width=300)
        self.tree.column("monto", width=120, anchor="e")

        scroll = ttk.Scrollbar(mov_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y", padx=(0, 5), pady=5)
        self.tree.pack(expand=True, fill="both", padx=5, pady=5)

        resumen_frame = tk.Frame(self.main_frame, bg="#f0f2f5")
        resumen_frame.pack(fill="x", pady=(10, 0))

        self.fondo_label = tk.Label(resumen_frame, text="Fondo: $0.00",
                                     font=("Segoe UI", 11), bg="#f0f2f5")
        self.fondo_label.pack(side="left", padx=10)

        self.ingresos_label = tk.Label(resumen_frame, text="Ingresos: $0.00",
                                        font=("Segoe UI", 11, "bold"), bg="#f0f2f5", fg="#2ecc71")
        self.ingresos_label.pack(side="left", padx=10)

        self.egresos_label = tk.Label(resumen_frame, text="Egresos: $0.00",
                                       font=("Segoe UI", 11, "bold"), bg="#f0f2f5", fg="#e74c3c")
        self.egresos_label.pack(side="left", padx=10)

        self.saldo_label = tk.Label(resumen_frame, text="Saldo: $0.00",
                                     font=("Segoe UI", 12, "bold"), bg="#f0f2f5")
        self.saldo_label.pack(side="right", padx=10)

    def _verificar_sesion(self):
        caja = CajaSesion()
        sesion = caja.sesion_abierta()
        if sesion:
            self._mostrar_sesion_abierta(sesion)
        else:
            self._mostrar_sin_sesion()

    def _mostrar_sin_sesion(self):
        for w in self.status_frame.winfo_children():
            w.destroy()

        tk.Label(self.status_frame, text="⚠️ No hay sesión de caja abierta",
                 font=("Segoe UI", 14, "bold"), bg="#f0f2f5", fg="#e67e22").pack(pady=20)

        self.btn_abrir.config(state="normal")
        self.btn_cerrar.config(state="disabled")
        self.btn_egreso.config(state="disabled")

    def _mostrar_sesion_abierta(self, sesion):
        for w in self.status_frame.winfo_children():
            w.destroy()

        tk.Label(self.status_frame,
                 text=f"✅ Sesión abierta | Fondo inicial: {formatear_moneda(sesion['fondo_inicial'])} | "
                      f"Abierta: {formatear_fecha(sesion['fecha_apertura'])}",
                 font=("Segoe UI", 11), bg="#f0f2f5", fg="#27ae60").pack(pady=10)

        self.btn_abrir.config(state="disabled")
        self.btn_cerrar.config(state="normal")
        self.btn_egreso.config(state="normal")

        self._cargar_movimientos(sesion["id"])

    def _cargar_movimientos(self, sesion_id):
        for item in self.tree.get_children():
            self.tree.delete(item)

        caja = CajaSesion()
        movimientos = caja.obtener_movimientos(sesion_id)

        for mov in movimientos:
            self.tree.insert("", "end", values=(
                formatear_fecha(mov["created_at"]),
                mov["tipo"].upper(),
                mov["concepto"],
                formatear_moneda(mov["monto"])
            ))

        fondo = caja.db.fetch_one(
            "SELECT fondo_inicial FROM caja_sesiones WHERE id = ?", (sesion_id,)
        )
        ingresos = caja.total_ingresos(sesion_id)
        egresos = caja.total_egresos(sesion_id)
        saldo = (fondo["fondo_inicial"] if fondo else 0) + ingresos - egresos

        self.fondo_label.config(text=f"Fondo: {formatear_moneda(fondo['fondo_inicial'] if fondo else 0)}")
        self.ingresos_label.config(text=f"Ingresos: {formatear_moneda(ingresos)}")
        self.egresos_label.config(text=f"Egresos: {formatear_moneda(egresos)}")
        self.saldo_label.config(text=f"Saldo: {formatear_moneda(saldo)}")

    def _abrir_caja(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("Abrir Caja")
        dialog.geometry("350x200")
        dialog.configure(bg="white")
        dialog.transient(self.root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg="white", padx=30, pady=30)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Fondo Inicial:", font=("Segoe UI", 12),
                 bg="white").pack(anchor="w")
        fondo_entry = tk.Entry(frame, font=("Segoe UI", 14), width=20)
        fondo_entry.pack(fill="x", pady=(5, 15))
        fondo_entry.insert(0, "1000")
        fondo_entry.focus_set()

        def confirmar():
            try:
                fondo = float(fondo_entry.get())
                if fondo < 0:
                    raise ValueError
            except ValueError:
                messagebox.showwarning("Aviso", "Ingrese un monto válido")
                return

            caja = CajaSesion()
            sesion_id = caja.abrir(fondo)
            dialog.destroy()
            messagebox.showinfo("Éxito", f"Caja abierta con fondo de {formatear_moneda(fondo)}")
            self._verificar_sesion()

        tk.Button(frame, text="Abrir Caja", font=("Segoe UI", 11, "bold"),
                  bg="#2ecc71", fg="white", relief="flat",
                  command=confirmar).pack(fill="x")

    def _cerrar_caja(self):
        caja = CajaSesion()
        sesion = caja.sesion_abierta()
        if not sesion:
            return

        dialog = tk.Toplevel(self.root)
        dialog.title("Cerrar Caja")
        dialog.geometry("400x350")
        dialog.configure(bg="white")
        dialog.transient(self.root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg="white", padx=30, pady=20)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Cierre de Caja", font=("Segoe UI", 14, "bold"),
                 bg="white").pack(pady=(0, 15))

        ingresos = caja.total_ingresos(sesion["id"])
        egresos = caja.total_egresos(sesion["id"])
        saldo_esperado = sesion["fondo_inicial"] + ingresos - egresos

        info_frame = tk.Frame(frame, bg="white")
        info_frame.pack(fill="x", pady=(0, 10))

        for label, val in [("Fondo inicial:", formatear_moneda(sesion["fondo_inicial"])),
                           ("Total ingresos:", formatear_moneda(ingresos)),
                           ("Total egresos:", formatear_moneda(egresos)),
                           ("Saldo esperado:", formatear_moneda(saldo_esperado))]:
            f = tk.Frame(info_frame, bg="white")
            f.pack(fill="x", pady=2)
            tk.Label(f, text=label, font=("Segoe UI", 10), bg="white",
                     width=18, anchor="w").pack(side="left")
            tk.Label(f, text=val, font=("Segoe UI", 10, "bold"), bg="white").pack(side="left")

        tk.Label(frame, text="Monto contado en caja:", font=("Segoe UI", 11),
                 bg="white").pack(anchor="w", pady=(10, 5))
        monto_entry = tk.Entry(frame, font=("Segoe UI", 14), width=20)
        monto_entry.pack(fill="x", pady=(0, 10))

        diferencia_label = tk.Label(frame, text="", font=("Segoe UI", 11, "bold"), bg="white")
        diferencia_label.pack()

        def calcular_diferencia(event=None):
            try:
                contado = float(monto_entry.get())
                diff = contado - saldo_esperado
                if diff >= 0:
                    diferencia_label.config(text=f"Sobrante: {formatear_moneda(diff)}", fg="#2ecc71")
                else:
                    diferencia_label.config(text=f"Faltante: {formatear_moneda(abs(diff))}", fg="#e74c3c")
            except ValueError:
                diferencia_label.config(text="")

        monto_entry.bind("<KeyRelease>", calcular_diferencia)
        monto_entry.insert(0, str(round(saldo_esperado, 2)))
        calcular_diferencia()

        def confirmar():
            try:
                contado = float(monto_entry.get())
            except ValueError:
                messagebox.showwarning("Aviso", "Ingrese un monto válido")
                return

            if messagebox.askyesno("Confirmar", "¿Cerrar la sesión de caja?"):
                caja.cerrar(sesion["id"], contado)
                dialog.destroy()
                messagebox.showinfo("Éxito", "Caja cerrada correctamente")
                self._verificar_sesion()

        tk.Button(frame, text="Cerrar Caja", font=("Segoe UI", 11, "bold"),
                  bg="#e74c3c", fg="white", relief="flat",
                  command=confirmar).pack(fill="x", pady=(10, 0))

    def _registrar_egreso(self):
        caja = CajaSesion()
        sesion = caja.sesion_abierta()
        if not sesion:
            return

        dialog = tk.Toplevel(self.root)
        dialog.title("Registrar Egreso")
        dialog.geometry("350x250")
        dialog.configure(bg="white")
        dialog.transient(self.root)
        dialog.grab_set()

        frame = tk.Frame(dialog, bg="white", padx=30, pady=30)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Concepto:", font=("Segoe UI", 11),
                 bg="white").pack(anchor="w")
        concepto_entry = tk.Entry(frame, font=("Segoe UI", 11), width=30)
        concepto_entry.pack(fill="x", pady=(5, 10))

        tk.Label(frame, text="Monto:", font=("Segoe UI", 11),
                 bg="white").pack(anchor="w")
        monto_entry = tk.Entry(frame, font=("Segoe UI", 11), width=20)
        monto_entry.pack(fill="x", pady=(5, 15))

        def confirmar():
            concepto = concepto_entry.get().strip()
            if not concepto:
                messagebox.showwarning("Aviso", "Ingrese el concepto")
                return
            try:
                monto = float(monto_entry.get())
                if monto <= 0:
                    raise ValueError
            except ValueError:
                messagebox.showwarning("Aviso", "Ingrese un monto válido mayor a 0")
                return

            caja.agregar_movimiento(sesion["id"], "egreso", concepto, monto)
            dialog.destroy()
            messagebox.showinfo("Éxito", f"Egreso de {formatear_moneda(monto)} registrado")
            self._verificar_sesion()

        tk.Button(frame, text="Registrar Egreso", font=("Segoe UI", 11, "bold"),
                  bg="#e67e22", fg="white", relief="flat",
                  command=confirmar).pack(fill="x")

    def _ver_historial(self):
        hist = tk.Toplevel(self.root)
        hist.title("Historial de Cortes de Caja")
        hist.geometry("700x400")
        hist.configure(bg="white")
        hist.transient(self.root)

        frame = tk.Frame(hist, bg="white", padx=10, pady=10)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Historial de Sesiones de Caja",
                 font=("Segoe UI", 13, "bold"), bg="white").pack(anchor="w", pady=(0, 10))

        columnas = ("id", "fondo", "ingresos", "egresos", "cierre", "estado", "fecha")
        tree = ttk.Treeview(frame, columns=columnas, show="headings", height=15)

        tree.heading("id", text="#")
        tree.heading("fondo", text="Fondo")
        tree.heading("ingresos", text="Ingresos")
        tree.heading("egresos", text="Egresos")
        tree.heading("cierre", text="Monto Cierre")
        tree.heading("estado", text="Estado")
        tree.heading("fecha", text="Fecha Apertura")

        tree.column("id", width=40, anchor="center")
        tree.column("fondo", width=90, anchor="e")
        tree.column("ingresos", width=90, anchor="e")
        tree.column("egresos", width=90, anchor="e")
        tree.column("cierre", width=90, anchor="e")
        tree.column("estado", width=70, anchor="center")
        tree.column("fecha", width=120, anchor="center")

        scroll = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        tree.pack(expand=True, fill="both")

        caja = CajaSesion()
        historial = caja.obtener_historial()

        for s in historial:
            ing = caja.total_ingresos(s["id"])
            egr = caja.total_egresos(s["id"])
            tree.insert("", "end", values=(
                s["id"],
                formatear_moneda(s["fondo_inicial"]),
                formatear_moneda(ing),
                formatear_moneda(egr),
                formatear_moneda(s["monto_cierre"]) if s["monto_cierre"] is not None else "N/A",
                s["estado"].upper(),
                formatear_fecha(s["fecha_apertura"])
            ))
