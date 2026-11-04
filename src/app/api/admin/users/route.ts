
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/supabase/http";
import {
  validateEmail,
  validatePassword,
} from "@/lib/supabase/auth-validation";
import {
  getCurrentUserPermissionSummary,
  PermissionDeniedError,
  PermissionVerificationError,
  requireCurrentUserModulePermission,
} from "@/lib/supabase/permissions";

export async function GET() {
  try {
    // Verify the caller's session using their cookies.
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 },
      );
    }

    // Check the caller's role and approval status in the database.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, status, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json(
        { error: "Unable to verify account permissions." },
        { status: 503 },
      );
    }

    if (!profile || profile.status !== "approved") {
      return NextResponse.json(
        { error: "Your account is not approved." },
        { status: 403 },
      );
    }

    try {
      await requireCurrentUserModulePermission("users", "can_view");
    } catch (permissionError) {
      if (permissionError instanceof PermissionDeniedError) {
        return NextResponse.json(
          { error: "You do not have permission to view users." },
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

    const permissionSummary = await getCurrentUserPermissionSummary();

    // Use the service-role client only after verifying the caller.
    const admin = createSupabaseAdminClient();
    const authUsers: { id: string; email?: string; created_at: string }[] = [];
    let hasMoreAuthUsers = false;

    // Fetch all Auth users in pages.
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        console.error("Supabase Auth user listing failed.", {
          name: error.name,
          code: error.code,
          status: error.status,
        });
        return NextResponse.json(
          { error: "Unable to load user accounts." },
          { status: 503 },
        );
      }

      authUsers.push(...data.users);

      if (data.users.length < 1000) {
        hasMoreAuthUsers = false;
        break;
      }

      hasMoreAuthUsers = true;
    }

    if (hasMoreAuthUsers) {
      console.error("Admin user listing exceeded the supported Auth page limit.");
      return NextResponse.json(
        { error: "The user list exceeds the supported size." },
        { status: 503 },
      );
    }

    // Permission-checked callers use the admin client because regular users
    // cannot select other profiles under the normal RLS policy.
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, full_name, role, status, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (profilesError || !profiles) {
      return NextResponse.json(
        { error: "Unable to load user profiles." },
        { status: 503 },
      );
    }

    const emailById = new Map(
      authUsers.map((authUser) => [authUser.id, authUser.email ?? null]),
    );

    const users = profiles.map((item) => ({
      ...item,
      email: emailById.get(item.id) ?? null,
    }));

    return NextResponse.json({
      users,
      currentUser: {
        id: user.id,
        name: profile.full_name,
        email: user.email ?? "",
        role: profile.role,
        permissions: permissionSummary.permissions,
        visibleModules: permissionSummary.visibleModules,
      },
    });
  } catch {
    console.error("Admin user-list request failed.");
    return NextResponse.json(
      { error: "Unable to load users right now." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to continue." },
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
        { error: "Unable to verify account permissions." },
        { status: 503 },
      );
    }

    if (!profile || profile.status !== "approved") {
      return NextResponse.json(
        { error: "Your account is not approved." },
        { status: 403 },
      );
    }

    try {
      await requireCurrentUserModulePermission("users", "can_add");
    } catch (permissionError) {
      if (permissionError instanceof PermissionDeniedError) {
        return NextResponse.json(
          { error: "You do not have permission to create users." },
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

    const body = await readJsonObject(request);

    if (!body) {
      return NextResponse.json(
        { error: "Request body must be a valid JSON object." },
        { status: 400 },
      );
    }

    const fullName =
      typeof body.full_name === "string"
        ? body.full_name.normalize("NFC").trim().replace(/\s+/g, " ")
        : "";
    const nameHasControlCharacters = /[\u0000-\u001f\u007f]/.test(fullName);

    if (
      fullName.length < 2 ||
      fullName.length > 100 ||
      nameHasControlCharacters
    ) {
      return NextResponse.json(
        { error: "Name must be between 2 and 100 valid characters." },
        { status: 400 },
      );
    }

    const emailValidation = validateEmail(body.email);
    const passwordValidation = validatePassword(body.password);

    if (!emailValidation.success) {
      return NextResponse.json(
        { error: emailValidation.message },
        { status: 400 },
      );
    }

    if (!passwordValidation.success) {
      return NextResponse.json(
        { error: passwordValidation.message },
        { status: 400 },
      );
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: emailValidation.email,
      password: passwordValidation.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error) {
      if (
        error.code === "email_exists" ||
        error.code === "user_already_exists" ||
        /already (?:exists|been registered)/i.test(error.message)
      ) {
        return NextResponse.json(
          { error: "An account with that email already exists." },
          { status: 409 },
        );
      }

      console.error("Admin user creation failed.");
      return NextResponse.json(
        { error: "Unable to create the user right now." },
        { status: 503 },
      );
    }

    const { error: auditError } = await admin
      .from("security_audit_log")
      .insert({
        actor_user_id: user.id,
        actor_type: "user",
        target_user_id: data.user.id,
        action: "admin.account_created",
        after_values: { role: "user", status: "pending" },
      });

    if (auditError) {
      console.error("Admin account creation audit event could not be recorded.");
      return NextResponse.json(
        {
          error:
            "The account was created, but its audit event could not be recorded.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        user: {
          id: data.user.id,
          full_name: fullName,
          email: emailValidation.email,
          role: "user",
          status: "pending",
          created_at: data.user.created_at,
          updated_at: data.user.updated_at ?? data.user.created_at,
        },
      },
      { status: 201 },
    );
  } catch {
    console.error("Admin user creation request failed.");
    return NextResponse.json(
      { error: "Unable to create the user right now." },
      { status: 503 },
    );
  }
}
