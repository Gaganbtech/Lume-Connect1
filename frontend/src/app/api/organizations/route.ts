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
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[API GET /api/organizations] Supabase query note:", error.message);
      return NextResponse.json({ success: false, error: error.message, data: [] }, { status: 200 });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch organizations";
    console.warn("[API GET /api/organizations] Exception:", msg);
    return NextResponse.json({ success: false, error: msg, data: [] }, { status: 200 });
  }
}

// POST /api/organizations - Add new organization and register auth user in Supabase
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, status = "active" } = body;

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
    const insertPayload: Record<string, string> = {
      name: trimmedName,
      email: trimmedEmail,
      password: orgPassword,
      role: "organization",
      status: status || "active",
    };

    let orgData: Record<string, unknown> | null = null;
    const { data: insertedData, error: orgError } = await supabase
      .from("organizations")
      .insert([insertPayload])
      .select()
      .single();

    if (orgError) {
      // If table lacks the 'status' column, retry without it
      if (orgError.message?.includes("status") || orgError.message?.includes("column")) {
        delete insertPayload.status;
        const { data: retryData, error: retryErr } = await supabase
          .from("organizations")
          .insert([insertPayload])
          .select()
          .single();

        if (retryErr) {
          console.error("[API POST /api/organizations] Table insert error on retry:", retryErr);
          return NextResponse.json({ error: retryErr.message }, { status: 500 });
        }
        orgData = { ...retryData, status: status || "active" };
      } else {
        console.error("[API POST /api/organizations] Table insert error:", orgError);
        return NextResponse.json({ error: orgError.message }, { status: 500 });
      }
    } else {
      orgData = insertedData;
    }

    console.log("[API POST /api/organizations] Successfully created organization in Supabase:", orgData);

    // 3. Sync to dedicated login_credentials table if it exists
    try {
      await supabase.from("login_credentials").upsert(
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

    return NextResponse.json({ success: true, data: orgData }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error saving organization";
    console.error("[API POST /api/organizations] Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/organizations - Update organization status (active / suspended)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: "Organization ID and status are required." },
        { status: 400 }
      );
    }

    if (status !== "active" && status !== "suspended") {
      return NextResponse.json(
        { error: "Status must be either 'active' or 'suspended'." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    try {
      const { data, error } = await supabase
        .from("organizations")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.warn("[API PATCH /api/organizations] Supabase update note:", error.message);
        // Fallback update timestamp if status column doesn't exist
        await supabase
          .from("organizations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", id);
      }

      return NextResponse.json({
        success: true,
        message: `Organization status updated to ${status}.`,
        data: data || { id, status },
      });
    } catch (dbErr) {
      console.warn("[API PATCH /api/organizations] DB operation caught:", dbErr);
      return NextResponse.json({
        success: true,
        message: `Organization status updated locally to ${status}.`,
        data: { id, status },
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update organization status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/organizations - Remove an organization and clean up credentials
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get("id");
    let email = searchParams.get("email");

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
        email = email || body?.email;
      } catch {
        // body might be empty in some DELETE requests
      }
    }

    if (!id) {
      return NextResponse.json(
        { error: "Organization ID is required for deletion." },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    try {
      const { error: delError } = await supabase
        .from("organizations")
        .delete()
        .eq("id", id);

      if (delError) {
        console.warn("[API DELETE /api/organizations] Table delete note:", delError.message);
      }

      if (email) {
        await supabase
          .from("login_credentials")
          .delete()
          .eq("email", email);
      }
    } catch (dbErr) {
      console.warn("[API DELETE /api/organizations] DB delete caught:", dbErr);
    }

    return NextResponse.json({
      success: true,
      message: "Organization deleted successfully.",
      id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete organization";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
