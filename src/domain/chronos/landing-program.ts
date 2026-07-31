/**
 * The Chronos Language program shown on the landing page.
 *
 * It lives here, as one string, so `landing-program.test.ts` compiles the exact
 * text the page renders. The page used to hardcode a different, invented syntax
 * (`objective … { workspace: … }` / `plan { research.competitors … }`) that the
 * tokenizer rejected on its first `:` — a language sample for a language that
 * did not exist.
 *
 * Same idiom as `presetPrograms` in `language.ts`: state, actions, a score
 * function, and a run block. Keep it short — this is a landing panel, not the
 * playground.
 */
export const LANDING_PROGRAM = `# Chronos Language v0.1
# Objective: launch with 18 months of runway

state {
  agent.runway = 18
  agent.mrr = 40
  agent.momentum = 55
  agent.optionality = "open"

  world.market = "shifting"
  world.positioned = false

  context.board = "watching"
  context.competitive_wind = 6
}

action "Enterprise wedge" {
  agent.runway = 11
  agent.mrr = 140
  world.positioned = true
  risk = 0.55
  reward = 0.9
}

action "Self-serve first" {
  agent.runway = 14
  agent.momentum = 74
  world.market = "stable"
  risk = 0.25
  reward = 0.6
}

score utility(state) {
  base = state.reward - 0.8 * state.risk
  if state.agent.runway < 12 {
    base = base - 0.15
  }
  if state.agent.momentum > 70 {
    base = base + 0.08
  }
  return clamp(base, 0, 1)
}

run {
  fork
  evaluate with utility
  collapse max-utility
}
`;
