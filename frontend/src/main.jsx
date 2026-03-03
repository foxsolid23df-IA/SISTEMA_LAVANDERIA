import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.jsx";

// Silenciar errores de "AbortError" globales (promesas no manejadas por Supabase)
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.name === "AbortError" ||
    event.reason?.message?.includes("aborted")
  ) {
    event.preventDefault(); // Evita que aparezca en la consola roja
    // console.debug('Global AbortError suppressed', event.reason);
  }
});

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions (poner 0.1 en prod grande)
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
