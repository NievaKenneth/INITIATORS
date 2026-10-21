export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return Response.json({ status: "not_configured" }, { status: 503 });
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/`,
      {
        method: "HEAD",
        headers: { apikey: supabasePublishableKey },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!response.ok) {
      console.error(
        `Supabase REST health check returned HTTP ${response.status}.`,
      );
      return Response.json({ status: "unavailable" }, { status: 503 });
    }

    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Supabase REST health check failed.", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
