# Lume Connect - Backend & Services Architecture

This directory houses backend configurations, microservices, Edge Functions, and server-side utilities for the **Lume Connect** platform.

## Architecture Overview

Lume Connect currently uses a hybrid cloud-native backend architecture:

1. **Supabase Core**:
   - **PostgreSQL**: Primary transactional database containing tenant organizations (`organizations`) and unified role-based authentication credentials (`login_credentials`).
   - **Row Level Security (RLS)**: Enforces access control and data isolation per tenant.
   - **Auth**: Powers identity, JWT issuance, and session persistence.
   - Schema and migrations are maintained in [`../supabase/schema.sql`](../supabase/schema.sql).

2. **Next.js Server Runtime (API Routes & Middleware)**:
   - Protected API route handlers under `frontend/src/app/api/` (`/api/auth/login`, `/api/organizations`).
   - Server-side validation, session token inspection, and service-role elevated queries.
   - Global Edge Middleware (`frontend/src/middleware.ts`) guarding `/superadmin/*` and tenant organization routes.

3. **Future Microservices & Extensions**:
   - As Lume Connect scales, dedicated microservices (e.g., event processing, webhook handlers, organization syncing) can be implemented here in TypeScript or Go.
