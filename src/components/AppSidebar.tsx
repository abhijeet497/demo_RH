import { Users, Settings, Shield, ChevronDown, Network, PlayCircle, AlertTriangle, LayoutDashboard, Building2, ClipboardList, Globe, Package, Target } from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import traceforceLogo from "/lovable-uploads/new-icon.png"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useOrg } from "@/contexts/OrgContext"
import { MULTI_ORG_ENABLED } from "@/lib/featureFlags"
import { TenantSwitcher } from "@/components/TenantSwitcher"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"
import { mcpAccessEnabled } from "@/lib/featureFlags"
import { useFeatureFlag } from "@/hooks/use-feature-flag"
import { LLM_UI_FLAG } from "@/lib/llmModels"

const inventoryItems = [
  { title: "AI Agents", url: "/agents" },
  { title: "LLM Models", url: "/llm-models" },
  { title: "Connectors", url: "/mcps" },
]

const issueItems = [
  { title: "Agent Issues", url: "/agent-issues" },
  { title: "Connector Issues", url: "/mcp-issues" },
]

const userManagementItems = [
  { title: "Devices", url: "/devices" },
  { title: "Directory Users", url: "/directory-users" },
]

type NavItem = { title: string; url: string; children?: NavItem[] }

const atlasRegistryItems: NavItem[] = [
  { title: "Overview", url: "/atlas-registry" },
  { title: "Risk Frameworks", url: "/risk-frameworks" },
  { title: "AI Agent Registry", url: "/agent-registry" },
  {
    title: "Connector Registry",
    url: "/mcp-registry",
    children: [
      { title: "Vulnerability Tracking", url: "/vulnerabilities" },
    ],
  },
  { title: "LLM Model Registry", url: "/llm-model-registry" },
]

// Flattened (parents + nested children) for active-route matching.
const atlasRegistryUrls = atlasRegistryItems.flatMap((item) => [item.url, ...(item.children ?? []).map((c) => c.url)])

const policiesItems = [
  { title: "Control Policies", url: "/policies" },
  // One-off requests from users for access beyond what Control Policies allow.
  ...(mcpAccessEnabled ? [{ title: "Access Requests", url: "/mcp-access" }] : []),
]

// Regular-user navigation. Role-agnostic paths (see the
// route split in App.tsx); admins get the full nav below including Atlas Registry.
const userNavItems = [
  { title: "Connector Registry", url: "/mcp-registry", icon: Network },
  { title: "My Requests", url: "/requests", icon: ClipboardList },
]

export function AppSidebar() {
  const { state } = useSidebar()
  const { isMultiOrg, orgRole } = useOrg()
  const { isRegularUser } = useAuth()
  const { enabled: llmEnabled } = useFeatureFlag(LLM_UI_FLAG)
  const location = useLocation()
  const currentPath = location.pathname
  const [isInventoryOpen, setIsInventoryOpen] = useState(
    inventoryItems.some(item => currentPath === item.url || currentPath.startsWith(item.url + "/"))
  )
  const [isIssuesOpen, setIsIssuesOpen] = useState(
    issueItems.some(item => currentPath === item.url)
  )
  const [isPoliciesOpen, setIsPoliciesOpen] = useState(
    policiesItems.some(item => currentPath === item.url || currentPath.startsWith(item.url + "/"))
  )
  const [isAtlasOpen, setIsAtlasOpen] = useState(
    atlasRegistryUrls.some(url => currentPath === url || currentPath.startsWith(url + "/"))
  )
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(
    userManagementItems.some(item => currentPath === item.url || currentPath.startsWith(item.url + "/"))
  )

  useEffect(() => {
    if (inventoryItems.some((item) => currentPath === item.url || currentPath.startsWith(item.url + "/"))) {
      setIsInventoryOpen(true)
    }
    if (issueItems.some((item) => currentPath === item.url)) {
      setIsIssuesOpen(true)
    }
    if (userManagementItems.some((item) => currentPath === item.url || currentPath.startsWith(item.url + "/"))) {
      setIsUserMgmtOpen(true)
    }
    if (policiesItems.some((item) => currentPath === item.url || currentPath.startsWith(item.url + "/"))) {
      setIsPoliciesOpen(true)
    }
    if (atlasRegistryUrls.some((url) => currentPath === url || currentPath.startsWith(url + "/"))) {
      setIsAtlasOpen(true)
    }
  }, [currentPath])

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted/50"

  return (
    <Sidebar collapsible="icon">
      {!isRegularUser && isMultiOrg && orgRole === "admin" && state !== "collapsed" && (
        <SidebarHeader className="p-2">
          <TenantSwitcher />
        </SidebarHeader>
      )}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <NavLink to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <img src={traceforceLogo} alt="Traceforce" className="w-5 h-5" />
              <span>Traceforce</span>
            </NavLink>
          </SidebarGroupLabel>

          <SidebarGroupContent>
            <SidebarMenu>
              {isRegularUser ? (
                userNavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls}>
                        <item.icon className="mr-2 h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/dashboard" end className={getNavCls} data-tour="nav-dashboard">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <Collapsible open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton className="hover:bg-muted/50" data-tour="nav-ai-inventory">
                          <Package className="mr-2 h-4 w-4" />
                          <span>AI Inventory</span>
                          <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isInventoryOpen ? 'rotate-180' : ''}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                        <SidebarMenu className="ml-6 border-l border-sidebar-border pl-2">
                          {inventoryItems.filter((item) => llmEnabled || item.url !== "/llm-models").map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <NavLink to={item.url} end className={getNavCls}>
                                  <span>{item.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </Collapsible>
                  </SidebarMenuItem>
                </>
              )}

              {!isRegularUser && (
              <SidebarMenuItem>
                <Collapsible open={isIssuesOpen} onOpenChange={setIsIssuesOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-muted/50" data-tour="nav-issues">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      <span>Issues</span>
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isIssuesOpen ? 'rotate-180' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenu className="ml-6 border-l border-sidebar-border pl-2 [&_[data-sidebar=menu-button]]:h-auto [&_[data-sidebar=menu-button]]:min-h-8 [&_span:last-child]:!whitespace-normal [&_span:last-child]:leading-tight">
                      {issueItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              className={getNavCls}
                              data-tour={item.url === "/agent-issues" ? "nav-agent-issues" : undefined}
                            >
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
              )}

              {!isRegularUser && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/red-teaming" end className={getNavCls}>
                    <Target className="mr-2 h-4 w-4" />
                    <span>Red Teaming</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              )}

              {!isRegularUser && (
              <SidebarMenuItem>
                <Collapsible open={isUserMgmtOpen} onOpenChange={setIsUserMgmtOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-muted/50">
                      <Users className="mr-2 h-4 w-4" />
                      <span>User Management</span>
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isUserMgmtOpen ? 'rotate-180' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenu className="ml-6 border-l border-sidebar-border pl-2 [&_[data-sidebar=menu-button]]:h-auto [&_[data-sidebar=menu-button]]:min-h-8 [&_span:last-child]:!whitespace-normal [&_span:last-child]:leading-tight">
                      {userManagementItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={item.url} end className={getNavCls}>
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
              )}

              {!isRegularUser && (
              <SidebarMenuItem>
                <Collapsible open={isPoliciesOpen} onOpenChange={setIsPoliciesOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-muted/50" data-tour="nav-policies-group">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Policies</span>
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isPoliciesOpen ? 'rotate-180' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenu className="ml-6 border-l border-sidebar-border pl-2 [&_[data-sidebar=menu-button]]:h-auto [&_[data-sidebar=menu-button]]:min-h-8 [&_span:last-child]:!whitespace-normal [&_span:last-child]:leading-tight">
                      {policiesItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end={item.url === "/policies"}
                              className={getNavCls}
                              data-tour={item.url === "/policies" ? "nav-policies" : undefined}
                            >
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
              )}

              {!isRegularUser && (
              <SidebarMenuItem>
                <Collapsible open={isAtlasOpen} onOpenChange={setIsAtlasOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="hover:bg-muted/50" data-tour="nav-atlas-registry">
                      <Globe className="mr-2 h-4 w-4" />
                      <span>Atlas Registry</span>
                      <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${isAtlasOpen ? 'rotate-180' : ''}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <SidebarMenu className="ml-6 border-l border-sidebar-border pl-2 [&_[data-sidebar=menu-button]]:h-auto [&_[data-sidebar=menu-button]]:min-h-8 [&_span:last-child]:!whitespace-normal [&_span:last-child]:leading-tight">
                      {atlasRegistryItems.filter((item) => llmEnabled || item.url !== '/llm-model-registry').map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={item.url} end={item.url !== "/risk-frameworks"} className={getNavCls}>
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                          {item.children && item.children.length > 0 && (
                            <SidebarMenu className="ml-3 border-l border-sidebar-border pl-2">
                              {item.children.map((child) => (
                                <SidebarMenuItem key={child.title}>
                                  <SidebarMenuButton asChild>
                                    <NavLink to={child.url} end className={getNavCls}>
                                      <span>{child.title}</span>
                                    </NavLink>
                                  </SidebarMenuButton>
                                </SidebarMenuItem>
                              ))}
                            </SidebarMenu>
                          )}
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
              )}

              {!isRegularUser && (
                <>
                  <div className="my-2">
                    <Separator />
                  </div>

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/getting-started" end className={getNavCls} data-tour="nav-getting-started">
                        <PlayCircle className="mr-2 h-4 w-4" />
                        <span>Getting Started</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {MULTI_ORG_ENABLED && orgRole === "admin" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/org-access" end className={getNavCls}>
                          <Building2 className="mr-2 h-4 w-4" />
                          <span>Org Access</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/settings" end className={getNavCls}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
