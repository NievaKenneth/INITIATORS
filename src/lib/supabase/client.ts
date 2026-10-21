"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

const config = getSupabasePublicConfig();

if (!config) {
  throw new Error(
    "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before using Supabase.",
  );
}

export const supabase = createBrowserClient(
  config.url,
  config.publishableKey,
);
