import { Navigate } from "react-router-dom"

// /copilot-integration/{connectionId} opens the Copilot integration in Settings.
// The connection ID is accepted for link compatibility but not used yet.
export default function CopilotIntegrationRedirect() {
  return <Navigate replace to="/settings?section=microsoft-copilot" />
}
