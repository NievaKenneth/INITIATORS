import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAppOrigin,
  invalidJsonResponse,
  readJsonObject,
} from "@/lib/supabase/http";
import {
  normalizeFullName,
  validateCredentialsInput,
} from "@/lib/supabase/auth-validation";

const registrationAcceptedMessage =
  "If an account can be created with those details, you will receive an email with next steps. Accounts require approval before access.";

export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);

  if (!body) {
    return invalidJsonResponse();
  }

  const validation = validateCredentialsInput(body.email, body.password);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Check your email and password, then try again." },
      { status: 400 },
    );
  }

  if (
    typeof body.confirmPassword !== "string" ||
    body.password !== body.confirmPassword
  ) {
    return NextResponse.json(
      { error: "Passwords do not match." },
      { status: 400 },
    );
  }

  const fullName = normalizeFullName(body.fullName);

  if (!fullName) {
    return NextResponse.json(
      { error: "Name must be between 2 and 100 valid characters." },
      { status: 400 },
    );
  }

  const appOrigin = getAppOrigin();

  if (!getSupabasePublicConfig() || !appOrigin) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      ...validation.credentials,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${appOrigin}/auth/callback`,
      },
    });

    if (error) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Too many attempts. Please try again later." },
          { status: 429 },
        );
      }

      if (error.status && error.status >= 500) {
        return NextResponse.json(
          { error: "Registration is temporarily unavailable." },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { message: registrationAcceptedMessage },
        { status: 202 },
      );
    }

    if (data.session) {
      if (!data.user) {
        console.error(
          "Supabase registration returned a session without a user.",
        );
        return NextResponse.json(
          { error: "Unable to complete registration right now." },
          { status: 503 },
        );
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error("New Supabase user profile could not be verified.", {
          queryFailed: Boolean(profileError),
        });
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "local",
        });
        if (signOutError) {
          console.error(
            "Supabase session cleanup failed after profile verification.",
          );
        }
        return NextResponse.json(
          { error: "Unable to complete registration right now." },
          { status: 503 },
        );
      }
    }

    return NextResponse.json(
      { message: registrationAcceptedMessage },
      { status: 202 },
    );
  } catch {
    console.error("Supabase registration request failed.");
    return NextResponse.json(
      { error: "Unable to complete registration right now." },
      { status: 503 },
    );
  }
}
