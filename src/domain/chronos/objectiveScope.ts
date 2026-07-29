/**
 * Is this objective one the scenario catalog can actually answer?
 *
 * Every path in `startup-sim.ts` is a startup go-to-market play, and
 * `contextualizePath` staples the objective's own words onto whichever one
 * scores highest. Given "I want to cook boiled egg" that produced a branch
 * called "Bottom-up SaaS · want cook boiled", scored and ranked as if it
 * meant something. The engine was never wrong — it was answering a question
 * it had no scenarios for, and saying so confidently.
 *
 * This gate is the honest-claims invariant applied to input: the product
 * says what it cannot model instead of dressing a template in the user's
 * vocabulary. It is deliberately *permissive* — one domain term anywhere is
 * enough — because a false reject blocks real work, while a false accept
 * only reproduces today's behaviour.
 */

/**
 * Vocabulary the catalog is built around. Grouped for readability only; a
 * match in any group is a match.
 *
 * Kept as whole words: "steamed" must not read as "team", which is exactly
 * the class of accident this module exists to stop.
 */
const DOMAIN_TERMS = [
  // Funding and runway
  "raise",
  "raising",
  "seed",
  "series",
  "funding",
  "fundraise",
  "investor",
  "investors",
  "vc",
  "runway",
  "bootstrap",
  "dilution",
  "valuation",
  "round",
  "capital",
  "burn",
  "budget",
  "roi",
  // Market and go-to-market
  "launch",
  "beta",
  "gtm",
  "go-to-market",
  "market",
  "marketing",
  "customer",
  "customers",
  "users",
  "adoption",
  "growth",
  "churn",
  "retention",
  "acquisition",
  "sales",
  "pipeline",
  "leads",
  "demand",
  "channel",
  "upmarket",
  "self-serve",
  "enterprise",
  "saas",
  "freemium",
  "b2b",
  "b2c",
  // Product
  "product",
  "feature",
  "roadmap",
  "mvp",
  "pmf",
  "ship",
  "platform",
  "api",
  "developer",
  "developers",
  "onboarding",
  // Pricing and revenue
  "price",
  "pricing",
  "revenue",
  "arr",
  "mrr",
  "monetize",
  "monetise",
  "subscription",
  "seat",
  "usage-based",
  "margin",
  // Team
  "hire",
  "hiring",
  "headcount",
  "team",
  "engineer",
  "engineers",
  "staff",
  "recruit",
  "contractor",
  "cofounder",
  "co-founder",
  "founders",
  // Strategy and operations
  "pivot",
  "expand",
  "expansion",
  "scale",
  "strategy",
  "competitor",
  "competition",
  "partnership",
  "acquire",
  "merge",
  "outsource",
  "vendor",
  "compliance",
  "invest",
  "business",
  "startup",
  "company",
  "venture",
] as const;

/** Built once. Rebuilding per call would be wasteful, not wrong. */
const TERM_PATTERNS: readonly (readonly [string, RegExp])[] = DOMAIN_TERMS.map(
  (term) => [term, new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")] as const
);

export type ObjectiveScope = {
  /** False when nothing in the objective maps onto the catalog's domain. */
  inScope: boolean;
  /** The domain terms found, in catalog order. Empty iff out of scope. */
  matched: string[];
};

export function assessObjectiveScope(objective: string): ObjectiveScope {
  const text = objective.trim();
  // Nothing to match against. The caller shows its own "what do you want to
  // decide?" prompt for this, so out-of-scope is the quiet, correct answer.
  if (!text) return { inScope: false, matched: [] };

  const matched = TERM_PATTERNS.filter(([, re]) => re.test(text)).map(([term]) => term);
  return { inScope: matched.length > 0, matched };
}
