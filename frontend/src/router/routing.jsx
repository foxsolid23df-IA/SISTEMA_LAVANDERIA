import React, { useEffect, useState } from "react";
import { Routes, Route, HashRouter, Link, Navigate, useLocation } from "react-router-dom"
import { Sidebar } from "../components/sidebar/Sidebar"
import { Sales } from "../components/sales/Sales"
import { Inventory } from "../components/inventory/Inventory"
import { Historial } from "../components/historial/Historial"
import { Stats } from "../components/stats/Stats"
import { Login } from "../components/auth/Login"
import { LockScreen } from "../components/auth/LockScreen"
import { CashFundModal } from "../components/auth/CashFundModal"
import { UserManager } from "../components/admin/UserManager"

import { AuthProvider, useAuth } from "../hooks/useAuth"
import { TerminalSetup } from "../components/config/TerminalSetup";
import { Orders } from "../components/sales/Orders";
import { ClientManager } from "../components/admin/ClientManager";
import CustomerDisplay from "../components/customer/CustomerDisplay";
import ExchangeRateSettings from "../components/admin/ExchangeRateSettings";
import { PriceConfiguration } from "../components/admin/PriceConfiguration";
import { TicketConfiguration } from "../components/admin/TicketConfiguration";import { terminalService } from "../services/terminalService";
import Maintenance from "../components/admin/Maintenance";
import { ScrollToTop } from "../components/common/ScrollToTop";
import { ScrollTopButton } from "../components/common/ScrollTopButton";
import { ProductProvider } from "../contexts/ProductContext";
import { LicenseGuard } from "../components/common/LicenseGuard";
import { AdminPanel } from "../components/admin/AdminPanel";

const PrivateLayout = ({ children }) => {
    const {
        user,
        loading,
        isLocked,
        activeStaff,
        needsCashFund,
        checkCashSession,
        openCashSession,
        storeName
    } = useAuth();

    const location = useLocation();
    const isPOSRoute = location.pathname === '/' || location.pathname === '/ventas';

    const [isTerminalConfigured, setIsTerminalConfigured] = useState(!!terminalService.getTerminalId());
    const [isValidating, setIsValidating] = useState(false);

    // Validar existencia de terminal solo una vez al cargar la app
    useEffect(() => {
        if (!user || isValidating) return;

        // Flag para evitar múltiples ejecuciones durante la misma sesión de carga
        const terminalValidatedSession = sessionStorage.getItem('terminal_validated');
        if (terminalValidatedSession === 'true') {
            console.log('[Routing] Terminal ya validada en esta pestaña.');
            return;
        }

        const validateTerminal = async () => {
            if (isTerminalConfigured) {
                setIsValidating(true);
                try {
                    const isValid = await terminalService.validateTerminalExistence();
                    if (!isValid) {
                        setIsTerminalConfigured(false);
                    } else {
                        sessionStorage.setItem('terminal_validated', 'true');
                    }
                } finally {
                    setIsValidating(false);
                }
            }
        };

        validateTerminal();
    }, [user?.id]); // Solo re-validar si cambia el usuario (login/logout)

    // Verificar sesión de caja por separado
    useEffect(() => {
        if (user && activeStaff && !isLocked && isTerminalConfigured && !isValidating) {
            checkCashSession();
        }
    }, [user, activeStaff, isLocked, isTerminalConfigured, isValidating]);

    if (loading || isValidating) return <div className="loading-screen">Verificando configuración...</div>;
    if (!user) return <Navigate to="/login" />;

    // 1. Verificación de Terminal (Fundamental para operar)
    if (!isTerminalConfigured) {
        return <TerminalSetup onTerminalConfigured={() => setIsTerminalConfigured(true)} />;
    }

    // 2. Si la pantalla está bloqueada, mostrar pantalla de PIN
    if (isLocked) return <LockScreen />;

    // 3. Si necesita ingresar fondo de caja y está en Ventas, mostrar modal
    if (needsCashFund && isPOSRoute) {
        return (
            <CashFundModal
                staffName={activeStaff?.name || storeName || 'Operador'}
                staffId={activeStaff?.id}
                onSessionCreated={(session) => {
                    // La sesión se actualiza automáticamente en el contexto
                    console.log('Sesión de caja creada:', session);
                    checkCashSession(); // Actualizar estado global para cerrar modal
                }}
            />
        );
    }

    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <LicenseGuard>
                    {children}
                </LicenseGuard>
                <ScrollTopButton />
            </main>
        </div>
    );
};


const AdminRoute = ({ children }) => {
    const { isAdmin } = useAuth();
    return isAdmin ? children : <Navigate to="/" />;
};

export const Routing = () => {
    return (
        <HashRouter>
            <ScrollToTop />
            <Routes>
                {/* Pantalla Cliente: Independiente de AuthProvider y ProductProvider */}
                <Route path="/customer-display" element={<CustomerDisplay />} />

                {/* Rutas de la Aplicación Principal */}
                <Route path="/*" element={
                    <AuthProvider>
                        <ProductProvider>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/register/:invitationCode?" element={<Login />} />

                                <Route path="/" element={<PrivateLayout><Sales /></PrivateLayout>} />
                                <Route path="/ventas" element={<PrivateLayout><Sales /></PrivateLayout>} />
                                <Route path="/servicios" element={<PrivateLayout><Inventory /></PrivateLayout>} />

                                <Route path="/historial" element={<PrivateLayout><Historial /></PrivateLayout>} />
                                <Route path="/ordenes" element={<PrivateLayout><Orders /></PrivateLayout>} />
                                <Route path="/estadisticas" element={<PrivateLayout><Stats /></PrivateLayout>} />
                                <Route path="/clientes" element={<PrivateLayout><ClientManager /></PrivateLayout>} />
                                
                                {/* Panel de Administración solo para Admin */}
                                <Route path="/admin" element={
                                    <PrivateLayout>
                                        <AdminRoute>
                                            <AdminPanel />
                                        </AdminRoute>
                                    </PrivateLayout>
                                } />
                                
                                {/* Gestión de Usuarios solo para Admin */}
                                <Route path="/usuarios" element={
                                    <PrivateLayout>
                                        <AdminRoute>
                                            <UserManager />
                                        </AdminRoute>
                                    </PrivateLayout>
                                } />

                                <Route path="/configuracion-dolares" element={
                                    <PrivateLayout>
                                        <ExchangeRateSettings />
                                    </PrivateLayout>
                                } />

                                <Route path="/precios" element={
                                    <PrivateLayout>
                                        <PriceConfiguration />
                                    </PrivateLayout>
                                } />

                                <Route path="/configuracion-ticket" element={
                                    <PrivateLayout>
                                        <TicketConfiguration />
                                    </PrivateLayout>
                                } />

                                <Route path="/soporte-tecnico-especializado-foxsolid" element={
                                    <PrivateLayout>
                                        <AdminRoute>
                                            <Maintenance />
                                        </AdminRoute>
                                    </PrivateLayout>
                                } />

                                <Route path="*" element={
                                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                                        <h1>Error 404</h1>
                                        <p>Página no encontrada</p>
                                        <Link to="/">Volver al Inicio</Link>
                                    </div>
                                } />
                            </Routes>
                        </ProductProvider>
                    </AuthProvider>
                } />
            </Routes>
        </HashRouter>
    )
}
