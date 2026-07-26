import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initErrorMonitoring } from "./infrastructure/monitoring/errorMonitoring";
import { ErrorBoundary } from "./presentation/components/ErrorBoundary";
import App from "./presentation/App";

void initErrorMonitoring();

// Clickjacking protection: GitHub Pages cannot send X-Frame-Options, and
// frame-ancestors is ignored in <meta> CSP — break out of hostile frames.
try {
  if (window.top !== window.self) {
    window.top?.location.replace(window.location.href);
  }
} catch {
  // Cross-origin parent denies access — hide the app instead of rendering framed.
  document.documentElement.style.display = "none";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
