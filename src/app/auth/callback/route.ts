import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/supabase/http";

export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin();

  if (!appOrigin) {
    return NextResponse.json(
      { error: "Authentication callback is not configured." },
      { status: 503 },
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/reset-password", appOrigin);

  if (!code) {
    destination.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(destination);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      destination.searchParams.set("error", "invalid_link");
    }

    return NextResponse.redirect(destination);
  } catch {
    console.error("Supabase auth callback failed.");
    destination.searchParams.set("error", "unavailable");
    return NextResponse.redirect(destination);
  }
}
