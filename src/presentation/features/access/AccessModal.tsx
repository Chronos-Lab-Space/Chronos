import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { RequestAccessForm } from "./RequestAccessForm";

type AccessModalContextValue = {
  openAccessModal: () => void;
  closeAccessModal: () => void;
};

const AccessModalContext = createContext<AccessModalContextValue | null>(null);

export function useAccessModal() {
  const context = useContext(AccessModalContext);
  if (!context) {
    throw new Error("useAccessModal must be used inside AccessModalProvider.");
  }
  return context;
}

/** One access gate for the site: request intent always opens a focused modal. */
export function AccessModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <AccessModalContext.Provider
      value={{ openAccessModal: () => setOpen(true), closeAccessModal: () => setOpen(false) }}
    >
      {children}
      {open && <AccessModal onClose={() => setOpen(false)} />}
    </AccessModalContext.Provider>
  );
}

function AccessModal({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-start sm:items-center justify-center overflow-y-auto p-4 pt-8 pb-8tify-center overflow-y-auto p-4 pt-8 pb-8tify-center overflow-y-auto p-4 pt-8 pb-8 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="access-modal-title"
    >
      <button
        type="button"
        aria-label="Close request access"
        className="absolute inset-0 cursor-default bg-[#111111]/85 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        className={`relative z-10 w-full max-w-2xl rounded-2xl border border-line bg-bg-soft shadow-2xl transition-all duration-300 ${
          visible ? "translate-y-0 scale-100" : "translate-y-5 scale-[0.98]"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-dim transition hover:border-line-strong hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px w-8 bg-chronos/60" />
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-chronos">
              Cohort 04 · workspace access
            </span>
            <div className="h-px w-8 bg-chronos/60" />
          </div>
          <h2 id="access-modal-title" className="font-serif text-3xl leading-[1] text-ink sm:text-4xl">
            Tell us what you are building<span className="text-ink-faint">.</span>
          </h2>
          <p className="mt-3 max-w-xl text-[14px] leading-[1.7] text-ink-dim">
            Chronos workspaces are provisioned around real temporal decision workloads. This context helps us shape the right capabilities, simulation budget, and support.
          </p>
          <div className="mt-6">
            <RequestAccessForm source="access-modal" />
          </div>
        </div>
      </div>
    </div>
  );
}