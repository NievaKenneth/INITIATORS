import { NextResponse, type NextRequest } from "next/server";
import {
  getUserModulePermission,
  PermissionDeniedError,
  PermissionInputError,
  PermissionVerificationError,
  saveUserModulePermission,
} from "@/lib/supabase/permissions";
import {
  isSupportedPermissionModule,
  parsePermissionFlags,
} from "@/lib/supabase/permissions-core";
import { readJsonObject } from "@/lib/supabase/http";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function permissionErrorResponse(error: unknown) {
  if (error instanceof PermissionInputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof PermissionDeniedError) {
    return NextResponse.json(
      { error: "Only an approved superadmin can manage permissions." },
      { status: 403 },
    );
  }

  if (error instanceof PermissionVerificationError) {
    return NextResponse.json(
      { error: "Unable to verify or update permissions right now." },
      { status: 503 },
    );
  }

  console.error("User permission request failed.");
  return NextResponse.json(
    { error: "Unable to process permissions right now." },
    { status: 503 },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  try {
    const permission = await getUserModulePermission(id, "users");
    return NextResponse.json({ permission });
  } catch (error) {
    return permissionErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
  }

  const body = await readJsonObject(request);

  if (!body) {
    return NextResponse.json(
      { error: "Request body must be a valid JSON object." },
      { status: 400 },
    );
  }

  if (!isSupportedPermissionModule(body.module_name)) {
    return NextResponse.json(
      { error: "Select a supported permission module." },
      { status: 400 },
    );
  }

  const permissionFlags = parsePermissionFlags(body);

  if (!permissionFlags) {
    return NextResponse.json(
      { error: "All four permission values must be boolean." },
      { status: 400 },
    );
  }

  try {
    await saveUserModulePermission(id, body.module_name, permissionFlags);
    return NextResponse.json({ success: true });
  } catch (error) {
    return permissionErrorResponse(error);
  }
}
