import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  HashRouter,
  BrowserRouter,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Sidebar } from "../components/sidebar/Sidebar";
import { Sales } from "../components/sales/Sales";
import { Inventory } from "../components/inventory/Inventory";
import { Historial } from "../components/historial/Historial";
import { Stats } from "../components/stats/Stats";
import { Login } from "../components/auth/Login";
import { LockScreen } from "../components/auth/LockScreen";
import { CashFundModal } from "../components/auth/CashFundModal";
import { UserManager } from "../components/admin/UserManager";
import { SupplyInventory } from "../components/supplies/SupplyInventory";

import { AuthProvider, useAuth } from "../hooks/useAuth";
import { TerminalSetup } from "../components/config/TerminalSetup";
import { ConfiguracionPortal } from "../components/config/ConfiguracionPortal";
import { Orders } from "../components/sales/Orders";
import { ClientManager } from "../components/admin/ClientManager";
import CustomerDisplay from "../components/customer/CustomerDisplay";
import ExchangeRateSettings from "../components/admin/ExchangeRateSettings";
import TaxSettings from "../components/admin/TaxSettings";
import PaymentMethodsSettings from "../components/admin/PaymentMethodsSettings";
import { PriceConfiguration } from "../components/admin/PriceConfiguration";
import { TicketConfiguration } from "../components/admin/TicketConfiguration";
import { terminalService } from "../services/terminalService";
import Maintenance from "../components/admin/Maintenance";
import BillingIssuers from "../components/config/BillingIssuers";
import { InvoiceCancellation } from "../components/config/InvoiceCancellation";
import { ServiciosExpressSettings } from "../components/config/ServiciosExpressSettings";
import { DeliveryDashboard } from "../components/delivery/DeliveryDashboard";
import { DriverPortal } from "../components/delivery/DriverPortal";
import { OrderTracking } from "../components/delivery/OrderTracking";

import { ScrollToTop } from "../components/common/ScrollToTop";
import { ScrollTopButton } from "../components/common/ScrollTopButton";
import { ProductProvider } from "../contexts/ProductContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import { LicenseGuard } from "../components/common/LicenseGuard";
import MobileCapture from "../components/ai/MobileCapture";
import { AdminPanel } from "../components/admin/AdminPanel";
import { CashReportsView } from "../components/reports/CashReportsView";
import CancellationsReport from "../components/reports/CancellationsReport";
import { SuperAdminRoute } from "../components/common/SuperAdminRoute";
import { MasterLicenseManager } from "../components/admin/MasterLicenseManager";
import { LatencyIndicator } from "../components/common/LatencyIndicator";
import { SuperAdminLogin } from "../components/auth/SuperAdminLogin";
import { SuperAdminLayout } from "../components/common/SuperAdminLayout";

const PrivateLayout = ({ children, chrome = true }) => {
  const {
    user,
    loading,
    isLocked,
    activeStaff,
    needsCashFund,
    checkCashSession,
    openCashSession,
    storeName,
    adminMode,
    isAdmin,
  } = useAuth();

  const location = useLocation();
  const isPOSRoute =
    location.pathname === "/" || location.pathname === "/ventas";

  const [isTerminalConfigured, setIsTerminalConfigured] = useState(
    !!terminalService.getTerminalId(),
  );
  const [isValidating, setIsValidating] = useState(false);

  // Validar existencia de terminal solo una vez al cargar la app
  useEffect(() => {
    if (!user || isValidating) return;

    // Flag para evitar múltiples ejecuciones durante la misma sesión de carga
    const terminalValidatedSession =
      sessionStorage.getItem("terminal_validated");
    if (terminalValidatedSession === "true") {
      console.log("[Routing] Terminal ya validada en esta pestaña.");
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
            sessionStorage.setItem("terminal_validated", "true");
          }
        } finally {
          setIsValidating(false);
        }
      }
    };

    validateTerminal();
  }, [user?.id]); // Solo re-validar si cambia el usuario (login/logout)

  // Verificar sesión de caja por separado (solo si no está en modo admin)
  useEffect(() => {
    if (
      user &&
      activeStaff &&
      !isLocked &&
      isTerminalConfigured &&
      !isValidating &&
      !adminMode
    ) {
      checkCashSession();
    }
  }, [
    user,
    activeStaff,
    isLocked,
    isTerminalConfigured,
    isValidating,
    adminMode,
  ]);

  // Auto-apertura de caja para el Propietario (DESACTIVADO por solicitud de apertura obligatoria)
  /* useEffect(() => {
        if (needsCashFund && activeStaff?.isOwner) {
            console.log('[PrivateLayout] Auto-iniciando caja para Propietario...');
            openCashSession(0).catch(err => console.error('Error auto-opening session:', err));
        }
    }, [needsCashFund, activeStaff]); */

  if (loading || isValidating)
    return <div className="loading-screen">Verificando configuración...</div>;
  if (!user) return <Navigate to="/login" />;

  // Verificación de Terminal (Fundamental para operar)
  // En modo admin, el administrador puede acceder sin terminal configurada
  if (!isTerminalConfigured && !adminMode) {
    return (
      <TerminalSetup
        onTerminalConfigured={() => setIsTerminalConfigured(true)}
        isAdmin={isAdmin}
      />
    );
  }

  // Si la pantalla está bloqueada, mostrar pantalla de PIN
  if (isLocked) return <LockScreen />;

  // 3. Si necesita ingresar fondo de caja (DESACTIVADO DE LA RUTA PRINCIPAL)
  // Se ha movido la lógica para que el manual sea desde dentro del sistema (Sidebar > Abrir Caja)
  /* if (needsCashFund && isPOSRoute) {
        return (
            <CashFundModal
                staffName={activeStaff?.name || storeName || 'Operador'}
                staffId={activeStaff?.id}
                onSessionCreated={(session) => {
                    checkCashSession();
                }}
            />
        );
    } */

  if (!chrome) {
    return <LicenseGuard>{children}</LicenseGuard>;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <LicenseGuard>{children}</LicenseGuard>
        <ScrollTopButton />
        <LatencyIndicator />
      </main>
    </div>
  );
};

const AdminRoute = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" />;
};

const CashReportsRoute = ({ children }) => {
  const { canViewCashReports } = useAuth();
  return canViewCashReports ? children : <Navigate to="/" />;
};

const CancellationsRoute = ({ children }) => {
  const { canViewCancellations } = useAuth();
  return canViewCancellations ? children : <Navigate to="/" />;
};

const InventoryRoute = ({ children }) => {
  const { canManageInventory, canViewSupplies } = useAuth();
  return canManageInventory || canViewSupplies ? children : <Navigate to="/" />;
};

const DefaultRoute = () => {
  const isDesktop = !!window?.electron?.isElectron;
  if (!isDesktop) {
    return <Navigate to="/estadisticas" replace />;
  }
  return <Sales />;
};

const isDriverStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator?.standalone === true;

const isDriverMobileViewport = () =>
  window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth <= 768;

const getDriverPosPath = () => (window?.electron?.isElectron ? "/ventas" : "/estadisticas");

const ModuleUnavailable = ({ title = "Modulo no disponible para esta tienda" }) => {
  const navigate = useNavigate();
  return (
    <main className="driver-desktop-gate">
      <section className="driver-desktop-card">
        <div className="driver-desktop-icon">
          <span className="material-icons-outlined">block</span>
        </div>
        <span className="driver-desktop-kicker">Modulo opcional</span>
        <h1>{title}</h1>
        <p>
          Delivery y portal repartidor estan apagados para esta tienda.
          Contacta al administrador para activarlo desde el Portal Maestro.
        </p>
        <div className="driver-desktop-actions">
          <button type="button" className="driver-desktop-primary" onClick={() => navigate(getDriverPosPath(), { replace: true })}>
            Volver al POS
          </button>
        </div>
      </section>
    </main>
  );
};

const DeliveryModuleRoute = () => {
  const { hasDeliveryModule } = useAuth();
  if (!hasDeliveryModule) return <ModuleUnavailable />;
  return <DeliveryDashboard />;
};

const DriverPortalRoute = () => {
  const { hasDeliveryModule } = useAuth();
  const navigate = useNavigate();
  const [desktopPreview, setDesktopPreview] = useState(
    sessionStorage.getItem("driver_portal_desktop_preview") === "true",
  );

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Portal Repartidor";

    let manifest = document.getElementById("driver-pwa-manifest");
    if (!manifest) {
      manifest = document.createElement("link");
      manifest.id = "driver-pwa-manifest";
      manifest.rel = "manifest";
      document.head.appendChild(manifest);
    }
    manifest.href = "/driver-manifest.webmanifest";

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/driver-sw.js").catch((err) => {
        console.warn("[Driver PWA] No se pudo registrar service worker:", err);
      });
    }

    return () => {
      document.title =
        previousTitle === "Portal Repartidor"
          ? "SISTEMA VENTAS | LAVANDERIA PRO"
          : previousTitle;
      document.getElementById("driver-pwa-manifest")?.remove();
    };
  }, []);

  const shouldGateDesktop =
    !desktopPreview && !isDriverStandalone() && !isDriverMobileViewport();

  if (!hasDeliveryModule) {
    return <ModuleUnavailable />;
  }

  const goToPos = () => {
    sessionStorage.removeItem("driver_portal_desktop_preview");
    navigate(getDriverPosPath(), { replace: true });
  };

  const continuePreview = () => {
    sessionStorage.setItem("driver_portal_desktop_preview", "true");
    setDesktopPreview(true);
  };

  if (shouldGateDesktop) {
    return (
      <DriverDesktopGate
        onGoToPos={goToPos}
        onContinuePreview={continuePreview}
      />
    );
  }

  return <DriverPortal desktopPreview={desktopPreview} onExitPreview={goToPos} />;
};

const DriverDesktopGate = ({ onGoToPos, onContinuePreview }) => (
  <main className="driver-desktop-gate">
    <section className="driver-desktop-card">
      <div className="driver-desktop-icon">
        <span className="material-icons-outlined">install_mobile</span>
      </div>
      <span className="driver-desktop-kicker">Modulo movil</span>
      <h1>Portal repartidor</h1>
      <p>
        Esta pantalla esta pensada para instalarse en el celular del repartidor como app.
        En esta computadora puedes volver al POS o abrirla solo para pruebas.
      </p>
      <div className="driver-desktop-actions">
        <button type="button" className="driver-desktop-primary" onClick={onGoToPos}>
          Ir al POS
        </button>
        <button type="button" className="driver-desktop-secondary" onClick={onContinuePreview}>
          Continuar en modo prueba
        </button>
      </div>
    </section>
  </main>
);

export const Routing = () => {
  const Router = window?.electron?.isElectron ? HashRouter : BrowserRouter;

  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* Pantalla Cliente: Independiente de AuthProvider y ProductProvider */}
        <Route path="/customer-display" element={<CustomerDisplay />} />
        <Route path="/mobile-capture/:sessionId" element={<MobileCapture />} />
        <Route path="/tracking/:token" element={<OrderTracking />} />

        {/* Rutas Exclusivas SuperAdmin */}
        <Route path="/portal-maestro" element={<SuperAdminLogin />} />
        <Route
          path="/super-admin/*"
          element={
            <SuperAdminLayout>
              <Routes>
                <Route path="licencias" element={<MasterLicenseManager />} />
              </Routes>
            </SuperAdminLayout>
          }
        />

        {/* Rutas de la Aplicación Principal */}
        <Route
          path="/*"
          element={
            <AuthProvider>
              <SettingsProvider>
                <ProductProvider>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                      path="/register/:invitationCode?"
                      element={<Login />}
                    />

                    <Route
                      path="/"
                      element={
                        <PrivateLayout>
                          <DefaultRoute />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/ventas"
                      element={
                        <PrivateLayout>
                          <Sales />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/servicios"
                      element={
                        <PrivateLayout>
                          <InventoryRoute>
                            <Inventory mode="SERVICE" />
                          </InventoryRoute>
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/productos"
                      element={
                        <PrivateLayout>
                          <InventoryRoute>
                            <Inventory mode="PRODUCT" />
                          </InventoryRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/insumos"
                      element={
                        <PrivateLayout>
                          <InventoryRoute>
                            <SupplyInventory />
                          </InventoryRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/historial"
                      element={
                        <PrivateLayout>
                          <Historial />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/ordenes"
                      element={
                        <PrivateLayout>
                          <Orders />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/estadisticas"
                      element={
                        <PrivateLayout>
                          <Stats />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/clientes"
                      element={
                        <PrivateLayout>
                          <ClientManager />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/delivery"
                      element={
                        <PrivateLayout>
                          <DeliveryModuleRoute />
                        </PrivateLayout>
                      }
                    />
                    <Route
                      path="/chofer"
                      element={
                        <PrivateLayout chrome={false}>
                          <DriverPortalRoute />
                        </PrivateLayout>
                      }
                    />

                    {/* Portal de Configuración Principal */}
                    <Route
                      path="/configuracion"
                      element={
                        <PrivateLayout>
                          <ConfiguracionPortal />
                        </PrivateLayout>
                      }
                    />

                    {/* Reportes de Caja — Solo Admin/Web */}
                    <Route
                      path="/reportes-caja"
                      element={
                        <PrivateLayout>
                          <CashReportsRoute>
                            <CashReportsView />
                          </CashReportsRoute>
                        </PrivateLayout>
                      }
                    />

                    {/* Reporte de Cancelaciones */}
                    <Route
                      path="/reporte-cancelaciones"
                      element={
                        <PrivateLayout>
                          <CancellationsRoute>
                            <CancellationsReport />
                          </CancellationsRoute>
                        </PrivateLayout>
                      }
                    />

                    {/* Panel de Administración solo para Admin */}
                    <Route
                      path="/admin"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <AdminPanel />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    {/* Gestión de Usuarios solo para Admin */}
                    <Route
                      path="/usuarios"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <UserManager />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/configuracion-dolares"
                      element={
                        <PrivateLayout>
                          <ExchangeRateSettings />
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/configuracion-impuestos"
                      element={
                        <PrivateLayout>
                          <TaxSettings />
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/configuracion-pagos"
                      element={
                        <PrivateLayout>
                          <PaymentMethodsSettings />
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/configuracion-servicios-express"
                      element={
                        <PrivateLayout>
                          <ServiciosExpressSettings />
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/precios"
                      element={
                        <PrivateLayout>
                          <PriceConfiguration />
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/configuracion-ticket"
                      element={
                        <PrivateLayout>
                          <TicketConfiguration />
                        </PrivateLayout>
                      }
                    />

                    {/* Emisores Fiscales (CSD / Facturama) — Solo Admin */}
                    <Route
                      path="/config-emisores"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <BillingIssuers />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    {/* Cancelación de Facturas — Solo Admin */}
                    <Route
                      path="/cancelar-factura"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <InvoiceCancellation />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    <Route
                      path="/soporte-tecnico-especializado-nexusprolavanderia"
                      element={
                        <PrivateLayout>
                          <AdminRoute>
                            <Maintenance />
                          </AdminRoute>
                        </PrivateLayout>
                      }
                    />

                    {/* Rutas eliminadas de SuperAdmin (movidas fuera de PrivateLayout) */}

                    <Route
                      path="*"
                      element={
                        <div style={{ padding: "2rem", textAlign: "center" }}>
                          <h1>Error 404</h1>
                          <p>Página no encontrada</p>
                          <Link to="/">Volver al Inicio</Link>
                        </div>
                      }
                    />
                  </Routes>
                </ProductProvider>
              </SettingsProvider>
            </AuthProvider>
          }
        />
      </Routes>
    </Router>
  );
};
