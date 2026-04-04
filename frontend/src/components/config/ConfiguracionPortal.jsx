import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const ConfiguracionPortal = () => {
    const { isAdmin } = useAuth();

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ 
                    padding: '1rem', 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    borderRadius: '16px', 
                    color: '#6366f1', 
                    display: 'flex' 
                }}>
                    <span className="material-icons-outlined" style={{ fontSize: '32px' }}>settings</span>
                </div>
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }} className="text-slate-800 dark:text-white">
                        Configuración del Sistema
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginTop: '0.25rem' }}>
                        Ajustes globales y herramientas de administración
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                {isAdmin && (
                    <NavLink to="/usuarios" className="flex flex-col p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 transform hover:-translate-y-1">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mb-5">
                            <span className="material-icons-outlined">manage_accounts</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Usuarios</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Gestionar empleados, roles y accesos al sistema</p>
                    </NavLink>
                )}

                {isAdmin && (
                    <NavLink to="/configuracion-ticket" className="flex flex-col p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 transform hover:-translate-y-1">
                        <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center mb-5">
                            <span className="material-icons-outlined">receipt_long</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Configuración de Ticket</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Ajustar encabezado, pie de página e impresora de tickets</p>
                    </NavLink>
                )}

                {isAdmin && (
                    <NavLink to="/admin" className="flex flex-col p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 transform hover:-translate-y-1">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-500 flex items-center justify-center mb-5">
                            <span className="material-icons-outlined">admin_panel_settings</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Admin Panel</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Configuraciones avanzadas y herramientas de mantenimiento</p>
                    </NavLink>
                )}

                <NavLink to="/configuracion-impuestos" className="flex flex-col p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 transform hover:-translate-y-1">
                    <div className="w-12 h-12 rounded-xl bg-pink-50 dark:bg-pink-500/10 text-pink-500 flex items-center justify-center mb-5">
                        <span className="material-icons-outlined">request_quote</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Impuestos</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Ajustar el porcentaje de impuestos aplicable a ventas</p>
                </NavLink>

                <NavLink to="/configuracion-dolares" className="flex flex-col p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 transform hover:-translate-y-1">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-5">
                        <span className="material-icons-outlined">currency_exchange</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Tipos de Cambio</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Ajustar la tasa de cambio aplicable a transacciones en dólares</p>
                </NavLink>

                {isAdmin && (
                    <NavLink to="/config-emisores" className="flex flex-col p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 transform hover:-translate-y-1">
                        <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-500 flex items-center justify-center mb-5">
                            <span className="material-icons-outlined">account_balance</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Emisores Fiscales</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Configuración de RFC, CSD y datos de facturación</p>
                    </NavLink>
                )}
            </div>
        </div>
    );
};
