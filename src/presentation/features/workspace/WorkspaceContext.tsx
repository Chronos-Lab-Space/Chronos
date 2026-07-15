import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { workspaceService } from "../../../application/workspace/WorkspaceService";
import type { KnowledgeType, WorkspaceHome } from "../../../domain/workspace/types";
import { authService } from "../../../infrastructure/auth/SupabaseAuthService";

type WorkspaceContextValue = {
  ownerId: string | null;
  home: WorkspaceHome | null;
  loading: boolean;
  error: string | null;
  createWorkspace: (name: string) => Promise<void>;
  setGoal: (title: string, description?: string) => Promise<void>;
  addKnowledge: (input: {
    type: KnowledgeType;
    title: string;
    content?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<void>;
  addNote: (title: string, content: string) => Promise<void>;
  runSimulation: (objective: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [home, setHome] = useState<WorkspaceHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await authService.currentUser();
      if (!user) {
        setOwnerId(null);
        setHome(null);
        return;
      }
      setOwnerId(user.id);
      setHome(workspaceService.load(user.id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const { data } = authService.onAuthStateChange(() => {
      void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const withOwner = useCallback(
    async (action: (id: string) => WorkspaceHome) => {
      if (!ownerId) throw new Error("Not signed in.");
      setError(null);
      try {
        const next = action(ownerId);
        setHome(next);
      } catch (err) {
        setError((err as Error).message);
        throw err;
      }
    },
    [ownerId]
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      ownerId,
      home,
      loading,
      error,
      refresh,
      createWorkspace: async (name) => {
        await withOwner((id) => workspaceService.createWorkspace(id, name));
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
      runSimulation: async (objective) => {
        await withOwner((id) => workspaceService.runSimulation(id, objective));
      },
    }),
    [ownerId, home, loading, error, refresh, withOwner]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
