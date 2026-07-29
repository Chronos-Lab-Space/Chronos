import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getDefaultCapabilityRegistry } from "../../../application/agent-os/createDefaultCapabilityRegistry";
import { planChosenPath } from "../../../application/agent-os/planChosenPath";
import { accountBootstrapService } from "../../../application/workspace/AccountBootstrapService";
import {
  anonymousWorkspaceService,
  workspaceService,
} from "../../../application/workspace/WorkspaceService";
import {
  clearAnonymousOwnerId,
  getOrCreateAnonymousOwnerId,
  isAnonymousOwnerId,
} from "../../../domain/workspace/anonymousOwner";
import { claimAnonymousWork } from "../../../infrastructure/repositories/claimAnonymousWork";
import { localWorkspaceStore } from "../../../infrastructure/repositories/LocalWorkspaceStore";
import type { UserPreferences } from "../../../domain/workspace/betaChecklist";
import { DEFAULT_PREFERENCES } from "../../../domain/workspace/betaChecklist";
import type {
  KnowledgeType,
  OutcomeFollowed,
  OutcomeVerdict,
  WorkspaceHome,
  WorkspaceRecord,
} from "../../../domain/workspace/types";
import { trackProductEvent } from "../../../infrastructure/analytics/productAnalytics";
import {
  loadUserPreferences,
  saveUserPreferences,
} from "../../../infrastructure/auth/userPreferencesStore";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";

type WorkspaceContextValue = {
  ownerId: string | null;
  home: WorkspaceHome | null;
  workspaces: WorkspaceRecord[];
  loading: boolean;
  error: string | null;
  /**
   * Last dual-write / cloud load failure. Local memory may still be intact —
   * surfaces honest sync state without blocking the decision loop.
   */
  remoteError: string | null;
  /** One-shot message after a sign-in that could not claim local work. */
  notice: string | null;
  dismissNotice: () => void;
  createWorkspace: (name: string, description?: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  setGoal: (title: string, description?: string) => Promise<void>;
  addKnowledge: (input: {
    type: KnowledgeType;
    title: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  updateKnowledge: (
    knowledgeId: string,
    patch: {
      title?: string;
      content?: string;
      metadata?: Record<string, unknown>;
      type?: KnowledgeType;
    }
  ) => Promise<void>;
  deleteKnowledge: (knowledgeId: string) => Promise<void>;
  addNote: (title: string, content: string) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  /** Returns the new simulation id so the UI can open Compare → Report → Save. */
  runSimulation: (objective: string, constraints?: string[]) => Promise<string | null>;
  rerunSimulation: (parentSimulationId: string, constraints?: string[]) => Promise<string | null>;
  /** Decision-graph rollback: fork next version from N0 Open. */
  rebranchFromOpen: (parentSimulationId: string, constraints?: string[]) => Promise<string | null>;
  chooseBestPath: (simulationId: string, futureId: string) => Promise<void>;
  recordOutcomeFollowed: (simulationId: string, followed: OutcomeFollowed) => Promise<void>;
  recordOutcomeResult: (
    simulationId: string,
    resultNote: string,
    verdict?: OutcomeVerdict | null
  ) => Promise<void>;
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  markShareAcknowledged: () => void;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Anonymous visitors get the local-only service. Selecting by owner id keeps the
 * boundary structural: there is no cloud store to accidentally write to, rather
 * than a flag each call site must remember to check.
 */
function serviceFor(ownerId: string | null) {
  return isAnonymousOwnerId(ownerId) ? anonymousWorkspaceService : workspaceService;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [home, setHome] = useState<WorkspaceHome | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  /** After first hydrate, background sync must not flip loading (unmounts forms). */
  const hasHydratedRef = useRef(false);
  const ownerIdRef = useRef<string | null>(null);

  const syncRemoteError = useCallback(() => {
    // Anonymous mode has no remote, so it can never have a remote error.
    setRemoteError(
      isAnonymousOwnerId(ownerIdRef.current) ? null : workspaceService.getRemoteError()
    );
  }, []);

  const resolveOwnerId = useCallback(async (): Promise<string | null> => {
    const session = await authService.currentSession();
    if (session?.user?.id) return session.user.id;
    const user = await authService.currentUser();
    if (user?.id) return user.id;
    // No account: the workspace still opens, backed by local storage only.
    return getOrCreateAnonymousOwnerId();
  }, []);

  /**
   * Reload workspace from local + cloud.
   * @param quiet When true, keep the shell mounted so in-progress form drafts survive
   *   (tab focus token refresh, soft revalidate). Default: show loading only before first hydrate.
   */
  const refresh = useCallback(
    async (options?: { quiet?: boolean }) => {
      const quiet = options?.quiet === true || hasHydratedRef.current;
      if (!quiet) {
        setLoading(true);
      }
      setError(null);
      try {
        const session = await authService.currentSession();
        const user = session?.user ?? (await authService.currentUser());
        const id = user?.id ?? null;
        if (!id || !user) {
          // No account: hydrate an anonymous, local-only workspace rather than
          // an empty shell. Signing in later claims this work.
          const anonId = getOrCreateAnonymousOwnerId();
          const anonService = serviceFor(anonId);
          const [anonHome, anonList] = await Promise.all([
            anonService.load(anonId),
            anonService.listWorkspaces(anonId),
          ]);
          ownerIdRef.current = anonId;
          setOwnerId(anonId);
          setHome(anonHome);
          setWorkspaces(anonList);
          setPreferences(loadUserPreferences(anonId));
          setRemoteError(null);
          hasHydratedRef.current = true;
          return;
        }
        setOwnerId(id);
        ownerIdRef.current = id;
        setPreferences(loadUserPreferences(id));

        // Profile → personal workspace → owner membership
        try {
          await accountBootstrapService.ensureAccount(user);
        } catch (err) {
          console.warn("[chronos] account bootstrap failed", err);
        }

        const [loaded, list] = await Promise.all([
          serviceFor(id).load(id),
          serviceFor(id).listWorkspaces(id),
        ]);
        setHome(loaded);
        setWorkspaces(list);
        hasHydratedRef.current = true;
        syncRemoteError();
      } catch (err) {
        setError((err as Error).message);
        syncRemoteError();
      } finally {
        setLoading(false);
      }
    },
    [syncRemoteError]
  );

  useEffect(() => {
    trackProductEvent("session_start");
    void refresh({ quiet: false });
    const { data } = authService.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        hasHydratedRef.current = false;
        ownerIdRef.current = null;
        setOwnerId(null);
        setHome(null);
        setWorkspaces([]);
        setLoading(false);
        return;
      }

      // Tab focus / auto-refresh fires TOKEN_REFRESHED — must not remount workspace
      // (loading screen unmounts <Outlet /> and wipes objective/note drafts).
      if (event === "TOKEN_REFRESHED") {
        return;
      }

      // Duplicate of initial refresh path; soft revalidate only if needed.
      if (event === "INITIAL_SESSION") {
        if (!hasHydratedRef.current) {
          void refresh({ quiet: false });
        }
        return;
      }

      const nextId = session.user?.id ?? null;
      const userChanged = Boolean(nextId && nextId !== ownerIdRef.current);

      // Anonymous → signed in: move local work onto the account before the
      // reload, so the refresh below reads the claimed bundle and the existing
      // cloud backfill pushes it to Supabase. Claiming refuses to merge into an
      // account that already has decisions, so nothing is ever overwritten.
      const previousOwnerId = ownerIdRef.current;
      if (nextId && previousOwnerId && isAnonymousOwnerId(previousOwnerId)) {
        const result = claimAnonymousWork(localWorkspaceStore, previousOwnerId, nextId);
        if (result.outcome === "claimed") {
          clearAnonymousOwnerId();
          trackProductEvent("anonymous_work_claimed");
        } else if (result.outcome === "kept-separate") {
          // Both bundles survive; say so rather than letting the visitor think
          // their local decisions vanished.
          setNotice(
            "Signed in. This account already had decisions, so your local work was kept separate on this device."
          );
          trackProductEvent("anonymous_work_kept_separate");
        }
      }

      trackProductEvent("session_start", { authEvent: event });
      // Full loading flash only on true sign-in / account switch.
      void refresh({ quiet: !userChanged && hasHydratedRef.current });
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const withOwner = useCallback(
    async (action: (id: string) => Promise<WorkspaceHome>) => {
      const id = ownerId ?? (await resolveOwnerId());
      if (!id) {
        const message = "Not signed in. Sign in again to continue.";
        setError(message);
        throw new Error(message);
      }
      if (!ownerId) setOwnerId(id);
      setError(null);
      try {
        const next = await action(id);
        setHome(next);
        const list = await serviceFor(id).listWorkspaces(id);
        setWorkspaces(list);
        syncRemoteError();
        return next;
      } catch (err) {
        setError((err as Error).message);
        syncRemoteError();
        throw err;
      }
    },
    [ownerId, resolveOwnerId, syncRemoteError]
  );

  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      if (!ownerId) return;
      const next = saveUserPreferences(ownerId, patch);
      setPreferences(next);
    },
    [ownerId]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ownerId,
      home,
      workspaces,
      loading,
      error,
      remoteError,
      notice,
      dismissNotice: () => setNotice(null),
      preferences,
      updatePreferences,
      markShareAcknowledged: () => updatePreferences({ shareAcknowledged: true }),
      refresh,
      createWorkspace: async (name, description) => {
        const next = await withOwner((id) =>
          serviceFor(id).createWorkspace(id, name, description ?? "")
        );
        trackProductEvent("workspace_created", {
          workspaceId: next.workspace.id,
          name: next.workspace.name,
        });
      },
      switchWorkspace: async (workspaceId) => {
        const id = ownerId ?? (await resolveOwnerId());
        if (!id) {
          const message = "Not signed in. Sign in again to continue.";
          setError(message);
          throw new Error(message);
        }
        if (!ownerId) setOwnerId(id);
        setLoading(true);
        setError(null);
        try {
          const next = await serviceFor(id).switchWorkspace(id, workspaceId);
          setHome(next);
          setWorkspaces(await serviceFor(id).listWorkspaces(id));
          trackProductEvent("workspace_opened", { workspaceId });
        } catch (err) {
          setError((err as Error).message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      setGoal: async (title, description) => {
        await withOwner((id) => serviceFor(id).setGoal(id, title, description ?? ""));
        trackProductEvent("goal_set", { titleLength: title.trim().length });
      },
      addKnowledge: async (input) => {
        await withOwner((id) => serviceFor(id).addKnowledge(id, input));
        trackProductEvent("knowledge_added", { type: input.type });
      },
      updateKnowledge: async (knowledgeId, patch) => {
        await withOwner((id) => serviceFor(id).updateKnowledge(id, knowledgeId, patch));
      },
      deleteKnowledge: async (knowledgeId) => {
        await withOwner((id) => serviceFor(id).deleteKnowledge(id, knowledgeId));
      },
      addNote: async (title, content) => {
        await withOwner((id) => serviceFor(id).addNote(id, title, content));
        trackProductEvent("knowledge_added", { type: "note" });
      },
      deleteNote: async (noteId) => {
        await withOwner((id) => serviceFor(id).deleteNote(id, noteId));
      },
      runSimulation: async (objective, constraints = []) => {
        // Analytics: SimulationStarted/Finished → productEventSubscribers
        const next = await withOwner((id) =>
          serviceFor(id).runSimulation(id, objective, constraints)
        );
        const sim = next.recentSimulations[0];
        return sim?.id ?? null;
      },
      rerunSimulation: async (parentSimulationId, constraints) => {
        const next = await withOwner((id) =>
          serviceFor(id).rerunSimulation(id, parentSimulationId, constraints)
        );
        const sim = next.recentSimulations[0];
        return sim?.id ?? null;
      },
      rebranchFromOpen: async (parentSimulationId, constraints) => {
        const next = await withOwner((id) =>
          serviceFor(id).rebranchFromOpen(id, parentSimulationId, constraints)
        );
        const sim = next.recentSimulations[0];
        return sim?.id ?? null;
      },
      chooseBestPath: async (simulationId, futureId) => {
        const saved = await withOwner((id) =>
          serviceFor(id).chooseBestPath(id, simulationId, futureId)
        );
        trackProductEvent("path_chosen", { simulationId, futureId });

        // Best-effort execution plan for the path just committed to. Runs after
        // the decision is durable and swallows its own failures — a plan is a
        // bonus on top of a saved decision, never a condition of one.
        try {
          const sim = saved.recentSimulations.find((s) => s.id === simulationId);
          const future = (saved.futuresBySimulation[simulationId] ?? []).find(
            (f) => f.id === futureId
          );
          if (!sim || !future) return;

          const plan = await planChosenPath(getDefaultCapabilityRegistry(), {
            objective: sim.title,
            pathName: future.name,
            pathSummary: future.summary,
          });
          if (plan.steps.length === 0) return;

          await withOwner((id) =>
            serviceFor(id).saveExecutionPlan(id, simulationId, plan.steps, plan.source)
          );
        } catch (err) {
          console.warn("[chronos] execution plan skipped; decision stands.", err);
        }
      },
      recordOutcomeFollowed: async (simulationId, followed) => {
        await withOwner((id) => serviceFor(id).recordOutcomeFollowed(id, simulationId, followed));
        trackProductEvent("outcome_followed", { simulationId, followed });
      },
      recordOutcomeResult: async (simulationId, resultNote, verdict) => {
        await withOwner((id) =>
          serviceFor(id).recordOutcomeResult(id, simulationId, resultNote, verdict)
        );
        trackProductEvent("outcome_result", {
          simulationId,
          noteLength: resultNote.trim().length,
        });
      },
    }),
    [
      ownerId,
      home,
      workspaces,
      loading,
      error,
      remoteError,
      notice,
      preferences,
      updatePreferences,
      refresh,
      withOwner,
      resolveOwnerId,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
