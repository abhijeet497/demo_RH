// Org scoping for the p_org_id-first RPCs (ENG-382 N6, expand-contract COMPLETE).
// This used to be gated on MULTI_ORG_ENABLED so a flag-off build bound to the LEGACY (no-p_org_id)
// overloads — deploy-order decoupling during the expand phase. The contract phase has since shipped:
// nextjs #275/#276 re-created/dropped the legacy arities, so the DB now accepts ONLY the p_org_id
// forms and a flag-off caller gets PGRST202 ("could not find function … (p_agent_types, p_plans)").
// p_org_id is therefore passed whenever the active org is known (post-bootstrap it always is —
// flag-off/non-admin resolves it to the home org, which is exactly the right scope). The feature
// flag still gates the org-access UI (routes/switcher/admin bootstrap); it must NOT gate data
// correctness. Spread into the RPC args object — spread order doesn't matter, since no other RPC
// arg sets p_org_id: `supabase.rpc(fn, { ...orgRpcArgs(activeOrgId), ...otherArgs })`.
export function orgRpcArgs(activeOrgId: string | null): { p_org_id?: string } {
  return activeOrgId ? { p_org_id: activeOrgId } : {};
}
