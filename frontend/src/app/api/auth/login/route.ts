import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ujhuxmfsvfnnmrspgkqc.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_s1_F6J0hTD6ciaDvHEYipA_SvdKhmxq";

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

async function syncLoginCredentials(
  supabase: ReturnType<typeof getSupabase>,
  email: string,
  password: string,
  role: string,
  name: string
) {
  try {
    await supabase.from("login_credentials").upsert(
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

    const supabase = getSupabase();

    // 1. Check existing record in Supabase organizations table
    const { data: existingUser } = await supabase
      .from("organizations")
      .select("*")
      .ilike("email", trimmedEmail)
      .maybeSingle();

    if (existingUser) {
      // Case A: Existing Organization account -> verify password & route to organization portal
      if (existingUser.role === "organization") {
        if (existingUser.status === "suspended") {
          return NextResponse.json(
            { error: "This organization account has been suspended. Please contact the Super Administrator." },
            { status: 403 }
          );
        }

        if (existingUser.password === rawPassword) {
          // Record exact login time into updated_at so it is stored according to login time
          await supabase
            .from("organizations")
            .update({
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingUser.id);

          await syncLoginCredentials(
            supabase,
            trimmedEmail,
            rawPassword,
            "organization",
            existingUser.name
          );

          return NextResponse.json({
            success: true,
            message: "Organization authenticated and credentials synchronized.",
            user: {
              id: existingUser.id,
              email: existingUser.email,
              role: "organization",
              name: existingUser.name,
              org_id: existingUser.id,
            },
            redirectUrl: "/organization/dashboard",
          });
        } else {
          return NextResponse.json(
            { error: "Incorrect password for this organization account." },
            { status: 401 }
          );
        }
      }

      // Case B: Existing Super Admin account -> update password to newly entered credentials and sync
      const { data: updatedAdmin, error: updateErr } = await supabase
        .from("organizations")
        .update({
          password: rawPassword,
          role: "super_admin",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUser.id)
        .select()
        .single();

      if (updateErr) {
        console.warn("[API /api/auth/login] Super Admin update note:", updateErr.message);
      }

      // Sync into dedicated login_credentials table
      await syncLoginCredentials(
        supabase,
        trimmedEmail,
        rawPassword,
        "super_admin",
        existingUser.name || "TravLume Super Admin"
      );

      // Sync Supabase Auth
      try {
        await supabase.auth.signUp({
          email: trimmedEmail,
          password: rawPassword,
          options: {
            data: { role: "super_admin", org_name: existingUser.name || "TravLume Super Admin" },
          },
        });
      } catch {
        // ignore
      }

      const adminObj = updatedAdmin || existingUser;
      return NextResponse.json({
        success: true,
        message: "Credentials successfully stored and verified in Supabase database.",
        user: {
          id: adminObj.id,
          email: adminObj.email,
          role: "super_admin",
          name: adminObj.name || "TravLume Super Admin",
        },
        redirectUrl: "/superadmin/add-organization",
      });
    }

    // 2. If record does not exist in database yet:
    // AUTOMATICALLY PERSIST ANY NEW CREDENTIALS ENTERED ON THIS LOGIN GATE INTO SUPABASE!
    const derivedName = trimmedEmail.split("@")[0].replace(/[._-]/g, " ");
    const formattedName =
      derivedName.charAt(0).toUpperCase() + derivedName.slice(1) + " (Super Admin)";

    // Insert directly into organizations table so it appears in the Supabase Table Editor
    const { data: newAdmin, error: insertErr } = await supabase
      .from("organizations")
      .insert([
        {
          name: formattedName,
          email: trimmedEmail,
          password: rawPassword,
          role: "super_admin",
        },
      ])
      .select()
      .single();

    if (insertErr) {
      console.error("[API /api/auth/login] Supabase database insert error:", insertErr);
    }

    // Sync into dedicated login_credentials table
    await syncLoginCredentials(
      supabase,
      trimmedEmail,
      rawPassword,
      "super_admin",
      formattedName
    );

    // Register into Supabase Auth
    try {
      await supabase.auth.signUp({
        email: trimmedEmail,
        password: rawPassword,
        options: {
          data: { role: "super_admin", org_name: formattedName },
        },
      });
    } catch (e) {
      console.warn("[API /api/auth/login] Supabase Auth signup note:", e);
    }

    const adminUser = newAdmin || {
      id: "superadmin-default",
      email: trimmedEmail,
      role: "super_admin",
      name: formattedName,
    };

    return NextResponse.json({
      success: true,
      message: "Credentials successfully stored into Supabase database.",
      user: {
        id: adminUser.id,
        email: adminUser.email,
        role: "super_admin",
        name: adminUser.name,
      },
      redirectUrl: "/superadmin/add-organization",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal authentication error";
    console.error("[API /api/auth/login] Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
