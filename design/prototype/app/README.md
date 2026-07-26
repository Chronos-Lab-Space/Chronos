# Chronos Workspace

Implementation of the `Chronos Workspace.dc.html` design from the Claude Design
handoff bundle in `../project`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

Fonts (Inter, Instrument Serif, JetBrains Mono, Cormorant Garamond) load from
Google Fonts, so the first run needs network access.

## Structure

| Path | What's in it |
| --- | --- |
| `src/index.css` | Brand tokens as Tailwind v4 `@theme` variables — colors, type stacks, the `chpulse` keyframe |
| `src/workspace/` | The shell: header, sidebar, stepper band, context panel, ⌘K palette, shared state |
| `src/screens/` | Decision, Simulation (+ `FutureGraph`), Timeline, Memory, Knowledge |
| `src/data/` | All prototype copy and numbers, kept out of the components |
| `src/ui/` | `Eyebrow`, `Screen`, pill-button classes, `cx` |

## State

Screen selection lives in the URL (`/decision`, `/knowledge`, `/simulation`,
`/timeline`, `/memory`; anything else redirects to `/decision`). Everything else
— the decision's state index, the selected future, the context tab, and the
overlays — lives in `WorkspaceProvider` and is in-memory only, as in the
prototype. There is no backend.

## Design tokens

| Token | Value | Used for |
| --- | --- | --- |
| `void` | `#111111` | Page and panel background |
| `paper` | `#F2EDEA` | Primary ink |
| `sand` | `#C4C2AA` | Secondary ink, body copy |
| `muted` / `faint` | `#989898` / 75% of it | Labels, metadata |
| `chronos` | `#60899B` | Accent: recommendation, current step, graph, numbers |
| `field*` | `#2A4D5F` at 16–55% | Panel tints |
| `line*` | `#F2EDEA` at 8/12/20/30% | Rules and borders |

## Notes

- `npm audit` reports a high-severity advisory against `react-router` for its
  RSC mode. This app is a client-only SPA with no RSC or server actions, so the
  affected path isn't reachable; the only listed remedy today is a downgrade to
  7.11.0.
