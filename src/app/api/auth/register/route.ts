import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  invalidJsonResponse,
  readJsonObject,
} from "@/lib/supabase/http";
import { validateCredentialsInput } from "@/lib/supabase/auth-validation";

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

  if (!getSupabasePublicConfig()) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp(validation.credentials);

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
        {
          message:
            "If an account can be created with those details, you will receive an email with next steps.",
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        message:
          "If an account can be created with those details, you will receive an email with next steps.",
      },
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
