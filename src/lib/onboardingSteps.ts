export type OnboardingStep = {
  target: string
  title: string
  content: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: "[data-tour='nav-dashboard']",
    title: "Dashboard",
    content:
      "Your executive overview — risk posture, top issues, and one-click PDF report generation.",
  },
  {
    target: "[data-tour='nav-ai-inventory']",
    title: "AI Inventory",
    content:
      "Browse every AI agent, LLM model, and connector discovered across your fleet, with risk scores and security posture.",
  },
  {
    target: "[data-tour='nav-issues']",
    title: "Issues",
    content:
      "Triage open agent and connector security issues, ranked by severity, with remediation guidance.",
  },
  {
    target: "[data-tour='nav-policies-group']",
    title: "Policies",
    content:
      "Review and set controls — Control user identity, block sensitive data leakage and dangerous operations.",
  },
  {
    target: "[data-tour='nav-getting-started']",
    title: "Getting Started",
    content:
      "Create API credentials and download the scanner package to start discovering AI usage.",
  },
]
