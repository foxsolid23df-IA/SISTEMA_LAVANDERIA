import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime, timedelta
from database.modelos import Cliente, Servicio, Orden
from utils.fechas import formatear_fecha
from utils.moneda import formatear_moneda


class OrdenesLista:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Órdenes de Servicio")
        self.root.geometry("1000x600")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()
        self._cargar_ordenes()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 1000, 600
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="📋 Órdenes de Servicio",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        toolbar = tk.Frame(self.root, bg="#ecf0f1", height=50)
        toolbar.pack(fill="x")
        toolbar.pack_propagate(False)

        tk.Button(toolbar, text="+ Nueva Orden", font=("Segoe UI", 10, "bold"),
                  bg="#2ecc71", fg="white", relief="flat",
                  command=lambda: self.on_navegar("ordenes_nueva")).pack(side="left", padx=10, pady=8)

        tk.Label(toolbar, text="Filtrar estado:", font=("Segoe UI", 10),
                 bg="#ecf0f1").pack(side="left", padx=(20, 5))

        self.filtro_var = tk.StringVar(value="todos")
        filtro_cb = ttk.Combobox(toolbar, textvariable=self.filtro_var, width=15,
                                  values=["todos", "recibido", "proceso", "listo", "entregado"],
                                  state="readonly")
        filtro_cb.pack(side="left", padx=5)
        filtro_cb.bind("<<ComboboxSelected>>", lambda e: self._cargar_ordenes())

        tree_frame = tk.Frame(self.root, bg="white")
        tree_frame.pack(expand=True, fill="both", padx=10, pady=10)

        columnas = ("folio", "cliente", "servicio", "peso", "costo", "estado", "fecha")
        self.tree = ttk.Treeview(tree_frame, columns=columnas, show="headings", height=20)

        self.tree.heading("folio", text="Folio")
        self.tree.heading("cliente", text="Cliente")
        self.tree.heading("servicio", text="Servicio")
        self.tree.heading("peso", text="Peso (kg)")
        self.tree.heading("costo", text="Costo")
        self.tree.heading("estado", text="Estado")
        self.tree.heading("fecha", text="Fecha")

        self.tree.column("folio", width=60, anchor="center")
        self.tree.column("cliente", width=150)
        self.tree.column("servicio", width=150)
        self.tree.column("peso", width=80, anchor="center")
        self.tree.column("costo", width=100, anchor="e")
        self.tree.column("estado", width=100, anchor="center")
        self.tree.column("fecha", width=120, anchor="center")

        scroll = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.tree.pack(expand=True, fill="both")

        btn_frame = tk.Frame(self.root, bg="#f0f2f5")
        btn_frame.pack(fill="x", padx=10, pady=(0, 10))

        tk.Button(btn_frame, text="Cambiar Estado →", font=("Segoe UI", 10),
                  bg="#3498db", fg="white", relief="flat",
                  command=self._cambiar_estado).pack(side="left", padx=5)

        tk.Button(btn_frame, text="Ver Detalle", font=("Segoe UI", 10),
                  bg="#9b59b6", fg="white", relief="flat",
                  command=self._ver_detalle).pack(side="left", padx=5)

        self.tree.bind("<Double-1>", lambda e: self._ver_detalle())

    def _cargar_ordenes(self):
        for item in self.tree.get_children():
            self.tree.delete(item)

        filtro = self.filtro_var.get()
        ordenes = Orden()
        if filtro == "todos":
            datos = ordenes.listar_por_estado()
        else:
            datos = ordenes.listar_por_estado(filtro)

        for row in datos:
            estado_colors = {
                "recibido": "#3498db", "proceso": "#e67e22",
                "listo": "#2ecc71", "entregado": "#95a5a6"
            }
            self.tree.insert("", "end", values=(
                row["folio"],
                row["cliente_nombre"] or "Sin cliente",
                row["servicio_nombre"] or "N/A",
                f"{row['peso_kg']:.1f}",
                formatear_moneda(row["costo_total"]),
                row["estado"].upper(),
                formatear_fecha(row["created_at"])
            ))

    def _obtener_orden_seleccionada(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("Aviso", "Seleccione una orden")
            return None
        return self.tree.item(sel[0])["values"]

    def _cambiar_estado(self):
        valores = self._obtener_orden_seleccionada()
        if not valores:
            return

        folio = valores[0]
        estado_actual = valores[5].lower()

        siguientes = {
            "recibido": "proceso", "proceso": "listo",
            "listo": "entregado", "entregado": None
        }
        siguiente = siguientes.get(estado_actual)

        if not siguiente:
            messagebox.showinfo("Info", "La orden ya está entregada")
            return

        if messagebox.askyesno("Confirmar",
                               f"¿Cambiar orden #{folio} de '{estado_actual}' a '{siguiente}'?"):
            ordenes = Orden()
            orden = ordenes.obtener_por_folio(folio)
            if orden:
                ordenes.cambiar_estado(orden["id"], siguiente)
                self._cargar_ordenes()
                messagebox.showinfo("Éxito", f"Orden #{folio} actualizada a '{siguiente}'")

    def _ver_detalle(self):
        valores = self._obtener_orden_seleccionada()
        if not valores:
            return

        folio = valores[0]
        ordenes = Orden()
        orden = ordenes.obtener_por_folio(folio)
        if not orden:
            return

        det = tk.Toplevel(self.root)
        det.title(f"Orden #{folio}")
        det.geometry("400x500")
        det.configure(bg="white")
        det.transient(self.root)
        det.grab_set()

        frame = tk.Frame(det, bg="white", padx=20, pady=20)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text=f"ORDEN #{orden['folio']}",
                 font=("Segoe UI", 16, "bold"), bg="white").pack(pady=(0, 10))

        info = [
            ("Cliente:", orden["cliente_nombre"] or "Sin cliente"),
            ("Teléfono:", orden["cliente_telefono"] or "N/A"),
            ("Servicio:", orden["servicio_nombre"] or "N/A"),
            ("Peso:", f"{orden['peso_kg']:.1f} kg"),
            ("Costo Total:", formatear_moneda(orden["costo_total"])),
            ("Estado:", orden["estado"].upper()),
            ("Descripción Ropa:", orden["descripcion_ropa"] or "N/A"),
            ("Observaciones:", orden["observaciones"] or "N/A"),
            ("Fecha Recepción:", formatear_fecha(orden["fecha_recepcion"])),
        ]
        if orden["fecha_entrega_estimada"]:
            info.append(("Entrega Estimada:", orden["fecha_entrega_estimada"]))
        if orden["fecha_entrega_real"]:
            info.append(("Entrega Real:", formatear_fecha(orden["fecha_entrega_real"])))

        for etiqueta, valor in info:
            f = tk.Frame(frame, bg="white")
            f.pack(fill="x", pady=2)
            tk.Label(f, text=etiqueta, font=("Segoe UI", 10, "bold"),
                     bg="white", fg="#333", width=18, anchor="w").pack(side="left")
            tk.Label(f, text=valor, font=("Segoe UI", 10),
                     bg="white", fg="#666").pack(side="left")

        tk.Button(frame, text="Cerrar", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=det.destroy).pack(pady=(20, 0))


class OrdenNueva:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Nueva Orden")
        self.root.geometry("600x650")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 600, 650
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="📋 Nueva Orden de Servicio",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        form = tk.Frame(self.root, bg="#f0f2f5", padx=30, pady=20)
        form.pack(expand=True, fill="both")

        tk.Label(form, text="Datos del Cliente", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5", fg="#333").pack(anchor="w", pady=(0, 10))

        tk.Label(form, text="Nombre del Cliente:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.cliente_entry = tk.Entry(form, font=("Segoe UI", 11), width=40)
        self.cliente_entry.pack(fill="x", pady=(0, 5))

        tk.Label(form, text="Teléfono:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.telefono_entry = tk.Entry(form, font=("Segoe UI", 11), width=40)
        self.telefono_entry.pack(fill="x", pady=(0, 10))

        tk.Label(form, text="Datos del Servicio", font=("Segoe UI", 12, "bold"),
                 bg="#f0f2f5", fg="#333").pack(anchor="w", pady=(10, 10))

        tk.Label(form, text="Servicio:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        servicios = Servicio().listar_todos()
        self.servicios_list = [dict(s) for s in servicios]
        nombres = [s["nombre"] for s in self.servicios_list]

        self.servicio_var = tk.StringVar()
        servicio_cb = ttk.Combobox(form, textvariable=self.servicio_var,
                                    values=nombres, state="readonly", width=37)
        servicio_cb.pack(fill="x", pady=(0, 5))
        if nombres:
            servicio_cb.current(0)

        tk.Label(form, text="Peso (kg):", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.peso_var = tk.StringVar()
        peso_frame = tk.Frame(form, bg="#f0f2f5")
        peso_frame.pack(fill="x", pady=(0, 5))

        self.peso_entry = tk.Entry(peso_frame, font=("Segoe UI", 11), width=15,
                                    textvariable=self.peso_var)
        self.peso_entry.pack(side="left")

        tk.Label(peso_frame, text="kg", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(side="left", padx=5)

        self.peso_var.trace_add("write", lambda *a: self._actualizar_costo())

        self.costo_label = tk.Label(form, text="Costo: $0.00 MXN",
                                     font=("Segoe UI", 14, "bold"),
                                     bg="#f0f2f5", fg="#2ecc71")
        self.costo_label.pack(pady=(10, 5))

        tk.Label(form, text="Descripción de la ropa:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.desc_entry = tk.Entry(form, font=("Segoe UI", 11), width=40)
        self.desc_entry.pack(fill="x", pady=(0, 5))

        tk.Label(form, text="Observaciones:", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.obs_text = tk.Text(form, font=("Segoe UI", 10), height=3, width=40)
        self.obs_text.pack(fill="x", pady=(0, 5))

        tk.Label(form, text="Fecha entrega estimada (dd/mm/aaaa):", font=("Segoe UI", 10),
                 bg="#f0f2f5").pack(anchor="w")
        self.fecha_entry = tk.Entry(form, font=("Segoe UI", 11), width=20)
        self.fecha_entry.pack(fill="x", pady=(0, 10))

        tk.Button(form, text="💾 GUARDAR ORDEN", font=("Segoe UI", 12, "bold"),
                  bg="#2ecc71", fg="white", relief="flat", height=2,
                  command=self._guardar).pack(fill="x", pady=(10, 0))

    def _actualizar_costo(self):
        try:
            peso = float(self.peso_var.get())
            servicio_idx = 0
            cb = self.root.focus_get()
            if hasattr(self, 'servicios_list') and self.servicios_list:
                servicio_idx = next(
                    (i for i, s in enumerate(self.servicios_list)
                     if s["nombre"] == self.servicio_var.get()), 0
                )
                precio_kg = self.servicios_list[servicio_idx]["precio_por_kg"]
                total = peso * precio_kg
                self.costo_label.config(text=f"Costo: {formatear_moneda(total)}")
        except (ValueError, IndexError):
            self.costo_label.config(text="Costo: $0.00 MXN")

    def _guardar(self):
        nombre_cliente = self.cliente_entry.get().strip()
        telefono = self.telefono_entry.get().strip()
        servicio_nombre = self.servicio_var.get()
        peso_str = self.peso_entry.get().strip()
        descripcion = self.desc_entry.get().strip()
        observaciones = self.obs_text.get("1.0", tk.END).strip()
        fecha_est = self.fecha_entry.get().strip()

        if not nombre_cliente:
            messagebox.showwarning("Aviso", "Ingrese el nombre del cliente")
            return
        if not servicio_nombre:
            messagebox.showwarning("Aviso", "Seleccione un servicio")
            return
        try:
            peso = float(peso_str)
            if peso <= 0:
                raise ValueError
        except ValueError:
            messagebox.showwarning("Aviso", "Ingrese un peso válido mayor a 0")
            return

        servicio = next((s for s in self.servicios_list if s["nombre"] == servicio_nombre), None)
        if not servicio:
            messagebox.showerror("Error", "Servicio no encontrado")
            return

        costo_total = peso * servicio["precio_por_kg"]

        clientes = Cliente()
        cliente_id = clientes.obtener_o_crear(nombre_cliente, telefono)

        fecha_entrega = None
        if fecha_est:
            from utils.fechas import parsear_fecha
            fecha_entrega = parsear_fecha(fecha_est)
            if fecha_entrega:
                fecha_entrega = fecha_entrega.strftime("%Y-%m-%d")

        ordenes = Orden()
        orden_id, folio = ordenes.crear(
            cliente_id=cliente_id,
            servicio_id=servicio["id"],
            peso_kg=peso,
            costo_total=costo_total,
            descripcion_ropa=descripcion,
            observaciones=observaciones,
            fecha_entrega_estimada=fecha_entrega
        )

        messagebox.showinfo("Éxito", f"Orden #{folio} creada\nCosto: {formatear_moneda(costo_total)}")
        self.on_volver()
