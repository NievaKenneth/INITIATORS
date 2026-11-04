import { requireUser } from "@/lib/supabase/auth";
import {
  PermissionDeniedError,
  PermissionVerificationError,
  requireCurrentUserModulePermission,
} from "@/lib/supabase/permissions";
import DashboardContent from "./dashboard-content";

export default async function DashboardPage() {
  await requireUser();

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

  return <DashboardContent />;
}
