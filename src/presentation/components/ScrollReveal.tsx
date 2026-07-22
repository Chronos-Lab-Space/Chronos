import { useEffect, useRef, useState, type ReactNode } from "react";

export type ScrollRevealVariant = "up" | "fade" | "scale" | "left" | "right";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Delay in ms before the transition runs once visible. */
  delay?: number;
  /** Entrance style. Default: fade + slight rise. */
  variant?: ScrollRevealVariant;
  /**
   * When true, direct children stagger in after the container is visible
   * (CSS nth-child delays). Use on grids/lists for cascade motion.
   */
  stagger?: boolean;
  /** Intersection threshold (0–1). Default 0.1. */
  threshold?: number;
};

const variantClass: Record<ScrollRevealVariant, string> = {
  up: "scroll-reveal-up",
  fade: "scroll-reveal-fade",
  scale: "scroll-reveal-scale",
  left: "scroll-reveal-left",
  right: "scroll-reveal-right",
};

/**
 * Quiet scroll reveal — presence and hierarchy, not decorative noise.
 * Respects prefers-reduced-motion via CSS.
 */
export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  variant = "up",
  stagger = false,
  threshold = 0.1,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={[
        "scroll-reveal",
        variantClass[variant],
        stagger ? "scroll-reveal-stagger" : "",
        visible ? "scroll-reveal-visible" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
