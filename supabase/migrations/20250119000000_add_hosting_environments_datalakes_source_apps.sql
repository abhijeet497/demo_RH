-- Replace connections table with new hosting environment schema
-- Drop connections table if it exists (since nothing is deployed yet)
DROP TABLE IF EXISTS connections;

-- Create hosting_environments table (replaces connections)
CREATE TABLE IF NOT EXISTS hosting_environments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    cloud_provider TEXT NOT NULL,
    native_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    terraform_url TEXT NULL,
    terraform_module_versions JSONB NOT NULL DEFAULT '{}',
    infrastructure_output JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT hosting_environments_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT hosting_environments_org_name_unique UNIQUE (org_id, name)
);

-- Create pod_deployments table
CREATE TABLE IF NOT EXISTS pod_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    hosting_environment_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT NULL,
    deployment_config JSONB NOT NULL DEFAULT '{}',
    cp_inbound_queue_url TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT pod_deployments_hosting_environment_id_fkey FOREIGN KEY (hosting_environment_id) REFERENCES hosting_environments(id) ON DELETE CASCADE,
    CONSTRAINT pod_deployments_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

-- Create datalakes table
CREATE TABLE IF NOT EXISTS datalakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    hosting_environment_id UUID NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    environment_native_id TEXT NOT NULL,
    region TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT datalakes_hosting_environment_id_fkey FOREIGN KEY (hosting_environment_id) REFERENCES hosting_environments(id) ON DELETE CASCADE,
    CONSTRAINT datalakes_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT datalakes_org_name_hosting_env_unique UNIQUE (org_id, name, hosting_environment_id)
);

-- Create source_apps table
CREATE TABLE IF NOT EXISTS source_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    hosting_environment_id UUID NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT source_apps_hosting_environment_id_fkey FOREIGN KEY (hosting_environment_id) REFERENCES hosting_environments(id) ON DELETE CASCADE,
    CONSTRAINT source_apps_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT source_apps_org_name_hosting_env_unique UNIQUE (org_id, name, hosting_environment_id)
);

-- Create junction table between datalakes and source apps 
CREATE TABLE IF NOT EXISTS source_apps_datalakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_app_id UUID NOT NULL,
    datalake_id UUID NOT NULL,
    org_id UUID NOT NULL,
    hosting_environment_id UUID NOT NULL,
    pod_id UUID NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT source_apps_datalakes_hosting_environment_id_fkey FOREIGN KEY (hosting_environment_id) REFERENCES hosting_environments(id) ON DELETE CASCADE,
    CONSTRAINT source_apps_datalakes_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE,
    CONSTRAINT source_apps_datalakes_datalake_id_fkey FOREIGN KEY (datalake_id) REFERENCES datalakes(id) ON DELETE CASCADE,
    CONSTRAINT source_apps_datalakes_source_app_id_fkey FOREIGN KEY (source_app_id) REFERENCES source_apps(id) ON DELETE CASCADE,
    CONSTRAINT source_apps_datalakes_pod_id_fkey FOREIGN KEY (pod_id) REFERENCES pod_deployments(id) ON DELETE SET NULL,

    CONSTRAINT source_apps_datalakes_unique UNIQUE (source_app_id, datalake_id)
);

-- TODO: Add indexes for performance when we scale and understand API requirements better

-- Enable Row Level Security (RLS) for multi-tenancy
ALTER TABLE hosting_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE datalakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_apps_datalakes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for org-based isolation
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hosting_environments' AND policyname = 'org_isolation') THEN
        CREATE POLICY "org_isolation" ON hosting_environments
            FOR ALL USING (org_id IN (
                SELECT org_id FROM user_profiles WHERE id = auth.uid()
            ));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pod_deployments' AND policyname = 'org_isolation') THEN
        CREATE POLICY "org_isolation" ON pod_deployments
            FOR ALL USING (org_id IN (
                SELECT org_id FROM user_profiles WHERE id = auth.uid()
            ));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'datalakes' AND policyname = 'org_isolation') THEN
        CREATE POLICY "org_isolation" ON datalakes
            FOR ALL USING (org_id IN (
                SELECT org_id FROM user_profiles WHERE id = auth.uid()
            ));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'source_apps' AND policyname = 'org_isolation') THEN
        CREATE POLICY "org_isolation" ON source_apps
            FOR ALL USING (org_id IN (
                SELECT org_id FROM user_profiles WHERE id = auth.uid()
            ));
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'source_apps_datalakes' AND policyname = 'org_isolation') THEN
        CREATE POLICY "org_isolation" ON source_apps_datalakes
            FOR ALL USING (org_id IN (
                SELECT org_id FROM user_profiles WHERE id = auth.uid()
            ));
    END IF;
END $$;

-- Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to automatically update updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_hosting_environments_updated_at') THEN
        CREATE TRIGGER update_hosting_environments_updated_at BEFORE UPDATE ON hosting_environments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_pod_deployments_updated_at') THEN
        CREATE TRIGGER update_pod_deployments_updated_at BEFORE UPDATE ON pod_deployments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_datalakes_updated_at') THEN
        CREATE TRIGGER update_datalakes_updated_at BEFORE UPDATE ON datalakes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_source_apps_updated_at') THEN
        CREATE TRIGGER update_source_apps_updated_at BEFORE UPDATE ON source_apps
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_source_apps_datalakes_updated_at') THEN
        CREATE TRIGGER update_source_apps_datalakes_updated_at BEFORE UPDATE ON source_apps_datalakes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;