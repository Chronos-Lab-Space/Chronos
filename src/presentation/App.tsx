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
const FaqPage = lazy(async () => ({
  default: (await import("./components/Faq")).FaqPage,
}));

const WorkspaceShell = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceShell")).WorkspaceShell,
}));
const DashboardPage = lazy(async () => ({
  default: (await import("./features/dashboard/DashboardPage")).DashboardPage,
}));
const KnowledgePage = lazy(async () => ({
  default: (await import("./features/knowledge/KnowledgePages")).KnowledgePage,
}));
const NotesPage = lazy(async () => ({
  default: (await import("./features/knowledge/KnowledgePages")).NotesPage,
}));
const SimulationsPage = lazy(async () => ({
  default: (await import("./features/simulation/SimulationPages")).SimulationsPage,
}));
const SimulationDetailPage = lazy(async () => ({
  default: (await import("./features/simulation/SimulationPages")).SimulationDetailPage,
}));
const WorkspaceSettingsPage = lazy(async () => ({
  default: (await import("./features/workspace/WorkspaceSettingsPage")).WorkspaceSettingsPage,
}));
const TimelinePage = lazy(async () => ({
  default: (await import("./features/timeline/TimelinePage")).TimelinePage,
}));
const MemoryPage = lazy(async () => ({
  default: (await import("./features/memory/MemoryPages")).MemoryPage,
}));
const ComparePage = lazy(async () => ({
  default: (await import("./features/memory/MemoryPages")).ComparePage,
}));
const GrokAdvisorPage = lazy(async () => ({
  default: (await import("./features/workspace/GrokAdvisorPage")).GrokAdvisorPage,
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
          <Route index element={lazyRoute(<DashboardPage />)} />
          <Route path="knowledge" element={lazyRoute(<KnowledgePage />)} />
          <Route path="simulations" element={lazyRoute(<SimulationsPage />)} />
          <Route path="simulations/:simulationId" element={lazyRoute(<SimulationDetailPage />)} />
          <Route path="timeline" element={lazyRoute(<TimelinePage />)} />
          <Route path="settings" element={lazyRoute(<WorkspaceSettingsPage />)} />
          {/* Hidden from primary nav — deep links still work */}
          <Route path="notes" element={lazyRoute(<NotesPage />)} />
          <Route path="memory" element={lazyRoute(<MemoryPage />)} />
          <Route path="memory/compare" element={lazyRoute(<ComparePage />)} />
          <Route path="advisor" element={lazyRoute(<GrokAdvisorPage />)} />
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
          <Route path="/faq" element={lazyRoute(<FaqPage />)} />
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
