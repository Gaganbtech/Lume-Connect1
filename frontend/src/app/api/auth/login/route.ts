import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
  findAuthUserByEmail,
  SUPER_ADMIN_EMAIL,
} from "@/lib/supabase/server";

async function syncLoginCredentials(
  db: SupabaseClient,
  email: string,
  password: string,
  role: string,
  name: string
) {
  try {
    await db.from("login_credentials").upsert(
      [
        {
          email,
          password,
          role,
          name,
          last_login: new Date().toISOString(),
        },
      ],
      { onConflict: "email" }
    );
  } catch {
    // Graceful fallback if table is not yet created in Supabase
  }
}

async function ensureSupabaseAuthSession(
  supabaseSSR: SupabaseClient,
  supabaseAdmin: SupabaseClient | null,
  email: string,
  password: string,
  role: "super_admin" | "organization",
  orgName: string
): Promise<boolean> {
  const { data: signInData, error: signInError } =
    await supabaseSSR.auth.signInWithPassword({ email, password });

  if (!signInError && signInData.user) {
    const existingMetaRole = signInData.user.user_metadata?.role;
    if (supabaseAdmin && existingMetaRole !== role) {
      await supabaseAdmin.auth.admin.updateUserById(signInData.user.id, {
        user_metadata: {
          ...signInData.user.user_metadata,
          role,
          org_name: orgName,
        },
      });
      await supabaseSSR.auth.signInWithPassword({ email, password });
    }
    return true;
  }

  if (!supabaseAdmin) {
    return false;
  }

  const existingAuthUser = await findAuthUserByEmail(supabaseAdmin, email);
  if (existingAuthUser) {
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      existingAuthUser.id,
      {
        password,
        email_confirm: true,
        user_metadata: {
          ...existingAuthUser.user_metadata,
          role,
          org_name: orgName,
        },
      }
    );
    if (updateErr) {
      return false;
    }
  } else {
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role,
        org_name: orgName,
      },
    });
    if (createErr) {
      return false;
    }
  }

  const { error: retryError } = await supabaseSSR.auth.signInWithPassword({
    email,
    password,
  });
  return !retryError;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const trimmedEmail = email?.trim()?.toLowerCase();
    const rawPassword = password?.trim();

    if (!trimmedEmail || !rawPassword) {
      return NextResponse.json(
        { error: "Please enter both Email ID and Password." },
        { status: 400 }
      );
    }

    if (rawPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const supabaseSSR = await createSupabaseServerClient();
    const supabaseAdmin = createSupabaseAdminClient();
    const db = supabaseAdmin ?? supabaseSSR;

    // 1. Check existing record in Supabase organizations table
    const { data: existingOrg } = await db
      .from("organizations")
      .select("*")
      .ilike("email", trimmedEmail)
      .maybeSingle();

    // Also check login_credentials
    const { data: credRow } = await db
      .from("login_credentials")
      .select("*")
      .ilike("email", trimmedEmail)
      .maybeSingle();

    // Case A: Existing Organization account -> verify password & establish session
    if (existingOrg && existingOrg.role === "organization") {
      let authenticated = false;

      if (existingOrg.password && existingOrg.password === rawPassword) {
        authenticated = true;
        await ensureSupabaseAuthSession(
          supabaseSSR,
          supabaseAdmin,
          trimmedEmail,
          rawPassword,
          "organization",
          existingOrg.name
        );
      } else {
        const { data: authCheck } = await supabaseSSR.auth.signInWithPassword({
          email: trimmedEmail,
          password: rawPassword,
        });
        authenticated = Boolean(authCheck.user);
      }

      if (!authenticated) {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }

      await db
        .from("organizations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existingOrg.id);

      await syncLoginCredentials(
        db,
        trimmedEmail,
        rawPassword,
        "organization",
        existingOrg.name
      );

      return NextResponse.json({
        success: true,
        message: "Organization authenticated and credentials synchronized.",
        user: {
          id: existingOrg.id,
          email: existingOrg.email,
          role: "organization",
          name: existingOrg.name,
          org_id: existingOrg.id,
        },
        redirectUrl: "/organization/dashboard",
      });
    }

    // Case B: Super Admin login (admin@lumeconnect.com or existing super_admin record)
    const isSuperAdminAccount =
      trimmedEmail === SUPER_ADMIN_EMAIL || existingOrg?.role === "super_admin";

    if (isSuperAdminAccount) {
      const adminDisplayName =
        existingOrg?.name || credRow?.name || "TravLume Super Admin";

      // First try Supabase Auth directly
      const { data: authSignIn, error: authErr } =
        await supabaseSSR.auth.signInWithPassword({
          email: trimmedEmail,
          password: rawPassword,
        });

      let verifiedSuperAdmin = Boolean(!authErr && authSignIn.user);

      if (verifiedSuperAdmin && authSignIn.user && supabaseAdmin) {
        const metaRole = authSignIn.user.user_metadata?.role;
        if (metaRole !== "super_admin") {
          await supabaseAdmin.auth.admin.updateUserById(authSignIn.user.id, {
            user_metadata: {
              ...authSignIn.user.user_metadata,
              role: "super_admin",
              org_name: adminDisplayName,
            },
          });
          await supabaseSSR.auth.signInWithPassword({
            email: trimmedEmail,
            password: rawPassword,
          });
        }
      }

      if (!verifiedSuperAdmin) {
        const expectedPassword =
          existingOrg?.password ||
          credRow?.password ||
          (trimmedEmail === SUPER_ADMIN_EMAIL ? "admin123" : null);

        if (expectedPassword && rawPassword === expectedPassword) {
          verifiedSuperAdmin = true;
          await ensureSupabaseAuthSession(
            supabaseSSR,
            supabaseAdmin,
            trimmedEmail,
            rawPassword,
            "super_admin",
            adminDisplayName
          );
        }
      }

      if (!verifiedSuperAdmin) {
        return NextResponse.json(
          { error: "Invalid email or password." },
          { status: 401 }
        );
      }

      // Ensure Super Admin row exists in organizations & login_credentials
      let adminRecord = existingOrg;
      if (adminRecord) {
        const { data: updatedAdmin } = await db
          .from("organizations")
          .update({
            role: "super_admin",
            updated_at: new Date().toISOString(),
          })
          .eq("id", adminRecord.id)
          .select("id, name, email, role")
          .single();

        if (updatedAdmin) {
          adminRecord = updatedAdmin;
        }
      } else {
        const { data: insertedAdmin } = await db
          .from("organizations")
          .insert([
            {
              name: adminDisplayName,
              email: trimmedEmail,
              password: rawPassword,
              role: "super_admin",
            },
          ])
          .select("id, name, email, role")
          .single();

        if (insertedAdmin) {
          adminRecord = insertedAdmin;
        }
      }

      await syncLoginCredentials(
        db,
        trimmedEmail,
        rawPassword,
        "super_admin",
        adminDisplayName
      );

      return NextResponse.json({
        success: true,
        message: "Super Admin authenticated successfully.",
        user: {
          id: adminRecord?.id || "superadmin-default",
          email: adminRecord?.email || trimmedEmail,
          role: "super_admin",
          name: adminRecord?.name || adminDisplayName,
        },
        redirectUrl: "/superadmin/add-organization",
      });
    }

    // Case C: Unknown or deleted account -> reject login (never auto-provision deleted orgs!)
    return NextResponse.json(
      { error: "Invalid email or password. Please verify your credentials." },
      { status: 401 }
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Internal authentication error";
    console.error("[API /api/auth/login] Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
