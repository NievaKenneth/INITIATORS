import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  if (!getSupabasePublicConfig()) {
    return NextResponse.json(
      { error: "Authentication is not configured." },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      console.error("Supabase sign-out returned an error.");
      return NextResponse.json(
        { error: "Unable to sign out. Please try again." },
        { status: 503 },
      );
    }

    return NextResponse.json({ message: "Signed out successfully." });
  } catch {
    console.error("Supabase sign-out request failed.");
    return NextResponse.json(
      { error: "Unable to sign out right now." },
      { status: 503 },
    );
  }
}
