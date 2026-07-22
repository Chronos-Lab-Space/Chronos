import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Nav } from "./Nav";
import { Footer } from "./Footer";
import { StarField } from "./StarField";
import { AccessModalProvider } from "../features/access/AccessModal";

export function Layout() {
  const { pathname } = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-bg text-ink">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <StarField />
        <div className="absolute left-1/2 top-[-20%] h-[700px] w-[1000px] -translate-x-1/2 rounded-full bg-[#1C3E4E] opacity-45 blur-[120px]" />
        <div className="absolute right-[-10%] bottom-[20%] h-[500px] w-[500px] rounded-full bg-[#60899B] opacity-15 blur-[120px]" />
      </div>

      <AccessModalProvider>
        <div className="relative z-10">
          <Nav />
          <div key={pathname} className="page-enter">
            <Outlet />
          </div>
          <Footer />
        </div>
      </AccessModalProvider>
    </div>
  );
}
