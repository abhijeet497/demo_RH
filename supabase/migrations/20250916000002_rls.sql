ALTER POLICY "Allow public delete access to agent_instances" ON "public"."agent_instances" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));

ALTER POLICY "Allow public delete access to agent_issues" ON "public"."agent_issues" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));


ALTER POLICY "Allow public delete access to agents" ON "public"."agents" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));


ALTER POLICY "Allow public delete access to devices" ON "public"."devices" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public delete access to mcp_risk_framework" ON "public"."risk_framework" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public delete access to mcp_risk_scores" ON "public"."risk_scores" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public delete access to mcp_server_instances" ON "public"."mcp_server_instances" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public delete access to mcp_server_issues" ON "public"."mcp_server_issues" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public delete access to mcp_servers" ON "public"."mcp_servers" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public delete access to policies" ON "public"."policies" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public delete access to policy_controls" ON "public"."policy_controls" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to agent_instances" ON "public"."agent_instances" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to agent_issues" ON "public"."agent_issues" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to agents" ON "public"."agents" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to devices" ON "public"."devices" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to mcp_risk_framework" ON "public"."risk_framework" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to mcp_risk_scores" ON "public"."risk_scores" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to mcp_server_instances" ON "public"."mcp_server_instances" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to mcp_server_issues" ON "public"."mcp_server_issues" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to mcp_servers" ON "public"."mcp_servers" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to policies" ON "public"."policies" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public insert access to policy_controls" ON "public"."policy_controls" TO PUBLIC WITH CHECK (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to agent_instances" ON "public"."agent_instances" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to agent_issues" ON "public"."agent_issues" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to agents" ON "public"."agents" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to devices" ON "public"."devices" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to mcp_risk_framework" ON "public"."risk_framework" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to mcp_risk_scores" ON "public"."risk_scores" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to mcp_server_instances" ON "public"."mcp_server_instances" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to mcp_server_issues" ON "public"."mcp_server_issues" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to mcp_servers" ON "public"."mcp_servers" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to policies" ON "public"."policies" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public read access to policy_controls" ON "public"."policy_controls" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to agent_instances" ON "public"."agent_instances" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to agent_issues" ON "public"."agent_issues" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to agents" ON "public"."agents" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to devices" ON "public"."devices" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to mcp_risk_framework" ON "public"."risk_framework" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to mcp_risk_scores" ON "public"."risk_scores" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to mcp_server_instances" ON "public"."mcp_server_instances" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to mcp_server_issues" ON "public"."mcp_server_issues" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to mcp_servers" ON "public"."mcp_servers" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to policies" ON "public"."policies" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));



ALTER POLICY "Allow public update access to policy_controls" ON "public"."policy_controls" TO PUBLIC USING (org_id IN ( SELECT user_profiles.org_id
   FROM user_profiles
  WHERE (user_profiles.id = auth.uid())));