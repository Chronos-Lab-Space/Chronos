/**
 * Composition root for the workspace product loop.
 *
 * `WorkspaceService` owns the rules — dual-write, merge, retention, outcome
 * learning. This file owns the answers to "written where?": browser storage,
 * Supabase, the learning store, and the E2E exception. Keeping those apart is
 * what lets the service be constructed against fakes in a unit test without
 * touching localStorage or a network client.
 */

import { registerProductEventSubscribers } from "../application/runtime/productEventSubscribers";
import { AccountBootstrapService } from "../application/workspace/AccountBootstrapService";
import {
  WorkspaceService,
  type WorkspaceCloudStore,
} from "../application/workspace/WorkspaceService";
import { trackProductEvent } from "../infrastructure/analytics/productAnalytics";
import { isE2EAuthEnabled } from "../infrastructure/auth/e2eAuth";
import {
  loadUserPreferences,
  saveUserPreferences,
} from "../infrastructure/auth/userPreferencesStore";
import { learningMemoryStore } from "../infrastructure/memory/LearningMemoryStore";
import { localWorkspaceStore } from "../infrastructure/repositories/LocalWorkspaceStore";
import { supabaseAccountCloud } from "../infrastructure/repositories/SupabaseAccountCloud";
import { supabaseWorkspaceRepository } from "../infrastructure/repositories/SupabaseWorkspaceRepository";

// Side effects (analytics, memory) attach via the event bus once per process.
// This used to run on import of WorkspaceService.ts, which meant any test
// touching that module started the subscribers too.
registerProductEventSubscribers();

/**
 * Playwright E2E runs local-only so a placeholder Supabase URL cannot hang the
 * product loop behind a network timeout.
 */
const cloudStore: WorkspaceCloudStore | null = isE2EAuthEnabled()
  ? null
  : (supabaseWorkspaceRepository as WorkspaceCloudStore);

/** Signed-in product singleton: local + cloud dual-write, learning retained. */
export const workspaceService = new WorkspaceService({
  local: localWorkspaceStore,
  remote: cloudStore,
  memory: learningMemoryStore,
});

/**
 * Local-only service for anonymous visitors.
 *
 * `remote: null` is the security boundary and it is structural rather than
 * conditional: with no cloud store constructed, there is no code path that can
 * write anonymous data to Supabase — no flag to forget to check.
 *
 * Learning memory is local-only anyway, so anonymous visitors keep theirs.
 *
 * See SPEC-anonymous-workspace.md.
 */
export const anonymousWorkspaceService = new WorkspaceService({
  local: localWorkspaceStore,
  remote: null,
  memory: learningMemoryStore,
});

/**
 * Post-auth bootstrap, wired to the signed-in service. Anonymous visitors
 * never bootstrap an account, so there is deliberately no anonymous variant.
 *
 * Cloud profile/membership is structural: E2E and unit paths pass `cloud: null`
 * so no Supabase write is possible without going through composition.
 */
export const accountBootstrapService = new AccountBootstrapService({
  workspaces: workspaceService,
  preferences: {
    load: loadUserPreferences,
    save: saveUserPreferences,
  },
  analytics: {
    trackWorkspaceCreated: (props) => trackProductEvent("workspace_created", props),
  },
  cloud: isE2EAuthEnabled() ? null : supabaseAccountCloud,
});
