


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agent_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "device_native_id" "text" NOT NULL,
    "install_path" "text",
    "installed_by_user" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."agent_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "agent_instance_id" "uuid" NOT NULL,
    "severity" integer,
    "status" "text" DEFAULT 'active'::"text",
    "issue_detail" "text",
    "remediation" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "issue_type" "uuid",
    CONSTRAINT "agent_issues_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'investigating'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."agent_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "risk_score" integer NOT NULL,
    "description" "text",
    "active_users" integer DEFAULT 0,
    "total_incidents" integer DEFAULT 0,
    "active_issues" integer DEFAULT 0,
    "affected_devices" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_reviewed" timestamp with time zone,
    "actual_score" double precision,
    CONSTRAINT "agents_risk_score_check" CHECK ((("risk_score" >= 10) AND ("risk_score" <= 80))),
    CONSTRAINT "agents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "device_native_id" "text" NOT NULL,
    "friendly_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_server_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "mcp_id" "uuid" NOT NULL,
    "agent_instance_id" "uuid" NOT NULL,
    "device_native_id" "text" NOT NULL,
    "install_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."mcp_server_instances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_server_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "mcp_instance_id" "uuid" NOT NULL,
    "issue_location" "text",
    "severity" integer,
    "status" "text" DEFAULT 'active'::"text",
    "issue_detail" "text",
    "remediation" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "issue_type" "uuid",
    CONSTRAINT "mcp_server_issues_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'investigating'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."mcp_server_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mcp_servers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" NOT NULL,
    "risk_score" integer NOT NULL,
    "description" "text",
    "active_users" integer DEFAULT 0,
    "total_incidents" integer DEFAULT 0,
    "active_issues" integer DEFAULT 0,
    "affected_devices" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_reviewed" timestamp with time zone,
    "native_id" "text" NOT NULL,
    "actual_score" double precision,
    CONSTRAINT "mcp_servers_risk_score_check" CHECK ((("risk_score" >= 10) AND ("risk_score" <= 80))),
    CONSTRAINT "mcp_servers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "mcp_servers_type_check" CHECK (("type" = ANY (ARRAY['local'::"text", 'network'::"text", 'hybrid'::"text"])))
);


ALTER TABLE "public"."mcp_servers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "framework_id" "uuid",
    "assignment" "jsonb",
    "active_issues" bigint,
    "total_incidents" bigint
);


ALTER TABLE "public"."policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."policy_controls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "org_id" "uuid" NOT NULL,
    "attribute_id" "text" NOT NULL,
    "control_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "action" "text",
    "rule_id" "uuid",
    "target_score" bigint
);


ALTER TABLE "public"."policy_controls" OWNER TO "postgres";


COMMENT ON COLUMN "public"."policy_controls"."action" IS 'Action to take when controls are not met';



CREATE TABLE IF NOT EXISTS "public"."risk_baseline_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid",
    "attribute_id" "text",
    "name" "text",
    "score" integer,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "rule_id" "uuid",
    "framework_id" "uuid"
);


ALTER TABLE "public"."risk_baseline_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_framework" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" bigint
);


ALTER TABLE "public"."risk_framework" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_framework_rules" (
    "id" "uuid" NOT NULL,
    "org_id" "uuid",
    "attribute_id" "text",
    "attribute_name" "text",
    "category" "text",
    "description" "text",
    "scoring_criteria" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "category_id" numeric,
    "framework_id" "uuid",
    "implementation_status" integer
);


ALTER TABLE "public"."risk_framework_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "attribute_id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rule_id" "uuid",
    "entity_id" "uuid",
    "framework_id" "uuid"
);


ALTER TABLE "public"."risk_scores" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_instances"
    ADD CONSTRAINT "agent_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_issues"
    ADD CONSTRAINT "agent_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_org_id_name_key" UNIQUE ("org_id", "name");



ALTER TABLE ONLY "public"."agents"
    ADD CONSTRAINT "agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."devices"
    ADD CONSTRAINT "devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_baseline_scores"
    ADD CONSTRAINT "mcp_risk_baseline_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_framework"
    ADD CONSTRAINT "mcp_risk_framework_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_framework_rules"
    ADD CONSTRAINT "mcp_risk_framework_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_scores"
    ADD CONSTRAINT "mcp_risk_scores_org_mcp_attribute_unique" UNIQUE ("org_id", "name", "attribute_id");



ALTER TABLE ONLY "public"."risk_scores"
    ADD CONSTRAINT "mcp_risk_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_server_instances"
    ADD CONSTRAINT "mcp_server_instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_server_issues"
    ADD CONSTRAINT "mcp_server_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."mcp_servers"
    ADD CONSTRAINT "mcp_servers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policies"
    ADD CONSTRAINT "policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."policy_controls"
    ADD CONSTRAINT "policy_controls_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_agent_instances_agent_id" ON "public"."agent_instances" USING "btree" ("agent_id");



CREATE INDEX "idx_agent_instances_device_native_id" ON "public"."agent_instances" USING "btree" ("device_native_id");



CREATE INDEX "idx_agent_instances_org_id" ON "public"."agent_instances" USING "btree" ("org_id");



CREATE INDEX "idx_agent_issues_agent_instance_id" ON "public"."agent_issues" USING "btree" ("agent_instance_id");



CREATE INDEX "idx_agent_issues_org_id" ON "public"."agent_issues" USING "btree" ("org_id");



CREATE INDEX "idx_agents_name" ON "public"."agents" USING "btree" ("name");



CREATE INDEX "idx_agents_org_id" ON "public"."agents" USING "btree" ("org_id");



CREATE INDEX "idx_agents_risk_score" ON "public"."agents" USING "btree" ("risk_score");



CREATE INDEX "idx_agents_status" ON "public"."agents" USING "btree" ("status");



CREATE INDEX "idx_agents_type" ON "public"."agents" USING "btree" ("type");



CREATE INDEX "idx_devices_device_native_id" ON "public"."devices" USING "btree" ("device_native_id");



CREATE UNIQUE INDEX "idx_devices_device_native_id_org_id" ON "public"."devices" USING "btree" ("device_native_id", "org_id");



CREATE INDEX "idx_mcp_server_instances_agent_instance_id" ON "public"."mcp_server_instances" USING "btree" ("agent_instance_id");



CREATE INDEX "idx_mcp_server_instances_device_native_id" ON "public"."mcp_server_instances" USING "btree" ("device_native_id");



CREATE INDEX "idx_mcp_server_instances_mcp_id" ON "public"."mcp_server_instances" USING "btree" ("mcp_id");



CREATE INDEX "idx_mcp_server_instances_org_id" ON "public"."mcp_server_instances" USING "btree" ("org_id");



CREATE INDEX "idx_mcp_server_issues_mcp_instance_id" ON "public"."mcp_server_issues" USING "btree" ("mcp_instance_id");



CREATE INDEX "idx_mcp_server_issues_org_id" ON "public"."mcp_server_issues" USING "btree" ("org_id");



CREATE INDEX "idx_mcp_servers_category" ON "public"."mcp_servers" USING "btree" ("category");



CREATE INDEX "idx_mcp_servers_org_id" ON "public"."mcp_servers" USING "btree" ("org_id");



CREATE UNIQUE INDEX "idx_mcp_servers_org_native_id" ON "public"."mcp_servers" USING "btree" ("org_id", "native_id");



CREATE INDEX "idx_mcp_servers_risk_score" ON "public"."mcp_servers" USING "btree" ("risk_score");



CREATE INDEX "idx_mcp_servers_status" ON "public"."mcp_servers" USING "btree" ("status");



CREATE INDEX "idx_mcp_servers_type" ON "public"."mcp_servers" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "update_agent_instances_updated_at" BEFORE UPDATE ON "public"."agent_instances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agent_issues_updated_at" BEFORE UPDATE ON "public"."agent_issues" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_agents_updated_at" BEFORE UPDATE ON "public"."agents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_devices_updated_at" BEFORE UPDATE ON "public"."devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_risk_framework_updated_at" BEFORE UPDATE ON "public"."risk_framework" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_risk_scores_updated_at" BEFORE UPDATE ON "public"."risk_scores" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_server_instances_updated_at" BEFORE UPDATE ON "public"."mcp_server_instances" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_server_issues_updated_at" BEFORE UPDATE ON "public"."mcp_server_issues" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_mcp_servers_updated_at" BEFORE UPDATE ON "public"."mcp_servers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_policies_updated_at" BEFORE UPDATE ON "public"."policies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_policy_controls_updated_at" BEFORE UPDATE ON "public"."policy_controls" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agent_instances"
    ADD CONSTRAINT "agent_instances_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_issues"
    ADD CONSTRAINT "agent_issue_type_fkey" FOREIGN KEY ("issue_type") REFERENCES "public"."risk_framework_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_issues"
    ADD CONSTRAINT "agent_issues_agent_instance_id_fkey" FOREIGN KEY ("agent_instance_id") REFERENCES "public"."agent_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."risk_baseline_scores"
    ADD CONSTRAINT "mcp_risk_baseline_scores_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."risk_framework"("id");



ALTER TABLE ONLY "public"."risk_baseline_scores"
    ADD CONSTRAINT "mcp_risk_baseline_scores_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."risk_framework_rules"("id");



ALTER TABLE ONLY "public"."risk_framework_rules"
    ADD CONSTRAINT "mcp_risk_framework_rules_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."risk_framework"("id");



ALTER TABLE ONLY "public"."risk_scores"
    ADD CONSTRAINT "mcp_risk_scores_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."risk_framework"("id");



ALTER TABLE ONLY "public"."risk_scores"
    ADD CONSTRAINT "mcp_risk_scores_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."risk_framework_rules"("id");



ALTER TABLE ONLY "public"."mcp_server_instances"
    ADD CONSTRAINT "mcp_server_instances_agent_instance_id_fkey" FOREIGN KEY ("agent_instance_id") REFERENCES "public"."agent_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_server_instances"
    ADD CONSTRAINT "mcp_server_instances_mcp_id_fkey" FOREIGN KEY ("mcp_id") REFERENCES "public"."mcp_servers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_server_issues"
    ADD CONSTRAINT "mcp_server_issues_issue_type_fkey" FOREIGN KEY ("issue_type") REFERENCES "public"."risk_framework_rules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mcp_server_issues"
    ADD CONSTRAINT "mcp_server_issues_mcp_instance_id_fkey" FOREIGN KEY ("mcp_instance_id") REFERENCES "public"."mcp_server_instances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."policy_controls"
    ADD CONSTRAINT "policy_controls_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE CASCADE;



CREATE POLICY "Allow public delete access to agent_instances" ON "public"."agent_instances" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to agent_issues" ON "public"."agent_issues" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to agents" ON "public"."agents" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to devices" ON "public"."devices" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to mcp_risk_framework" ON "public"."risk_framework" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to mcp_risk_scores" ON "public"."risk_scores" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to mcp_server_instances" ON "public"."mcp_server_instances" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to mcp_server_issues" ON "public"."mcp_server_issues" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to mcp_servers" ON "public"."mcp_servers" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to policies" ON "public"."policies" FOR DELETE USING (true);



CREATE POLICY "Allow public delete access to policy_controls" ON "public"."policy_controls" FOR DELETE USING (true);



CREATE POLICY "Allow public insert access to agent_instances" ON "public"."agent_instances" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to agent_issues" ON "public"."agent_issues" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to agents" ON "public"."agents" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to devices" ON "public"."devices" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to mcp_risk_framework" ON "public"."risk_framework" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to mcp_risk_scores" ON "public"."risk_scores" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to mcp_server_instances" ON "public"."mcp_server_instances" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to mcp_server_issues" ON "public"."mcp_server_issues" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to mcp_servers" ON "public"."mcp_servers" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to policies" ON "public"."policies" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public insert access to policy_controls" ON "public"."policy_controls" FOR INSERT WITH CHECK (true);



CREATE POLICY "Allow public read access to agent_instances" ON "public"."agent_instances" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to agent_issues" ON "public"."agent_issues" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to agents" ON "public"."agents" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to devices" ON "public"."devices" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to mcp_risk_framework" ON "public"."risk_framework" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to mcp_risk_scores" ON "public"."risk_scores" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to mcp_server_instances" ON "public"."mcp_server_instances" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to mcp_server_issues" ON "public"."mcp_server_issues" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to mcp_servers" ON "public"."mcp_servers" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to policies" ON "public"."policies" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to policy_controls" ON "public"."policy_controls" FOR SELECT USING (true);



CREATE POLICY "Allow public update access to agent_instances" ON "public"."agent_instances" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to agent_issues" ON "public"."agent_issues" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to agents" ON "public"."agents" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to devices" ON "public"."devices" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to mcp_risk_framework" ON "public"."risk_framework" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to mcp_risk_scores" ON "public"."risk_scores" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to mcp_server_instances" ON "public"."mcp_server_instances" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to mcp_server_issues" ON "public"."mcp_server_issues" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to mcp_servers" ON "public"."mcp_servers" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to policies" ON "public"."policies" FOR UPDATE USING (true);



CREATE POLICY "Allow public update access to policy_controls" ON "public"."policy_controls" FOR UPDATE USING (true);



ALTER TABLE "public"."agent_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_server_instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_server_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mcp_servers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."policy_controls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public select on mcp_risk_framework_rules" ON "public"."risk_framework_rules" FOR SELECT USING (true);



CREATE POLICY "pulic select mcp_risk_baseline_score" ON "public"."risk_baseline_scores" FOR SELECT USING (true);



ALTER TABLE "public"."risk_baseline_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."risk_framework" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."risk_framework_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."risk_scores" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."agent_instances" TO "anon";
GRANT ALL ON TABLE "public"."agent_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_instances" TO "service_role";



GRANT ALL ON TABLE "public"."agent_issues" TO "anon";
GRANT ALL ON TABLE "public"."agent_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_issues" TO "service_role";



GRANT ALL ON TABLE "public"."agents" TO "anon";
GRANT ALL ON TABLE "public"."agents" TO "authenticated";
GRANT ALL ON TABLE "public"."agents" TO "service_role";



GRANT ALL ON TABLE "public"."devices" TO "anon";
GRANT ALL ON TABLE "public"."devices" TO "authenticated";
GRANT ALL ON TABLE "public"."devices" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_server_instances" TO "anon";
GRANT ALL ON TABLE "public"."mcp_server_instances" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_server_instances" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_server_issues" TO "anon";
GRANT ALL ON TABLE "public"."mcp_server_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_server_issues" TO "service_role";



GRANT ALL ON TABLE "public"."mcp_servers" TO "anon";
GRANT ALL ON TABLE "public"."mcp_servers" TO "authenticated";
GRANT ALL ON TABLE "public"."mcp_servers" TO "service_role";



GRANT ALL ON TABLE "public"."policies" TO "anon";
GRANT ALL ON TABLE "public"."policies" TO "authenticated";
GRANT ALL ON TABLE "public"."policies" TO "service_role";



GRANT ALL ON TABLE "public"."policy_controls" TO "anon";
GRANT ALL ON TABLE "public"."policy_controls" TO "authenticated";
GRANT ALL ON TABLE "public"."policy_controls" TO "service_role";



GRANT ALL ON TABLE "public"."risk_baseline_scores" TO "anon";
GRANT ALL ON TABLE "public"."risk_baseline_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_baseline_scores" TO "service_role";



GRANT ALL ON TABLE "public"."risk_framework" TO "anon";
GRANT ALL ON TABLE "public"."risk_framework" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_framework" TO "service_role";



GRANT ALL ON TABLE "public"."risk_framework_rules" TO "anon";
GRANT ALL ON TABLE "public"."risk_framework_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_framework_rules" TO "service_role";



GRANT ALL ON TABLE "public"."risk_scores" TO "anon";
GRANT ALL ON TABLE "public"."risk_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_scores" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























RESET ALL;
