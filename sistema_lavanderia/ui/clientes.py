import tkinter as tk
from tkinter import ttk, messagebox
from database.modelos import Cliente


class ClientesWindow:
    def __init__(self, root, usuario, on_navegar, on_volver):
        self.root = root
        self.usuario = usuario
        self.on_navegar = on_navegar
        self.on_volver = on_volver

        self.root.title("Sistema Lavandería - Clientes")
        self.root.geometry("800x500")
        self.root.configure(bg="#f0f2f5")

        self._centrar_ventana()
        self._crear_widgets()
        self._cargar_clientes()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w, h = 800, 500
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        header = tk.Frame(self.root, bg="#1a1a2e", height=50)
        header.pack(fill="x")
        header.pack_propagate(False)

        tk.Label(header, text="👥 Gestión de Clientes",
                 font=("Segoe UI", 14, "bold"), bg="#1a1a2e", fg="white").pack(side="left", padx=20)

        tk.Button(header, text="← Volver", font=("Segoe UI", 10),
                  bg="#34495e", fg="white", relief="flat",
                  command=self.on_volver).pack(side="right", padx=20)

        toolbar = tk.Frame(self.root, bg="#ecf0f1", height=50)
        toolbar.pack(fill="x")
        toolbar.pack_propagate(False)

        tk.Button(toolbar, text="+ Nuevo Cliente", font=("Segoe UI", 10, "bold"),
                  bg="#2ecc71", fg="white", relief="flat",
                  command=self._nuevo_cliente).pack(side="left", padx=10, pady=8)

        tk.Label(toolbar, text="Buscar:", font=("Segoe UI", 10),
                 bg="#ecf0f1").pack(side="left", padx=(20, 5))

        self.buscar_entry = tk.Entry(toolbar, font=("Segoe UI", 10), width=25)
        self.buscar_entry.pack(side="left", padx=5)
        self.buscar_entry.bind("<KeyRelease>", lambda e: self._buscar_clientes())

        tree_frame = tk.Frame(self.root, bg="white")
        tree_frame.pack(expand=True, fill="both", padx=10, pady=10)

        columnas = ("id", "nombre", "telefono", "email", "direccion")
        self.tree = ttk.Treeview(tree_frame, columns=columnas, show="headings", height=18)

        self.tree.heading("id", text="ID")
        self.tree.heading("nombre", text="Nombre")
        self.tree.heading("telefono", text="Teléfono")
        self.tree.heading("email", text="Email")
        self.tree.heading("direccion", text="Dirección")

        self.tree.column("id", width=50, anchor="center")
        self.tree.column("nombre", width=200)
        self.tree.column("telefono", width=120)
        self.tree.column("email", width=180)
        self.tree.column("direccion", width=200)

        scroll = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.tree.pack(expand=True, fill="both")

        btn_frame = tk.Frame(self.root, bg="#f0f2f5")
        btn_frame.pack(fill="x", padx=10, pady=(0, 10))

        tk.Button(btn_frame, text="✏️ Editar", font=("Segoe UI", 10),
                  bg="#3498db", fg="white", relief="flat",
                  command=self._editar_cliente).pack(side="left", padx=5)

        tk.Button(btn_frame, text="🗑️ Eliminar", font=("Segoe UI", 10),
                  bg="#e74c3c", fg="white", relief="flat",
                  command=self._eliminar_cliente).pack(side="left", padx=5)

    def _cargar_clientes(self, termino=None):
        for item in self.tree.get_children():
            self.tree.delete(item)

        clientes = Cliente()
        if termino:
            datos = clientes.buscar(termino)
        else:
            datos = clientes.listar_todos()

        for row in datos:
            self.tree.insert("", "end", values=(
                row["id"], row["nombre"], row["telefono"] or "",
                row["email"] or "", row["direccion"] or ""
            ))

    def _buscar_clientes(self):
        termino = self.buscar_entry.get().strip()
        if termino:
            self._cargar_clientes(termino)
        else:
            self._cargar_clientes()

    def _nuevo_cliente(self):
        self._abrir_formulario()

    def _editar_cliente(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("Aviso", "Seleccione un cliente")
            return
        valores = self.tree.item(sel[0])["values"]
        cliente = Cliente().obtener_por_id(valores[0])
        if cliente:
            self._abrir_formulario(dict(cliente))

    def _eliminar_cliente(self):
        sel = self.tree.selection()
        if not sel:
            messagebox.showwarning("Aviso", "Seleccione un cliente")
            return
        valores = self.tree.item(sel[0])["values"]
        if messagebox.askyesno("Confirmar", f"¿Eliminar cliente '{valores[1]}'?"):
            Cliente().eliminar(valores[0])
            self._cargar_clientes()
            messagebox.showinfo("Éxito", "Cliente eliminado")

    def _abrir_formulario(self, cliente=None):
        form = tk.Toplevel(self.root)
        editar = cliente is not None
        form.title("Editar Cliente" if editar else "Nuevo Cliente")
        form.geometry("400x350")
        form.configure(bg="white")
        form.transient(self.root)
        form.grab_set()

        frame = tk.Frame(form, bg="white", padx=30, pady=20)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="Editar Cliente" if editar else "Nuevo Cliente",
                 font=("Segoe UI", 14, "bold"), bg="white").pack(anchor="w", pady=(0, 15))

        campos = [
            ("Nombre:", "nombre", cliente["nombre"] if cliente else ""),
            ("Teléfono:", "telefono", cliente["telefono"] if cliente else ""),
            ("Email:", "email", cliente["email"] if cliente else ""),
            ("Dirección:", "direccion", cliente["direccion"] if cliente else ""),
        ]

        entries = {}
        for label, key, valor in campos:
            tk.Label(frame, text=label, font=("Segoe UI", 10), bg="white").pack(anchor="w")
            entry = tk.Entry(frame, font=("Segoe UI", 11), width=35)
            entry.pack(fill="x", pady=(0, 8))
            if valor:
                entry.insert(0, valor)
            entries[key] = entry

        def guardar():
            nombre = entries["nombre"].get().strip()
            if not nombre:
                messagebox.showwarning("Aviso", "El nombre es obligatorio")
                return

            clientes = Cliente()
            if editar:
                clientes.actualizar(
                    cliente["id"], nombre,
                    entries["telefono"].get().strip(),
                    entries["email"].get().strip(),
                    entries["direccion"].get().strip()
                )
            else:
                clientes.crear(
                    nombre,
                    entries["telefono"].get().strip(),
                    entries["email"].get().strip(),
                    entries["direccion"].get().strip()
                )

            form.destroy()
            self._cargar_clientes()
            messagebox.showinfo("Éxito", "Cliente guardado correctamente")

        tk.Button(frame, text="Guardar", font=("Segoe UI", 11, "bold"),
                  bg="#2ecc71", fg="white", relief="flat",
                  command=guardar).pack(fill="x", pady=(15, 0))
