import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./components/HomePage";
import { ProtectedRoute } from "./components/ProtectedRoute";

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
const Dashboard = lazy(async () => ({ default: (await import("./components/Dashboard")).Dashboard }));
const Docs = lazy(async () => ({ default: (await import("./components/Docs")).Docs }));
const ChangelogPage = lazy(async () => ({
  default: (await import("./components/Changelog")).ChangelogPage,
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

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/core" element={lazyRoute(<CorePage />)} />
          <Route path="/dashboard" element={lazyRoute(<ProtectedRoute><Dashboard /></ProtectedRoute>)} />
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
    </HashRouter>
  );
}

export default App;
