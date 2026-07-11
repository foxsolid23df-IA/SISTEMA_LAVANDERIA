import tkinter as tk
from tkinter import messagebox
from database.modelos import Usuario


class LoginWindow:
    def __init__(self, root, on_login_success):
        self.root = root
        self.on_login_success = on_login_success
        self.usuario_actual = None

        self.root.title("Sistema Lavandería - Acceso")
        self.root.geometry("400x500")
        self.root.resizable(False, False)
        self.root.configure(bg="#1a1a2e")

        self._centrar_ventana()
        self._crear_widgets()

    def _centrar_ventana(self):
        self.root.update_idletasks()
        w = 400
        h = 500
        x = (self.root.winfo_screenwidth() // 2) - (w // 2)
        y = (self.root.winfo_screenheight() // 2) - (h // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")

    def _crear_widgets(self):
        frame = tk.Frame(self.root, bg="#1a1a2e", padx=40, pady=30)
        frame.pack(expand=True, fill="both")

        tk.Label(frame, text="🧺", font=("Segoe UI", 48), bg="#1a1a2e", fg="white").pack(pady=(0, 10))
        tk.Label(frame, text="SISTEMA LAVANDERÍA",
                 font=("Segoe UI", 16, "bold"), bg="#1a1a2e", fg="white").pack()
        tk.Label(frame, text="Ingrese su PIN para acceder",
                 font=("Segoe UI", 10), bg="#1a1a2e", fg="#aaa").pack(pady=(5, 20))

        self.pin_entry = tk.Entry(frame, font=("Consolas", 24), justify="center",
                                   show="•", width=10, bg="#16213e", fg="white",
                                   insertbackground="white", relief="flat")
        self.pin_entry.pack(pady=10, ipady=8)
        self.pin_entry.focus_set()

        btn_frame = tk.Frame(frame, bg="#1a1a2e")
        btn_frame.pack(pady=15)

        numeros = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
        for i, num in enumerate(numeros):
            btn = tk.Button(btn_frame, text=num, font=("Segoe UI", 14, "bold"),
                            width=5, height=1, bg="#0f3460", fg="white",
                            activebackground="#533483", activeforeground="white",
                            relief="flat", command=lambda n=num: self._agregar_digito(n))
            btn.grid(row=i // 3, column=i % 3, padx=3, pady=3)

        btn_0 = tk.Button(btn_frame, text="0", font=("Segoe UI", 14, "bold"),
                          width=5, height=1, bg="#0f3460", fg="white",
                          activebackground="#533483", activeforeground="white",
                          relief="flat", command=lambda: self._agregar_digito("0"))
        btn_0.grid(row=3, column=0, padx=3, pady=3)

        btn_borrar = tk.Button(btn_frame, text="⌫", font=("Segoe UI", 14, "bold"),
                               width=5, height=1, bg="#e94560", fg="white",
                               activebackground="#c81e45", activeforeground="white",
                               relief="flat", command=self._borrar_digito)
        btn_borrar.grid(row=3, column=1, padx=3, pady=3)

        btn_enter = tk.Button(btn_frame, text="✓", font=("Segoe UI", 14, "bold"),
                              width=5, height=1, bg="#2ecc71", fg="white",
                              activebackground="#27ae60", activeforeground="white",
                              relief="flat", command=self._verificar_pin)
        btn_enter.grid(row=3, column=2, padx=3, pady=3)

        self.root.bind("<Key>", self._tecla_presionada)

    def _agregar_digito(self, digito):
        if len(self.pin_entry.get()) < 6:
            self.pin_entry.insert(tk.END, digito)

    def _borrar_digito(self):
        actual = self.pin_entry.get()
        if actual:
            self.pin_entry.delete(len(actual) - 1)

    def _tecla_presionada(self, event):
        if event.char.isdigit():
            self._agregar_digito(event.char)
        elif event.keysym == "BackSpace":
            self._borrar_digito()
        elif event.keysym == "Return":
            self._verificar_pin()

    def _verificar_pin(self):
        pin = self.pin_entry.get()
        if not pin:
            messagebox.showwarning("Aviso", "Ingrese su PIN")
            return

        usuario = Usuario().autenticar(pin)
        if usuario:
            self.usuario_actual = dict(usuario)
            self.root.withdraw()
            self.on_login_success(self.usuario_actual)
        else:
            messagebox.showerror("Error", "PIN incorrecto")
            self.pin_entry.delete(0, tk.END)
