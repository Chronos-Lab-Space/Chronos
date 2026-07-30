/**
 * Composition root for the workspace simulation engine.
 *
 * A composition root sits above the layers rather than inside them: it is the
 * one place allowed to name both an application service and the infrastructure
 * adapters that service runs on. `main.tsx` and `App.tsx` play the same role
 * for the UI.
 *
 * This exists because the wiring used to live at the bottom of
 * `SimulationEngine.ts` — 1,150 lines below the class it configured. That put
 * an infrastructure import inside an application service, and it hid the fact
 * that turning on `VITE_AI_PROVIDER=proxy` changed what the engine does. The
 * class doc still claimed the product path never called a model.
 */

import { StartupLaunchPlanner } from "../application/planner/StartupLaunchPlanner";
import { SimulationEngine } from "../application/simulation/SimulationEngine";
import { createAIPortFromEnv, isAISimEnrichEnabled } from "../infrastructure/ai";

/**
 * Product singleton: AI port from env (noop unless the build says otherwise),
 * enrichment gated by `VITE_AI_SIM_ENRICH`. The gate is passed as a function
 * so it is still read per call — `vi.stubEnv` in tests continues to work, and
 * a future runtime toggle would not need a new engine.
 */
export const simulationEngine = new SimulationEngine(
  new StartupLaunchPlanner(),
  createAIPortFromEnv(),
  isAISimEnrichEnabled
);
