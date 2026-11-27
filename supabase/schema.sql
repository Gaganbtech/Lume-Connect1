-- =========================================================
-- TravLume Connect - Complete Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ujhuxmfsvfnnmrspgkqc/sql/new
-- =========================================================

-- 1. Create the organizations table for tenant organization profiles
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'organization',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for organizations" ON public.organizations;
CREATE POLICY "Allow all for organizations" ON public.organizations FOR ALL USING (true) WITH CHECK (true);

-- 2. Create the dedicated login_credentials table for ALL logins (Super Admin & Organizations)
CREATE TABLE IF NOT EXISTS public.login_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin',
    name TEXT,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.login_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for login_credentials" ON public.login_credentials;
CREATE POLICY "Allow all for login_credentials" ON public.login_credentials FOR ALL USING (true) WITH CHECK (true);

-- 3. Seed initial Super Admin credentials
INSERT INTO public.login_credentials (email, password, role, name)
VALUES ('admin@lumeconnect.com', 'admin123', 'super_admin', 'TravLume Super Admin')
ON CONFLICT (email) DO UPDATE
SET password = EXCLUDED.password, last_login = now();
