import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { accountBootstrapService } from "../../../application/workspace/AccountBootstrapService";
import { workspaceService } from "../../../application/workspace/WorkspaceService";
import type {
  UserPreferences,
} from "../../../domain/workspace/betaChecklist";
import { DEFAULT_PREFERENCES } from "../../../domain/workspace/betaChecklist";
import type {
  KnowledgeType,
  OutcomeFollowed,
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
  chooseBestPath: (simulationId: string, futureId: string) => Promise<void>;
  recordOutcomeFollowed: (
    simulationId: string,
    followed: OutcomeFollowed
  ) => Promise<void>;
  recordOutcomeResult: (simulationId: string, resultNote: string) => Promise<void>;
  preferences: UserPreferences;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  markShareAcknowledged: () => void;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [home, setHome] = useState<WorkspaceHome | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  /** After first hydrate, background sync must not flip loading (unmounts forms). */
  const hasHydratedRef = useRef(false);
  const ownerIdRef = useRef<string | null>(null);

  const syncRemoteError = useCallback(() => {
    setRemoteError(workspaceService.getRemoteError());
  }, []);

  const resolveOwnerId = useCallback(async (): Promise<string | null> => {
    const session = await authService.currentSession();
    if (session?.user?.id) return session.user.id;
    const user = await authService.currentUser();
    return user?.id ?? null;
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
          hasHydratedRef.current = false;
          ownerIdRef.current = null;
          setOwnerId(null);
          setHome(null);
          setWorkspaces([]);
          setPreferences(DEFAULT_PREFERENCES);
          setRemoteError(null);
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
          workspaceService.load(id),
          workspaceService.listWorkspaces(id),
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
        const list = await workspaceService.listWorkspaces(id);
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
      preferences,
      updatePreferences,
      markShareAcknowledged: () => updatePreferences({ shareAcknowledged: true }),
      refresh,
      createWorkspace: async (name, description) => {
        const next = await withOwner((id) =>
          workspaceService.createWorkspace(id, name, description ?? "")
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
          const next = await workspaceService.switchWorkspace(id, workspaceId);
          setHome(next);
          setWorkspaces(await workspaceService.listWorkspaces(id));
          trackProductEvent("workspace_opened", { workspaceId });
        } catch (err) {
          setError((err as Error).message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      setGoal: async (title, description) => {
        await withOwner((id) => workspaceService.setGoal(id, title, description ?? ""));
        trackProductEvent("goal_set", { titleLength: title.trim().length });
      },
      addKnowledge: async (input) => {
        await withOwner((id) => workspaceService.addKnowledge(id, input));
        trackProductEvent("knowledge_added", { type: input.type });
      },
      updateKnowledge: async (knowledgeId, patch) => {
        await withOwner((id) => workspaceService.updateKnowledge(id, knowledgeId, patch));
      },
      deleteKnowledge: async (knowledgeId) => {
        await withOwner((id) => workspaceService.deleteKnowledge(id, knowledgeId));
      },
      addNote: async (title, content) => {
        await withOwner((id) => workspaceService.addNote(id, title, content));
        trackProductEvent("knowledge_added", { type: "note" });
      },
      deleteNote: async (noteId) => {
        await withOwner((id) => workspaceService.deleteNote(id, noteId));
      },
      runSimulation: async (objective, constraints = []) => {
        trackProductEvent("simulation_started", {
          objectiveLength: objective.trim().length,
          constraintCount: constraints.length,
        });
        const next = await withOwner((id) =>
          workspaceService.runSimulation(id, objective, constraints)
        );
        const sim = next.recentSimulations[0];
        trackProductEvent("simulation_completed", {
          simulationId: sim?.id,
          status: sim?.status,
          futures: sim?.result?.futures_count,
        });
        return sim?.id ?? null;
      },
      rerunSimulation: async (parentSimulationId, constraints) => {
        trackProductEvent("simulation_started", {
          parentSimulationId,
          rerun: true,
        });
        const next = await withOwner((id) =>
          workspaceService.rerunSimulation(id, parentSimulationId, constraints)
        );
        const sim = next.recentSimulations[0];
        trackProductEvent("simulation_completed", {
          simulationId: sim?.id,
          status: sim?.status,
          rerun: true,
        });
        return sim?.id ?? null;
      },
      chooseBestPath: async (simulationId, futureId) => {
        await withOwner((id) => workspaceService.chooseBestPath(id, simulationId, futureId));
        trackProductEvent("path_chosen", { simulationId, futureId });
      },
      recordOutcomeFollowed: async (simulationId, followed) => {
        await withOwner((id) =>
          workspaceService.recordOutcomeFollowed(id, simulationId, followed)
        );
        trackProductEvent("outcome_followed", { simulationId, followed });
      },
      recordOutcomeResult: async (simulationId, resultNote) => {
        await withOwner((id) =>
          workspaceService.recordOutcomeResult(id, simulationId, resultNote)
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
