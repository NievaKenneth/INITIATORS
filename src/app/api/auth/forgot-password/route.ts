import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAppOrigin,
  invalidJsonResponse,
  readJsonObject,
} from "@/lib/supabase/http";
import { validateEmail } from "@/lib/supabase/auth-validation";

const resetRequestMessage =
  "If an account exists for that email, you will receive password reset instructions.";

export async function POST(request: NextRequest) {
  const body = await readJsonObject(request);

  if (!body) {
    return invalidJsonResponse();
  }

  const emailValidation = validateEmail(body.email);

  if (!emailValidation.success) {
    return NextResponse.json(
      { error: emailValidation.message },
      { status: 400 },
    );
  }

  const appOrigin = getAppOrigin();

  if (!getSupabasePublicConfig() || !appOrigin) {
    return NextResponse.json(
      { error: "Password recovery is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      emailValidation.email,
      {
        redirectTo: `${appOrigin}/auth/callback?next=%2Freset-password`,
      },
    );

    if (error) {
      console.error("Supabase password recovery request failed.");

      if (error.status === 429) {
        return NextResponse.json(
          { error: "Too many attempts. Please try again later." },
          { status: 429 },
        );
      }

      if (error.status && error.status >= 500) {
        return NextResponse.json(
          { error: "Password recovery is temporarily unavailable." },
          { status: 503 },
        );
      }
    }

    return NextResponse.json({ message: resetRequestMessage });
  } catch {
    console.error("Supabase password recovery request failed.");
    return NextResponse.json(
      { error: "Password recovery is temporarily unavailable." },
      { status: 503 },
    );
  }
}
