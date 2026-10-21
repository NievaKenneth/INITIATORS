import "server-only";

import { AuthSessionMissingError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error instanceof AuthSessionMissingError) {
      return null;
    }

    if (error) {
      throw new Error("Unable to verify the current user.");
    }

    return data.user;
  } catch {
    console.error("Current Supabase user verification failed.");
    throw new Error("Unable to verify the current user.");
  }
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
