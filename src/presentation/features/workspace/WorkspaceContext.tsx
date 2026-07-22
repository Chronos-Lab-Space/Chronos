import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { workspaceService } from "../../../application/workspace/WorkspaceService";
import type {
  KnowledgeType,
  WorkspaceHome,
  WorkspaceRecord,
} from "../../../domain/workspace/types";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";

type WorkspaceContextValue = {
  ownerId: string | null;
  home: WorkspaceHome | null;
  workspaces: WorkspaceRecord[];
  loading: boolean;
  error: string | null;
  /** Non-fatal cloud dual-write / load failure (local data may still be fine). */
  syncWarning: string | null;
  createWorkspace: (name: string, description?: string) => Promise<void>;
  switchWorkspace: (workspaceId: string) => Promise<void>;
  setGoal: (title: string, description?: string) => Promise<void>;
  addKnowledge: (input: {
    type: KnowledgeType;
    title: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  addNote: (title: string, content: string) => Promise<void>;
  runSimulation: (objective: string, constraints?: string[]) => Promise<string | null>;
  rerunSimulation: (parentSimulationId: string, constraints?: string[]) => Promise<string | null>;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [home, setHome] = useState<WorkspaceHome | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  const pullRemoteWarning = useCallback(() => {
    setSyncWarning(workspaceService.getRemoteError());
  }, []);

  /**
   * Prefer local session (same source as ProtectedRoute) so createWorkspace
   * does not race a null ownerId after magic-link recovery or slow first paint.
   */
  const resolveOwnerId = useCallback(async (): Promise<string | null> => {
    const session = await authService.currentSession();
    if (session?.user?.id) return session.user.id;
    const user = await authService.currentUser();
    return user?.id ?? null;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await resolveOwnerId();
      if (!id) {
        setOwnerId(null);
        setHome(null);
        setWorkspaces([]);
        return;
      }
      setOwnerId(id);
      const [loaded, list] = await Promise.all([
        workspaceService.load(id),
        workspaceService.listWorkspaces(id),
      ]);
      setHome(loaded);
      setWorkspaces(list);
      pullRemoteWarning();
    } catch (err) {
      setError((err as Error).message);
      pullRemoteWarning();
    } finally {
      setLoading(false);
    }
  }, [resolveOwnerId, pullRemoteWarning]);

  useEffect(() => {
    void refresh();
    const { data } = authService.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setOwnerId(null);
        setHome(null);
        setWorkspaces([]);
        setLoading(false);
        return;
      }
      void refresh();
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
        pullRemoteWarning();
        return next;
      } catch (err) {
        setError((err as Error).message);
        pullRemoteWarning();
        throw err;
      }
    },
    [ownerId, resolveOwnerId, pullRemoteWarning]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ownerId,
      home,
      workspaces,
      loading,
      error,
      syncWarning,
      refresh,
      createWorkspace: async (name, description) => {
        await withOwner((id) => workspaceService.createWorkspace(id, name, description ?? ""));
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
          const list = await workspaceService.listWorkspaces(id);
          setWorkspaces(list);
        } catch (err) {
          setError((err as Error).message);
          throw err;
        } finally {
          setLoading(false);
        }
      },
      setGoal: async (title, description) => {
        await withOwner((id) => workspaceService.setGoal(id, title, description ?? ""));
      },
      addKnowledge: async (input) => {
        await withOwner((id) => workspaceService.addKnowledge(id, input));
      },
      addNote: async (title, content) => {
        await withOwner((id) => workspaceService.addNote(id, title, content));
      },
      runSimulation: async (objective, constraints = []) => {
        const next = await withOwner((id) =>
          workspaceService.runSimulation(id, objective, constraints)
        );
        return next.recentSimulations[0]?.id ?? null;
      },
      rerunSimulation: async (parentSimulationId, constraints) => {
        const next = await withOwner((id) =>
          workspaceService.rerunSimulation(id, parentSimulationId, constraints)
        );
        return next.recentSimulations[0]?.id ?? null;
      },
    }),
    [ownerId, home, workspaces, loading, error, syncWarning, refresh, withOwner, resolveOwnerId]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
