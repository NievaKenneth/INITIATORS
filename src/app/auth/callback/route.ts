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

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type");
  const requestedDestination = searchParams.get("next");
  const flow =
    type === "signup"
      ? "signup"
      : type === "recovery" ||
          (!type && requestedDestination === "/reset-password")
        ? "recovery"
        : null;
  const destination = new URL(
    flow === "recovery" ? "/reset-password" : "/login",
    appOrigin,
  );
  const code = searchParams.get("code");

  if (!flow || !code) {
    destination.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(destination);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      destination.searchParams.set("error", "invalid_link");
    } else if (flow === "signup") {
      destination.searchParams.set("confirmed", "1");
    }

    return NextResponse.redirect(destination);
  } catch {
    console.error("Supabase auth callback failed.");
    destination.searchParams.set("error", "unavailable");
    return NextResponse.redirect(destination);
  }
}
