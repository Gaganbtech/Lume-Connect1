import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  findAuthUserByEmail,
  SUPER_ADMIN_EMAIL,
  verifySuperAdminSession,
} from "@/lib/supabase/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Verify caller has a genuine Supabase Auth session for admin@lumeconnect.com (role = super_admin)
    const session = await verifySuperAdminSession(request);
    if (!session.user || !session.isSuperAdmin) {
      return NextResponse.json(
        { error: session.error || "Forbidden" },
        { status: session.status }
      );
    }

    // 2. Ensure server-only Service Role client is configured
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json(
        {
          error:
            "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is required to delete organizations.",
        },
        { status: 500 }
      );
    }

    // 3. Validate organization ID
    const { id } = await context.params;
    const orgId = id?.trim();
    if (!orgId || !UUID_REGEX.test(orgId)) {
      return NextResponse.json(
        { error: "Invalid organization ID." },
        { status: 400 }
      );
    }

    // 4. Fetch target organization record
    const { data: org, error: fetchError } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    if (fetchError) {
      console.error("[API DELETE /api/organizations/[id]] Lookup error:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found." },
        { status: 404 }
      );
    }

    // 5. Block deleting Super Admin account or any row with role = super_admin
    const targetEmail = (org.email as string | undefined)?.trim().toLowerCase() || "";
    if (org.role === "super_admin" || targetEmail === SUPER_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Forbidden: The Super Admin account cannot be deleted." },
        { status: 403 }
      );
    }

    // 6. Delete user from Supabase Auth first so login is revoked immediately
    let authUserId: string | null =
      typeof org.user_id === "string" && org.user_id ? org.user_id : null;

    if (!authUserId && targetEmail) {
      const authUser = await findAuthUserByEmail(supabaseAdmin, targetEmail);
      if (authUser) {
        if (authUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
          return NextResponse.json(
            { error: "Forbidden: The Super Admin account cannot be deleted." },
            { status: 403 }
          );
        }
        authUserId = authUser.id;
      }
    }

    if (authUserId) {
      const { error: authDeleteError } =
        await supabaseAdmin.auth.admin.deleteUser(authUserId);

      if (authDeleteError) {
        const msg = authDeleteError.message?.toLowerCase() || "";
        const isNotFound =
          msg.includes("not found") || authDeleteError.status === 404;

        if (!isNotFound) {
          console.error(
            "[API DELETE /api/organizations/[id]] Auth delete error:",
            authDeleteError
          );
          return NextResponse.json(
            { error: `Failed to delete Supabase Auth user: ${authDeleteError.message}` },
            { status: 500 }
          );
        }
      }
    }

    // 7. Delete matching credentials from public.login_credentials
    if (targetEmail) {
      const { error: credDeleteError } = await supabaseAdmin
        .from("login_credentials")
        .delete()
        .ilike("email", targetEmail);

      if (
        credDeleteError &&
        credDeleteError.code !== "42P01" &&
        credDeleteError.code !== "PGRST205"
      ) {
        console.error(
          "[API DELETE /api/organizations/[id]] Credentials delete error:",
          credDeleteError
        );
        return NextResponse.json(
          {
            error: `Failed to delete organization login credentials: ${credDeleteError.message}`,
          },
          { status: 500 }
        );
      }
    }

    // 8. Delete organization record from public.organizations
    const { error: orgDeleteError } = await supabaseAdmin
      .from("organizations")
      .delete()
      .eq("id", orgId);

    if (orgDeleteError) {
      console.error(
        "[API DELETE /api/organizations/[id]] Organization delete error:",
        orgDeleteError
      );
      return NextResponse.json(
        { error: `Failed to delete organization: ${orgDeleteError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        deletedId: orgId,
        email: org.email,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Server error deleting organization";
    console.error("[API DELETE /api/organizations/[id]] Exception:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
