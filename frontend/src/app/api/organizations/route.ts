import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  findAuthUserByEmail,
  SUPER_ADMIN_EMAIL,
  verifySuperAdminSession,
} from "@/lib/supabase/server";

// GET /api/organizations - Fetch all organizations (verified Super Admin only)
export async function GET(request: Request) {
  try {
    const session = await verifySuperAdminSession(request);
    if (!session.user || !session.isSuperAdmin) {
      return NextResponse.json(
        { error: session.error || "Forbidden", data: [] },
        { status: session.status }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const db = supabaseAdmin ?? (await createSupabaseServerClient());

    const { data, error } = await db
      .from("organizations")
      .select("id, name, email, role, created_at, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("[API GET /api/organizations] Supabase error:", error);
      return NextResponse.json({ error: error.message, data: [] }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch organizations";
    console.error("[API GET /api/organizations] Exception:", msg);
    return NextResponse.json({ error: msg, data: [] }, { status: 500 });
  }
}

// POST /api/organizations - Add new organization and register confirmed auth user in Supabase
export async function POST(request: Request) {
  try {
    const session = await verifySuperAdminSession(request);
    if (!session.user || !session.isSuperAdmin) {
      return NextResponse.json(
        { error: session.error || "Forbidden" },
        { status: session.status }
      );
    }

    const body = await request.json();
    const { name, email, password } = body;

    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim()?.toLowerCase();
    const orgPassword = password?.trim();

    if (!trimmedName || !trimmedEmail || !orgPassword) {
      return NextResponse.json(
        { error: "Name, Email, and Password are all required." },
        { status: 400 }
      );
    }

    if (orgPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (trimmedEmail === SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Cannot provision a tenant using the Super Admin email." },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseAdminClient();
    const supabaseSSR = await createSupabaseServerClient();
    const db = supabaseAdmin ?? supabaseSSR;

    // Prevent duplicate organization emails
    const { data: existingOrg } = await db
      .from("organizations")
      .select("id")
      .ilike("email", trimmedEmail)
      .maybeSingle();

    if (existingOrg) {
      return NextResponse.json(
        { error: "An organization with this email already exists." },
        { status: 409 }
      );
    }

    // 1. Register Supabase Auth User (so organization can log in via Supabase Auth)
    let authUserId: string | undefined;
    if (supabaseAdmin) {
      const { data: createdAuth, error: createAuthError } =
        await supabaseAdmin.auth.admin.createUser({
          email: trimmedEmail,
          password: orgPassword,
          email_confirm: true,
          user_metadata: {
            role: "organization",
            org_name: trimmedName,
          },
        });

      if (createAuthError) {
        const existingAuthUser = await findAuthUserByEmail(
          supabaseAdmin,
          trimmedEmail
        );
        if (existingAuthUser) {
          const { data: updatedAuth, error: updateAuthError } =
            await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, {
              password: orgPassword,
              email_confirm: true,
              user_metadata: {
                role: "organization",
                org_name: trimmedName,
              },
            });

          if (updateAuthError) {
            console.error(
              "[API POST /api/organizations] Auth update error:",
              updateAuthError
            );
            return NextResponse.json(
              { error: updateAuthError.message },
              { status: 500 }
            );
          }
          authUserId = updatedAuth.user?.id || existingAuthUser.id;
        } else {
          console.error(
            "[API POST /api/organizations] Auth create error:",
            createAuthError
          );
          return NextResponse.json(
            { error: createAuthError.message },
            { status: 500 }
          );
        }
      } else {
        authUserId = createdAuth.user?.id;
      }
    } else {
      try {
        const { data: signupData } = await supabaseSSR.auth.signUp({
          email: trimmedEmail,
          password: orgPassword,
          options: {
            data: {
              role: "organization",
              org_name: trimmedName,
            },
          },
        });
        authUserId = signupData.user?.id;
      } catch (e) {
        console.warn("[API POST /api/organizations] Auth signup note:", e);
      }
    }

    // 2. Insert record into Supabase organizations table
    const basePayload: Record<string, string> = {
      name: trimmedName,
      email: trimmedEmail,
      password: orgPassword,
      role: "organization",
    };

    let orgData = null;
    let orgError = null;

    if (authUserId) {
      const attemptWithUserId = await db
        .from("organizations")
        .insert([{ ...basePayload, user_id: authUserId }])
        .select("id, name, email, role, created_at, updated_at")
        .single();

      if (
        attemptWithUserId.error &&
        attemptWithUserId.error.message?.includes("user_id")
      ) {
        const fallbackAttempt = await db
          .from("organizations")
          .insert([basePayload])
          .select("id, name, email, role, created_at, updated_at")
          .single();
        orgData = fallbackAttempt.data;
        orgError = fallbackAttempt.error;
      } else {
        orgData = attemptWithUserId.data;
        orgError = attemptWithUserId.error;
      }
    } else {
      const attempt = await db
        .from("organizations")
        .insert([basePayload])
        .select("id, name, email, role, created_at, updated_at")
        .single();
      orgData = attempt.data;
      orgError = attempt.error;
    }

    if (orgError) {
      console.error("[API POST /api/organizations] Table insert error:", orgError);
      // Roll back orphaned auth user if table insert failed
      if (supabaseAdmin && authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => {});
      }
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    // 3. Sync to dedicated login_credentials table if it exists
    try {
      await db.from("login_credentials").upsert(
        [
          {
            email: trimmedEmail,
            password: orgPassword,
            role: "organization",
            name: trimmedName,
            last_login: new Date().toISOString(),
          },
        ],
        { onConflict: "email" }
      );
    } catch {
      // Graceful fallback if login_credentials table is not created yet
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...orgData,
          password: orgPassword,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Server error saving organization";
    console.error("[API POST /api/organizations] Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
