function healthResponse(status: "ok" | "unavailable" | "not_configured") {
  return Response.json(
    {
      status,
      checked: "supabase_auth_api",
      database: "not_checked",
      schema: "not_checked",
    },
    { status: status === "ok" ? 200 : 503 },
  );
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return healthResponse("not_configured");
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/health`,
      {
        method: "GET",
        headers: {
          apikey: supabasePublishableKey,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );

    await response.body?.cancel();

    if (!response.ok) {
      console.error("Supabase Auth API health check failed.", {
        status: response.status,
      });
      return healthResponse("unavailable");
    }

    return healthResponse("ok");
  } catch (error) {
    console.error("Supabase Auth API health check request failed.", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return healthResponse("unavailable");
  }
}
