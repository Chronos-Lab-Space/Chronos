/**
 * Pure request factory for the public marketing simulator.
 * No cache, no service — composition wires those.
 */
export function createPublicStartupRequest(prompt: string) {
  return {
    prompt,
    workspaceId: "public-startup-simulator",
    // v2: honest Monte Carlo budget (pathsEvaluated === samples scored)
    modelVersion: "startup-simulator-v2",
    configuration: {
      futureCount: 64,
      horizonMonths: 18,
      ranking: "expected-arr",
    },
  };
}
