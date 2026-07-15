import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Routes, Route, useNavigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./components/HomePage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";

// Route-level code splitting: the marketing shell ships first; large product,
// documentation, and legal page compositions load only after navigation.
const CorePage = lazy(async () => ({ default: (await import("./pages")).CorePage }));
const SimulatePage = lazy(async () => ({ default: (await import("./pages")).SimulatePage }));
const PlaygroundPage = lazy(async () => ({ default: (await import("./pages")).PlaygroundPage }));
const PlatformPage = lazy(async () => ({ default: (await import("./pages")).PlatformPage }));
const PrimitivesPage = lazy(async () => ({ default: (await import("./pages")).PrimitivesPage }));
const JourneyPage = lazy(async () => ({ default: (await import("./pages")).JourneyPage }));
const RuntimePage = lazy(async () => ({ default: (await import("./pages")).RuntimePage }));
const DevelopersPage = lazy(async () => ({ default: (await import("./pages")).DevelopersPage }));
const MetricsPage = lazy(async () => ({ default: (await import("./pages")).MetricsPage }));
const RoadmapPage = lazy(async () => ({ default: (await import("./pages")).RoadmapPage }));
const IntelligencePage = lazy(async () => ({ default: (await import("./pages")).IntelligencePage }));
const ShiftPage = lazy(async () => ({ default: (await import("./pages")).ShiftPage }));
const AboutPage = lazy(async () => ({ default: (await import("./pages")).AboutPage }));
const ContactPage = lazy(async () => ({ default: (await import("./pages")).ContactPage }));
const PrivacyPage = lazy(async () => ({ default: (await import("./pages")).PrivacyPage }));
const TermsPage = lazy(async () => ({ default: (await import("./pages")).TermsPage }));
const SecurityPage = lazy(async () => ({ default: (await import("./pages")).SecurityPage }));
const AccessPage = lazy(async () => ({ default: (await import("./pages")).AccessPage }));
const Docs = lazy(async () => ({ default: (await import("./components/Docs")).Docs }));
const ChangelogPage = lazy(async () => ({
  default: (await import("./components/Changelog")).ChangelogPage,
}));

const WorkspaceShell = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceShell")).WorkspaceShell,
}));
const WorkspaceDashboard = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceDashboard")).WorkspaceDashboard,
}));
const WorkspaceKnowledgePage = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceSubpages")).WorkspaceKnowledgePage,
}));
const WorkspaceSimulationsPage = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceSubpages")).WorkspaceSimulationsPage,
}));
const WorkspaceSimulationDetailPage = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceSubpages")).WorkspaceSimulationDetailPage,
}));
const WorkspaceNotesPage = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceSubpages")).WorkspaceNotesPage,
}));
const WorkspaceSettingsPage = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceSubpages")).WorkspaceSettingsPage,
}));

function RouteFallback() {
  return (
    <div className="flex min-h-[45vh] items-center justify-center bg-bg">
      <div className="text-center">
        <div className="mx-auto h-6 w-6 rounded-full border border-chronos border-t-transparent animate-spin" />
        <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-ink-faint">
          Loading Chronos
        </div>
      </div>
    </div>
  );
}

function lazyRoute(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

/**
 * Migrates legacy HashRouter URLs (`/#/dashboard`) to path URLs (`/dashboard`).
 * Leaves auth fragments (`#access_token=...`) alone for Supabase to consume.
 */
function LegacyHashRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const { hash } = window.location;
    if (!hash.startsWith("#/")) return;
    // Do not rewrite auth token fragments that happen to include a slash.
    if (hash.includes("access_token=") || hash.includes("refresh_token=")) return;

    const path = hash.slice(1) || "/";
    window.history.replaceState(null, "", `${path}${window.location.search}`);
    navigate(path, { replace: true });
  }, [navigate]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
      <LegacyHashRedirect />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Authenticated product: Workspace is the foundation */}
        <Route
          path="/workspace"
          element={lazyRoute(
            <ProtectedRoute>
              <WorkspaceShell />
            </ProtectedRoute>
          )}
        >
          <Route index element={lazyRoute(<WorkspaceDashboard />)} />
          <Route path="knowledge" element={lazyRoute(<WorkspaceKnowledgePage />)} />
          <Route path="simulations" element={lazyRoute(<WorkspaceSimulationsPage />)} />
          <Route path="simulations/:simulationId" element={lazyRoute(<WorkspaceSimulationDetailPage />)} />
          <Route path="notes" element={lazyRoute(<WorkspaceNotesPage />)} />
          <Route path="settings" element={lazyRoute(<WorkspaceSettingsPage />)} />
        </Route>

        {/* Legacy dashboard entry → workspace home */}
        <Route path="/dashboard" element={<Navigate to="/workspace" replace />} />

        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/core" element={lazyRoute(<CorePage />)} />
          <Route path="/simulate" element={lazyRoute(<SimulatePage />)} />
          <Route path="/playground" element={lazyRoute(<PlaygroundPage />)} />
          <Route path="/platform" element={lazyRoute(<PlatformPage />)} />
          <Route path="/primitives" element={lazyRoute(<PrimitivesPage />)} />
          <Route path="/journey" element={lazyRoute(<JourneyPage />)} />
          <Route path="/runtime" element={lazyRoute(<RuntimePage />)} />
          <Route path="/developers" element={lazyRoute(<DevelopersPage />)} />
          <Route path="/metrics" element={lazyRoute(<MetricsPage />)} />
          <Route path="/roadmap" element={lazyRoute(<RoadmapPage />)} />
          <Route path="/intelligence" element={lazyRoute(<IntelligencePage />)} />
          <Route path="/shift" element={lazyRoute(<ShiftPage />)} />
          <Route path="/about" element={lazyRoute(<AboutPage />)} />
          <Route path="/docs" element={lazyRoute(<Docs />)} />
          <Route path="/changelog" element={lazyRoute(<ChangelogPage />)} />
          <Route path="/contact" element={lazyRoute(<ContactPage />)} />
          <Route path="/privacy" element={lazyRoute(<PrivacyPage />)} />
          <Route path="/terms" element={lazyRoute(<TermsPage />)} />
          <Route path="/security" element={lazyRoute(<SecurityPage />)} />
          <Route path="/access" element={lazyRoute(<AccessPage />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
