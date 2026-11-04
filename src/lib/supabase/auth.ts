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

export async function requireApprovedAdmin() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Current user's access profile could not be loaded.");
    throw new Error("Unable to verify the current user's access.");
  }

  if (
    !profile ||
    profile.status !== "approved" ||
    (profile.role !== "admin" && profile.role !== "superadmin")
  ) {
    redirect("/");
  }

  return user;
}
