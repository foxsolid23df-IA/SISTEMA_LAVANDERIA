import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import tkinter as tk
from tkinter import messagebox

from config import APP_NAME, APP_VERSION
from database import init_db
from database.seed import seed_inicial
from ui.login import LoginWindow
from ui.principal import Dashboard


class SistemaLavanderia:
    def __init__(self):
        self.root = tk.Tk()
        self.root.withdraw()

        init_db()
        seed_inicial()

        self.usuario_actual = None
        self._mostrar_login()

    def _mostrar_login(self):
        login_root = tk.Toplevel(self.root)
        login_root.protocol("WM_DELETE_WINDOW", self._salir)
        LoginWindow(login_root, self._on_login_success)

    def _on_login_success(self, usuario):
        self.usuario_actual = usuario
        self.root.deiconify()
        self._mostrar_dashboard()

    def _mostrar_dashboard(self):
        for widget in self.root.winfo_children():
            widget.destroy()

        Dashboard(self.root, self.usuario_actual, self._navegar)

    def _navegar(self, modulo):
        for widget in self.root.winfo_children():
            widget.destroy()

        def on_volver():
            self._mostrar_dashboard()

        modulos = {
            "ordenes_lista": self._importar_ordenes_lista,
            "ordenes_nueva": self._importar_ordenes_nueva,
            "cobro": self._importar_cobro,
            "caja": self._importar_caja,
            "reportes": self._importar_reportes,
            "clientes": self._importar_clientes,
            "ticket_config": self._importar_ticket_config,
            "configuracion": self._importar_configuracion,
        }

        factory = modulos.get(modulo)
        if factory:
            factory(on_volver)
        else:
            messagebox.showerror("Error", f"Módulo '{modulo}' no encontrado")
            self._mostrar_dashboard()

    def _importar_ordenes_lista(self, on_volver):
        from ui.ordenes import OrdenesLista
        OrdenesLista(self.root, self.usuario_actual, self._navegar, on_volver)

    def _importar_ordenes_nueva(self, on_volver):
        from ui.ordenes import OrdenNueva
        OrdenNueva(self.root, self.usuario_actual, self._navegar, on_volver)

    def _importar_cobro(self, on_volver):
        from ui.cobro import CobroWindow
        CobroWindow(self.root, self.usuario_actual, self._navegar, on_volver)

    def _importar_caja(self, on_volver):
        from ui.caja import CajaWindow
        CajaWindow(self.root, self.usuario_actual, self._navegar, on_volver)

    def _importar_reportes(self, on_volver):
        from ui.reportes import ReportesWindow
        ReportesWindow(self.root, self.usuario_actual, self._navegar, on_volver)

    def _importar_clientes(self, on_volver):
        from ui.clientes import ClientesWindow
        ClientesWindow(self.root, self.usuario_actual, self._navegar, on_volver)

    def _importar_ticket_config(self, on_volver):
        from ui.ticket_config import TicketConfigWindow
        TicketConfigWindow(self.root, self.usuario_actual, self._navegar, on_volver)

    def _importar_configuracion(self, on_volver):
        from ui.configuracion import ConfiguracionWindow
        ConfiguracionWindow(self.root, self.usuario_actual, self._navegar, on_volver)

    def _salir(self):
        if messagebox.askyesno("Salir", "¿Está seguro que desea salir?"):
            self.root.destroy()

    def ejecutar(self):
        self.root.mainloop()


if __name__ == "__main__":
    app = SistemaLavanderia()
    app.ejecutar()
