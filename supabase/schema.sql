-- =========================================================
-- TravLume Connect - Complete Hardened Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ujhuxmfsvfnnmrspgkqc/sql/new
-- =========================================================

-- Enable pgcrypto for cryptographic digest, UUIDs, and blowfish hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. ORGANIZATIONS TABLE (Tenant Profiles)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'organization',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ensure status column exists if the table was created previously
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Enable Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop insecure legacy policies
DROP POLICY IF EXISTS "Allow all for organizations" ON public.organizations;
DROP POLICY IF EXISTS "organizations_super_admin_all" ON public.organizations;
DROP POLICY IF EXISTS "organizations_tenant_view_self" ON public.organizations;

-- Hardened RLS Policy 1: Authenticated Super Admins have full access
CREATE POLICY "organizations_super_admin_all" ON public.organizations
    FOR ALL
    TO authenticated
    USING (
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    );

-- Hardened RLS Policy 2: Authenticated Tenant accounts can only read their own profile
CREATE POLICY "organizations_tenant_view_self" ON public.organizations
    FOR SELECT
    TO authenticated
    USING (
        email = auth.jwt() ->> 'email'
    );

-- =========================================================
-- 2. DEDICATED LOGIN_CREDENTIALS TABLE (Strictly Protected)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.login_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin',
    name TEXT,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.login_credentials ENABLE ROW LEVEL SECURITY;

-- Drop insecure legacy policies
DROP POLICY IF EXISTS "Allow all for login_credentials" ON public.login_credentials;
DROP POLICY IF EXISTS "login_credentials_super_admin_all" ON public.login_credentials;

-- Hardened RLS Policy: Strictly restricted to service_role or authenticated super_admin
CREATE POLICY "login_credentials_super_admin_all" ON public.login_credentials
    FOR ALL
    TO authenticated
    USING (
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    )
    WITH CHECK (
        auth.jwt() ->> 'role' = 'super_admin' OR
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
    );

-- =========================================================
-- 3. INITIAL SUPER ADMIN SEEDING (CRYPTOGRAPHICALLY HASHED)
-- =========================================================
-- Note: 'admin123' hashed with SHA-256 is:
-- '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
INSERT INTO public.login_credentials (email, password, role, name)
VALUES (
    'admin@lumeconnect.com',
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    'super_admin',
    'TravLume Super Admin'
)
ON CONFLICT (email) DO UPDATE
SET password = EXCLUDED.password, last_login = now();

-- =========================================================
-- 4. SUPER ADMIN PROVISIONING IN SUPABASE AUTH (auth.users)
-- =========================================================
-- To provision or reset the Super Admin account directly in Supabase Auth
-- so they can sign in via Supabase Auth (auth.signInWithPassword):
--
-- INSERT INTO auth.users (
--     id,
--     instance_id,
--     email,
--     encrypted_password,
--     email_confirmed_at,
--     raw_app_meta_data,
--     raw_user_meta_data,
--     role,
--     aud,
--     created_at,
--     updated_at
-- )
-- VALUES (
--     gen_random_uuid(),
--     '00000000-0000-0000-0000-00000000000',
--     'admin@lumeconnect.com',
--     crypt('admin123', gen_salt('bf')),
--     now(),
--     '{"provider":"email","providers":["email"]}',
--     '{"role":"super_admin","org_name":"TravLume Super Admin"}',
--     'authenticated',
--     'authenticated',
--     now(),
--     now()
-- )
-- ON CONFLICT (email) DO UPDATE
-- SET encrypted_password = crypt('admin123', gen_salt('bf')), updated_at = now();
