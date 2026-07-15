import { Navigate } from "react-router-dom";

/**
 * Legacy path. Authenticated product home is the Workspace.
 */
export function Dashboard() {
  return <Navigate to="/workspace" replace />;
}
