
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./lib/supabase/config";

function setAuthResponseCacheHeaders(
  response: NextResponse,
  isAuthResponse: boolean,
) {
  if (!isAuthResponse) {
    return response;
  }

  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");

  return response;
}

export async function proxy(request: NextRequest) {
  console.log("PROXY RUNNING:", request.nextUrl.pathname);

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isAuthResponse =
    request.nextUrl.pathname.startsWith("/api/auth/") ||
    request.nextUrl.pathname === "/auth/callback" ||
    request.headers.has("next-action");
  const config = getSupabasePublicConfig();

  if (!config) {
    console.error("SUPABASE CONFIG MISSING");

    if (isDashboard) {
      return setAuthResponseCacheHeaders(
        NextResponse.redirect(new URL("/login", request.url)),
        isAuthResponse,
      );
    }

    return setAuthResponseCacheHeaders(
      NextResponse.next({ request }),
      isAuthResponse,
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    config.url,
    config.publishableKey,
    {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });

          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log("AUTH CHECK:", {
    path: request.nextUrl.pathname,
    hasUser: !!user,
    error: error?.message,
  });

  setAuthResponseCacheHeaders(response, isAuthResponse);

  if (isDashboard && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return setAuthResponseCacheHeaders(
      NextResponse.redirect(loginUrl),
      isAuthResponse,
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
