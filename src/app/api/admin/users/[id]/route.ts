
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/supabase/http";
import {
  isExistingAccountAccessActionAllowed,
  PermissionDeniedError,
  PermissionVerificationError,
  requireCurrentUserModulePermission,
} from "@/lib/supabase/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const USER_ROLES = ["superadmin", "admin", "user"] as const;
type UserRole = (typeof USER_ROLES)[number];

function isUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && USER_ROLES.some((item) => item === role);
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: "Unable to verify your permissions." },
        { status: 503 },
      );
    }

    if (!profile || profile.status !== "approved") {
      return NextResponse.json(
        { error: "Your account is not approved." },
        { status: 403 },
      );
    }

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400 },
      );
    }

    const body = await readJsonObject(request);
    if (!body) {
      return NextResponse.json(
        { error: "Request body must be a valid JSON object." },
        { status: 400 },
      );
    }

    if (typeof body.full_name === "string") {
      try {
        await requireCurrentUserModulePermission("users", "can_edit");
      } catch (permissionError) {
        if (permissionError instanceof PermissionDeniedError) {
          return NextResponse.json(
            { error: "You do not have permission to edit user information." },
            { status: 403 },
          );
        }

        if (permissionError instanceof PermissionVerificationError) {
          return NextResponse.json(
            { error: "Unable to verify your user-management permissions." },
            { status: 503 },
          );
        }

        throw permissionError;
      }

      const fullName = body.full_name.normalize("NFC").trim().replace(/\s+/g, " ");

      if (
        fullName.length < 2 ||
        fullName.length > 100 ||
        /[\u0000-\u001f\u007f]/.test(fullName)
      ) {
        return NextResponse.json(
          { error: "Name must be between 2 and 100 valid characters." },
          { status: 400 },
        );
      }

      const admin = createSupabaseAdminClient();
      const { data: updated, error: updateError } = await admin
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", id)
        .select("id, full_name, role, status, updated_at")
        .maybeSingle();

      if (updateError) {
        console.error("User name update failed.");
        return NextResponse.json(
          { error: "Unable to update the user's name." },
          { status: 503 },
        );
      }

      if (!updated) {
        return NextResponse.json(
          { error: "User not found or update not permitted." },
          { status: 404 },
        );
      }

      return NextResponse.json({ user: updated });
    }

    const action = body.action;

    if (
      action !== "block" &&
      action !== "unblock" &&
      action !== "approve" &&
      action !== "reject" &&
      action !== "set_role"
    ) {
      return NextResponse.json(
        { error: "A valid user management action is required." },
        { status: 400 },
      );
    }

    if (id === user.id) {
      return NextResponse.json(
        { error: "You cannot change your own role or access status." },
        { status: 400 },
      );
    }

    if (!isExistingAccountAccessActionAllowed(profile.role, action)) {
      return NextResponse.json(
        { error: "You are not allowed to perform this action." },
        { status: 403 },
      );
    }

    const { data: target, error: targetError } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (targetError) {
      console.error("User access profile could not be loaded.");
      return NextResponse.json(
        { error: "Unable to verify the target account." },
        { status: 503 },
      );
    }

    if (!target) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 },
      );
    }

    let rpcError: { code?: string } | null = null;

    if (action === "block" || action === "unblock") {
      if (
        (action === "block" && target.status !== "approved") ||
        (action === "unblock" && target.status !== "blocked")
      ) {
        return NextResponse.json(
          { error: "The account status has changed. Refresh and try again." },
          { status: 409 },
        );
      }

      const { error } = await supabase.rpc("set_profile_blocked", {
        p_user_id: id,
        p_blocked: action === "block",
      });
      rpcError = error;
    } else if (action === "approve" || action === "reject") {
      if (target.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending accounts can be reviewed." },
          { status: 409 },
        );
      }

      const { error } = await supabase.rpc("review_profile", {
        p_user_id: id,
        p_decision: action === "approve" ? "approved" : "rejected",
      });
      rpcError = error;
    } else {
      if (!isUserRole(body.role)) {
        return NextResponse.json(
          { error: "Select a valid user role." },
          { status: 400 },
        );
      }

      const { error } = await supabase.rpc("set_profile_role", {
        p_user_id: id,
        p_role: body.role,
      });
      rpcError = error;
    }

    if (rpcError) {
      if (rpcError.code === "42501") {
        return NextResponse.json(
          { error: "You are not allowed to perform this action." },
          { status: 403 },
        );
      }

      if (rpcError.code === "22023") {
        return NextResponse.json(
          { error: "The account changed or the action is not allowed." },
          { status: 409 },
        );
      }

      console.error("User access update failed.");
      return NextResponse.json(
        { error: "Unable to update account access right now." },
        { status: 503 },
      );
    }

    const { data: updated, error: updatedError } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (updatedError || !updated) {
      console.error("Updated user profile could not be reloaded.");
      return NextResponse.json(
        { error: "The account was updated, but its latest details could not be loaded." },
        { status: 503 },
      );
    }

    return NextResponse.json({ user: updated });
  } catch {
    console.error("Admin user update request failed.");
    return NextResponse.json(
      { error: "Unable to process the user update right now." },
      { status: 503 },
    );
  }
}
