# Lume Connect

[![Next.js](https://img.shields.io/badge/Next.js-16.4.6-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_%26_Auth-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](#)

> **Enterprise Multi-Tenant Super Admin & Organization Management Platform**

Lume Connect is a production-grade, secure multi-tenant portal designed for central super administrators to onboard, authenticate, configure, and monitor client organizations. Powered by **Next.js 16**, **React 19**, **Tailwind CSS v4**, and **Supabase (PostgreSQL & Auth)**.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Setup](#environment-setup)
  - [Database Migration](#database-migration)
  - [Running the Application](#running-the-application)
- [Available Scripts](#available-scripts)
- [Security & Authentication](#security--authentication)
- [Branching Strategy](#branching-strategy)

---

## Key Features

- **Central Super Admin Authentication (`/superadmin/login`)**:
  - Secure credential verification supporting both direct Supabase Auth and unified `login_credentials` table.
  - Interactive UI with password toggle, input sanitization, and state-driven error feedback.
  - Automatic redirect to authorized portals based on verified roles.
  - Offline Dev Mode fallback enabling local testing when cloud credentials are pending.

- **Tenant Organization Provisioning (`/superadmin/add-organization`)**:
  - Protected route strictly enforced by Next.js edge middleware and server session verification.
  - Enterprise registration flow with organization name, administrative email, and credential provisioning.
  - Automated dual-record sync: records metadata in `organizations` and provisions credentials in `login_credentials`.

- **Live Directory & Search**:
  - Real-time directory listing of active tenant organizations.
  - Instant client-side search and filtering.
  - Quick status indicators and creation audit timestamps.

- **Organization Dashboard (`/organization/dashboard`)**:
  - Dedicated operational workspace for authenticated tenant organization accounts.

---

## System Architecture

```text
                      +------------------------------------------+
                      |         Browser / Client Devices         |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |         Next.js Edge Middleware          |
                      |   (Route Protection & Session Check)     |
                      +------------------------------------------+
                                           |
                   +-----------------------+-----------------------+
                   |                                               |
                   v                                               v
+------------------------------------+          +------------------------------------+
|         App Router Pages           |          |         Secure API Routes          |
|  - /superadmin/login               |          |  - /api/auth/login                 |
|  - /superadmin/add-organization    |          |  - /api/organizations              |
|  - /organization/dashboard         |          +------------------------------------+
+------------------------------------+                             |
                   |                                               |
                   +-----------------------+-----------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |      Supabase Client / Service Layer     |
                      |  (@supabase/supabase-js, @supabase/ssr)  |
                      +------------------------------------------+
                                           |
                                           v
                      +------------------------------------------+
                      |             Supabase Cloud               |
                      |  - PostgreSQL Database (RLS Enforced)    |
                      |  - Auth & Session Token Issuer           |
                      |  - Tables: organizations, credentials    |
                      +------------------------------------------+
```

---

## Repository Structure

```text
Lume-Connect/
├── .github/
│   └── workflows/
│       └── ci.yml             # Automated CI pipeline for linting & building
├── backend/
│   └── README.md              # Backend & microservices documentation
├── frontend/
│   ├── public/                # Static assets, branding logos, and generated CSS
│   ├── src/
│   │   ├── app/               # Next.js App Router (pages and API endpoints)
│   │   │   ├── api/           # Server-side API route handlers
│   │   │   ├── organization/  # Organization tenant dashboard
│   │   │   ├── superadmin/    # Super Admin authentication & onboarding pages
│   │   │   ├── layout.tsx     # Root application layout
│   │   │   └── page.tsx       # Landing redirect
│   │   ├── components/        # Reusable UI components & branding
│   │   ├── lib/
│   │   │   └── supabase/      # Supabase clients (browser, service-role, types)
│   │   └── middleware.ts      # Authentication guard middleware
│   ├── .env.example           # Public environment template
│   ├── next.config.ts         # Next.js configuration
│   ├── package.json           # Frontend dependencies & build scripts
│   └── tsconfig.json          # TypeScript compiler configuration
├── supabase/
│   └── schema.sql             # Complete database schema, RLS policies & seed data
├── .editorconfig              # Code formatting standards
├── .gitattributes             # Git normalization and text attributes
├── .gitignore                 # Enterprise ignore rules
├── package.json               # Root workspace orchestrator
└── README.md                  # Project documentation
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Supabase Account**: A free or enterprise Supabase project

### Environment Setup

1. Copy the example configuration to `.env.local` inside the `frontend` folder:

   ```bash
   cp frontend/.env.example frontend/.env.local
   ```

2. Open `frontend/.env.local` and provide your Supabase project credentials:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-anon-key
   ```

   > **Note:** If no credentials are configured, the frontend gracefully activates **Dev Mode**, simulating authenticated flows locally for development.

### Database Migration

Execute the database script located in [`supabase/schema.sql`](supabase/schema.sql) in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql):

```sql
-- Creates organizations table
-- Creates unified login_credentials table with RLS
-- Seeds default super administrator credentials
```

### Running the Application

Install dependencies and start the development server from the repository root:

```bash
# Install frontend dependencies
npm --prefix frontend install

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access the application.

---

## Available Scripts

From the repository root:

| Command | Action |
|---|---|
| `npm run dev` | Launches the Next.js development server with Tailwind watch |
| `npm run build` | Compiles Tailwind CSS and produces an optimized production build |
| `npm run start` | Boots the Next.js production server |
| `npm run lint` | Runs ESLint across all TypeScript and React source files |

---

## Security & Authentication

- **Role-Based Access Control (RBAC)**: Distinct permissions for `super_admin` and `organization` roles.
- **Middleware Guard**: High-performance edge verification in `middleware.ts` preventing unauthenticated traversal to administrative routes.
- **Database Isolation**: PostgreSQL Row Level Security (RLS) ensures organizations can only access records relevant to their tenant context.
- **Credential Protection**: Public client-side builds never bundle elevated service keys. Local environment variables are kept strictly uncommitted via `.gitignore`.

---

## Branching Strategy

This repository adheres to standard enterprise release workflows:

- **`main`**: Production-ready code. Commits here represent stable releases.
- **`Develop`**: Integration branch for ongoing development, QA validation, and active feature merges.
- **`feature/*`**: Individual feature branches branched off `Develop` and merged back via Pull Requests.
