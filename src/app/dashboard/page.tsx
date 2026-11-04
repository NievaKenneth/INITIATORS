import { requireUser } from "@/lib/supabase/auth";
import {
  PermissionDeniedError,
  PermissionVerificationError,
  requireCurrentUserModulePermission,
} from "@/lib/supabase/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import DashboardContent from "./dashboard-content";

export default async function DashboardPage() {
  const user = await requireUser();

  try {
    await requireCurrentUserModulePermission("users", "can_view");
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return (
        <main className="min-h-screen p-8">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="mt-2">
            Your account does not have permission to view User Management.
          </p>
        </main>
      );
    }

    if (error instanceof PermissionVerificationError) {
      return (
        <main className="min-h-screen p-8">
          <h1 className="text-2xl font-bold">Access unavailable</h1>
          <p className="mt-2">
            User Management permissions could not be verified. Please try
            again later.
          </p>
        </main>
      );
    }

    throw error;
  }

  let accountName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  try {
    const supabase = await createSupabaseServerClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Current user's display name could not be loaded.", {
        code: error.code,
      });
    } else if (typeof profile?.full_name === "string") {
      accountName = profile.full_name.trim();
    }
  } catch {
    console.error("Current user's display name lookup failed.");
  }

  return (
    <DashboardContent
      accountName={accountName}
      accountEmail={user.email ?? ""}
    />
  );
}
