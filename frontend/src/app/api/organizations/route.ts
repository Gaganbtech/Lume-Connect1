import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ujhuxmfsvfnnmrspgkqc.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_s1_F6J0hTD6ciaDvHEYipA_SvdKhmxq";

function getSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

// GET /api/organizations - Fetch all organizations directly from Supabase
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
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

// POST /api/organizations - Add new organization and register auth user in Supabase
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    const trimmedName = name?.trim();
    const trimmedEmail = email?.trim();
    const orgPassword = password?.trim() || "OrgPass123!";

    if (!trimmedName || !trimmedEmail || !orgPassword) {
      return NextResponse.json(
        { error: "Name, Email, and Password are all required." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // 1. Register Supabase Auth User (so organization can log in via Supabase Auth)
    try {
      await supabase.auth.signUp({
        email: trimmedEmail,
        password: orgPassword,
        options: {
          data: {
            role: "organization",
            org_name: trimmedName,
          },
        },
      });
    } catch (e) {
      console.warn("[API POST /api/organizations] Auth signup note:", e);
    }

    // 2. Insert record into Supabase organizations table
    // Only insert the columns that exist in the database (name, email, password, role)
    const insertPayload: Record<string, string> = {
      name: trimmedName,
      email: trimmedEmail,
      password: orgPassword,
      role: "organization",
    };

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .insert([insertPayload])
      .select()
      .single();

    if (orgError) {
      console.error("[API POST /api/organizations] Table insert error:", orgError);
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    console.log("[API POST /api/organizations] Successfully created organization in Supabase:", orgData);

    // 3. Sync to dedicated login_credentials table if it exists
    try {
      await supabase.from("login_credentials").upsert([
        {
          email: trimmedEmail,
          password: orgPassword,
          role: "organization",
          name: trimmedName,
          last_login: new Date().toISOString(),
        },
      ], { onConflict: "email" });
    } catch {
      // Graceful fallback if login_credentials table is not created yet
    }

    return NextResponse.json({ success: true, data: orgData }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error saving organization";
    console.error("[API POST /api/organizations] Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
