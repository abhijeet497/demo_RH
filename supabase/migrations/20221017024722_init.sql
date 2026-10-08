-- Create a table for public profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,

  -- Constraints
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT profiles_username_unique UNIQUE (username),
  CONSTRAINT username_length CHECK (char_length(username) >= 3)
);

-- Set up Row Level Security (RLS)
-- See https://supabase.com/docs/guides/auth/row-level-security for more details.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for profiles
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles are viewable by everyone.') THEN
        CREATE POLICY "Public profiles are viewable by everyone." ON profiles
            FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile.') THEN
        CREATE POLICY "Users can insert their own profile." ON profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile.') THEN
        CREATE POLICY "Users can update own profile." ON profiles
            FOR UPDATE USING (auth.uid() = id);
    END IF;
END $$;

-- This trigger automatically creates a profile entry when a new user signs up via Supabase Auth.
-- See https://supabase.com/docs/guides/auth/managing-user-data#using-triggers for more details.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    END IF;
END $$;

-- Create organizations table
CREATE TABLE IF NOT EXISTS orgs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  name TEXT,
  description TEXT,
  aws_iam_user_name TEXT,
  aws_iam_role_arn TEXT,
  aws_secret_name TEXT,
  
  -- Constraints
  CONSTRAINT orgs_name_unique UNIQUE (name)
);

-- Enable RLS for orgs
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

-- Create user_profiles table to link users to organizations
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  org_id UUID NOT NULL,
  role TEXT,
  
  -- Constraints
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

-- Enable RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_org_id ON user_profiles(org_id);

-- RLS Policies for orgs
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orgs' AND policyname = 'Users can view their own organization') THEN
        CREATE POLICY "Users can view their own organization" ON orgs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM user_profiles 
                    WHERE user_profiles.org_id = orgs.id 
                    AND user_profiles.id = auth.uid()
                )
            );
    END IF;
END $$;

-- RLS Policies for user_profiles
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can manage their own profile') THEN
        CREATE POLICY "Users can manage their own profile" ON user_profiles
            FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
    END IF;
END $$;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to automatically update updated_at
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
        CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orgs_updated_at') THEN
        CREATE TRIGGER update_orgs_updated_at BEFORE UPDATE ON orgs
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_profiles_updated_at') THEN
        CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Set up Storage!
INSERT INTO storage.buckets (id, name)
  VALUES ('avatars', 'avatars')
  ON CONFLICT (id) DO NOTHING;

-- Set up access controls for storage.
-- See https://supabase.com/docs/guides/storage#policy-examples for more details.
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Avatar images are publicly accessible.') THEN
        CREATE POLICY "Avatar images are publicly accessible." ON storage.objects
            FOR SELECT USING (bucket_id = 'avatars');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can upload an avatar.') THEN
        CREATE POLICY "Anyone can upload an avatar." ON storage.objects
            FOR INSERT WITH CHECK (bucket_id = 'avatars');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Anyone can update their own avatar.') THEN
        CREATE POLICY "Anyone can update their own avatar." ON storage.objects
            FOR UPDATE USING (auth.uid() = owner) WITH CHECK (bucket_id = 'avatars');
    END IF;
END $$;
