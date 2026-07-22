import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { initErrorMonitoring } from "./infrastructure/monitoring/errorMonitoring";
import { ErrorBoundary } from "./presentation/components/ErrorBoundary";
import App from "./presentation/App";

void initErrorMonitoring();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
