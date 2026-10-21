import "server-only";

import { NextResponse, type NextRequest } from "next/server";

export async function readJsonObject(
  request: NextRequest,
): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return null;
  }

  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return null;
    }

    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function invalidJsonResponse() {
  return NextResponse.json(
    { error: "Request body must be a valid JSON object." },
    { status: 400 },
  );
}

export function getAppOrigin(): string | null {
  const configuredUrl = process.env.APP_URL;

  if (!configuredUrl) {
    return null;
  }

  try {
    const url = new URL(configuredUrl);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (
      (url.protocol !== "https:" && !isLocalHttp) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}
