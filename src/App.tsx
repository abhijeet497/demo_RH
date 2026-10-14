import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { OrgProvider, useOrg } from "./contexts/OrgContext";
import { MULTI_ORG_ENABLED } from "@/lib/featureFlags";
import ProtectedRoute from "./components/ProtectedRoute";
import UserMenu from "./components/UserMenu";
import { useAuth } from "./contexts/AuthContext";
import { AppSidebar } from "./components/AppSidebar";
import Dashboard from "./pages/Dashboard";
import UserRequests from "./pages/user/Requests";
import McpAccess from "./pages/McpAccess";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
import BedrockRuntimeDetail from "./pages/BedrockRuntimeDetail";
import AgentIssues from "./pages/AgentIssues";
import RedTeaming from "./pages/RedTeaming";
import { RedTeamProvider } from "@/lib/redteam/store";
import Policies from "./pages/Policies";
import PolicyDetail from "./pages/PolicyDetail";
import McpAccessPolicyDetail from "./pages/McpAccessPolicyDetail";
import CopilotIntegrationRedirect from "./pages/CopilotIntegrationRedirect";
import Settings from "./pages/Settings";
import Users from "./pages/Users";
import GettingStarted from "./pages/GettingStarted";
import NotFound from "./pages/NotFound";
import RiskFrameworkDetail from "./pages/RiskFrameworkDetail";
import Mcps from "./pages/Mcps";
import McpDetail from "./pages/McpDetail";
import McpIssues from "./pages/McpIssues";
import RiskFrameworks from "./pages/RiskFrameworks";
import AgentRegistry from "./pages/AgentRegistry";
import McpRegistry from "./pages/McpRegistry";
import VulnerabilityDashboard from "./pages/VulnerabilityDashboard";
import LlmModels from "./pages/LlmModels";
import LlmModelDetail from "./pages/LlmModelDetail";
import LlmModelRegistry from "./pages/LlmModelRegistry";
import AtlasRegistry from "./pages/AtlasRegistry";
import OrgAccess from "./pages/OrgAccess";
import Devices from "./pages/Devices";
import DirectoryUsers from "./pages/DirectoryUsers";
import DeviceDetail from "./pages/DeviceDetail";
import CopilotAgentDetail from "./pages/CopilotAgentDetail";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import ScrollToTop from "./components/ScrollToTop";
import { TrialModeBanner } from "./components/TrialModeBanner";
import { SubsidiaryBanner } from "./components/SubsidiaryBanner";
import { OnboardingTour } from "./components/OnboardingTour";
import { mcpAccessEnabled, copilotEnabled, awsBedrockEnabled } from "./lib/featureFlags";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { LLM_UI_FLAG } from "@/lib/llmModels";

const queryClient = new QueryClient();
const trialMode = import.meta.env.VITE_TRIAL_MODE === "true";

// Authenticated shell. Lives under OrgProvider so it can call useOrg(), key the inner <Routes> on
// the active org (clears stale page state on switch), and mount SubsidiaryBanner. The shell gate
// blocks all routes until activeOrgId resolves, and surfaces an error+reload if it can't —
// REGARDLESS of MULTI_ORG_ENABLED. This is load-bearing in BOTH flag states: the org-scoped pages
// (added by the U3 query sweep — flag-OFF they scope to the home org, which OrgContext's else branch
// resolves into activeOrgId) filter reads by activeOrgId, so a null activeOrgId would otherwise turn
// those reads into silently-empty reads (org_id=eq.null). The gate only triggers on a genuine resolve
// failure (the normal path resolves to the home org and renders), so it makes the activeOrgId!
// assertions in those reads safe by construction and fails loudly instead of silently. (Reviewed
// against U2's diff alone the consumers look absent — they land one layer up in U3.)
const AppShell: React.FC = () => {
  const { activeOrgId, loading: orgLoading, error: orgError } = useOrg();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <SidebarTrigger />
            <div className="flex items-center gap-1">
              <HeaderDocLinks />
              <UserMenu />
            </div>
          </header>
          <TrialModeBanner />
          <SubsidiaryBanner />
          <main className="flex-1 bg-background">
            {orgLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
            ) : (orgError || !activeOrgId) ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <p>Couldn't load your organization.</p>
                <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
              </div>
            ) : (
              <RedTeamProvider>
                <AppRoutes key={activeOrgId} />
              </RedTeamProvider>
            )}
          </main>
        </div>
      </div>
      <OnboardingTour />
    </SidebarProvider>
  );
};

// Route trees are split by entitlement, resolved from the JWT (see
// isRegularUser). The role is implicit in the session — a regular user only
// ever renders this tree — so the paths are role-agnostic (no /user/ prefix):
// the same URL renders the user's view here and the admin's view in
// AdminRoutes. Any unknown path bounces to the requests landing.
const UserRoutes = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/requests" replace />} />
    <Route path="/requests" element={<UserRequests />} />
    <Route path="/mcp-registry" element={<McpRegistry />} />
    <Route path="/agent-registry" element={<AgentRegistry />} />
    <Route path="*" element={<Navigate to="/requests" replace />} />
  </Routes>
);

const AdminRoutes = () => {
  const { enabled: llmEnabled, isLoading: llmLoading } = useFeatureFlag(LLM_UI_FLAG);
  return (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/report" element={<Navigate to="/dashboard" replace />} />
    <Route path="/agents" element={<Agents />} />
    {awsBedrockEnabled && <Route path="/bedrock-inventory/:account/:region/:runtimeId" element={<BedrockRuntimeDetail />} />}
    {awsBedrockEnabled && <Route path="/bedrock-inventory/:region/:runtimeId" element={<BedrockRuntimeDetail />} />}
    <Route path="/agent-issues" element={<AgentIssues />} />
    <Route path="/red-teaming" element={<RedTeaming />} />
    <Route path="/agents/:id" element={<AgentDetail />} />
    <Route path="/policies" element={<Policies />} />
    <Route path="/policies/:id" element={<PolicyDetail />} />
    {/* MCP access policies (category 4) get their own editor — PolicyDetail's
        scan-policy surface is meaningless for them. */}
    {mcpAccessEnabled && <Route path="/policies/:id/access" element={<McpAccessPolicyDetail />} />}
    <Route path="/risk-frameworks" element={<RiskFrameworks />} />
    <Route path="/atlas-registry" element={<AtlasRegistry />} />
    <Route path="/vulnerabilities" element={<VulnerabilityDashboard />} />
    <Route path="/agent-registry" element={<AgentRegistry />} />
    <Route path="/mcp-registry" element={<McpRegistry />} />
    <Route path="/mcps" element={<Mcps />} />
    <Route path="/mcps/:id" element={<McpDetail />} />
    {mcpAccessEnabled && <Route path="/mcp-access" element={<McpAccess />} />}
    <Route path="/mcp-issues" element={<McpIssues />} />
    {llmEnabled && <Route path="/llm-models" element={<LlmModels />} />}
    {llmEnabled && <Route path="/llm-models/:id" element={<LlmModelDetail />} />}
    {llmEnabled && <Route path="/llm-model-registry" element={<LlmModelRegistry />} />}
    <Route path="/devices" element={<Devices />} />
    <Route path="/devices/:id" element={<DeviceDetail />} />
    <Route path="/directory-users" element={<DirectoryUsers />} />
    {copilotEnabled && <Route path="/copilot-agents/:agentId" element={<CopilotAgentDetail />} />}
    <Route path="/risk-frameworks/:id" element={<RiskFrameworkDetail />} />
    <Route
      path="/users"
      element={!trialMode ? <Navigate to="/agents" replace /> : <Users />}
    />
    <Route path="/settings" element={<Settings />} />
    {copilotEnabled && <Route path="/copilot-integration/:connectionId" element={<CopilotIntegrationRedirect />} />}
    <Route path="/getting-started" element={<GettingStarted />} />
    {MULTI_ORG_ENABLED && (
      <Route path="/org-access" element={<OrgAccess />} />
    )}
    {/* The LLM routes register once the per-org flag loads; until then an LLM URL
        would match here, so wait instead of flashing the 404. */}
    <Route path="*" element={llmLoading ? <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div> : <NotFound />} />
  </Routes>
  );
};

const AppRoutes = () => {
  const { isRegularUser } = useAuth();
  return isRegularUser ? <UserRoutes /> : <AdminRoutes />;
};

const HeaderDocLinks = () => {
  const { isRegularUser } = useAuth();
  if (isRegularUser) return null;
  return (
    <>
      <Button variant="ghost" size="sm" className="h-8" asChild>
        <a
          href="https://traceforce.readme.io/docs/overview"
          target="_blank"
          rel="noopener noreferrer"
          title="User Guide"
          aria-label="Open user guide"
        >
          User Guide
        </a>
      </Button>
      <Button variant="ghost" size="sm" className="h-8" asChild>
        <a
          href="https://traceforce.readme.io/reference/getting-started-1"
          target="_blank"
          rel="noopener noreferrer"
          title="API Docs"
          aria-label="Open API documentation"
        >
          API Docs
        </a>
      </Button>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            {/* Unauthenticated preview of the Red Teaming module (local data only,
                no backend). Lets the UI be reviewed without an SSO login. */}
            <Route
              path="/preview/red-teaming"
              element={
                <RedTeamProvider>
                  <div className="min-h-screen bg-background">
                    <div className="border-b bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
                      Preview · Red Teaming · local recorded data · not signed in
                    </div>
                    <RedTeaming preview />
                  </div>
                </RedTeamProvider>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <OrgProvider>
                    <AppShell />
                  </OrgProvider>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
