import { PageHeader } from "./PageHeader";
import { ScrollReveal } from "./ScrollReveal";

export type Release = {
  version: string;
  date: string;
  tag: "major" | "minor" | "patch";
  title: string;
  summary: string;
  highlights: { label: string; detail: string }[];
};

/**
 * Newest first. This array is the only version the product shows anyone —
 * package.json is not read at runtime — so `changelog.test.ts` pins the two
 * together. They had drifted four releases apart before that test existed.
 */
export const releases: Release[] = [
  {
    version: "5.12.0",
    date: "2026-08-02",
    tag: "minor",
    title: "Confidence numbers now carry what they have been worth",
    summary:
      "When a confidence band has enough followed, verdicted runs, the Decision Report and simulation detail show that band's historical hit rate next to the claimed number — without changing the engine's confidence. Too little data still means silence, not an invented rate. Full calibration stays on Memory.",
    highlights: [
      {
        label: "caveatForConfidence",
        detail:
          "Pure lookup: band for claimed confidence → rate only when n ≥ CALIBRATION_MIN_SAMPLE",
      },
      {
        label: "ConfidenceCaveatNote",
        detail: "On Decision Report + sim detail; links to /workspace/memory for the full panel",
      },
      {
        label: "Engine untouched",
        detail: "Ranking, scores, and the displayed confidence value stay engine-owned",
      },
    ],
  },
  {
    version: "5.11.0",
    date: "2026-08-01",
    tag: "minor",
    title: "One field replaces the onboarding wizard",
    summary:
      'A new visitor used to answer four screens — welcome, name, goal, context — before seeing a result. WorkspaceStart now asks one thing: what are you deciding? Workspace creation, the decision, and the first simulation run all happen behind that single submit, landing straight on a ranked result. The context ask is not gone: it moves to after a result exists, where a source is motivated by a recommendation just read, reusing the existing note fields. It now asks once per decision rather than once ever — a single "Not now" used to silence it permanently, on every future decision, the first time it appeared. The demo sample decision, reachable only through a window the wizard\'s separate goal step opened, is retired along with it.',
    highlights: [
      {
        label: "One-step entry",
        detail: "WorkspaceStart: one field, one submit → workspace, decision, and first run",
      },
      {
        label: "Context, once per decision",
        detail:
          "contextPromptDismissedFor tracks decisions already answered; a legacy blanket dismissal is honoured for everything that existed when it was made, then expanded and retired — not carried forward forever",
      },
      {
        label: "Sample retired",
        detail:
          "seedSampleDecision deleted with the wizard step that was its only reachable window",
      },
    ],
  },
  {
    version: "5.10.0",
    date: "2026-07-31",
    tag: "minor",
    title: "Chronos now shows what its confidence has been worth",
    summary:
      'Every collapsed run stored a confidence, and every logged outcome stored a verdict on how it landed. The two had never been compared, which made the confidence number decoration. Memory now opens with a calibration panel: each confidence band is drawn as the interval Chronos claimed, with a dot where those runs actually landed. Only runs you followed and gave a verdict are scored — a path you did not take measured a different world, so it is excluded rather than counted as a miss, and silence is never read as "as expected". A band under five runs reports no rate at all. This measures agreement with your own recollection, not independent accuracy, and the panel says so.',
    highlights: [
      {
        label: "Calibration panel",
        detail:
          "deriveCalibration → bands, denominators, per-decision movement, on /workspace/memory",
      },
      {
        label: "Honest denominators",
        detail: "Not-followed runs excluded and counted separately; no rate without its n",
      },
      {
        label: "Withheld under five runs",
        detail:
          "A rate over two runs is noise, so the band reports none rather than a precise number",
      },
      {
        label: "Report, never an input",
        detail: "Nothing reaches the engine — ranking, scoring and confidence are byte-identical",
      },
    ],
  },
  {
    version: "5.9.1",
    date: "2026-07-31",
    tag: "patch",
    title: "The written recommendation reaches the report card",
    summary:
      "The Decision Report — the page you land on after a run — had a Recommendation section that showed the chosen path's name and a deterministic template summary, and no prose at all. Both recommendation and recommendation_body were written on every run and read only by the workspace home. The report card now leads with the written recommendation, and multi-paragraph bodies render as paragraphs instead of collapsing into one block.",
    highlights: [
      {
        label: "Report card",
        detail: "DecisionReport.narrative: headline then body, chosen path summary as the floor",
      },
      {
        label: "Paragraphs",
        detail: "toParagraphs splits on blank lines; a single <p> was collapsing them to spaces",
      },
      {
        label: "Fail-open",
        detail: "Empty rather than invented when a run produced no prose",
      },
    ],
  },
  {
    version: "5.9.0",
    date: "2026-07-31",
    tag: "minor",
    title: "Decisions are first-class objects",
    summary:
      "The decisions table, its RLS policies and simulations.decision_id shipped in July and were then never written to, while the docs described them as done. A decision is now the question and a simulation is one attempt at answering it: re-running adds a version rather than opening a second decision. New /workspace/decisions registry lists questions with their runs underneath. Status is derived from the versions on every read, never stored.",
    highlights: [
      {
        label: "Keyed on lineage",
        detail:
          "A decision's id is its lineage_id, so the SQL backfill and the client agree without coordinating and two offline devices converge on one decision",
      },
      {
        label: "Backfill",
        detail:
          "Idempotent migration links existing runs; anonymous visitors get the same grouping locally, with nothing written to Supabase",
      },
      {
        label: "Registry",
        detail:
          "/workspace/decisions — questions with versions underneath, status open · decided · executed",
      },
    ],
  },
  {
    version: "5.8.8",
    date: "2026-07-31",
    tag: "patch",
    title: "Brief bodies the model writes · publishable keys that can take over",
    summary:
      "AI enrichment now writes a short body under the recommendation headline, given the runners-up and their scores to compare against rather than one templated sentence to paraphrase. Separately, the Supabase client preferred the legacy anon key over the publishable key despite a comment claiming the opposite — which broke rotation exactly when both keys are set, silently.",
    highlights: [
      {
        label: "Brief body",
        detail: "Two blocks: the call, then why it beats the alternatives, its cost, next action",
      },
      {
        label: "Key rotation",
        detail:
          "resolvePublicKey prefers VITE_SUPABASE_PUBLISHABLE_KEY; deploy workflow passes the secret through",
      },
      {
        label: "Ranking",
        detail: "Untouched — enrichment still only rewrites prose after a deterministic collapse",
      },
    ],
  },
  {
    version: "5.8.7",
    date: "2026-07-31",
    tag: "patch",
    title: "Dual-write sends only what changed · dropped runs really are deleted",
    summary:
      "Every persist re-sent the whole workspace snapshot, so adding a note rewrote every simulation, future and timeline node — roughly 44,000 row updates to maintain about 600 rows. Saves now diff per collection and send only what moved, which is safe because the save RPC never deletes. Separately, dropping a simulation locally left the cloud copy behind, so a pruned sample came back on the next visit.",
    highlights: [
      {
        label: "Incremental save",
        detail: "Per-collection fingerprint; snapshot updated only after the write lands",
      },
      {
        label: "Real deletes",
        detail:
          "deleteSimulations for deliberate removals; retention trimming still never deletes from the cloud",
      },
    ],
  },
  {
    version: "5.8.6",
    date: "2026-07-30",
    tag: "patch",
    title: "Composition roots for the engine and the workspace loop",
    summary:
      "SimulationEngine and WorkspaceService built their own adapters, which made them impossible to test without the environment they run in. Both now take every dependency as a constructor argument, and a new src/composition layer supplies them. Registering product event subscribers is an explicit call rather than an import side effect.",
    highlights: [
      {
        label: "Injection",
        detail: "AI port, enrichment gate, local/cloud stores and learning memory all passed in",
      },
      {
        label: "No import side effects",
        detail: "registerProductEventSubscribers() runs in composition, not on module load",
      },
    ],
  },
  {
    version: "5.8.5",
    date: "2026-07-30",
    tag: "patch",
    title: "AI runs through the proxy in production, and surfaces its own failures",
    summary:
      "The Pages build now routes AI through the ai-generate Edge Function, which holds the upstream key server-side and enforces per-user and global monthly caps. Proxy failures used to fail open in total silence; they are now reported with the stage that failed and the HTTP status, so a misconfigured upstream is visible instead of just quietly producing deterministic prose. Docs that claimed the product path never calls a model were corrected.",
    highlights: [
      {
        label: "Proxy",
        detail: "VITE_AI_PROVIDER=proxy; upstream, model and caps are Supabase secrets",
      },
      {
        label: "Visibility",
        detail: "ProxyFailure {stage, status, message} routed to Sentry by severity",
      },
      {
        label: "Honesty",
        detail:
          "Docs corrected: workspace enrichment does call a model; /simulate and the scenario demos still do not",
      },
    ],
  },
  {
    version: "5.8.4",
    date: "2026-07-30",
    tag: "patch",
    title: "Objectives the catalog cannot model are refused, not dressed up",
    summary:
      "The scenario catalog covers startup and business decisions. An out-of-domain objective used to be ranked anyway, against go-to-market archetypes that could not possibly fit it. The run form now flags it while you type and refuses to submit, rather than returning a confident answer to a question the engine never modelled.",
    highlights: [
      {
        label: "Scope check",
        detail: "assessObjectiveScope runs live on the objective field, not on a rejected submit",
      },
      {
        label: "Honest refusal",
        detail: "Says what Chronos does model and asks for a rephrase",
      },
    ],
  },
  {
    version: "5.8.3",
    date: "2026-07-28",
    tag: "patch",
    title: "Sentry Vite plugin for production source maps",
    summary:
      "Production builds can upload hidden source maps to Sentry via @sentry/vite-plugin when SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT are set. Maps are deleted after upload so GitHub Pages never serves them. Client init tags events with VITE_SENTRY_RELEASE (CI: git SHA). Without those secrets the build still succeeds offline.",
    highlights: [
      {
        label: "Plugin",
        detail: "@sentry/vite-plugin gated on auth token + org + project",
      },
      {
        label: "CI",
        detail: "Deploy workflow wires SENTRY_* secrets and VITE_SENTRY_RELEASE=github.sha",
      },
      {
        label: "Safety",
        detail: "No maps when unconfigured; filesToDeleteAfterUpload on dist/**/*.map",
      },
    ],
  },
  {
    version: "5.8.2",
    date: "2026-07-28",
    tag: "patch",
    title: "Decision graph polish: compare · Memory stamps · collapse",
    summary:
      "The graph panel now side-by-sides branches with score bars, rank, and deltas vs best. Choosing a path stamps graph_shape collapsed. Memory decision history and simulation lineages show Open → N branches → collapsed structure lines so the graph survives after you leave the sim page.",
    highlights: [
      {
        label: "Compare",
        detail: "Branch cards: rank, summary, score bar, score/risk delta vs recommended",
      },
      {
        label: "Collapse stamp",
        detail: "chooseBestPath sets graph_shape collapsed + N2 active node",
      },
      {
        label: "Memory",
        detail: "graphSummary on decision history + lineage cards; E2E covers panel + collapse",
      },
    ],
  },
  {
    version: "5.8.1",
    date: "2026-07-28",
    tag: "patch",
    title: "Honest agents: live capability registry · docs match the code",
    summary:
      "The Agent OS now ships a real default capability registry (research, simulation, evaluation, memory, plan/roadmap stubs) and can run planner task graphs end-to-end. Research uses AIPort when configured and fails open to a structured stub. Docs, FAQ, README, and ARCHITECTURE now state plainly: public simulate and ranking are deterministic; LLM is optional prose only; Forge/Oracle/Atlas are scripted demos.",
    highlights: [
      {
        label: "Registry",
        detail:
          "createDefaultCapabilityRegistry + runTaskGraph wire specialist agents as TaskKind handlers",
      },
      {
        label: "Research",
        detail:
          "Optional AI summary via AIPort; noop/errors → source: stub (same fail-open contract as sim enrich)",
      },
      {
        label: "Honesty",
        detail:
          "ARCHITECTURE implementation status table; FAQ + beta limitations; no more implied LLM scoring on /simulate",
      },
    ],
  },
  {
    version: "5.8.0",
    date: "2026-07-27",
    tag: "minor",
    title: "Decision graph MVP: open → branches → collapse · re-branch",
    summary:
      "Chronos is a decision graph, not a smarter loop. One open decision point, peer branches (futures), compare outcomes, collapse to a chosen path, and re-branch from open without losing prior branches in Memory. Inside a node may still loop; the product is the branch structure.",
    highlights: [
      {
        label: "Contract",
        detail:
          "domain/decisionGraph — N0 open, N1* branches, N2 collapsed; compareBranches; rollbackToOpen; rebranchIntent",
      },
      {
        label: "Re-branch",
        detail:
          "rebranchFromOpen forks the next lineage version from the open node (graph rollback that keeps history)",
      },
      {
        label: "UI",
        detail:
          "DecisionGraphPanel on simulation detail — structure, compare outcomes, re-branch action",
      },
    ],
  },
  {
    version: "5.7.0",
    date: "2026-07-26",
    tag: "minor",
    title: "Open-weights models, same proxy",
    summary:
      "The hosted provider added a second upstream: any OpenAI-compatible endpoint, which covers essentially every open-weights host and anything self-hosted. Several are free, so running Chronos with a hosted model no longer implies a per-call bill. Picking one is two secrets, not a code change, and the browser still cannot see or influence which model answers.",
    highlights: [
      {
        label: "One wire format",
        detail:
          "Groq, Together, OpenRouter, Cerebras, Hugging Face, or your own vLLM / llama.cpp / Ollama server — set a base URL and a model",
      },
      {
        label: "Reasoning traces stripped",
        detail:
          "Open reasoning models emit their scratchpad inline; it is removed rather than shown as the recommendation",
      },
      {
        label: "Honest naming",
        detail:
          'The provider is now "proxy" rather than "anthropic", since the browser cannot know which vendor answers · the old value still works',
      },
    ],
  },
  {
    version: "5.6.0",
    date: "2026-07-26",
    tag: "minor",
    title: "Hosted AI behind a key proxy",
    summary:
      "Chronos can now polish a recommendation with a hosted model instead of only a local one. Because the app is a static bundle, an API key placed in it would be published, so the key lives as a server-side secret and the browser only ever sends its own session token. The provider is off by default: unset, simulations behave exactly as before, and every score, future, and confidence value stays deterministic.",
    highlights: [
      {
        label: "Key stays server-side",
        detail:
          "A new Supabase Edge Function holds the Anthropic key · the browser sends its Supabase session, never a vendor key",
      },
      {
        label: "Metered by design",
        detail:
          "Per-user rate limit, per-user monthly cap, and a global kill switch are checked before any paid call · every call is logged to a ledger you can read",
      },
      {
        label: "Fails open",
        detail:
          "No session, a refusal, a timeout, or a spent quota all fall back to the deterministic recommendation rather than an error",
      },
      {
        label: "Opt-in",
        detail: "Prose only, and only when explicitly enabled · scores and futures never change",
      },
    ],
  },
  {
    version: "5.5.0",
    date: "2026-07-26",
    tag: "minor",
    title: "Outcomes close the loop",
    summary:
      'Logging a real outcome now changes what Chronos recommends next. Before this, outcomes were stored and never read back: priors from a run whose prediction missed kept steering later simulations, and the memory record labelled a future "Successful" at prediction time — before anything had happened. Outcomes are now recorded as observed memory and weight the priors fed into the next run.',
    highlights: [
      {
        label: "Observed memory",
        detail:
          "Logging follow-through or a result writes learning records from what actually happened — separate from prediction-time priors",
      },
      {
        label: "Re-weighted priors",
        detail:
          "A run whose outcome missed no longer steers the next simulation; proven priors rank first · un-logged runs behave exactly as before",
      },
      {
        label: "Verdict signal",
        detail:
          "Optional Better / As predicted / Worse when logging an outcome — the only honest hit-miss source; free-text results are never interpreted",
      },
      {
        label: "Honest wording",
        detail: '"Successful future" at prediction time is now "Predicted best future"',
      },
    ],
  },
  {
    version: "5.4.1",
    date: "2026-07-26",
    tag: "patch",
    title: "Editorial pass on the inner pages",
    summary:
      "Knowledge, Notes, Timeline, Memory, and Compare now open with the same editorial voice as the Decision Brief — display-scale serif headlines and serif ledes. Styling only; no copy or behavior changes.",
    highlights: [
      {
        label: "Type scale",
        detail: "Page headlines at display size · ledes in the serif voice · labels unchanged",
      },
    ],
  },
  {
    version: "5.4.0",
    date: "2026-07-26",
    tag: "minor",
    title: "The future graph",
    summary:
      "Chronos' signature visualization lands on the simulation report: NOW forks into ranked futures, each branch ending in its risk node. The engine's pick carries the accent, the chosen path is marked, and clicking a branch selects that future across the whole page — comparison, timeline cards, and save.",
    highlights: [
      {
        label: "Future graph",
        detail:
          "Branching SVG on every completed run · rank-ordered top to bottom · recommended branch accented · CHOSEN marker · risk % terminals",
      },
      {
        label: "One selection",
        detail: "Graph, comparison, and timeline cards share the same selected future",
      },
      {
        label: "Pure layout",
        detail:
          "layoutFutureGraph(futures) in the domain layer — geometry unit-tested, scales with branch count",
      },
    ],
  },
  {
    version: "5.3.0",
    date: "2026-07-26",
    tag: "minor",
    title: "The new workspace shell",
    summary:
      "The rest of the decision-workspace redesign lands in the chrome. ⌘K opens a real command palette — type to filter, Enter runs, unmatched queries fall back to knowledge search. The six-state lifecycle band now persists on every workspace page. The sidebar shows live counts and the context rail gains a real Notes tab backed by workspace notes.",
    highlights: [
      {
        label: "Command palette",
        detail:
          "⌘K / Ctrl+K anywhere in the workspace · commands derived from real state (review recommendation and log outcome appear once a run completes) · knowledge-search fallback",
      },
      {
        label: "Lifecycle band",
        detail: "Draft → Learned band on every workspace page, not just the brief",
      },
      {
        label: "Sidebar",
        detail: "Live counts for Knowledge / Simulations / Memory · pulse on the current decision",
      },
      {
        label: "Context rail",
        detail:
          "Details / Notes tabs — Notes shows real workspace notes · rail also on Workspace HQ",
      },
    ],
  },
  {
    version: "5.2.1",
    date: "2026-07-26",
    tag: "patch",
    title: "Decision Brief becomes the workspace home",
    summary:
      "Opening the workspace now lands on the Decision Brief — the editorial read of your current decision. The HQ dashboard moved to /workspace/hq (sidebar: Workspace HQ), old /workspace/decision links redirect, and the brief is reachable from the mobile More menu.",
    highlights: [
      {
        label: "Default route",
        detail:
          "/workspace → Decision Brief · HQ dashboard at /workspace/hq · legacy links redirect",
      },
      {
        label: "Mobile nav",
        detail: "Decision Brief reachable on phones (More menu gained the missing entry)",
      },
    ],
  },
  {
    version: "5.2.0",
    date: "2026-07-26",
    tag: "minor",
    title: "Decision Brief · sign-in polish",
    summary:
      "New decision-centric workspace surface: the Decision Brief reads one decision as an editorial page — six-state lifecycle band (Draft → Simulating → Evaluating → Collapsed → Observed → Learned), recommendation, honest confidence stats, evidence, and ranked futures, all derived from real workspace data. Sign-in loading is leaner and phones finally see the whole wordmark.",
    highlights: [
      {
        label: "Decision Brief",
        detail:
          "/workspace/decision · deriveDecisionBrief(home) · lifecycle band from sim status, chosen path, and outcome fields · empty states instead of invented numbers",
      },
      {
        label: "Lifecycle band",
        detail:
          "Draft → Simulating → Evaluating → Collapsed → Observed → Learned, with real dates from the run, the chosen path, and the logged outcome",
      },
      {
        label: "Sign-in loading",
        detail:
          "Dead fullScreen/orbit variants removed · double bootstrap on fast sign-ins fixed (one ensureAccount, one session_start, one navigate) · regression-tested",
      },
      {
        label: "Mobile art",
        detail:
          "Portrait crop of the loading art via <picture> — the full Chronos LAB wordmark survives phones down to 344px covers",
      },
    ],
  },
  {
    version: "5.1.0",
    date: "2026-07-25",
    tag: "minor",
    title: "Decision HQ · platform AI · beta reliability",
    summary:
      "Workspace HQ leads with a Decision Card (review deep-link only — Chronos recommends, you save on the sim page). Shared decision history powers HQ preview and Timeline. Simulation results show a real pipeline, Evidence, Why, and Expected Value. Platform AI port ships with Noop default and opt-in Ollama. Ops fixes for cloud login, tab-focus drafts, and mobile sign-out.",
    highlights: [
      {
        label: "Decision HQ",
        detail:
          "Hero Recommendation · Confidence · Status · Review Recommendation → · demoted Goal/Knowledge · recent decision timeline",
      },
      {
        label: "Decision history",
        detail:
          "One deriveDecisionHistory model: workspace → knowledge → sim → recommendation → accept → outcome",
      },
      {
        label: "Sim result contract",
        detail:
          "Pipeline stages · Evidence · Why · Expected value · Compare · Save decision (P1 pipeline UX)",
      },
      {
        label: "Platform AI",
        detail:
          "AIPort generate/embed/reason/code · ProviderRouter · Noop default · Ollama adapter (VITE_AI_PROVIDER=ollama)",
      },
      {
        label: "Cloud reliability",
        detail:
          "Profiles updated_at recursion fix (54001) · migration history parity · hosted grant repairs",
      },
      {
        label: "Workspace UX",
        detail:
          "Tab focus no longer wipes form drafts · Sign out on mobile header/drawer · cloud sync banner when dual-write fails",
      },
    ],
  },
  {
    version: "5.0.0",
    date: "2026-07-22",
    tag: "major",
    title: "Decision Report centerpiece · honest sim · cloud UUID fix",
    summary:
      "Product experience focuses on the keepable Decision Report and a quiet HQ (Pulse → Goal → Report → Next action). Simulation uses honest Monte Carlo sample counts with hard-constraint disqualification and EV scoring. Futures persist as UUIDs so cloud dual-write succeeds. Onboarding is Goal → Knowledge → Simulation → Recommendation; palette and motioned workspace loading ship.",
    highlights: [
      {
        label: "Decision Report",
        detail:
          "Centerpiece artifact: Goal · Recommendation · Confidence · Evidence · Trade-offs · Risks · Next steps — copy / download .md",
      },
      {
        label: "Quiet HQ",
        detail:
          "Pulse → Current goal → full report → Next action → Knowledge · Timeline (widget noise removed)",
      },
      {
        label: "Honest simulation",
        detail:
          "Real sample budgets (not fake 1000 paths); hard constraints disqualify; structured runway/MRR signals; Future A★ comparison",
      },
      {
        label: "Simulation history",
        detail: "Today · Yesterday · Last week buckets on the simulations list",
      },
      {
        label: "Cloud dual-write",
        detail: "Future/timeline IDs are UUIDs — fixes 22P02 invalid uuid (0x…) sync failures",
      },
      {
        label: "Workspace UX",
        detail:
          "Chronos palette (#111 #2A4D5F #60899B #989898 #C4C2AA #F2EDEA) · orbit enter loading · reduced-motion safe",
      },
      {
        label: "Repo hygiene",
        detail: "node_modules and dist untracked; empty Supabase env no longer crashes the SPA",
      },
    ],
  },
  {
    version: "4.9.0",
    date: "2026-07-22",
    tag: "minor",
    title: "Public beta open · join signup · grant repair",
    summary:
      "Waitlist/request-access removed. Join public beta opens an in-page signup modal (Google, GitHub, email signup/sign-in, magic link). Workspace motion polish, Supabase authenticated grant repair SQL, dual-write hardening, and Decision Workspace launch stack merged to mainline.",
    highlights: [
      {
        label: "Join public beta",
        detail: "Nav/CTA/hero open SignUpModal — no access_requests queue",
      },
      {
        label: "Auth",
        detail: "signUpWithPassword + OAuth + magic link; bootstrap personal workspace",
      },
      {
        label: "Cloud grants",
        detail: "repair SQL for is_workspace_member EXECUTE + table grants for authenticated",
      },
      {
        label: "Motion",
        detail: "Quiet page-enter, cascade, and drawer motion on Decision Workspace shell",
      },
      {
        label: "Ops",
        detail: "Optional VITE_SENTRY_DSN · E2E join-public-beta + decision loop",
      },
    ],
  },
  {
    version: "4.8.1",
    date: "2026-07-21",
    tag: "patch",
    title: "Memory in nav · honest landing claims",
    summary:
      "Memory is a primary nav item with post-decision CTAs on dashboard and after save path. Landing and marketing copy aligned to the real beta: ranked futures, Decision Workspace, dual-write memory, RLS — SDKs/API and cryptographic infra framed as roadmap or demo where appropriate.",
    highlights: [
      {
        label: "Memory nav",
        detail: "Dashboard · Knowledge · Sims · Timeline · Memory · Settings",
      },
      {
        label: "Post-decision CTA",
        detail: "View in Memory after path save + dashboard banner for latest saved path",
      },
      {
        label: "Claim audit",
        detail:
          "Softened 1,000-futures / SDK-shipped / crypto-isolation language on landing & security pages",
      },
    ],
  },
  {
    version: "4.8.0",
    date: "2026-07-21",
    tag: "minor",
    title: "Public beta auth · OAuth · progressive checklist",
    summary:
      "Landing Get Started → Google/GitHub OAuth → profile + personal workspace + owner membership → first decision prompt → dashboard. Progressive beta checklist (LLM optional, decision, simulation, memory, share). Membership-aware schema and access helpers for JWT → workspace checks.",
    highlights: [
      {
        label: "OAuth",
        detail: "Continue with Google / GitHub; email password & magic link secondary",
      },
      {
        label: "Bootstrap",
        detail: "Post-auth: profile, personal workspace, owner membership, preferences",
      },
      {
        label: "Checklist",
        detail: "Natural unlock: connect LLM · first decision · first sim · save memory · share",
      },
      {
        label: "Schema",
        detail: "profiles, workspace_members, decisions, events + membership RLS helpers",
      },
    ],
  },
  {
    version: "4.7.2",
    date: "2026-07-21",
    tag: "patch",
    title: "Launch readiness: monitoring + decision E2E",
    summary:
      "React Error Boundary and optional Sentry (VITE_SENTRY_DSN) so client crashes are visible. Authenticated Playwright covers idea → Decision Report → save path → outcome. Product funnel analytics and full Decision Workspace loop ship together.",
    highlights: [
      {
        label: "Error monitoring",
        detail: "ErrorBoundary + Sentry scaffold (DSN optional); never blocks UX",
      },
      {
        label: "E2E decision loop",
        detail:
          "Playwright: onboard → generate futures → report → choose path → outcome (VITE_E2E_AUTH)",
      },
      {
        label: "Trust + analytics",
        detail: "Recommended because · funnel counters · docs beta framing",
      },
    ],
  },
  {
    version: "4.7.1",
    date: "2026-07-21",
    tag: "patch",
    title: "Trust · analytics · docs",
    summary:
      "Every recommendation now leads with transparent “Recommended because” bullets. Product analytics instrument the beta funnel (workspaces, sims, time-to-first-decision, exports, retention). Docs cover what Chronos is, branch → simulate → collapse, beta limits, and FAQ.",
    highlights: [
      {
        label: "Recommended because",
        detail:
          "lowest execution risk · fits objective · fewer dependencies · highest expected success",
      },
      {
        label: "Analytics",
        detail:
          "workspace_created, simulation_started/completed, path_chosen, report_exported, session/retention — local + Supabase events",
      },
      { label: "Docs", detail: "What Chronos is · How it works · Beta limitations · FAQ" },
      {
        label: "Settings",
        detail: "Browser funnel snapshot for time-to-first-decision and usage counters",
      },
    ],
  },
  {
    version: "4.7.0",
    date: "2026-07-21",
    tag: "minor",
    title: "Decision Report · dashboard · outcome memory",
    summary:
      "Shareable Decision Report (objective, context, alternatives, trade-offs, confidence, path, risks, next actions). Dashboard answers what you’re working on, what’s pending, what ran, and what changed. Persistent goal history + outcome tracking: Did you follow this? How did it turn out?",
    highlights: [
      {
        label: "Decision Report",
        detail:
          "Full artifact: objective, context used, alternative futures, trade-offs, confidence, recommended path, risks, next actions — copy/download markdown",
      },
      {
        label: "Dashboard HQ",
        detail: "Working on · pending decisions · simulations run · activity since last time",
      },
      {
        label: "Persistent memory",
        detail: "Previous goals, decision history, knowledge, simulations, past outcomes on Memory",
      },
      {
        label: "Outcome tracking",
        detail:
          "Yes / Partially / No follow-through, then free-text how it turned out — stored on the sim + notes",
      },
    ],
  },
  {
    version: "4.6.1",
    date: "2026-07-21",
    tag: "patch",
    title: "Flawless decision loop · multi-future wow",
    summary:
      "Idea → decision in minutes: generate futures lands on the sim detail, comparison leads with exclusive hooks (Fastest path · Lower risk · Highest upside), then Decision Report, then choose path and save to timeline.",
    highlights: [
      {
        label: "Wow comparison",
        detail:
          "Future A 92% · Fastest path · B Lower risk · C Highest upside — exclusive trade-off labels",
      },
      {
        label: "Flow order",
        detail:
          "Compare outcomes → Decision Report → Choose path · Save timeline (pipeline demoted)",
      },
      {
        label: "Post-run redirect",
        detail: "runSimulation returns sim id and opens the decision view immediately",
      },
      { label: "CTA", detail: "Generate futures (not “here’s an answer”)" },
    ],
  },
  {
    version: "4.6.0",
    date: "2026-07-16",
    tag: "minor",
    title: "Decision Workspace restored",
    summary:
      "Full decision loop on main: mandatory onboarding, Workspace Pulse, Decision Report, multi-future comparison, timeline cards, and slim primary nav (Dashboard · Knowledge · Simulations · Timeline · Settings).",
    highlights: [
      {
        label: "Decision Report",
        detail: "Recommended path, confidence, why, risks, next actions — screenshot-ready",
      },
      { label: "Onboarding", detail: "Create → Name → Goal → Context → Dashboard (no skip)" },
      {
        label: "Pulse",
        detail: "Knowledge coverage, simulation confidence, open tasks, recommendation",
      },
      {
        label: "Comparison",
        detail: "All ranked futures with confidence bars — not a single answer",
      },
      { label: "Timeline", detail: "Goal → Future A ⭐ → B → C; choose and save path" },
      { label: "Nav", detail: "Primary chrome simplified; Memory remains deep-linkable" },
    ],
  },
  {
    version: "4.4.0",
    date: "2026-07-15",
    tag: "minor",
    title: "Private workspace MVP",
    summary:
      "A usable path from sign-in to cumulative decisions: workspace HQ, knowledge library, simulation engine, future cards, and versioned memory—each gate shippable before the next, without building a full Workspace OS upfront.",
    highlights: [
      {
        label: "HQ",
        detail:
          "Authenticated /workspace dashboard: goal, quick actions, recent runs, knowledge summary, MVP progress rail",
      },
      {
        label: "Schema",
        detail:
          "Supabase tables for workspaces, goals, simulations, futures, knowledge, notes, timeline_nodes (+ RLS)",
      },
      {
        label: "Knowledge",
        detail:
          "RAG-lite library: PDF/MD/TXT upload, website & GitHub README import, markdown notes, keyword search",
      },
      {
        label: "Engine",
        detail:
          "Plan → generate → evaluate → rank → best future; five ranked futures, risks, confidence, pipeline tasks",
      },
      {
        label: "Timeline",
        detail:
          "Card timeline (not a graph): Goal → Future A ⭐ … D; click for summary, risk, confidence, next steps",
      },
      {
        label: "Memory",
        detail:
          "Every run saved with lineage versions (v1/v2/v3); reopen report, re-run, compare across sessions",
      },
      {
        label: "Auth",
        detail:
          "BrowserRouter + magic-link callback + password sign-in; sessions persist; GH Pages SPA 404 fallback",
      },
    ],
  },
  {
    version: "4.3.0",
    date: "2026-07-08",
    tag: "minor",
    title: "Workspace intelligence",
    summary:
      "Chronos workspaces now retain the evidence behind decisions. Successful futures feed the next plan; recurring failure patterns become guardrails instead of being forgotten after a run.",
    highlights: [
      {
        label: "Workspace",
        detail: "knowledge graph links assumptions, simulations, outcomes, and recurring patterns",
      },
      {
        label: "Memory",
        detail: "validated winning futures are promoted into reusable planning evidence",
      },
      {
        label: "Guardrails",
        detail:
          "repeated failure signals are derived into recommended constraints for future plans",
      },
      {
        label: "Access",
        detail:
          "private workspace preview replaces public runtime execution while Cohort 04 is onboarded",
      },
    ],
  },
  {
    version: "4.2.1",
    date: "2026-06-18",
    tag: "patch",
    title: "Temporal task graph",
    summary:
      "Chronos now decomposes objectives into dependency-aware task graphs, resolves registered capabilities, and ranks timeline outcomes without requiring users to choose individual agents.",
    highlights: [
      {
        label: "Planner",
        detail:
          "Launch startup decomposes into research, market, roadmap, adoption, financial, and risk tasks",
      },
      { label: "Runtime", detail: "capability registration replaces engine-owned named agents" },
      { label: "Timeline", detail: "subbranch, merge, and collapse records are replayable" },
      {
        label: "Tests",
        detail:
          "engine lifecycle, task graph, temporal versioning, cache, and learning-loop coverage added",
      },
    ],
  },
  {
    version: "4.2.0",
    date: "2026-05-22",
    tag: "minor",
    title: "Temporal Compute Platform",
    summary:
      "Chronos expands from a decision engine into a platform surface: SDK, API, CLI, editor extension, Agent Runtime, and Simulation Cloud share one temporal contract.",
    highlights: [
      {
        label: "SDK",
        detail: "typed task, timeline, branch, and memory contracts across supported languages",
      },
      {
        label: "API",
        detail: "platform routes defined for task planning, execution, replay, and inspection",
      },
      { label: "CLI", detail: "objective planning and timeline replay added to terminal workflow" },
      {
        label: "Authoring",
        detail: "Visual Studio extension preview introduced for Chronos programs",
      },
    ],
  },
  {
    version: "4.1.3",
    date: "2026-04-09",
    tag: "patch",
    title: "Runtime reliability",
    summary:
      "Hardened deterministic execution, cache identity, and branch archive behavior before the platform surface rollout.",
    highlights: [
      {
        label: "Runtime",
        detail: "idempotent run, branch, and timeline identifiers added to service handoffs",
      },
      {
        label: "Cache",
        detail: "prompt, workspace, model version, and configuration now determine cache identity",
      },
      { label: "Replay", detail: "timeline snapshots preserve canonical state and event ordering" },
    ],
  },
  {
    version: "4.1.0",
    date: "2026-03-12",
    tag: "minor",
    title: "Temporal versioning",
    summary:
      "A decision can now retain its complete temporal history: root branches, subbranches, merge evidence, and a final collapse record.",
    highlights: [
      { label: "Branch", detail: "parent lineage and depth added for nested what-if exploration" },
      {
        label: "Merge",
        detail: "compatible branches can converge before canonical state is committed",
      },
      { label: "Collapse", detail: "discarded timelines remain replayable evidence after ranking" },
    ],
  },
  {
    version: "4.0.0",
    date: "2026-02-10",
    tag: "major",
    title: "Temporal runtime foundation",
    summary:
      "The first Chronos runtime ships with deterministic fork, evaluate, collapse, commit, replay, and query primitives.",
    highlights: [
      {
        label: "Core",
        detail: "six temporal primitives establish the canonical decision lifecycle",
      },
      {
        label: "Language",
        detail: "state, action, score, and run constructs establish the first authoring model",
      },
      {
        label: "Workspace",
        detail: "initial simulation, memory, scenario, and timeline persistence ports introduced",
      },
      {
        label: "Runtime",
        detail:
          "fork · evaluate · collapse · commit · replay · query are available as a deterministic lifecycle",
      },
      { label: "SDK", detail: "initial TypeScript SDK contract and CLI workflow released" },
    ],
  },
  {
    version: "3.5.0",
    date: "2026-01-17",
    tag: "minor",
    title: "Temporal fork primitive",
    summary:
      "First public primitive. Branch a world state into N isolated futures with byte-level isolation.",
    highlights: [
      { label: "Engine", detail: "fork primitive — clone any state into N isolated branches" },
      { label: "Engine", detail: "deterministic replay with cryptographic state anchoring" },
    ],
  },
];

export function ChangelogPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[]}
        eyebrow="/ changelog"
        title={
          <>
            What's new<span className="text-ink-faint">.</span>
          </>
        }
        subtitle="Ship notes from the Chronos Lab team. Every release, every primitive, every fix — in reverse chronological order."
      />

      <section className="relative py-16 lg:py-20">
        <div className="mx-auto max-w-4xl px-6 lg:px-10">
          {/* Summary stats */}
          <ScrollReveal
            variant="fade"
            className="mb-12 grid grid-cols-1 gap-4 rounded-xl border border-line bg-bg-soft p-5 sm:grid-cols-3"
          >
            <Stat label="Releases" value={releases.length} />
            <Stat label="Current" value={releases[0].version} />
            <Stat label="Last shipped" value={releases[0].date.slice(0, 7)} />
          </ScrollReveal>

          {/* Timeline */}
          <div className="relative space-y-8">
            {/* Vertical line */}
            <div className="absolute left-[27px] top-3 bottom-3 w-px bg-line" />

            {releases.map((r, i) => (
              <ScrollReveal key={r.version} delay={Math.min(i * 50, 250)} variant="up">
                <ReleaseCard release={r} />
              </ScrollReveal>
            ))}
          </div>

          {/* Subscribe */}
          <div className="mt-16 rounded-xl border border-line bg-bg-soft p-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-chronos">
              Stay up to date
            </div>
            <div className="text-[15px] leading-[1.65] text-ink-dim">
              Every release ships to our Telegram group and X feed first.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href="https://t.me/+I9MN0GfvgwllZGRh"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
              >
                Telegram group →
              </a>
              <a
                href="https://x.com/chronoslabspace"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-[12px] font-medium text-ink-dim transition hover:border-line-strong hover:text-ink"
              >
                Follow on X →
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-faint">
        {label}
      </div>
      <div className="mt-1 font-serif text-2xl text-ink tabular-nums">{value}</div>
    </div>
  );
}

function ReleaseCard({ release }: { release: Release }) {
  const tagStyles = {
    major: "border-accent-warm/40 bg-accent-warm/10 text-accent-warm",
    minor: "border-accent-2/40 bg-accent-2/10 text-accent-2",
    patch: "border-chronos/40 bg-chronos/10 text-chronos",
  }[release.tag];

  return (
    <div className="relative pl-16">
      {/* Node */}
      <div className="absolute left-4 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-bg">
        <span
          className={`h-2 w-2 rounded-full ${
            release.tag === "major"
              ? "bg-accent-warm"
              : release.tag === "minor"
                ? "bg-accent-2"
                : "bg-chronos"
          }`}
        />
      </div>

      <div className="rounded-xl border border-line bg-bg-soft p-5">
        {/* Header */}
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <code className="font-mono text-lg text-ink">v{release.version}</code>
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${tagStyles}`}
            >
              {release.tag}
            </span>
          </div>
          <span className="font-mono text-[11px] text-ink-faint">{release.date}</span>
        </div>

        {/* Title + summary */}
        <div className="mt-3">
          <div className="font-serif text-xl text-ink">{release.title}</div>
          <p className="mt-1 text-[13px] leading-[1.6] text-ink-dim">{release.summary}</p>
        </div>

        {/* Highlights */}
        <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
          {release.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-3 text-[12px] leading-[1.6]">
              <span className="mt-0.5 shrink-0 rounded bg-bg px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-chronos">
                {h.label}
              </span>
              <span className="text-ink-dim">{h.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
