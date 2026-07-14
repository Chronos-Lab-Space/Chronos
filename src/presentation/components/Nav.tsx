import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChronosCMark } from "./ChronosCMark";
import { useAccessModal } from "../features/access/AccessModal";

export function Nav() {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { openAccessModal } = useAccessModal();

  const links = [
    { label: "Core", to: "/core" },
    { label: "Simulate", to: "/simulate" },
    { label: "Platform", to: "/platform" },
    { label: "Roadmap", to: "/roadmap" },
    { label: "About", to: "/about" },
  ];

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-10">
        {/* Signature wordmark + independent C mark. */}
        <Link to="/" className="group flex items-center gap-2.5 text-ink transition hover:text-chronos">
          <ChronosCMark size={27} className="chronos-brand-mark shrink-0" />
          <span className="flex items-baseline gap-1.5">
            <span className="font-chronos-wordmark text-[25px] sm:text-[27px]">Chronos</span>
            <span className="font-mono text-[8px] uppercase tracking-[0.28em] text-ink-faint">Lab</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
              <Link
                key={l.label}
                to={l.to}
                className={`group relative text-[13px] font-medium transition ${
                  active ? "text-ink" : "text-ink-dim hover:text-ink"
                }`}
              >
                {l.label}
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-chronos transition-all duration-300 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-dim transition hover:border-line-strong hover:text-ink md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={openAccessModal}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-bg transition hover:bg-chronos"
          >
            <span className="hidden sm:inline">Request access</span>
            <span className="sm:hidden">Access</span>
            <svg width="12" height="12" viewBox="0 0 12 12" className="transition group-hover:translate-x-0.5">
              <path
                d="M2 6h8M6 2l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="border-t border-line bg-bg-soft md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-4">
            {links.map((l) => {
              const active = pathname === l.to;
              return (
                <Link
                  key={l.label}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2.5 text-[14px] font-medium transition ${
                    active
                      ? "bg-chronos/10 text-chronos"
                      : "text-ink-dim hover:bg-bg hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

