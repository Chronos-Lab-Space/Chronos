/**
 * Loading state for a workspace surface.
 *
 * Every workspace page reads `home`, which is null both before the first load
 * resolves and when there is genuinely no workspace. Returning null for that
 * rendered nothing at all — on a slow connection the page looked like it did
 * not exist, which reads as a broken app rather than a loading one.
 *
 * Keeping the eyebrow and title identical to the loaded page means the header
 * does not move when content arrives.
 */
export function SurfaceLoading({
  eyebrow,
  title,
  /** Loaded pages use two title scales; match the one this surface uses. */
  size = "lg",
}: {
  eyebrow: string;
  title: string;
  size?: "md" | "lg";
}) {
  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
          {eyebrow}
        </div>
        <h1
          className={
            size === "lg"
              ? "mt-2 font-serif text-4xl leading-tight text-ink sm:text-5xl"
              : "mt-2 font-serif text-3xl text-ink sm:text-4xl"
          }
        >
          {title}
        </h1>
      </div>
      <p className="text-sm text-ink-dim" data-testid="surface-loading">
        Loading your workspace…
      </p>
    </div>
  );
}
