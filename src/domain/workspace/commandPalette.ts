import type { WorkspaceHome } from "./types";

/**
 * ⌘K command palette — pure command descriptors for the workspace shell.
 * Commands are derived from real workspace state (e.g. "review recommendation"
 * only exists once a completed run does); the component layer maps hrefs to
 * navigation. Keeps the palette testable without React.
 */

export type PaletteCommand = {
  id: string;
  kind: "GO" | "RUN" | "ASK";
  label: string;
  hint: string;
  href: string;
};

export function buildPaletteCommands(home: WorkspaceHome | null): PaletteCommand[] {
  const report = home?.recentSimulations.find((s) => s.status === "completed") ?? null;
  const sources = (home?.knowledge.length ?? 0) + (home?.notes.length ?? 0);
  const runs = home?.recentSimulations.length ?? 0;

  const commands: PaletteCommand[] = [
    {
      id: "brief",
      kind: "GO",
      label: "current decision",
      hint: "Decision Brief",
      href: "/workspace",
    },
    {
      id: "simulate",
      kind: "RUN",
      label: "run simulation",
      hint: "Generate ranked futures",
      href: "/workspace/simulations?new=1",
    },
  ];

  if (report) {
    commands.push(
      {
        id: "review",
        kind: "GO",
        label: "review recommendation",
        hint: report.title,
        href: `/workspace/simulations/${report.id}`,
      },
      {
        id: "outcome",
        kind: "RUN",
        label: "log outcome",
        hint: "Record what actually happened",
        href: `/workspace/simulations/${report.id}`,
      }
    );
  }

  commands.push(
    {
      id: "knowledge",
      kind: "GO",
      label: "open knowledge",
      hint: sources === 1 ? "1 source" : `${sources} sources`,
      href: "/workspace/knowledge",
    },
    {
      id: "simulations",
      kind: "GO",
      label: "show simulations",
      hint: runs === 1 ? "1 run" : `${runs} runs`,
      href: "/workspace/simulations",
    },
    {
      id: "timeline",
      kind: "GO",
      label: "show timeline",
      hint: "Decision history",
      href: "/workspace/timeline",
    },
    {
      id: "memory",
      kind: "GO",
      label: "show memory",
      hint: "Past outcomes",
      href: "/workspace/memory",
    },
    { id: "hq", kind: "GO", label: "workspace hq", hint: "Dashboard", href: "/workspace/hq" },
    {
      id: "settings",
      kind: "GO",
      label: "open settings",
      hint: "Workspaces & account",
      href: "/workspace/settings",
    }
  );

  return commands;
}

export function filterPaletteCommands(
  commands: readonly PaletteCommand[],
  query: string
): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  return commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q));
}

/** Fallback row when nothing matches: ask the knowledge base instead. */
export function knowledgeSearchCommand(query: string): PaletteCommand {
  const q = query.trim();
  return {
    id: "ask",
    kind: "ASK",
    label: `search knowledge for “${q}”`,
    hint: "Ask Chronos",
    href: `/workspace/knowledge?q=${encodeURIComponent(q)}`,
  };
}
