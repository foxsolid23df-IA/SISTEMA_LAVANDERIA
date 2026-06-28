import React, { useEffect, useState, lazy, Suspense } from "react";
import {
  Routes,
  Route,
  HashRouter,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Sidebar } from "../components/sidebar/Sidebar";
import { terminalService } from "../services/terminalService";

import { AuthProvider, useAuth } from "../hooks/useAuth";
import { ProductProvider } from "../contexts/ProductContext";
import { SettingsProvider } from "../contexts/SettingsContext";
import { platform } from "../utils/platform";

import { ScrollToTop } from "../components/common/ScrollToTop";
import { ScrollTopButton } from "../components/common/ScrollTopButton";
import { LicenseGuard } from "../components/common/LicenseGuard";
import { LatencyIndicator } from "../components/common/LatencyIndicator";

const Sales = lazy(() => import("../components/sales/Sales").then(m => ({ default: m.Sales })));
const Inventory = lazy(() => import("../components/inventory/Inventory").then(m => ({ default: m.Inventory })));
const Historial = lazy(() => import("../components/historial/Historial").then(m => ({ default: m.Historial })));
const Stats = lazy(() => import("../components/stats/Stats").then(m => ({ default: m.Stats })));
const Login = lazy(() => import("../components/auth/Login").then(m => ({ default: m.Login })));
const LockScreen = lazy(() => import("../components/auth/LockScreen").then(m => ({ default: m.LockScreen })));
const UserManager = lazy(() => import("../components/admin/UserManager").then(m => ({ default: m.UserManager })));
const SupplyInventory = lazy(() => import("../components/supplies/SupplyInventory").then(m => ({ default: m.SupplyInventory })));
const TerminalSetup = lazy(() => import("../components/config/TerminalSetup").then(m => ({ default: m.TerminalSetup })));
const ConfiguracionPortal = lazy(() => import("../components/config/ConfiguracionPortal").then(m => ({ default: m.ConfiguracionPortal })));
const Orders = lazy(() => import("../components/sales/Orders").then(m => ({ default: m.Orders })));
const ClientManager = lazy(() => import("../components/admin/ClientManager").then(m => ({ default: m.ClientManager })));
const CustomerDisplay = lazy(() => import("../components/customer/CustomerDisplay"));
const ExchangeRateSettings = lazy(() => import("../components/admin/ExchangeRateSettings"));
const TaxSettings = lazy(() => import("../components/admin/TaxSettings"));
const PaymentMethodsSettings = lazy(() => import("../components/admin/PaymentMethodsSettings"));
const PriceConfiguration = lazy(() => import("../components/admin/PriceConfiguration").then(m => ({ default: m.PriceConfiguration })));
const TicketConfiguration = lazy(() => import("../components/admin/TicketConfiguration").then(m => ({ default: m.TicketConfiguration })));
const Maintenance = lazy(() => import("../components/admin/Maintenance"));
const BillingIssuers = lazy(() => import("../components/config/BillingIssuers"));
const InvoiceCancellation = lazy(() => import("../components/config/InvoiceCancellation").then(m => ({ default: m.InvoiceCancellation })));
const ServiciosExpressSettings = lazy(() => import("../components/config/ServiciosExpressSettings").then(m => ({ default: m.ServiciosExpressSettings })));
const DeliveryDashboard = lazy(() => import("../components/delivery/DeliveryDashboard").then(m => ({ default: m.DeliveryDashboard })));
const DriverPortal = lazy(() => import("../components/delivery/DriverPortal").then(m => ({ default: m.DriverPortal })));
const OrderTracking = lazy(() => import("../components/delivery/OrderTracking").then(m => ({ default: m.OrderTracking })));
const MobileCapture = lazy(() => import("../components/ai/MobileCapture"));
const AdminPanel = lazy(() => import("../components/admin/AdminPanel").then(m => ({ default: m.AdminPanel })));
const CashReportsView = lazy(() => import("../components/reports/CashReportsView").then(m => ({ default: m.CashReportsView })));
const CancellationsReport = lazy(() => import("../components/reports/CancellationsReport"));
const CuentasPorCobrar = lazy(() => import("../components/accounts/CuentasPorCobrar").then(m => ({ default: m.CuentasPorCobrar })));
const MasterLicenseManager = lazy(() => import("../components/admin/MasterLicenseManager").then(m => ({ default: m.MasterLicenseManager })));
const SuperAdminLogin = lazy(() => import("../components/auth/SuperAdminLogin").then(m => ({ default: m.SuperAdminLogin })));
const SuperAdminLayout = lazy(() => import("../components/common/SuperAdminLayout").then(m => ({ default: m.SuperAdminLayout })));

const ModuleFallback = () => (
  <div className="flex items-center justify-center min-h-[60dvh] text-slate-400 text-sm font-medium">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      <span>Cargando m\u00f3dulo...</span>
    </div>
  </div>
);

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

  useEffect(() => {
    if (!user || isValidating) return;

    const terminalValidatedSession =
      sessionStorage.getItem("terminal_validated");
    if (terminalValidatedSession === "true") {
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
  }, [user?.id]);

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

  if (loading || isValidating)
    return <div className="loading-screen">Verificando configuraci\u00f3n...</div>;
  if (!user) return <Navigate to="/login" />;

  if (!isTerminalConfigured && !adminMode) {
    return (
      <Suspense fallback={<ModuleFallback />}>
        <TerminalSetup
          onTerminalConfigured={() => setIsTerminalConfigured(true)}
          isAdmin={isAdmin}
        />
      </Suspense>
    );
  }

  if (isLocked) return (
    <Suspense fallback={<ModuleFallback />}>
      <LockScreen />
    </Suspense>
  );

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

const PendingAccountsRoute = ({ children }) => {
  const { canViewPendingAccounts } = useAuth();
  return canViewPendingAccounts ? children : <Navigate to="/" />;
};

const InventoryRoute = ({ children }) => {
  const { canManageInventory, canViewSupplies } = useAuth();
  return canManageInventory || canViewSupplies ? children : <Navigate to="/" />;
};

const DefaultRoute = () => {
  if (!platform.isNativePos) {
    return <Navigate to="/estadisticas" replace />;
  }
  return (
    <Suspense fallback={<ModuleFallback />}>
      <Sales />
    </Suspense>
  );
};

const isDriverStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches ||
  window.navigator?.standalone === true;

const isDriverMobileViewport = () =>
  window.matchMedia?.("(pointer: coarse)")?.matches || window.innerWidth <= 768;

const getDriverPosPath = () => (platform.isNativePos ? "/ventas" : "/estadisticas");

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
  return (
    <Suspense fallback={<ModuleFallback />}>
      <DeliveryDashboard />
    </Suspense>
  );
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
    return () => {
      document.title = previousTitle === "Portal Repartidor" ? "SISTEMA VENTAS | LAVANDERIA PRO" : previousTitle;
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

  return (
    <Suspense fallback={<ModuleFallback />}>
      <DriverPortal desktopPreview={desktopPreview} onExitPreview={goToPos} />
    </Suspense>
  );
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

const wrapLazy = (Component) => (
  <Suspense fallback={<ModuleFallback />}>
    <Component />
  </Suspense>
);

export const Routing = () => {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/customer-display" element={wrapLazy(CustomerDisplay)} />
        <Route path="/mobile-capture/:sessionId" element={wrapLazy(MobileCapture)} />
        <Route path="/tracking/:token" element={wrapLazy(OrderTracking)} />

        <Route path="/portal-maestro" element={wrapLazy(SuperAdminLogin)} />
        <Route
          path="/super-admin/*"
          element={
            <Suspense fallback={<ModuleFallback />}>
              <SuperAdminLayout>
                <Routes>
                  <Route path="licencias" element={wrapLazy(MasterLicenseManager)} />
                </Routes>
              </SuperAdminLayout>
            </Suspense>
          }
        />

        <Route
          path="/*"
          element={
            <AuthProvider>
              <SettingsProvider>
                <ProductProvider>
                  <Routes>
                    <Route path="/login" element={wrapLazy(Login)} />
                    <Route path="/register/:invitationCode?" element={wrapLazy(Login)} />

                    <Route path="/" element={<PrivateLayout><DefaultRoute /></PrivateLayout>} />
                    <Route path="/ventas" element={<PrivateLayout>{wrapLazy(Sales)}</PrivateLayout>} />
                    <Route path="/servicios" element={<PrivateLayout><InventoryRoute>{wrapLazy(() => <Inventory mode="SERVICE" />)}</InventoryRoute></PrivateLayout>} />
                    <Route path="/productos" element={<PrivateLayout><InventoryRoute>{wrapLazy(() => <Inventory mode="PRODUCT" />)}</InventoryRoute></PrivateLayout>} />
                    <Route path="/insumos" element={<PrivateLayout><InventoryRoute>{wrapLazy(SupplyInventory)}</InventoryRoute></PrivateLayout>} />
                    <Route path="/historial" element={<PrivateLayout>{wrapLazy(Historial)}</PrivateLayout>} />
                    <Route path="/ordenes" element={<PrivateLayout>{wrapLazy(Orders)}</PrivateLayout>} />
                    <Route path="/estadisticas" element={<PrivateLayout>{wrapLazy(Stats)}</PrivateLayout>} />
                    <Route path="/clientes" element={<PrivateLayout>{wrapLazy(ClientManager)}</PrivateLayout>} />
                    <Route path="/delivery" element={<PrivateLayout><DeliveryModuleRoute /></PrivateLayout>} />
                    <Route path="/chofer" element={<PrivateLayout chrome={false}><DriverPortalRoute /></PrivateLayout>} />
                    <Route path="/configuracion" element={<PrivateLayout>{wrapLazy(ConfiguracionPortal)}</PrivateLayout>} />
                    <Route path="/reportes-caja" element={<PrivateLayout><CashReportsRoute>{wrapLazy(CashReportsView)}</CashReportsRoute></PrivateLayout>} />
                    <Route path="/reporte-cancelaciones" element={<PrivateLayout><CancellationsRoute>{wrapLazy(CancellationsReport)}</CancellationsRoute></PrivateLayout>} />
                    <Route path="/cuentas-por-cobrar" element={<PrivateLayout><PendingAccountsRoute>{wrapLazy(CuentasPorCobrar)}</PendingAccountsRoute></PrivateLayout>} />
                    <Route path="/admin" element={<PrivateLayout><AdminRoute>{wrapLazy(AdminPanel)}</AdminRoute></PrivateLayout>} />
                    <Route path="/usuarios" element={<PrivateLayout><AdminRoute>{wrapLazy(UserManager)}</AdminRoute></PrivateLayout>} />
                    <Route path="/configuracion-dolares" element={<PrivateLayout>{wrapLazy(ExchangeRateSettings)}</PrivateLayout>} />
                    <Route path="/configuracion-impuestos" element={<PrivateLayout>{wrapLazy(TaxSettings)}</PrivateLayout>} />
                    <Route path="/configuracion-pagos" element={<PrivateLayout>{wrapLazy(PaymentMethodsSettings)}</PrivateLayout>} />
                    <Route path="/configuracion-servicios-express" element={<PrivateLayout>{wrapLazy(ServiciosExpressSettings)}</PrivateLayout>} />
                    <Route path="/precios" element={<PrivateLayout>{wrapLazy(PriceConfiguration)}</PrivateLayout>} />
                    <Route path="/configuracion-ticket" element={<PrivateLayout>{wrapLazy(TicketConfiguration)}</PrivateLayout>} />
                    <Route path="/config-emisores" element={<PrivateLayout><AdminRoute>{wrapLazy(BillingIssuers)}</AdminRoute></PrivateLayout>} />
                    <Route path="/cancelar-factura" element={<PrivateLayout><AdminRoute>{wrapLazy(InvoiceCancellation)}</AdminRoute></PrivateLayout>} />
                    <Route path="/soporte-tecnico-especializado-nexusprolavanderia" element={<PrivateLayout><AdminRoute>{wrapLazy(Maintenance)}</AdminRoute></PrivateLayout>} />

                    <Route path="*" element={
                      <div style={{ padding: "2rem", textAlign: "center" }}>
                        <h1>Error 404</h1>
                        <p>P\u00e1gina no encontrada</p>
                        <Link to="/">Volver al Inicio</Link>
                      </div>
                    } />
                  </Routes>
                </ProductProvider>
              </SettingsProvider>
            </AuthProvider>
          }
        />
      </Routes>
    </HashRouter>
  );
};
