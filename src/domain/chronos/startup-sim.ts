// Chronos Startup Simulator
// =========================
// Deterministic Monte Carlo over category path templates.
// Sample budget is real (pathsEvaluated === samples drawn), not marketing fiction.
// Same idea + budget always yields the same output (hash-seeded RNG).

export type Milestone = {
  month: number;
  title: string;
  description: string;
};

export type Path = {
  id: string;
  name: string;
  thesis: string;
  milestones: Milestone[];
  arr: number; // dollars
  probability: number; // 0-1
  monthsToPmf: number;
  cac: number;
  ltv: number;
  burn: number; // monthly burn
  highlights: string[];
  risks: string[];
};

export type SimulationResult = {
  idea: string;
  category: string;
  categoryLabel: string;
  bestPath: Path;
  alternatives: Path[];
  /** Distinct strategy archetypes in the category catalog. */
  totalPaths: number;
  /** Monte Carlo samples actually scored (honest; equals sample budget used). */
  pathsEvaluated: number;
  bestBranchId: string;
  /** Expected ARR of the winning sample (arr * probability). */
  bestExpectedValue: number;
};

export type SimulateOptions = {
  /** Total Monte Carlo draws across templates. Default 64. Clamped 8–256. */
  sampleBudget?: number;
};

// ---- Hash + seeded RNG ----

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Categorization ----

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "ai-dev-tools": [
    "ai",
    "developer",
    "dev",
    "llm",
    "code",
    "engineer",
    "infra",
    "platform",
    "sdk",
    "api",
  ],
  productivity: ["meeting", "calendar", "note", "assistant", "workflow", "team", "collab"],
  consumer: ["consumer", "social", "fitness", "wellness", "gaming", "entertainment", "creator"],
  "b2b-saas": ["saas", "b2b", "enterprise", "sales", "crm", "hr", "finance", "accounting"],
  marketplace: ["marketplace", "uber", "airbnb", "rental", "hire", "gig", "freelance"],
  fintech: ["fintech", "payment", "banking", "crypto", "invest", "trade", "loan"],
  health: ["health", "medical", "clinic", "patient", "doctor", "mental", "therapy"],
};

function categorize(idea: string): { category: string; label: string } {
  const lower = idea.toLowerCase();
  let best = { category: "b2b-saas", label: "B2B SaaS", score: 0 };
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const kw of kws) {
      // Whole-word match only: substring matching mis-categorized ideas
      // ("email" contains "ai", "capital" contains "api", "through"
      // contains "hr") and picked the wrong economics catalog.
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(lower)) score += 1;
    }
    if (score > best.score) {
      best = { category: cat, label: catLabel(cat), score };
    }
  }
  return { category: best.category, label: best.label };
}

function catLabel(cat: string): string {
  return (
    {
      "ai-dev-tools": "AI / Developer Tools",
      productivity: "Productivity",
      consumer: "Consumer",
      "b2b-saas": "B2B SaaS",
      marketplace: "Marketplace",
      fintech: "Fintech",
      health: "Health",
    }[cat] ?? "General"
  );
}

// ---- Path templates ----

type PathTemplate = Omit<
  Path,
  "id" | "arr" | "probability" | "monthsToPmf" | "cac" | "ltv" | "burn"
> & {
  arrRange: [number, number];
  probRange: [number, number];
};

const PATHS: Record<string, PathTemplate[]> = {
  "ai-dev-tools": [
    {
      name: "Developer-first wedge",
      thesis: "Win developers with a free tier, convert to paid teams, then enterprise.",
      milestones: [
        {
          month: 1,
          title: "Target developers",
          description: "Open-source the core. Build in public on Twitter / HN.",
        },
        {
          month: 3,
          title: "Integrate with Slack + VS Code",
          description: "Meet devs where they already work. Reduce friction to zero.",
        },
        {
          month: 6,
          title: "First paid teams",
          description: "Team seats at $20/seat/mo. Word-of-mouth driven.",
        },
        {
          month: 9,
          title: "Enterprise interest",
          description: "Two Fortune 500s request SOC 2 and SSO.",
        },
        {
          month: 12,
          title: "Enterprise pivot",
          description: "Reprice to $50/seat. Hire first AEs.",
        },
        {
          month: 18,
          title: "$200k MRR",
          description: "120 enterprise seats. Sales-led expansion.",
        },
      ],
      arrRange: [1_800_000, 3_200_000],
      probRange: [0.14, 0.24],
      highlights: ["Low CAC via OSS", "Strong word-of-mouth", "High switching costs once embedded"],
      risks: ["Long enterprise sales cycles", "Dependence on dev goodwill", "Open-source copycats"],
    },
    {
      name: "Agency-to-product",
      thesis: "Start as a high-touch service, productize the pattern, scale.",
      milestones: [
        {
          month: 1,
          title: "Land 3 design partners",
          description: "Charge $8k/mo for done-for-you AI pipelines.",
        },
        {
          month: 3,
          title: "Pattern emerges",
          description: "Same problem showing up across all three customers.",
        },
        {
          month: 6,
          title: "Productize the pattern",
          description: "Turn the common workflow into a self-serve product.",
        },
        {
          month: 9,
          title: "First self-serve cohort",
          description: "50 companies on a $500/mo plan.",
        },
        {
          month: 12,
          title: "Kill the agency arm",
          description: "All revenue is now product. Team shrinks from 8 to 5.",
        },
        {
          month: 18,
          title: "Product-led growth",
          description: "400 customers at $1.5k/mo average.",
        },
      ],
      arrRange: [5_000_000, 9_000_000],
      probRange: [0.06, 0.12],
      highlights: ["Revenue from day one", "Deep pattern recognition", "Strong founder-market fit"],
      risks: [
        "Hard to let go of services revenue",
        "Slow to scale initially",
        "Team must re-skill",
      ],
    },
    {
      name: "Vertical AI",
      thesis: "Pick one niche. Own it end-to-end. Become the default.",
      milestones: [
        {
          month: 1,
          title: "Pick a vertical",
          description: "Legal contracts, insurance claims, or clinical notes.",
        },
        {
          month: 3,
          title: "Embed in the workflow",
          description: "Integrate with the vertical's existing tools.",
        },
        {
          month: 6,
          title: "10 paying customers",
          description: "All in the same vertical. All referencing each other.",
        },
        {
          month: 9,
          title: "Vertical conference talk",
          description: "Sponsor the main event. Become synonymous with the niche.",
        },
        {
          month: 12,
          title: "100 customers in vertical",
          description: "Network effects within the niche kick in.",
        },
        {
          month: 18,
          title: "Expand to adjacent vertical",
          description: "Take the same engine to the next market.",
        },
      ],
      arrRange: [2_400_000, 4_500_000],
      probRange: [0.1, 0.2],
      highlights: ["Defensible niche", "Strong network effects", "Clear expansion path"],
      risks: [
        "Niche may be too small",
        "Slow to expand beyond vertical",
        "Dependence on one market",
      ],
    },
  ],
  productivity: [
    {
      name: "Meeting-to-memory",
      thesis: "Capture meetings, turn them into searchable memory. Land in teams, expand to orgs.",
      milestones: [
        {
          month: 1,
          title: "Target developers + PMs",
          description: "Power users who take too many notes.",
        },
        {
          month: 3,
          title: "Integrate Slack + Zoom",
          description: "Auto-join every meeting. Summarize in-channel.",
        },
        {
          month: 6,
          title: "Team features ship",
          description: "Shared workspaces, action items, follow-ups.",
        },
        { month: 9, title: "1,000 teams active", description: "Mostly dev shops and agencies." },
        {
          month: 12,
          title: "Enterprise pivot",
          description: "First 100-seat deals. Security review queue builds.",
        },
        {
          month: 18,
          title: "$200k MRR · enterprise-led",
          description: "8 enterprise logos, 2,000 small teams.",
        },
      ],
      arrRange: [1_800_000, 3_600_000],
      probRange: [0.12, 0.22],
      highlights: [
        "Natural virality in meetings",
        "High retention once embedded",
        "Clear enterprise motion",
      ],
      risks: ["Crowded market", "Zoom/Google could build it", "Privacy concerns in enterprise"],
    },
    {
      name: "Consumer-first productivity",
      thesis: "Win individuals with a delightful free tool, convert to paid, B2C→B2B.",
      milestones: [
        {
          month: 1,
          title: "Launch beautiful free app",
          description: "Single-purpose. One job, done better than anyone.",
        },
        {
          month: 3,
          title: "TikTok / Reels push",
          description: "Short-form content showing the magic.",
        },
        { month: 6, title: "100k users", description: "Mostly students and freelancers." },
        {
          month: 9,
          title: "Paid tier at $6/mo",
          description: "Unlimited storage + advanced features.",
        },
        { month: 12, title: "500k users, 3% conversion", description: "$360k ARR. Slow but real." },
        {
          month: 18,
          title: "Team plan launches",
          description: "Pivot motion to B2B. Faster growth.",
        },
      ],
      arrRange: [600_000, 1_400_000],
      probRange: [0.05, 0.1],
      highlights: ["Low CAC via social", "Strong brand potential", "Optionality to go B2B"],
      risks: ["Slow monetization", "Consumer churn is brutal", "Hard to predict growth"],
    },
  ],
  consumer: [
    {
      name: "Viral consumer play",
      thesis: "Ship something delightful. Ride social. Monetize late.",
      milestones: [
        {
          month: 1,
          title: "Launch to 1,000 beta users",
          description: "Invite-only. Scarcity drives demand.",
        },
        {
          month: 3,
          title: "Short-form content explodes",
          description: "One creator posts, it hits 2M views.",
        },
        { month: 6, title: "100k MAU", description: "Retention is the bottleneck. 25% D30." },
        {
          month: 9,
          title: "Paid tier: $8/mo",
          description: "Unlock premium features. 2% conversion.",
        },
        {
          month: 12,
          title: "1M MAU, $50k MRR",
          description: "Growing but monetization is an open question.",
        },
        { month: 18, title: "Ad-supported + premium", description: "Hybrid model. $200k MRR." },
      ],
      arrRange: [1_200_000, 3_000_000],
      probRange: [0.04, 0.1],
      highlights: [
        "Potential for massive scale",
        "Strong brand leverage",
        "Multiple monetization paths",
      ],
      risks: ["Retention is the killer", "Monetization is uncertain", "Algorithm changes sink you"],
    },
    {
      name: "Niche community subscription",
      thesis:
        "Charge from day one for a smaller, deeply engaged audience. No free tier to subsidize.",
      milestones: [
        {
          month: 1,
          title: "Invite-only launch",
          description: "150 hand-picked members. Scarcity and word-of-mouth only.",
        },
        {
          month: 3,
          title: "Waitlist to 2,000",
          description: "Referral-gated signups. Community moderates itself.",
        },
        {
          month: 6,
          title: "Paid from day one",
          description: "$15/mo, no free tier. Churn under 4% monthly.",
        },
        { month: 9, title: "1,200 paying members", description: "$18k MRR. CAC near zero." },
        {
          month: 12,
          title: "Creator/expert tier launches",
          description: "$40/mo tier with direct access. ARPU jumps.",
        },
        {
          month: 18,
          title: "$400k ARR",
          description: "Small but durable. Expansion via adjacent niches.",
        },
      ],
      arrRange: [250_000, 700_000],
      probRange: [0.1, 0.2],
      highlights: ["Revenue from day one", "Low CAC, high retention", "Defensible community moat"],
      risks: [
        "Ceiling is low without new niches",
        "Founder-dependent culture",
        "Hard to pay for growth",
      ],
    },
  ],
  "b2b-saas": [
    {
      name: "Bottom-up SaaS",
      thesis:
        "Free tier drives adoption. Team conversion drives revenue. Enterprise closes the round.",
      milestones: [
        {
          month: 1,
          title: "Generous free tier",
          description: "Let individuals use it without talking to anyone.",
        },
        {
          month: 3,
          title: "Team features emerge",
          description: "Sharing, permissions, integrations.",
        },
        { month: 6, title: "First paid teams", description: "$50/team/mo. 100 teams in." },
        { month: 9, title: "Sales team hired", description: "First two AEs target mid-market." },
        { month: 12, title: "Enterprise pilot", description: "5 enterprise deals in motion." },
        { month: 18, title: "$180k MRR", description: "Mix of SMB, mid-market, enterprise." },
      ],
      arrRange: [1_500_000, 2_800_000],
      probRange: [0.1, 0.18],
      highlights: ["Proven motion", "Predictable growth", "Multiple expansion levers"],
      risks: ["Competitive category", "Slow enterprise sales", "High CAC at mid-market"],
    },
    {
      name: "Top-down enterprise",
      thesis: "Land one big logo. Expand inside it. Repeat.",
      milestones: [
        {
          month: 1,
          title: "Founder-led sales",
          description: "Close 2 pilot customers at $5k/mo each.",
        },
        {
          month: 3,
          title: "Deliver massive value",
          description: "White-glove onboarding. Over-deliver.",
        },
        { month: 6, title: "First expansion deal", description: "Pilot customer buys 10x seats." },
        { month: 9, title: "Case study ships", description: "The pilot becomes the proof." },
        { month: 12, title: "5 enterprise logos", description: "$50k/mo each. $600k ARR." },
        { month: 18, title: "20 enterprise logos", description: "$100k/mo each. $1.2M ARR." },
      ],
      arrRange: [1_000_000, 2_000_000],
      probRange: [0.08, 0.15],
      highlights: ["High ACV", "Strong retention", "Predictable revenue"],
      risks: ["Slow sales cycles", "High support burden", "Key-person dependency"],
    },
  ],
  marketplace: [
    {
      name: "Supply-first marketplace",
      thesis: "Subsidize supply side to build liquidity. Take rate follows.",
      milestones: [
        {
          month: 1,
          title: "Recruit 100 suppliers",
          description: "Pay them to list. Guarantee first jobs.",
        },
        {
          month: 3,
          title: "Solve the chicken-egg",
          description: "Subsidize demand with discounts.",
        },
        {
          month: 6,
          title: "First organic matches",
          description: "Supply meets demand without subsidy.",
        },
        { month: 9, title: "Liquidity achieved", description: "90% of jobs fill within 24 hours." },
        {
          month: 12,
          title: "Take rate at 15%",
          description: "Marketplace economics start working.",
        },
        {
          month: 18,
          title: "$100k/mo GMV",
          description: "Network effects kick in. Unit economics positive.",
        },
      ],
      arrRange: [800_000, 2_000_000],
      probRange: [0.05, 0.12],
      highlights: ["Massive TAM", "Network effects", "High exit multiples"],
      risks: ["Capital-intensive", "Liquidity is hard", "Incumbents have data"],
    },
    {
      name: "Demand-first marketplace",
      thesis:
        "Aggregate fragmented demand into one concierge front door. Route to supply, no subsidy.",
      milestones: [
        {
          month: 1,
          title: "Concierge MVP",
          description: "Manually match requests to suppliers by hand.",
        },
        {
          month: 3,
          title: "First 200 bookings",
          description: "Take a lead-gen fee, not a transaction cut.",
        },
        {
          month: 6,
          title: "Self-serve booking ships",
          description: "Automates the manual matching that proved demand.",
        },
        {
          month: 9,
          title: "500 bookings/mo",
          description: "Fee holds; repeat-booking rate rising.",
        },
        {
          month: 12,
          title: "Supply onboarding opens up",
          description: "Suppliers apply to join instead of being recruited.",
        },
        {
          month: 18,
          title: "$90k/mo booking fees",
          description: "Profitable per booking; GMV capped by curation.",
        },
      ],
      arrRange: [500_000, 1_400_000],
      probRange: [0.09, 0.18],
      highlights: [
        "Revenue per booking from day one",
        "No supply subsidy burn",
        "Curated quality bar",
      ],
      risks: [
        "GMV ceiling from manual curation",
        "Slower to scale than open marketplaces",
        "Concierge cost doesn't disappear quickly",
      ],
    },
  ],
  fintech: [
    {
      name: "Vertical fintech",
      thesis: "Pick one underserved segment. Own their money flow.",
      milestones: [
        {
          month: 1,
          title: "Pick a niche",
          description: "Freelancers, dental offices, or restaurants.",
        },
        { month: 3, title: "Embedded banking", description: "Checking + invoicing in one place." },
        {
          month: 6,
          title: "Lending product",
          description: "Offer working capital against receivables.",
        },
        { month: 9, title: "1,000 customers", description: "All in the same vertical." },
        {
          month: 12,
          title: "10% attach rate on lending",
          description: "Revenue jumps. NPLs manageable.",
        },
        { month: 18, title: "$2.5M revenue", description: "Mix of interchange, lending, SaaS." },
      ],
      arrRange: [1_800_000, 3_500_000],
      probRange: [0.08, 0.16],
      highlights: ["High LTV", "Regulatory moat", "Multiple revenue streams"],
      risks: ["Regulatory risk", "Capital intensive", "Credit risk"],
    },
    {
      name: "Fintech infrastructure",
      thesis:
        "Sell the picks and shovels to other fintechs and platforms. Partner-bank the regulatory load.",
      milestones: [
        {
          month: 1,
          title: "API-first MVP",
          description: "One primitive done well: KYC, ledgering, or card issuing.",
        },
        {
          month: 3,
          title: "Partner bank signed",
          description: "Regulatory risk sits with the partner, not the startup.",
        },
        {
          month: 6,
          title: "First 3 platform customers",
          description: "Other startups embed the API instead of building it.",
        },
        {
          month: 9,
          title: "Usage-based pricing live",
          description: "Per-transaction fee. Revenue tracks customer volume.",
        },
        {
          month: 12,
          title: "20 platform customers",
          description: "Net revenue retention above 120% as customers scale.",
        },
        {
          month: 18,
          title: "$1.6M ARR",
          description: "Usage-based, concentrated in a few large accounts.",
        },
      ],
      arrRange: [1_000_000, 2_400_000],
      probRange: [0.07, 0.14],
      highlights: [
        "No direct consumer regulatory exposure",
        "Usage-based revenue scales with customers",
        "High switching costs once embedded",
      ],
      risks: [
        "Revenue concentrated in few large accounts",
        "Partner bank dependency",
        "Platform customers could build it themselves",
      ],
    },
  ],
  health: [
    {
      name: "Clinical AI workflow",
      thesis: "Embed in clinical workflow. Get reimbursement. Scale through practices.",
      milestones: [
        {
          month: 1,
          title: "5 pilot clinics",
          description: "Offer free for 90 days in exchange for data.",
        },
        { month: 3, title: "HIPAA + SOC 2", description: "Compliance is the table stakes." },
        {
          month: 6,
          title: "CPT code secured",
          description: "Clinics can bill for using the tool.",
        },
        { month: 9, title: "50 paying clinics", description: "$800/mo each. Revenue starts." },
        { month: 12, title: "Health system pilot", description: "One 200-provider system signs." },
        { month: 18, title: "$2.4M ARR", description: "Mix of clinics and health systems." },
      ],
      arrRange: [1_800_000, 3_200_000],
      probRange: [0.08, 0.16],
      highlights: ["Reimbursement-backed", "Sticky workflow", "High switching costs"],
      risks: ["Long sales cycles", "Regulatory burden", "Clinical validation required"],
    },
    {
      name: "Direct-to-consumer health",
      thesis: "Skip reimbursement entirely. Sell straight to employers and self-pay consumers.",
      milestones: [
        {
          month: 1,
          title: "Launch self-pay app",
          description: "No insurance billing, no CPT code, no clinic sales cycle.",
        },
        {
          month: 3,
          title: "First employer pilot",
          description: "One 200-employee company adds it as a benefit.",
        },
        {
          month: 6,
          title: "3 employer contracts",
          description: "Per-employee-per-month pricing. Predictable revenue.",
        },
        {
          month: 9,
          title: "8,000 covered lives",
          description: "Mix of employer and self-pay users.",
        },
        {
          month: 12,
          title: "Benefits broker channel",
          description: "Brokers start bundling it into open enrollment.",
        },
        {
          month: 18,
          title: "$1.1M ARR",
          description: "Employer contracts renew; self-pay churns faster.",
        },
      ],
      arrRange: [700_000, 1_600_000],
      probRange: [0.09, 0.17],
      highlights: [
        "No CPT code or reimbursement dependency",
        "Faster sales cycle than clinics",
        "Employer channel compounds",
      ],
      risks: [
        "Self-pay churn is high",
        "Employer budgets are seasonal",
        "No regulatory moat once it works",
      ],
    },
  ],
};

// ---- Main simulator ----

const DEFAULT_SAMPLE_BUDGET = 64;

type PathSample = Path & { ev: number; templateName: string };

function clampBudget(n: number | undefined): number {
  const raw = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : DEFAULT_SAMPLE_BUDGET;
  return Math.max(8, Math.min(256, raw));
}

function samplePath(
  template: PathTemplate,
  rng: () => number,
  hash: number,
  sampleIndex: number
): PathSample {
  const arr = template.arrRange[0] + rng() * (template.arrRange[1] - template.arrRange[0]);
  const probability =
    template.probRange[0] + rng() * (template.probRange[1] - template.probRange[0]);
  const monthsToPmf = 6 + Math.floor(rng() * 8);
  const cac = 400 + Math.floor(rng() * 2000);
  const ltv = 8000 + Math.floor(rng() * 20000);
  const burn = 40000 + Math.floor(rng() * 80000);
  const roundedArr = Math.round(arr / 100000) * 100000;
  const roundedProb = Math.round(probability * 1000) / 1000;
  return {
    id: `0x${((hash + sampleIndex * 17) >>> 0).toString(16).padStart(4, "0").slice(-4)}`,
    name: template.name,
    thesis: template.thesis,
    milestones: template.milestones,
    highlights: template.highlights,
    risks: template.risks,
    arr: roundedArr,
    probability: roundedProb,
    monthsToPmf,
    cac,
    ltv,
    burn,
    templateName: template.name,
    ev: roundedArr * roundedProb,
  };
}

export function simulate(idea: string, options: SimulateOptions = {}): SimulationResult {
  const hash = hashString(idea);
  const rng = mulberry32(hash);
  const { category, label } = categorize(idea);
  const categoryPaths = PATHS[category] ?? PATHS["b2b-saas"];
  const budget = clampBudget(options.sampleBudget);
  const samplesPerTemplate = Math.max(1, Math.floor(budget / categoryPaths.length));
  const pathsEvaluated = samplesPerTemplate * categoryPaths.length;

  // Monte Carlo: draw samplesPerTemplate futures per archetype, score EV = ARR × P.
  const allSamples: PathSample[] = [];
  let sampleIndex = 0;
  for (const template of categoryPaths) {
    for (let s = 0; s < samplesPerTemplate; s++) {
      allSamples.push(samplePath(template, rng, hash, sampleIndex));
      sampleIndex += 1;
    }
  }

  allSamples.sort((a, b) => b.ev - a.ev || b.probability - a.probability);

  // Collapse: best sample overall, then best remaining sample per other archetype.
  const best = allSamples[0];
  const seen = new Set<string>([best.templateName]);
  const alternatives: PathSample[] = [];
  for (const sample of allSamples) {
    if (seen.has(sample.templateName)) continue;
    seen.add(sample.templateName);
    alternatives.push(sample);
    if (alternatives.length >= 3) break;
  }

  const strip = ({ ev: _ev, templateName: _t, ...path }: PathSample): Path => path;

  return {
    idea,
    category,
    categoryLabel: label,
    bestPath: strip(best),
    alternatives: alternatives.map(strip),
    totalPaths: categoryPaths.length,
    pathsEvaluated,
    bestBranchId: best.id,
    bestExpectedValue: Math.round(best.ev),
  };
}

export function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
