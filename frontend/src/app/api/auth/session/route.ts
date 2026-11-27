import { NextResponse } from "next/server";
import { verifyAuthenticatedSession } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const session = await verifyAuthenticatedSession(request);

    if (!session.user || !session.role) {
      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          isVerifiedSuperAdmin: false,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        isVerifiedSuperAdmin: session.isSuperAdmin,
        user: {
          id: session.user.id,
          email: session.user.email || "",
          role: session.role,
          name:
            (session.user.user_metadata?.org_name as string | undefined) ||
            (session.isSuperAdmin ? "TravLume Super Admin" : undefined),
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify session";
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        isVerifiedSuperAdmin: false,
        error: msg,
      },
      { status: 500 }
    );
  }
}
