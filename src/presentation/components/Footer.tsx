import { Link } from "react-router-dom";
import { ChronosCMark } from "./ChronosCMark";

export function Footer() {
  return (
    <footer className="relative border-t border-line bg-bg">
      {/* Giant wordmark */}
      <div className="relative overflow-hidden border-b border-line">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-10 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <Link
              to="/"
              className="group flex items-center gap-5 text-ink transition hover:text-chronos"
            >
              <span className="hidden sm:block"><ChronosCMark size={60} className="chronos-brand-mark" /></span>
              <span className="flex items-baseline gap-3">
                <span className="font-chronos-wordmark text-[clamp(3.5rem,14vw,13rem)]">Chronos</span>
                <span className="font-mono text-[clamp(0.6rem,1.25vw,1rem)] uppercase tracking-[0.3em] text-ink-faint">Lab</span>
              </span>
            </Link>
            <div className="max-w-xs text-[13px] leading-[1.65] text-ink-dim">
              Chronos Lab builds temporal compute infrastructure for the next
              generation of autonomous systems.
            </div>
          </div>
        </div>
      </div>

      {/* Link columns — simplified */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 py-16 md:grid-cols-4 lg:px-10">
        {/* Product */}
        <div>
          <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
            Product
          </div>
          <ul className="space-y-3 text-sm">
            <li><Link to="/core" className="text-ink-dim transition hover:text-ink">Core</Link></li>
            <li><Link to="/simulate" className="text-ink-dim transition hover:text-ink">Simulate</Link></li>
            <li><Link to="/platform" className="text-ink-dim transition hover:text-ink">Platform</Link></li>
            <li><Link to="/roadmap" className="text-ink-dim transition hover:text-ink">Roadmap</Link></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
            Company
          </div>
          <ul className="space-y-3 text-sm">
            <li><Link to="/about" className="text-ink-dim transition hover:text-ink">About</Link></li>
            <li><Link to="/contact" className="text-ink-dim transition hover:text-ink">Contact</Link></li>
            <li><a href="https://x.com/chronoslabspace" target="_blank" rel="noopener noreferrer" className="text-ink-dim transition hover:text-ink">X (Twitter)</a></li>
            <li><a href="https://t.me/+I9MN0GfvgwllZGRh" target="_blank" rel="noopener noreferrer" className="text-ink-dim transition hover:text-ink">Telegram</a></li>
          </ul>
        </div>

        {/* Resources */}
        <div>
          <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
            Resources
          </div>
          <ul className="space-y-3 text-sm">
            <li><Link to="/docs" className="text-ink-dim transition hover:text-ink">Docs</Link></li>
            <li><Link to="/changelog" className="text-ink-dim transition hover:text-ink">Changelog</Link></li>
            <li><Link to="/security" className="text-ink-dim transition hover:text-ink">Security</Link></li>
            <li><Link to="/contact" className="text-ink-dim transition hover:text-ink">Support</Link></li>
          </ul>
        </div>

        {/* Legal */}
        <div>
          <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.25em] text-ink-faint">
            Legal
          </div>
          <ul className="space-y-3 text-sm">
            <li><Link to="/privacy" className="text-ink-dim transition hover:text-ink">Privacy</Link></li>
            <li><Link to="/terms" className="text-ink-dim transition hover:text-ink">Terms</Link></li>
            <li><Link to="/security" className="text-ink-dim transition hover:text-ink">Security</Link></li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-faint lg:px-10">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span>© 2026 Chronos Lab AG</span>
            <span className="hidden h-3 w-px bg-line sm:inline-block" />
            <Link to="/privacy" className="hover:text-ink-dim">Privacy</Link>
            <Link to="/terms" className="hover:text-ink-dim">Terms</Link>
          </div>

          <div className="flex items-center gap-5">
            <a
              href="https://x.com/chronoslabspace"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="transition hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://github.com/Chronos-Lab-Space"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="transition hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .5C5.73.5.67 5.56.67 11.83c0 4.98 3.23 9.2 7.71 10.69.57.1.78-.25.78-.55 0-.27-.01-.98-.02-1.93-3.13.68-3.79-1.51-3.79-1.51-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.11 1.16.9-.25 1.87-.38 2.83-.38.96 0 1.93.13 2.83.38 2.16-1.46 3.11-1.16 3.11-1.16.61 1.55.23 2.69.11 2.98.72.79 1.16 1.8 1.16 3.03 0 4.33-2.64 5.28-5.15 5.56.4.35.76 1.03.76 2.08 0 1.5-.01 2.71-.01 3.08 0 .3.21.66.79.55 4.48-1.49 7.7-5.71 7.7-10.69C23.33 5.56 18.27.5 12 .5z" />
              </svg>
            </a>
            <a
              href="https://t.me/+I9MN0GfvgwllZGRh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="transition hover:text-ink"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
