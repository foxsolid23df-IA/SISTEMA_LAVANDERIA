import tkinter as tk
from tkinter import messagebox
from database.modelos import Servicio, Usuario
from config import APP_NAME, APP_VERSION


class ConfiguracionWindow:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Configuración")
        self.root.geometry("700x550")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 700, 550
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="⚙️ Configuración del Sistema",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        main_frame = tk.Frame(self.root, bg="#f0f2f5", padx=20, pady=20)
        main_frame.pack(expand=True, fill="both")

        tk.Label(main_frame, text=f"{APP_NAME} v{APP_VERSION}",
                 font=("Segoe UI", 16, "bold"), bg="#f0f2f5").pack(pady=(0, 20))

        sections = [
            ("Servicios de Lavandería", self._gestionar_servicios),
            ("Usuarios del Sistema", self._gestionar_usuarios),
        ]

        for titulo, cmd in sections:
            btn = tk.Button(main_frame, text=titulo, font=("Segoe UI", 12),
                            bg="white", fg="#333", relief="flat", anchor="w",
                            padx=20, pady=15, command=cmd)
            btn.pack(fill="x", pady=3)

        info_frame = tk.Frame(main_frame, bg="#f0f2f5")
        info_frame.pack(fill="x", pady=(30, 0))

        tk.Label(info_frame, text="Información del Sistema",
                 font=("Segoe UI", 11, "bold"), bg="#f0f2f5").pack(anchor="w")

        info = [
            ("Versión:", APP_VERSION),
            ("Base de datos:", "SQLite (local)"),
            ("Usuario actual:", self.usuario["nombre"]),
            ("Rol:", self.usuario["rol"].upper()),
        ]

        for label, val in info:
            f = tk.Frame(info_frame, bg="#f0f2f5")
            f.pack(fill="x", pady=1)
            tk.Label(f, text=label, font=("Segoe UI", 10), bg="#f0f2f5",
                     width=18, anchor="w").pack(side="left")
            tk.Label(f, text=val, font=("Segoe UI", 10, "bold"), bg="#f0f2f5").pack(side="left")

    def _gestionar_servicios(self):
        win = tk.Toplevel(self.root)
        win.title("Gestionar Servicios")
        win.geometry("600x400")
        win.configure(bg="white")
        win.transient(self.root)
        win.grab_set()

        frame = tk.Frame(win, bg="white", padx=10, pady=10)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Servicios de Lavandería",
                 font=("Segoe UI", 13, "bold"), bg="white").pack(anchor="w", pady=(0, 10))

        btn_frame = tk.Frame(frame, bg="white")
        btn_frame.pack(fill="x", pady=(0, 5))

        def agregar():
            _abrir_formulario_servicio()

        tk.Button(btn_frame, text="+ Nuevo Servicio", font=("Segoe UI", 10, "bold"),
                  bg="#2ecc71", fg="white", relief="flat",
                  command=agregar).pack(side="left")

        columnas = ("id", "nombre", "descripcion", "precio_kg")
        tree = ttk.Treeview(frame, columns=columnas, show="headings", height=12)
        tree.heading("id", text="ID")
        tree.heading("nombre", text="Nombre")
        tree.heading("descripcion", text="Descripción")
        tree.heading("precio_kg", text="Precio/kg")

        tree.column("id", width=40, anchor="center")
        tree.column("nombre", width=150)
        tree.column("descripcion", width=200)
        tree.column("precio_kg", width=100, anchor="e")

        scroll = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        tree.pack(expand=True, fill="both")

        def cargar_servicios():
            for item in tree.get_children():
                tree.delete(item)
            for s in Servicio().listar_todos():
                tree.insert("", "end", values=(
                    s["id"], s["nombre"], s["descripcion"] or "",
                    f"${s['precio_por_kg']:.2f}"
                ))

        def eliminar_servicio():
            sel = tree.selection()
            if not sel:
                messagebox.showwarning("Aviso", "Seleccione un servicio")
                return
            vals = tree.item(sel[0])["values"]
            if messagebox.askyesno("Confirmar", f"¿Eliminar servicio '{vals[1]}'?"):
                Servicio().eliminar(vals[0])
                cargar_servicios()

        def _abrir_formulario_servicio():
            form = tk.Toplevel(win)
            form.title("Nuevo Servicio")
            form.geometry("350x250")
            form.configure(bg="white")
            form.transient(win)
            form.grab_set()

            f = tk.Frame(form, bg="white", padx=20, pady=20)
            f.pack(expand=True, fill="both")

            tk.Label(f, text="Nombre:", font=("Segoe UI", 10), bg="white").pack(anchor="w")
            nombre_e = tk.Entry(f, font=("Segoe UI", 11), width=30)
            nombre_e.pack(fill="x", pady=(0, 8))

            tk.Label(f, text="Descripción:", font=("Segoe UI", 10), bg="white").pack(anchor="w")
            desc_e = tk.Entry(f, font=("Segoe UI", 11), width=30)
            desc_e.pack(fill="x", pady=(0, 8))

            tk.Label(f, text="Precio por kg ($):", font=("Segoe UI", 10), bg="white").pack(anchor="w")
            precio_e = tk.Entry(f, font=("Segoe UI", 11), width=15)
            precio_e.pack(fill="x", pady=(0, 12))

            def guardar():
                nombre = nombre_e.get().strip()
                desc = desc_e.get().strip()
                try:
                    precio = float(precio_e.get())
                except ValueError:
                    messagebox.showwarning("Aviso", "Precio inválido")
                    return
                if not nombre:
                    messagebox.showwarning("Aviso", "Nombre obligatorio")
                    return
                Servicio().crear(nombre, desc, precio)
                form.destroy()
                cargar_servicios()

            tk.Button(f, text="Guardar", font=("Segoe UI", 10, "bold"),
                      bg="#2ecc71", fg="white", relief="flat",
                      command=guardar).pack(fill="x")

        tk.Button(btn_frame, text="🗑️ Eliminar", font=("Segoe UI", 10),
                  bg="#e74c3c", fg="white", relief="flat",
                  command=eliminar_servicio).pack(side="left", padx=5)

        cargar_servicios()

    def _gestionar_usuarios(self):
        win = tk.Toplevel(self.root)
        win.title("Gestionar Usuarios")
        win.geometry("500x400")
        win.configure(bg="white")
        win.transient(self.root)
        win.grab_set()

        frame = tk.Frame(win, bg="white", padx=10, pady=10)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Usuarios del Sistema",
                 font=("Segoe UI", 13, "bold"), bg="white").pack(anchor="w", pady=(0, 10))

        btn_frame = tk.Frame(frame, bg="white")
        btn_frame.pack(fill="x", pady=(0, 5))

        def agregar():
            _abrir_formulario_usuario()

        tk.Button(btn_frame, text="+ Nuevo Usuario", font=("Segoe UI", 10, "bold"),
                  bg="#2ecc71", fg="white", relief="flat",
                  command=agregar).pack(side="left")

        columnas = ("id", "nombre", "rol", "activo")
        tree = ttk.Treeview(frame, columns=columnas, show="headings", height=12)
        tree.heading("id", text="ID")
        tree.heading("nombre", text="Nombre")
        tree.heading("rol", text="Rol")
        tree.heading("activo", text="Activo")

        tree.column("id", width=40, anchor="center")
        tree.column("nombre", width=180)
        tree.column("rol", width=100, anchor="center")
        tree.column("activo", width=70, anchor="center")

        scroll = ttk.Scrollbar(frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        tree.pack(expand=True, fill="both")

        def cargar_usuarios():
            for item in tree.get_children():
                tree.delete(item)
            for u in Usuario().listar_todos():
                tree.insert("", "end", values=(
                    u["id"], u["nombre"], u["rol"].upper(),
                    "Sí" if u["activo"] else "No"
                ))

        def eliminar_usuario():
            sel = tree.selection()
            if not sel:
                messagebox.showwarning("Aviso", "Seleccione un usuario")
                return
            vals = tree.item(sel[0])["values"]
            if vals[0] == self.usuario["id"]:
                messagebox.showwarning("Aviso", "No puede eliminarse a sí mismo")
                return
            if messagebox.askyesno("Confirmar", f"¿Eliminar usuario '{vals[1]}'?"):
                Usuario().eliminar(vals[0])
                cargar_usuarios()

        def _abrir_formulario_usuario():
            form = tk.Toplevel(win)
            form.title("Nuevo Usuario")
            form.geometry("350x250")
            form.configure(bg="white")
            form.transient(win)
            form.grab_set()

            f = tk.Frame(form, bg="white", padx=20, pady=20)
            f.pack(expand=True, fill="both")

            tk.Label(f, text="Nombre:", font=("Segoe UI", 10), bg="white").pack(anchor="w")
            nombre_e = tk.Entry(f, font=("Segoe UI", 11), width=30)
            nombre_e.pack(fill="x", pady=(0, 8))

            tk.Label(f, text="PIN (4-6 dígitos):", font=("Segoe UI", 10), bg="white").pack(anchor="w")
            pin_e = tk.Entry(f, font=("Segoe UI", 11), width=15, show="*")
            pin_e.pack(fill="x", pady=(0, 8))

            tk.Label(f, text="Rol:", font=("Segoe UI", 10), bg="white").pack(anchor="w")
            rol_var = tk.StringVar(value="operador")
            rol_frame = tk.Frame(f, bg="white")
            rol_frame.pack(fill="x", pady=(0, 12))
            tk.Radiobutton(rol_frame, text="Admin", variable=rol_var,
                           value="admin", font=("Segoe UI", 10), bg="white").pack(side="left")
            tk.Radiobutton(rol_frame, text="Operador", variable=rol_var,
                           value="operador", font=("Segoe UI", 10), bg="white").pack(side="left", padx=10)

            def guardar():
                nombre = nombre_e.get().strip()
                pin = pin_e.get().strip()
                if not nombre:
                    messagebox.showwarning("Aviso", "Nombre obligatorio")
                    return
                if len(pin) < 4 or len(pin) > 6 or not pin.isdigit():
                    messagebox.showwarning("Aviso", "PIN debe ser de 4 a 6 dígitos")
                    return
                Usuario().crear(nombre, pin, rol_var.get())
                form.destroy()
                cargar_usuarios()

            tk.Button(f, text="Guardar", font=("Segoe UI", 10, "bold"),
                      bg="#2ecc71", fg="white", relief="flat",
                      command=guardar).pack(fill="x")

        tk.Button(btn_frame, text="🗑️ Eliminar", font=("Segoe UI", 10),
                  bg="#e74c3c", fg="white", relief="flat",
                  command=eliminar_usuario).pack(side="left", padx=5)

        cargar_usuarios()
