import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  invalidJsonResponse,
  readJsonObject,
} from "@/lib/supabase/http";
import { validatePassword } from "@/lib/supabase/auth-validation";

function hasRecoveryMethod(amr: unknown): boolean {
  if (!Array.isArray(amr)) {
    return false;
  }

  return amr.some((entry: unknown) => {
    if (entry === "recovery") {
      return true;
    }

    return (
      typeof entry === "object" &&
      entry !== null &&
      "method" in entry &&
      entry.method === "recovery"
    );
  });
}

export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);

  if (!body) {
    return invalidJsonResponse();
  }

  const passwordValidation = validatePassword(body.password);

  if (!passwordValidation.success) {
    return NextResponse.json(
      { error: passwordValidation.message },
      { status: 400 },
    );
  }

  if (!getSupabasePublicConfig()) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims();

    if (
      claimsError ||
      !claimsData ||
      !hasRecoveryMethod(claimsData.claims.amr)
    ) {
      if (claimsError?.status && claimsError.status >= 500) {
        return NextResponse.json(
          { error: "Authentication is temporarily unavailable." },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: "A valid password recovery session is required." },
        { status: 401 },
      );
    }

    const { error } = await supabase.auth.updateUser({
      password: passwordValidation.password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Unable to update the password. Please try again." },
        { status: 400 },
      );
    }

    let signOutFailed = false;

    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      signOutFailed = Boolean(signOutError);
    } catch {
      signOutFailed = true;
    }

    if (signOutFailed) {
      console.error("Local sign-out after password recovery failed.");
      return NextResponse.json(
        {
          error:
            "Your password was updated, but sign-out failed. Please close your session manually.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      message: "Password updated. Please sign in with your new password.",
    });
  } catch {
    console.error("Supabase password update failed.");
    return NextResponse.json(
      { error: "Unable to update the password right now." },
      { status: 503 },
    );
  }
}
